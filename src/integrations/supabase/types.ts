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
      agent_action_items: {
        Row: {
          action_url: string | null
          agent_id: string
          created_at: string
          description: string | null
          dismissed_until: string | null
          id: string
          is_dismissed: boolean
          item_type: string
          priority: string
          resolved_at: string | null
          title: string
        }
        Insert: {
          action_url?: string | null
          agent_id: string
          created_at?: string
          description?: string | null
          dismissed_until?: string | null
          id?: string
          is_dismissed?: boolean
          item_type: string
          priority?: string
          resolved_at?: string | null
          title: string
        }
        Update: {
          action_url?: string | null
          agent_id?: string
          created_at?: string
          description?: string | null
          dismissed_until?: string | null
          id?: string
          is_dismissed?: boolean
          item_type?: string
          priority?: string
          resolved_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_action_items_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      agent_images: {
        Row: {
          created_at: string | null
          id: string
          image_type: string | null
          image_url: string
          name: string | null
          notes: string | null
          sort_order: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_type?: string | null
          image_url: string
          name?: string | null
          notes?: string | null
          sort_order?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          image_type?: string | null
          image_url?: string
          name?: string | null
          notes?: string | null
          sort_order?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      agent_marketing_settings: {
        Row: {
          brand_guidelines: string | null
          clickup_editing_task_list_id: string | null
          clickup_video_deliverables_list_id: string | null
          created_at: string
          editors: string[] | null
          example_copy: string | null
          gpt_prompt: string | null
          headshot_url: string | null
          id: string
          logo_colored_url: string | null
          logo_white_url: string | null
          metricool_brand_id: string | null
          metricool_creds: Json | null
          metricool_embed_url: string | null
          metricool_facebook_id: string | null
          metricool_gmb_id: string | null
          metricool_instagram_id: string | null
          metricool_linkedin_id: string | null
          metricool_threads_id: string | null
          metricool_tiktok_id: string | null
          metricool_twitter_id: string | null
          metricool_youtube_id: string | null
          primary_color: string | null
          secondary_color: string | null
          shade_folder_id: string | null
          target_audience: string | null
          thumbnail_guidelines: string | null
          tone_guidelines: string | null
          updated_at: string
          user_id: string
          what_not_to_say: string | null
        }
        Insert: {
          brand_guidelines?: string | null
          clickup_editing_task_list_id?: string | null
          clickup_video_deliverables_list_id?: string | null
          created_at?: string
          editors?: string[] | null
          example_copy?: string | null
          gpt_prompt?: string | null
          headshot_url?: string | null
          id?: string
          logo_colored_url?: string | null
          logo_white_url?: string | null
          metricool_brand_id?: string | null
          metricool_creds?: Json | null
          metricool_embed_url?: string | null
          metricool_facebook_id?: string | null
          metricool_gmb_id?: string | null
          metricool_instagram_id?: string | null
          metricool_linkedin_id?: string | null
          metricool_threads_id?: string | null
          metricool_tiktok_id?: string | null
          metricool_twitter_id?: string | null
          metricool_youtube_id?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          shade_folder_id?: string | null
          target_audience?: string | null
          thumbnail_guidelines?: string | null
          tone_guidelines?: string | null
          updated_at?: string
          user_id: string
          what_not_to_say?: string | null
        }
        Update: {
          brand_guidelines?: string | null
          clickup_editing_task_list_id?: string | null
          clickup_video_deliverables_list_id?: string | null
          created_at?: string
          editors?: string[] | null
          example_copy?: string | null
          gpt_prompt?: string | null
          headshot_url?: string | null
          id?: string
          logo_colored_url?: string | null
          logo_white_url?: string | null
          metricool_brand_id?: string | null
          metricool_creds?: Json | null
          metricool_embed_url?: string | null
          metricool_facebook_id?: string | null
          metricool_gmb_id?: string | null
          metricool_instagram_id?: string | null
          metricool_linkedin_id?: string | null
          metricool_threads_id?: string | null
          metricool_tiktok_id?: string | null
          metricool_twitter_id?: string | null
          metricool_youtube_id?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          shade_folder_id?: string | null
          target_audience?: string | null
          thumbnail_guidelines?: string | null
          tone_guidelines?: string | null
          updated_at?: string
          user_id?: string
          what_not_to_say?: string | null
        }
        Relationships: []
      }
      agents: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string
          id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
        }
        Relationships: []
      }
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
      background_agent_links: {
        Row: {
          background_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          background_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          background_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "background_agent_links_background_id_fkey"
            columns: ["background_id"]
            isOneToOne: false
            referencedRelation: "backgrounds"
            referencedColumns: ["id"]
          },
        ]
      }
      backgrounds: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          notes: string | null
          prompt: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          prompt?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          prompt?: string | null
          updated_at?: string | null
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
      coaching_reminder_logs: {
        Row: {
          agent_id: string
          created_at: string | null
          error_message: string | null
          id: string
          reminder_type: string | null
          sent_at: string | null
          success: boolean | null
          week_number: number
          year: number
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          reminder_type?: string | null
          sent_at?: string | null
          success?: boolean | null
          week_number: number
          year: number
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          reminder_type?: string | null
          sent_at?: string | null
          success?: boolean | null
          week_number?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "coaching_reminder_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
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
          agreements_signed: number | null
          appointments_held: number | null
          appointments_set: number
          challenges: string | null
          closing_amount: number | null
          closings: number | null
          coaching_notes: string | null
          conversations: number | null
          created_at: string
          database_size: number | null
          deals_closed: number
          dials_made: number | null
          id: string
          leads_contacted: number
          must_do_task: string | null
          offers_made_accepted: number | null
          tasks: string | null
          updated_at: string
          week: string | null
          week_ending: string
          week_number: number
          year: number
        }
        Insert: {
          agent_id: string
          agreements_signed?: number | null
          appointments_held?: number | null
          appointments_set?: number
          challenges?: string | null
          closing_amount?: number | null
          closings?: number | null
          coaching_notes?: string | null
          conversations?: number | null
          created_at?: string
          database_size?: number | null
          deals_closed?: number
          dials_made?: number | null
          id?: string
          leads_contacted?: number
          must_do_task?: string | null
          offers_made_accepted?: number | null
          tasks?: string | null
          updated_at?: string
          week?: string | null
          week_ending: string
          week_number: number
          year: number
        }
        Update: {
          agent_id?: string
          agreements_signed?: number | null
          appointments_held?: number | null
          appointments_set?: number
          challenges?: string | null
          closing_amount?: number | null
          closings?: number | null
          coaching_notes?: string | null
          conversations?: number | null
          created_at?: string
          database_size?: number | null
          deals_closed?: number
          dials_made?: number | null
          id?: string
          leads_contacted?: number
          must_do_task?: string | null
          offers_made_accepted?: number | null
          tasks?: string | null
          updated_at?: string
          week?: string | null
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
      contact_activities: {
        Row: {
          activity_date: string
          activity_type: string
          agent_id: string
          contact_id: string
          created_at: string
          duration_minutes: number | null
          id: string
          is_system_generated: boolean | null
          metadata: Json | null
          notes: string | null
          outcome: string | null
          system_source: string | null
          updated_at: string
        }
        Insert: {
          activity_date?: string
          activity_type: string
          agent_id: string
          contact_id: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          is_system_generated?: boolean | null
          metadata?: Json | null
          notes?: string | null
          outcome?: string | null
          system_source?: string | null
          updated_at?: string
        }
        Update: {
          activity_date?: string
          activity_type?: string
          agent_id?: string
          contact_id?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          is_system_generated?: boolean | null
          metadata?: Json | null
          notes?: string | null
          outcome?: string | null
          system_source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          activity_count: number | null
          address_1: string | null
          address_2: string | null
          agent_id: string
          category: string
          city: string | null
          created_at: string
          dnc: boolean
          dnc_last_checked: string | null
          email: string | null
          first_name: string | null
          id: string
          last_activity_date: string | null
          last_name: string
          notes: string | null
          phone: string | null
          state: string | null
          tags: string[] | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          activity_count?: number | null
          address_1?: string | null
          address_2?: string | null
          agent_id: string
          category: string
          city?: string | null
          created_at?: string
          dnc?: boolean
          dnc_last_checked?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_activity_date?: string | null
          last_name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          tags?: string[] | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          activity_count?: number | null
          address_1?: string | null
          address_2?: string | null
          agent_id?: string
          category?: string
          city?: string | null
          created_at?: string
          dnc?: boolean
          dnc_last_checked?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_activity_date?: string | null
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
      content_generation_results: {
        Row: {
          agent_marketing_settings_id: string | null
          clickup_task_id: string
          created_at: string
          error_message: string | null
          generated_at: string | null
          id: string
          shade_asset_id: string | null
          social_copy: string | null
          status: string
          transcript_hash: string | null
          youtube_description: string | null
          youtube_titles: string | null
        }
        Insert: {
          agent_marketing_settings_id?: string | null
          clickup_task_id: string
          created_at?: string
          error_message?: string | null
          generated_at?: string | null
          id?: string
          shade_asset_id?: string | null
          social_copy?: string | null
          status?: string
          transcript_hash?: string | null
          youtube_description?: string | null
          youtube_titles?: string | null
        }
        Update: {
          agent_marketing_settings_id?: string | null
          clickup_task_id?: string
          created_at?: string
          error_message?: string | null
          generated_at?: string | null
          id?: string
          shade_asset_id?: string | null
          social_copy?: string | null
          status?: string
          transcript_hash?: string | null
          youtube_description?: string | null
          youtube_titles?: string | null
        }
        Relationships: []
      }
      dnc_logs: {
        Row: {
          agent_id: string
          checked_count: number
          created_at: string
          errors: string | null
          flagged_count: number
          id: string
          run_date: string
        }
        Insert: {
          agent_id: string
          checked_count?: number
          created_at?: string
          errors?: string | null
          flagged_count?: number
          id?: string
          run_date?: string
        }
        Update: {
          agent_id?: string
          checked_count?: number
          created_at?: string
          errors?: string | null
          flagged_count?: number
          id?: string
          run_date?: string
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
      email_logs: {
        Row: {
          agent_id: string | null
          created_at: string
          email_type: string
          error_message: string | null
          id: string
          last_retry_at: string | null
          metadata: Json | null
          recipient_email: string
          recipient_name: string | null
          resend_email_id: string | null
          retry_count: number | null
          sent_at: string | null
          status: string
          subject: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          email_type: string
          error_message?: string | null
          id?: string
          last_retry_at?: string | null
          metadata?: Json | null
          recipient_email: string
          recipient_name?: string | null
          resend_email_id?: string | null
          retry_count?: number | null
          sent_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          email_type?: string
          error_message?: string | null
          id?: string
          last_retry_at?: string | null
          metadata?: Json | null
          recipient_email?: string
          recipient_name?: string | null
          resend_email_id?: string | null
          retry_count?: number | null
          sent_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      event_email_templates: {
        Row: {
          created_at: string
          email_type: string
          event_id: string
          html_content: string
          id: string
          is_active: boolean
          subject: string
          text_content: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_type: string
          event_id: string
          html_content: string
          id?: string
          is_active?: boolean
          subject: string
          text_content?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_type?: string
          event_id?: string
          html_content?: string
          id?: string
          is_active?: boolean
          subject?: string
          text_content?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_email_templates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_emails: {
        Row: {
          bounced_at: string | null
          clicked_at: string | null
          created_at: string
          delivered_at: string | null
          email_type: string
          error_message: string | null
          event_id: string
          id: string
          opened_at: string | null
          recipient_email: string
          replied_at: string | null
          resend_id: string | null
          rsvp_id: string | null
          sent_at: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          bounced_at?: string | null
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          email_type: string
          error_message?: string | null
          event_id: string
          id?: string
          opened_at?: string | null
          recipient_email: string
          replied_at?: string | null
          resend_id?: string | null
          rsvp_id?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          bounced_at?: string | null
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          email_type?: string
          error_message?: string | null
          event_id?: string
          id?: string
          opened_at?: string | null
          recipient_email?: string
          replied_at?: string | null
          resend_id?: string | null
          rsvp_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_emails_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_emails_rsvp_id_fkey"
            columns: ["rsvp_id"]
            isOneToOne: false
            referencedRelation: "event_rsvps"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvps: {
        Row: {
          check_in_status: string | null
          checked_in_at: string | null
          created_at: string
          email: string
          event_id: string
          guest_count: number | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          rsvp_date: string
          status: string | null
          updated_at: string
        }
        Insert: {
          check_in_status?: string | null
          checked_in_at?: string | null
          created_at?: string
          email: string
          event_id: string
          guest_count?: number | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          rsvp_date?: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          check_in_status?: string | null
          checked_in_at?: string | null
          created_at?: string
          email?: string
          event_id?: string
          guest_count?: number | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          rsvp_date?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
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
          notes: string | null
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
          notes?: string | null
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
          notes?: string | null
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
          brand_color: string | null
          clickup_list_id: string | null
          created_at: string
          created_by: string | null
          current_rsvp_count: number | null
          description: string | null
          event_date: string
          event_type: string | null
          feedback_score: number | null
          feedback_summary: string | null
          header_image_url: string | null
          id: string
          invited_count: number | null
          is_published: boolean | null
          leads_generated: number | null
          location: string | null
          logo_url: string | null
          max_capacity: number | null
          public_slug: string | null
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
          brand_color?: string | null
          clickup_list_id?: string | null
          created_at?: string
          created_by?: string | null
          current_rsvp_count?: number | null
          description?: string | null
          event_date: string
          event_type?: string | null
          feedback_score?: number | null
          feedback_summary?: string | null
          header_image_url?: string | null
          id?: string
          invited_count?: number | null
          is_published?: boolean | null
          leads_generated?: number | null
          location?: string | null
          logo_url?: string | null
          max_capacity?: number | null
          public_slug?: string | null
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
          brand_color?: string | null
          clickup_list_id?: string | null
          created_at?: string
          created_by?: string | null
          current_rsvp_count?: number | null
          description?: string | null
          event_date?: string
          event_type?: string | null
          feedback_score?: number | null
          feedback_summary?: string | null
          header_image_url?: string | null
          id?: string
          invited_count?: number | null
          is_published?: boolean | null
          leads_generated?: number | null
          location?: string | null
          logo_url?: string | null
          max_capacity?: number | null
          public_slug?: string | null
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
      global_email_templates: {
        Row: {
          created_at: string
          email_type: string
          html_content: string
          id: string
          is_active: boolean
          subject: string
          text_content: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_type: string
          html_content: string
          id?: string
          is_active?: boolean
          subject: string
          text_content?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_type?: string
          html_content?: string
          id?: string
          is_active?: boolean
          subject?: string
          text_content?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          code: string
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          used: boolean | null
        }
        Insert: {
          code?: string
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          used?: boolean | null
        }
        Update: {
          code?: string
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          used?: boolean | null
        }
        Relationships: []
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
          assigned_agent_id: string
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
          assigned_agent_id: string
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
          assigned_agent_id?: string
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
      metricool_links: {
        Row: {
          created_at: string
          id: string
          iframe_url: string
          is_active: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          iframe_url: string
          is_active?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          iframe_url?: string
          is_active?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      monthly_runs: {
        Row: {
          agent_id: string
          contacts_processed: number
          created_at: string
          dry_run: boolean
          emails_sent: number
          error: string | null
          finished_at: string | null
          id: string
          run_date: string
          started_at: string | null
          status: string
          triggered_by: string | null
          updated_at: string
          zip_codes_processed: number
        }
        Insert: {
          agent_id: string
          contacts_processed?: number
          created_at?: string
          dry_run?: boolean
          emails_sent?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          run_date: string
          started_at?: string | null
          status?: string
          triggered_by?: string | null
          updated_at?: string
          zip_codes_processed?: number
        }
        Update: {
          agent_id?: string
          contacts_processed?: number
          created_at?: string
          dry_run?: boolean
          emails_sent?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          run_date?: string
          started_at?: string | null
          status?: string
          triggered_by?: string | null
          updated_at?: string
          zip_codes_processed?: number
        }
        Relationships: []
      }
      newsletter_campaigns: {
        Row: {
          body: string | null
          campaign_name: string
          click_through_rate: number | null
          created_at: string
          created_by: string | null
          id: string
          name: string | null
          open_rate: number | null
          recipient_count: number | null
          send_date: string | null
          sender_id: string | null
          status: string | null
          subject: string | null
          template_content: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          campaign_name: string
          click_through_rate?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          open_rate?: number | null
          recipient_count?: number | null
          send_date?: string | null
          sender_id?: string | null
          status?: string | null
          subject?: string | null
          template_content?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          campaign_name?: string
          click_through_rate?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          open_rate?: number | null
          recipient_count?: number | null
          send_date?: string | null
          sender_id?: string | null
          status?: string | null
          subject?: string | null
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
      newsletter_csv_files: {
        Row: {
          file_path: string
          file_size: number | null
          filename: string
          id: string
          is_active: boolean | null
          upload_date: string | null
          uploaded_by: string | null
        }
        Insert: {
          file_path: string
          file_size?: number | null
          filename: string
          id?: string
          is_active?: boolean | null
          upload_date?: string | null
          uploaded_by?: string | null
        }
        Update: {
          file_path?: string
          file_size?: number | null
          filename?: string
          id?: string
          is_active?: boolean | null
          upload_date?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      newsletter_market_data: {
        Row: {
          area_name: string | null
          created_at: string | null
          csv_file_id: string | null
          id: string
          median_value: number | null
          raw_data: Json | null
          value_change: string | null
          zip_code: string
        }
        Insert: {
          area_name?: string | null
          created_at?: string | null
          csv_file_id?: string | null
          id?: string
          median_value?: number | null
          raw_data?: Json | null
          value_change?: string | null
          zip_code: string
        }
        Update: {
          area_name?: string | null
          created_at?: string | null
          csv_file_id?: string | null
          id?: string
          median_value?: number | null
          raw_data?: Json | null
          value_change?: string | null
          zip_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_market_data_csv_file_id_fkey"
            columns: ["csv_file_id"]
            isOneToOne: false
            referencedRelation: "newsletter_csv_files"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_settings: {
        Row: {
          agent_id: string
          created_at: string
          enabled: boolean
          id: string
          schedule_day: number | null
          schedule_hour: number | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          schedule_day?: number | null
          schedule_hour?: number | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          schedule_day?: number | null
          schedule_hour?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      newsletter_unsubscribes: {
        Row: {
          agent_id: string | null
          created_at: string
          email: string
          id: string
          reason: string | null
          unsubscribed_at: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          email: string
          id?: string
          reason?: string | null
          unsubscribed_at?: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          email?: string
          id?: string
          reason?: string | null
          unsubscribed_at?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          actual_close_date: string | null
          agent_id: string
          contact_id: string | null
          created_at: string
          deal_value: number | null
          expected_close_date: string | null
          id: string
          notes: string | null
          stage: string
          updated_at: string
        }
        Insert: {
          actual_close_date?: string | null
          agent_id: string
          contact_id?: string | null
          created_at?: string
          deal_value?: number | null
          expected_close_date?: string | null
          id?: string
          notes?: string | null
          stage: string
          updated_at?: string
        }
        Update: {
          actual_close_date?: string | null
          agent_id?: string
          contact_id?: string | null
          created_at?: string
          deal_value?: number | null
          expected_close_date?: string | null
          id?: string
          notes?: string | null
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_activities: {
        Row: {
          activity_date: string | null
          activity_type: string
          agent_id: string
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          opportunity_id: string
        }
        Insert: {
          activity_date?: string | null
          activity_type: string
          agent_id: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          opportunity_id: string
        }
        Update: {
          activity_date?: string | null
          activity_type?: string
          agent_id?: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          opportunity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_notes: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          note_text: string
          note_type: string | null
          opportunity_id: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          note_text: string
          note_type?: string | null
          opportunity_id: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          note_text?: string
          note_type?: string | null
          opportunity_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_notes_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_tasks: {
        Row: {
          agent_id: string
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          opportunity_id: string
          priority: string | null
          status: string | null
          task_name: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          opportunity_id: string
          priority?: string | null
          status?: string | null
          task_name: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          opportunity_id?: string
          priority?: string | null
          status?: string | null
          task_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_tasks_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_survey_responses: {
        Row: {
          activity_types: string[] | null
          additional_comments: string | null
          additional_fields: string | null
          agent_name: string
          biggest_pain_point: string | null
          created_at: string
          desired_views: string[] | null
          email: string
          follow_up_automation: string | null
          id: string
          integration_priorities: string[] | null
          mobile_importance: string | null
          must_have_fields: string[] | null
          pipeline_stages: string[] | null
          separate_buyer_seller: string | null
        }
        Insert: {
          activity_types?: string[] | null
          additional_comments?: string | null
          additional_fields?: string | null
          agent_name: string
          biggest_pain_point?: string | null
          created_at?: string
          desired_views?: string[] | null
          email: string
          follow_up_automation?: string | null
          id?: string
          integration_priorities?: string[] | null
          mobile_importance?: string | null
          must_have_fields?: string[] | null
          pipeline_stages?: string[] | null
          separate_buyer_seller?: string | null
        }
        Update: {
          activity_types?: string[] | null
          additional_comments?: string | null
          additional_fields?: string | null
          agent_name?: string
          biggest_pain_point?: string | null
          created_at?: string
          desired_views?: string[] | null
          email?: string
          follow_up_automation?: string | null
          id?: string
          integration_priorities?: string[] | null
          mobile_importance?: string | null
          must_have_fields?: string[] | null
          pipeline_stages?: string[] | null
          separate_buyer_seller?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          brand_guidelines: string | null
          brokerage: string | null
          brokerage_info: string | null
          can_email_marketing: boolean | null
          clickup_editing_task_list_id: string | null
          clickup_video_deliverables_list_id: string | null
          created_at: string
          editors: string[] | null
          email: string | null
          "Example Copy": string | null
          example_copy: string | null
          first_name: string | null
          full_name: string | null
          gpt_prompt: string | null
          headshot_url: string | null
          id: string
          last_name: string | null
          license_number: string | null
          license_states: string[] | null
          logo_colored_url: string | null
          logo_white_url: string | null
          metricool_creds: Json | null
          office_address: string | null
          office_number: string | null
          phone_number: string | null
          primary_color: string | null
          privacy_policy_url: string | null
          role: string
          secondary_color: string | null
          shade_folder_id: string | null
          state_licenses: string[] | null
          "Target Audience": string | null
          team_name: string | null
          "Thumbnail Guidelines": string | null
          "Tone Guidelines": string | null
          updated_at: string
          user_id: string
          website: string | null
          "What NOT to Say": string | null
        }
        Insert: {
          brand_guidelines?: string | null
          brokerage?: string | null
          brokerage_info?: string | null
          can_email_marketing?: boolean | null
          clickup_editing_task_list_id?: string | null
          clickup_video_deliverables_list_id?: string | null
          created_at?: string
          editors?: string[] | null
          email?: string | null
          "Example Copy"?: string | null
          example_copy?: string | null
          first_name?: string | null
          full_name?: string | null
          gpt_prompt?: string | null
          headshot_url?: string | null
          id?: string
          last_name?: string | null
          license_number?: string | null
          license_states?: string[] | null
          logo_colored_url?: string | null
          logo_white_url?: string | null
          metricool_creds?: Json | null
          office_address?: string | null
          office_number?: string | null
          phone_number?: string | null
          primary_color?: string | null
          privacy_policy_url?: string | null
          role?: string
          secondary_color?: string | null
          shade_folder_id?: string | null
          state_licenses?: string[] | null
          "Target Audience"?: string | null
          team_name?: string | null
          "Thumbnail Guidelines"?: string | null
          "Tone Guidelines"?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
          "What NOT to Say"?: string | null
        }
        Update: {
          brand_guidelines?: string | null
          brokerage?: string | null
          brokerage_info?: string | null
          can_email_marketing?: boolean | null
          clickup_editing_task_list_id?: string | null
          clickup_video_deliverables_list_id?: string | null
          created_at?: string
          editors?: string[] | null
          email?: string | null
          "Example Copy"?: string | null
          example_copy?: string | null
          first_name?: string | null
          full_name?: string | null
          gpt_prompt?: string | null
          headshot_url?: string | null
          id?: string
          last_name?: string | null
          license_number?: string | null
          license_states?: string[] | null
          logo_colored_url?: string | null
          logo_white_url?: string | null
          metricool_creds?: Json | null
          office_address?: string | null
          office_number?: string | null
          phone_number?: string | null
          primary_color?: string | null
          privacy_policy_url?: string | null
          role?: string
          secondary_color?: string | null
          shade_folder_id?: string | null
          state_licenses?: string[] | null
          "Target Audience"?: string | null
          team_name?: string | null
          "Thumbnail Guidelines"?: string | null
          "Tone Guidelines"?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
          "What NOT to Say"?: string | null
        }
        Relationships: []
      }
      role_change_audit: {
        Row: {
          changed_at: string | null
          changed_by: string
          id: number
          new_role: string
          note: string | null
          old_role: string | null
          target_user: string
        }
        Insert: {
          changed_at?: string | null
          changed_by: string
          id?: never
          new_role: string
          note?: string | null
          old_role?: string | null
          target_user: string
        }
        Update: {
          changed_at?: string | null
          changed_by?: string
          id?: never
          new_role?: string
          note?: string | null
          old_role?: string | null
          target_user?: string
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          created_at: string | null
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          operation: string
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          operation: string
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          operation?: string
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      social_accounts: {
        Row: {
          access_token: string
          account_id: string | null
          account_name: string | null
          agent_id: string
          created_at: string
          expires_at: string | null
          id: string
          platform: string
          refresh_token: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          account_id?: string | null
          account_name?: string | null
          agent_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          platform: string
          refresh_token?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          account_id?: string | null
          account_name?: string | null
          agent_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          platform?: string
          refresh_token?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      social_analytics: {
        Row: {
          agent_id: string
          clicks: number | null
          comments: number | null
          created_at: string
          engagement_rate: number | null
          followers: number | null
          id: string
          impressions: number | null
          likes: number | null
          metric_date: string
          platform: string
          post_id: string | null
          reach: number | null
          shares: number | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          clicks?: number | null
          comments?: number | null
          created_at?: string
          engagement_rate?: number | null
          followers?: number | null
          id?: string
          impressions?: number | null
          likes?: number | null
          metric_date: string
          platform: string
          post_id?: string | null
          reach?: number | null
          shares?: number | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          clicks?: number | null
          comments?: number | null
          created_at?: string
          engagement_rate?: number | null
          followers?: number | null
          id?: string
          impressions?: number | null
          likes?: number | null
          metric_date?: string
          platform?: string
          post_id?: string | null
          reach?: number | null
          shares?: number | null
          updated_at?: string
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
      social_posts: {
        Row: {
          agent_id: string
          content: string
          created_at: string
          error_message: string | null
          id: string
          media_type: string | null
          media_url: string | null
          platform: string
          posted_at: string | null
          postiz_post_id: string | null
          schedule_time: string
          status: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          content: string
          created_at?: string
          error_message?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          platform: string
          posted_at?: string | null
          postiz_post_id?: string | null
          schedule_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          content?: string
          created_at?: string
          error_message?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          platform?: string
          posted_at?: string | null
          postiz_post_id?: string | null
          schedule_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      social_shade_clickup_links: {
        Row: {
          agent_marketing_settings_id: string
          clickup_task_id: string | null
          created_at: string
          file_name: string | null
          id: string
          shade_asset_id: string | null
          shade_file_id: string
          shade_path: string | null
          transcription_id: string | null
          updated_at: string
        }
        Insert: {
          agent_marketing_settings_id: string
          clickup_task_id?: string | null
          created_at?: string
          file_name?: string | null
          id?: string
          shade_asset_id?: string | null
          shade_file_id: string
          shade_path?: string | null
          transcription_id?: string | null
          updated_at?: string
        }
        Update: {
          agent_marketing_settings_id?: string
          clickup_task_id?: string | null
          created_at?: string
          file_name?: string | null
          id?: string
          shade_asset_id?: string | null
          shade_file_id?: string
          shade_path?: string | null
          transcription_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      spheresync_email_logs: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          sent_at: string
          task_count: number | null
          week_number: number
          year: number
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          sent_at?: string
          task_count?: number | null
          week_number: number
          year: number
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          sent_at?: string
          task_count?: number | null
          week_number?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "spheresync_email_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      spheresync_run_logs: {
        Row: {
          agent_results: Json | null
          agents_processed: number | null
          agents_skipped: number | null
          created_at: string
          dry_run: boolean | null
          emails_failed: number | null
          emails_sent: number | null
          emails_skipped: number | null
          error_message: string | null
          finished_at: string | null
          force_regenerate: boolean | null
          force_send: boolean | null
          id: string
          run_type: string
          scheduled_at: string | null
          source: string
          started_at: string
          status: string
          target_agent_id: string | null
          target_week_number: number
          target_year: number
          tasks_created: number | null
        }
        Insert: {
          agent_results?: Json | null
          agents_processed?: number | null
          agents_skipped?: number | null
          created_at?: string
          dry_run?: boolean | null
          emails_failed?: number | null
          emails_sent?: number | null
          emails_skipped?: number | null
          error_message?: string | null
          finished_at?: string | null
          force_regenerate?: boolean | null
          force_send?: boolean | null
          id?: string
          run_type: string
          scheduled_at?: string | null
          source?: string
          started_at?: string
          status?: string
          target_agent_id?: string | null
          target_week_number: number
          target_year: number
          tasks_created?: number | null
        }
        Update: {
          agent_results?: Json | null
          agents_processed?: number | null
          agents_skipped?: number | null
          created_at?: string
          dry_run?: boolean | null
          emails_failed?: number | null
          emails_sent?: number | null
          emails_skipped?: number | null
          error_message?: string | null
          finished_at?: string | null
          force_regenerate?: boolean | null
          force_send?: boolean | null
          id?: string
          run_type?: string
          scheduled_at?: string | null
          source?: string
          started_at?: string
          status?: string
          target_agent_id?: string | null
          target_week_number?: number
          target_year?: number
          tasks_created?: number | null
        }
        Relationships: []
      }
      spheresync_tasks: {
        Row: {
          agent_id: string
          completed: boolean
          completed_at: string | null
          created_at: string
          dnc_status: boolean | null
          id: string
          lead_id: string | null
          notes: string | null
          task_type: string
          updated_at: string
          week_number: number | null
          year: number | null
        }
        Insert: {
          agent_id: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          dnc_status?: boolean | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          task_type: string
          updated_at?: string
          week_number?: number | null
          year?: number | null
        }
        Update: {
          agent_id?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          dnc_status?: boolean | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          task_type?: string
          updated_at?: string
          week_number?: number | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "spheresync_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_contacts: {
        Row: {
          contact_email: string | null
          contact_name: string
          contact_phone: string | null
          created_at: string
          id: string
          is_primary: boolean
          region: string | null
          sponsor_id: string
        }
        Insert: {
          contact_email?: string | null
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          region?: string | null
          sponsor_id: string
        }
        Update: {
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          region?: string | null
          sponsor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_contacts_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_events: {
        Row: {
          contribution_amount: number | null
          contribution_description: string | null
          contribution_type: string | null
          created_at: string
          event_id: string
          id: string
          sponsor_id: string
        }
        Insert: {
          contribution_amount?: number | null
          contribution_description?: string | null
          contribution_type?: string | null
          created_at?: string
          event_id: string
          id?: string
          sponsor_id: string
        }
        Update: {
          contribution_amount?: number | null
          contribution_description?: string | null
          contribution_type?: string | null
          created_at?: string
          event_id?: string
          id?: string
          sponsor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_events_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsors: {
        Row: {
          company_name: string
          created_at: string
          created_by: string | null
          id: string
          logo_url: string | null
          notes: string | null
          payment_status: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          company_name: string
          created_at?: string
          created_by?: string | null
          id?: string
          logo_url?: string | null
          notes?: string | null
          payment_status?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          company_name?: string
          created_at?: string
          created_by?: string | null
          id?: string
          logo_url?: string | null
          notes?: string | null
          payment_status?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      support_config: {
        Row: {
          assignee_name: string | null
          category: string
          clickup_assignee_id: string | null
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          assignee_name?: string | null
          category: string
          clickup_assignee_id?: string | null
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          assignee_name?: string | null
          category?: string
          clickup_assignee_id?: string | null
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          agent_id: string
          assigned_to: string | null
          category: string
          clickup_task_id: string | null
          created_at: string
          description: string | null
          id: string
          priority: string
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          assigned_to?: string | null
          category: string
          clickup_task_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          assigned_to?: string | null
          category?: string
          clickup_task_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      transaction_coordination: {
        Row: {
          bathrooms: number | null
          bedrooms: number | null
          brokerage_split: number | null
          buyer_agent_id: string | null
          client_name: string | null
          closing_date: string | null
          commission_rate: number | null
          contract_date: string | null
          created_at: string
          days_on_market: number | null
          gci: number | null
          id: string
          last_synced_at: string | null
          lead_id: number | null
          lead_source: string | null
          listing_agent_id: string | null
          listing_date: string | null
          milestone_dates: Json | null
          otc_deal_id: string | null
          price_per_sqft: number | null
          property_address: string | null
          property_type: string | null
          raw_api_data: Json | null
          referral_source: string | null
          responsible_agent: string | null
          risk_factors: string[] | null
          sale_price: number | null
          square_footage: number | null
          status: string | null
          sync_errors: string[] | null
          transaction_stage: string
          transaction_type: string | null
          updated_at: string
        }
        Insert: {
          bathrooms?: number | null
          bedrooms?: number | null
          brokerage_split?: number | null
          buyer_agent_id?: string | null
          client_name?: string | null
          closing_date?: string | null
          commission_rate?: number | null
          contract_date?: string | null
          created_at?: string
          days_on_market?: number | null
          gci?: number | null
          id?: string
          last_synced_at?: string | null
          lead_id?: number | null
          lead_source?: string | null
          listing_agent_id?: string | null
          listing_date?: string | null
          milestone_dates?: Json | null
          otc_deal_id?: string | null
          price_per_sqft?: number | null
          property_address?: string | null
          property_type?: string | null
          raw_api_data?: Json | null
          referral_source?: string | null
          responsible_agent?: string | null
          risk_factors?: string[] | null
          sale_price?: number | null
          square_footage?: number | null
          status?: string | null
          sync_errors?: string[] | null
          transaction_stage?: string
          transaction_type?: string | null
          updated_at?: string
        }
        Update: {
          bathrooms?: number | null
          bedrooms?: number | null
          brokerage_split?: number | null
          buyer_agent_id?: string | null
          client_name?: string | null
          closing_date?: string | null
          commission_rate?: number | null
          contract_date?: string | null
          created_at?: string
          days_on_market?: number | null
          gci?: number | null
          id?: string
          last_synced_at?: string | null
          lead_id?: number | null
          lead_source?: string | null
          listing_agent_id?: string | null
          listing_date?: string | null
          milestone_dates?: Json | null
          otc_deal_id?: string | null
          price_per_sqft?: number | null
          property_address?: string | null
          property_type?: string | null
          raw_api_data?: Json | null
          referral_source?: string | null
          responsible_agent?: string | null
          risk_factors?: string[] | null
          sale_price?: number | null
          square_footage?: number | null
          status?: string | null
          sync_errors?: string[] | null
          transaction_stage?: string
          transaction_type?: string | null
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
      transactions: {
        Row: {
          agent_id: string | null
          city: string | null
          closing_date: string | null
          commission_amount: number | null
          contract_status: string | null
          created_at: string | null
          id: string
          property_address: string
          purchase_amount: number | null
          representation_side: string | null
          state: string | null
          team_name: string | null
        }
        Insert: {
          agent_id?: string | null
          city?: string | null
          closing_date?: string | null
          commission_amount?: number | null
          contract_status?: string | null
          created_at?: string | null
          id?: string
          property_address: string
          purchase_amount?: number | null
          representation_side?: string | null
          state?: string | null
          team_name?: string | null
        }
        Update: {
          agent_id?: string | null
          city?: string | null
          closing_date?: string | null
          commission_amount?: number | null
          contract_status?: string | null
          created_at?: string | null
          id?: string
          property_address?: string
          purchase_amount?: number | null
          representation_side?: string | null
          state?: string | null
          team_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workflow_run_steps: {
        Row: {
          attempt: number
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          request: Json | null
          response_body: Json | null
          response_status: number | null
          run_id: string
          started_at: string | null
          status: string
          step_name: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          request?: Json | null
          response_body?: Json | null
          response_status?: number | null
          run_id: string
          started_at?: string | null
          status?: string
          step_name: string
        }
        Update: {
          attempt?: number
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          request?: Json | null
          response_body?: Json | null
          response_status?: number | null
          run_id?: string
          started_at?: string | null
          status?: string
          step_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_run_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_runs: {
        Row: {
          created_at: string
          error_details: Json | null
          error_message: string | null
          finished_at: string | null
          id: string
          idempotency_key: string
          input: Json | null
          output: Json | null
          started_at: string | null
          status: string
          triggered_by: string | null
          workflow_name: string
        }
        Insert: {
          created_at?: string
          error_details?: Json | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key: string
          input?: Json | null
          output?: Json | null
          started_at?: string | null
          status?: string
          triggered_by?: string | null
          workflow_name: string
        }
        Update: {
          created_at?: string
          error_details?: Json | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string
          input?: Json | null
          output?: Json | null
          started_at?: string | null
          status?: string
          triggered_by?: string | null
          workflow_name?: string
        }
        Relationships: []
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
      check_duplicate_rsvp: {
        Args: { p_email: string; p_event_id: string }
        Returns: boolean
      }
      check_rsvp_duplicate: {
        Args: { p_email: string; p_event_id: string }
        Returns: boolean
      }
      decrypt_social_token: {
        Args: {
          p_agent_id: string
          p_encryption_key: string
          p_platform: string
        }
        Returns: Json
      }
      encrypt_social_token: {
        Args: {
          p_access_token: string
          p_encryption_key: string
          p_refresh_token: string
        }
        Returns: Json
      }
      format_phone_display: { Args: { phone_input: string }; Returns: string }
      generate_event_slug: { Args: { title: string }; Returns: string }
      get_current_user_role: { Args: never; Returns: string }
      get_own_rsvp: {
        Args: { p_email: string; p_event_id: string }
        Returns: {
          id: string
          status: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      insert_reop_transaction: {
        Args: {
          p_agent_name: string
          p_city: string
          p_closing_date: string
          p_contract_status?: string
          p_property_address: string
          p_purchase_amount: number
          p_representation_side: string
          p_seller_to_buyer_broker: number
          p_seller_to_listing_broker: number
          p_state: string
          p_team_name?: string
        }
        Returns: undefined
      }
      is_valid_phone: { Args: { phone_input: string }; Returns: boolean }
      log_newsletter_activity: {
        Args: {
          p_agent_id: string
          p_campaign_name: string
          p_contact_id: string
          p_zip_code?: string
        }
        Returns: undefined
      }
      mask_contact_data: {
        Args: {
          contact_id: string
          field_name: string
          field_value: string
          requesting_user_id?: string
        }
        Returns: string
      }
      mask_email: { Args: { email_address: string }; Returns: string }
      mask_email_field: { Args: { email_value: string }; Returns: string }
      mask_phone: { Args: { phone_number: string }; Returns: string }
      mask_phone_field: { Args: { phone_value: string }; Returns: string }
      normalize_phone: { Args: { phone_input: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "agent" | "editor"
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
      app_role: ["admin", "agent", "editor"],
    },
  },
} as const
