import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { MedusaCustomerService } from '@/lib/medusa-customer-service'
import type { ClientSyncResponse } from '@/types/medusa-customer'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    const { id } = await params
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createSupabaseServerClient()
    
    // Get organization ID from subdomain
    const url = new URL(request.url)
    const host = request.headers.get('host') || url.host
    const subdomain = host.split('.')[0]
    
    if (subdomain === 'localhost' || subdomain === host) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 })
    }

    // Get organization by subdomain
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('subdomain', subdomain)
      .eq('is_active', true)
      .single()

    if (orgError || !organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get current user
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_user_id', userId)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify user has permission to manage clients (admin or manager)
    const { data: membership } = await supabase
      .from('organization_memberships')
      .select('role')
      .eq('organization_id', organization.id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!membership || !['admin', 'manager'].includes(membership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organization.id)
      .single()

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Get sync options from request body
    const body = await request.json().catch(() => ({}))
    const { 
      force_sync = false, 
      sync_addresses = true,
      create_if_not_exists = true 
    } = body

    // Validate MedusaJS connection first
    const isConnected = await MedusaCustomerService.validateConnection()
    if (!isConnected) {
      return NextResponse.json({ 
        success: false,
        error: 'Unable to connect to MedusaJS backend',
        syncStatus: 'error'
      } as ClientSyncResponse, { status: 503 })
    }

    // Perform sync
    const syncResult = await MedusaCustomerService.syncClient(
      client,
      subdomain,
      {
        syncAddresses: sync_addresses,
        createIfNotExists: create_if_not_exists,
        skipConflictCheck: force_sync
      }
    )

    // Determine sync status
    let syncStatus: ClientSyncResponse['syncStatus'] = 'error'
    if (syncResult.success) {
      syncStatus = 'synced'
    } else if (syncResult.conflicts && syncResult.conflicts.length > 0) {
      syncStatus = 'conflict'
    }

    // Update client with sync result if successful
    if (syncResult.success && syncResult.medusaCustomerId) {
      await supabase
        .from('clients')
        .update({ 
          medusa_customer_id: syncResult.medusaCustomerId
        })
        .eq('id', id)
    }

    // Log sync attempt (for monitoring)
    console.log(`Client sync ${syncResult.success ? 'successful' : 'failed'}:`, {
      clientId: id,
      organizationId: organization.id,
      medusaCustomerId: syncResult.medusaCustomerId,
      error: syncResult.error,
      addressesSynced: syncResult.addressesSynced
    })

    const response: ClientSyncResponse = {
      success: syncResult.success,
      medusaCustomerId: syncResult.medusaCustomerId,
      syncStatus,
      error: syncResult.error,
      lastSyncAt: new Date().toISOString()
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in client sync API:', error)
    
    const response: ClientSyncResponse = {
      success: false,
      syncStatus: 'error',
      error: error instanceof Error ? error.message : 'Internal server error'
    }
    
    return NextResponse.json(response, { status: 500 })
  }
}

// GET endpoint to check sync status
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    const { id } = await params
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createSupabaseServerClient()
    
    // Get organization ID from subdomain
    const url = new URL(request.url)
    const host = request.headers.get('host') || url.host
    const subdomain = host.split('.')[0]
    
    if (subdomain === 'localhost' || subdomain === host) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 })
    }

    // Get organization by subdomain
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('subdomain', subdomain)
      .eq('is_active', true)
      .single()

    if (orgError || !organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Verify user has access
    const { data: membership } = await supabase
      .from('organization_memberships')
      .select('role')
      .eq('organization_id', organization.id)
      .eq('user_id', (await supabase
        .from('users')
        .select('id')
        .eq('clerk_user_id', userId)
        .single()
      ).data?.id)
      .eq('is_active', true)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get client with MedusaJS customer info
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, medusa_customer_id, updated_at')
      .eq('id', id)
      .eq('organization_id', organization.id)
      .single()

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Check if MedusaJS customer exists
    let medusaCustomer = null
    let syncStatus: ClientSyncResponse['syncStatus'] = 'pending'

    if (client.medusa_customer_id) {
      try {
        medusaCustomer = await MedusaCustomerService.getCustomer(id)
        syncStatus = medusaCustomer ? 'synced' : 'error'
      } catch (error) {
        console.error('Error checking MedusaJS customer:', error)
        syncStatus = 'error'
      }
    }

    const response: ClientSyncResponse = {
      success: !!medusaCustomer,
      medusaCustomerId: client.medusa_customer_id || undefined,
      syncStatus,
      lastSyncAt: client.updated_at
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error checking client sync status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}