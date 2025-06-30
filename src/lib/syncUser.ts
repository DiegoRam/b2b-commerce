import { createSupabaseAdminClient } from './supabase'
import type { User } from '@clerk/nextjs/server'

export interface SyncUserOptions {
  user: User
  eventType: 'user.created' | 'user.updated' | 'user.deleted'
}

export interface SyncOrganizationOptions {
  organization: {
    id: string
    name: string
    slug?: string
    imageUrl?: string
    metadata?: Record<string, unknown>
  }
  eventType: 'organization.created' | 'organization.updated' | 'organization.deleted'
}

export interface SyncMembershipOptions {
  membership: {
    userId: string
    organizationId: string
    role: string
  }
  eventType: 'organizationMembership.created' | 'organizationMembership.updated' | 'organizationMembership.deleted'
}

export async function syncUserToSupabase({ user, eventType }: SyncUserOptions) {
  const supabase = createSupabaseAdminClient()

  try {
    if (eventType === 'user.deleted') {
      // Mark user as inactive instead of deleting
      const { error } = await supabase
        .from('users')
        .update({ is_active: false })
        .eq('clerk_user_id', user.id)

      if (error) throw error
      return { success: true }
    }

    // Extract email for user creation
    const email = user.emailAddresses[0]?.emailAddress
    if (!email) {
      throw new Error('User has no email address')
    }

    // Prepare user data (no organization assignment here - handled by membership sync)
    const userData = {
      clerk_user_id: user.id,
      email: email,
      first_name: user.firstName || null,
      last_name: user.lastName || null,
      avatar_url: user.imageUrl || null,
      is_active: true,
      last_sign_in_at: new Date().toISOString()
    }

    if (eventType === 'user.created') {
      // Create new user
      const { error } = await supabase
        .from('users')
        .insert(userData)

      if (error) throw error
    } else if (eventType === 'user.updated') {
      // Update existing user
      const { error } = await supabase
        .from('users')
        .upsert(userData, { onConflict: 'clerk_user_id' })

      if (error) throw error
    }

    return { success: true }
  } catch (error) {
    console.error('Error syncing user to Supabase:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function syncOrganizationToSupabase({ organization, eventType }: SyncOrganizationOptions) {
  const supabase = createSupabaseAdminClient()

  try {
    if (eventType === 'organization.deleted') {
      // Mark organization as inactive instead of deleting
      const { error } = await supabase
        .from('organizations')
        .update({ is_active: false })
        .eq('clerk_org_id', organization.id)

      if (error) throw error
      return { success: true }
    }

    // Prepare organization data
    const orgData = {
      clerk_org_id: organization.id,
      name: organization.name,
      subdomain: organization.slug || organization.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      logo_url: organization.imageUrl || null,
      settings: organization.metadata || {},
      is_active: true
    }

    if (eventType === 'organization.created') {
      // Create new organization
      const { error } = await supabase
        .from('organizations')
        .insert(orgData)

      if (error) throw error
    } else if (eventType === 'organization.updated') {
      // Update existing organization
      const { error } = await supabase
        .from('organizations')
        .upsert(orgData, { onConflict: 'clerk_org_id' })

      if (error) throw error
    }

    return { success: true }
  } catch (error) {
    console.error('Error syncing organization to Supabase:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function syncMembershipToSupabase({ membership, eventType }: SyncMembershipOptions) {
  const supabase = createSupabaseAdminClient()

  try {
    if (eventType === 'organizationMembership.deleted') {
      // Mark membership as inactive instead of deleting
      const { error } = await supabase
        .from('organization_memberships')
        .update({ is_active: false })
        .eq('user_id', membership.userId)
        .eq('organization_id', membership.organizationId)

      if (error) throw error
      return { success: true }
    }

    // Get the user and organization IDs from Supabase
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_user_id', membership.userId)
      .single()

    const { data: organization } = await supabase
      .from('organizations')
      .select('id')
      .eq('clerk_org_id', membership.organizationId)
      .single()

    if (!user || !organization) {
      throw new Error('User or organization not found in Supabase')
    }

    // Map Clerk role to our role enum
    const roleMapping: Record<string, 'admin' | 'manager' | 'member'> = {
      'admin': 'admin',
      'basic_member': 'member',
      'member': 'member'
    }

    const role = roleMapping[membership.role] || 'member'

    // Prepare membership data
    const membershipData = {
      user_id: user.id,
      organization_id: organization.id,
      role: role,
      is_active: true,
      joined_at: new Date().toISOString()
    }

    if (eventType === 'organizationMembership.created') {
      // Create new membership
      const { error } = await supabase
        .from('organization_memberships')
        .insert(membershipData)

      if (error) throw error
    } else if (eventType === 'organizationMembership.updated') {
      // Update existing membership
      const { error } = await supabase
        .from('organization_memberships')
        .update({ role: role })
        .eq('user_id', user.id)
        .eq('organization_id', organization.id)

      if (error) throw error
    }

    return { success: true }
  } catch (error) {
    console.error('Error syncing membership to Supabase:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function getCurrentUserWithMemberships(clerkUserId: string) {
  const supabase = createSupabaseAdminClient()

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        *,
        organization_memberships!inner (
          id,
          role,
          is_active,
          joined_at,
          organization:organizations (
            id,
            name,
            subdomain,
            logo_url,
            settings
          )
        )
      `)
      .eq('clerk_user_id', clerkUserId)
      .eq('is_active', true)
      .eq('organization_memberships.is_active', true)
      .single()

    if (error) throw error
    return { user, error: null }
  } catch (error) {
    console.error('Error fetching current user:', error)
    return { user: null, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function getUsersByOrganization(organizationId: string) {
  const supabase = createSupabaseAdminClient()

  try {
    const { data: memberships, error } = await supabase
      .from('organization_memberships')
      .select(`
        id,
        role,
        joined_at,
        user:users (
          id,
          clerk_user_id,
          email,
          first_name,
          last_name,
          avatar_url,
          is_active,
          last_sign_in_at
        )
      `)
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .eq('users.is_active', true)
      .order('joined_at', { ascending: false })

    if (error) throw error
    return { memberships, error: null }
  } catch (error) {
    console.error('Error fetching organization users:', error)
    return { memberships: [], error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function getOrganizationBySubdomain(subdomain: string) {
  const supabase = createSupabaseAdminClient()

  try {
    const { data: organization, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('subdomain', subdomain)
      .eq('is_active', true)
      .single()

    if (error) throw error
    return { organization, error: null }
  } catch (error) {
    console.error('Error fetching organization by subdomain:', error)
    return { organization: null, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function getUserMembershipInOrganization(clerkUserId: string, organizationId: string) {
  const supabase = createSupabaseAdminClient()

  try {
    const { data: membership, error } = await supabase
      .from('organization_memberships')
      .select(`
        id,
        role,
        is_active,
        joined_at,
        user:users!inner (id, clerk_user_id),
        organization:organizations (id, name, subdomain)
      `)
      .eq('users.clerk_user_id', clerkUserId)
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .single()

    if (error) throw error
    return { membership, error: null }
  } catch (error) {
    console.error('Error fetching user membership:', error)
    return { membership: null, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}