export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      events: {
        Row: {
          completed: boolean
          created_at: string
          date: string
          id: string
          notes: string
          priority: string
          time: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          date: string
          id?: string
          notes?: string
          priority?: string
          time?: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          date?: string
          id?: string
          notes?: string
          priority?: string
          time?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          id: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          id?: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          id?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      mission_tasks: {
        Row: {
          completed: boolean
          created_at: string
          day: number
          id: string
          mission_id: string
          title: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          day?: number
          id?: string
          mission_id: string
          title: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          day?: number
          id?: string
          mission_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_tasks_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          created_at: string
          days: number
          id: string
          priority: number
          start_date: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days?: number
          id?: string
          priority?: number
          start_date?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          days?: number
          id?: string
          priority?: number
          start_date?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar: string | null
          created_at: string
          currency: string | null
          id: string
          name: string | null
          notification_enabled: boolean
          priorities: string[] | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          currency?: string | null
          id: string
          name?: string | null
          notification_enabled?: boolean
          priorities?: string[] | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          name?: string | null
          notification_enabled?: boolean
          priorities?: string[] | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      routine_archives: {
        Row: {
          archived_at: string
          date_key: string
          done: number
          id: string
          tasks: Json
          total: number
          user_id: string
        }
        Insert: {
          archived_at?: string
          date_key: string
          done?: number
          id?: string
          tasks?: Json
          total?: number
          user_id: string
        }
        Update: {
          archived_at?: string
          date_key?: string
          done?: number
          id?: string
          tasks?: Json
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      streak_state: {
        Row: {
          last_broken_at: string | null
          last_completed_date: string | null
          last_evaluated_date: string | null
          last_reset_date: string | null
          streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          last_broken_at?: string | null
          last_completed_date?: string | null
          last_evaluated_date?: string | null
          last_reset_date?: string | null
          streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          last_broken_at?: string | null
          last_completed_date?: string | null
          last_evaluated_date?: string | null
          last_reset_date?: string | null
          streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_completions: {
        Row: {
          created_at: string
          date: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          task_id?: string
          user_id?: string
        }
        Relationships: []
      }
      task_exceptions: {
        Row: {
          date: string
          patch: Json
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          date: string
          patch?: Json
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          date?: string
          patch?: Json
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          category: string | null
          created_at: string
          date: string | null
          end_time: string | null
          id: string
          note: string | null
          priority: string | null
          repeat: Json | null
          time: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          date?: string | null
          end_time?: string | null
          id?: string
          note?: string | null
          priority?: string | null
          repeat?: Json | null
          time?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          date?: string | null
          end_time?: string | null
          id?: string
          note?: string | null
          priority?: string | null
          repeat?: Json | null
          time?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
