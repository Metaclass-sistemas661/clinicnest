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
      appointment_completion_summaries: {
        Row: {
          appointment_id: string | null
          created_at: string
          id: string
          product_profit_total: number
          product_sales: Json
          professional_name: string
          service_name: string
          service_profit: number
          tenant_id: string
          total_profit: number
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          product_profit_total?: number
          product_sales?: Json
          professional_name?: string
          service_name?: string
          service_profit?: number
          tenant_id: string
          total_profit?: number
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          product_profit_total?: number
          product_sales?: Json
          professional_name?: string
          service_name?: string
          service_profit?: number
          tenant_id?: string
          total_profit?: number
        }
        Relationships: [
          {
            foreignKeyName: "appointment_completion_summaries_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_completion_summaries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          cid_code: string | null
          client_id: string | null
          commission_amount: number | null
          consultation_type: string | null
          created_at: string
          duration_minutes: number
          id: string
          insurance_authorization: string | null
          insurance_plan_id: string | null
          notes: string | null
          price: number
          professional_id: string | null
          room_id: string | null
          scheduled_at: string
          service_id: string | null
          specialty_id: string | null
          status: Database["public"]["Enums"]["appointment_status"]
          telemedicine: boolean
          telemedicine_url: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cid_code?: string | null
          client_id?: string | null
          commission_amount?: number | null
          consultation_type?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          insurance_authorization?: string | null
          insurance_plan_id?: string | null
          notes?: string | null
          price?: number
          professional_id?: string | null
          room_id?: string | null
          scheduled_at: string
          service_id?: string | null
          specialty_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          telemedicine?: boolean
          telemedicine_url?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cid_code?: string | null
          client_id?: string | null
          commission_amount?: number | null
          consultation_type?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          insurance_authorization?: string | null
          insurance_plan_id?: string | null
          notes?: string | null
          price?: number
          professional_id?: string | null
          room_id?: string | null
          scheduled_at?: string
          service_id?: string | null
          specialty_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          telemedicine?: boolean
          telemedicine_url?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address_city: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          birth_date: string | null
          blood_type: string | null
          cpf: string | null
          created_at: string
          email: string | null
          emergency_name: string | null
          emergency_phone: string | null
          gender: string | null
          id: string
          insurance_card_number: string | null
          insurance_plan_id: string | null
          name: string
          notes: string | null
          occupation: string | null
          phone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          birth_date?: string | null
          blood_type?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          emergency_name?: string | null
          emergency_phone?: string | null
          gender?: string | null
          id?: string
          insurance_card_number?: string | null
          insurance_plan_id?: string | null
          name: string
          notes?: string | null
          occupation?: string | null
          phone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          birth_date?: string | null
          blood_type?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          emergency_name?: string | null
          emergency_phone?: string | null
          gender?: string | null
          id?: string
          insurance_card_number?: string | null
          insurance_plan_id?: string | null
          name?: string
          notes?: string | null
          occupation?: string | null
          phone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_payments: {
        Row: {
          amount: number
          appointment_id: string | null
          commission_config_id: string | null
          commission_type: Database["public"]["Enums"]["commission_type"]
          commission_value: number
          created_at: string
          id: string
          notes: string | null
          paid_by: string | null
          payment_date: string | null
          professional_id: string
          service_price: number
          status: Database["public"]["Enums"]["commission_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          commission_config_id?: string | null
          commission_type: Database["public"]["Enums"]["commission_type"]
          commission_value: number
          created_at?: string
          id?: string
          notes?: string | null
          paid_by?: string | null
          payment_date?: string | null
          professional_id: string
          service_price: number
          status?: Database["public"]["Enums"]["commission_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          commission_config_id?: string | null
          commission_type?: Database["public"]["Enums"]["commission_type"]
          commission_value?: number
          created_at?: string
          id?: string
          notes?: string | null
          paid_by?: string | null
          payment_date?: string | null
          professional_id?: string
          service_price?: number
          status?: Database["public"]["Enums"]["commission_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_payments_commission_config_id_fkey"
            columns: ["commission_config_id"]
            isOneToOne: false
            referencedRelation: "professional_commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_payments_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "commission_payments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "commission_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          consented_at: string
          created_at: string
          email: string
          id: string
          message: string
          name: string
          privacy_accepted: boolean
          subject: string
          terms_accepted: boolean
        }
        Insert: {
          consented_at?: string
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          privacy_accepted?: boolean
          subject: string
          terms_accepted?: boolean
        }
        Update: {
          consented_at?: string
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          privacy_accepted?: boolean
          subject?: string
          terms_accepted?: boolean
        }
        Relationships: []
      }
      lgpd_data_requests: {
        Row: {
          assigned_admin_user_id: string | null
          created_at: string
          due_at: string
          id: string
          request_details: string | null
          request_type: string
          requester_email: string | null
          requester_user_id: string
          requested_at: string
          resolution_notes: string | null
          resolved_at: string | null
          sla_days: number
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_admin_user_id?: string | null
          created_at?: string
          due_at?: string
          id?: string
          request_details?: string | null
          request_type: string
          requester_email?: string | null
          requester_user_id: string
          requested_at?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          sla_days?: number
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_admin_user_id?: string | null
          created_at?: string
          due_at?: string
          id?: string
          request_details?: string | null
          request_type?: string
          requester_email?: string | null
          requester_user_id?: string
          requested_at?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          sla_days?: number
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lgpd_data_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lgpd_retention_policies: {
        Row: {
          audit_log_retention_days: number
          auto_cleanup_enabled: boolean
          client_data_retention_days: number
          created_at: string
          created_by: string | null
          financial_data_retention_days: number
          last_reviewed_at: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          audit_log_retention_days?: number
          auto_cleanup_enabled?: boolean
          client_data_retention_days?: number
          created_at?: string
          created_by?: string | null
          financial_data_retention_days?: number
          last_reviewed_at?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          audit_log_retention_days?: number
          auto_cleanup_enabled?: boolean
          client_data_retention_days?: number
          created_at?: string
          created_by?: string | null
          financial_data_retention_days?: number
          last_reviewed_at?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lgpd_retention_policies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_logs: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          tenant_id: string
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          tenant_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          amount: number
          appointment_id: string | null
          category: string
          created_at: string
          description: string | null
          id: string
          product_id: string | null
          tenant_id: string
          transaction_date: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          category: string
          created_at?: string
          description?: string | null
          id?: string
          product_id?: string | null
          tenant_id: string
          transaction_date?: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          product_id?: string | null
          tenant_id?: string
          transaction_date?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_achievements: {
        Row: {
          achieved_at: string
          achievement_type: string
          goal_id: string
          id: string
          metadata: Json | null
          professional_id: string | null
          tenant_id: string
        }
        Insert: {
          achieved_at?: string
          achievement_type: string
          goal_id: string
          id?: string
          metadata?: Json | null
          professional_id?: string | null
          tenant_id: string
        }
        Update: {
          achieved_at?: string
          achievement_type?: string
          goal_id?: string
          id?: string
          metadata?: Json | null
          professional_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_achievements_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_achievements_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_achievements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_suggestions: {
        Row: {
          created_at: string
          created_goal_id: string | null
          goal_type: Database["public"]["Enums"]["goal_type"]
          id: string
          name: string | null
          period: Database["public"]["Enums"]["goal_period"]
          professional_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_value: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_goal_id?: string | null
          goal_type: Database["public"]["Enums"]["goal_type"]
          id?: string
          name?: string | null
          period?: Database["public"]["Enums"]["goal_period"]
          professional_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_value: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_goal_id?: string | null
          goal_type?: Database["public"]["Enums"]["goal_type"]
          id?: string
          name?: string | null
          period?: Database["public"]["Enums"]["goal_period"]
          professional_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_value?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_suggestions_created_goal_id_fkey"
            columns: ["created_goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_suggestions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_suggestions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_templates: {
        Row: {
          created_at: string
          goal_type: Database["public"]["Enums"]["goal_type"]
          id: string
          name: string
          period: Database["public"]["Enums"]["goal_period"]
          target_value: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          goal_type: Database["public"]["Enums"]["goal_type"]
          id?: string
          name: string
          period?: Database["public"]["Enums"]["goal_period"]
          target_value: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          goal_type?: Database["public"]["Enums"]["goal_type"]
          id?: string
          name?: string
          period?: Database["public"]["Enums"]["goal_period"]
          target_value?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          archived_at: string | null
          created_at: string
          custom_end: string | null
          custom_start: string | null
          goal_type: Database["public"]["Enums"]["goal_type"]
          header_priority: number | null
          id: string
          is_active: boolean
          name: string
          parent_goal_id: string | null
          period: Database["public"]["Enums"]["goal_period"]
          product_id: string | null
          professional_id: string | null
          show_in_header: boolean
          target_value: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          custom_end?: string | null
          custom_start?: string | null
          goal_type: Database["public"]["Enums"]["goal_type"]
          header_priority?: number | null
          id?: string
          is_active?: boolean
          name: string
          parent_goal_id?: string | null
          period?: Database["public"]["Enums"]["goal_period"]
          product_id?: string | null
          professional_id?: string | null
          show_in_header?: boolean
          target_value: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          custom_end?: string | null
          custom_start?: string | null
          goal_type?: Database["public"]["Enums"]["goal_type"]
          header_priority?: number | null
          id?: string
          is_active?: boolean
          name?: string
          parent_goal_id?: string | null
          period?: Database["public"]["Enums"]["goal_period"]
          product_id?: string | null
          professional_id?: string | null
          show_in_header?: boolean
          target_value?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_parent_goal_id_fkey"
            columns: ["parent_goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          metadata: Json | null
          read_at: string | null
          tenant_id: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          read_at?: string | null
          tenant_id: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          read_at?: string | null
          tenant_id?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          cost: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          min_quantity: number
          name: string
          quantity: number
          sale_price: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          min_quantity?: number
          name: string
          quantity?: number
          sale_price?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          min_quantity?: number
          name?: string
          quantity?: number
          sale_price?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_commissions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          tenant_id: string
          type: Database["public"]["Enums"]["commission_type"]
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          tenant_id: string
          type: Database["public"]["Enums"]["commission_type"]
          updated_at?: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          tenant_id?: string
          type?: Database["public"]["Enums"]["commission_type"]
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "professional_commissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "professional_commissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_commissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          show_goals_progress_in_header: boolean
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          show_goals_progress_in_header?: boolean
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          show_goals_progress_in_header?: boolean
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          cbhpm_code: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          insurance_plan_id: string | null
          insurance_price: number | null
          is_active: boolean
          name: string
          price: number
          service_type: string | null
          specialty_id: string | null
          tenant_id: string
          tuss_code: string | null
          updated_at: string
        }
        Insert: {
          cbhpm_code?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          insurance_plan_id?: string | null
          insurance_price?: number | null
          is_active?: boolean
          name: string
          price?: number
          service_type?: string | null
          specialty_id?: string | null
          tenant_id: string
          tuss_code?: string | null
          updated_at?: string
        }
        Update: {
          cbhpm_code?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          insurance_plan_id?: string | null
          insurance_price?: number | null
          is_active?: boolean
          name?: string
          price?: number
          service_type?: string | null
          specialty_id?: string | null
          tenant_id?: string
          tuss_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          out_reason_type: string | null
          product_id: string
          quantity: number
          reason: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: string
          out_reason_type?: string | null
          product_id: string
          quantity: number
          reason?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          out_reason_type?: string | null
          product_id?: string
          quantity?: number
          reason?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          billing_provider: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tenant_id: string
          trial_end: string
          trial_start: string
          updated_at: string
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          billing_provider?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id: string
          trial_end?: string
          trial_start?: string
          updated_at?: string
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          billing_provider?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id?: string
          trial_end?: string
          trial_start?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          address: string | null
          anvisa_license: string | null
          clinic_type: string | null
          cnes_code: string | null
          cnpj: string | null
          created_at: string
          default_commission_percent: number | null
          email: string | null
          id: string
          logo_url: string | null
          medical_license: string | null
          name: string
          phone: string | null
          responsible_crm: string | null
          responsible_doctor: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          anvisa_license?: string | null
          clinic_type?: string | null
          cnes_code?: string | null
          cnpj?: string | null
          created_at?: string
          default_commission_percent?: number | null
          email?: string | null
          id?: string
          logo_url?: string | null
          medical_license?: string | null
          name: string
          phone?: string | null
          responsible_crm?: string | null
          responsible_doctor?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          anvisa_license?: string | null
          clinic_type?: string | null
          cnes_code?: string | null
          cnpj?: string | null
          created_at?: string
          default_commission_percent?: number | null
          email?: string | null
          id?: string
          logo_url?: string | null
          medical_license?: string | null
          name?: string
          phone?: string | null
          responsible_crm?: string | null
          responsible_doctor?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_notification_preferences: {
        Row: {
          appointment_cancelled: boolean
          appointment_completed: boolean
          appointment_created: boolean
          commission_paid: boolean
          created_at: string
          goal_approved: boolean
          goal_reached: boolean
          goal_rejected: boolean
          goal_reminder: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          appointment_cancelled?: boolean
          appointment_completed?: boolean
          appointment_created?: boolean
          commission_paid?: boolean
          created_at?: string
          goal_approved?: boolean
          goal_reached?: boolean
          goal_rejected?: boolean
          goal_reminder?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          appointment_cancelled?: boolean
          appointment_completed?: boolean
          appointment_created?: boolean
          commission_paid?: boolean
          created_at?: string
          goal_approved?: boolean
          goal_reached?: boolean
          goal_rejected?: boolean
          goal_reminder?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      // ============================================================
      // TABELAS ADICIONADAS - Presentes no banco mas ausentes nos tipos
      // ============================================================
      appointment_cashback_earnings: {
        Row: {
          appointment_id: string
          client_id: string
          earned_amount: number
          earned_at: string
          tenant_id: string
        }
        Insert: {
          appointment_id: string
          client_id: string
          earned_amount: number
          earned_at?: string
          tenant_id: string
        }
        Update: {
          appointment_id?: string
          client_id?: string
          earned_amount?: number
          earned_at?: string
          tenant_id?: string
        }
        Relationships: []
      }
      appointment_package_consumptions: {
        Row: {
          appointment_id: string
          consumed_at: string
          id: string
          package_id: string
          tenant_id: string
        }
        Insert: {
          appointment_id: string
          consumed_at?: string
          id?: string
          package_id: string
          tenant_id: string
        }
        Update: {
          appointment_id?: string
          consumed_at?: string
          id?: string
          package_id?: string
          tenant_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_role: string | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          tenant_id: string
        }
        Insert: {
          action: string
          actor_role?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          tenant_id: string
        }
        Update: {
          action?: string
          actor_role?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          tenant_id?: string
        }
        Relationships: []
      }
      automations: {
        Row: {
          channel: string
          created_at: string
          id: string
          is_active: boolean
          message_template: string
          name: string
          tenant_id: string
          trigger_config: Json
          trigger_type: string
        }
        Insert: {
          channel: string
          created_at?: string
          id?: string
          is_active?: boolean
          message_template: string
          name: string
          tenant_id: string
          trigger_config: Json
          trigger_type: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          is_active?: boolean
          message_template?: string
          name?: string
          tenant_id?: string
          trigger_config?: Json
          trigger_type?: string
        }
        Relationships: []
      }
      bills_payable: {
        Row: {
          amount: number
          cancel_reason: string | null
          category: string
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          description: string
          due_date: string
          id: string
          is_recurring: boolean
          notes: string | null
          paid_amount: number | null
          paid_at: string | null
          payment_method: string | null
          recurrence_type: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          cancel_reason?: string | null
          category: string
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          due_date: string
          id?: string
          is_recurring?: boolean
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          recurrence_type?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          cancel_reason?: string | null
          category?: string
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string
          id?: string
          is_recurring?: boolean
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          recurrence_type?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      bills_receivable: {
        Row: {
          amount: number
          category: string
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string
          due_date: string
          id: string
          notes: string | null
          payment_method: string | null
          received_amount: number | null
          received_at: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          due_date: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          received_amount?: number | null
          received_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          received_amount?: number | null
          received_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          banner_url: string | null
          created_at: string
          created_by: string | null
          html: string
          id: string
          name: string
          preheader: string | null
          sent_at: string | null
          status: string
          subject: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          created_by?: string | null
          html: string
          id?: string
          name: string
          preheader?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          created_by?: string | null
          html?: string
          id?: string
          name?: string
          preheader?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      cash_movements: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          reason: string | null
          session_id: string
          tenant_id: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          session_id: string
          tenant_id: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          session_id?: string
          tenant_id?: string
          type?: string
        }
        Relationships: []
      }
      cash_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_balance_expected: number | null
          closing_balance_reported: number | null
          closing_difference: number | null
          closing_notes: string | null
          created_at: string
          id: string
          opened_at: string
          opened_by: string | null
          opening_balance: number
          opening_notes: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_balance_expected?: number | null
          closing_balance_reported?: number | null
          closing_difference?: number | null
          closing_notes?: string | null
          created_at?: string
          id?: string
          opened_at?: string
          opened_by?: string | null
          opening_balance: number
          opening_notes?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_balance_expected?: number | null
          closing_balance_reported?: number | null
          closing_difference?: number | null
          closing_notes?: string | null
          created_at?: string
          id?: string
          opened_at?: string
          opened_by?: string | null
          opening_balance?: number
          opening_notes?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      cashback_ledger: {
        Row: {
          actor_user_id: string | null
          appointment_id: string | null
          client_id: string
          created_at: string
          delta_amount: number
          id: string
          notes: string | null
          order_id: string | null
          reason: string
          tenant_id: string
        }
        Insert: {
          actor_user_id?: string | null
          appointment_id?: string | null
          client_id: string
          created_at?: string
          delta_amount: number
          id?: string
          notes?: string | null
          order_id?: string | null
          reason: string
          tenant_id: string
        }
        Update: {
          actor_user_id?: string | null
          appointment_id?: string | null
          client_id?: string
          created_at?: string
          delta_amount?: number
          id?: string
          notes?: string | null
          order_id?: string | null
          reason?: string
          tenant_id?: string
        }
        Relationships: []
      }
      cashback_wallets: {
        Row: {
          balance: number
          client_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          client_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          client_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_marketing_preferences: {
        Row: {
          client_id: string
          marketing_opt_out: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          marketing_opt_out?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          marketing_opt_out?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_package_ledger: {
        Row: {
          actor_user_id: string | null
          appointment_id: string | null
          created_at: string
          delta_sessions: number
          id: string
          notes: string | null
          package_id: string
          reason: string
          tenant_id: string
        }
        Insert: {
          actor_user_id?: string | null
          appointment_id?: string | null
          created_at?: string
          delta_sessions: number
          id?: string
          notes?: string | null
          package_id: string
          reason: string
          tenant_id: string
        }
        Update: {
          actor_user_id?: string | null
          appointment_id?: string | null
          created_at?: string
          delta_sessions?: number
          id?: string
          notes?: string | null
          package_id?: string
          reason?: string
          tenant_id?: string
        }
        Relationships: []
      }
      client_packages: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          notes: string | null
          purchased_at: string
          remaining_sessions: number
          service_id: string
          status: string
          tenant_id: string
          total_sessions: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          purchased_at?: string
          remaining_sessions: number
          service_id: string
          status?: string
          tenant_id: string
          total_sessions: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          purchased_at?: string
          remaining_sessions?: number
          service_id?: string
          status?: string
          tenant_id?: string
          total_sessions?: number
          updated_at?: string
        }
        Relationships: []
      }
      cost_centers: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      discount_coupons: {
        Row: {
          code: string
          created_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          service_id: string | null
          tenant_id: string
          type: string
          used_count: number
          valid_from: string | null
          valid_until: string | null
          value: number
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          service_id?: string | null
          tenant_id: string
          type: string
          used_count?: number
          valid_from?: string | null
          valid_until?: string | null
          value: number
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          service_id?: string | null
          tenant_id?: string
          type?: string
          used_count?: number
          valid_from?: string | null
          valid_until?: string | null
          value?: number
        }
        Relationships: []
      }
      loyalty_tiers: {
        Row: {
          color: string
          created_at: string | null
          discount_percent: number
          icon: string
          id: string
          min_points: number
          name: string
          sort_order: number
          tenant_id: string
        }
        Insert: {
          color: string
          created_at?: string | null
          discount_percent: number
          icon: string
          id?: string
          min_points: number
          name: string
          sort_order?: number
          tenant_id: string
        }
        Update: {
          color?: string
          created_at?: string | null
          discount_percent?: number
          icon?: string
          id?: string
          min_points?: number
          name?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: []
      }
      nps_responses: {
        Row: {
          appointment_id: string | null
          client_id: string | null
          comment: string | null
          created_at: string
          id: string
          responded_at: string | null
          score: number | null
          tenant_id: string
          token: string
        }
        Insert: {
          appointment_id?: string | null
          client_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          responded_at?: string | null
          score?: number | null
          tenant_id: string
          token: string
        }
        Update: {
          appointment_id?: string | null
          client_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          responded_at?: string | null
          score?: number | null
          tenant_id?: string
          token?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          kind: string
          order_id: string
          product_id: string | null
          professional_id: string | null
          quantity: number
          service_id: string | null
          tenant_id: string
          total_cost_snapshot: number | null
          total_price: number
          unit_cost_snapshot: number | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          order_id: string
          product_id?: string | null
          professional_id?: string | null
          quantity?: number
          service_id?: string | null
          tenant_id: string
          total_cost_snapshot?: number | null
          total_price: number
          unit_cost_snapshot?: number | null
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          order_id?: string
          product_id?: string | null
          professional_id?: string | null
          quantity?: number
          service_id?: string | null
          tenant_id?: string
          total_cost_snapshot?: number | null
          total_price?: number
          unit_cost_snapshot?: number | null
          unit_price?: number
        }
        Relationships: []
      }
      orders: {
        Row: {
          applied_coupon_id: string | null
          applied_voucher_id: string | null
          appointment_id: string
          client_id: string | null
          created_at: string
          created_by: string | null
          discount_amount: number
          id: string
          notes: string | null
          paid_at: string | null
          professional_id: string | null
          status: string
          subtotal_amount: number
          tenant_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          applied_coupon_id?: string | null
          applied_voucher_id?: string | null
          appointment_id: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          id?: string
          notes?: string | null
          paid_at?: string | null
          professional_id?: string | null
          status?: string
          subtotal_amount?: number
          tenant_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          applied_coupon_id?: string | null
          applied_voucher_id?: string | null
          appointment_id?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          id?: string
          notes?: string | null
          paid_at?: string | null
          professional_id?: string | null
          status?: string
          subtotal_amount?: number
          tenant_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          tenant_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          tenant_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          order_id: string
          paid_at: string | null
          payment_method_id: string
          reference: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          order_id: string
          paid_at?: string | null
          payment_method_id: string
          reference?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          order_id?: string
          paid_at?: string | null
          payment_method_id?: string
          reference?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: []
      }
      points_ledger: {
        Row: {
          client_id: string
          created_at: string | null
          delta: number
          id: string
          notes: string | null
          reason: string
          ref_id: string | null
          tenant_id: string
          wallet_id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          delta: number
          id?: string
          notes?: string | null
          reason: string
          ref_id?: string | null
          tenant_id: string
          wallet_id: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          delta?: number
          id?: string
          notes?: string | null
          reason?: string
          ref_id?: string | null
          tenant_id?: string
          wallet_id?: string
        }
        Relationships: []
      }
      points_wallets: {
        Row: {
          balance: number
          client_id: string
          created_at: string | null
          id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          balance?: number
          client_id: string
          created_at?: string | null
          id?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          balance?: number
          client_id?: string
          created_at?: string | null
          id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      professional_working_hours: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          professional_id: string
          start_time: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          professional_id: string
          start_time: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          professional_id?: string
          start_time?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          prev_cost: number | null
          prev_quantity: number | null
          product_id: string
          purchase_id: string
          quantity: number
          stock_movement_id: string | null
          tenant_id: string
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total: number
          prev_cost?: number | null
          prev_quantity?: number | null
          product_id: string
          purchase_id: string
          quantity: number
          stock_movement_id?: string | null
          tenant_id: string
          unit_cost: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          prev_cost?: number | null
          prev_quantity?: number | null
          product_id?: string
          purchase_id?: string
          quantity?: number
          stock_movement_id?: string | null
          tenant_id?: string
          unit_cost?: number
        }
        Relationships: []
      }
      purchases: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          financial_transaction_id: string | null
          id: string
          invoice_number: string | null
          notes: string | null
          purchased_at: string
          purchased_with_company_cash: boolean
          status: string
          supplier_id: string | null
          tenant_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          financial_transaction_id?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          purchased_at?: string
          purchased_with_company_cash?: boolean
          status?: string
          supplier_id?: string | null
          tenant_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          financial_transaction_id?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          purchased_at?: string
          purchased_with_company_cash?: boolean
          status?: string
          supplier_id?: string | null
          tenant_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      salary_payments: {
        Row: {
          amount: number
          created_at: string
          days_in_month: number | null
          days_worked: number | null
          id: string
          notes: string | null
          paid_by: string | null
          payment_date: string | null
          payment_method: string | null
          payment_month: number
          payment_reference: string | null
          payment_year: number
          professional_commission_id: string | null
          professional_id: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          days_in_month?: number | null
          days_worked?: number | null
          id?: string
          notes?: string | null
          paid_by?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_month: number
          payment_reference?: string | null
          payment_year: number
          professional_commission_id?: string | null
          professional_id: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          days_in_month?: number | null
          days_worked?: number | null
          id?: string
          notes?: string | null
          paid_by?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_month?: number
          payment_reference?: string | null
          payment_year?: number
          professional_commission_id?: string | null
          professional_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      schedule_blocks: {
        Row: {
          created_at: string
          created_by: string | null
          end_at: string
          id: string
          professional_id: string | null
          reason: string | null
          start_at: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_at: string
          id?: string
          professional_id?: string | null
          reason?: string | null
          start_at: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_at?: string
          id?: string
          professional_id?: string | null
          reason?: string | null
          start_at?: string
          tenant_id?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          created_at: string
          document: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          message: string
          metadata: Json
          sender: string
          tenant_id: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          metadata?: Json
          sender: string
          tenant_id: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          metadata?: Json
          sender?: string
          tenant_id?: string
          ticket_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          category: string
          channel: string
          created_at: string
          created_by: string
          id: string
          last_message_at: string
          priority: string
          status: string
          subject: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category: string
          channel?: string
          created_at?: string
          created_by: string
          id?: string
          last_message_at?: string
          priority?: string
          status?: string
          subject: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          channel?: string
          created_at?: string
          created_by?: string
          id?: string
          last_message_at?: string
          priority?: string
          status?: string
          subject?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_tour_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          step_index: number
          tenant_id: string
          tour_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          step_index?: number
          tenant_id: string
          tour_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          step_index?: number
          tenant_id?: string
          tour_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      voucher_redemptions: {
        Row: {
          id: string
          order_id: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          tenant_id: string
          voucher_id: string
        }
        Insert: {
          id?: string
          order_id?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          tenant_id: string
          voucher_id: string
        }
        Update: {
          id?: string
          order_id?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          tenant_id?: string
          voucher_id?: string
        }
        Relationships: []
      }
      vouchers: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          notes: string | null
          service_id: string | null
          status: string
          tenant_id: string
          type: string
          valor: number
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          service_id?: string | null
          status?: string
          tenant_id: string
          type: string
          valor: number
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          service_id?: string | null
          status?: string
          tenant_id?: string
          type?: string
          valor?: number
        }
        Relationships: []
      }
      // ============================================================
      // TABELAS MÉDICAS (criadas pela migração 001_medical_tables.sql)
      // ============================================================
      specialties: {
        Row: {
          avg_duration_minutes: number
          color: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          avg_duration_minutes?: number
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          avg_duration_minutes?: number
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      insurance_plans: {
        Row: {
          ans_code: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          reimbursement_days: number
          requires_authorization: boolean
          tenant_id: string
          tiss_version: string | null
          updated_at: string
        }
        Insert: {
          ans_code?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          reimbursement_days?: number
          requires_authorization?: boolean
          tenant_id: string
          tiss_version?: string | null
          updated_at?: string
        }
        Update: {
          ans_code?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          reimbursement_days?: number
          requires_authorization?: boolean
          tenant_id?: string
          tiss_version?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      medical_records: {
        Row: {
          anamnesis: string | null
          appointment_id: string | null
          cid_code: string | null
          chief_complaint: string | null
          client_id: string
          created_at: string
          diagnosis: string | null
          id: string
          is_confidential: boolean
          notes: string | null
          physical_exam: string | null
          prescriptions: string | null
          professional_id: string | null
          record_date: string
          specialty_id: string | null
          tenant_id: string
          treatment_plan: string | null
          updated_at: string
        }
        Insert: {
          anamnesis?: string | null
          appointment_id?: string | null
          cid_code?: string | null
          chief_complaint?: string | null
          client_id: string
          created_at?: string
          diagnosis?: string | null
          id?: string
          is_confidential?: boolean
          notes?: string | null
          physical_exam?: string | null
          prescriptions?: string | null
          professional_id?: string | null
          record_date?: string
          specialty_id?: string | null
          tenant_id: string
          treatment_plan?: string | null
          updated_at?: string
        }
        Update: {
          anamnesis?: string | null
          appointment_id?: string | null
          cid_code?: string | null
          chief_complaint?: string | null
          client_id?: string
          created_at?: string
          diagnosis?: string | null
          id?: string
          is_confidential?: boolean
          notes?: string | null
          physical_exam?: string | null
          prescriptions?: string | null
          professional_id?: string | null
          record_date?: string
          specialty_id?: string | null
          tenant_id?: string
          treatment_plan?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      triage_records: {
        Row: {
          allergies: string | null
          appointment_id: string | null
          blood_pressure_diastolic: number | null
          blood_pressure_systolic: number | null
          chief_complaint: string
          client_id: string
          created_at: string
          current_medications: string | null
          heart_rate: number | null
          height_cm: number | null
          id: string
          medical_history: string | null
          notes: string | null
          oxygen_saturation: number | null
          pain_scale: number | null
          performed_by: string | null
          priority: string
          respiratory_rate: number | null
          temperature: number | null
          tenant_id: string
          triaged_at: string
          weight_kg: number | null
        }
        Insert: {
          allergies?: string | null
          appointment_id?: string | null
          blood_pressure_diastolic?: number | null
          blood_pressure_systolic?: number | null
          chief_complaint: string
          client_id: string
          created_at?: string
          current_medications?: string | null
          heart_rate?: number | null
          height_cm?: number | null
          id?: string
          medical_history?: string | null
          notes?: string | null
          oxygen_saturation?: number | null
          pain_scale?: number | null
          performed_by?: string | null
          priority?: string
          respiratory_rate?: number | null
          temperature?: number | null
          tenant_id: string
          triaged_at?: string
          weight_kg?: number | null
        }
        Update: {
          allergies?: string | null
          appointment_id?: string | null
          blood_pressure_diastolic?: number | null
          blood_pressure_systolic?: number | null
          chief_complaint?: string
          client_id?: string
          created_at?: string
          current_medications?: string | null
          heart_rate?: number | null
          height_cm?: number | null
          id?: string
          medical_history?: string | null
          notes?: string | null
          oxygen_saturation?: number | null
          pain_scale?: number | null
          performed_by?: string | null
          priority?: string
          respiratory_rate?: number | null
          temperature?: number | null
          tenant_id?: string
          triaged_at?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      prescriptions: {
        Row: {
          appointment_id: string | null
          client_id: string
          created_at: string
          digital_signature: string | null
          expires_at: string | null
          id: string
          instructions: string | null
          issued_at: string
          medications: string
          prescription_type: string
          printed_at: string | null
          professional_id: string | null
          status: string
          tenant_id: string
          updated_at: string
          validity_days: number
        }
        Insert: {
          appointment_id?: string | null
          client_id: string
          created_at?: string
          digital_signature?: string | null
          expires_at?: string | null
          id?: string
          instructions?: string | null
          issued_at?: string
          medications: string
          prescription_type?: string
          printed_at?: string | null
          professional_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          validity_days?: number
        }
        Update: {
          appointment_id?: string | null
          client_id?: string
          created_at?: string
          digital_signature?: string | null
          expires_at?: string | null
          id?: string
          instructions?: string | null
          issued_at?: string
          medications?: string
          prescription_type?: string
          printed_at?: string | null
          professional_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          validity_days?: number
        }
        Relationships: []
      }
      exam_results: {
        Row: {
          appointment_id: string | null
          client_id: string
          created_at: string
          exam_name: string
          exam_type: string
          file_name: string | null
          file_url: string | null
          id: string
          interpretation: string | null
          lab_name: string | null
          notes: string | null
          performed_at: string | null
          reference_values: string | null
          requested_by: string | null
          result_text: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          client_id: string
          created_at?: string
          exam_name: string
          exam_type?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          interpretation?: string | null
          lab_name?: string | null
          notes?: string | null
          performed_at?: string | null
          reference_values?: string | null
          requested_by?: string | null
          result_text?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          client_id?: string
          created_at?: string
          exam_name?: string
          exam_type?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          interpretation?: string | null
          lab_name?: string | null
          notes?: string | null
          performed_at?: string | null
          reference_values?: string | null
          requested_by?: string | null
          result_text?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          capacity: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          tenant_id: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
        }
        Update: {
          capacity?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
        }
        Relationships: []
      }
      consent_forms: {
        Row: {
          appointment_id: string | null
          client_id: string
          content: string
          created_at: string
          form_type: string
          id: string
          ip_address: string | null
          is_revoked: boolean
          revocation_reason: string | null
          revoked_at: string | null
          signature_data: string | null
          signed_at: string | null
          signed_by_name: string | null
          tenant_id: string
          title: string
          witnessed_by: string | null
        }
        Insert: {
          appointment_id?: string | null
          client_id: string
          content: string
          created_at?: string
          form_type?: string
          id?: string
          ip_address?: string | null
          is_revoked?: boolean
          revocation_reason?: string | null
          revoked_at?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signed_by_name?: string | null
          tenant_id: string
          title: string
          witnessed_by?: string | null
        }
        Update: {
          appointment_id?: string | null
          client_id?: string
          content?: string
          created_at?: string
          form_type?: string
          id?: string
          ip_address?: string | null
          is_revoked?: boolean
          revocation_reason?: string | null
          revoked_at?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signed_by_name?: string | null
          tenant_id?: string
          title?: string
          witnessed_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_appointment_with_sale: {
        Args: {
          p_appointment_id: string
          p_product_id?: string
          p_quantity?: number
        }
        Returns: Json
      }
      get_achievements_summary: {
        Args: { p_professional_id?: string; p_tenant_id: string }
        Returns: {
          achieved_at: string
          achievement_type: string
          goal_id: string
          goal_name: string
          level_name: string
          metadata: Json
          professional_id: string
          professional_name: string
          streak_count: number
        }[]
      }
      get_dashboard_commission_totals: {
        Args: {
          p_is_admin: boolean
          p_professional_user_id?: string
          p_tenant_id: string
        }
        Returns: Json
      }
      get_goal_previous_period_value: {
        Args: { p_goal_id: string; p_tenant_id: string }
        Returns: number
      }
      get_goal_progress_history: {
        Args: { p_goal_id: string; p_tenant_id: string }
        Returns: {
          cumulative_value: number
          day_date: string
          progress_pct: number
        }[]
      }
      get_goals_with_progress:
        | {
            Args: { p_tenant_id: string }
            Returns: {
              current_value: number
              goal_type: string
              id: string
              name: string
              period: string
              product_id: string
              professional_id: string
              progress_pct: number
              show_in_header: boolean
              target_value: number
            }[]
          }
        | {
            Args: { p_include_archived?: boolean; p_tenant_id: string }
            Returns: {
              archived_at: string
              current_value: number
              custom_end: string
              custom_start: string
              days_remaining: number
              goal_type: string
              header_priority: number
              id: string
              name: string
              period: string
              period_elapsed_pct: number
              period_end: string
              period_start: string
              product_id: string
              professional_id: string
              progress_pct: number
              projected_reach: string
              show_in_header: boolean
              target_value: number
            }[]
          }
      execute_lgpd_anonymization: {
        Args: {
          p_confirmation_token: string
          p_request_id?: string
          p_target_user_id: string
          p_tenant_id: string
        }
        Returns: Json
      }
      export_lgpd_data_subject: {
        Args: {
          p_format?: string
          p_target_user_id: string
          p_tenant_id: string
        }
        Returns: Json
      }
      log_admin_action: {
        Args: {
          p_action: string
          p_entity_id?: string
          p_entity_type: string
          p_metadata?: Json
          p_tenant_id: string
        }
        Returns: string
      }
      preview_lgpd_anonymization: {
        Args: { p_target_user_id: string; p_tenant_id: string }
        Returns: Json
      }
      get_user_tenant_id: { Args: { p_user_id: string }; Returns: string }
      has_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: boolean
      }
      is_tenant_admin: {
        Args: { p_tenant_id: string; p_user_id: string }
        Returns: boolean
      }
      record_goal_achievements_for_tenant: {
        Args: { p_tenant_id: string }
        Returns: number
      }
      record_level_achievements: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      record_streak_achievements: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      user_has_tenant_access: {
        Args: { p_tenant_id: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff"
      appointment_status: "pending" | "confirmed" | "completed" | "cancelled"
      commission_status: "pending" | "paid" | "cancelled"
      commission_type: "percentage" | "fixed"
      goal_period: "weekly" | "monthly" | "yearly" | "quarterly"
      goal_type:
        | "revenue"
        | "services_count"
        | "product_quantity"
        | "product_revenue"
        | "clientes_novos"
        | "ticket_medio"
      transaction_type: "income" | "expense"
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
      app_role: ["admin", "staff"],
      appointment_status: ["pending", "confirmed", "completed", "cancelled"],
      commission_status: ["pending", "paid", "cancelled"],
      commission_type: ["percentage", "fixed"],
      goal_period: ["weekly", "monthly", "yearly", "quarterly"],
      goal_type: [
        "revenue",
        "services_count",
        "product_quantity",
        "product_revenue",
        "clientes_novos",
        "ticket_medio",
      ],
      transaction_type: ["income", "expense"],
    },
  },
} as const
