import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { syncUserToSupabase, syncOrganizationToSupabase, syncMembershipToSupabase } from '@/lib/syncUser'
import type { User } from '@clerk/nextjs/server'

// Define the webhook event types we're interested in
type UserWebhookEvent = {
  type: 'user.created' | 'user.updated' | 'user.deleted'
  data: User
}

type OrganizationWebhookEvent = {
  type: 'organization.created' | 'organization.updated' | 'organization.deleted'
  data: {
    id: string
    name: string
    slug?: string
    image_url?: string
    metadata?: Record<string, unknown>
  }
}

type MembershipWebhookEvent = {
  type: 'organizationMembership.created' | 'organizationMembership.updated' | 'organizationMembership.deleted'
  data: {
    user_id: string
    organization: {
      id: string
    }
    role: string
  }
}

type WebhookEvent = UserWebhookEvent | OrganizationWebhookEvent | MembershipWebhookEvent

export async function POST(req: NextRequest) {
  // Get the headers
  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new NextResponse('Error occurred -- no svix headers', {
      status: 400,
    })
  }

  // Get the body
  const payload = await req.text()

  // Create a new Svix instance with your secret
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET || '')

  let evt: WebhookEvent

  // Verify the payload with the headers
  try {
    evt = wh.verify(payload, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return new NextResponse('Error occurred', {
      status: 400,
    })
  }

  // Handle the webhook event
  const { type, data } = evt
  console.log(`Webhook received: ${type}`)

  try {
    let result

    // Handle different event types
    if (type.startsWith('user.')) {
      // User events
      result = await syncUserToSupabase({
        user: data as User,
        eventType: type as 'user.created' | 'user.updated' | 'user.deleted',
      })
    } else if (type.startsWith('organization.')) {
      // Organization events
      const orgData = data as OrganizationWebhookEvent['data']
      result = await syncOrganizationToSupabase({
        organization: {
          id: orgData.id,
          name: orgData.name,
          slug: orgData.slug,
          imageUrl: orgData.image_url,
          metadata: orgData.metadata,
        },
        eventType: type as 'organization.created' | 'organization.updated' | 'organization.deleted',
      })
    } else if (type.startsWith('organizationMembership.')) {
      // Membership events
      const membershipData = data as MembershipWebhookEvent['data']
      result = await syncMembershipToSupabase({
        membership: {
          userId: membershipData.user_id,
          organizationId: membershipData.organization.id,
          role: membershipData.role,
        },
        eventType: type as 'organizationMembership.created' | 'organizationMembership.updated' | 'organizationMembership.deleted',
      })
    } else {
      console.log(`Unhandled webhook event type: ${type}`)
      return new NextResponse('Event type not handled', { status: 200 })
    }

    if (!result.success) {
      console.error(`Failed to sync ${type} to Supabase:`, result.error)
      return new NextResponse('Error syncing to database', {
        status: 500,
      })
    }

    console.log(`Successfully processed ${type}`)
    
    return new NextResponse('Success', {
      status: 200,
    })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return new NextResponse('Error processing webhook', {
      status: 500,
    })
  }
}

// Handle other HTTP methods
export async function GET() {
  return new NextResponse('Method Not Allowed', { status: 405 })
}

export async function PUT() {
  return new NextResponse('Method Not Allowed', { status: 405 })
}

export async function DELETE() {
  return new NextResponse('Method Not Allowed', { status: 405 })
}