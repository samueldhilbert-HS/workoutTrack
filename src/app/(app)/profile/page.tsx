import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getInitials } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, user_achievements(*, achievement:achievements(*))')
    .eq('id', user.id)
    .single()

  async function signOut() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-5">
      {/* Profile header */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center text-xl font-bold text-indigo-400 shrink-0">
          {profile?.avatar_url
            ? <img src={profile.avatar_url} className="w-16 h-16 rounded-full object-cover" alt="" />
            : getInitials(profile?.full_name ?? null, profile?.username ?? '?')}
        </div>
        <div>
          <p className="text-xl font-bold text-zinc-50">{profile?.full_name ?? profile?.username}</p>
          <p className="text-zinc-400 text-sm">@{profile?.username}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
            <span>🔥 {profile?.streak_count} day streak</span>
            <span className="capitalize">· {profile?.privacy?.replace('_', ' ')}</span>
          </div>
        </div>
      </div>

      {/* Goals */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-zinc-50">Goals</h2>
          <Link href="/profile/edit" className="text-xs text-indigo-400 font-medium">Edit</Link>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-800 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-zinc-50">{profile?.calorie_goal}</p>
            <p className="text-xs text-zinc-500">kcal goal</p>
          </div>
          <div className="bg-zinc-800 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-zinc-50">{profile?.protein_goal}g</p>
            <p className="text-xs text-zinc-500">protein goal</p>
          </div>
          <div className="bg-zinc-800 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-zinc-50">
              {profile?.target_weight ? `${profile.target_weight}` : '—'}
            </p>
            <p className="text-xs text-zinc-500">target {profile?.weight_unit}</p>
          </div>
        </div>
      </div>

      {/* Badges */}
      {profile?.user_achievements?.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-zinc-50">Badges</h2>
          <div className="grid grid-cols-3 gap-3">
            {profile.user_achievements.map((ua: any) => (
              <div key={ua.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
                <div className="text-2xl mb-1">{ua.achievement?.icon}</div>
                <p className="text-xs font-medium text-zinc-300 leading-tight">{ua.achievement?.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Account actions */}
      <div className="space-y-2">
        <Link
          href="/profile/edit"
          className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3"
        >
          <span className="text-sm text-zinc-50">Edit Profile</span>
          <span className="text-zinc-600">›</span>
        </Link>
        <Link
          href="/plans"
          className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3"
        >
          <span className="text-sm text-zinc-50">Workout Plans</span>
          <span className="text-zinc-600">›</span>
        </Link>
        {profile?.is_admin && (
          <Link
            href="/admin"
            className="flex items-center justify-between bg-indigo-500/10 border border-indigo-500/30 rounded-xl px-4 py-3"
          >
            <span className="text-sm text-indigo-300 font-medium">Admin Panel</span>
            <span className="text-indigo-600">›</span>
          </Link>
        )}
        <form action={signOut}>
          <button
            type="submit"
            className="w-full flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-left"
          >
            <span className="text-sm text-red-400">Sign Out</span>
          </button>
        </form>
      </div>
    </div>
  )
}
