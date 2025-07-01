import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Define protected routes that require authentication
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/api/products(.*)',
  '/api/orders(.*)',
  '/api/users(.*)',
  '/api/organizations(.*)',
])

// Define public routes that should be accessible without authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  // Extract subdomain from hostname
  const hostname = req.headers.get('host') || ''
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

  // Create response and add subdomain to headers for use in components
  const response = NextResponse.next()
  if (subdomain) {
    response.headers.set('x-subdomain', subdomain)
  }

  // Allow public routes to pass through
  if (isPublicRoute(req)) {
    return response
  }

  // Protect private routes
  if (isProtectedRoute(req)) {
    const { userId } = await auth()
    
    if (!userId) {
      // Redirect to sign-in if not authenticated
      const signInUrl = new URL('/sign-in', req.url)
      signInUrl.searchParams.set('redirect_url', req.url)
      return NextResponse.redirect(signInUrl)
    }

    // TODO: Add subdomain validation logic here
    // - Verify user has access to the organization associated with this subdomain
    // - This will be implemented after we update the user sync logic
  }

  return response
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}