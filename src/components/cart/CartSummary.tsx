import React from 'react'
import { ShoppingCart, Package, DollarSign, Calendar } from 'lucide-react'
import { Card, CardHeader, CardBody, Badge } from '@/components/ui'
import { Cart } from '@/components/providers/CartProvider'

interface Client {
  id: string
  company_name: string
  contact_name: string
  contact_email: string
}

interface CartWithClient extends Cart {
  client?: Client
}
import Link from 'next/link'

interface CartSummaryProps {
  cart: CartWithClient
  showActions?: boolean
  className?: string
}

export function CartSummary({ 
  cart, 
  showActions = false, 
  className = '' 
}: CartSummaryProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success'
      case 'completed':
        return 'info'
      case 'abandoned':
        return 'default'
      case 'checkout':
        return 'warning'
      default:
        return 'default'
    }
  }

  return (
    <Card className={className} hover>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ShoppingCart className="h-5 w-5 text-gray-400" />
            <div>
              <h3 className="font-medium text-gray-900">
                Cart #{cart.id.slice(-8)}
              </h3>
              <p className="text-sm text-gray-600">
                {cart.client ? `${cart.client.company_name}` : 'Unknown Client'}
              </p>
            </div>
          </div>
          <Badge variant={getStatusColor(cart.status)} size="sm">
            {cart.status}
          </Badge>
        </div>
      </CardHeader>
      
      <CardBody>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center space-x-2">
            <Package className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600">
              {cart.item_count} item{cart.item_count !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <DollarSign className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-900">
              {cart.currency} ${cart.total_amount.toFixed(2)}
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <Calendar className="h-3 w-3" />
          <span>Updated {new Date(cart.updated_at).toLocaleDateString()}</span>
        </div>
        
        {cart.notes && (
          <div className="mt-3 p-2 bg-gray-50 rounded text-sm text-gray-700">
            {cart.notes}
          </div>
        )}
      </CardBody>
      
      {showActions && (
        <div className="px-6 py-4 bg-gray-50 border-t rounded-b-lg">
          <div className="flex space-x-2">
            <Link
              href={`/dashboard/carts/${cart.id}`}
              className="flex-1 text-center px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              View Cart
            </Link>
            {cart.status === 'active' && cart.item_count > 0 && (
              <Link
                href={`/dashboard/checkout/${cart.id}`}
                className="flex-1 text-center px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                Checkout
              </Link>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}