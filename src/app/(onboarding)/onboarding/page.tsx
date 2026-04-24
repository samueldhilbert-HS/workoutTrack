'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Step = 'name' | 'username' | 'goals' | 'weight' | 'privacy'

const STEPS: Step[] = ['name', 'username', 'goals', 'weight', 'privacy']

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<Step>('name')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [calorieGoal, setCalorieGoal] = useState('2000')
  const [proteinGoal, setProteinGoal] = useState('150')
  const [targetWeight, setTargetWeight] = useState('')
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>('lbs')
  const [privacy, setPrivacy] = useState<'public' | 'friends_only' | 'private'>('friends_only')

  const stepIndex = STEPS.indexOf(step)
  const progress = ((stepIndex + 1) / STEPS.length) * 100

  async function checkUsername(name: string) {
    if (!name || name.length < 3) return false
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', name)
      .single()
    return !data
  }

  async function nextStep() {
    setError('')

    if (step === 'name') {
      if (!fullName.trim()) { setError('Please enter your full name'); return }
      setStep('username')
    } else if (step === 'username') {
      if (!username || username.length < 3) { setError('Username must be at least 3 characters'); return }
      if (!/^[a-z0-9_]+$/.test(username)) { setError('Username can only contain lowercase letters, numbers, and underscores'); return }
      setLoading(true)
      const available = await checkUsername(username)
      setLoading(false)
      if (!available) { setError('That username is already taken'); return }
      setStep('goals')
    } else if (step === 'goals') {
      if (!calorieGoal || !proteinGoal) { setError('Please set both goals'); return }
      setStep('weight')
    } else if (step === 'weight') {
      setStep('privacy')
    } else if (step === 'privacy') {
      await completeOnboarding()
    }
  }

  async function completeOnboarding() {
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        username: username.trim(),
        calorie_goal: parseInt(calorieGoal),
        protein_goal: parseInt(proteinGoal),
        target_weight: targetWeight ? parseFloat(targetWeight) : null,
        weight_unit: weightUnit,
        privacy,
        onboarding_complete: true,
      })
      .eq('id', user.id)

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-zinc-800">
        <div
          className="h-full bg-indigo-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">
              Step {stepIndex + 1} of {STEPS.length}
            </span>
          </div>

          {/* Step: Name */}
          {step === 'name' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-4xl mb-3">👋</div>
                <h2 className="text-2xl font-bold text-zinc-50">What&apos;s your name?</h2>
                <p className="text-zinc-400 text-sm mt-2">This is how you&apos;ll appear to friends</p>
              </div>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                autoFocus
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-50 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="Full name"
              />
            </div>
          )}

          {/* Step: Username */}
          {step === 'username' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-4xl mb-3">🏷️</div>
                <h2 className="text-2xl font-bold text-zinc-50">Pick a username</h2>
                <p className="text-zinc-400 text-sm mt-2">Lowercase letters, numbers, and underscores only</p>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase())}
                  autoFocus
                  maxLength={30}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-8 pr-4 py-3 text-zinc-50 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="yourname"
                />
              </div>
            </div>
          )}

          {/* Step: Goals */}
          {step === 'goals' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-4xl mb-3">🎯</div>
                <h2 className="text-2xl font-bold text-zinc-50">Set your daily goals</h2>
                <p className="text-zinc-400 text-sm mt-2">You can change these anytime</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Daily Calories</label>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      value={calorieGoal}
                      onChange={e => setCalorieGoal(e.target.value)}
                      min="500" max="10000"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-50 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">kcal</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Daily Protein</label>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      value={proteinGoal}
                      onChange={e => setProteinGoal(e.target.value)}
                      min="10" max="500"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-50 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">g</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step: Weight */}
          {step === 'weight' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-4xl mb-3">⚖️</div>
                <h2 className="text-2xl font-bold text-zinc-50">Target weight</h2>
                <p className="text-zinc-400 text-sm mt-2">Optional — helps track your progress</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setWeightUnit('lbs')}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                    weightUnit === 'lbs'
                      ? 'bg-indigo-500 text-white'
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-400'
                  }`}
                >
                  lbs
                </button>
                <button
                  onClick={() => setWeightUnit('kg')}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                    weightUnit === 'kg'
                      ? 'bg-indigo-500 text-white'
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-400'
                  }`}
                >
                  kg
                </button>
              </div>
              <div className="relative">
                <input
                  type="number"
                  value={targetWeight}
                  onChange={e => setTargetWeight(e.target.value)}
                  step="0.1"
                  min="50" max="700"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-50 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder={`Target weight in ${weightUnit}`}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">{weightUnit}</span>
              </div>
            </div>
          )}

          {/* Step: Privacy */}
          {step === 'privacy' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-4xl mb-3">🔒</div>
                <h2 className="text-2xl font-bold text-zinc-50">Privacy setting</h2>
                <p className="text-zinc-400 text-sm mt-2">Who can see your workouts and progress?</p>
              </div>
              <div className="space-y-3">
                {[
                  { value: 'public', label: 'Public', desc: 'Anyone can see your profile', icon: '🌍' },
                  { value: 'friends_only', label: 'Friends Only', desc: 'Only your approved friends', icon: '👥' },
                  { value: 'private', label: 'Private', desc: 'Only you can see your data', icon: '🔐' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setPrivacy(opt.value as typeof privacy)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-colors ${
                      privacy === opt.value
                        ? 'border-indigo-500 bg-indigo-500/10'
                        : 'border-zinc-800 bg-zinc-900'
                    }`}
                  >
                    <span className="text-2xl">{opt.icon}</span>
                    <div>
                      <div className="font-semibold text-zinc-50 text-sm">{opt.label}</div>
                      <div className="text-zinc-400 text-xs">{opt.desc}</div>
                    </div>
                    {privacy === opt.value && (
                      <div className="ml-auto w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="mt-8 flex gap-3">
            {stepIndex > 0 && (
              <button
                onClick={() => setStep(STEPS[stepIndex - 1])}
                className="flex-1 bg-zinc-900 border border-zinc-800 text-zinc-400 font-semibold rounded-xl py-3 transition-colors hover:border-zinc-700"
              >
                Back
              </button>
            )}
            <button
              onClick={nextStep}
              disabled={loading}
              className="flex-1 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-semibold rounded-xl py-3 transition-colors"
            >
              {loading ? '…' : step === 'privacy' ? 'Finish Setup' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
