import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** GET /api/invite?token=xxx — resolve an invite token and send a friend request */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  // Look up the invite
  const { data: invite, error } = await supabase
    .from('invite_links')
    .select('*')
    .eq('token', token)
    .single()

  if (error || !invite) {
    return NextResponse.redirect(new URL('/friends?error=invalid_invite', request.url))
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.redirect(new URL('/friends?error=expired_invite', request.url))
  }

  if (invite.used_by) {
    return NextResponse.redirect(new URL('/friends?error=invite_used', request.url))
  }

  if (invite.user_id === user.id) {
    return NextResponse.redirect(new URL('/friends?error=own_invite', request.url))
  }

  // Check if friendship already exists
  const { data: existing } = await supabase
    .from('friendships')
    .select('id, status')
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${invite.user_id}),and(requester_id.eq.${invite.user_id},addressee_id.eq.${user.id})`
    )
    .single()

  if (existing) {
    return NextResponse.redirect(new URL('/friends?info=already_friends', request.url))
  }

  // Send friend request
  const { error: friendError } = await supabase
    .from('friendships')
    .insert({ requester_id: user.id, addressee_id: invite.user_id })

  if (friendError) {
    return NextResponse.redirect(new URL('/friends?error=friend_request_failed', request.url))
  }

  // Mark invite as used
  await supabase
    .from('invite_links')
    .update({ used_by: user.id, used_at: new Date().toISOString() })
    .eq('id', invite.id)

  // Create notification for the invite owner
  await supabase.from('notifications').insert({
    user_id: invite.user_id,
    type: 'friend_request',
    title: 'New friend request',
    body: 'Someone used your invite link and sent you a friend request.',
    data: { from_user_id: user.id },
  })

  return NextResponse.redirect(new URL('/friends?success=request_sent', request.url))
}

/** POST /api/invite — generate a new invite link for the current user */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: invite, error } = await supabase
    .from('invite_links')
    .insert({ user_id: user.id })
    .select('token')
    .single()

  if (error || !invite) {
    return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 })
  }

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/invite?token=${invite.token}`
  return NextResponse.json({ url: inviteUrl, token: invite.token })
}
