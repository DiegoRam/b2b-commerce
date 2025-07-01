'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { createSupabaseBrowserClient } from '@/lib/supabase-client'
import type { 
  Organization, 
  OrganizationMembership, 
  UserRole, 
  OrganizationContext,
  SubdomainInfo 
} from '@/types'

export function useOrganization(): OrganizationContext {
  const { userId, isLoaded } = useAuth()
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null)
  const [userMemberships, setUserMemberships] = useState<OrganizationMembership[]>([])
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [subdomainInfo, setSubdomainInfo] = useState<SubdomainInfo>({
    subdomain: '',
    isValid: false,
    organization: null
  })

  // Get subdomain from current hostname
  const getSubdomainInfo = (): SubdomainInfo => {
    if (typeof window === 'undefined') {
      return { subdomain: '', isValid: false, organization: null }
    }

    const hostname = window.location.hostname
    let subdomain = ''
    
    // Extract subdomain (skip for localhost and www)
    if (!hostname.includes('localhost') && !hostname.startsWith('www.')) {
      subdomain = hostname.split('.')[0]
    } else if (hostname.includes('localhost')) {
      // For local development, extract subdomain from hostname like 'educabot.localhost:3000'
      const parts = hostname.split('.')
      if (parts.length > 1 && parts[0] !== 'localhost') {
        subdomain = parts[0]
      }
    }

    return {
      subdomain,
      isValid: subdomain.length > 0,
      organization: null
    }
  }

  // Initialize subdomain detection and data fetching
  useEffect(() => {
    if (!isLoaded) return

    // Fetch organization data based on subdomain
    const fetchOrganizationData = async (subdomain: string) => {
      if (!subdomain || !userId) return

      const supabase = createSupabaseBrowserClient()

      try {
        // Fetch organization by subdomain
        const { data: organization, error: orgError } = await supabase
          .from('organizations')
          .select('*')
          .eq('subdomain', subdomain)
          .eq('is_active', true)
          .single()

        if (orgError || !organization) {
          console.error('Organization not found for subdomain:', subdomain)
          setCurrentOrganization(null)
          setUserRole(null)
          return
        }

        setCurrentOrganization(organization)

        // Fetch user's memberships across all organizations
        const { data: userMembershipsData, error: membershipsError } = await supabase
          .from('organization_memberships')
          .select(`
            id,
            user_id,
            organization_id,
            role,
            is_active,
            joined_at,
            organization:organizations (
              id,
              clerk_org_id,
              name,
              subdomain,
              domain,
              logo_url,
              settings,
              is_active,
              created_at,
              updated_at
            ),
            user:users!inner (
              id,
              clerk_user_id,
              email,
              first_name,
              last_name,
              avatar_url,
              is_active,
              last_sign_in_at,
              created_at,
              updated_at
            )
          `)
          .eq('users.clerk_user_id', userId)
          .eq('is_active', true)

        if (membershipsError) {
          console.error('Error fetching user memberships:', membershipsError)
          setUserMemberships([])
          return
        }

        // Transform the data to match our expected type structure
        const transformedMemberships = (userMembershipsData || []).map(membership => ({
          ...membership,
          organization: Array.isArray(membership.organization) 
            ? membership.organization[0] 
            : membership.organization,
          user: Array.isArray(membership.user) 
            ? membership.user[0] 
            : membership.user
        }))
        
        setUserMemberships(transformedMemberships)

        // Find user's role in current organization
        const currentMembership = transformedMemberships.find(
          membership => membership.organization?.id === organization.id
        )

        if (currentMembership) {
          setUserRole(currentMembership.role)
        } else {
          console.warn('User does not have access to this organization')
          setUserRole(null)
        }

      } catch (error) {
        console.error('Error fetching organization data:', error)
        setCurrentOrganization(null)
        setUserMemberships([])
        setUserRole(null)
      }
    }

    const info = getSubdomainInfo()
    setSubdomainInfo(info)

    if (info.isValid && userId) {
      setIsLoading(true)
      fetchOrganizationData(info.subdomain).finally(() => {
        setIsLoading(false)
      })
    } else {
      setIsLoading(false)
    }
  }, [userId, isLoaded])

  // Function to switch to a different organization
  const switchToOrganization = (organizationSubdomain: string) => {
    if (typeof window === 'undefined') return

    const currentHost = window.location.hostname
    let newHost = ''

    if (currentHost.includes('localhost')) {
      // For local development
      newHost = `${organizationSubdomain}.localhost:${window.location.port || '3000'}`
    } else {
      // For production - replace subdomain
      const parts = currentHost.split('.')
      parts[0] = organizationSubdomain
      newHost = parts.join('.')
    }

    const newUrl = `${window.location.protocol}//${newHost}${window.location.pathname}${window.location.search}`
    window.location.href = newUrl
  }

  // Check if user has access to current organization
  const hasAccess = userRole !== null && currentOrganization !== null

  return {
    currentOrganization,
    userMemberships,
    userRole,
    isLoading: isLoading || !isLoaded,
    hasAccess,
    subdomainInfo,
    switchToOrganization,
    refetch: () => {
      if (subdomainInfo.isValid && userId && isLoaded) {
        setIsLoading(true)
        // Re-trigger the effect by clearing and setting subdomain info
        const info = getSubdomainInfo()
        setSubdomainInfo({ ...info })
      }
    }
  }
}