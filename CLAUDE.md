# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a B2B e-commerce POC built with Next.js 15, TypeScript, and Tailwind CSS. The application integrates Clerk for authentication and Supabase for database operations, implementing multi-tenant architecture for organizations. The project follows a comprehensive step-by-step implementation plan for creating a production-ready B2B e-commerce platform.

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
```

## Architecture

### Authentication & Multi-tenancy
- **Clerk** handles user authentication and organization management
- **Supabase** provides PostgreSQL database with Row Level Security (RLS)
- Users are automatically synced from Clerk to Supabase on first login via webhook
- Organizations are auto-assigned based on email domain
- Auto-creation of organizations for new domains

### Database Schema
The application uses a comprehensive multi-tenant database structure with UUID primary keys:

#### Core Tables
1. **organizations**
   - `id` (UUID, PK), `name`, `domain`, `slug`, `logo_url`
   - `settings` (JSONB), `created_at`, `updated_at`

2. **users** 
   - `id` (UUID, PK), `clerk_user_id` (unique), `email`, `first_name`, `last_name`, `avatar_url`
   - `organization_id` (FK), `role` (admin/manager/member), `is_active`, `last_sign_in_at`
   - `created_at`, `updated_at`

3. **products**
   - `id` (UUID, PK), `organization_id` (FK), `name`, `description`, `price`
   - `sku`, `stock_quantity`, `is_active`, `created_at`, `updated_at`

4. **orders**
   - `id` (UUID, PK), `organization_id` (FK), `user_id` (FK), `total_amount`
   - `status`, `created_at`, `updated_at`

5. **order_items**
   - `id` (UUID, PK), `order_id` (FK), `product_id` (FK), `quantity`
   - `unit_price`, `total_price`

#### Database Features
- Row Level Security (RLS) policies for multi-tenancy
- Proper indexes for performance optimization
- Triggers for `updated_at` timestamps
- Foreign key constraints with UUID references

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript with strict mode
- **Styling**: Tailwind CSS v4
- **Authentication**: Clerk (@clerk/nextjs)
- **Database**: Supabase with SSR support (@supabase/ssr, @supabase/supabase-js)
- **Icons**: Lucide React
- **Fonts**: Geist Sans and Geist Mono

### Application Structure

#### Core Files
- `middleware.ts` - Route protection and user sync
- `src/app/layout.tsx` - Root layout with ClerkProvider
- `lib/supabase.ts` - Supabase client configurations (browser + admin)
- `lib/syncUser.ts` - Clerk to Supabase user sync logic

#### Authentication Pages
- `app/sign-in/[[...sign-in]]/page.tsx` - Clerk sign-in page
- `app/sign-up/[[...sign-up]]/page.tsx` - Clerk sign-up page

#### Dashboard Pages
- `app/dashboard/page.tsx` - Overview dashboard
- `app/dashboard/products/page.tsx` - Product management
- `app/dashboard/orders/page.tsx` - Order management
- `app/dashboard/users/page.tsx` - User management (admin only)
- `app/dashboard/settings/page.tsx` - Organization settings

#### API Routes
- `app/api/webhooks/clerk/route.ts` - Clerk user event webhooks
- `app/api/products/route.ts` - Product CRUD operations
- `app/api/orders/route.ts` - Order management
- `app/api/users/route.ts` - User management
- `app/api/organization/route.ts` - Organization settings

#### UI Components
- `components/ui/` - Reusable UI components (Button, Input, Card, Table)
- `components/Navbar.tsx` - Navigation with user menu
- `components/Sidebar.tsx` - Dashboard sidebar navigation
- `components/ProductCard.tsx` - Product display component
- `components/OrderTable.tsx` - Order listing component
- `components/UserTable.tsx` - User management component

#### Form Components
- `components/forms/ProductForm.tsx` - Add/edit products
- `components/forms/OrderForm.tsx` - Create orders
- `components/forms/UserInviteForm.tsx` - Invite users

#### Path Aliases
- `@/*` maps to project root for clean imports

## Environment Variables

Required environment variables for `.env.local`:

### Clerk Configuration
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
CLERK_WEBHOOK_SECRET=whsec_your_webhook_secret
```

### Supabase Configuration
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Key Features

### Role-Based Access Control
- **Admin**: Full product and order management, user management
- **Manager**: Product management and order oversight  
- **Member**: Product viewing and order creation

### Multi-tenant Data Isolation
- RLS policies ensure users only access their organization's data
- Automatic organization assignment based on email domain
- Organization-scoped CRUD operations for all entities

### User Sync Logic
- Automatic user creation in Supabase on first Clerk login
- Organization assignment based on email domain
- Auto-creation of new organizations for unrecognized domains
- Webhook-based real-time sync between Clerk and Supabase

### Business Logic
- **Product Management**: CRUD operations, SKU generation, stock tracking
- **Order Management**: Multi-item orders, status workflow, order history
- **User Management**: Role-based access, user invitations, organization membership

## Security & Permissions

### Row Level Security (RLS)
- All database operations are organization-scoped
- Users can only access data from their organization
- Admin users have elevated permissions within their organization

### Input Validation
- Form validation for all user inputs
- API endpoint protection with authentication checks
- Sanitization of user-generated content

## Success Criteria

The application should achieve:
- ✅ User authentication via Clerk
- ✅ Automatic Supabase user creation on first login
- ✅ Organization auto-assignment by email domain
- ✅ Multi-tenant data isolation
- ✅ Role-based feature access (admin/manager/member)
- ✅ Comprehensive product and order management
- ✅ Professional B2B interface with responsive design