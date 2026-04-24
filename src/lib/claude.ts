import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface NutritionEstimate {
  food_items: Array<{
    name: string
    amount: string
    calories: number
    protein: number
    carbs: number
    fat: number
  }>
  totals: {
    calories: number
    protein: number
    carbs: number
    fat: number
  }
}

// System prompt is eligible for prompt caching (> 1024 tokens when combined)
const NUTRITION_SYSTEM_PROMPT = `You are a precise nutrition estimation assistant for a fitness tracking app.

When given a free-text description of food, you will:
1. Parse each food item from the input
2. Estimate realistic calories and macros (protein, carbs, fat in grams) based on common serving sizes
3. Return ONLY valid JSON — no markdown, no explanation

Your estimates should reflect typical home-cooked or restaurant portions. Use standard USDA values where possible.

Rules:
- Always return valid JSON matching the exact schema below
- Round calories to nearest integer
- Round macros to one decimal place
- If quantity is ambiguous, assume a standard single serving
- For mixed dishes, estimate as best you can based on likely ingredients

Response schema (return ONLY this JSON, nothing else):
{
  "food_items": [
    {
      "name": "string — food item name",
      "amount": "string — e.g. '2 large eggs' or '6 oz'",
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number
    }
  ],
  "totals": {
    "calories": number,
    "protein": number,
    "carbs": number,
    "fat": number
  }
}`

export async function estimateNutrition(foodText: string): Promise<NutritionEstimate> {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: NUTRITION_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Estimate nutrition for: ${foodText}`,
      },
    ],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  // Strip markdown code fences Claude sometimes adds despite being told not to
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  try {
    return JSON.parse(text) as NutritionEstimate
  } catch {
    throw new Error(`Failed to parse nutrition estimate: ${raw}`)
  }
}
