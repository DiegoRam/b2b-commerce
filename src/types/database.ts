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
      clients: {
        Row: {
          id: string
          organization_id: string
          medusa_customer_id: string | null
          company_name: string
          contact_name: string
          contact_email: string
          contact_phone: string | null
          tax_id: string | null
          business_type: 'corporation' | 'partnership' | 'llc' | 'sole_proprietorship' | 'other' | null
          industry: string | null
          billing_address_line1: string | null
          billing_address_line2: string | null
          billing_city: string | null
          billing_state: string | null
          billing_postal_code: string | null
          billing_country: string
          shipping_address_line1: string | null
          shipping_address_line2: string | null
          shipping_city: string | null
          shipping_state: string | null
          shipping_postal_code: string | null
          shipping_country: string
          payment_terms: 'net_15' | 'net_30' | 'net_60' | 'cod' | 'prepaid'
          credit_limit: number
          preferred_currency: string
          notes: string | null
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          medusa_customer_id?: string | null
          company_name: string
          contact_name: string
          contact_email: string
          contact_phone?: string | null
          tax_id?: string | null
          business_type?: 'corporation' | 'partnership' | 'llc' | 'sole_proprietorship' | 'other' | null
          industry?: string | null
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_state?: string | null
          billing_postal_code?: string | null
          billing_country?: string
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_state?: string | null
          shipping_postal_code?: string | null
          shipping_country?: string
          payment_terms?: 'net_15' | 'net_30' | 'net_60' | 'cod' | 'prepaid'
          credit_limit?: number
          preferred_currency?: string
          notes?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          medusa_customer_id?: string | null
          company_name?: string
          contact_name?: string
          contact_email?: string
          contact_phone?: string | null
          tax_id?: string | null
          business_type?: 'corporation' | 'partnership' | 'llc' | 'sole_proprietorship' | 'other' | null
          industry?: string | null
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_state?: string | null
          billing_postal_code?: string | null
          billing_country?: string
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_state?: string | null
          shipping_postal_code?: string | null
          shipping_country?: string
          payment_terms?: 'net_15' | 'net_30' | 'net_60' | 'cod' | 'prepaid'
          credit_limit?: number
          preferred_currency?: string
          notes?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      client_contacts: {
        Row: {
          id: string
          client_id: string
          name: string
          email: string
          phone: string | null
          title: string | null
          department: string | null
          is_primary: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          name: string
          email: string
          phone?: string | null
          title?: string | null
          department?: string | null
          is_primary?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          name?: string
          email?: string
          phone?: string | null
          title?: string | null
          department?: string | null
          is_primary?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      carts: {
        Row: {
          id: string
          organization_id: string
          client_id: string
          user_id: string
          medusa_cart_id: string | null
          status: 'active' | 'completed' | 'abandoned'
          currency: string
          total_amount: number
          item_count: number
          session_id: string | null
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          client_id: string
          user_id: string
          medusa_cart_id?: string | null
          status?: 'active' | 'completed' | 'abandoned'
          currency?: string
          total_amount?: number
          item_count?: number
          session_id?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          client_id?: string
          user_id?: string
          medusa_cart_id?: string | null
          status?: 'active' | 'completed' | 'abandoned'
          currency?: string
          total_amount?: number
          item_count?: number
          session_id?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      cart_items: {
        Row: {
          id: string
          cart_id: string
          product_id: string
          medusa_line_item_id: string | null
          quantity: number
          unit_price: number
          total_price: number
          product_name: string
          product_sku: string | null
          product_description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cart_id: string
          product_id: string
          medusa_line_item_id?: string | null
          quantity?: number
          unit_price: number
          total_price: number
          product_name: string
          product_sku?: string | null
          product_description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          cart_id?: string
          product_id?: string
          medusa_line_item_id?: string | null
          quantity?: number
          unit_price?: number
          total_price?: number
          product_name?: string
          product_sku?: string | null
          product_description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          organization_id: string
          client_id: string | null
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
          client_id?: string | null
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
          client_id?: string | null
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
      business_type: 'corporation' | 'partnership' | 'llc' | 'sole_proprietorship' | 'other'
      payment_terms: 'net_15' | 'net_30' | 'net_60' | 'cod' | 'prepaid'
      cart_status: 'active' | 'completed' | 'abandoned'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}