import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { MedusaCustomerService } from '@/lib/medusa-customer-service'
import type { ClientInsert } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createSupabaseServerClient()
    
    // Get organization ID from subdomain
    const url = new URL(request.url)
    const host = request.headers.get('host') || url.host
    const subdomain = host.split('.')[0]
    
    // If no subdomain (localhost), return error - clients should be organization-specific
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

    // Get pagination parameters
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    // Get search parameters
    const search = url.searchParams.get('search') || ''
    const isActive = url.searchParams.get('is_active')

    // Build query
    let query = supabase
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
        billing_city,
        billing_state,
        billing_postal_code,
        billing_country,
        payment_terms,
        credit_limit,
        preferred_currency,
        is_active,
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
          is_primary
        )
      `)
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: false })

    // Apply filters
    if (search) {
      query = query.or(`company_name.ilike.%${search}%,contact_name.ilike.%${search}%,contact_email.ilike.%${search}%`)
    }

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true')
    }

    // Get total count for pagination
    const { count } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organization.id)

    // Apply pagination
    const { data: clients, error } = await query
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching clients:', error)
      return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
    }

    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({ 
      clients,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: totalPages
      }
    })
  } catch (error) {
    console.error('Error in clients API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    
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
      notes
    } = body

    // Validate required fields
    if (!company_name || !contact_name || !contact_email) {
      return NextResponse.json({ 
        error: 'Company name, contact name, and contact email are required' 
      }, { status: 400 })
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

    // Check if client with same company name or contact email already exists
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id, company_name, contact_email')
      .eq('organization_id', organization.id)
      .or(`company_name.eq.${company_name},contact_email.eq.${contact_email}`)
      .single()

    if (existingClient) {
      if (existingClient.company_name === company_name) {
        return NextResponse.json({ 
          error: 'A client with this company name already exists' 
        }, { status: 400 })
      }
      if (existingClient.contact_email === contact_email) {
        return NextResponse.json({ 
          error: 'A client with this contact email already exists' 
        }, { status: 400 })
      }
    }

    // Create client data
    const clientData: ClientInsert = {
      organization_id: organization.id,
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
      billing_country: billing_country || 'US',
      shipping_address_line1,
      shipping_address_line2,
      shipping_city,
      shipping_state,
      shipping_postal_code,
      shipping_country: shipping_country || 'US',
      payment_terms: payment_terms || 'net_30',
      credit_limit: credit_limit || 0,
      preferred_currency: preferred_currency || 'USD',
      notes,
      created_by: user.id
    }

    // Create client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .insert(clientData)
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
        )
      `)
      .single()

    if (clientError) {
      console.error('Error creating client:', clientError)
      return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
    }

    // Sync with MedusaJS customer
    try {
      const syncResult = await MedusaCustomerService.createCustomer(
        client, 
        subdomain,
        { syncAddresses: true }
      )
      
      if (!syncResult.success) {
        console.warn('MedusaJS customer sync failed:', syncResult.error)
        // Don't fail the client creation, just log the warning
      }
    } catch (syncError) {
      console.error('Error syncing with MedusaJS:', syncError)
      // Continue without failing the client creation
    }

    return NextResponse.json({ client }, { status: 201 })
  } catch (error) {
    console.error('Error in clients POST API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}