'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X, Plus, ChevronDown } from 'lucide-react'
import type { Exercise } from '@/types/database'

interface LoggedSet {
  reps: string
  weight: string
  weight_unit: 'lbs' | 'kg'
}

interface LoggedExercise {
  exercise: Exercise
  sets: LoggedSet[]
}

export default function LogWorkoutPage() {
  const router = useRouter()
  const supabase = createClient()

  const [workoutName, setWorkoutName] = useState('')
  const [exercises, setExercises] = useState<LoggedExercise[]>([])
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Exercise[]>([])
  const [saving, setSaving] = useState(false)
  const [startedAt] = useState(new Date().toISOString())

  const searchExercises = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return }
    const { data } = await supabase
      .from('exercises')
      .select('*')
      .ilike('name', `%${q}%`)
      .limit(20)
    setSearchResults(data ?? [])
  }, [supabase])

  function addExercise(ex: Exercise) {
    setExercises(prev => [...prev, {
      exercise: ex,
      sets: [{ reps: '', weight: '', weight_unit: 'lbs' }],
    }])
    setShowSearch(false)
    setSearchQuery('')
    setSearchResults([])
  }

  function removeExercise(idx: number) {
    setExercises(prev => prev.filter((_, i) => i !== idx))
  }

  function addSet(exIdx: number) {
    setExercises(prev => prev.map((e, i) =>
      i === exIdx
        ? { ...e, sets: [...e.sets, { reps: '', weight: e.sets.at(-1)?.weight ?? '', weight_unit: e.sets.at(-1)?.weight_unit ?? 'lbs' }] }
        : e
    ))
  }

  function updateSet(exIdx: number, setIdx: number, field: keyof LoggedSet, value: string) {
    setExercises(prev => prev.map((e, i) =>
      i === exIdx
        ? { ...e, sets: e.sets.map((s, j) => j === setIdx ? { ...s, [field]: value } : s) }
        : e
    ))
  }

  function removeSet(exIdx: number, setIdx: number) {
    setExercises(prev => prev.map((e, i) =>
      i === exIdx ? { ...e, sets: e.sets.filter((_, j) => j !== setIdx) } : e
    ))
  }

  async function saveWorkout() {
    if (exercises.length === 0) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const endedAt = new Date().toISOString()
    const durationMs = new Date(endedAt).getTime() - new Date(startedAt).getTime()
    const durationMinutes = Math.round(durationMs / 60000)

    // Calculate total volume
    let totalVolume = 0
    exercises.forEach(ex => {
      ex.sets.forEach(s => {
        const w = parseFloat(s.weight) || 0
        const r = parseInt(s.reps) || 0
        totalVolume += w * r
      })
    })

    // Insert workout
    const { data: workout, error: workoutError } = await supabase
      .from('workouts')
      .insert({
        user_id: user.id,
        name: workoutName.trim() || 'Workout',
        started_at: startedAt,
        ended_at: endedAt,
        duration_minutes: durationMinutes,
        total_volume: totalVolume,
      })
      .select('id')
      .single()

    if (workoutError || !workout) { setSaving(false); return }

    // Insert workout_exercises + sets
    for (let exIdx = 0; exIdx < exercises.length; exIdx++) {
      const ex = exercises[exIdx]
      const { data: we } = await supabase
        .from('workout_exercises')
        .insert({ workout_id: workout.id, exercise_id: ex.exercise.id, exercise_order: exIdx })
        .select('id')
        .single()

      if (!we) continue

      // Check for PRs
      const { data: currentPR } = await supabase
        .from('personal_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('exercise_id', ex.exercise.id)
        .single()

      let bestSetForPR: LoggedSet | null = null
      let bestVolume = 0
      for (const s of ex.sets) {
        const vol = (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0)
        if (vol > bestVolume) { bestVolume = vol; bestSetForPR = s }
      }

      const isPRSet = bestSetForPR && (
        !currentPR ||
        (parseFloat(bestSetForPR.weight) > currentPR.weight) ||
        (parseFloat(bestSetForPR.weight) === currentPR.weight && parseInt(bestSetForPR.reps) > currentPR.reps)
      )

      for (let sIdx = 0; sIdx < ex.sets.length; sIdx++) {
        const s = ex.sets[sIdx]
        await supabase.from('sets').insert({
          workout_exercise_id: we.id,
          set_number: sIdx + 1,
          reps: parseInt(s.reps) || null,
          weight: parseFloat(s.weight) || null,
          weight_unit: s.weight_unit,
          is_pr: isPRSet && s === bestSetForPR,
        })
      }

      // Update PR if new record
      if (isPRSet && bestSetForPR) {
        await supabase.from('personal_records').upsert({
          user_id: user.id,
          exercise_id: ex.exercise.id,
          weight: parseFloat(bestSetForPR.weight),
          reps: parseInt(bestSetForPR.reps),
          weight_unit: bestSetForPR.weight_unit,
          achieved_at: endedAt,
          workout_id: workout.id,
        }, { onConflict: 'user_id,exercise_id' })
      }
    }

    // Update last_workout_date for streak tracking
    await supabase
      .from('profiles')
      .update({ last_workout_date: new Date().toISOString().split('T')[0] })
      .eq('id', user.id)

    router.push(`/workouts/${workout.id}`)
  }

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-50">Log Workout</h1>
        <button onClick={() => router.back()} className="text-zinc-500">
          <X size={22} />
        </button>
      </div>

      <input
        type="text"
        value={workoutName}
        onChange={e => setWorkoutName(e.target.value)}
        placeholder="Workout name (e.g. Push Day)"
        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-50 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
      />

      {/* Exercises */}
      <div className="space-y-4">
        {exercises.map((ex, exIdx) => (
          <div key={exIdx} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-zinc-50">{ex.exercise.name}</p>
                <p className="text-xs text-zinc-500 capitalize">{ex.exercise.muscle_group} · {ex.exercise.equipment}</p>
              </div>
              <button onClick={() => removeExercise(exIdx)} className="text-zinc-600 hover:text-red-400 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Set header */}
            <div className="grid grid-cols-[40px_1fr_1fr_32px] gap-2 text-xs text-zinc-500 px-1">
              <span>Set</span><span>Weight</span><span>Reps</span><span />
            </div>

            {ex.sets.map((set, setIdx) => (
              <div key={setIdx} className="grid grid-cols-[40px_1fr_1fr_32px] gap-2 items-center">
                <span className="text-zinc-500 text-sm text-center">{setIdx + 1}</span>
                <div className="relative">
                  <input
                    type="number"
                    value={set.weight}
                    onChange={e => updateSet(exIdx, setIdx, 'weight', e.target.value)}
                    placeholder="0"
                    inputMode="decimal"
                    className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-zinc-50 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <input
                  type="number"
                  value={set.reps}
                  onChange={e => updateSet(exIdx, setIdx, 'reps', e.target.value)}
                  placeholder="0"
                  inputMode="numeric"
                  className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-zinc-50 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button onClick={() => removeSet(exIdx, setIdx)} className="text-zinc-700 hover:text-red-400 transition-colors flex justify-center">
                  <X size={14} />
                </button>
              </div>
            ))}

            <button
              onClick={() => addSet(exIdx)}
              className="flex items-center gap-2 text-sm text-indigo-400 font-medium py-1"
            >
              <Plus size={14} /> Add Set
            </button>
          </div>
        ))}
      </div>

      {/* Add exercise */}
      <button
        onClick={() => setShowSearch(true)}
        className="w-full flex items-center justify-center gap-2 bg-zinc-900 border border-zinc-800 border-dashed rounded-2xl py-4 text-zinc-400 text-sm font-medium"
      >
        <Plus size={18} /> Add Exercise
      </button>

      {/* Exercise search modal */}
      {showSearch && (
        <div className="fixed inset-0 z-50 bg-zinc-950/90 flex flex-col">
          <div className="bg-zinc-900 border-b border-zinc-800 px-4 pt-12 pb-4">
            <div className="flex items-center gap-3 mb-3">
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); searchExercises(e.target.value) }}
                autoFocus
                placeholder="Search exercises…"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-50 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
              />
              <button onClick={() => setShowSearch(false)} className="text-zinc-400">
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
            {searchResults.map(ex => (
              <button
                key={ex.id}
                onClick={() => addExercise(ex)}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-zinc-800 transition-colors"
              >
                <p className="font-medium text-zinc-50">{ex.name}</p>
                <p className="text-xs text-zinc-500 capitalize">{ex.muscle_group} · {ex.equipment}</p>
              </button>
            ))}
            {searchQuery && searchResults.length === 0 && (
              <p className="text-center text-zinc-600 py-8 text-sm">No exercises found</p>
            )}
          </div>
        </div>
      )}

      {/* Save button */}
      {exercises.length > 0 && (
        <button
          onClick={saveWorkout}
          disabled={saving}
          className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-bold rounded-2xl py-4 text-base transition-colors"
        >
          {saving ? 'Saving…' : 'Save Workout'}
        </button>
      )}
    </div>
  )
}
