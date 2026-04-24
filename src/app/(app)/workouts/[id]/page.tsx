import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function WorkoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: workout } = await supabase
    .from('workouts')
    .select(`
      *,
      workout_exercises(
        *,
        exercise:exercises(*),
        sets(*)
      )
    `)
    .eq('id', id)
    .single()

  if (!workout) notFound()

  const exercises = workout.workout_exercises ?? []

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-50">{workout.name ?? 'Workout'}</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {format(new Date(workout.started_at), 'EEEE, MMM d · h:mm a')}
          </p>
        </div>
        <Link href="/workouts" className="text-zinc-500 text-sm">Done</Link>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Duration', value: workout.duration_minutes ? `${workout.duration_minutes}m` : '—' },
          { label: 'Exercises', value: exercises.length },
          { label: 'Volume', value: workout.total_volume ? `${workout.total_volume.toLocaleString()} lbs` : '—' },
        ].map(stat => (
          <div key={stat.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
            <p className="font-bold text-zinc-50">{stat.value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Exercises */}
      <div className="space-y-4">
        {exercises
          .sort((a: any, b: any) => a.exercise_order - b.exercise_order)
          .map((we: any) => (
            <div key={we.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
              <p className="font-semibold text-zinc-50">{we.exercise?.name}</p>

              {/* Set table */}
              <div className="space-y-1.5">
                <div className="grid grid-cols-[40px_1fr_1fr_60px] gap-2 text-xs text-zinc-500 px-1">
                  <span>Set</span><span>Weight</span><span>Reps</span><span className="text-right">PR</span>
                </div>
                {(we.sets ?? [])
                  .sort((a: any, b: any) => a.set_number - b.set_number)
                  .map((set: any) => (
                    <div key={set.id} className="grid grid-cols-[40px_1fr_1fr_60px] gap-2 items-center text-sm">
                      <span className="text-zinc-500 text-center">{set.set_number}</span>
                      <span className="text-zinc-200">{set.weight ?? '—'} {set.weight ? set.weight_unit : ''}</span>
                      <span className="text-zinc-200">{set.reps ?? '—'}</span>
                      <span className="text-right">
                        {set.is_pr && (
                          <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full pr-badge">
                            PR
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ))}
      </div>

      {workout.notes && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-1">Notes</p>
          <p className="text-sm text-zinc-300">{workout.notes}</p>
        </div>
      )}
    </div>
  )
}
