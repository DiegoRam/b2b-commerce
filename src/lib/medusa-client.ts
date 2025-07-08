import Medusa from "@medusajs/js-sdk"

const MEDUSA_BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
const MEDUSA_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

// Validate environment variables in development
if (process.env.NODE_ENV === 'development' && !MEDUSA_BACKEND_URL) {
  console.warn('NEXT_PUBLIC_MEDUSA_BACKEND_URL environment variable is not set, using default')
}

// Admin API key should only be used server-side
const getAdminApiKey = () => {
  if (typeof window !== 'undefined') {
    throw new Error('Admin API key cannot be accessed on client side')
  }
  return process.env.MEDUSA_ADMIN_API_KEY || ''
}

// Create Medusa client for store API (public product access)
export const medusaClient = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  publishableKey: MEDUSA_PUBLISHABLE_KEY,
})

// Create Medusa client for admin API (product management) - server-side only
export const getMedusaAdminClient = () => {
  return new Medusa({
    baseUrl: MEDUSA_BACKEND_URL,
    apiKey: getAdminApiKey(),
  })
}

import type { Product } from '@/types'

// MedusaJS product type structure
interface MedusaProduct {
  id: string
  title: string
  description: string | null
  handle: string
  status: 'draft' | 'published' | 'proposed' | 'rejected'
  created_at: string
  updated_at: string
  variants?: MedusaVariant[]
}

interface MedusaVariant {
  id: string
  title: string
  sku: string | null
  inventory_quantity?: number
  manage_inventory?: boolean
  prices?: MedusaPrice[]
}

interface MedusaPrice {
  amount: number
  currency_code: string
}

// Transform MedusaJS product to our frontend format
export function transformMedusaProduct(medusaProduct: MedusaProduct): Product {
  // Get the first variant for price and stock information
  const firstVariant = medusaProduct.variants?.[0]
  
  return {
    id: medusaProduct.id,
    name: medusaProduct.title || 'Untitled Product',
    description: medusaProduct.description,
    price: firstVariant?.prices?.[0]?.amount ? (firstVariant.prices[0].amount / 100) : 0,
    sku: firstVariant?.sku || medusaProduct.handle || null,
    stock_quantity: firstVariant?.inventory_quantity || firstVariant?.manage_inventory ? 0 : 999, // Default to 999 if not managed
    is_active: medusaProduct.status === 'published',
    created_at: medusaProduct.created_at,
    updated_at: medusaProduct.updated_at,
    created_by: null, // MedusaJS doesn't have this field by default
    creator: null // MedusaJS doesn't have this field by default
  }
}

// Product service functions
export class MedusaProductService {
  // Get all products
  static async getProducts() {
    try {
      const { products } = await medusaClient.store.product.list({
        limit: 100,
        fields: 'id,title,description,handle,status,created_at,updated_at,variants.id,variants.title,variants.sku,variants.inventory_quantity,variants.prices.amount,variants.prices.currency_code'
      })
      
      return (products as MedusaProduct[]).map(transformMedusaProduct)
    } catch (error) {
      console.error('Error fetching products from MedusaJS:', error)
      throw new Error('Failed to fetch products')
    }
  }

  // Get single product
  static async getProduct(id: string) {
    try {
      const { product } = await medusaClient.store.product.retrieve(id, {
        fields: 'id,title,description,handle,status,created_at,updated_at,variants.id,variants.title,variants.sku,variants.inventory_quantity,variants.prices.amount,variants.prices.currency_code'
      })
      
      return transformMedusaProduct(product as MedusaProduct)
    } catch (error) {
      console.error('Error fetching product from MedusaJS:', error)
      throw new Error('Failed to fetch product')
    }
  }

  // Create product (admin only)
  static async createProduct(productData: {
    name: string
    description?: string
    price: number
    sku?: string
    stock_quantity?: number
  }) {
    try {
      const adminClient = getMedusaAdminClient()
      const { product } = await adminClient.admin.product.create({
        title: productData.name,
        description: productData.description || '',
        handle: productData.sku || productData.name.toLowerCase().replace(/\s+/g, '-'),
        status: 'published' as const,
        options: [{
          title: 'Default Option',
          values: ['Default']
        }],
        variants: [{
          title: 'Default Variant',
          sku: productData.sku || undefined,
          prices: [{
            currency_code: 'usd',
            amount: Math.round(productData.price * 100) // Convert to cents
          }]
        }]
      })
      
      return transformMedusaProduct(product as MedusaProduct)
    } catch (error) {
      console.error('Error creating product in MedusaJS:', error)
      throw new Error('Failed to create product')
    }
  }

  // Update product (admin only)
  static async updateProduct(id: string, productData: {
    name?: string
    description?: string
    price?: number
    sku?: string
    stock_quantity?: number
  }) {
    try {
      const adminClient = getMedusaAdminClient()
      const { product } = await adminClient.admin.product.update(id, {
        title: productData.name,
        description: productData.description,
        handle: productData.sku || productData.name?.toLowerCase().replace(/\s+/g, '-'),
        status: 'published' as const
      })
      
      // Update variant if price or stock changed
      if (product.variants && product.variants.length > 0) {
        const variant = product.variants[0]
        
        const updateData: {
          sku?: string
          prices?: Array<{
            currency_code: string
            amount: number
          }>
        } = {}
        
        if (productData.sku !== undefined) updateData.sku = productData.sku
        if (productData.price !== undefined) {
          updateData.prices = [{
            currency_code: 'usd',
            amount: Math.round(productData.price * 100)
          }]
        }
        // Note: inventory_quantity might need to be handled through inventory management API
        
        if (Object.keys(updateData).length > 0) {
          await adminClient.admin.product.updateVariant(id, variant.id, updateData)
        }
      }
      
      return transformMedusaProduct(product as MedusaProduct)
    } catch (error) {
      console.error('Error updating product in MedusaJS:', error)
      throw new Error('Failed to update product')
    }
  }

  // Delete product (admin only)
  static async deleteProduct(id: string) {
    try {
      const adminClient = getMedusaAdminClient()
      await adminClient.admin.product.delete(id)
      return true
    } catch (error) {
      console.error('Error deleting product from MedusaJS:', error)
      throw new Error('Failed to delete product')
    }
  }
}