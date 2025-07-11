'use client'

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react'
import { useSubdomain } from './SubdomainProvider'

// Types
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
  items: CartItem[]
}

interface CartState {
  carts: Cart[]
  currentCart: Cart | null
  loading: boolean
  error: string | null
}

// Action types
type CartAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CARTS'; payload: Cart[] }
  | { type: 'SET_CURRENT_CART'; payload: Cart | null }
  | { type: 'ADD_CART'; payload: Cart }
  | { type: 'UPDATE_CART'; payload: Cart }
  | { type: 'DELETE_CART'; payload: string }
  | { type: 'ADD_ITEM_TO_CART'; payload: { cartId: string; item: CartItem } }
  | { type: 'UPDATE_CART_ITEM'; payload: { cartId: string; itemId: string; quantity: number } }
  | { type: 'REMOVE_ITEM_FROM_CART'; payload: { cartId: string; itemId: string } }
  | { type: 'CLEAR_CART'; payload: string }

// Initial state
const initialState: CartState = {
  carts: [],
  currentCart: null,
  loading: false,
  error: null
}

// Reducer
function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    
    case 'SET_CARTS':
      return { ...state, carts: action.payload, loading: false }
    
    case 'SET_CURRENT_CART':
      return { ...state, currentCart: action.payload }
    
    case 'ADD_CART':
      return {
        ...state,
        carts: [...state.carts, action.payload],
        currentCart: action.payload
      }
    
    case 'UPDATE_CART':
      return {
        ...state,
        carts: state.carts.map(cart => 
          cart.id === action.payload.id ? action.payload : cart
        ),
        currentCart: state.currentCart?.id === action.payload.id 
          ? action.payload 
          : state.currentCart
      }
    
    case 'DELETE_CART':
      return {
        ...state,
        carts: state.carts.filter(cart => cart.id !== action.payload),
        currentCart: state.currentCart?.id === action.payload 
          ? null 
          : state.currentCart
      }
    
    case 'ADD_ITEM_TO_CART': {
      const { cartId, item } = action.payload
      const updatedCarts = state.carts.map(cart => {
        if (cart.id === cartId) {
          const newItems = [...cart.items, item]
          return {
            ...cart,
            items: newItems,
            item_count: newItems.length,
            total_amount: newItems.reduce((sum, i) => sum + i.total_price, 0)
          }
        }
        return cart
      })
      
      return {
        ...state,
        carts: updatedCarts,
        currentCart: state.currentCart?.id === cartId 
          ? updatedCarts.find(c => c.id === cartId) || null
          : state.currentCart
      }
    }
    
    case 'UPDATE_CART_ITEM': {
      const { cartId, itemId, quantity } = action.payload
      const updatedCarts = state.carts.map(cart => {
        if (cart.id === cartId) {
          const newItems = cart.items.map(item => {
            if (item.id === itemId) {
              const newTotalPrice = item.unit_price * quantity
              return { ...item, quantity, total_price: newTotalPrice }
            }
            return item
          })
          return {
            ...cart,
            items: newItems,
            item_count: newItems.reduce((sum, i) => sum + i.quantity, 0),
            total_amount: newItems.reduce((sum, i) => sum + i.total_price, 0)
          }
        }
        return cart
      })
      
      return {
        ...state,
        carts: updatedCarts,
        currentCart: state.currentCart?.id === cartId 
          ? updatedCarts.find(c => c.id === cartId) || null
          : state.currentCart
      }
    }
    
    case 'REMOVE_ITEM_FROM_CART': {
      const { cartId, itemId } = action.payload
      const updatedCarts = state.carts.map(cart => {
        if (cart.id === cartId) {
          const newItems = cart.items.filter(item => item.id !== itemId)
          return {
            ...cart,
            items: newItems,
            item_count: newItems.length,
            total_amount: newItems.reduce((sum, i) => sum + i.total_price, 0)
          }
        }
        return cart
      })
      
      return {
        ...state,
        carts: updatedCarts,
        currentCart: state.currentCart?.id === cartId 
          ? updatedCarts.find(c => c.id === cartId) || null
          : state.currentCart
      }
    }
    
    case 'CLEAR_CART': {
      const cartId = action.payload
      const updatedCarts = state.carts.map(cart => {
        if (cart.id === cartId) {
          return {
            ...cart,
            items: [],
            item_count: 0,
            total_amount: 0
          }
        }
        return cart
      })
      
      return {
        ...state,
        carts: updatedCarts,
        currentCart: state.currentCart?.id === cartId 
          ? updatedCarts.find(c => c.id === cartId) || null
          : state.currentCart
      }
    }
    
    default:
      return state
  }
}

// Context
interface CartContextType {
  state: CartState
  // Cart operations
  fetchCarts: () => Promise<void>
  fetchCart: (cartId: string) => Promise<void>
  createCart: (clientId: string, currency?: string, notes?: string) => Promise<Cart>
  updateCart: (cartId: string, updates: Partial<Cart>) => Promise<void>
  deleteCart: (cartId: string) => Promise<void>
  
  // Cart item operations
  addItemToCart: (cartId: string, productId: string, quantity: number) => Promise<void>
  updateCartItem: (cartId: string, itemId: string, quantity: number) => Promise<void>
  removeItemFromCart: (cartId: string, itemId: string) => Promise<void>
  clearCart: (cartId: string) => Promise<void>
  
  // Checkout
  checkout: (cartId: string, checkoutData: Record<string, unknown>) => Promise<Record<string, unknown>>
  
  // Utility functions
  getCartTotal: (cartId: string) => number
  getCartItemCount: (cartId: string) => number
  isCartEmpty: (cartId: string) => boolean
  canCheckout: (cartId: string) => boolean
}

const CartContext = createContext<CartContextType | undefined>(undefined)

// Provider component
interface CartProviderProps {
  children: React.ReactNode
}

export function CartProvider({ children }: CartProviderProps) {
  const [state, dispatch] = useReducer(cartReducer, initialState)
  const { currentOrganization } = useSubdomain()

  // Fetch all carts
  const fetchCarts = useCallback(async () => {
    if (!currentOrganization) return

    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      dispatch({ type: 'SET_ERROR', payload: null })

      const response = await fetch('/api/carts')
      if (!response.ok) {
        throw new Error('Failed to fetch carts')
      }

      const data = await response.json()
      dispatch({ type: 'SET_CARTS', payload: data.carts || [] })
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to fetch carts' })
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [currentOrganization])

  // Fetch single cart
  const fetchCart = useCallback(async (cartId: string) => {
    if (!currentOrganization) return

    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      dispatch({ type: 'SET_ERROR', payload: null })

      const response = await fetch(`/api/carts/${cartId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch cart')
      }

      const data = await response.json()
      dispatch({ type: 'SET_CURRENT_CART', payload: data.cart })
      dispatch({ type: 'UPDATE_CART', payload: data.cart })
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to fetch cart' })
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [currentOrganization])

  // Create new cart
  const createCart = useCallback(async (clientId: string, currency = 'USD', notes = '') => {
    if (!currentOrganization) throw new Error('No organization context')

    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      dispatch({ type: 'SET_ERROR', payload: null })

      const response = await fetch('/api/carts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          currency,
          notes: notes || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create cart')
      }

      const data = await response.json()
      dispatch({ type: 'ADD_CART', payload: data.cart })
      return data.cart
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to create cart' })
      throw error
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [currentOrganization])

  // Update cart
  const updateCart = useCallback(async (cartId: string, updates: Partial<Cart>) => {
    try {
      dispatch({ type: 'SET_ERROR', payload: null })

      const response = await fetch(`/api/carts/${cartId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update cart')
      }

      const data = await response.json()
      dispatch({ type: 'UPDATE_CART', payload: data.cart })
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to update cart' })
      throw error
    }
  }, [])

  // Delete cart
  const deleteCart = useCallback(async (cartId: string) => {
    try {
      dispatch({ type: 'SET_ERROR', payload: null })

      const response = await fetch(`/api/carts/${cartId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete cart')
      }

      dispatch({ type: 'DELETE_CART', payload: cartId })
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to delete cart' })
      throw error
    }
  }, [])

  // Add item to cart
  const addItemToCart = useCallback(async (cartId: string, productId: string, quantity: number) => {
    try {
      dispatch({ type: 'SET_ERROR', payload: null })

      const response = await fetch(`/api/carts/${cartId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, quantity })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add item to cart')
      }

      const data = await response.json()
      dispatch({ type: 'ADD_ITEM_TO_CART', payload: { cartId, item: data.item } })
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to add item to cart' })
      throw error
    }
  }, [])

  // Update cart item
  const updateCartItem = useCallback(async (cartId: string, itemId: string, quantity: number) => {
    try {
      dispatch({ type: 'SET_ERROR', payload: null })

      const response = await fetch(`/api/carts/${cartId}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update cart item')
      }

      dispatch({ type: 'UPDATE_CART_ITEM', payload: { cartId, itemId, quantity } })
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to update cart item' })
      throw error
    }
  }, [])

  // Remove item from cart
  const removeItemFromCart = useCallback(async (cartId: string, itemId: string) => {
    try {
      dispatch({ type: 'SET_ERROR', payload: null })

      const response = await fetch(`/api/carts/${cartId}/items/${itemId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to remove item from cart')
      }

      dispatch({ type: 'REMOVE_ITEM_FROM_CART', payload: { cartId, itemId } })
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to remove item from cart' })
      throw error
    }
  }, [])

  // Clear cart
  const clearCart = useCallback(async (cartId: string) => {
    try {
      dispatch({ type: 'SET_ERROR', payload: null })

      const response = await fetch(`/api/carts/${cartId}/clear`, {
        method: 'POST'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to clear cart')
      }

      dispatch({ type: 'CLEAR_CART', payload: cartId })
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to clear cart' })
      throw error
    }
  }, [])

  // Checkout
  const checkout = useCallback(async (cartId: string, checkoutData: Record<string, unknown>) => {
    try {
      dispatch({ type: 'SET_ERROR', payload: null })

      const response = await fetch(`/api/carts/${cartId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to checkout')
      }

      const data = await response.json()
      
      // Update cart status to completed
      const updatedCart = { ...state.currentCart, status: 'completed' } as Cart
      dispatch({ type: 'UPDATE_CART', payload: updatedCart })
      
      return data
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to checkout' })
      throw error
    }
  }, [state.currentCart])

  // Utility functions
  const getCartTotal = useCallback((cartId: string) => {
    const cart = state.carts.find(c => c.id === cartId)
    return cart ? cart.total_amount : 0
  }, [state.carts])

  const getCartItemCount = useCallback((cartId: string) => {
    const cart = state.carts.find(c => c.id === cartId)
    return cart ? cart.item_count : 0
  }, [state.carts])

  const isCartEmpty = useCallback((cartId: string) => {
    const cart = state.carts.find(c => c.id === cartId)
    return !cart || cart.items.length === 0
  }, [state.carts])

  const canCheckout = useCallback((cartId: string) => {
    const cart = state.carts.find(c => c.id === cartId)
    return !!(cart && cart.status === 'active' && cart.items.length > 0 && 
           cart.items.every(item => item.product.stock_quantity >= item.quantity))
  }, [state.carts])

  // Auto-fetch carts when organization changes
  useEffect(() => {
    if (currentOrganization) {
      fetchCarts()
    }
  }, [currentOrganization, fetchCarts])

  const contextValue: CartContextType = {
    state,
    fetchCarts,
    fetchCart,
    createCart,
    updateCart,
    deleteCart,
    addItemToCart,
    updateCartItem,
    removeItemFromCart,
    clearCart,
    checkout,
    getCartTotal,
    getCartItemCount,
    isCartEmpty,
    canCheckout
  }

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  )
}

// Custom hook to use cart context
export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}

// Export types for external use
export type { Cart, CartItem, Product, CartState }