import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import AdminPanel from '@/components/admin/AdminPanel'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  // Auth gate: must be logged in and admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) redirect('/dashboard')

  // Use service-role client to fetch all users (bypasses RLS)
  const adminClient = await createAdminClient()
  const { data: users } = await adminClient
    .from('profiles')
    .select('id, email, username, full_name, is_admin, is_suspended, streak_count, created_at, onboarding_complete')
    .order('created_at', { ascending: false })

  return <AdminPanel users={users ?? []} />
}
