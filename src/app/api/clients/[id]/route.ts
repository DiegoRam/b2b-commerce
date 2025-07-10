import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { MedusaCustomerService } from '@/lib/medusa-customer-service'
import type { ClientUpdate } from '@/types'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    const { id } = await params
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createSupabaseServerClient()
    
    // Get organization ID from subdomain
    const url = new URL(request.url)
    const host = request.headers.get('host') || url.host
    const subdomain = host.split('.')[0]
    
    if (subdomain === 'localhost' || subdomain === host) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 })
    }

    // Get organization by subdomain
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('subdomain', subdomain)
      .eq('is_active', true)
      .single()

    if (orgError || !organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Verify user has access to this organization
    const { data: membership } = await supabase
      .from('organization_memberships')
      .select('role')
      .eq('organization_id', organization.id)
      .eq('user_id', (await supabase
        .from('users')
        .select('id')
        .eq('clerk_user_id', userId)
        .single()
      ).data?.id)
      .eq('is_active', true)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Fetch client with contacts
    const { data: client, error } = await supabase
      .from('clients')
      .select(`
        id,
        organization_id,
        medusa_customer_id,
        company_name,
        contact_name,
        contact_email,
        contact_phone,
        tax_id,
        business_type,
        industry,
        billing_address_line1,
        billing_address_line2,
        billing_city,
        billing_state,
        billing_postal_code,
        billing_country,
        shipping_address_line1,
        shipping_address_line2,
        shipping_city,
        shipping_state,
        shipping_postal_code,
        shipping_country,
        payment_terms,
        credit_limit,
        preferred_currency,
        notes,
        is_active,
        created_by,
        created_at,
        updated_at,
        creator:users!clients_created_by_fkey (
          first_name,
          last_name,
          email
        ),
        client_contacts (
          id,
          name,
          email,
          phone,
          title,
          department,
          is_primary,
          is_active
        )
      `)
      .eq('id', id)
      .eq('organization_id', organization.id)
      .single()

    if (error || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    return NextResponse.json({ client })
  } catch (error) {
    console.error('Error in client GET API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    const { id } = await params
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      company_name,
      contact_name,
      contact_email,
      contact_phone,
      tax_id,
      business_type,
      industry,
      billing_address_line1,
      billing_address_line2,
      billing_city,
      billing_state,
      billing_postal_code,
      billing_country,
      shipping_address_line1,
      shipping_address_line2,
      shipping_city,
      shipping_state,
      shipping_postal_code,
      shipping_country,
      payment_terms,
      credit_limit,
      preferred_currency,
      notes,
      is_active
    } = body

    const supabase = await createSupabaseServerClient()
    
    // Get organization ID from subdomain
    const url = new URL(request.url)
    const host = request.headers.get('host') || url.host
    const subdomain = host.split('.')[0]
    
    if (subdomain === 'localhost' || subdomain === host) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 })
    }

    // Get organization by subdomain
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('subdomain', subdomain)
      .eq('is_active', true)
      .single()

    if (orgError || !organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get current user
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_user_id', userId)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify user has permission to manage clients (admin or manager)
    const { data: membership } = await supabase
      .from('organization_memberships')
      .select('role')
      .eq('organization_id', organization.id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!membership || !['admin', 'manager'].includes(membership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Verify client exists and belongs to organization
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id, company_name, contact_email')
      .eq('id', id)
      .eq('organization_id', organization.id)
      .single()

    if (!existingClient) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Check for conflicts with other clients (only if values changed)
    if (company_name && company_name !== existingClient.company_name) {
      const { data: companyConflict } = await supabase
        .from('clients')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('company_name', company_name)
        .neq('id', id)
        .single()

      if (companyConflict) {
        return NextResponse.json({ 
          error: 'A client with this company name already exists' 
        }, { status: 400 })
      }
    }

    if (contact_email && contact_email !== existingClient.contact_email) {
      const { data: emailConflict } = await supabase
        .from('clients')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('contact_email', contact_email)
        .neq('id', id)
        .single()

      if (emailConflict) {
        return NextResponse.json({ 
          error: 'A client with this contact email already exists' 
        }, { status: 400 })
      }
    }

    // Prepare update data (only include fields that are provided)
    const updateData: ClientUpdate = {}
    
    if (company_name !== undefined) updateData.company_name = company_name
    if (contact_name !== undefined) updateData.contact_name = contact_name
    if (contact_email !== undefined) updateData.contact_email = contact_email
    if (contact_phone !== undefined) updateData.contact_phone = contact_phone
    if (tax_id !== undefined) updateData.tax_id = tax_id
    if (business_type !== undefined) updateData.business_type = business_type
    if (industry !== undefined) updateData.industry = industry
    if (billing_address_line1 !== undefined) updateData.billing_address_line1 = billing_address_line1
    if (billing_address_line2 !== undefined) updateData.billing_address_line2 = billing_address_line2
    if (billing_city !== undefined) updateData.billing_city = billing_city
    if (billing_state !== undefined) updateData.billing_state = billing_state
    if (billing_postal_code !== undefined) updateData.billing_postal_code = billing_postal_code
    if (billing_country !== undefined) updateData.billing_country = billing_country
    if (shipping_address_line1 !== undefined) updateData.shipping_address_line1 = shipping_address_line1
    if (shipping_address_line2 !== undefined) updateData.shipping_address_line2 = shipping_address_line2
    if (shipping_city !== undefined) updateData.shipping_city = shipping_city
    if (shipping_state !== undefined) updateData.shipping_state = shipping_state
    if (shipping_postal_code !== undefined) updateData.shipping_postal_code = shipping_postal_code
    if (shipping_country !== undefined) updateData.shipping_country = shipping_country
    if (payment_terms !== undefined) updateData.payment_terms = payment_terms
    if (credit_limit !== undefined) updateData.credit_limit = credit_limit
    if (preferred_currency !== undefined) updateData.preferred_currency = preferred_currency
    if (notes !== undefined) updateData.notes = notes
    if (is_active !== undefined) updateData.is_active = is_active

    // Update client
    const { data: client, error: updateError } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', organization.id)
      .select(`
        id,
        organization_id,
        medusa_customer_id,
        company_name,
        contact_name,
        contact_email,
        contact_phone,
        tax_id,
        business_type,
        industry,
        billing_address_line1,
        billing_address_line2,
        billing_city,
        billing_state,
        billing_postal_code,
        billing_country,
        shipping_address_line1,
        shipping_address_line2,
        shipping_city,
        shipping_state,
        shipping_postal_code,
        shipping_country,
        payment_terms,
        credit_limit,
        preferred_currency,
        notes,
        is_active,
        created_by,
        created_at,
        updated_at,
        creator:users!clients_created_by_fkey (
          first_name,
          last_name,
          email
        ),
        client_contacts (
          id,
          name,
          email,
          phone,
          title,
          department,
          is_primary,
          is_active
        )
      `)
      .single()

    if (updateError) {
      console.error('Error updating client:', updateError)
      return NextResponse.json({ error: 'Failed to update client' }, { status: 500 })
    }

    // Sync with MedusaJS customer
    try {
      const syncResult = await MedusaCustomerService.syncClient(
        client, 
        subdomain,
        { syncAddresses: true, createIfNotExists: true }
      )
      
      if (!syncResult.success) {
        console.warn('MedusaJS customer sync failed:', syncResult.error)
        // Don't fail the client update, just log the warning
      }
    } catch (syncError) {
      console.error('Error syncing with MedusaJS:', syncError)
      // Continue without failing the client update
    }

    return NextResponse.json({ client })
  } catch (error) {
    console.error('Error in client PUT API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    const { id } = await params
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createSupabaseServerClient()
    
    // Get organization ID from subdomain
    const url = new URL(request.url)
    const host = request.headers.get('host') || url.host
    const subdomain = host.split('.')[0]
    
    if (subdomain === 'localhost' || subdomain === host) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 })
    }

    // Get organization by subdomain
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('subdomain', subdomain)
      .eq('is_active', true)
      .single()

    if (orgError || !organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get current user
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_user_id', userId)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify user has permission to manage clients (admin only for deletion)
    const { data: membership } = await supabase
      .from('organization_memberships')
      .select('role')
      .eq('organization_id', organization.id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({ error: 'Admin permissions required' }, { status: 403 })
    }

    // Check if client has active orders or carts
    const { data: activeOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('client_id', id)
      .in('status', ['pending', 'confirmed', 'shipped'])
      .limit(1)

    if (activeOrders && activeOrders.length > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete client with active orders. Please complete or cancel orders first.' 
      }, { status: 400 })
    }

    const { data: activeCarts } = await supabase
      .from('carts')
      .select('id')
      .eq('client_id', id)
      .eq('status', 'active')
      .limit(1)

    if (activeCarts && activeCarts.length > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete client with active carts. Please complete or abandon carts first.' 
      }, { status: 400 })
    }

    // Soft delete (mark as inactive) instead of hard delete
    const { data: client, error: deleteError } = await supabase
      .from('clients')
      .update({ is_active: false })
      .eq('id', id)
      .eq('organization_id', organization.id)
      .select('id, company_name')
      .single()

    if (deleteError || !client) {
      return NextResponse.json({ error: 'Client not found or failed to delete' }, { status: 404 })
    }

    // Also deactivate client contacts
    await supabase
      .from('client_contacts')
      .update({ is_active: false })
      .eq('client_id', id)

    // Delete MedusaJS customer
    try {
      await MedusaCustomerService.deleteCustomer(id)
    } catch (syncError) {
      console.error('Error deleting MedusaJS customer:', syncError)
      // Continue without failing the client deletion
    }

    return NextResponse.json({ 
      message: 'Client deactivated successfully',
      client: { id: client.id, company_name: client.company_name }
    })
  } catch (error) {
    console.error('Error in client DELETE API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}