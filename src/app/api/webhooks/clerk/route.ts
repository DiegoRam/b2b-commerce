import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { syncUserToSupabase } from '@/lib/syncUser'
import type { User } from '@clerk/nextjs/server'

// Define the webhook event types we're interested in
type WebhookEvent = {
  type: 'user.created' | 'user.updated' | 'user.deleted'
  data: User
}

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
    // Sync user to Supabase based on the event type
    const result = await syncUserToSupabase({
      user: data,
      eventType: type,
    })

    if (!result.success) {
      console.error('Failed to sync user to Supabase:', result.error)
      return new NextResponse('Error syncing user', {
        status: 500,
      })
    }

    console.log(`Successfully processed ${type} for user ${data.id}`)
    
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