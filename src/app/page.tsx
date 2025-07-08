'use client'

import { useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useSubdomain } from '@/components/providers/SubdomainProvider'
import { Building2 } from 'lucide-react'
import Link from 'next/link'

export default function Home() {
  const { isSignedIn, isLoaded } = useAuth()
  const { userMemberships, switchToOrganization, subdomainInfo, isLoading } = useSubdomain()

  useEffect(() => {
    // Only redirect if we're on the main domain (no subdomain) and user is signed in
    if (isSignedIn && !subdomainInfo.isValid && userMemberships.length > 0 && !isLoading) {
      console.log('Auto-redirect logic triggered:', { 
        userMemberships: userMemberships.length, 
        subdomainInfo 
      })
      
      if (userMemberships.length === 1) {
        // Single organization - auto-redirect
        const orgSubdomain = userMemberships[0].organization?.subdomain
        if (orgSubdomain) {
          console.log('Auto-redirecting to:', orgSubdomain)
          switchToOrganization(orgSubdomain)
        }
      }
      // If multiple organizations, let user choose (don't auto-redirect)
    }
  }, [isSignedIn, userMemberships, switchToOrganization, subdomainInfo, isLoading])

  useEffect(() => {
    // Handle valid subdomain access - redirect to dashboard if user has access
    if (isSignedIn && subdomainInfo.isValid && userMemberships.length > 0 && !isLoading) {
      console.log('Valid subdomain detected:', subdomainInfo.subdomain)
      
      // Check if user has access to this specific organization
      const hasAccessToCurrentOrg = userMemberships.some(
        membership => membership.organization?.subdomain === subdomainInfo.subdomain
      )
      
      if (hasAccessToCurrentOrg) {
        console.log('User has access to current organization, redirecting to dashboard')
        window.location.href = '/dashboard'
      } else {
        console.log('User does not have access to current organization')
        // If user has other organizations, redirect to the first available one
        if (userMemberships.length > 0) {
          const firstOrgSubdomain = userMemberships[0].organization?.subdomain
          if (firstOrgSubdomain) {
            console.log('Redirecting to accessible organization:', firstOrgSubdomain)
            switchToOrganization(firstOrgSubdomain)
          }
        }
      }
    }
  }, [isSignedIn, subdomainInfo, userMemberships, isLoading, switchToOrganization])

  // Show loading while auth is loading
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // If not signed in, show sign-in prompt
  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <Building2 className="h-16 w-16 text-blue-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">B2B E-commerce Platform</h1>
          <p className="text-gray-600 mb-6">Sign in to access your organization&apos;s dashboard</p>
          <Link
            href="/sign-in"
            className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  // If signed in but no organizations, show error
  if (userMemberships.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="rounded-full bg-orange-100 w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-orange-600" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">No Organizations Found</h1>
          <p className="text-gray-600 mb-4">
            You don&apos;t belong to any organizations yet. Contact your administrator to get access.
          </p>
        </div>
      </div>
    )
  }

  // If multiple organizations, show selection
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-md mx-auto p-6">
        <Building2 className="h-16 w-16 text-blue-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Select Organization</h1>
        <p className="text-gray-600 mb-6">Choose an organization to continue:</p>
        <div className="space-y-3">
          {userMemberships.map((membership) => (
            <button
              key={membership.id}
              onClick={() => switchToOrganization(membership.organization?.subdomain || '')}
              className="block w-full text-left px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-sm font-medium text-blue-800">
                    {membership.organization?.name?.charAt(0).toUpperCase() || 'O'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {membership.organization?.name}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {membership.role}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
