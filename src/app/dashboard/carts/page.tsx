'use client'

import { useState, useEffect } from 'react'
import { useSubdomain } from '@/components/providers/SubdomainProvider'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Plus, Search, ShoppingCart, Eye, Trash2, Calendar, DollarSign, Package } from 'lucide-react'
import Link from 'next/link'

// Force dynamic rendering for this page since it uses auth
export const dynamic = 'force-dynamic'

interface Client {
  id: string
  company_name: string
  contact_name: string
  contact_email: string
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
  creator: {
    first_name: string | null
    last_name: string | null
    email: string
  } | null
}

interface CartFormData {
  client_id: string
  currency: string
  notes: string
}

export default function CartsPage() {
  const { currentOrganization, userRole, isLoading } = useSubdomain()
  const [carts, setCarts] = useState<Cart[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [clientsLoading, setClientsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState<CartFormData>({
    client_id: '',
    currency: 'USD',
    notes: ''
  })

  const canManageCarts = userRole === 'admin' || userRole === 'manager'

  useEffect(() => {
    if (currentOrganization) {
      fetchCarts()
      fetchClients()
    }
  }, [currentOrganization])

  const fetchCarts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/carts')
      
      if (!response.ok) {
        throw new Error('Failed to fetch carts')
      }
      
      const data = await response.json()
      setCarts(data.carts || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch carts')
    } finally {
      setLoading(false)
    }
  }

  const fetchClients = async () => {
    try {
      setClientsLoading(true)
      const response = await fetch('/api/clients')
      
      if (!response.ok) {
        throw new Error('Failed to fetch clients')
      }
      
      const data = await response.json()
      setClients(data.clients || [])
    } catch (err) {
      console.error('Error fetching clients:', err)
      setClients([])
    } finally {
      setClientsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canManageCarts) return

    try {
      setSubmitting(true)
      setError(null)

      const response = await fetch('/api/carts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: formData.client_id,
          currency: formData.currency,
          notes: formData.notes || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create cart')
      }

      await fetchCarts()
      setShowForm(false)
      resetFormData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create cart')
    } finally {
      setSubmitting(false)
    }
  }

  const resetFormData = () => {
    setFormData({
      client_id: '',
      currency: 'USD',
      notes: ''
    })
  }

  const handleDelete = async (cart: Cart) => {
    if (!canManageCarts) return
    
    if (!confirm(`Are you sure you want to delete cart #${cart.id.slice(-8)}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/carts/${cart.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete cart')
      }

      await fetchCarts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete cart')
    }
  }

  const filteredCarts = carts.filter(cart => {
    const matchesSearch = 
      cart.client.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cart.client.contact_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cart.client.contact_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cart.id.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || cart.status === statusFilter

    return matchesSearch && matchesStatus
  })

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

  const cartStats = {
    total: carts.length,
    active: carts.filter(c => c.status === 'active').length,
    completed: carts.filter(c => c.status === 'completed').length,
    totalValue: carts.reduce((sum, cart) => sum + cart.total_amount, 0)
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-2 text-sm text-gray-600">Loading carts...</p>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shopping Carts</h1>
          <p className="text-gray-600">Manage client shopping carts and checkout processes</p>
        </div>
        {canManageCarts && (
          <button
            onClick={() => {
              resetFormData()
              setShowForm(true)
            }}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Cart
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ShoppingCart className="h-8 w-8 text-gray-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Carts</p>
              <p className="text-2xl font-bold text-gray-900">{cartStats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Package className="h-8 w-8 text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Carts</p>
              <p className="text-2xl font-bold text-gray-900">{cartStats.active}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Calendar className="h-8 w-8 text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Completed</p>
              <p className="text-2xl font-bold text-gray-900">{cartStats.completed}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <DollarSign className="h-8 w-8 text-yellow-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Value</p>
              <p className="text-2xl font-bold text-gray-900">${cartStats.totalValue.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by client name, email, or cart ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="checkout">In Checkout</option>
          <option value="completed">Completed</option>
          <option value="abandoned">Abandoned</option>
        </select>
      </div>

      {/* Cart Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Create New Cart</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client *
                </label>
                {clientsLoading ? (
                  <div className="text-sm text-gray-500">Loading clients...</div>
                ) : (
                  <select
                    required
                    value={formData.client_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, client_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select a client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.company_name} ({client.contact_name})
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Currency
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="CAD">CAD</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Optional notes about this cart..."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Creating...' : 'Create Cart'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
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

      {/* Carts Table */}
      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Loading carts...</p>
          </div>
        ) : filteredCarts.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No carts found</h3>
            <p className="text-gray-600">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.' 
                : 'Get started by creating your first shopping cart.'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cart ID</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCarts.map((cart) => (
                <TableRow key={cart.id}>
                  <TableCell>
                    <div className="font-mono text-sm">
                      #{cart.id.slice(-8)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium text-gray-900">{cart.client.company_name}</div>
                      <div className="text-sm text-gray-500">{cart.client.contact_name}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(cart.status)}`}>
                      {cart.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Package className="h-4 w-4 text-gray-400 mr-2" />
                      <span>{cart.item_count} item{cart.item_count !== 1 ? 's' : ''}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {cart.currency} ${cart.total_amount.toFixed(2)}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {new Date(cart.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Link
                        href={`/dashboard/carts/${cart.id}`}
                        className="text-blue-600 hover:text-blue-900"
                        title="View cart"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      {canManageCarts && cart.status !== 'completed' && (
                        <button
                          onClick={() => handleDelete(cart)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete cart"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}