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
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      limit_orders: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          limit_price: number
          market_id: string
          option_id: string
          quantity: number
          quantity_filled: number
          side: Database["public"]["Enums"]["order_side"]
          status: Database["public"]["Enums"]["order_status"]
          total_cost: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          limit_price: number
          market_id: string
          option_id: string
          quantity: number
          quantity_filled?: number
          side: Database["public"]["Enums"]["order_side"]
          status?: Database["public"]["Enums"]["order_status"]
          total_cost?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          limit_price?: number
          market_id?: string
          option_id?: string
          quantity?: number
          quantity_filled?: number
          side?: Database["public"]["Enums"]["order_side"]
          status?: Database["public"]["Enums"]["order_status"]
          total_cost?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "limit_orders_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "limit_orders_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "market_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "limit_orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      market_options: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          market_id: string
          sort_order: number
          symbol: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          market_id: string
          sort_order?: number
          symbol?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          market_id?: string
          sort_order?: number
          symbol?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_options_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      market_resolutions: {
        Row: {
          created_at: string
          id: string
          market_id: string
          resolution_note: string | null
          resolved_by: string
          winning_option_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          market_id: string
          resolution_note?: string | null
          resolved_by: string
          winning_option_id: string
        }
        Update: {
          created_at?: string
          id?: string
          market_id?: string
          resolution_note?: string | null
          resolved_by?: string
          winning_option_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_resolutions_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: true
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_resolutions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_resolutions_winning_option_id_fkey"
            columns: ["winning_option_id"]
            isOneToOne: false
            referencedRelation: "market_options"
            referencedColumns: ["id"]
          },
        ]
      }
      market_snapshots: {
        Row: {
          best_ask: Json | null
          best_bid: Json | null
          id: number
          market_id: string
          option_probabilities: Json
          option_volumes: Json
          snapshot_at: string
          total_trades: number
          total_volume: number
        }
        Insert: {
          best_ask?: Json | null
          best_bid?: Json | null
          id?: number
          market_id: string
          option_probabilities?: Json
          option_volumes?: Json
          snapshot_at?: string
          total_trades?: number
          total_volume?: number
        }
        Update: {
          best_ask?: Json | null
          best_bid?: Json | null
          id?: number
          market_id?: string
          option_probabilities?: Json
          option_volumes?: Json
          snapshot_at?: string
          total_trades?: number
          total_volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "market_snapshots_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      markets: {
        Row: {
          category: string | null
          closes_at: string | null
          created_at: string
          created_by: string
          description: string | null
          fee_bps: number
          fx_reference_source: string | null
          id: string
          is_daily_fx: boolean
          liquidity_b: number
          opens_at: string | null
          resolution_option_id: string | null
          resolved_at: string | null
          slug: string | null
          status: Database["public"]["Enums"]["market_status"]
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          closes_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          fee_bps?: number
          fx_reference_source?: string | null
          id?: string
          is_daily_fx?: boolean
          liquidity_b?: number
          opens_at?: string | null
          resolution_option_id?: string | null
          resolved_at?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["market_status"]
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          closes_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          fee_bps?: number
          fx_reference_source?: string | null
          id?: string
          is_daily_fx?: boolean
          liquidity_b?: number
          opens_at?: string | null
          resolution_option_id?: string | null
          resolved_at?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["market_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "markets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "markets_resolution_option_id_fkey"
            columns: ["resolution_option_id"]
            isOneToOne: false
            referencedRelation: "market_options"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events: {
        Row: {
          attempt_count: number
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          payload: Json
          read_at: string | null
          scheduled_at: string
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          event_type: string
          id?: string
          last_error?: string | null
          payload?: Json
          read_at?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          event_type?: string
          id?: string
          last_error?: string | null
          payload?: Json
          read_at?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          avg_entry_price: number
          created_at: string
          id: string
          market_id: string
          option_id: string
          quantity: number
          realized_pnl: number
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_entry_price?: number
          created_at?: string
          id?: string
          market_id: string
          option_id: string
          quantity?: number
          realized_pnl?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_entry_price?: number
          created_at?: string
          id?: string
          market_id?: string
          option_id?: string
          quantity?: number
          realized_pnl?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "market_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          locale: string
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          locale?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          locale?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      trades: {
        Row: {
          buy_order_id: string | null
          created_at: string
          id: string
          maker_user_id: string | null
          market_id: string
          notional: number | null
          option_id: string
          price: number
          quantity: number
          sell_order_id: string | null
          side: Database["public"]["Enums"]["order_side"]
          taker_user_id: string | null
        }
        Insert: {
          buy_order_id?: string | null
          created_at?: string
          id?: string
          maker_user_id?: string | null
          market_id: string
          notional?: number | null
          option_id: string
          price: number
          quantity: number
          sell_order_id?: string | null
          side: Database["public"]["Enums"]["order_side"]
          taker_user_id?: string | null
        }
        Update: {
          buy_order_id?: string | null
          created_at?: string
          id?: string
          maker_user_id?: string | null
          market_id?: string
          notional?: number | null
          option_id?: string
          price?: number
          quantity?: number
          sell_order_id?: string | null
          side?: Database["public"]["Enums"]["order_side"]
          taker_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trades_buy_order_id_fkey"
            columns: ["buy_order_id"]
            isOneToOne: false
            referencedRelation: "limit_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_maker_user_id_fkey"
            columns: ["maker_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "market_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_sell_order_id_fkey"
            columns: ["sell_order_id"]
            isOneToOne: false
            referencedRelation: "limit_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_taker_user_id_fkey"
            columns: ["taker_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          coming_soon_enabled: boolean
          coming_soon_message: string
          coming_soon_target_at: string | null
          coming_soon_title: string
          created_at: string
          id: number
          updated_at: string
        }
        Insert: {
          coming_soon_enabled?: boolean
          coming_soon_message?: string
          coming_soon_target_at?: string | null
          coming_soon_title?: string
          created_at?: string
          id?: number
          updated_at?: string
        }
        Update: {
          coming_soon_enabled?: boolean
          coming_soon_message?: string
          coming_soon_target_at?: string | null
          coming_soon_title?: string
          created_at?: string
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_movements: {
        Row: {
          amount: number
          balance_after: number | null
          created_at: string
          id: string
          market_id: string | null
          metadata: Json | null
          movement_type: Database["public"]["Enums"]["wallet_movement_type"]
          order_id: string | null
          trade_id: string | null
          user_id: string
          wallet_id: string
          withdrawal_request_id: string | null
        }
        Insert: {
          amount: number
          balance_after?: number | null
          created_at?: string
          id?: string
          market_id?: string | null
          metadata?: Json | null
          movement_type: Database["public"]["Enums"]["wallet_movement_type"]
          order_id?: string | null
          trade_id?: string | null
          user_id: string
          wallet_id: string
          withdrawal_request_id?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number | null
          created_at?: string
          id?: string
          market_id?: string | null
          metadata?: Json | null
          movement_type?: Database["public"]["Enums"]["wallet_movement_type"]
          order_id?: string | null
          trade_id?: string | null
          user_id?: string
          wallet_id?: string
          withdrawal_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_movements_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "limit_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_movements_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_movements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_movements_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_movements_withdrawal_request_id_fkey"
            columns: ["withdrawal_request_id"]
            isOneToOne: false
            referencedRelation: "withdrawal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance_available: number
          balance_locked: number
          created_at: string
          id: string
          total_withdrawn: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_available?: number
          balance_locked?: number
          created_at?: string
          id?: string
          total_withdrawn?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_available?: number
          balance_locked?: number
          created_at?: string
          id?: string
          total_withdrawn?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          admin_note: string | null
          amount: number
          auto_decision_reason: string | null
          bank_account_id: string | null
          created_at: string
          destination: Json | null
          external_reference: string | null
          id: string
          process_after: string | null
          processed_at: string | null
          rejection_reason: string | null
          requested_at: string
          reviewed_at: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          stripe_checkout_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          auto_decision_reason?: string | null
          bank_account_id?: string | null
          created_at?: string
          destination?: Json | null
          external_reference?: string | null
          id?: string
          process_after?: string | null
          processed_at?: string | null
          rejection_reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          stripe_checkout_session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          auto_decision_reason?: string | null
          bank_account_id?: string | null
          created_at?: string
          destination?: Json | null
          external_reference?: string | null
          id?: string
          process_after?: string | null
          processed_at?: string | null
          rejection_reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          stripe_checkout_session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_rules: {
        Row: {
          cooldown_days: number
          created_at: string
          id: number
          max_amount: number
          max_per_day: number
          max_per_month: number
          min_amount: number
          min_processing_days: number
          updated_at: string
        }
        Insert: {
          cooldown_days?: number
          created_at?: string
          id?: number
          max_amount?: number
          max_per_day?: number
          max_per_month?: number
          min_amount?: number
          min_processing_days?: number
          updated_at?: string
        }
        Update: {
          cooldown_days?: number
          created_at?: string
          id?: number
          max_amount?: number
          max_per_day?: number
          max_per_month?: number
          min_amount?: number
          min_processing_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      kyc_verifications: {
        Row: {
          id: string
          user_id: string
          stripe_session_id: string | null
          status: Database["public"]["Enums"]["kyc_status"]
          id_document_path: string | null
          id_document_uploaded_at: string | null
          legal_full_name: string | null
          id_number: string | null
          phone: string | null
          address_line: string | null
          verified_at: string | null
          rejection_reason: string | null
          last_error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          stripe_session_id?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          id_document_path?: string | null
          id_document_uploaded_at?: string | null
          legal_full_name?: string | null
          id_number?: string | null
          phone?: string | null
          address_line?: string | null
          verified_at?: string | null
          rejection_reason?: string | null
          last_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          stripe_session_id?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          id_document_path?: string | null
          id_document_uploaded_at?: string | null
          legal_full_name?: string | null
          id_number?: string | null
          phone?: string | null
          address_line?: string | null
          verified_at?: string | null
          rejection_reason?: string | null
          last_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          id: string
          user_id: string
          bank_name: string
          account_type: string
          account_holder_name: string
          account_number_encrypted: string
          account_last4: string
          is_primary: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          bank_name: string
          account_type: string
          account_holder_name: string
          account_number_encrypted: string
          account_last4: string
          is_primary?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          bank_name?: string
          account_type?: string
          account_holder_name?: string
          account_number_encrypted?: string
          account_last4?: string
          is_primary?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      stripe_deposits: {
        Row: {
          id: string
          user_id: string
          stripe_checkout_session_id: string
          amount_dop: number
          status: string
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          stripe_checkout_session_id: string
          amount_dop: number
          status?: string
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          stripe_checkout_session_id?: string
          amount_dop?: number
          status?: string
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_position_fill: {
        Args: {
          p_market_id: string
          p_option_id: string
          p_price: number
          p_qty: number
          p_side: Database["public"]["Enums"]["order_side"]
          p_user_id: string
        }
        Returns: undefined
      }
      cancel_user_order: { Args: { p_order_id: string }; Returns: boolean }
      credit_user_wallet: { Args: { p_amount: number; p_user_id?: string }; Returns: number }
      is_admin: { Args: { check_user_id?: string }; Returns: boolean }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_notification_read: {
        Args: { p_notification_id: string; p_read?: boolean }
        Returns: boolean
      }
      place_buy_limit_order: {
        Args: {
          p_limit_price: number
          p_market_id: string
          p_option_id: string
          p_quantity: number
        }
        Returns: string
      }
      place_limit_order: {
        Args: {
          p_limit_price: number
          p_market_id: string
          p_option_id: string
          p_quantity: number
          p_side: Database["public"]["Enums"]["order_side"]
        }
        Returns: string
      }
      place_sell_limit_order: {
        Args: {
          p_limit_price: number
          p_market_id: string
          p_option_id: string
          p_quantity: number
        }
        Returns: string
      }
      process_withdrawal_queue: { Args: { p_limit?: number }; Returns: number }
      upsert_kyc_verification: {
        Args: {
          p_user_id: string
          p_stripe_session_id?: string | null
          p_status?: string
          p_rejection_reason?: string | null
          p_last_error?: string | null
        }
        Returns: undefined
      }
      submit_kyc_document: {
        Args: {
          p_document_path: string
          p_legal_full_name: string
          p_id_number: string
          p_phone: string
          p_address_line: string
        }
        Returns: undefined
      }
      set_primary_bank_account: {
        Args: { p_account_id: string }
        Returns: undefined
      }
      deactivate_bank_account: {
        Args: { p_account_id: string }
        Returns: undefined
      }
      request_withdrawal: {
        Args: { p_amount: number; p_destination?: Json }
        Returns: string
      }
      resolve_market: {
        Args: {
          p_market_id: string
          p_resolution_note?: string
          p_winning_option_id: string
        }
        Returns: boolean
      }
      review_withdrawal_request: {
        Args: {
          p_admin_note?: string
          p_decision: string
          p_external_reference?: string
          p_rejection_reason?: string
          p_request_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      kyc_status:
        | "pending"
        | "submitted"
        | "verified"
        | "rejected"
        | "requires_input"
      market_status: "draft" | "open" | "closed" | "resolved" | "archived"
      order_side: "buy" | "sell"
      order_status:
        | "open"
        | "partially_filled"
        | "filled"
        | "cancelled"
        | "expired"
      wallet_movement_type:
        | "deposit"
        | "participation"
        | "payout"
        | "withdrawal_requested"
        | "withdrawal_approved"
        | "withdrawal_rejected"
        | "admin_adjustment"
        | "reversal"
      withdrawal_status:
        | "pending"
        | "approved"
        | "rejected"
        | "processing"
        | "completed"
        | "failed"
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
      app_role: ["admin", "user"],
      market_status: ["draft", "open", "closed", "resolved", "archived"],
      order_side: ["buy", "sell"],
      order_status: [
        "open",
        "partially_filled",
        "filled",
        "cancelled",
        "expired",
      ],
      wallet_movement_type: [
        "deposit",
        "participation",
        "payout",
        "withdrawal_requested",
        "withdrawal_approved",
        "withdrawal_rejected",
        "admin_adjustment",
        "reversal",
      ],
      withdrawal_status: [
        "pending",
        "approved",
        "rejected",
        "processing",
        "completed",
        "failed",
      ],
    },
  },
} as const
