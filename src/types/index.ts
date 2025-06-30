import type { Database } from './database'

// Database table types
export type Organization = Database['public']['Tables']['organizations']['Row']
export type User = Database['public']['Tables']['users']['Row'] & {
  organizations?: Organization
}
export type Product = Database['public']['Tables']['products']['Row']
export type Order = Database['public']['Tables']['orders']['Row']
export type OrderItem = Database['public']['Tables']['order_items']['Row']

// Insert types
export type OrganizationInsert = Database['public']['Tables']['organizations']['Insert']
export type UserInsert = Database['public']['Tables']['users']['Insert']
export type ProductInsert = Database['public']['Tables']['products']['Insert']
export type OrderInsert = Database['public']['Tables']['orders']['Insert']
export type OrderItemInsert = Database['public']['Tables']['order_items']['Insert']

// Update types
export type OrganizationUpdate = Database['public']['Tables']['organizations']['Update']
export type UserUpdate = Database['public']['Tables']['users']['Update']
export type ProductUpdate = Database['public']['Tables']['products']['Update']
export type OrderUpdate = Database['public']['Tables']['orders']['Update']
export type OrderItemUpdate = Database['public']['Tables']['order_items']['Update']

// Enum types
export type UserRole = Database['public']['Enums']['user_role']
export type OrderStatus = Database['public']['Enums']['order_status']

// Extended types for API responses
export type OrderWithItems = Order & {
  order_items: (OrderItem & {
    products: Product
  })[]
  users: User
}

export type ProductWithStock = Product & {
  available_stock: number
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
  sku: string
  stock_quantity: number
  is_active: boolean
}

export type OrderFormData = {
  items: {
    product_id: string
    quantity: number
  }[]
}

export type UserInviteFormData = {
  email: string
  role: UserRole
}