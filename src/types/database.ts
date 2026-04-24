export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type Privacy = 'public' | 'friends_only' | 'private'
export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked'
export type WeightUnit = 'lbs' | 'kg'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core' | 'cardio' | 'full_body'
export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'bodyweight' | 'cable' | 'other'
export type NotificationType = 'friend_request' | 'friend_accepted' | 'reaction' | 'pr' | 'achievement' | 'milestone'
export type AchievementType = 'streak' | 'pr' | 'weight' | 'social' | 'nutrition'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  username: string
  avatar_url: string | null
  calorie_goal: number
  protein_goal: number
  target_weight: number | null
  weight_unit: WeightUnit
  privacy: Privacy
  is_admin: boolean
  is_suspended: boolean
  onboarding_complete: boolean
  streak_count: number
  last_workout_date: string | null
  created_at: string
  updated_at: string
}

export interface Friendship {
  id: string
  requester_id: string
  addressee_id: string
  status: FriendshipStatus
  created_at: string
  updated_at: string
}

export interface Exercise {
  id: string
  name: string
  muscle_group: MuscleGroup | null
  equipment: Equipment | null
  is_custom: boolean
  created_by: string | null
  created_at: string
}

export interface Workout {
  id: string
  user_id: string
  name: string | null
  notes: string | null
  started_at: string
  ended_at: string | null
  duration_minutes: number | null
  total_volume: number | null
  created_at: string
}

export interface WorkoutExercise {
  id: string
  workout_id: string
  exercise_id: string
  exercise_order: number
  notes: string | null
  created_at: string
  exercise?: Exercise
  sets?: Set[]
}

export interface Set {
  id: string
  workout_exercise_id: string
  set_number: number
  reps: number | null
  weight: number | null
  weight_unit: WeightUnit
  rpe: number | null
  is_pr: boolean
  created_at: string
}

export interface PersonalRecord {
  id: string
  user_id: string
  exercise_id: string
  weight: number
  reps: number
  weight_unit: WeightUnit
  achieved_at: string
  workout_id: string | null
  exercise?: Exercise
}

export interface WorkoutPlan {
  id: string
  user_id: string
  name: string
  description: string | null
  is_public: boolean
  created_at: string
  updated_at: string
  days?: WorkoutPlanDay[]
}

export interface WorkoutPlanDay {
  id: string
  plan_id: string
  day_of_week: number
  name: string | null
  created_at: string
  exercises?: WorkoutPlanDayExercise[]
}

export interface WorkoutPlanDayExercise {
  id: string
  plan_day_id: string
  exercise_id: string
  exercise_order: number
  target_sets: number | null
  target_reps: string | null
  target_weight: number | null
  notes: string | null
  exercise?: Exercise
}

export interface NutritionLog {
  id: string
  user_id: string
  log_date: string
  total_calories: number
  total_protein: number
  total_carbs: number
  total_fat: number
  created_at: string
  updated_at: string
  entries?: NutritionEntry[]
}

export interface FoodItem {
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  amount: string
}

export interface NutritionEntry {
  id: string
  nutrition_log_id: string
  raw_text: string
  food_items: FoodItem[] | null
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  meal_type: MealType | null
  created_at: string
}

export interface WeightLog {
  id: string
  user_id: string
  weight: number
  weight_unit: WeightUnit
  log_date: string
  notes: string | null
  created_at: string
}

export interface Achievement {
  id: string
  name: string
  description: string | null
  icon: string | null
  badge_color: string
  type: AchievementType
  criteria: Json
  created_at: string
}

export interface UserAchievement {
  id: string
  user_id: string
  achievement_id: string
  achieved_at: string
  achievement?: Achievement
}

export interface Reaction {
  id: string
  user_id: string
  workout_id: string
  created_at: string
  profile?: Profile
}

export interface InviteLink {
  id: string
  user_id: string
  token: string
  used_by: string | null
  used_at: string | null
  expires_at: string
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string | null
  data: Json | null
  read: boolean
  created_at: string
}

// Extended types with joins
export interface WorkoutWithDetails extends Workout {
  profile?: Pick<Profile, 'id' | 'username' | 'avatar_url' | 'full_name'>
  exercises?: WorkoutExercise[]
  reactions?: Reaction[]
  reaction_count?: number
  user_reacted?: boolean
}

export interface FriendWithProfile extends Friendship {
  profile: Profile
}
