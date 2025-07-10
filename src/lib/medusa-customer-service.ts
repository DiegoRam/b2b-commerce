import { getMedusaAdminClient } from './medusa-client'
import { createSupabaseServerClient } from './supabase'
import type { Client } from '@/types'
import type {
  MedusaCustomer,
  CreateMedusaCustomerRequest,
  UpdateMedusaCustomerRequest,
  CreateMedusaAddressRequest,
  CustomerSyncResult,
  ClientMetadata,
  AddressMapping,
  CustomerSyncOptions,
  CustomerSyncError,
} from '@/types/medusa-customer'

export class MedusaCustomerService {
  /**
   * Parse contact name into first and last name
   */
  private static parseContactName(contactName: string): { first_name: string; last_name: string } {
    const nameParts = contactName.trim().split(' ')
    if (nameParts.length === 1) {
      return { first_name: nameParts[0], last_name: '' }
    }
    
    const firstName = nameParts[0]
    const lastName = nameParts.slice(1).join(' ')
    return { first_name: firstName, last_name: lastName }
  }

  /**
   * Create address mapping from client data
   */
  private static createAddressMapping(client: Client): AddressMapping {
    const { first_name, last_name } = this.parseContactName(client.contact_name)
    
    const billing: CreateMedusaAddressRequest | null = client.billing_address_line1 ? {
      first_name,
      last_name,
      phone: client.contact_phone || undefined,
      company: client.company_name,
      address_1: client.billing_address_line1,
      address_2: client.billing_address_line2 || undefined,
      city: client.billing_city || '',
      country_code: client.billing_country?.toLowerCase() || 'us',
      province: client.billing_state || undefined,
      postal_code: client.billing_postal_code || '',
      metadata: {
        addressType: 'billing',
        clientId: client.id
      }
    } : null

    const shipping: CreateMedusaAddressRequest | null = client.shipping_address_line1 ? {
      first_name,
      last_name,
      phone: client.contact_phone || undefined,
      company: client.company_name,
      address_1: client.shipping_address_line1,
      address_2: client.shipping_address_line2 || undefined,
      city: client.shipping_city || '',
      country_code: client.shipping_country?.toLowerCase() || 'us',
      province: client.shipping_state || undefined,
      postal_code: client.shipping_postal_code || '',
      metadata: {
        addressType: 'shipping',
        clientId: client.id
      }
    } : null

    return { billing, shipping }
  }

  /**
   * Create B2B metadata object from client data
   */
  private static createClientMetadata(client: Client, organizationSubdomain: string): ClientMetadata {
    return {
      organizationId: client.organization_id,
      organizationSubdomain,
      clientId: client.id,
      businessType: client.business_type || undefined,
      taxId: client.tax_id || undefined,
      industry: client.industry || undefined,
      paymentTerms: client.payment_terms || undefined,
      creditLimit: client.credit_limit || undefined,
      preferredCurrency: client.preferred_currency || undefined,
      notes: client.notes || undefined,
      b2bCustomer: true
    }
  }

  /**
   * Create a new MedusaJS customer from client data
   */
  static async createCustomer(
    client: Client, 
    organizationSubdomain: string,
    options: CustomerSyncOptions = {}
  ): Promise<CustomerSyncResult> {
    try {
      const adminClient = getMedusaAdminClient()
      const { first_name, last_name } = this.parseContactName(client.contact_name)
      const metadata = this.createClientMetadata(client, organizationSubdomain)

      // Check if customer already exists by email
      try {
        const { customers } = await adminClient.admin.customer.list({
          email: client.contact_email
        })

        if (customers && customers.length > 0) {
          const existingCustomer = customers[0] as unknown as unknown as MedusaCustomer
          
          // Check if this is already our B2B customer
          if (existingCustomer.metadata?.b2bCustomer && existingCustomer.metadata?.clientId === client.id) {
            return {
              success: true,
              medusaCustomerId: existingCustomer.id
            }
          }

          // If it's a different customer with same email, handle conflict
          if (!options.skipConflictCheck) {
            return {
              success: false,
              error: 'Customer with this email already exists in MedusaJS',
              conflicts: [`Email: ${client.contact_email}`]
            }
          }
        }
      } catch (error) {
        // Continue if customer lookup fails
        console.warn('Customer lookup failed, proceeding with creation:', error)
      }

      // Create customer request
      const customerData: CreateMedusaCustomerRequest = {
        email: client.contact_email,
        first_name,
        last_name,
        phone: client.contact_phone || undefined,
        company_name: client.company_name,
        metadata
      }

      // Create customer
      const { customer } = await adminClient.admin.customer.create(customerData)
      const medusaCustomer = customer as unknown as MedusaCustomer

      const addressesSynced = 0

      // TODO: Address sync will be implemented in next phase
      // For now, we'll focus on basic customer creation
      if (options.syncAddresses !== false) {
        console.log('Address sync will be implemented in next phase')
      }

      // Update client with MedusaJS customer ID
      const supabase = await createSupabaseServerClient()
      await supabase
        .from('clients')
        .update({ medusa_customer_id: medusaCustomer.id })
        .eq('id', client.id)

      return {
        success: true,
        medusaCustomerId: medusaCustomer.id,
        addressesSynced
      }
    } catch (error) {
      console.error('Error creating MedusaJS customer:', error)
      
      const syncError: CustomerSyncError = {
        type: 'api_error',
        message: error instanceof Error ? error.message : 'Unknown error creating customer',
        details: error,
        retryable: true
      }

      return {
        success: false,
        error: syncError.message
      }
    }
  }

  /**
   * Update existing MedusaJS customer
   */
  static async updateCustomer(
    client: Client,
    organizationSubdomain: string,
    options: CustomerSyncOptions = {}
  ): Promise<CustomerSyncResult> {
    try {
      if (!client.medusa_customer_id) {
        // Create customer if it doesn't exist
        if (options.createIfNotExists) {
          return this.createCustomer(client, organizationSubdomain, options)
        }
        return {
          success: false,
          error: 'Client is not linked to a MedusaJS customer'
        }
      }

      const adminClient = getMedusaAdminClient()
      const { first_name, last_name } = this.parseContactName(client.contact_name)
      const metadata = this.createClientMetadata(client, organizationSubdomain)

      // Update customer data
      const updateData: UpdateMedusaCustomerRequest = {
        email: client.contact_email,
        first_name,
        last_name,
        phone: client.contact_phone || undefined,
        company_name: client.company_name,
        metadata
      }

      const { customer } = await adminClient.admin.customer.update(client.medusa_customer_id, updateData)
      const medusaCustomer = customer as unknown as MedusaCustomer

      const addressesSynced = 0

      // TODO: Address sync will be implemented in next phase
      if (options.syncAddresses !== false) {
        console.log('Address sync will be implemented in next phase')
      }

      return {
        success: true,
        medusaCustomerId: medusaCustomer.id,
        addressesSynced
      }
    } catch (error) {
      console.error('Error updating MedusaJS customer:', error)
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error updating customer'
      }
    }
  }

  /**
   * Sync customer addresses
   * TODO: Will be implemented in next phase once MedusaJS API structure is clarified
   */
  private static async syncCustomerAddresses(client: Client, medusaCustomerId: string): Promise<number> {
    console.log('Address sync will be implemented in next phase', { client: client.id, medusaCustomerId })
    return 0
  }

  /**
   * Get MedusaJS customer by client ID
   */
  static async getCustomer(clientId: string): Promise<MedusaCustomer | null> {
    try {
      const supabase = await createSupabaseServerClient()
      
      // Get client with MedusaJS customer ID
      const { data: client } = await supabase
        .from('clients')
        .select('medusa_customer_id')
        .eq('id', clientId)
        .single()

      if (!client?.medusa_customer_id) {
        return null
      }

      const adminClient = getMedusaAdminClient()
      const { customer } = await adminClient.admin.customer.retrieve(client.medusa_customer_id)

      return customer as unknown as MedusaCustomer
    } catch (error) {
      console.error('Error fetching MedusaJS customer:', error)
      return null
    }
  }

  /**
   * Delete MedusaJS customer
   */
  static async deleteCustomer(clientId: string): Promise<boolean> {
    try {
      const supabase = await createSupabaseServerClient()
      
      // Get client with MedusaJS customer ID
      const { data: client } = await supabase
        .from('clients')
        .select('medusa_customer_id')
        .eq('id', clientId)
        .single()

      if (!client?.medusa_customer_id) {
        return true // Already deleted or never existed
      }

      const adminClient = getMedusaAdminClient()
      await adminClient.admin.customer.delete(client.medusa_customer_id)

      // Clear MedusaJS customer ID from client
      await supabase
        .from('clients')
        .update({ medusa_customer_id: null })
        .eq('id', clientId)

      return true
    } catch (error) {
      console.error('Error deleting MedusaJS customer:', error)
      return false
    }
  }

  /**
   * Full sync client with MedusaJS customer
   */
  static async syncClient(
    client: Client,
    organizationSubdomain: string,
    options: CustomerSyncOptions = { syncAddresses: true }
  ): Promise<CustomerSyncResult> {
    if (client.medusa_customer_id) {
      return this.updateCustomer(client, organizationSubdomain, options)
    } else {
      return this.createCustomer(client, organizationSubdomain, options)
    }
  }

  /**
   * Validate MedusaJS connection
   */
  static async validateConnection(): Promise<boolean> {
    try {
      const adminClient = getMedusaAdminClient()
      await adminClient.admin.customer.list({ limit: 1 })
      return true
    } catch (error) {
      console.error('MedusaJS connection validation failed:', error)
      return false
    }
  }
}