import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { MedusaCartService } from '@/lib/medusa-cart-service'
import type { OrderInsert, OrderItemInsert } from '@/types'

// Type for cart item product data from Supabase join
type CartItemProduct = {
  id: string
  name: string
  sku: string
  price: number
  stock_quantity: number
  is_active: boolean
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    const { id: cartId } = await params
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      // billing_address, 
      // shipping_address, 
      // notes,
      // payment_method = 'pending' // For B2B, payment might be processed later
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

    // Get cart with items and verify access
    const { data: cart, error: cartError } = await supabase
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
        client:clients (
          id,
          company_name,
          contact_name,
          contact_email,
          contact_phone
        ),
        cart_items (
          id,
          product_id,
          quantity,
          unit_price,
          total_price,
          product_name,
          product_sku,
          product_description,
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
      .eq('id', cartId)
      .eq('organization_id', organization.id)
      .single()

    if (cartError || !cart) {
      return NextResponse.json({ error: 'Cart not found' }, { status: 404 })
    }

    // Check access (own cart or admin/manager)
    const hasAccess = cart.user_id === user.id || ['admin', 'manager'].includes(membership.role)
    
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied to this cart' }, { status: 403 })
    }

    // Validate cart status
    if (cart.status !== 'active') {
      return NextResponse.json({ error: 'Cannot checkout inactive cart' }, { status: 400 })
    }

    // Validate cart has items
    if (!cart.cart_items || cart.cart_items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    }

    // Validate cart has valid total
    if (cart.total_amount <= 0) {
      return NextResponse.json({ error: 'Cart total must be greater than zero' }, { status: 400 })
    }

    // Validate inventory for all items
    const inventoryErrors: string[] = []
    for (const item of cart.cart_items) {
      // Access product data from join (it's an array, so get first element)
      const productArray = item.products as unknown[]
      const cartItemProduct = productArray?.[0] as CartItemProduct
      
      if (!cartItemProduct || !cartItemProduct.is_active) {
        inventoryErrors.push(`Product ${item.product_name} is no longer available`)
        continue
      }

      if (cartItemProduct.stock_quantity < item.quantity) {
        inventoryErrors.push(
          `Insufficient stock for ${item.product_name}. Available: ${cartItemProduct.stock_quantity}, Requested: ${item.quantity}`
        )
      }
    }

    if (inventoryErrors.length > 0) {
      return NextResponse.json({ 
        error: 'Inventory validation failed',
        details: inventoryErrors
      }, { status: 400 })
    }

    // Begin transaction for checkout process
    try {
      // Create order
      const clientArray = cart.client as unknown[]
      const clientData = clientArray?.[0] as { company_name?: string; contact_name?: string; contact_email?: string }
      
      const orderData: OrderInsert = {
        organization_id: organization.id,
        client_id: cart.client_id,
        customer_name: clientData?.company_name || clientData?.contact_name || 'Unknown Client',
        customer_email: clientData?.contact_email || '',
        total_amount: cart.total_amount,
        status: 'pending',
        created_by: user.id
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select('id')
        .single()

      if (orderError) {
        console.error('Error creating order:', orderError)
        return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
      }

      // Create order items
      const orderItemsData: OrderItemInsert[] = cart.cart_items.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price
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
      for (const item of cart.cart_items) {
        const productArray = item.products as unknown[]
        const cartItemProduct = productArray?.[0] as CartItemProduct
        
        const { error: stockError } = await supabase
          .from('products')
          .update({
            stock_quantity: cartItemProduct.stock_quantity - item.quantity
          })
          .eq('id', item.product_id)
          .gt('stock_quantity', item.quantity - 1) // Ensure we don't go negative

        if (stockError) {
          console.error('Error updating stock for product:', item.product_id, stockError)
          // In production, you might want to handle this more gracefully
          // For now, we'll continue but log the error
        }
      }

      // Mark cart as completed
      const { error: cartUpdateError } = await supabase
        .from('carts')
        .update({ 
          status: 'completed'
        })
        .eq('id', cartId)

      if (cartUpdateError) {
        console.error('Error updating cart status:', cartUpdateError)
        // Don't fail the order creation for this, just log
      }

      // Fetch the complete order with items for response
      const { data: completeOrder, error: fetchError } = await supabase
        .from('orders')
        .select(`
          id,
          organization_id,
          client_id,
          customer_name,
          customer_email,
          total_amount,
          status,
          created_at,
          updated_at,
          created_by,
          client:clients (
            id,
            company_name,
            contact_name,
            contact_email,
            contact_phone
          ),
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
        return NextResponse.json({ 
          orderId: order.id,
          message: 'Order created successfully but failed to fetch details' 
        }, { status: 201 })
      }

      // Complete MedusaJS checkout (optional, continue if fails)
      if (cart.medusa_cart_id) {
        try {
          const syncResult = await MedusaCartService.completeCheckout(cart.medusa_cart_id)
          
          if (syncResult.success) {
            console.log(`Completed MedusaJS checkout for cart ${cart.medusa_cart_id}`)
          } else {
            console.warn(`Failed to complete MedusaJS checkout:`, syncResult.error)
          }
        } catch (medusaError) {
          console.warn('MedusaJS checkout completion failed:', medusaError)
        }
      }

      // TODO: Process payment if payment_method is provided
      // TODO: Send order confirmation email to client

      return NextResponse.json({ 
        order: completeOrder,
        message: 'Checkout completed successfully'
      }, { status: 201 })

    } catch (transactionError) {
      console.error('Transaction error during checkout:', transactionError)
      return NextResponse.json({ 
        error: 'Checkout failed. Please try again.' 
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Error in checkout API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET endpoint to validate cart before checkout
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    const { id: cartId } = await params
    
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

    // Get cart with items for validation
    const { data: cart, error: cartError } = await supabase
      .from('carts')
      .select(`
        id,
        user_id,
        status,
        total_amount,
        item_count,
        client:clients (
          company_name,
          contact_name,
          contact_email
        ),
        cart_items (
          id,
          product_id,
          quantity,
          product_name,
          products (
            id,
            name,
            stock_quantity,
            is_active
          )
        )
      `)
      .eq('id', cartId)
      .eq('organization_id', organization.id)
      .single()

    if (cartError || !cart) {
      return NextResponse.json({ error: 'Cart not found' }, { status: 404 })
    }

    // Validate access
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

    const hasAccess = cart.user_id === user.id || ['admin', 'manager'].includes(membership.role)
    
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied to this cart' }, { status: 403 })
    }

    // Validate cart for checkout
    const validationResults = {
      canCheckout: true,
      issues: [] as string[],
      warnings: [] as string[]
    }

    // Check cart status
    if (cart.status !== 'active') {
      validationResults.canCheckout = false
      validationResults.issues.push('Cart is not active')
    }

    // Check cart has items
    if (!cart.cart_items || cart.cart_items.length === 0) {
      validationResults.canCheckout = false
      validationResults.issues.push('Cart is empty')
    }

    // Check cart total
    if (cart.total_amount <= 0) {
      validationResults.canCheckout = false
      validationResults.issues.push('Cart total must be greater than zero')
    }

    // Check inventory and product availability
    if (cart.cart_items) {
      for (const item of cart.cart_items) {
        const productArray = item.products as unknown[]
        const cartItemProduct = productArray?.[0] as CartItemProduct
        
        if (!cartItemProduct || !cartItemProduct.is_active) {
          validationResults.canCheckout = false
          validationResults.issues.push(`Product ${item.product_name} is no longer available`)
          continue
        }

        if (cartItemProduct.stock_quantity < item.quantity) {
          validationResults.canCheckout = false
          validationResults.issues.push(
            `Insufficient stock for ${item.product_name}. Available: ${cartItemProduct.stock_quantity}, In cart: ${item.quantity}`
          )
        } else if (cartItemProduct.stock_quantity < item.quantity * 2) {
          // Warning for low stock
          validationResults.warnings.push(
            `Low stock for ${item.product_name}. Only ${cartItemProduct.stock_quantity} remaining`
          )
        }
      }
    }

    return NextResponse.json({
      valid: validationResults.canCheckout,
      cart: {
        id: cart.id,
        status: cart.status,
        total_amount: cart.total_amount,
        item_count: cart.item_count,
        client: (cart.client as unknown[])?.[0]
      },
      validation: validationResults
    })
  } catch (error) {
    console.error('Error in checkout validation API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}