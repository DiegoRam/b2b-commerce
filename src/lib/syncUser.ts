import { createSupabaseAdminClient } from './supabase'

// Define the webhook user data structure (matches Clerk webhook payload)
export interface WebhookUserData {
  id: string
  email_addresses: Array<{
    email_address: string
    id: string
    verification?: {
      status: string
    }
  }>
  first_name?: string | null
  last_name?: string | null
  image_url?: string
  username?: string
  created_at: number
  updated_at: number
  last_sign_in_at?: number | null
  banned?: boolean
  locked?: boolean
}

export interface SyncUserOptions {
  user: WebhookUserData
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
    console.log(`Syncing user ${eventType}:`, user.id)

    if (eventType === 'user.deleted') {
      // Mark user as inactive instead of deleting
      const { error } = await supabase
        .from('users')
        .update({ is_active: false })
        .eq('clerk_user_id', user.id)

      if (error) throw error
      console.log(`User ${user.id} marked as inactive`)
      return { success: true }
    }

    // Extract email for user creation (using webhook data structure)
    const email = user.email_addresses?.[0]?.email_address
    if (!email) {
      throw new Error('User has no email address')
    }

    // Convert timestamps to ISO strings
    const lastSignInAt = user.last_sign_in_at ? new Date(user.last_sign_in_at).toISOString() : null

    // Prepare user data (no organization assignment here - handled by membership sync)
    const userData = {
      clerk_user_id: user.id,
      email: email,
      first_name: user.first_name || null,
      last_name: user.last_name || null,
      avatar_url: user.image_url || null,
      is_active: !(user.banned || user.locked),
      last_sign_in_at: lastSignInAt
    }

    console.log('User data to sync:', userData)

    if (eventType === 'user.created') {
      // Create new user
      const { error } = await supabase
        .from('users')
        .insert(userData)

      if (error) throw error
      console.log(`User ${user.id} created successfully`)
    } else if (eventType === 'user.updated') {
      // Update existing user
      const { error } = await supabase
        .from('users')
        .upsert(userData, { onConflict: 'clerk_user_id' })

      if (error) throw error
      console.log(`User ${user.id} updated successfully`)
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
    console.log(`Syncing membership ${eventType}:`, membership)

    if (eventType === 'organizationMembership.deleted') {
      // Get the user and organization IDs from Supabase first
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
        console.warn('User or organization not found for membership deletion')
        return { success: true } // Don't fail if records don't exist
      }

      // Mark membership as inactive instead of deleting
      const { error } = await supabase
        .from('organization_memberships')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('organization_id', organization.id)

      if (error) throw error
      console.log(`Membership deactivated for user ${membership.userId} in org ${membership.organizationId}`)
      return { success: true }
    }

    // Get the user and organization IDs from Supabase
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_user_id', membership.userId)
      .single()

    if (userError || !user) {
      throw new Error(`User with clerk_user_id ${membership.userId} not found in Supabase. Error: ${userError?.message}`)
    }

    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('clerk_org_id', membership.organizationId)
      .single()

    if (orgError || !organization) {
      throw new Error(`Organization with clerk_org_id ${membership.organizationId} not found in Supabase. Error: ${orgError?.message}`)
    }

    console.log(`Found user ID: ${user.id}, org ID: ${organization.id}`)

    // Map Clerk role to our role enum
    const roleMapping: Record<string, 'admin' | 'manager' | 'member'> = {
      'admin': 'admin',
      'basic_member': 'member',
      'member': 'member',
      'manager': 'manager'
    }

    const role = roleMapping[membership.role] || 'member'
    console.log(`Mapped role ${membership.role} to ${role}`)

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
      console.log(`Membership created for user ${membership.userId} in org ${membership.organizationId}`)
    } else if (eventType === 'organizationMembership.updated') {
      // Update existing membership
      const { error } = await supabase
        .from('organization_memberships')
        .update({ role: role })
        .eq('user_id', user.id)
        .eq('organization_id', organization.id)

      if (error) throw error
      console.log(`Membership updated for user ${membership.userId} in org ${membership.organizationId}`)
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