import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatRelativeDate } from '@/lib/utils'
import type { Workout } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function WorkoutsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: workouts } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(30)

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-50">Workouts</h1>
        <Link
          href="/workouts/log"
          className="bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-xl"
        >
          + Log
        </Link>
      </div>

      <Link
        href="/plans"
        className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl p-4"
      >
        <span className="text-2xl">📋</span>
        <div>
          <p className="text-sm font-semibold text-zinc-50">Workout Plans</p>
          <p className="text-xs text-zinc-500">View and manage your weekly plans</p>
        </div>
        <span className="ml-auto text-zinc-600">›</span>
      </Link>

      {(workouts ?? []).length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🏋️</p>
          <p className="text-zinc-400 font-medium">No workouts yet</p>
          <p className="text-zinc-600 text-sm mt-1">Log your first workout to get started</p>
          <Link
            href="/workouts/log"
            className="inline-block mt-4 bg-indigo-500 text-white text-sm font-semibold px-6 py-3 rounded-xl"
          >
            Start Workout
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {(workouts as Workout[]).map(workout => (
            <Link
              key={workout.id}
              href={`/workouts/${workout.id}`}
              className="block bg-zinc-900 border border-zinc-800 rounded-2xl p-4 active:scale-[0.98] transition-transform"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-zinc-50">{workout.name ?? 'Workout'}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{formatRelativeDate(workout.started_at)}</p>
                </div>
                <div className="text-right text-xs text-zinc-500">
                  {workout.duration_minutes && <p>{workout.duration_minutes} min</p>}
                  {workout.total_volume && <p>{workout.total_volume.toLocaleString()} lbs vol.</p>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
