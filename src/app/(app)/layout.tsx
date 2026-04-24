import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BottomNav from '@/components/BottomNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Check onboarding complete
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_complete, is_suspended')
    .eq('id', user.id)
    .single()

  if (!profile?.onboarding_complete) redirect('/onboarding')
  if (profile?.is_suspended) redirect('/suspended')

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      {/* Main content — leave room for bottom nav */}
      <main className="flex-1 pb-20 overflow-y-auto">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
