import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format } from 'date-fns'
import type { WorkoutPlan } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function PlansPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: plans } = await supabase
    .from('workout_plans')
    .select('*, days:workout_plan_days(id)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-50">Workout Plans</h1>
        <Link
          href="/plans/new"
          className="bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-xl"
        >
          + New Plan
        </Link>
      </div>

      {(plans ?? []).length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">📋</p>
          <p className="text-zinc-400 font-medium">No plans yet</p>
          <p className="text-zinc-600 text-sm mt-1">Create a weekly workout plan to stay consistent</p>
          <Link
            href="/plans/new"
            className="inline-block mt-4 bg-indigo-500 text-white text-sm font-semibold px-6 py-3 rounded-xl"
          >
            Create Plan
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {(plans as (WorkoutPlan & { days: { id: string }[] })[]).map(plan => (
            <Link
              key={plan.id}
              href={`/plans/${plan.id}`}
              className="block bg-zinc-900 border border-zinc-800 rounded-2xl p-4 active:scale-[0.98] transition-transform"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-zinc-50">{plan.name}</p>
                  {plan.description && (
                    <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{plan.description}</p>
                  )}
                </div>
                {plan.is_public && (
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Public</span>
                )}
              </div>
              <div className="flex gap-1 mt-3">
                {[0, 1, 2, 3, 4, 5, 6].map(day => {
                  const hasDay = (plan.days ?? []).some((d: { id: string }) => true) // simplified
                  return (
                    <div
                      key={day}
                      className="flex-1 text-center text-[10px] font-medium text-zinc-600"
                    >
                      {DAY_NAMES[day]}
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-zinc-600 mt-2">
                Updated {format(new Date(plan.updated_at), 'MMM d')}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
