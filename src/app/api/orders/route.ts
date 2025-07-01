import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createSupabaseServerClient } from '@/lib/supabase'

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
    
    // If no subdomain (localhost), return error - orders should be organization-specific
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
      .select('id')
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

    // Fetch orders for this organization with order items
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        customer_name,
        customer_email,
        total_amount,
        status,
        created_at,
        updated_at,
        created_by,
        creator:users!orders_created_by_fkey (
          first_name,
          last_name,
          email
        ),
        order_items (
          id,
          quantity,
          unit_price,
          total_price,
          product:products (
            id,
            name,
            sku
          )
        )
      `)
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching orders:', error)
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    return NextResponse.json({ orders })
  } catch (error) {
    console.error('Error in orders API:', error)
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
    const { customer_name, customer_email, items } = body

    // Validate required fields
    if (!customer_name || !customer_email || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ 
        error: 'Customer name, email, and items are required' 
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

    // Calculate total amount and validate products
    let total_amount = 0
    const validatedItems = []

    for (const item of items) {
      if (!item.product_id || !item.quantity || item.quantity <= 0) {
        return NextResponse.json({ 
          error: 'Each item must have product_id and valid quantity' 
        }, { status: 400 })
      }

      // Get product and verify it belongs to this organization
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, name, price, stock_quantity')
        .eq('id', item.product_id)
        .eq('organization_id', organization.id)
        .eq('is_active', true)
        .single()

      if (productError || !product) {
        return NextResponse.json({ 
          error: `Product ${item.product_id} not found or not available` 
        }, { status: 400 })
      }

      // Check stock availability
      if (product.stock_quantity < item.quantity) {
        return NextResponse.json({ 
          error: `Insufficient stock for product ${product.name}. Available: ${product.stock_quantity}` 
        }, { status: 400 })
      }

      const unit_price = product.price
      const total_price = unit_price * item.quantity
      total_amount += total_price

      validatedItems.push({
        product_id: product.id,
        quantity: item.quantity,
        unit_price,
        total_price
      })
    }

    // Create order in a transaction
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        organization_id: organization.id,
        customer_name,
        customer_email,
        total_amount,
        status: 'pending',
        created_by: user.id
      })
      .select('id')
      .single()

    if (orderError) {
      console.error('Error creating order:', orderError)
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
    }

    // Create order items
    const orderItemsData = validatedItems.map(item => ({
      order_id: order.id,
      ...item
    }))

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsData)

    if (itemsError) {
      console.error('Error creating order items:', itemsError)
      // Clean up the order if items creation failed
      await supabase.from('orders').delete().eq('id', order.id)
      return NextResponse.json({ error: 'Failed to create order items' }, { status: 500 })
    }

    // Update product stock quantities
    for (const item of validatedItems) {
      await supabase
        .from('products')
        .update({
          stock_quantity: supabase.rpc('decrease_stock', {
            product_id: item.product_id,
            quantity: item.quantity
          })
        })
        .eq('id', item.product_id)
    }

    // Fetch the complete order with items
    const { data: completeOrder, error: fetchError } = await supabase
      .from('orders')
      .select(`
        id,
        customer_name,
        customer_email,
        total_amount,
        status,
        created_at,
        updated_at,
        created_by,
        creator:users!orders_created_by_fkey (
          first_name,
          last_name,
          email
        ),
        order_items (
          id,
          quantity,
          unit_price,
          total_price,
          product:products (
            id,
            name,
            sku
          )
        )
      `)
      .eq('id', order.id)
      .single()

    if (fetchError) {
      console.error('Error fetching created order:', fetchError)
      return NextResponse.json({ error: 'Order created but failed to fetch details' }, { status: 500 })
    }

    return NextResponse.json({ order: completeOrder }, { status: 201 })
  } catch (error) {
    console.error('Error in orders POST API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}