export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      coaching_sessions: {
        Row: {
          agent_id: string
          coach_id: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          progress_notes: string | null
          session_date: string
          topics_covered: string | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          coach_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          progress_notes?: string | null
          session_date: string
          topics_covered?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          coach_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          progress_notes?: string | null
          session_date?: string
          topics_covered?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_sessions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coaching_sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      contacts: {
        Row: {
          address_1: string | null
          address_2: string | null
          agent_id: string
          category: string
          city: string | null
          created_at: string
          dnc: boolean
          email: string | null
          first_name: string | null
          id: string
          last_name: string
          notes: string | null
          phone: string | null
          state: string | null
          tags: string[] | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address_1?: string | null
          address_2?: string | null
          agent_id: string
          category: string
          city?: string | null
          created_at?: string
          dnc?: boolean
          email?: string | null
          first_name?: string | null
          id?: string
          last_name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          tags?: string[] | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address_1?: string | null
          address_2?: string | null
          agent_id?: string
          category?: string
          city?: string | null
          created_at?: string
          dnc?: boolean
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          tags?: string[] | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      dtd2_tasks: {
        Row: {
          agent_id: string
          completed_at: string | null
          created_at: string
          id: string
          lead_id: number
          reason: string | null
          status: string
          week_starting: string
        }
        Insert: {
          agent_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          lead_id: number
          reason?: string | null
          status?: string
          week_starting: string
        }
        Update: {
          agent_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          lead_id?: number
          reason?: string | null
          status?: string
          week_starting?: string
        }
        Relationships: [
          {
            foreignKeyName: "dtd2_tasks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "dtd2_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "Leads Table [Agent's Name]"
            referencedColumns: ["user_id"]
          },
        ]
      }
      events: {
        Row: {
          attendance_count: number | null
          created_at: string
          created_by: string | null
          description: string | null
          event_date: string
          event_type: string | null
          feedback_score: number | null
          id: string
          location: string | null
          title: string
          updated_at: string
        }
        Insert: {
          attendance_count?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date: string
          event_type?: string | null
          feedback_score?: number | null
          id?: string
          location?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          attendance_count?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date?: string
          event_type?: string | null
          feedback_score?: number | null
          id?: string
          location?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      leads: {
        Row: {
          agent_id: string
          category: string
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string
          name: string
          phone_number: string | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          category: string
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name: string
          name: string
          phone_number?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          category?: string
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string
          name?: string
          phone_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      "Leads Table [Agent's Name]": {
        Row: {
          address_1: string | null
          address_2: string | null
          assigned_agent_id: string | null
          city: string | null
          client_tags: string | null
          created_at: string
          dnc_list: boolean | null
          email: string | null
          first_name: string | null
          last_name: string | null
          notes: string | null
          phone: number | null
          source: string | null
          state: string | null
          status: string | null
          updated_at: string | null
          user_id: number
          zip_code: number | null
        }
        Insert: {
          address_1?: string | null
          address_2?: string | null
          assigned_agent_id?: string | null
          city?: string | null
          client_tags?: string | null
          created_at?: string
          dnc_list?: boolean | null
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          notes?: string | null
          phone?: number | null
          source?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: number
          zip_code?: number | null
        }
        Update: {
          address_1?: string | null
          address_2?: string | null
          assigned_agent_id?: string | null
          city?: string | null
          client_tags?: string | null
          created_at?: string
          dnc_list?: boolean | null
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          notes?: string | null
          phone?: number | null
          source?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: number
          zip_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "Leads Table [Agent's Name]_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      newsletter_campaigns: {
        Row: {
          campaign_name: string
          click_through_rate: number | null
          created_at: string
          created_by: string | null
          id: string
          open_rate: number | null
          recipient_count: number | null
          send_date: string | null
          status: string | null
          template_content: string | null
          updated_at: string
        }
        Insert: {
          campaign_name: string
          click_through_rate?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          open_rate?: number | null
          recipient_count?: number | null
          send_date?: string | null
          status?: string | null
          template_content?: string | null
          updated_at?: string
        }
        Update: {
          campaign_name?: string
          click_through_rate?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          open_rate?: number | null
          recipient_count?: number | null
          send_date?: string | null
          status?: string | null
          template_content?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      po2_tasks: {
        Row: {
          agent_id: string
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          lead_id: string
          notes: string | null
          task_type: string
          updated_at: string
          week_number: number
          year: number
        }
        Insert: {
          agent_id: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          lead_id: string
          notes?: string | null
          task_type: string
          updated_at?: string
          week_number: number
          year?: number
        }
        Update: {
          agent_id?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          notes?: string | null
          task_type?: string
          updated_at?: string
          week_number?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "po2_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      social_media_analytics: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          metric_date: string
          metric_type: string
          metric_value: number
          platform: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          metric_date: string
          metric_type: string
          metric_value: number
          platform: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          metric_date?: string
          metric_type?: string
          metric_value?: number
          platform?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_media_analytics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      transaction_coordination: {
        Row: {
          closing_date: string | null
          contract_date: string | null
          created_at: string
          id: string
          lead_id: number | null
          property_address: string | null
          responsible_agent: string | null
          sale_price: number | null
          transaction_stage: string
          updated_at: string
        }
        Insert: {
          closing_date?: string | null
          contract_date?: string | null
          created_at?: string
          id?: string
          lead_id?: number | null
          property_address?: string | null
          responsible_agent?: string | null
          sale_price?: number | null
          transaction_stage?: string
          updated_at?: string
        }
        Update: {
          closing_date?: string | null
          contract_date?: string | null
          created_at?: string
          id?: string
          lead_id?: number | null
          property_address?: string | null
          responsible_agent?: string | null
          sale_price?: number | null
          transaction_stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_coordination_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "Leads Table [Agent's Name]"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transaction_coordination_responsible_agent_fkey"
            columns: ["responsible_agent"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
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
