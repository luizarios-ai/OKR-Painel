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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_users: {
        Row: {
          archived: boolean
          area_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          role: string
        }
        Insert: {
          archived?: boolean
          area_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          role?: string
        }
        Update: {
          archived?: boolean
          area_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_users_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      areas: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      checkins: {
        Row: {
          comment: string | null
          created_at: string
          created_by_user_id: string
          id: string
          key_result_id: string
          milestone_id: string | null
          reference_month: string
          value: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          created_by_user_id: string
          id?: string
          key_result_id: string
          milestone_id?: string | null
          reference_month?: string
          value: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          created_by_user_id?: string
          id?: string
          key_result_id?: string
          milestone_id?: string | null
          reference_month?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "checkins_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_key_result_id_fkey"
            columns: ["key_result_id"]
            isOneToOne: false
            referencedRelation: "key_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      cycles: {
        Row: {
          created_at: string
          end_date: string
          expected_progress_mode: string
          id: string
          name: string
          stagnation_days: number
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          expected_progress_mode?: string
          id?: string
          name: string
          stagnation_days?: number
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          expected_progress_mode?: string
          id?: string
          name?: string
          stagnation_days?: number
          start_date?: string
        }
        Relationships: []
      }
      key_results: {
        Row: {
          archived: boolean
          area_id: string | null
          created_at: string
          current_value: number | null
          cycle_id: string
          direction: string
          expected_progress_mode: string
          external_id: string | null
          grade0_value: number
          grade1_value: number
          has_milestones: boolean
          id: string
          last_checkin_at: string | null
          measurement_type: string
          objective_id: string
          owner_user_id: string
          title: string
          unit: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          area_id?: string | null
          created_at?: string
          current_value?: number | null
          cycle_id: string
          direction?: string
          expected_progress_mode?: string
          external_id?: string | null
          grade0_value?: number
          grade1_value?: number
          has_milestones?: boolean
          id?: string
          last_checkin_at?: string | null
          measurement_type?: string
          objective_id: string
          owner_user_id: string
          title: string
          unit?: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          area_id?: string | null
          created_at?: string
          current_value?: number | null
          cycle_id?: string
          direction?: string
          expected_progress_mode?: string
          external_id?: string | null
          grade0_value?: number
          grade1_value?: number
          has_milestones?: boolean
          id?: string
          last_checkin_at?: string | null
          measurement_type?: string
          objective_id?: string
          owner_user_id?: string
          title?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "key_results_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_results_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_results_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_results_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      kr_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          key_result_id: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          key_result_id: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          key_result_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kr_comments_key_result_id_fkey"
            columns: ["key_result_id"]
            isOneToOne: false
            referencedRelation: "key_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kr_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          archived: boolean
          created_at: string
          current_value: number | null
          due_date: string | null
          external_id: string | null
          id: string
          key_result_id: string
          target_value: number
          title: string
          updated_at: string
          weight: number
        }
        Insert: {
          archived?: boolean
          created_at?: string
          current_value?: number | null
          due_date?: string | null
          external_id?: string | null
          id?: string
          key_result_id: string
          target_value: number
          title: string
          updated_at?: string
          weight?: number
        }
        Update: {
          archived?: boolean
          created_at?: string
          current_value?: number | null
          due_date?: string | null
          external_id?: string | null
          id?: string
          key_result_id?: string
          target_value?: number
          title?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "milestones_key_result_id_fkey"
            columns: ["key_result_id"]
            isOneToOne: false
            referencedRelation: "key_results"
            referencedColumns: ["id"]
          },
        ]
      }
      objectives: {
        Row: {
          archived: boolean
          area_id: string | null
          created_at: string
          cycle_id: string
          description: string | null
          external_id: string | null
          id: string
          owner_user_id: string
          title: string
          updated_at: string
          weight: number
        }
        Insert: {
          archived?: boolean
          area_id?: string | null
          created_at?: string
          cycle_id: string
          description?: string | null
          external_id?: string | null
          id?: string
          owner_user_id: string
          title: string
          updated_at?: string
          weight?: number
        }
        Update: {
          archived?: boolean
          area_id?: string | null
          created_at?: string
          cycle_id?: string
          description?: string | null
          external_id?: string | null
          id?: string
          owner_user_id?: string
          title?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "objectives_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objectives_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objectives_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_areas: {
        Row: {
          area_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          area_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          area_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_areas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_areas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
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
