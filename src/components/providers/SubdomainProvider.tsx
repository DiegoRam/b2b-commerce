'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useOrganization } from '@/hooks/useOrganization'
import type { OrganizationContext } from '@/types'

// Create the context
const SubdomainContext = createContext<OrganizationContext | undefined>(undefined)

// Provider props
interface SubdomainProviderProps {
  children: React.ReactNode
}

// Provider component
export function SubdomainProvider({ children }: SubdomainProviderProps) {
  const organizationData = useOrganization()
  const { isSignedIn, isLoaded } = useAuth()
  const [mounted, setMounted] = useState(false)

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true)
  }, [])

  // Show loading state while auth is loading or component is mounting
  if (!mounted || !isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Handle organization access validation for signed-in users
  if (isSignedIn && organizationData.subdomainInfo.isValid) {
    // Show loading while organization data is being fetched
    if (organizationData.isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">
              Loading {organizationData.subdomainInfo.subdomain} organization...
            </p>
          </div>
        </div>
      )
    }

    // Show access denied if user doesn't have access to this organization
    if (!organizationData.hasAccess) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="rounded-full bg-red-100 w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600 mb-4">
              You don&apos;t have access to the &quot;{organizationData.subdomainInfo.subdomain}&quot; organization.
            </p>
            {organizationData.userMemberships.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-gray-500">You have access to:</p>
                <div className="space-y-1">
                  {organizationData.userMemberships.map((membership) => (
                    <button
                      key={membership.id}
                      onClick={() => organizationData.switchToOrganization(membership.organization?.subdomain || '')}
                      className="block w-full text-center px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      {membership.organization?.name} ({membership.role})
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )
    }
  }

  // Handle invalid subdomain for signed-in users
  if (isSignedIn && !organizationData.subdomainInfo.isValid && organizationData.userMemberships.length > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-4">Select Organization</h1>
          <p className="text-gray-600 mb-6">Choose an organization to continue:</p>
          <div className="space-y-2">
            {organizationData.userMemberships.map((membership) => (
              <button
                key={membership.id}
                onClick={() => organizationData.switchToOrganization(membership.organization?.subdomain || '')}
                className="block w-full text-center px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                {membership.organization?.name} ({membership.role})
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Render children with context
  return (
    <SubdomainContext.Provider value={organizationData}>
      {children}
    </SubdomainContext.Provider>
  )
}

// Custom hook to use the subdomain context
export function useSubdomain(): OrganizationContext {
  const context = useContext(SubdomainContext)
  if (context === undefined) {
    throw new Error('useSubdomain must be used within a SubdomainProvider')
  }
  return context
}

// Export context for advanced usage
export { SubdomainContext }