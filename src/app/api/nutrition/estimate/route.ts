import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { estimateNutrition } from '@/lib/claude'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { food_text, meal_type, log_date } = body

  if (!food_text || typeof food_text !== 'string' || food_text.trim().length === 0) {
    return NextResponse.json({ error: 'food_text is required' }, { status: 400 })
  }

  if (food_text.length > 500) {
    return NextResponse.json({ error: 'food_text too long (max 500 chars)' }, { status: 400 })
  }

  try {
    const estimate = await estimateNutrition(food_text.trim())

    // Upsert the nutrition_log for today
    const date = log_date ?? new Date().toISOString().split('T')[0]

    const { data: log, error: logError } = await supabase
      .from('nutrition_logs')
      .upsert({ user_id: user.id, log_date: date }, { onConflict: 'user_id,log_date' })
      .select('id')
      .single()

    if (logError || !log) {
      return NextResponse.json({ error: 'Failed to create nutrition log' }, { status: 500 })
    }

    // Insert the nutrition entry
    const { data: entry, error: entryError } = await supabase
      .from('nutrition_entries')
      .insert({
        nutrition_log_id: log.id,
        raw_text: food_text.trim(),
        food_items: estimate.food_items,
        calories: estimate.totals.calories,
        protein: estimate.totals.protein,
        carbs: estimate.totals.carbs,
        fat: estimate.totals.fat,
        meal_type: meal_type ?? null,
      })
      .select()
      .single()

    if (entryError) {
      return NextResponse.json({ error: 'Failed to save nutrition entry' }, { status: 500 })
    }

    return NextResponse.json({ entry, estimate })
  } catch (error) {
    console.error('Nutrition estimate error:', error)
    return NextResponse.json({ error: 'Failed to estimate nutrition' }, { status: 500 })
  }
}
