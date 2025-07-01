# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a multi-tenant B2B application POC with subdomain-based access control and multi-organization user support. Built with Next.js 15, TypeScript, and Tailwind CSS, users authenticate with Clerk and can belong to multiple organizations with different roles. The application uses subdomain routing (educabot.com, minimalart.com) for tenant isolation while maintaining a single Supabase database filtered by tenant_id and user roles.

## Development Commands

### Core Commands
- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build production application
- `npm start` - Start production server
- `npm run lint` - Run ESLint

### Development Server
The development server runs with Turbopack enabled for faster builds. Access at http://localhost:3000.

### Additional Dependencies
Install additional required packages:
```bash
npm install @clerk/nextjs @supabase/supabase-js @supabase/ssr lucide-react
npm install class-variance-authority clsx tailwind-merge
npm install @radix-ui/react-dropdown-menu @radix-ui/react-select
```

## Architecture

### Authentication & Multi-tenancy
- **Clerk** handles user authentication with multi-organization support
- **Supabase** provides single PostgreSQL database with Row Level Security (RLS)
- **Subdomain-based routing** for tenant isolation (educabot.com, minimalart.com)
- **Multi-organization users** can belong to multiple organizations with different roles
- Users are synced from Clerk to Supabase via webhooks
- Single database filtered by tenant_id + user role (not separate databases)

### Database Schema
Subdomain multi-tenancy schema supporting users with multiple organization memberships:

#### Core Tables
1. **organizations** (synced with Clerk)
   - `id` (UUID, PK), `clerk_org_id` (TEXT, unique), `name`, `subdomain` (TEXT, unique)
   - `domain` (TEXT, unique), `logo_url`, `settings` (JSONB), `is_active`
   - `created_at`, `updated_at`

2. **users** (synced from Clerk)
   - `id` (UUID, PK), `clerk_user_id` (TEXT, unique), `email`, `first_name`, `last_name`
   - `avatar_url`, `is_active`, `last_sign_in_at`, `created_at`, `updated_at`

3. **organization_memberships** (users can belong to multiple orgs)
   - `id` (UUID, PK), `user_id` (FK), `organization_id` (FK)
   - `role` (admin/manager/member), `is_active`, `joined_at`
   - Unique constraint on (user_id, organization_id)

4. **products** (tenant-aware)
   - `id` (UUID, PK), `organization_id` (FK), `name`, `description`, `price`
   - `sku`, `stock_quantity`, `is_active`, `created_by` (FK to users)
   - `created_at`, `updated_at`

5. **orders** (tenant-aware)
   - `id` (UUID, PK), `organization_id` (FK), `customer_name`, `customer_email`
   - `total_amount`, `status`, `created_by` (FK to users), `created_at`, `updated_at`

#### Database Features
- Row Level Security (RLS) policies based on organization membership
- Performance indexes on subdomain, clerk_org_id, and user-organization relationships
- Triggers for `updated_at` timestamps
- Foreign key constraints with UUID references
- Single database with tenant filtering (not separate databases per organization)

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript with strict mode
- **Styling**: Tailwind CSS v4
- **Authentication**: Clerk with multi-organization support (@clerk/nextjs)
- **Database**: Supabase with SSR support (@supabase/ssr, @supabase/supabase-js)
- **UI Components**: Radix UI (@radix-ui/react-dropdown-menu, @radix-ui/react-select)
- **Utilities**: class-variance-authority, clsx, tailwind-merge
- **Icons**: Lucide React
- **Fonts**: Geist Sans and Geist Mono

### Application Structure

#### Core Files
- `middleware.ts` - Subdomain detection and route protection
- `src/app/layout.tsx` - Root layout with ClerkProvider and SubdomainProvider
- `lib/supabase.ts` - Supabase client configurations (browser + admin)
- `lib/syncUser.ts` - Clerk to Supabase user/organization sync logic
- `hooks/useOrganization.ts` - Organization context hook for subdomain handling

#### Authentication Pages
- `app/sign-in/[[...sign-in]]/page.tsx` - Clerk sign-in page
- `app/sign-up/[[...sign-up]]/page.tsx` - Clerk sign-up page

#### Dashboard Pages (Organization-aware)
- `app/dashboard/page.tsx` - Organization-specific dashboard
- `app/dashboard/products/page.tsx` - Product management (filtered by organization)
- `app/dashboard/orders/page.tsx` - Order management (filtered by organization)
- `app/dashboard/users/page.tsx` - User management (organization members only)
- `app/dashboard/settings/page.tsx` - Organization settings

#### API Routes (Tenant-aware)
- `app/api/webhooks/clerk/route.ts` - Clerk user/organization event webhooks
- `app/api/products/route.ts` - Product CRUD with organization filtering
- `app/api/orders/route.ts` - Order management with organization filtering
- `app/api/users/route.ts` - User management with organization context
- `app/api/organizations/route.ts` - Organization management

#### UI Components
- `components/ui/` - Reusable UI components (Button, Input, Card, Table)
- `components/providers/SubdomainProvider.tsx` - Subdomain context provider
- `components/OrganizationSwitcher.tsx` - Multi-organization navigation
- `components/Navbar.tsx` - Navigation with organization context
- `components/Sidebar.tsx` - Dashboard sidebar with organization branding

#### Type Definitions
- `types/database.types.ts` - Database schema types (Organization, User, OrganizationMembership, Product, Order)
- `types/index.ts` - Application-specific types

#### Path Aliases
- `@/*` maps to src/* for clean imports

## Environment Variables

Required environment variables for `.env.local`:

### Clerk Configuration
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here
CLERK_WEBHOOK_SECRET=whsec_your_webhook_secret
```

### Supabase Configuration
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### App Configuration
```env
NEXT_PUBLIC_APP_DOMAIN=localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Key Features

### Subdomain-Based Multi-Tenancy
- **Subdomain routing** for organization isolation (educabot.com, minimalart.com)
- **Single database** with tenant filtering by organization_id + user role
- **Multi-organization users** can belong to multiple organizations with different roles
- **Organization switcher** allows users to switch between organizations they belong to

### Role-Based Access Control
- **Admin**: Full organization management, product and order management, user management
- **Manager**: Product management and order oversight within organization
- **Member**: Product viewing and order creation within organization
- **Roles are per-organization** - users can have different roles in different organizations

### Multi-Organization User Support
- Users authenticate once with Clerk but can access multiple organizations
- Same login credentials, different access based on subdomain
- Organization membership managed through Clerk and synced to Supabase
- Easy to add new organizations (create Clerk organization + subdomain mapping)

### Data Isolation & Security
- RLS policies ensure users only access their organization's data
- Subdomain validation prevents cross-organization data access
- Organization-scoped CRUD operations for all business entities
- Webhook-based real-time sync between Clerk and Supabase

### Business Logic
- **Product Management**: Organization-specific CRUD operations, stock tracking
- **Order Management**: Multi-item orders, status workflow, organization-scoped history
- **User Management**: Organization membership management, role-based access control

## Security & Permissions

### ⚠️ CURRENT POC SECURITY STATUS
**WARNING**: For rapid POC development and subdomain testing, security measures have been temporarily relaxed:

- **RLS DISABLED**: Row Level Security policies are currently disabled on all tables
- **PUBLIC ACCESS**: Database tables are publicly accessible via anon key
- **NO AUTH ENFORCEMENT**: API routes may bypass proper authentication checks
- **SECURITY RISK**: All organization data is currently accessible without proper access control

**PRODUCTION REQUIREMENTS**: Before production deployment, the following must be implemented:
1. **Enable RLS policies** with proper Clerk-Supabase JWT integration
2. **Implement proper authentication** in all API routes
3. **Add input validation** and sanitization
4. **Configure secure subdomain routing** with access control
5. **Audit all data access patterns** for organization isolation

### Row Level Security (RLS) - DISABLED FOR POC
- All database operations should be filtered by organization membership
- Users should only access data from organizations they belong to
- Subdomain validation should ensure proper organization context
- RLS policies should check organization membership through `organization_memberships` table

### Subdomain Security - BASIC IMPLEMENTATION
- Middleware validates subdomain access for authenticated users
- Cross-organization data access prevention through subdomain routing
- Organization context validation on every API request

### Input Validation - MINIMAL
- Basic form validation for user inputs
- API endpoint protection with authentication and organization context checks
- Sanitization of user-generated content

## Success Criteria & POC Requirements

The application should achieve:
- ✅ User logs into educabot.localhost:3000 → only sees Educabot data
- ✅ User logs into minimalart.localhost:3000 → only sees Minimal Art data  
- ✅ Same user can belong to both organizations with different roles
- ✅ Single database, filtered by organization + role
- ✅ Organization switcher shows all user's organizations
- ✅ Subdomain-based access control
- ✅ Easy to add new organizations (Clerk + subdomain mapping)
- ✅ Multi-organization user support with role management
- ✅ Professional B2B interface with responsive design

## Local Development Setup

### Prerequisites for Subdomain Testing
1. **Valid Clerk API Keys** - Replace placeholder keys in `.env.local`
2. **Supabase Database** - Set up with the complete schema (see README.md)
3. **Test Organizations** - Create in Clerk Dashboard with specific subdomains

### Subdomain Testing Configuration

#### Step 1: Environment Setup
Ensure your `.env.local` has valid keys (not the placeholder ones):
```env
# Replace with your actual Clerk keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_or_test_your_actual_key
CLERK_SECRET_KEY=sk_live_or_test_your_actual_key
CLERK_WEBHOOK_SECRET=whsec_your_actual_webhook_secret

# Replace with your actual Supabase keys
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key
```

#### Step 2: Hosts File Configuration (Optional)
Add these lines to `/etc/hosts` (macOS/Linux) or `C:\Windows\System32\drivers\etc\hosts` (Windows):
```
127.0.0.1 educabot.localhost
127.0.0.1 minimalart.localhost
127.0.0.1 testorg.localhost
```

#### Step 3: Database Setup
Run the fresh multi-organization schema script:
1. Copy contents of `fresh_multi_org_schema.sql`
2. Execute in Supabase SQL editor
3. This creates complete schema with sample data for testing

#### Step 4: Clerk Organization Setup
1. Go to Clerk Dashboard → Organizations
2. Create test organizations matching the sample data:
   - **Educabot Organization** with slug: `educabot`
   - **Minimal Art Organization** with slug: `minimalart`
   - **Test Organization** with slug: `testorg`
3. Update `organizations` table with actual Clerk org IDs (see README.md)

#### Step 5: Add Test Users
The fresh schema includes sample users and memberships. To test with real users:
1. Create a test user account in Clerk
2. Add the user to multiple organizations with different roles
3. The sample data provides a multi-org user for immediate testing

### Testing Workflow

#### Start Development Server
```bash
npm run dev
```

#### Test Subdomain Access
1. **Main domain**: `http://localhost:3000`
   - Should show organization selection if user belongs to multiple orgs
   - Should redirect to first available org if user belongs to one

2. **Educabot subdomain**: `http://educabot.localhost:3000`
   - Should load Educabot organization data
   - User should see Admin role if configured correctly
   - Dashboard should show "Welcome to Educabot"

3. **Minimal Art subdomain**: `http://minimalart.localhost:3000`
   - Should load Minimal Art organization data
   - User should see Manager role if configured correctly
   - Dashboard should show "Welcome to Minimal Art"

4. **Access Control Testing**:
   - Log in user who only has access to one organization
   - Try accessing a different subdomain
   - Should see "Access Denied" screen with organization switcher

### Troubleshooting Subdomain Testing

#### Common Issues:

1. **"Organization not found"**
   - Check Clerk organization slugs match subdomain names
   - Verify database has organizations with correct `subdomain` field
   - Check webhook is properly syncing organizations

2. **"Access Denied" for valid user**
   - Verify user membership in organization_memberships table
   - Check organization_memberships.is_active = true
   - Ensure webhook synced the membership correctly

3. **Subdomain not detected**
   - Verify `/etc/hosts` configuration
   - Check browser is using the full subdomain URL
   - Review middleware subdomain extraction logic

4. **Build failures with Clerk keys**
   - Normal during development with placeholder keys
   - Use `npx tsc --noEmit` to check TypeScript without building
   - Replace with real keys for actual testing

### Expected User Flows

#### Multi-Organization User Journey:
1. User signs up/signs in
2. If belongs to multiple orgs → organization selection screen
3. User clicks on an organization → redirected to that subdomain
4. User sees organization-specific dashboard with their role
5. User can switch organizations using the organization switcher

#### Single Organization User Journey:
1. User signs up/signs in
2. Automatically redirected to their organization's subdomain
3. User sees organization-specific dashboard

#### Access Control Testing:
1. User tries to access subdomain they don't belong to
2. "Access Denied" screen appears
3. Shows list of available organizations
4. User can click to switch to accessible organization

### POC Deliverables
1. Next.js app with subdomain detection middleware
2. Clerk authentication with multi-organization support
3. Supabase integration with tenant-aware RLS policies
4. Organization context management and user role handling
5. Sample business data (products, orders) filtered by organization
6. Organization switcher for multi-organization users
7. Working demo with test subdomains (educabot/minimalart)