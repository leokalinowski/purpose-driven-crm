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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      automation_runs: {
        Row: {
          created_at: string
          dry_run: boolean
          emails_sent: number
          error: string | null
          finished_at: string | null
          id: string
          started_at: string
          status: string
          test_zip: string | null
          triggered_by: string | null
          zip_codes_processed: number
        }
        Insert: {
          created_at?: string
          dry_run?: boolean
          emails_sent?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          test_zip?: string | null
          triggered_by?: string | null
          zip_codes_processed?: number
        }
        Update: {
          created_at?: string
          dry_run?: boolean
          emails_sent?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          test_zip?: string | null
          triggered_by?: string | null
          zip_codes_processed?: number
        }
        Relationships: []
      }
      automation_settings: {
        Row: {
          apify_max_results: number
          created_at: string
          enabled: boolean
          id: string
          prompt_template: string | null
          updated_at: string
        }
        Insert: {
          apify_max_results?: number
          created_at?: string
          enabled?: boolean
          id?: string
          prompt_template?: string | null
          updated_at?: string
        }
        Update: {
          apify_max_results?: number
          created_at?: string
          enabled?: boolean
          id?: string
          prompt_template?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      clickup_tasks: {
        Row: {
          clickup_task_id: string
          completed_at: string | null
          created_at: string
          due_date: string | null
          event_id: string
          id: string
          responsible_person: string | null
          status: string | null
          task_name: string
          updated_at: string
        }
        Insert: {
          clickup_task_id: string
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          event_id: string
          id?: string
          responsible_person?: string | null
          status?: string | null
          task_name: string
          updated_at?: string
        }
        Update: {
          clickup_task_id?: string
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          event_id?: string
          id?: string
          responsible_person?: string | null
          status?: string | null
          task_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clickup_tasks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      clickup_webhooks: {
        Row: {
          active: boolean
          created_at: string
          event_id: string | null
          id: string
          last_sync_at: string | null
          list_id: string
          team_id: string | null
          updated_at: string
          webhook_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          event_id?: string | null
          id?: string
          last_sync_at?: string | null
          list_id: string
          team_id?: string | null
          updated_at?: string
          webhook_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          event_id?: string | null
          id?: string
          last_sync_at?: string | null
          list_id?: string
          team_id?: string | null
          updated_at?: string
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clickup_webhooks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
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
      coaching_submissions: {
        Row: {
          agent_id: string
          appointments_set: number
          challenges: string | null
          created_at: string
          deals_closed: number
          id: string
          leads_contacted: number
          tasks: string | null
          updated_at: string
          week_ending: string
          week_number: number
          year: number
        }
        Insert: {
          agent_id: string
          appointments_set?: number
          challenges?: string | null
          created_at?: string
          deals_closed?: number
          id?: string
          leads_contacted?: number
          tasks?: string | null
          updated_at?: string
          week_ending: string
          week_number: number
          year: number
        }
        Update: {
          agent_id?: string
          appointments_set?: number
          challenges?: string | null
          created_at?: string
          deals_closed?: number
          id?: string
          leads_contacted?: number
          tasks?: string | null
          updated_at?: string
          week_ending?: string
          week_number?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "coaching_submissions_agent_id_fkey"
            columns: ["agent_id"]
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
            referencedRelation: "Leads_Table_Agents_Name"
            referencedColumns: ["user_id"]
          },
        ]
      }
      event_tasks: {
        Row: {
          agent_id: string
          completed_at: string | null
          created_at: string
          due_date: string | null
          event_id: string | null
          id: string
          responsible_person: string
          status: string | null
          task_name: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          event_id?: string | null
          id?: string
          responsible_person: string
          status?: string | null
          task_name: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          event_id?: string | null
          id?: string
          responsible_person?: string
          status?: string | null
          task_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_tasks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          agent_id: string | null
          attendance_count: number | null
          clickup_list_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          event_date: string
          event_type: string | null
          feedback_score: number | null
          feedback_summary: string | null
          id: string
          invited_count: number | null
          leads_generated: number | null
          location: string | null
          quarter: string | null
          registration_info: string | null
          speakers: string[] | null
          theme: string | null
          title: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          attendance_count?: number | null
          clickup_list_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date: string
          event_type?: string | null
          feedback_score?: number | null
          feedback_summary?: string | null
          id?: string
          invited_count?: number | null
          leads_generated?: number | null
          location?: string | null
          quarter?: string | null
          registration_info?: string | null
          speakers?: string[] | null
          theme?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          attendance_count?: number | null
          clickup_list_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date?: string
          event_type?: string | null
          feedback_score?: number | null
          feedback_summary?: string | null
          id?: string
          invited_count?: number | null
          leads_generated?: number | null
          location?: string | null
          quarter?: string | null
          registration_info?: string | null
          speakers?: string[] | null
          theme?: string | null
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
      Leads_Table_Agents_Name: {
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
      market_stats: {
        Row: {
          avg_price_per_sqft: number | null
          created_at: string
          fetched_at: string
          homes_sold: number | null
          id: string
          inventory: number | null
          median_dom: number | null
          median_list_price: number | null
          median_sale_price: number | null
          new_listings: number | null
          period_month: string
          source: Json | null
          updated_at: string
          zip_code: string
        }
        Insert: {
          avg_price_per_sqft?: number | null
          created_at?: string
          fetched_at?: string
          homes_sold?: number | null
          id?: string
          inventory?: number | null
          median_dom?: number | null
          median_list_price?: number | null
          median_sale_price?: number | null
          new_listings?: number | null
          period_month: string
          source?: Json | null
          updated_at?: string
          zip_code: string
        }
        Update: {
          avg_price_per_sqft?: number | null
          created_at?: string
          fetched_at?: string
          homes_sold?: number | null
          id?: string
          inventory?: number | null
          median_dom?: number | null
          median_list_price?: number | null
          median_sale_price?: number | null
          new_listings?: number | null
          period_month?: string
          source?: Json | null
          updated_at?: string
          zip_code?: string
        }
        Relationships: []
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
            foreignKeyName: "fk_po2_tasks_lead_id"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "contacts"
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
            referencedRelation: "Leads_Table_Agents_Name"
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
      zip_reports: {
        Row: {
          created_at: string
          data: Json
          id: string
          report_month: string
          updated_at: string
          zip_code: string
        }
        Insert: {
          created_at?: string
          data: Json
          id?: string
          report_month: string
          updated_at?: string
          zip_code: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          report_month?: string
          updated_at?: string
          zip_code?: string
        }
        Relationships: []
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
