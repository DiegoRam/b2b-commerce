import { createSupabaseAdminClient } from './supabase'
import type { User } from '@clerk/nextjs/server'

export interface SyncUserOptions {
  user: User
  eventType: 'user.created' | 'user.updated' | 'user.deleted'
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

    // Extract email domain for organization assignment
    const email = user.emailAddresses[0]?.emailAddress
    if (!email) {
      throw new Error('User has no email address')
    }

    const emailDomain = email.split('@')[1]

    // Check if organization exists for this domain
    let { data: organization } = await supabase
      .from('organizations')
      .select('id')
      .eq('domain', emailDomain)
      .single()

    // Create organization if it doesn't exist
    if (!organization) {
      const { data: newOrg, error: createOrgError } = await supabase
        .from('organizations')
        .insert({
          name: `${emailDomain} Organization`,
          domain: emailDomain,
          slug: emailDomain.replace('.', '-'),
          settings: {}
        })
        .select('id')
        .single()

      if (createOrgError) throw createOrgError
      organization = newOrg
    }

    // Prepare user data
    const userData = {
      clerk_user_id: user.id,
      email: email,
      first_name: user.firstName || '',
      last_name: user.lastName || '',
      avatar_url: user.imageUrl || '',
      organization_id: organization.id,
      role: 'member' as const, // Default role, can be changed by admin
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

    return { success: true, organizationId: organization.id }
  } catch (error) {
    console.error('Error syncing user to Supabase:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function getCurrentUser(clerkUserId: string) {
  const supabase = createSupabaseAdminClient()

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        *,
        organizations (
          id,
          name,
          domain,
          slug,
          settings
        )
      `)
      .eq('clerk_user_id', clerkUserId)
      .eq('is_active', true)
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
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error
    return { users, error: null }
  } catch (error) {
    console.error('Error fetching organization users:', error)
    return { users: [], error: error instanceof Error ? error.message : 'Unknown error' }
  }
}