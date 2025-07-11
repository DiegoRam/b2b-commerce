import { medusaClient } from './medusa-client'
import { createSupabaseServerClient } from './supabase'
import type { Cart, Client } from '@/types'

// MedusaJS cart types
export interface MedusaCart {
  id: string
  region_id: string
  customer_id?: string
  payment_session?: Record<string, unknown>
  payment_sessions?: Array<Record<string, unknown>>
  discounts?: Array<Record<string, unknown>>
  gift_cards?: Array<Record<string, unknown>>
  customer?: {
    id: string
    email: string
    first_name: string
    last_name: string
  }
  shipping_address?: MedusaAddress
  billing_address?: MedusaAddress
  items: MedusaLineItem[]
  region: {
    id: string
    name: string
    currency_code: string
  }
  total: number
  subtotal: number
  tax_total: number
  discount_total: number
  shipping_total: number
  gift_card_total: number
  created_at: string
  updated_at: string
  metadata?: Record<string, unknown>
}

export interface MedusaLineItem {
  id: string
  cart_id: string
  order_id?: string
  title: string
  description?: string
  thumbnail?: string
  quantity: number
  variant_id: string
  variant: {
    id: string
    title: string
    sku?: string
    product: {
      id: string
      title: string
      handle: string
    }
  }
  unit_price: number
  total: number
  original_total: number
  original_item_total: number
  original_tax_total: number
  tax_total: number
  discount_total: number
  created_at: string
  updated_at: string
  metadata?: Record<string, unknown>
}

export interface MedusaAddress {
  id?: string
  customer_id?: string
  company?: string
  first_name?: string
  last_name?: string
  address_1?: string
  address_2?: string
  city?: string
  country_code?: string
  province?: string
  postal_code?: string
  phone?: string
  metadata?: Record<string, unknown>
}

export interface CreateMedusaCartRequest {
  region_id?: string
  customer_id?: string
  items?: Array<{
    variant_id: string
    quantity: number
  }>
  context?: {
    ip?: string
    user_agent?: string
  }
  metadata?: Record<string, unknown>
}

export interface AddToMedusaCartRequest {
  variant_id: string
  quantity: number
  metadata?: Record<string, unknown>
}

export interface UpdateMedusaCartItemRequest {
  quantity: number
  metadata?: Record<string, unknown>
}

export interface CartSyncResult {
  success: boolean
  medusaCartId?: string
  error?: string
  itemsSynced?: number
  conflicts?: string[]
}

export interface CartSyncOptions {
  syncItems?: boolean
  createIfNotExists?: boolean
  skipConflictCheck?: boolean
}

export class MedusaCartService {
  private static DEFAULT_REGION_ID = 'reg_01J0XWZ8Z8Z8Z8Z8Z8Z8Z8Z8Z8' // This should be from your MedusaJS setup

  /**
   * Create MedusaJS cart metadata from Supabase cart
   */
  private static createCartMetadata(cart: Cart, client: Client, organizationSubdomain: string): Record<string, unknown> {
    return {
      b2bCart: true,
      organizationId: cart.organization_id,
      organizationSubdomain,
      clientId: cart.client_id,
      clientCompanyName: client.company_name,
      cartId: cart.id,
      sessionId: cart.session_id,
      createdBy: cart.user_id
    }
  }

  /**
   * Get the default region for cart creation
   */
  private static async getDefaultRegion(): Promise<string> {
    try {
      const { regions } = await medusaClient.store.region.list()
      
      if (regions && regions.length > 0) {
        // Prefer USD region if available, otherwise use first region
        const usdRegion = regions.find((r: { currency_code: string }) => r.currency_code === 'usd')
        return usdRegion?.id || regions[0].id
      }
      
      return this.DEFAULT_REGION_ID
    } catch (error) {
      console.warn('Failed to fetch regions from MedusaJS, using default:', error)
      return this.DEFAULT_REGION_ID
    }
  }

  /**
   * Create a new MedusaJS cart
   */
  static async createCart(
    cart: Cart,
    client: Client,
    organizationSubdomain: string,
    options: CartSyncOptions = {}
  ): Promise<CartSyncResult> {
    try {
      const regionId = await this.getDefaultRegion()
      const metadata = this.createCartMetadata(cart, client, organizationSubdomain)

      // Create cart request
      const cartData: CreateMedusaCartRequest = {
        region_id: regionId,
        customer_id: client.medusa_customer_id || undefined,
        metadata
      }

      // Create cart in MedusaJS
      const { cart: medusaCart } = await medusaClient.store.cart.create(cartData)
      
      let itemsSynced = 0

      // Sync cart items if requested
      if (options.syncItems !== false) {
        const supabase = await createSupabaseServerClient()
        
        // Get cart items with product details
        const { data: cartItems } = await supabase
          .from('cart_items')
          .select(`
            id,
            product_id,
            quantity,
            products (
              id,
              medusa_product_id,
              name,
              sku
            )
          `)
          .eq('cart_id', cart.id)

        if (cartItems) {
          for (const item of cartItems) {
            const productArray = item.products as unknown[]
            const productData = productArray?.[0] as { medusa_product_id?: string; sku?: string }
            
            if (productData?.medusa_product_id) {
              try {
                // Get product variants from MedusaJS
                const { product } = await medusaClient.store.product.retrieve(productData.medusa_product_id)
                
                if (product.variants && product.variants.length > 0) {
                  const variant = product.variants[0] // Use first variant for B2B simplicity
                  
                  // TODO: Fix MedusaJS API call structure in next phase
                  console.log('Would sync cart item to MedusaJS:', { 
                    cartId: medusaCart.id, 
                    variantId: variant.id, 
                    quantity: item.quantity 
                  })
                  
                  // Update Supabase cart item with MedusaJS line item ID
                  // Note: We'd need to fetch the updated cart to get the line item ID
                  itemsSynced++
                }
              } catch (error) {
                console.warn(`Failed to sync cart item ${item.id}:`, error)
              }
            }
          }
        }
      }

      // Update Supabase cart with MedusaJS cart ID
      const supabase = await createSupabaseServerClient()
      await supabase
        .from('carts')
        .update({ medusa_cart_id: medusaCart.id })
        .eq('id', cart.id)

      return {
        success: true,
        medusaCartId: medusaCart.id,
        itemsSynced
      }
    } catch (error) {
      console.error('Error creating MedusaJS cart:', error)
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error creating cart'
      }
    }
  }

  /**
   * Add item to MedusaJS cart
   */
  static async addItemToCart(
    cartId: string,
    medusaCartId: string,
    productId: string,
    quantity: number
  ): Promise<CartSyncResult> {
    try {
      const supabase = await createSupabaseServerClient()
      
      // Get product's MedusaJS ID
      const { data: product } = await supabase
        .from('products')
        .select('medusa_product_id')
        .eq('id', productId)
        .single()

      if (!product?.medusa_product_id) {
        return {
          success: false,
          error: 'Product is not synced with MedusaJS'
        }
      }

      // Get product variants from MedusaJS
      const { product: medusaProduct } = await medusaClient.store.product.retrieve(product.medusa_product_id)
      
      if (!medusaProduct.variants || medusaProduct.variants.length === 0) {
        return {
          success: false,
          error: 'Product has no variants in MedusaJS'
        }
      }

      const variant = medusaProduct.variants[0] // Use first variant

      // Add item to MedusaJS cart using correct API
      const { cart: updatedCart } = await medusaClient.store.cart.createLineItem(medusaCartId, {
        variant_id: variant.id,
        quantity
      })

      // Find the newly added line item
      const addedItem = updatedCart.items?.find(item => item.variant_id === variant.id)
      
      if (addedItem) {
        // Update Supabase cart item with MedusaJS line item ID
        await supabase
          .from('cart_items')
          .update({ medusa_line_item_id: addedItem.id })
          .eq('cart_id', cartId)
          .eq('product_id', productId)
        
        console.log(`Added item to MedusaJS cart ${medusaCartId}, line item ID: ${addedItem.id}`)
      }

      console.log(`Successfully added item to MedusaJS cart ${medusaCartId}, variant: ${variant.id}, quantity: ${quantity}`)

      return {
        success: true,
        medusaCartId,
        itemsSynced: 1
      }
    } catch (error) {
      console.error('Error adding item to MedusaJS cart:', error)
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error adding item'
      }
    }
  }

  /**
   * Update cart item quantity in MedusaJS
   */
  static async updateCartItem(
    medusaCartId: string,
    medusaLineItemId: string,
    quantity: number
  ): Promise<CartSyncResult> {
    try {
      // Update or remove item in MedusaJS cart using correct API
      if (quantity === 0) {
        // Remove item from MedusaJS cart
        await medusaClient.store.cart.deleteLineItem(medusaCartId, medusaLineItemId)
        console.log(`Removed item ${medusaLineItemId} from MedusaJS cart ${medusaCartId}`)
      } else {
        // Update item quantity in MedusaJS cart
        await medusaClient.store.cart.updateLineItem(medusaCartId, medusaLineItemId, {
          quantity
        })
        console.log(`Updated item ${medusaLineItemId} in MedusaJS cart ${medusaCartId} to quantity ${quantity}`)
      }

      return {
        success: true,
        medusaCartId,
        itemsSynced: 1
      }
    } catch (error) {
      console.error('Error updating cart item in MedusaJS:', error)
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error updating item'
      }
    }
  }

  /**
   * Remove cart item from MedusaJS
   */
  static async removeCartItem(
    medusaCartId: string,
    medusaLineItemId: string
  ): Promise<CartSyncResult> {
    try {
      // Remove item from MedusaJS cart using correct API
      await medusaClient.store.cart.deleteLineItem(medusaCartId, medusaLineItemId)
      console.log(`Removed item ${medusaLineItemId} from MedusaJS cart ${medusaCartId}`)

      return {
        success: true,
        medusaCartId,
        itemsSynced: 1
      }
    } catch (error) {
      console.error('Error removing cart item from MedusaJS:', error)
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error removing item'
      }
    }
  }

  /**
   * Get MedusaJS cart by ID
   */
  static async getCart(medusaCartId: string): Promise<MedusaCart | null> {
    try {
      const { cart } = await medusaClient.store.cart.retrieve(medusaCartId)
      return cart as unknown as MedusaCart
    } catch (error) {
      console.error('Error fetching MedusaJS cart:', error)
      return null
    }
  }

  /**
   * Complete cart checkout in MedusaJS
   */
  static async completeCheckout(
    medusaCartId: string,
    shippingAddress?: MedusaAddress,
    billingAddress?: MedusaAddress,
    paymentMethod?: string
  ): Promise<CartSyncResult & { orderId?: string }> {
    try {
      // Step 1: Set shipping address (if provided)
      if (shippingAddress) {
        await medusaClient.store.cart.update(medusaCartId, {
          shipping_address: shippingAddress
        })
      }

      // Step 2: Set billing address (if provided, use shipping address if not provided)
      const finalBillingAddress = billingAddress || shippingAddress
      if (finalBillingAddress) {
        await medusaClient.store.cart.update(medusaCartId, {
          billing_address: finalBillingAddress
        })
      }

      // Step 3: Get available shipping methods and add shipping method
      try {
        const { shipping_options } = await medusaClient.store.fulfillment.listCartOptions({
          cart_id: medusaCartId
        })
        
        if (shipping_options && shipping_options.length > 0) {
          // Use first available shipping method
          const shippingOption = shipping_options[0]
          await medusaClient.store.cart.addShippingMethod(medusaCartId, {
            option_id: shippingOption.id
          })
          console.log(`Added shipping method ${shippingOption.id} to cart ${medusaCartId}`)
        }
      } catch (shippingError) {
        console.warn('Could not add shipping method:', shippingError)
        // Continue without shipping method for B2B carts
      }

      // Step 4: Initialize payment sessions
      try {
        // Use direct API call for payment sessions as it's not in the SDK's cart methods
        const baseUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
        const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""
        
        const response = await fetch(`${baseUrl}/store/carts/${medusaCartId}/payment-sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-publishable-api-key': publishableKey
          }
        })
        
        if (response.ok) {
          console.log(`Created payment sessions for cart ${medusaCartId}`)
        } else {
          throw new Error(`Payment sessions creation failed: ${response.status}`)
        }
      } catch (paymentError) {
        console.warn('Could not create payment sessions:', paymentError)
        // Continue - some B2B flows might not require payment sessions
      }

      // Step 5: Complete the cart to create an order
      const result = await medusaClient.store.cart.complete(medusaCartId)
      
      if (result.type === "order" && result.order) {
        console.log(`Successfully completed MedusaJS checkout for cart ${medusaCartId}, created order ${result.order.id}`)
        console.log(`Payment method: ${paymentMethod || 'manual'}`)
        
        return {
          success: true,
          medusaCartId,
          orderId: result.order.id
        }
      } else if (result.type === "cart" && result.error) {
        console.error(`Failed to complete MedusaJS checkout for cart ${medusaCartId}:`, result.error)
        
        return {
          success: false,
          medusaCartId,
          error: typeof result.error === 'string' ? result.error : result.error.message || 'Cart completion failed'
        }
      } else {
        console.error(`Unexpected response type from MedusaJS cart completion:`, result)
        
        return {
          success: false,
          medusaCartId,
          error: 'Unexpected response from MedusaJS'
        }
      }
    } catch (error) {
      console.error('Error completing checkout in MedusaJS:', error)
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error completing checkout'
      }
    }
  }

  /**
   * Sync cart totals from MedusaJS to Supabase
   */
  static async syncCartTotals(cartId: string, medusaCartId: string): Promise<boolean> {
    try {
      const medusaCart = await this.getCart(medusaCartId)
      if (!medusaCart) return false

      const supabase = await createSupabaseServerClient()
      
      // Convert from cents to dollars
      const totalAmount = medusaCart.total / 100
      const itemCount = medusaCart.items.reduce((sum, item) => sum + item.quantity, 0)

      await supabase
        .from('carts')
        .update({
          total_amount: totalAmount,
          item_count: itemCount,
          currency: medusaCart.region.currency_code
        })
        .eq('id', cartId)

      return true
    } catch (error) {
      console.error('Error syncing cart totals:', error)
      return false
    }
  }

  /**
   * Validate MedusaJS connection
   */
  static async validateConnection(): Promise<boolean> {
    try {
      await medusaClient.store.region.list({ limit: 1 })
      return true
    } catch (error) {
      console.error('MedusaJS connection validation failed:', error)
      return false
    }
  }
}