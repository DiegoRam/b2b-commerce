// MedusaJS Customer API type definitions
// Based on MedusaJS v2 API structure

export interface MedusaCustomer {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  company_name: string | null
  has_account: boolean
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  billing_address_id: string | null
  shipping_addresses?: MedusaAddress[]
  billing_address?: MedusaAddress
  orders?: unknown[]
  groups?: MedusaCustomerGroup[]
}

export interface MedusaAddress {
  id: string
  customer_id: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  company: string | null
  address_1: string | null
  address_2: string | null
  city: string | null
  country_code: string | null
  province: string | null
  postal_code: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface MedusaCustomerGroup {
  id: string
  name: string
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// API Request/Response types
export interface CreateMedusaCustomerRequest {
  email: string
  first_name?: string
  last_name?: string
  phone?: string
  company_name?: string
  password?: string
  metadata?: Record<string, unknown>
}

export interface UpdateMedusaCustomerRequest {
  email?: string
  first_name?: string
  last_name?: string
  phone?: string
  company_name?: string
  metadata?: Record<string, unknown>
  billing_address?: CreateMedusaAddressRequest
}

export interface CreateMedusaAddressRequest {
  first_name?: string
  last_name?: string
  phone?: string
  company?: string
  address_1: string
  address_2?: string
  city: string
  country_code: string
  province?: string
  postal_code: string
  metadata?: Record<string, unknown>
}

export interface MedusaCustomerResponse {
  customer: MedusaCustomer
}

export interface MedusaCustomersResponse {
  customers: MedusaCustomer[]
  count: number
  offset: number
  limit: number
}

export interface MedusaAddressResponse {
  address: MedusaAddress
}

// Client to MedusaJS mapping types
export interface ClientCustomerMapping {
  clientId: string
  medusaCustomerId: string
  organizationId: string
  syncStatus: 'pending' | 'synced' | 'error' | 'conflict'
  lastSyncAt: string | null
  syncError: string | null
  createdAt: string
  updatedAt: string
}

export interface CustomerSyncResult {
  success: boolean
  medusaCustomerId?: string
  error?: string
  conflicts?: string[]
  addressesSynced?: number
}

// B2B specific metadata structure for MedusaJS customers
export interface ClientMetadata extends Record<string, unknown> {
  organizationId: string
  organizationSubdomain: string
  clientId: string
  businessType?: string
  taxId?: string
  industry?: string
  paymentTerms?: string
  creditLimit?: number
  preferredCurrency?: string
  notes?: string
  b2bCustomer: true // Flag to identify B2B customers
}

// Utility types for data transformation
export interface AddressMapping {
  billing: CreateMedusaAddressRequest | null
  shipping: CreateMedusaAddressRequest | null
}

export interface CustomerSyncOptions {
  createIfNotExists?: boolean
  updateExisting?: boolean
  syncAddresses?: boolean
  skipConflictCheck?: boolean
}

export interface CustomerSyncError {
  type: 'api_error' | 'validation_error' | 'conflict_error' | 'network_error'
  message: string
  details?: unknown
  retryable: boolean
}

// Response types for our internal APIs
export interface ClientSyncResponse {
  success: boolean
  medusaCustomerId?: string
  syncStatus: ClientCustomerMapping['syncStatus']
  error?: string
  lastSyncAt?: string
}

export interface BulkSyncResponse {
  totalClients: number
  successfulSyncs: number
  failedSyncs: number
  errors: Array<{
    clientId: string
    error: string
  }>
}