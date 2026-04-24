'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { todayISO } from '@/lib/utils'
import { Loader2, Plus, X } from 'lucide-react'
import type { NutritionLog, NutritionEntry, MealType } from '@/types/database'

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
const MEAL_EMOJI: Record<MealType, string> = {
  breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎',
}

export default function NutritionPage() {
  const supabase = createClient()
  const [log, setLog] = useState<NutritionLog | null>(null)
  const [entries, setEntries] = useState<NutritionEntry[]>([])
  const [profile, setProfile] = useState<{ calorie_goal: number; protein_goal: number } | null>(null)
  const [showInput, setShowInput] = useState(false)
  const [foodText, setFoodText] = useState('')
  const [mealType, setMealType] = useState<MealType>('lunch')
  const [loading, setLoading] = useState(false)
  const [estimating, setEstimating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [logRes, profileRes] = await Promise.all([
      supabase
        .from('nutrition_logs')
        .select('*, entries:nutrition_entries(*)')
        .eq('user_id', user.id)
        .eq('log_date', todayISO())
        .single(),
      supabase
        .from('profiles')
        .select('calorie_goal, protein_goal')
        .eq('id', user.id)
        .single(),
    ])

    if (logRes.data) {
      const { entries: e, ...logData } = logRes.data as NutritionLog & { entries: NutritionEntry[] }
      setLog(logData)
      setEntries(e ?? [])
    }
    if (profileRes.data) setProfile(profileRes.data)
    setLoading(false)
  }

  async function logFood() {
    if (!foodText.trim()) return
    setEstimating(true)
    setError('')

    const res = await fetch('/api/nutrition/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ food_text: foodText.trim(), meal_type: mealType }),
    })

    if (!res.ok) {
      setError('Failed to estimate nutrition. Try again.')
      setEstimating(false)
      return
    }

    const { entry } = await res.json()
    setEntries(prev => [...prev, entry])
    setLog(prev => prev ? {
      ...prev,
      total_calories: (prev.total_calories ?? 0) + (entry.calories ?? 0),
      total_protein: (prev.total_protein ?? 0) + (entry.protein ?? 0),
      total_carbs: (prev.total_carbs ?? 0) + (entry.carbs ?? 0),
      total_fat: (prev.total_fat ?? 0) + (entry.fat ?? 0),
    } : prev)
    setFoodText('')
    setShowInput(false)
    setEstimating(false)
  }

  async function deleteEntry(entryId: string) {
    await supabase.from('nutrition_entries').delete().eq('id', entryId)
    setEntries(prev => prev.filter(e => e.id !== entryId))
    await loadData() // refresh totals
  }

  const totalCalories = log?.total_calories ?? 0
  const totalProtein = log?.total_protein ?? 0
  const totalCarbs = log?.total_carbs ?? 0
  const totalFat = log?.total_fat ?? 0
  const calorieGoal = profile?.calorie_goal ?? 2000
  const proteinGoal = profile?.protein_goal ?? 150

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-indigo-400" size={32} />
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-50">Nutrition</h1>
        <button
          onClick={() => setShowInput(true)}
          className="bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5"
        >
          <Plus size={16} /> Log Food
        </button>
      </div>

      {/* Macro rings / summary */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-4xl font-bold text-zinc-50">{totalCalories}</p>
            <p className="text-sm text-zinc-400">of {calorieGoal} kcal</p>
          </div>
          <div className="text-right text-xs text-zinc-500">
            <p className="text-zinc-300">{calorieGoal - totalCalories > 0 ? calorieGoal - totalCalories : 0} remaining</p>
          </div>
        </div>

        {/* Calorie bar */}
        <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, (totalCalories / calorieGoal) * 100)}%` }}
          />
        </div>

        {/* Macro pills */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Protein', value: totalProtein, goal: proteinGoal, color: 'bg-blue-500' },
            { label: 'Carbs', value: totalCarbs, goal: null, color: 'bg-amber-500' },
            { label: 'Fat', value: totalFat, goal: null, color: 'bg-rose-500' },
          ].map(macro => (
            <div key={macro.label} className="bg-zinc-800 rounded-xl p-3">
              <p className="text-xs text-zinc-500">{macro.label}</p>
              <p className="text-base font-bold text-zinc-50 mt-0.5">{macro.value.toFixed(1)}g</p>
              {macro.goal && (
                <div className="mt-1.5 h-1 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${macro.color} rounded-full`}
                    style={{ width: `${Math.min(100, (macro.value / macro.goal) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Entries grouped by meal */}
      {MEAL_TYPES.map(meal => {
        const mealEntries = entries.filter(e => e.meal_type === meal)
        if (mealEntries.length === 0) return null
        return (
          <div key={meal} className="space-y-2">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide flex items-center gap-2">
              <span>{MEAL_EMOJI[meal]}</span> {meal}
            </h3>
            <div className="space-y-2">
              {mealEntries.map(entry => (
                <div key={entry.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 truncate">{entry.raw_text}</p>
                    <div className="flex gap-3 mt-1 text-xs text-zinc-500">
                      <span>{entry.calories} kcal</span>
                      <span>P: {entry.protein?.toFixed(0)}g</span>
                      <span>C: {entry.carbs?.toFixed(0)}g</span>
                      <span>F: {entry.fat?.toFixed(0)}g</span>
                    </div>
                  </div>
                  <button onClick={() => deleteEntry(entry.id)} className="text-zinc-700 hover:text-red-400 transition-colors shrink-0">
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Entries without meal type */}
      {entries.filter(e => !e.meal_type).map(entry => (
        <div key={entry.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-zinc-200 truncate">{entry.raw_text}</p>
            <div className="flex gap-3 mt-1 text-xs text-zinc-500">
              <span>{entry.calories} kcal</span>
              <span>P: {entry.protein?.toFixed(0)}g</span>
            </div>
          </div>
          <button onClick={() => deleteEntry(entry.id)} className="text-zinc-700 hover:text-red-400 transition-colors shrink-0">
            <X size={16} />
          </button>
        </div>
      ))}

      {entries.length === 0 && (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🥗</p>
          <p className="text-zinc-400">Nothing logged today</p>
          <p className="text-zinc-600 text-sm mt-1">Tap &quot;Log Food&quot; and type what you ate</p>
        </div>
      )}

      {/* Food input sheet */}
      {showInput && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-zinc-950/80">
          <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-3xl px-4 pt-5 space-y-4 max-h-[85vh] overflow-y-auto" style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom, 2.5rem))' }}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-zinc-50">Log Food</h3>
              <button onClick={() => setShowInput(false)} className="text-zinc-500">
                <X size={20} />
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {MEAL_TYPES.map(m => (
                <button
                  key={m}
                  onClick={() => setMealType(m)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${
                    mealType === m ? 'bg-indigo-500 text-zinc-50' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {MEAL_EMOJI[m]} {m}
                </button>
              ))}
            </div>

            <textarea
              value={foodText}
              onChange={e => setFoodText(e.target.value)}
              autoFocus
              rows={3}
              placeholder="Describe what you ate… e.g. '2 scrambled eggs, toast with butter, and a coffee with milk'"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-50 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 resize-none text-sm"
            />

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              onClick={logFood}
              disabled={estimating || !foodText.trim()}
              style={{ display: 'block', width: '100%', padding: '14px', color: '#ffffff', backgroundColor: estimating || !foodText.trim() ? 'rgba(99,102,241,0.5)' : '#6366f1', borderRadius: '0.75rem', fontWeight: 600, cursor: estimating || !foodText.trim() ? 'not-allowed' : 'pointer', marginBottom: '0.5rem' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {estimating ? (
                  <><Loader2 size={16} className="animate-spin" /> Estimating…</>
                ) : (
                  'Estimate & Log'
                )}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
