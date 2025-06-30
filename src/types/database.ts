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
      organizations: {
        Row: {
          id: string
          clerk_org_id: string
          name: string
          subdomain: string
          domain: string | null
          logo_url: string | null
          settings: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clerk_org_id: string
          name: string
          subdomain: string
          domain?: string | null
          logo_url?: string | null
          settings?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clerk_org_id?: string
          name?: string
          subdomain?: string
          domain?: string | null
          logo_url?: string | null
          settings?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          clerk_user_id: string
          email: string
          first_name: string | null
          last_name: string | null
          avatar_url: string | null
          is_active: boolean
          last_sign_in_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clerk_user_id: string
          email: string
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          is_active?: boolean
          last_sign_in_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clerk_user_id?: string
          email?: string
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          is_active?: boolean
          last_sign_in_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      organization_memberships: {
        Row: {
          id: string
          user_id: string
          organization_id: string
          role: 'admin' | 'manager' | 'member'
          is_active: boolean
          joined_at: string
        }
        Insert: {
          id?: string
          user_id: string
          organization_id: string
          role?: 'admin' | 'manager' | 'member'
          is_active?: boolean
          joined_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          organization_id?: string
          role?: 'admin' | 'manager' | 'member'
          is_active?: boolean
          joined_at?: string
        }
      }
      products: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          price: number
          sku: string | null
          stock_quantity: number
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          description?: string | null
          price: number
          sku?: string | null
          stock_quantity?: number
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          description?: string | null
          price?: number
          sku?: string | null
          stock_quantity?: number
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          organization_id: string
          customer_name: string
          customer_email: string
          total_amount: number
          status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          customer_name: string
          customer_email: string
          total_amount: number
          status?: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          customer_name?: string
          customer_email?: string
          total_amount?: number
          status?: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
          total_price: number
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
          total_price: number
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
          total_price?: number
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
      user_role: 'admin' | 'manager' | 'member'
      order_status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}