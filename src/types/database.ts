// GENERADO automáticamente — no editar a mano. Regenerar con: pnpm gen-types
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      careers: {
        Row: {
          faculty: string
          id: string
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          faculty: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          faculty?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      course_teachers: {
        Row: {
          course_code: string
          id: string
          is_current: boolean
          teacher_email: string
          teacher_name: string
        }
        Insert: {
          course_code: string
          id?: string
          is_current?: boolean
          teacher_email: string
          teacher_name: string
        }
        Update: {
          course_code?: string
          id?: string
          is_current?: boolean
          teacher_email?: string
          teacher_name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ban_reason: string | null
          banned_at: string | null
          career_id: string | null
          created_at: string
          deactivated_at: string | null
          id: string
          term: number | null
          updated_at: string
        }
        Insert: {
          ban_reason?: string | null
          banned_at?: string | null
          career_id?: string | null
          created_at?: string
          deactivated_at?: string | null
          id: string
          term?: number | null
          updated_at?: string
        }
        Update: {
          ban_reason?: string | null
          banned_at?: string | null
          career_id?: string | null
          created_at?: string
          deactivated_at?: string | null
          id?: string
          term?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_career_id_fkey"
            columns: ["career_id"]
            isOneToOne: false
            referencedRelation: "careers"
            referencedColumns: ["id"]
          },
        ]
      }
      review_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
          resolved_at: string | null
          review_id: string
          status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
          resolved_at?: string | null
          review_id: string
          status?: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: Database["public"]["Enums"]["report_reason"]
          reporter_id?: string
          resolved_at?: string | null
          review_id?: string
          status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "review_reports_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "review_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_reports_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_id: string
          comment: string | null
          comment_edited_at: string | null
          comment_published_at: string | null
          course_teacher_id: string
          declared_attendance: boolean
          id: string
          published_at: string
          purge_after: string | null
          rating: number
          recommends: boolean
          respect_acknowledged: boolean
          state: Database["public"]["Enums"]["review_state"]
          updated_at: string
        }
        Insert: {
          author_id: string
          comment?: string | null
          comment_edited_at?: string | null
          comment_published_at?: string | null
          course_teacher_id: string
          declared_attendance: boolean
          id?: string
          published_at?: string
          purge_after?: string | null
          rating: number
          recommends: boolean
          respect_acknowledged?: boolean
          state?: Database["public"]["Enums"]["review_state"]
          updated_at?: string
        }
        Update: {
          author_id?: string
          comment?: string | null
          comment_edited_at?: string | null
          comment_published_at?: string | null
          course_teacher_id?: string
          declared_attendance?: boolean
          id?: string
          published_at?: string
          purge_after?: string | null
          rating?: number
          recommends?: boolean
          respect_acknowledged?: boolean
          state?: Database["public"]["Enums"]["review_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_course_teacher_id_fkey"
            columns: ["course_teacher_id"]
            isOneToOne: false
            referencedRelation: "course_teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_course_teacher_id_fkey"
            columns: ["course_teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_course_summaries"
            referencedColumns: ["course_teacher_id"]
          },
        ]
      }
    }
    Views: {
      review_comments: {
        Row: {
          comment: string | null
          comment_edited_at: string | null
          comment_published_at: string | null
          course_code: string | null
          course_teacher_id: string | null
          id: string | null
          rating: number | null
          recommends: boolean | null
          teacher_email: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_course_teacher_id_fkey"
            columns: ["course_teacher_id"]
            isOneToOne: false
            referencedRelation: "course_teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_course_teacher_id_fkey"
            columns: ["course_teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_course_summaries"
            referencedColumns: ["course_teacher_id"]
          },
        ]
      }
      teacher_course_summaries: {
        Row: {
          average_rating: number | null
          comment_count: number | null
          course_code: string | null
          course_teacher_id: string | null
          rating_count: number | null
          recommend_percentage: number | null
          teacher_email: string | null
          teacher_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      delete_own_review: { Args: { review_id: string }; Returns: undefined }
      hook_restrict_signup_to_utec: { Args: { event: Json }; Returns: Json }
    }
    Enums: {
      report_reason:
        | "insult"
        | "false_content"
        | "personal_data"
        | "not_an_experience"
        | "spam"
        | "other"
      report_status: "pending" | "kept" | "removed"
      review_state: "active" | "deleted_by_author" | "removed_by_moderation"
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
    Enums: {
      report_reason: [
        "insult",
        "false_content",
        "personal_data",
        "not_an_experience",
        "spam",
        "other",
      ],
      report_status: ["pending", "kept", "removed"],
      review_state: ["active", "deleted_by_author", "removed_by_moderation"],
    },
  },
} as const

