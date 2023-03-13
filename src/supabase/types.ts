export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[]

export interface Database {
  public: {
    Tables: {
      exercises: {
        Row: {
          id: number
          name: string
          user_id: string
        }
        Insert: {
          id?: number
          name: string
          user_id: string
        }
        Update: {
          id?: number
          name?: string
          user_id?: string
        }
      }
      sets: {
        Row: {
          exercise_id: number
          id: number
          reps: number
          weight: number | null
          workout_id: number
        }
        Insert: {
          exercise_id: number
          id?: number
          reps: number
          weight?: number | null
          workout_id: number
        }
        Update: {
          exercise_id?: number
          id?: number
          reps?: number
          weight?: number | null
          workout_id?: number
        }
      }
      workouts: {
        Row: {
          date: string
          id: number
          user_id: string
        }
        Insert: {
          date: string
          id?: number
          user_id: string
        }
        Update: {
          date?: string
          id?: number
          user_id?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
