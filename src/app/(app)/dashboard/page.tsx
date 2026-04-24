import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatRelativeDate, todayISO, getInitials } from '@/lib/utils'
import type { WorkoutWithDetails } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = todayISO()

  // Fetch profile, today's nutrition, today's weight, friend workouts in parallel
  const [profileRes, nutritionRes, weightRes, friendWorkoutsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('*, user_achievements(*, achievement:achievements(*))')
      .eq('id', user.id)
      .single(),

    supabase
      .from('nutrition_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('log_date', today)
      .single(),

    supabase
      .from('weight_logs')
      .select('weight, weight_unit')
      .eq('user_id', user.id)
      .order('log_date', { ascending: false })
      .limit(1)
      .single(),

    supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq('status', 'accepted'),
  ])

  const profile = profileRes.data
  const nutrition = nutritionRes.data
  const latestWeight = weightRes.data

  // Get friend IDs
  const friendIds = (friendWorkoutsRes.data ?? []).map(f =>
    f.requester_id === user.id ? f.addressee_id : f.requester_id
  )

  // Fetch recent friend workouts
  let friendWorkouts: WorkoutWithDetails[] = []
  if (friendIds.length > 0) {
    const { data } = await supabase
      .from('workouts')
      .select(`
        *,
        profile:profiles!user_id(id, username, avatar_url, full_name),
        reactions(id, user_id)
      `)
      .in('user_id', friendIds)
      .order('started_at', { ascending: false })
      .limit(10)

    friendWorkouts = (data ?? []) as WorkoutWithDetails[]
  }

  const todayWorked = profile?.last_workout_date === today

  const calorieGoal = profile?.calorie_goal ?? 2000
  const proteinGoal = profile?.protein_goal ?? 150
  const todayCalories = nutrition?.total_calories ?? 0
  const todayProtein = nutrition?.total_protein ?? 0

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-zinc-400 text-sm">Good {getGreeting()},</p>
          <h1 className="text-xl font-bold text-zinc-50">{profile?.full_name?.split(' ')[0] ?? profile?.username}</h1>
        </div>
        <Link href="/profile" className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-sm border border-indigo-500/30">
          {profile?.avatar_url
            ? <img src={profile.avatar_url} className="w-10 h-10 rounded-full object-cover" alt="" />
            : getInitials(profile?.full_name ?? null, profile?.username ?? '?')}
        </Link>
      </div>

      {/* Today's snapshot cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Workout status */}
        <div className={`col-span-1 rounded-2xl p-4 border ${todayWorked ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-zinc-900 border-zinc-800'}`}>
          <p className="text-xs text-zinc-400 mb-1">Today</p>
          <div className="text-2xl mb-1">{todayWorked ? '✅' : '⬜'}</div>
          <p className={`text-sm font-semibold ${todayWorked ? 'text-emerald-400' : 'text-zinc-300'}`}>
            {todayWorked ? 'Workout done!' : 'No workout yet'}
          </p>
        </div>

        {/* Streak */}
        <div className="rounded-2xl p-4 bg-zinc-900 border border-zinc-800">
          <p className="text-xs text-zinc-400 mb-1">Streak</p>
          <div className="text-2xl mb-1">🔥</div>
          <p className="text-sm font-semibold text-zinc-50">{profile?.streak_count ?? 0} days</p>
        </div>
      </div>

      {/* Calories */}
      <div className="rounded-2xl p-4 bg-zinc-900 border border-zinc-800 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-zinc-50">Calories</span>
          <span className="text-sm text-zinc-400">
            <span className="text-zinc-50 font-medium">{todayCalories}</span> / {calorieGoal} kcal
          </span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, (todayCalories / calorieGoal) * 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-zinc-500">
          <span>Protein: <span className="text-zinc-300">{todayProtein}g</span> / {proteinGoal}g</span>
          <Link href="/nutrition" className="text-indigo-400">Log food →</Link>
        </div>
      </div>

      {/* Weight */}
      {latestWeight && (
        <div className="rounded-2xl p-4 bg-zinc-900 border border-zinc-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-400">Current Weight</p>
            <p className="text-xl font-bold text-zinc-50 mt-0.5">
              {latestWeight.weight} <span className="text-sm text-zinc-400">{latestWeight.weight_unit}</span>
            </p>
            {profile?.target_weight && (
              <p className="text-xs text-zinc-500 mt-0.5">
                Goal: {profile.target_weight} {profile.weight_unit}
              </p>
            )}
          </div>
          <Link href="/progress" className="text-xs text-indigo-400">View trend →</Link>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/workouts/log" className="flex items-center gap-3 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-4 active:scale-95 transition-transform">
          <span className="text-2xl">💪</span>
          <div>
            <p className="text-sm font-semibold text-indigo-300">Log Workout</p>
            <p className="text-xs text-zinc-500">Start a new session</p>
          </div>
        </Link>
        <Link href="/nutrition" className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 active:scale-95 transition-transform">
          <span className="text-2xl">🥗</span>
          <div>
            <p className="text-sm font-semibold text-emerald-300">Log Food</p>
            <p className="text-xs text-zinc-500">AI-powered</p>
          </div>
        </Link>
      </div>

      {/* Friend Activity Feed */}
      {friendWorkouts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Friend Activity</h2>
          <div className="space-y-3">
            {friendWorkouts.map(workout => (
              <FriendWorkoutCard key={workout.id} workout={workout} currentUserId={user.id} />
            ))}
          </div>
        </div>
      )}

      {friendWorkouts.length === 0 && friendIds.length === 0 && (
        <div className="text-center py-8">
          <p className="text-zinc-600 text-sm">Add friends to see their activity here</p>
          <Link href="/friends" className="text-indigo-400 text-sm font-medium mt-2 block">Find friends →</Link>
        </div>
      )}
    </div>
  )
}

function FriendWorkoutCard({ workout, currentUserId }: { workout: WorkoutWithDetails; currentUserId: string }) {
  const reactions = workout.reactions ?? []
  const userReacted = reactions.some(r => r.user_id === currentUserId)
  const profile = workout.profile

  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 space-y-2">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0">
          {profile?.avatar_url
            ? <img src={profile.avatar_url} className="w-8 h-8 rounded-full object-cover" alt="" />
            : getInitials(profile?.full_name ?? null, profile?.username ?? '?')}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-50 truncate">@{profile?.username}</p>
          <p className="text-xs text-zinc-500">{formatRelativeDate(workout.started_at)}</p>
        </div>
        <CheerButton workoutId={workout.id} reacted={userReacted} count={reactions.length} currentUserId={currentUserId} />
      </div>
      {workout.name && (
        <p className="text-sm text-zinc-300">{workout.name}</p>
      )}
      {workout.duration_minutes && (
        <p className="text-xs text-zinc-500">⏱ {workout.duration_minutes} min</p>
      )}
    </div>
  )
}

function CheerButton({ workoutId, reacted, count, currentUserId }: {
  workoutId: string; reacted: boolean; count: number; currentUserId: string
}) {
  // This is a server component placeholder — the actual cheer button is client-side
  // In a real implementation this would be a client component
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
      reacted ? 'bg-yellow-500/20 text-yellow-400' : 'bg-zinc-800 text-zinc-400'
    }`}>
      <span>👊</span>
      <span>{count}</span>
    </div>
  )
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}
