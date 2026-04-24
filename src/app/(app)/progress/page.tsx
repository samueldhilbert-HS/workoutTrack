'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'
import { format } from 'date-fns'
import type { WeightLog, PersonalRecord } from '@/types/database'
import { Loader2 } from 'lucide-react'

export default function ProgressPage() {
  const supabase = createClient()
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
  const [prs, setPRs] = useState<(PersonalRecord & { exercise: { name: string } })[]>([])
  const [loading, setLoading] = useState(true)

  // Weight log form
  const [showWeightForm, setShowWeightForm] = useState(false)
  const [newWeight, setNewWeight] = useState('')
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>('lbs')
  const [savingWeight, setSavingWeight] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [wRes, prRes, profileRes] = await Promise.all([
      supabase
        .from('weight_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('log_date', { ascending: true })
        .limit(90),
      supabase
        .from('personal_records')
        .select('*, exercise:exercises(name)')
        .eq('user_id', user.id)
        .order('achieved_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('weight_unit')
        .eq('id', user.id)
        .single(),
    ])

    setWeightLogs(wRes.data ?? [])
    setPRs((prRes.data ?? []) as (PersonalRecord & { exercise: { name: string } })[])
    if (profileRes.data) setWeightUnit(profileRes.data.weight_unit as 'lbs' | 'kg')
    setLoading(false)
  }

  async function logWeight() {
    if (!newWeight) return
    setSavingWeight(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const today = new Date().toISOString().split('T')[0]
    await supabase.from('weight_logs').upsert({
      user_id: user.id,
      weight: parseFloat(newWeight),
      weight_unit: weightUnit,
      log_date: today,
    }, { onConflict: 'user_id,log_date' })

    await loadData()
    setNewWeight('')
    setShowWeightForm(false)
    setSavingWeight(false)
  }

  const chartData = weightLogs.map(log => ({
    date: format(new Date(log.log_date), 'MMM d'),
    weight: log.weight,
  }))

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-indigo-400" size={32} />
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-bold text-zinc-50">Progress</h1>

      {/* Weight chart */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-zinc-50">Body Weight</h2>
          <button
            onClick={() => setShowWeightForm(v => !v)}
            className="text-sm text-indigo-400 font-medium"
          >
            + Log
          </button>
        </div>

        {showWeightForm && (
          <div className="flex gap-2">
            <div className="flex gap-1">
              {(['lbs', 'kg'] as const).map(u => (
                <button
                  key={u}
                  onClick={() => setWeightUnit(u)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    weightUnit === u ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={newWeight}
              onChange={e => setNewWeight(e.target.value)}
              step="0.1"
              placeholder={`Weight in ${weightUnit}`}
              autoFocus
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-50 text-sm focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={logWeight}
              disabled={savingWeight || !newWeight}
              className="bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {savingWeight ? '…' : 'Save'}
            </button>
          </div>
        )}

        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ left: -20, right: 10, top: 5, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#71717a', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: '#71717a', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                domain={['dataMin - 2', 'dataMax + 2']}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                labelStyle={{ color: '#a1a1aa' }}
                itemStyle={{ color: '#6366f1' }}
                formatter={(val) => [`${val} ${weightUnit}`, 'Weight']}
              />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ fill: '#6366f1', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-32 flex items-center justify-center text-zinc-600 text-sm">
            Log at least 2 weigh-ins to see your trend
          </div>
        )}
      </div>

      {/* Personal Records */}
      <div className="space-y-3">
        <h2 className="font-semibold text-zinc-50">Personal Records</h2>
        {prs.length === 0 ? (
          <div className="text-center py-8 text-zinc-600 text-sm">
            Complete workouts to set PRs
          </div>
        ) : (
          <div className="space-y-2">
            {prs.map(pr => (
              <div key={pr.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-zinc-50">{pr.exercise?.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {format(new Date(pr.achieved_at), 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-indigo-400">{pr.weight} {pr.weight_unit}</p>
                  <p className="text-xs text-zinc-500">{pr.reps} reps</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
