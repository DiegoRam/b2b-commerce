import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import type { CartInsert } from '@/types'

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

    // Verify user has access to this organization
    const { data: membership } = await supabase
      .from('organization_memberships')
      .select('role')
      .eq('organization_id', organization.id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get query parameters
    const clientId = url.searchParams.get('client_id')
    const status = url.searchParams.get('status') || 'active'

    // Build query for carts
    let query = supabase
      .from('carts')
      .select(`
        id,
        organization_id,
        client_id,
        user_id,
        medusa_cart_id,
        status,
        currency,
        total_amount,
        item_count,
        created_at,
        updated_at,
        client:clients (
          id,
          company_name,
          contact_name,
          contact_email
        ),
        user:users (
          id,
          first_name,
          last_name,
          email
        ),
        cart_items (
          id,
          product_id,
          quantity,
          unit_price,
          total_price,
          product_name,
          product_sku,
          product:products (
            id,
            name,
            sku,
            price,
            stock_quantity
          )
        )
      `)
      .eq('organization_id', organization.id)
      .eq('status', status)
      .order('updated_at', { ascending: false })

    // Filter by client if specified
    if (clientId) {
      query = query.eq('client_id', clientId)
    }

    // Filter by current user's carts only (users can only see their own carts)
    query = query.eq('user_id', user.id)

    const { data: carts, error } = await query

    if (error) {
      console.error('Error fetching carts:', error)
      return NextResponse.json({ error: 'Failed to fetch carts' }, { status: 500 })
    }

    return NextResponse.json({ carts })
  } catch (error) {
    console.error('Error in carts API:', error)
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
    const { client_id, currency } = body

    // Validate required fields
    if (!client_id) {
      return NextResponse.json({ 
        error: 'Client ID is required' 
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

    // Verify user has access to this organization
    const { data: membership } = await supabase
      .from('organization_memberships')
      .select('role')
      .eq('organization_id', organization.id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Verify client exists and belongs to organization
    const { data: client } = await supabase
      .from('clients')
      .select('id, company_name, contact_name, contact_email')
      .eq('id', client_id)
      .eq('organization_id', organization.id)
      .eq('is_active', true)
      .single()

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Check if user already has an active cart for this client
    const { data: existingCart } = await supabase
      .from('carts')
      .select('id')
      .eq('organization_id', organization.id)
      .eq('client_id', client_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (existingCart) {
      // Return existing active cart instead of creating a new one
      const { data: cart, error: fetchError } = await supabase
        .from('carts')
        .select(`
          id,
          organization_id,
          client_id,
          user_id,
          medusa_cart_id,
          status,
          currency,
          total_amount,
          item_count,
          created_at,
          updated_at,
          client:clients (
            id,
            company_name,
            contact_name,
            contact_email
          ),
          user:users (
            id,
            first_name,
            last_name,
            email
          ),
          cart_items (
            id,
            product_id,
            quantity,
            unit_price,
            total_price,
            product_name,
            product_sku,
            product:products (
              id,
              name,
              sku,
              price,
              stock_quantity
            )
          )
        `)
        .eq('id', existingCart.id)
        .single()

      if (fetchError) {
        console.error('Error fetching existing cart:', fetchError)
        return NextResponse.json({ error: 'Failed to fetch existing cart' }, { status: 500 })
      }

      return NextResponse.json({ cart, message: 'Existing active cart returned' })
    }

    // Create new cart
    const cartData: CartInsert = {
      organization_id: organization.id,
      client_id,
      user_id: user.id,
      status: 'active',
      currency: currency || 'USD',
      total_amount: 0,
      item_count: 0,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
    }

    const { data: cart, error: cartError } = await supabase
      .from('carts')
      .insert(cartData)
      .select(`
        id,
        organization_id,
        client_id,
        user_id,
        medusa_cart_id,
        status,
        currency,
        total_amount,
        item_count,
        created_at,
        updated_at,
        client:clients (
          id,
          company_name,
          contact_name,
          contact_email
        ),
        user:users (
          id,
          first_name,
          last_name,
          email
        ),
        cart_items (
          id,
          product_id,
          quantity,
          unit_price,
          total_price,
          product_name,
          product_sku
        )
      `)
      .single()

    if (cartError) {
      console.error('Error creating cart:', cartError)
      return NextResponse.json({ error: 'Failed to create cart' }, { status: 500 })
    }

    // TODO: Create corresponding MedusaJS cart when MedusaJS integration is extended

    return NextResponse.json({ cart }, { status: 201 })
  } catch (error) {
    console.error('Error in carts POST API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}