import type { Database } from './database'

// Database table types
export type Organization = Database['public']['Tables']['organizations']['Row']
export type User = Database['public']['Tables']['users']['Row']
export type OrganizationMembership = Database['public']['Tables']['organization_memberships']['Row'] & {
  organization?: Organization
  user?: User
}
export type Client = Database['public']['Tables']['clients']['Row']
export type ClientContact = Database['public']['Tables']['client_contacts']['Row']
export type Cart = Database['public']['Tables']['carts']['Row']
export type CartItem = Database['public']['Tables']['cart_items']['Row']
// MedusaJS-compatible Product type (replaces Supabase Product)
export type Product = {
  id: string
  name: string
  description: string | null
  price: number
  sku: string | null
  stock_quantity: number
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  creator: {
    first_name: string | null
    last_name: string | null
    email: string
  } | null
}

// Keep the old database type for potential migration needs
export type SupabaseProduct = Database['public']['Tables']['products']['Row']
export type Order = Database['public']['Tables']['orders']['Row']
export type OrderItem = Database['public']['Tables']['order_items']['Row']

// Extended user type with memberships
export type UserWithMemberships = User & {
  organization_memberships: OrganizationMembership[]
}

// Insert types
export type OrganizationInsert = Database['public']['Tables']['organizations']['Insert']
export type UserInsert = Database['public']['Tables']['users']['Insert']
export type OrganizationMembershipInsert = Database['public']['Tables']['organization_memberships']['Insert']
export type ProductInsert = Database['public']['Tables']['products']['Insert']
export type OrderInsert = Database['public']['Tables']['orders']['Insert']
export type OrderItemInsert = Database['public']['Tables']['order_items']['Insert']
export type ClientInsert = Database['public']['Tables']['clients']['Insert']
export type ClientContactInsert = Database['public']['Tables']['client_contacts']['Insert']
export type CartInsert = Database['public']['Tables']['carts']['Insert']
export type CartItemInsert = Database['public']['Tables']['cart_items']['Insert']

// Update types
export type OrganizationUpdate = Database['public']['Tables']['organizations']['Update']
export type UserUpdate = Database['public']['Tables']['users']['Update']
export type OrganizationMembershipUpdate = Database['public']['Tables']['organization_memberships']['Update']
export type ProductUpdate = Database['public']['Tables']['products']['Update']
export type OrderUpdate = Database['public']['Tables']['orders']['Update']
export type OrderItemUpdate = Database['public']['Tables']['order_items']['Update']
export type ClientUpdate = Database['public']['Tables']['clients']['Update']
export type ClientContactUpdate = Database['public']['Tables']['client_contacts']['Update']
export type CartUpdate = Database['public']['Tables']['carts']['Update']
export type CartItemUpdate = Database['public']['Tables']['cart_items']['Update']

// Enum types
export type UserRole = Database['public']['Enums']['user_role']
export type OrderStatus = Database['public']['Enums']['order_status']
export type BusinessType = Database['public']['Enums']['business_type']
export type PaymentTerms = Database['public']['Enums']['payment_terms']
export type CartStatus = Database['public']['Enums']['cart_status']

// Extended types for API responses
export type OrderWithItems = Order & {
  order_items: (OrderItem & {
    products: Product
  })[]
  client?: Client
}

export type ProductWithStock = Product & {
  available_stock: number
}

export type ClientWithContacts = Client & {
  client_contacts: ClientContact[]
  organization?: Organization
  creator?: User
}

export type CartWithItems = Cart & {
  cart_items: (CartItem & {
    product: Product
  })[]
  client: Client
  user: User
  organization: Organization
}

export type CartItemWithProduct = CartItem & {
  product: Product
}

// Organization context types
export type OrganizationContext = {
  currentOrganization: Organization | null
  userMemberships: OrganizationMembership[]
  userRole: UserRole | null
  isLoading: boolean
  hasAccess: boolean
  subdomainInfo: SubdomainInfo
  switchToOrganization: (organizationSubdomain: string) => void
  refetch: () => void
}

// API response types
export type ApiResponse<T> = {
  data?: T
  error?: string
  message?: string
}

export type PaginatedResponse<T> = ApiResponse<T> & {
  pagination?: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

// Form types
export type ProductFormData = {
  name: string
  description?: string
  price: number
  sku?: string
  stock_quantity: number
  is_active: boolean
}

export type OrderFormData = {
  customer_name: string
  customer_email: string
  items: {
    product_id: string
    quantity: number
  }[]
}

export type UserInviteFormData = {
  email: string
  role: UserRole
}

export type ClientFormData = {
  company_name: string
  contact_name: string
  contact_email: string
  contact_phone?: string
  tax_id?: string
  business_type?: BusinessType
  industry?: string
  billing_address_line1?: string
  billing_address_line2?: string
  billing_city?: string
  billing_state?: string
  billing_postal_code?: string
  billing_country?: string
  shipping_address_line1?: string
  shipping_address_line2?: string
  shipping_city?: string
  shipping_state?: string
  shipping_postal_code?: string
  shipping_country?: string
  payment_terms?: PaymentTerms
  credit_limit?: number
  preferred_currency?: string
  notes?: string
}

export type CartItemFormData = {
  product_id: string
  quantity: number
}

export type AddToCartData = {
  client_id: string
  product_id: string
  quantity: number
}

export type UpdateCartItemData = {
  cart_item_id: string
  quantity: number
}

export type CheckoutFormData = {
  client_id: string
  billing_address?: {
    line1: string
    line2?: string
    city: string
    state: string
    postal_code: string
    country: string
  }
  shipping_address?: {
    line1: string
    line2?: string
    city: string
    state: string
    postal_code: string
    country: string
  }
  notes?: string
}

// Subdomain and organization switching types
export type SubdomainInfo = {
  subdomain: string
  isValid: boolean
  organization: Organization | null
}