'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSubdomain } from '@/components/providers/SubdomainProvider'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import Link from 'next/link'

// Force dynamic rendering for this page since it uses auth
export const dynamic = 'force-dynamic'

interface Client {
  id: string
  company_name: string
  contact_name: string
  contact_email: string
  contact_phone: string | null
  billing_address_line1: string | null
  billing_address_line2: string | null
  billing_city: string | null
  billing_state: string | null
  billing_postal_code: string | null
  billing_country: string | null
  payment_terms: string | null
  credit_limit: number | null
  preferred_currency: string | null
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
  product_id: string
  quantity: number
  unit_price: number
  total_price: number
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
  client: Client
  items: CartItem[]
}

interface CheckoutFormData {
  shipping_address_line1: string
  shipping_address_line2: string
  shipping_city: string
  shipping_state: string
  shipping_postal_code: string
  shipping_country: string
  payment_method: string
  delivery_notes: string
  po_number: string
}

export default function CheckoutPage() {
  const params = useParams()
  const router = useRouter()
  const cartId = params.cartId as string
  const { currentOrganization, userRole, isLoading } = useSubdomain()
  const [cart, setCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [useBillingAddress, setUseBillingAddress] = useState(true)
  const [formData, setFormData] = useState<CheckoutFormData>({
    shipping_address_line1: '',
    shipping_address_line2: '',
    shipping_city: '',
    shipping_state: '',
    shipping_postal_code: '',
    shipping_country: 'US',
    payment_method: 'credit_terms',
    delivery_notes: '',
    po_number: ''
  })

  const canCheckout = userRole === 'admin' || userRole === 'manager'

  const fetchCart = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/carts/${cartId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch cart')
      }
      
      const data = await response.json()
      setCart(data.cart)
      
      // Check if cart can be checked out
      if (data.cart.status !== 'active') {
        setError('This cart is not available for checkout')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cart')
    } finally {
      setLoading(false)
    }
  }, [cartId])

  useEffect(() => {
    if (currentOrganization && cartId) {
      fetchCart()
    }
  }, [currentOrganization, cartId, fetchCart])

  useEffect(() => {
    if (cart && useBillingAddress) {
      setFormData(prev => ({
        ...prev,
        shipping_address_line1: cart.client.billing_address_line1 || '',
        shipping_address_line2: cart.client.billing_address_line2 || '',
        shipping_city: cart.client.billing_city || '',
        shipping_state: cart.client.billing_state || '',
        shipping_postal_code: cart.client.billing_postal_code || '',
        shipping_country: cart.client.billing_country || 'US'
      }))
    }
  }, [cart, useBillingAddress])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canCheckout || !cart) return

    try {
      setSubmitting(true)
      setError(null)

      const response = await fetch(`/api/carts/${cartId}/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shipping_address: {
            line1: formData.shipping_address_line1,
            line2: formData.shipping_address_line2,
            city: formData.shipping_city,
            state: formData.shipping_state,
            postal_code: formData.shipping_postal_code,
            country: formData.shipping_country
          },
          payment_method: formData.payment_method,
          delivery_notes: formData.delivery_notes || null,
          po_number: formData.po_number || null
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to complete checkout')
      }

      const data = await response.json()
      // Redirect to order confirmation
      router.push(`/dashboard/orders/${data.order.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete checkout')
    } finally {
      setSubmitting(false)
    }
  }

  const formatAddress = (
    line1: string | null,
    line2: string | null,
    city: string | null,
    state: string | null,
    postalCode: string | null,
    country: string | null
  ) => {
    const parts = [
      line1,
      line2,
      [city, state].filter(Boolean).join(', '),
      postalCode,
      country
    ].filter(Boolean)
    
    return parts.length > 0 ? parts.join('\n') : null
  }

  const billingAddress = cart ? formatAddress(
    cart.client.billing_address_line1,
    cart.client.billing_address_line2,
    cart.client.billing_city,
    cart.client.billing_state,
    cart.client.billing_postal_code,
    cart.client.billing_country
  ) : null

  const hasInventoryIssues = cart?.items.some(item => item.product.stock_quantity < item.quantity)

  if (isLoading || loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-2 text-sm text-gray-600">Loading checkout...</p>
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

  if (!canCheckout) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">You don&apos;t have permission to complete checkout</p>
        <Link 
          href={`/dashboard/carts/${cartId}`}
          className="text-blue-600 hover:text-blue-900 mt-2 inline-block"
        >
          Back to Cart
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link 
          href={`/dashboard/carts/${cartId}`}
          className="text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>
          <p className="text-gray-600">Complete your order for Cart #{cart.id.slice(-8)}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      )}

      {hasInventoryIssues && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
            <p className="text-yellow-800">
              Some items in your cart have insufficient stock. Please review your cart before proceeding.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Checkout Form */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Client Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Client Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Company</label>
                  <p className="mt-1 text-sm text-gray-900">{cart.client.company_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Contact</label>
                  <p className="mt-1 text-sm text-gray-900">{cart.client.contact_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <p className="mt-1 text-sm text-gray-900">{cart.client.contact_email}</p>
                </div>
                {cart.client.contact_phone && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <p className="mt-1 text-sm text-gray-900">{cart.client.contact_phone}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Shipping Address */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Shipping Address</h2>
                {billingAddress && (
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={useBillingAddress}
                      onChange={(e) => setUseBillingAddress(e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Use billing address</span>
                  </label>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address Line 1 *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.shipping_address_line1}
                    onChange={(e) => setFormData(prev => ({ ...prev, shipping_address_line1: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    value={formData.shipping_address_line2}
                    onChange={(e) => setFormData(prev => ({ ...prev, shipping_address_line2: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.shipping_city}
                    onChange={(e) => setFormData(prev => ({ ...prev, shipping_city: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State/Province *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.shipping_state}
                    onChange={(e) => setFormData(prev => ({ ...prev, shipping_state: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Postal Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.shipping_postal_code}
                    onChange={(e) => setFormData(prev => ({ ...prev, shipping_postal_code: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country *
                  </label>
                  <select
                    required
                    value={formData.shipping_country}
                    onChange={(e) => setFormData(prev => ({ ...prev, shipping_country: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="GB">United Kingdom</option>
                    <option value="DE">Germany</option>
                    <option value="FR">France</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Payment Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Method *
                  </label>
                  <select
                    required
                    value={formData.payment_method}
                    onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="credit_terms">Credit Terms</option>
                    <option value="wire_transfer">Wire Transfer</option>
                    <option value="check">Check</option>
                    <option value="credit_card">Credit Card</option>
                  </select>
                </div>
                {cart.client.payment_terms && (
                  <div className="text-sm text-gray-600">
                    <strong>Default Payment Terms:</strong> {cart.client.payment_terms}
                  </div>
                )}
                {cart.client.credit_limit && (
                  <div className="text-sm text-gray-600">
                    <strong>Credit Limit:</strong> ${cart.client.credit_limit.toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            {/* Additional Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Purchase Order Number
                  </label>
                  <input
                    type="text"
                    value={formData.po_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, po_number: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Optional PO number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Delivery Notes
                  </label>
                  <textarea
                    value={formData.delivery_notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, delivery_notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Special delivery instructions..."
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="bg-white rounded-lg shadow p-6">
              <button
                type="submit"
                disabled={submitting || hasInventoryIssues}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
              >
                {submitting ? 'Processing Order...' : 'Complete Order'}
              </button>
              {hasInventoryIssues && (
                <p className="mt-2 text-sm text-red-600">
                  Cannot complete order due to inventory issues. Please update your cart.
                </p>
              )}
            </div>
          </form>
        </div>

        {/* Order Summary */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
            <div className="space-y-3">
              {cart.items.map((item) => (
                <div key={item.id} className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-900">{item.product.name}</h3>
                    <p className="text-xs text-gray-500">
                      {item.quantity} × ${item.unit_price.toFixed(2)}
                    </p>
                    {item.product.stock_quantity < item.quantity && (
                      <p className="text-xs text-red-600">
                        <AlertCircle className="h-3 w-3 inline mr-1" />
                        Stock: {item.product.stock_quantity}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    ${item.total_price.toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="border-t pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-base font-semibold text-gray-900">Total</span>
                  <span className="text-base font-bold text-gray-900">
                    {cart.currency} ${cart.total_amount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {billingAddress && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Billing Address</h2>
              <div className="text-sm text-gray-900">
                <pre className="whitespace-pre-line font-sans">{billingAddress}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}