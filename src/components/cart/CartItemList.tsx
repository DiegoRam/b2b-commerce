import React from 'react'
import { Package, Plus, Minus, Trash2, AlertCircle } from 'lucide-react'
import { CartItem } from '@/components/providers/CartProvider'
import { Badge } from '@/components/ui'

interface CartItemListProps {
  items: CartItem[]
  onUpdateQuantity?: (itemId: string, quantity: number) => void
  onRemoveItem?: (itemId: string) => void
  readonly?: boolean
  updating?: string | null
  className?: string
}

export function CartItemList({ 
  items, 
  onUpdateQuantity, 
  onRemoveItem,
  readonly = false,
  updating = null,
  className = '' 
}: CartItemListProps) {
  if (items.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No items in cart</h3>
        <p className="text-gray-600">Add some products to get started.</p>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              <Package className="h-8 w-8 text-gray-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">{item.product.name}</h3>
              {item.product.description && (
                <p className="text-sm text-gray-600 mt-1">{item.product.description}</p>
              )}
              {item.product.sku && (
                <p className="text-xs text-gray-500 mt-1">SKU: {item.product.sku}</p>
              )}
              <div className="flex items-center space-x-2 mt-2">
                <span className="text-sm font-medium text-gray-900">
                  ${item.unit_price.toFixed(2)} each
                </span>
                {item.product.stock_quantity < item.quantity && (
                  <Badge variant="error" size="sm">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Low stock
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Quantity Controls */}
            <div className="flex items-center space-x-2">
              {!readonly && onUpdateQuantity && (
                <button
                  onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                  disabled={updating === item.id || item.quantity <= 1}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Decrease quantity"
                >
                  <Minus className="h-4 w-4" />
                </button>
              )}
              <span className="w-8 text-center font-medium text-gray-900">
                {item.quantity}
              </span>
              {!readonly && onUpdateQuantity && (
                <button
                  onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                  disabled={updating === item.id || item.quantity >= item.product.stock_quantity}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Increase quantity"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>
            
            {/* Total Price */}
            <div className="text-right min-w-[80px]">
              <p className="font-medium text-gray-900">
                ${item.total_price.toFixed(2)}
              </p>
              {item.product.stock_quantity < item.quantity && (
                <p className="text-xs text-red-600">
                  Stock: {item.product.stock_quantity}
                </p>
              )}
            </div>
            
            {/* Remove Button */}
            {!readonly && onRemoveItem && (
              <button
                onClick={() => onRemoveItem(item.id)}
                className="text-red-600 hover:text-red-900 p-1"
                title="Remove item"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}