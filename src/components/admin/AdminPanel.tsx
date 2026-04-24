'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { Shield, Ban, Trash2, RefreshCw } from 'lucide-react'

interface AdminUser {
  id: string
  email: string
  username: string
  full_name: string | null
  is_admin: boolean
  is_suspended: boolean
  streak_count: number
  created_at: string
  onboarding_complete: boolean
}

export default function AdminPanel({ users: initialUsers }: { users: AdminUser[] }) {
  const supabase = createClient()
  const [users, setUsers] = useState(initialUsers)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const filtered = users.filter(u =>
    u.email.includes(search) || u.username.includes(search) || (u.full_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  async function toggleSuspend(userId: string, suspended: boolean) {
    setLoading(userId)
    await supabase.from('profiles').update({ is_suspended: !suspended }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_suspended: !suspended } : u))
    setLoading(null)
  }

  async function deleteUser(userId: string) {
    setLoading(userId)
    // Deleting from profiles cascades to auth.users via FK (if configured)
    // For full deletion, use the admin API via a server action in production
    await supabase.from('profiles').delete().eq('id', userId)
    setUsers(prev => prev.filter(u => u.id !== userId))
    setConfirmDelete(null)
    setLoading(null)
  }

  return (
    <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Shield className="text-indigo-400" size={22} />
        <h1 className="text-xl font-bold text-zinc-50">Admin Panel</h1>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-zinc-50">{users.length}</p>
          <p className="text-xs text-zinc-500">Total users</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-zinc-50">{users.filter(u => u.is_suspended).length}</p>
          <p className="text-xs text-zinc-500">Suspended</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-zinc-50">{users.filter(u => u.onboarding_complete).length}</p>
          <p className="text-xs text-zinc-500">Active</p>
        </div>
      </div>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search users…"
        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-50 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
      />

      <div className="space-y-2">
        {filtered.map(user => (
          <div key={user.id} className={`bg-zinc-900 border rounded-xl p-4 space-y-2 ${user.is_suspended ? 'border-red-500/30' : 'border-zinc-800'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-zinc-50 text-sm truncate">@{user.username}</p>
                  {user.is_admin && <span className="text-xs bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full">admin</span>}
                  {user.is_suspended && <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">suspended</span>}
                </div>
                <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                <p className="text-xs text-zinc-600 mt-0.5">Joined {format(new Date(user.created_at), 'MMM d, yyyy')}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                {!user.is_admin && (
                  <>
                    <button
                      onClick={() => toggleSuspend(user.id, user.is_suspended)}
                      disabled={loading === user.id}
                      title={user.is_suspended ? 'Unsuspend' : 'Suspend'}
                      className={`p-2 rounded-lg transition-colors ${
                        user.is_suspended
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {loading === user.id ? <RefreshCw size={14} className="animate-spin" /> : <Ban size={14} />}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(user.id)}
                      title="Delete user"
                      className="p-2 rounded-lg bg-red-500/10 text-red-400 transition-colors hover:bg-red-500/20"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-bold text-zinc-50">Delete user?</h3>
            <p className="text-sm text-zinc-400">
              This will permanently delete the account and all associated data. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 bg-zinc-800 text-zinc-400 rounded-xl py-3 font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteUser(confirmDelete)}
                disabled={loading === confirmDelete}
                className="flex-1 bg-red-500 text-white rounded-xl py-3 font-medium text-sm disabled:opacity-50"
              >
                {loading === confirmDelete ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
