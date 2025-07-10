import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import type { CartUpdate } from '@/types'

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

    // Fetch cart with detailed information
    const { data: cart, error } = await supabase
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
        session_id,
        expires_at,
        created_at,
        updated_at,
        client:clients (
          id,
          company_name,
          contact_name,
          contact_email,
          contact_phone
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
          medusa_line_item_id,
          quantity,
          unit_price,
          total_price,
          product_name,
          product_sku,
          product_description,
          created_at,
          updated_at,
          products (
            id,
            name,
            sku,
            price,
            stock_quantity,
            is_active
          )
        )
      `)
      .eq('id', id)
      .eq('organization_id', organization.id)
      .single()

    if (error || !cart) {
      return NextResponse.json({ error: 'Cart not found' }, { status: 404 })
    }

    // Check if user has access to this cart (own cart or admin/manager)
    const hasAccess = cart.user_id === user.id || ['admin', 'manager'].includes(membership.role)
    
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied to this cart' }, { status: 403 })
    }

    return NextResponse.json({ cart })
  } catch (error) {
    console.error('Error in cart GET API:', error)
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
    const { currency, expires_at } = body

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

    // Check if cart exists and user has access
    const { data: existingCart } = await supabase
      .from('carts')
      .select('user_id, status')
      .eq('id', id)
      .eq('organization_id', organization.id)
      .single()

    if (!existingCart) {
      return NextResponse.json({ error: 'Cart not found' }, { status: 404 })
    }

    // Check access (own cart or admin/manager)
    const hasAccess = existingCart.user_id === user.id || ['admin', 'manager'].includes(membership.role)
    
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied to this cart' }, { status: 403 })
    }

    // Can't update completed or abandoned carts
    if (existingCart.status !== 'active') {
      return NextResponse.json({ error: 'Cannot update inactive cart' }, { status: 400 })
    }

    // Prepare update data
    const updateData: CartUpdate = {}
    
    if (currency !== undefined) updateData.currency = currency
    if (expires_at !== undefined) updateData.expires_at = expires_at

    // Update cart
    const { data: cart, error: updateError } = await supabase
      .from('carts')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', organization.id)
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
        session_id,
        expires_at,
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
        )
      `)
      .single()

    if (updateError) {
      console.error('Error updating cart:', updateError)
      return NextResponse.json({ error: 'Failed to update cart' }, { status: 500 })
    }

    // TODO: Sync with MedusaJS cart when cart integration is implemented

    return NextResponse.json({ cart })
  } catch (error) {
    console.error('Error in cart PUT API:', error)
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

    // Check if cart exists and user has access
    const { data: existingCart } = await supabase
      .from('carts')
      .select('user_id, status, client_id')
      .eq('id', id)
      .eq('organization_id', organization.id)
      .single()

    if (!existingCart) {
      return NextResponse.json({ error: 'Cart not found' }, { status: 404 })
    }

    // Check access (own cart or admin/manager)
    const hasAccess = existingCart.user_id === user.id || ['admin', 'manager'].includes(membership.role)
    
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied to this cart' }, { status: 403 })
    }

    // Mark cart as abandoned instead of hard delete
    const { data: cart, error: deleteError } = await supabase
      .from('carts')
      .update({ status: 'abandoned' })
      .eq('id', id)
      .eq('organization_id', organization.id)
      .select('id, client_id, status')
      .single()

    if (deleteError || !cart) {
      return NextResponse.json({ error: 'Cart not found or failed to abandon' }, { status: 404 })
    }

    // TODO: Sync with MedusaJS cart when cart integration is implemented

    return NextResponse.json({ 
      message: 'Cart abandoned successfully',
      cart: { id: cart.id, client_id: cart.client_id, status: cart.status }
    })
  } catch (error) {
    console.error('Error in cart DELETE API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}