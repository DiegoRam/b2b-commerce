'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSubdomain } from '@/components/providers/SubdomainProvider'
import { ArrowLeft, Plus, Minus, Trash2, Package, ShoppingCart, CreditCard, User, Calendar, AlertCircle } from 'lucide-react'
import Link from 'next/link'

// Force dynamic rendering for this page since it uses auth
export const dynamic = 'force-dynamic'

interface Client {
  id: string
  company_name: string
  contact_name: string
  contact_email: string
  contact_phone: string | null
}

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  sku: string | null
  stock_quantity: number
}

interface CartItem {
  id: string
  cart_id: string
  product_id: string
  quantity: number
  unit_price: number
  total_price: number
  created_at: string
  product: Product
}

interface Cart {
  id: string
  client_id: string
  status: string
  currency: string
  total_amount: number
  item_count: number
  notes: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  client: Client
  items: CartItem[]
  creator: {
    first_name: string | null
    last_name: string | null
    email: string
  } | null
}

interface AddProductFormData {
  product_id: string
  quantity: number
}

export default function CartDetailPage() {
  const params = useParams()
  const router = useRouter()
  const cartId = params.id as string
  const { currentOrganization, userRole, isLoading } = useSubdomain()
  const [cart, setCart] = useState<Cart | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [addProductData, setAddProductData] = useState<AddProductFormData>({
    product_id: '',
    quantity: 1
  })

  const canManageCarts = userRole === 'admin' || userRole === 'manager'

  const fetchCart = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/carts/${cartId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch cart')
      }
      
      const data = await response.json()
      setCart(data.cart)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cart')
    } finally {
      setLoading(false)
    }
  }, [cartId])

  useEffect(() => {
    if (currentOrganization && cartId) {
      fetchCart()
      fetchProducts()
    }
  }, [currentOrganization, cartId, fetchCart])

  const fetchProducts = async () => {
    try {
      setProductsLoading(true)
      const response = await fetch('/api/products')
      
      if (!response.ok) {
        throw new Error('Failed to fetch products')
      }
      
      const data = await response.json()
      setProducts(data.products || [])
    } catch (err) {
      console.error('Error fetching products:', err)
      setProducts([])
    } finally {
      setProductsLoading(false)
    }
  }

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canManageCarts || !cart) return

    try {
      setSubmitting(true)
      setError(null)

      const response = await fetch(`/api/carts/${cartId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(addProductData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add product')
      }

      await fetchCart()
      setShowAddProduct(false)
      setAddProductData({ product_id: '', quantity: 1 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add product')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    if (!canManageCarts || !cart || newQuantity < 1) return

    try {
      setUpdating(itemId)
      const response = await fetch(`/api/carts/${cartId}/items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ quantity: newQuantity }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update quantity')
      }

      await fetchCart()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update quantity')
    } finally {
      setUpdating(null)
    }
  }

  const handleRemoveItem = async (itemId: string) => {
    if (!canManageCarts || !cart) return

    if (!confirm('Are you sure you want to remove this item from the cart?')) {
      return
    }

    try {
      const response = await fetch(`/api/carts/${cartId}/items/${itemId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to remove item')
      }

      await fetchCart()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove item')
    }
  }

  const handleCheckout = async () => {
    if (!cart) return

    try {
      const response = await fetch(`/api/carts/${cartId}/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to initiate checkout')
      }

      const data = await response.json()
      // Redirect to checkout page or handle success
      router.push(`/dashboard/orders/${data.order.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate checkout')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      case 'abandoned':
        return 'bg-gray-100 text-gray-800'
      case 'checkout':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const availableProducts = products.filter(product => 
    !cart?.items.some(item => item.product_id === product.id)
  )

  if (isLoading || loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-2 text-sm text-gray-600">Loading cart details...</p>
      </div>
    )
  }

  if (!currentOrganization || !userRole) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Unable to load organization data</p>
      </div>
    )
  }

  if (!cart) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Cart not found</p>
        <Link 
          href="/dashboard/carts"
          className="text-blue-600 hover:text-blue-900 mt-2 inline-block"
        >
          Back to Carts
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link 
            href="/dashboard/carts"
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cart #{cart.id.slice(-8)}</h1>
            <p className="text-gray-600">Shopping Cart Management</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium capitalize ${getStatusColor(cart.status)}`}>
            {cart.status}
          </span>
          {canManageCarts && cart.status === 'active' && (
            <>
              <button
                onClick={() => setShowAddProduct(true)}
                className="inline-flex items-center px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </button>
              {cart.items.length > 0 && (
                <button
                  onClick={handleCheckout}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Checkout
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Cart Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client Information */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Client Information</h2>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <User className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-500">Company</p>
                <p className="text-gray-900">{cart.client.company_name}</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <User className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-500">Contact</p>
                <p className="text-gray-900">{cart.client.contact_name}</p>
                <p className="text-sm text-gray-600">{cart.client.contact_email}</p>
              </div>
            </div>
            {cart.client.contact_phone && (
              <div className="flex items-start space-x-3">
                <User className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Phone</p>
                  <p className="text-gray-900">{cart.client.contact_phone}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cart Summary */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Cart Summary</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Items</span>
              <span className="font-medium">{cart.item_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Currency</span>
              <span className="font-medium">{cart.currency}</span>
            </div>
            <div className="border-t pt-3">
              <div className="flex justify-between">
                <span className="text-lg font-semibold text-gray-900">Total</span>
                <span className="text-lg font-bold text-gray-900">
                  {cart.currency} ${cart.total_amount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Cart Metadata */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Cart Details</h2>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-500">Created</p>
                <p className="text-gray-900">{new Date(cart.created_at).toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-500">Last Updated</p>
                <p className="text-gray-900">{new Date(cart.updated_at).toLocaleString()}</p>
              </div>
            </div>
            {cart.creator && (
              <div className="flex items-start space-x-3">
                <User className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Created By</p>
                  <p className="text-gray-900">
                    {cart.creator.first_name} {cart.creator.last_name}
                  </p>
                  <p className="text-xs text-gray-500">{cart.creator.email}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Add Product to Cart</h2>
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product *
                </label>
                {productsLoading ? (
                  <div className="text-sm text-gray-500">Loading products...</div>
                ) : (
                  <select
                    required
                    value={addProductData.product_id}
                    onChange={(e) => setAddProductData(prev => ({ ...prev, product_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select a product</option>
                    {availableProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} - ${product.price.toFixed(2)} (Stock: {product.stock_quantity})
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={addProductData.quantity}
                  onChange={(e) => setAddProductData(prev => ({ ...prev, quantity: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Adding...' : 'Add Product'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddProduct(false)
                    setError(null)
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cart Items */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Cart Items</h2>
        </div>
        <div className="p-6">
          {cart.items.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Cart is empty</h3>
              <p className="text-gray-600 mb-4">Add some products to get started.</p>
              {canManageCarts && cart.status === 'active' && (
                <button
                  onClick={() => setShowAddProduct(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {cart.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <Package className="h-8 w-8 text-gray-400" />
                    <div>
                      <h3 className="font-medium text-gray-900">{item.product.name}</h3>
                      {item.product.description && (
                        <p className="text-sm text-gray-600">{item.product.description}</p>
                      )}
                      {item.product.sku && (
                        <p className="text-xs text-gray-500">SKU: {item.product.sku}</p>
                      )}
                      <p className="text-sm font-medium text-gray-900">
                        ${item.unit_price.toFixed(2)} each
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      {canManageCarts && cart.status === 'active' && (
                        <button
                          onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                          disabled={updating === item.id || item.quantity <= 1}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                      )}
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      {canManageCarts && cart.status === 'active' && (
                        <button
                          onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                          disabled={updating === item.id || item.quantity >= item.product.stock_quantity}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">
                        ${item.total_price.toFixed(2)}
                      </p>
                      {item.product.stock_quantity < item.quantity && (
                        <p className="text-xs text-red-600">
                          <AlertCircle className="h-3 w-3 inline mr-1" />
                          Low stock
                        </p>
                      )}
                    </div>
                    {canManageCarts && cart.status === 'active' && (
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      {cart.notes && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
          <p className="text-gray-900 whitespace-pre-line">{cart.notes}</p>
        </div>
      )}
    </div>
  )
}