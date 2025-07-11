'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useSubdomain } from '@/components/providers/SubdomainProvider'
import { OrganizationSwitcher } from '@/components/OrganizationSwitcher'
import { Package, ShoppingCart, UserCheck, Calendar, DollarSign } from 'lucide-react'
import Link from 'next/link'

// Force dynamic rendering for this page since it uses auth
export const dynamic = 'force-dynamic'

interface DashboardStats {
  products: number
  orders: number
  clients: number
  carts: number
  revenue: number
}

export default function DashboardPage() {
  const { user: clerkUser } = useUser()
  const { currentOrganization, userRole, isLoading } = useSubdomain()
  const [stats, setStats] = useState<DashboardStats>({
    products: 0,
    orders: 0,
    clients: 0,
    carts: 0,
    revenue: 0
  })
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    if (currentOrganization) {
      fetchDashboardStats()
    }
  }, [currentOrganization])

  const fetchDashboardStats = async () => {
    try {
      setStatsLoading(true)
      const [productsRes, ordersRes, clientsRes, cartsRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/orders'),
        fetch('/api/clients'),
        fetch('/api/carts')
      ])

      const [productsData, ordersData, clientsData, cartsData] = await Promise.all([
        productsRes.json(),
        ordersRes.json(),
        clientsRes.json(),
        cartsRes.json()
      ])

      const revenue = ordersData.orders?.reduce((sum: number, order: { total_amount: number }) => sum + order.total_amount, 0) || 0

      setStats({
        products: productsData.products?.length || 0,
        orders: ordersData.orders?.length || 0,
        clients: clientsData.clients?.length || 0,
        carts: cartsData.carts?.length || 0,
        revenue
      })
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    } finally {
      setStatsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-2 text-sm text-gray-600">Loading dashboard...</p>
      </div>
    )
  }

  if (!currentOrganization || !userRole) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Unable to load organization data</p>
        <p className="text-sm text-gray-500 mt-2">Please check your access permissions</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {clerkUser?.firstName || 'User'}!
          </h1>
          <p className="text-gray-600 mt-2">
            Organization: {currentOrganization.name}
          </p>
          <p className="text-sm text-gray-500">
            Role: {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
          </p>
        </div>
        <OrganizationSwitcher />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Package className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Products</p>
              <p className="text-2xl font-bold text-gray-900">
                {statsLoading ? '...' : stats.products}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <UserCheck className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Clients</p>
              <p className="text-2xl font-bold text-gray-900">
                {statsLoading ? '...' : stats.clients}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <ShoppingCart className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Carts</p>
              <p className="text-2xl font-bold text-gray-900">
                {statsLoading ? '...' : stats.carts}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-orange-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Orders</p>
              <p className="text-2xl font-bold text-gray-900">
                {statsLoading ? '...' : stats.orders}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-emerald-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                {statsLoading ? '...' : `$${stats.revenue.toFixed(2)}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/dashboard/products" className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
              <Package className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900">Manage Products</p>
              <p className="text-xs text-gray-500">View and manage your product catalog</p>
            </Link>
            
            <Link href="/dashboard/clients" className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
              <UserCheck className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900">Manage Clients</p>
              <p className="text-xs text-gray-500">Add and manage B2B clients</p>
            </Link>
            
            <Link href="/dashboard/carts" className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
              <ShoppingCart className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900">Shopping Carts</p>
              <p className="text-xs text-gray-500">Create and manage client carts</p>
            </Link>
            
            <Link href="/dashboard/orders" className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
              <Calendar className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900">View Orders</p>
              <p className="text-xs text-gray-500">Track and manage customer orders</p>
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
        </div>
        <div className="p-6">
          <p className="text-gray-500 text-center py-8">
            No recent activity to show. Start by adding products or creating orders.
          </p>
        </div>
      </div>
    </div>
  )
}