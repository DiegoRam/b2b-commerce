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

### Row Level Security (RLS)
- All database operations are filtered by organization membership
- Users can only access data from organizations they belong to
- Subdomain validation ensures proper organization context
- RLS policies check organization membership through `organization_memberships` table

### Subdomain Security
- Middleware validates subdomain access for authenticated users
- Cross-organization data access prevention through subdomain routing
- Organization context validation on every API request

### Input Validation
- Form validation for all user inputs
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

### Subdomain Testing
- Use `educabot.localhost:3000` and `minimalart.localhost:3000` for testing
- Configure `/etc/hosts` if needed for subdomain testing:
  ```
  127.0.0.1 educabot.localhost
  127.0.0.1 minimalart.localhost
  ```
- Set up test organizations in Clerk with matching subdomains
- Test multi-organization user flows

### POC Deliverables
1. Next.js app with subdomain detection middleware
2. Clerk authentication with multi-organization support
3. Supabase integration with tenant-aware RLS policies
4. Organization context management and user role handling
5. Sample business data (products, orders) filtered by organization
6. Organization switcher for multi-organization users
7. Working demo with test subdomains (educabot/minimalart)