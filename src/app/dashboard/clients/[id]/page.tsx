'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSubdomain } from '@/components/providers/SubdomainProvider'
import { ArrowLeft, Edit2, RotateCcw, ShoppingCart, Plus, AlertCircle, CheckCircle, Building2, Mail, Phone, MapPin, CreditCard, Calendar } from 'lucide-react'
import Link from 'next/link'

// Force dynamic rendering for this page since it uses auth
export const dynamic = 'force-dynamic'

interface Client {
  id: string
  organization_id: string
  medusa_customer_id: string | null
  company_name: string
  contact_name: string
  contact_email: string
  contact_phone: string | null
  tax_id: string | null
  business_type: string | null
  industry: string | null
  billing_address_line1: string | null
  billing_address_line2: string | null
  billing_city: string | null
  billing_state: string | null
  billing_postal_code: string | null
  billing_country: string | null
  shipping_address_line1: string | null
  shipping_address_line2: string | null
  shipping_city: string | null
  shipping_state: string | null
  shipping_postal_code: string | null
  shipping_country: string | null
  payment_terms: string | null
  credit_limit: number | null
  preferred_currency: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  creator: {
    first_name: string | null
    last_name: string | null
    email: string
  } | null
}

interface Cart {
  id: string
  status: string
  currency: string
  total_amount: number
  item_count: number
  created_at: string
  updated_at: string
}

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const clientId = params.id as string
  const { currentOrganization, userRole, isLoading } = useSubdomain()
  const [client, setClient] = useState<Client | null>(null)
  const [carts, setCarts] = useState<Cart[]>([])
  const [loading, setLoading] = useState(true)
  const [cartsLoading, setCartsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [creatingCart, setCreatingCart] = useState(false)

  const canManageClients = userRole === 'admin' || userRole === 'manager'

  const fetchClient = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/clients/${clientId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch client')
      }
      
      const data = await response.json()
      setClient(data.client)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch client')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  const fetchClientCarts = useCallback(async () => {
    try {
      setCartsLoading(true)
      const response = await fetch(`/api/carts?client_id=${clientId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch carts')
      }
      
      const data = await response.json()
      setCarts(data.carts || [])
    } catch (err) {
      console.error('Error fetching carts:', err)
      setCarts([])
    } finally {
      setCartsLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    if (currentOrganization && clientId) {
      fetchClient()
      fetchClientCarts()
    }
  }, [currentOrganization, clientId, fetchClient, fetchClientCarts])

  const handleSync = async () => {
    if (!canManageClients || !client) return

    try {
      setSyncing(true)
      const response = await fetch(`/api/clients/${client.id}/sync`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to sync client')
      }

      await fetchClient()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync client')
    } finally {
      setSyncing(false)
    }
  }

  const handleCreateCart = async () => {
    if (!client) return

    try {
      setCreatingCart(true)
      const response = await fetch('/api/carts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: client.id,
          currency: client.preferred_currency || 'USD'
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create cart')
      }

      const data = await response.json()
      // Redirect to the new cart
      router.push(`/dashboard/carts/${data.cart.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create cart')
    } finally {
      setCreatingCart(false)
    }
  }

  if (isLoading || loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-2 text-sm text-gray-600">Loading client details...</p>
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

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Client not found</p>
        <Link 
          href="/dashboard/clients"
          className="text-blue-600 hover:text-blue-900 mt-2 inline-block"
        >
          Back to Clients
        </Link>
      </div>
    )
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

  const billingAddress = formatAddress(
    client.billing_address_line1,
    client.billing_address_line2,
    client.billing_city,
    client.billing_state,
    client.billing_postal_code,
    client.billing_country
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link 
            href="/dashboard/clients"
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{client.company_name}</h1>
            <p className="text-gray-600">Client Details</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {canManageClients && (
            <>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex items-center px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50 transition-colors"
              >
                <RotateCcw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync'}
              </button>
              <Link
                href={`/dashboard/clients/${client.id}/edit`}
                className="inline-flex items-center px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </Link>
            </>
          )}
          <button
            onClick={handleCreateCart}
            disabled={creatingCart}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            {creatingCart ? 'Creating...' : 'Create Cart'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Client Information Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>
            {client.medusa_customer_id ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Synced
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                <AlertCircle className="h-3 w-3 mr-1" />
                Pending Sync
              </span>
            )}
          </div>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Building2 className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-500">Company Name</p>
                <p className="text-gray-900">{client.company_name}</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-500">Contact</p>
                <p className="text-gray-900">{client.contact_name}</p>
                <p className="text-sm text-gray-600">{client.contact_email}</p>
              </div>
            </div>
            {client.contact_phone && (
              <div className="flex items-start space-x-3">
                <Phone className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Phone</p>
                  <p className="text-gray-900">{client.contact_phone}</p>
                </div>
              </div>
            )}
            {client.industry && (
              <div className="flex items-start space-x-3">
                <Building2 className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Industry</p>
                  <p className="text-gray-900">{client.industry}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Business Information */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Business Information</h2>
          <div className="space-y-4">
            {client.tax_id && (
              <div>
                <p className="text-sm font-medium text-gray-500">Tax ID</p>
                <p className="text-gray-900">{client.tax_id}</p>
              </div>
            )}
            {client.business_type && (
              <div>
                <p className="text-sm font-medium text-gray-500">Business Type</p>
                <p className="text-gray-900">{client.business_type}</p>
              </div>
            )}
            {client.payment_terms && (
              <div>
                <p className="text-sm font-medium text-gray-500">Payment Terms</p>
                <p className="text-gray-900">{client.payment_terms}</p>
              </div>
            )}
            {client.credit_limit && (
              <div className="flex items-start space-x-3">
                <CreditCard className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Credit Limit</p>
                  <p className="text-gray-900">${client.credit_limit.toLocaleString()}</p>
                </div>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-500">Preferred Currency</p>
              <p className="text-gray-900">{client.preferred_currency || 'USD'}</p>
            </div>
          </div>
        </div>

        {/* Billing Address */}
        {billingAddress && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Billing Address</h2>
            <div className="flex items-start space-x-3">
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <pre className="text-gray-900 whitespace-pre-line font-sans">{billingAddress}</pre>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {client.notes && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
            <p className="text-gray-900 whitespace-pre-line">{client.notes}</p>
          </div>
        )}
      </div>

      {/* Client Carts */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Client Carts</h2>
          <div className="text-sm text-gray-500">
            {carts.length} cart{carts.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="p-6">
          {cartsLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">Loading carts...</p>
            </div>
          ) : carts.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No carts yet</h3>
              <p className="text-gray-600 mb-4">This client doesn&apos;t have any carts yet.</p>
              <button
                onClick={handleCreateCart}
                disabled={creatingCart}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Cart
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {carts.map((cart) => (
                <div key={cart.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${
                      cart.status === 'active' ? 'bg-green-500' :
                      cart.status === 'completed' ? 'bg-blue-500' :
                      'bg-gray-400'
                    }`}></div>
                    <div>
                      <p className="font-medium text-gray-900">Cart #{cart.id.slice(-8)}</p>
                      <p className="text-sm text-gray-500">
                        {cart.item_count} item{cart.item_count !== 1 ? 's' : ''} • {cart.currency} ${cart.total_amount.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className={`text-sm font-medium capitalize ${
                        cart.status === 'active' ? 'text-green-600' :
                        cart.status === 'completed' ? 'text-blue-600' :
                        'text-gray-600'
                      }`}>
                        {cart.status}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(cart.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Link
                      href={`/dashboard/carts/${cart.id}`}
                      className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                    >
                      View →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Metadata</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium text-gray-500">Created</p>
            <p className="text-gray-900 flex items-center">
              <Calendar className="h-4 w-4 mr-2" />
              {new Date(client.created_at).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="font-medium text-gray-500">Last Updated</p>
            <p className="text-gray-900 flex items-center">
              <Calendar className="h-4 w-4 mr-2" />
              {new Date(client.updated_at).toLocaleString()}
            </p>
          </div>
          {client.creator && (
            <div>
              <p className="font-medium text-gray-500">Created By</p>
              <p className="text-gray-900">
                {client.creator.first_name} {client.creator.last_name}
              </p>
              <p className="text-xs text-gray-500">{client.creator.email}</p>
            </div>
          )}
          {client.medusa_customer_id && (
            <div>
              <p className="font-medium text-gray-500">MedusaJS Customer ID</p>
              <p className="text-gray-900 font-mono text-xs">{client.medusa_customer_id}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}