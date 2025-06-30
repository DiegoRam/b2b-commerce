# Claude Code Prompt: Multi-Tenant B2B App with Subdomain Support (No Medusa)

## Project Overview
Create a proof of concept demonstrating multi-tenant B2B application with subdomain-based access control and multi-organization user support. Users authenticate with Clerk and can belong to multiple organizations with different roles.

## Architecture Requirements (From Meeting)
- **Frontend**: Next.js with App Router + TypeScript
- **Authentication**: Clerk (multi-organization support with subdomain routing)
- **Database**: Supabase (single database, filtered by tenant_id + role)
- **Multi-tenancy**: Subdomain-based (educabot.com, minimalart.com)
- **User Model**: Users can belong to multiple organizations with different roles per org

## Key Meeting Requirements
1. ✅ Single Supabase database for all organizations
2. ✅ Filter data by tenant_id + user role (not separate databases)
3. ✅ Clerk manages users and organizations
4. ✅ Subdomain-based access control (educabot.com vs minimalart.com)
5. ✅ Users can belong to multiple organizations with different roles
6. ✅ Same login credentials, different access based on subdomain
7. ✅ Easy to add new clients (just create Clerk organization)

## Step 1: Project Setup
```bash
# Create Next.js project
npx create-next-app@latest b2b-subdomain-poc --typescript --tailwind --eslint --app
cd b2b-subdomain-poc

# Install dependencies
npm install @clerk/nextjs @supabase/supabase-js @supabase/ssr
npm install lucide-react class-variance-authority clsx tailwind-merge
npm install @radix-ui/react-dropdown-menu @radix-ui/react-select
```

## Step 2: Environment Configuration
Create `.env.local`:
```env
# Clerk Configuration
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here
CLERK_WEBHOOK_SECRET=whsec_your_webhook_secret

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# App Configuration
NEXT_PUBLIC_APP_DOMAIN=localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Step 3: Supabase Database Schema
Comprehensive schema supporting subdomain multi-tenancy:

```sql
-- Organizations table (synced with Clerk)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_org_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  domain TEXT UNIQUE, -- for custom domains later
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table (synced from Clerk)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_sign_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization memberships (users can belong to multiple orgs)
CREATE TABLE organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'manager', 'member')),
  is_active BOOLEAN DEFAULT true,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

-- Sample business data (products) - tenant-aware
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  sku TEXT,
  stock_quantity INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sample business data (orders) - tenant-aware
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_orgs_subdomain ON organizations(subdomain);
CREATE INDEX idx_orgs_clerk_id ON organizations(clerk_org_id);
CREATE INDEX idx_users_clerk_id ON users(clerk_user_id);
CREATE INDEX idx_memberships_user_org ON organization_memberships(user_id, organization_id);
CREATE INDEX idx_products_org ON products(organization_id);
CREATE INDEX idx_orders_org ON orders(organization_id);

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies (based on subdomain context)
-- Note: These will be enhanced with subdomain context in the application layer

-- Users can see their own data
CREATE POLICY "Users can view own profile" ON users
FOR SELECT USING (clerk_user_id = auth.jwt() ->> 'sub');

-- Users can see memberships for orgs they belong to
CREATE POLICY "Users can view relevant memberships" ON organization_memberships
FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub')
  OR organization_id IN (
    SELECT organization_id FROM organization_memberships 
    WHERE user_id IN (SELECT id FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub')
  )
);

-- Products are filtered by organization membership
CREATE POLICY "Users can view organization products" ON products
FOR SELECT USING (
  organization_id IN (
    SELECT om.organization_id FROM organization_memberships om
    JOIN users u ON u.id = om.user_id
    WHERE u.clerk_user_id = auth.jwt() ->> 'sub'
    AND om.is_active = true
  )
);

-- Orders are filtered by organization membership  
CREATE POLICY "Users can view organization orders" ON orders
FOR SELECT USING (
  organization_id IN (
    SELECT om.organization_id FROM organization_memberships om
    JOIN users u ON u.id = om.user_id
    WHERE u.clerk_user_id = auth.jwt() ->> 'sub'
    AND om.is_active = true
  )
);
```

## Step 4: TypeScript Types
Create comprehensive type definitions:

```typescript
// types/database.types.ts
export interface Organization {
  id: string
  clerk_org_id: string
  name: string
  subdomain: string
  domain?: string
  logo_url?: string
  settings: Record<string, any>
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  clerk_user_id: string
  email: string
  first_name?: string
  last_name?: string
  avatar_url?: string
  is_active: boolean
  last_sign_in_at?: string
  created_at: string
  updated_at: string
}

export interface OrganizationMembership {
  id: string
  user_id: string
  organization_id: string
  role: 'admin' | 'manager' | 'member'
  is_active: boolean
  joined_at: string
  organization?: Organization
  user?: User
}

export interface Product {
  id: string
  organization_id: string
  name: string
  description?: string
  price: number
  sku?: string
  stock_quantity: number
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  organization_id: string
  customer_name: string
  customer_email: string
  total_amount: number
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
  created_by?: string
  created_at: string
  updated_at: string
}
```

## Step 5: Subdomain Detection Middleware
Create middleware to handle subdomain routing:

```typescript
// middleware.ts
import { authMiddleware } from "@clerk/nextjs"
import { NextResponse } from "next/server"

export default authMiddleware({
  publicRoutes: ["/", "/api/webhook/clerk"],
  beforeAuth: (req) => {
    // Extract subdomain
    const url = req.nextUrl.clone()
    const hostname = req.headers.get("host") || ""
    const subdomain = hostname.split('.')[0]

    // Skip subdomain logic for localhost and www
    if (hostname.includes('localhost') || subdomain === 'www') {
      return NextResponse.next()
    }

    // Add subdomain to headers for use in components
    const response = NextResponse.next()
    response.headers.set('x-subdomain', subdomain)
    return response
  },
  afterAuth: async (auth, req) => {
    const subdomain = req.headers.get('x-subdomain')
    
    if (auth.userId && subdomain) {
      // Validate user has access to this subdomain
      // This will be implemented in the app logic
    }

    return NextResponse.next()
  }
})

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
}
```

## Step 6: Supabase Client Setup
```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
```

## Step 7: Organization Context Hook
```typescript
// hooks/useOrganization.ts
'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { supabase } from '@/lib/supabase'

export function useOrganization() {
  const { userId, getToken } = useAuth()
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null)
  const [userMemberships, setUserMemberships] = useState<OrganizationMembership[]>([])

  useEffect(() => {
    if (userId) {
      // Get subdomain from window.location or headers
      const subdomain = window.location.hostname.split('.')[0]
      fetchOrganizationData(subdomain)
    }
  }, [userId])

  const fetchOrganizationData = async (subdomain: string) => {
    // Fetch organization by subdomain
    // Fetch user memberships
    // Set current organization based on subdomain
  }

  return { currentOrg, userMemberships }
}
```

## Step 8: Core Application Structure

### Layout with Subdomain Support:
```typescript
// app/layout.tsx
import { ClerkProvider } from '@clerk/nextjs'
import { SubdomainProvider } from '@/components/providers/SubdomainProvider'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <SubdomainProvider>
            {children}
          </SubdomainProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
```

### Dashboard with Organization Context:
```typescript
// app/dashboard/page.tsx
export default function Dashboard() {
  const { currentOrg, userMemberships } = useOrganization()
  
  if (!currentOrg) {
    return <div>Loading organization...</div>
  }

  return (
    <div>
      <h1>Welcome to {currentOrg.name}</h1>
      <p>Subdomain: {currentOrg.subdomain}</p>
      {/* Organization-specific dashboard content */}
    </div>
  )
}
```

## Step 9: API Routes for Data Management
```typescript
// app/api/products/route.ts
import { auth } from '@clerk/nextjs'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  const { userId } = auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Get subdomain from headers
  const subdomain = request.headers.get('x-subdomain')
  
  // Fetch products for the organization based on subdomain
  // Apply user role filtering
}
```

## Step 10: Clerk Webhook for User Sync
```typescript
// app/api/webhook/clerk/route.ts
import { Webhook } from 'svix'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)

  const webhook = new Webhook(process.env.CLERK_WEBHOOK_SECRET!)
  const event = webhook.verify(payload, headers)

  switch (event.type) {
    case 'user.created':
      await syncUserToSupabase(event.data)
      break
    case 'organization.created':
      await syncOrganizationToSupabase(event.data)
      break
    case 'organizationMembership.created':
      await syncMembershipToSupabase(event.data)
      break
  }

  return Response.json({ received: true })
}
```

## Step 11: Multi-Organization User Interface
```typescript
// components/OrganizationSwitcher.tsx
export function OrganizationSwitcher() {
  const { userMemberships } = useOrganization()
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        Switch Organization
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {userMemberships.map(membership => (
          <DropdownMenuItem 
            key={membership.id}
            onClick={() => redirectToOrganization(membership.organization.subdomain)}
          >
            {membership.organization.name} ({membership.role})
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

## Key Success Criteria (From Meeting):
- ✅ User logs into educabot.localhost:3000 → only sees Educabot data
- ✅ User logs into minimalart.localhost:3000 → only sees Minimal Art data  
- ✅ Same user can belong to both orgs with different roles
- ✅ Single database, filtered by organization + role
- ✅ Organization switcher shows all user's organizations
- ✅ Subdomain-based access control
- ✅ Easy to add new organizations (Clerk + subdomain mapping)

## POC Deliverables:
1. Next.js app with subdomain detection
2. Clerk authentication with multi-organization support
3. Supabase integration with tenant-aware RLS
4. Organization context and user role management
5. Sample business data (products, orders) filtered by organization
6. Organization switcher for multi-org users
7. Working demo with test subdomains

## Local Development Setup:
- Use `educabot.localhost:3000` and `minimalart.localhost:3000` for testing
- Configure `/etc/hosts` if needed for subdomain testing
- Set up test organizations in Clerk with matching subdomains

This POC will demonstrate the core concepts without Medusa complexity, making it easier to integrate with Medusa later.