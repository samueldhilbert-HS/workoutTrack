'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getInitials, formatRelativeDate } from '@/lib/utils'
import { Search, X, Check, UserPlus, Link as LinkIcon, Loader2 } from 'lucide-react'
import type { Profile } from '@/types/database'

interface FriendRequest {
  id: string
  requester_id: string
  created_at: string
  profile: Profile
}

interface Friend {
  id: string
  other_user_id: string
  created_at: string
  profile: Profile
}

export default function FriendsPage() {
  const supabase = createClient()
  const searchParams = useSearchParams()

  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteUrl, setInviteUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  useEffect(() => {
    loadData()
    // Show status messages from invite resolution
    const error = searchParams.get('error')
    const success = searchParams.get('success')
    const info = searchParams.get('info')
    if (error === 'invalid_invite') setStatusMsg('That invite link is invalid.')
    if (error === 'expired_invite') setStatusMsg('That invite link has expired.')
    if (error === 'invite_used') setStatusMsg('That invite link has already been used.')
    if (error === 'own_invite') setStatusMsg("You can't use your own invite link.")
    if (success === 'request_sent') setStatusMsg('Friend request sent!')
    if (info === 'already_friends') setStatusMsg("You're already friends with that person.")
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [friendsRes, requestsRes] = await Promise.all([
      supabase
        .from('friendships')
        .select(`
          id, requester_id, addressee_id, created_at,
          requester:profiles!requester_id(id, username, full_name, avatar_url, streak_count),
          addressee:profiles!addressee_id(id, username, full_name, avatar_url, streak_count)
        `)
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq('status', 'accepted'),

      supabase
        .from('friendships')
        .select(`
          id, requester_id, created_at,
          profile:profiles!requester_id(id, username, full_name, avatar_url)
        `)
        .eq('addressee_id', user.id)
        .eq('status', 'pending'),
    ])

    const friendList = (friendsRes.data ?? []).map((f: any) => ({
      id: f.id,
      other_user_id: f.requester_id === user.id ? f.addressee_id : f.requester_id,
      created_at: f.created_at,
      profile: f.requester_id === user.id ? f.addressee : f.requester,
    })) as Friend[]

    setFriends(friendList)
    setRequests((requestsRes.data ?? []) as unknown as FriendRequest[])
    setLoading(false)
  }

  async function searchUsers(q: string) {
    if (!q.trim()) { setSearchResults([]); return }
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .ilike('username', `%${q}%`)
      .neq('id', user?.id ?? '')
      .limit(10)
    setSearchResults((data ?? []) as Profile[])
  }

  async function sendRequest(toUserId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('friendships').insert({ requester_id: user.id, addressee_id: toUserId })
    setSearchResults(prev => prev.filter(p => p.id !== toUserId))
    setStatusMsg('Friend request sent!')
  }

  async function respondRequest(friendshipId: string, accept: boolean) {
    await supabase
      .from('friendships')
      .update({ status: accept ? 'accepted' : 'declined' })
      .eq('id', friendshipId)
    await loadData()
  }

  async function generateInvite() {
    const res = await fetch('/api/invite', { method: 'POST' })
    const { url } = await res.json()
    setInviteUrl(url)
  }

  async function copyInvite() {
    if (!inviteUrl) await generateInvite()
    await navigator.clipboard.writeText(inviteUrl || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-indigo-400" size={32} />
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-5">
      <h1 className="text-xl font-bold text-zinc-50">Friends</h1>

      {statusMsg && (
        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3 text-indigo-300 text-sm flex justify-between">
          {statusMsg}
          <button onClick={() => setStatusMsg('')}><X size={14} /></button>
        </div>
      )}

      {/* Invite link */}
      <button
        onClick={copyInvite}
        className="w-full flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl p-4"
      >
        <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center">
          <LinkIcon size={18} className="text-indigo-400" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-zinc-50">Invite a Friend</p>
          <p className="text-xs text-zinc-500">Share your personal invite link</p>
        </div>
        <span className="text-xs text-indigo-400 font-medium">{copied ? 'Copied!' : 'Copy link'}</span>
      </button>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); searchUsers(e.target.value) }}
          placeholder="Search by username…"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-zinc-50 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      {searchResults.length > 0 && (
        <div className="space-y-2">
          {searchResults.map(user => (
            <div key={user.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0">
                {getInitials(user.full_name, user.username)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-zinc-50 text-sm">@{user.username}</p>
                {user.full_name && <p className="text-xs text-zinc-500 truncate">{user.full_name}</p>}
              </div>
              <button
                onClick={() => sendRequest(user.id)}
                className="bg-indigo-500/20 text-indigo-400 rounded-full p-2"
              >
                <UserPlus size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pending requests */}
      {requests.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Requests ({requests.length})</h2>
          {requests.map(req => (
            <div key={req.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0">
                {getInitials(req.profile?.full_name, req.profile?.username)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-zinc-50 text-sm">@{req.profile?.username}</p>
                <p className="text-xs text-zinc-500">{formatRelativeDate(req.created_at)}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => respondRequest(req.id, false)}
                  className="bg-zinc-800 text-zinc-400 rounded-full p-2"
                >
                  <X size={16} />
                </button>
                <button
                  onClick={() => respondRequest(req.id, true)}
                  className="bg-emerald-500/20 text-emerald-400 rounded-full p-2"
                >
                  <Check size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Friends list */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Friends ({friends.length})</h2>
        {friends.length === 0 ? (
          <div className="text-center py-8 text-zinc-600 text-sm">
            Add friends to compare streaks and cheer each other on
          </div>
        ) : (
          friends.map(friend => (
            <div key={friend.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0">
                {friend.profile?.avatar_url
                  ? <img src={friend.profile.avatar_url} className="w-9 h-9 rounded-full object-cover" alt="" />
                  : getInitials(friend.profile?.full_name, friend.profile?.username)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-zinc-50 text-sm">@{friend.profile?.username}</p>
                {friend.profile?.full_name && <p className="text-xs text-zinc-500">{friend.profile.full_name}</p>}
              </div>
              <div className="text-right text-xs text-zinc-500">
                <p>🔥 {friend.profile?.streak_count ?? 0}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
