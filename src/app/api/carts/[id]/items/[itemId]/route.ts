import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { MedusaCartService } from '@/lib/medusa-cart-service'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const { userId } = await auth()
    const { id: cartId, itemId } = await params
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { quantity } = body

    // Validate quantity
    if (!quantity || quantity < 0) {
      return NextResponse.json({ 
        error: 'Valid quantity is required (0 to remove item)' 
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
      .select('id, user_id, status, organization_id, medusa_cart_id')
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

    // Get cart item and verify it belongs to this cart
    const { data: cartItem, error: itemError } = await supabase
      .from('cart_items')
      .select(`
        id,
        cart_id,
        product_id,
        medusa_line_item_id,
        quantity,
        unit_price,
        product_name,
        products (
          id,
          name,
          sku,
          price,
          stock_quantity,
          is_active
        )
      `)
      .eq('id', itemId)
      .eq('cart_id', cartId)
      .single()

    if (itemError || !cartItem) {
      return NextResponse.json({ error: 'Cart item not found' }, { status: 404 })
    }

    // If quantity is 0, remove the item
    if (quantity === 0) {
      const { error: deleteError } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', itemId)
        .eq('cart_id', cartId)

      if (deleteError) {
        console.error('Error removing cart item:', deleteError)
        return NextResponse.json({ error: 'Failed to remove cart item' }, { status: 500 })
      }

      // Update cart totals
      await updateCartTotals(supabase, cartId)

      return NextResponse.json({ 
        message: 'Cart item removed successfully',
        cart_item_id: itemId
      })
    }

    // Check stock availability for new quantity
    const productArray = cartItem.products as unknown[]
    const productData = productArray?.[0] as { stock_quantity: number }
    
    if (productData && productData.stock_quantity < quantity) {
      return NextResponse.json({ 
        error: `Insufficient stock. Available: ${productData.stock_quantity}` 
      }, { status: 400 })
    }

    // Update cart item quantity and total price
    const newTotalPrice = cartItem.unit_price * quantity

    const { data: updatedItem, error: updateError } = await supabase
      .from('cart_items')
      .update({
        quantity,
        total_price: newTotalPrice
      })
      .eq('id', itemId)
      .eq('cart_id', cartId)
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

    // Update cart totals
    await updateCartTotals(supabase, cartId)

    // Sync with MedusaJS cart (optional, continue if fails)
    if (cart.medusa_cart_id && cartItem.medusa_line_item_id) {
      try {
        const syncResult = await MedusaCartService.updateCartItem(
          cart.medusa_cart_id,
          cartItem.medusa_line_item_id,
          quantity
        )
        
        if (syncResult.success) {
          console.log(`Updated item in MedusaJS cart ${cart.medusa_cart_id}`)
          
          // Sync totals back from MedusaJS
          await MedusaCartService.syncCartTotals(cartId, cart.medusa_cart_id)
        } else {
          console.warn(`Failed to update item in MedusaJS cart:`, syncResult.error)
        }
      } catch (medusaError) {
        console.warn('MedusaJS cart item update failed:', medusaError)
      }
    }

    return NextResponse.json({ cart_item: updatedItem })
  } catch (error) {
    console.error('Error in cart item PUT API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const { userId } = await auth()
    const { id: cartId, itemId } = await params
    
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

    // Get cart and verify access
    const { data: cart, error: cartError } = await supabase
      .from('carts')
      .select('id, user_id, status, organization_id, medusa_cart_id')
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

    // Verify cart item exists and belongs to this cart, and get cart info
    const { data: existingItem } = await supabase
      .from('cart_items')
      .select('id, product_name, medusa_line_item_id')
      .eq('id', itemId)
      .eq('cart_id', cartId)
      .single()

    // Get cart info for MedusaJS sync
    const { data: cartData } = await supabase
      .from('carts')
      .select('medusa_cart_id')
      .eq('id', cartId)
      .single()

    if (!existingItem) {
      return NextResponse.json({ error: 'Cart item not found' }, { status: 404 })
    }

    // Delete cart item
    const { error: deleteError } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', itemId)
      .eq('cart_id', cartId)

    if (deleteError) {
      console.error('Error deleting cart item:', deleteError)
      return NextResponse.json({ error: 'Failed to remove cart item' }, { status: 500 })
    }

    // Update cart totals
    await updateCartTotals(supabase, cartId)

    // Sync with MedusaJS cart (optional, continue if fails)
    if (cartData?.medusa_cart_id && existingItem.medusa_line_item_id) {
      try {
        const syncResult = await MedusaCartService.removeCartItem(
          cartData.medusa_cart_id,
          existingItem.medusa_line_item_id
        )
        
        if (syncResult.success) {
          console.log(`Removed item from MedusaJS cart ${cartData.medusa_cart_id}`)
          
          // Sync totals back from MedusaJS
          await MedusaCartService.syncCartTotals(cartId, cartData.medusa_cart_id)
        } else {
          console.warn(`Failed to remove item from MedusaJS cart:`, syncResult.error)
        }
      } catch (medusaError) {
        console.warn('MedusaJS cart item removal failed:', medusaError)
      }
    }

    return NextResponse.json({ 
      message: 'Cart item removed successfully',
      cart_item: { id: itemId, product_name: existingItem.product_name }
    })
  } catch (error) {
    console.error('Error in cart item DELETE API:', error)
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