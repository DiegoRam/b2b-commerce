import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { MedusaCartService } from '@/lib/medusa-cart-service'
import type { CartItemInsert } from '@/types'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    const { id: cartId } = await params
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { product_id, quantity } = body

    // Validate required fields
    if (!product_id || !quantity || quantity <= 0) {
      return NextResponse.json({ 
        error: 'Product ID and valid quantity are required' 
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

    // Get cart and verify access
    const { data: cart, error: cartError } = await supabase
      .from('carts')
      .select('id, user_id, status, organization_id, client_id, medusa_cart_id')
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

    // Can't modify inactive carts
    if (cart.status !== 'active') {
      return NextResponse.json({ error: 'Cannot modify inactive cart' }, { status: 400 })
    }

    // Get product and verify it belongs to this organization or is available
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, sku, description, price, stock_quantity, is_active, organization_id')
      .eq('id', product_id)
      .eq('is_active', true)
      .single()

    if (productError || !product) {
      return NextResponse.json({ 
        error: 'Product not found or not available' 
      }, { status: 404 })
    }

    // Check if product belongs to organization or is shared (for multi-tenant product sharing)
    // For now, we'll allow products from any organization (shared catalog)
    // In production, you might want to restrict this based on business rules

    // Check stock availability
    if (product.stock_quantity < quantity) {
      return NextResponse.json({ 
        error: `Insufficient stock. Available: ${product.stock_quantity}` 
      }, { status: 400 })
    }

    // Check if item already exists in cart
    const { data: existingItem } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('cart_id', cartId)
      .eq('product_id', product_id)
      .single()

    let cartItem
    const unit_price = product.price
    const total_price = unit_price * quantity

    if (existingItem) {
      // Update existing item quantity
      const newQuantity = existingItem.quantity + quantity
      const newTotalPrice = unit_price * newQuantity

      // Check stock for new total quantity
      if (product.stock_quantity < newQuantity) {
        return NextResponse.json({ 
          error: `Insufficient stock for total quantity ${newQuantity}. Available: ${product.stock_quantity}` 
        }, { status: 400 })
      }

      const { data: updatedItem, error: updateError } = await supabase
        .from('cart_items')
        .update({
          quantity: newQuantity,
          total_price: newTotalPrice
        })
        .eq('id', existingItem.id)
        .select(`
          id,
          cart_id,
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
        `)
        .single()

      if (updateError) {
        console.error('Error updating cart item:', updateError)
        return NextResponse.json({ error: 'Failed to update cart item' }, { status: 500 })
      }

      cartItem = updatedItem
    } else {
      // Create new cart item
      const cartItemData: CartItemInsert = {
        cart_id: cartId,
        product_id,
        quantity,
        unit_price,
        total_price,
        product_name: product.name,
        product_sku: product.sku,
        product_description: product.description
      }

      const { data: newItem, error: createError } = await supabase
        .from('cart_items')
        .insert(cartItemData)
        .select(`
          id,
          cart_id,
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
        `)
        .single()

      if (createError) {
        console.error('Error creating cart item:', createError)
        return NextResponse.json({ error: 'Failed to add item to cart' }, { status: 500 })
      }

      cartItem = newItem
    }

    // Update cart totals
    await updateCartTotals(supabase, cartId)

    // Sync with MedusaJS cart (optional, continue if fails)
    if (cart.medusa_cart_id) {
      try {
        const syncResult = await MedusaCartService.addItemToCart(
          cartId,
          cart.medusa_cart_id,
          product_id,
          quantity
        )
        
        if (syncResult.success) {
          console.log(`Added item to MedusaJS cart ${cart.medusa_cart_id}`)
          
          // Sync totals back from MedusaJS
          await MedusaCartService.syncCartTotals(cartId, cart.medusa_cart_id)
        } else {
          console.warn(`Failed to add item to MedusaJS cart:`, syncResult.error)
        }
      } catch (medusaError) {
        console.warn('MedusaJS cart item sync failed:', medusaError)
      }
    }

    return NextResponse.json({ cart_item: cartItem }, { status: existingItem ? 200 : 201 })
  } catch (error) {
    console.error('Error in cart items POST API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to update cart totals
async function updateCartTotals(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, cartId: string) {
  try {
    // Calculate totals from cart items
    const { data: items } = await supabase
      .from('cart_items')
      .select('quantity, total_price')
      .eq('cart_id', cartId)

    if (!items) return

    const totalAmount = items.reduce((sum: number, item: { total_price: number }) => sum + item.total_price, 0)
    const itemCount = items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0)

    // Update cart with new totals
    await supabase
      .from('carts')
      .update({
        total_amount: totalAmount,
        item_count: itemCount
      })
      .eq('id', cartId)
  } catch (error) {
    console.error('Error updating cart totals:', error)
  }
}