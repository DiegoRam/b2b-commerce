# Claude Code Prompt: B2B E-commerce POC with Next.js, Clerk & Supabase

## Project Overview
Create a B2B e-commerce application that allows organizations to manage users, products, and orders. Users authenticate with Clerk and are automatically synced to Supabase on first login.

## Technical Requirements
- **Frontend**: Next.js 14+ with App Router, TypeScript, Tailwind CSS
- **Authentication**: Clerk (handles user auth, organizations)
- **Database**: Supabase (PostgreSQL with RLS)
- **Architecture**: Multi-tenant B2B application

## Step 1: Project Setup
```bash
# Create Next.js project with required dependencies
npx create-next-app@latest b2b-ecommerce --typescript --tailwind --eslint --app
cd b2b-ecommerce
npm install @clerk/nextjs @supabase/supabase-js @supabase/ssr lucide-react
```

## Step 2: Environment Configuration
Create `.env.local` with placeholders:
```env
# Clerk Configuration
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
CLERK_WEBHOOK_SECRET=whsec_your_webhook_secret

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Step 3: Database Schema (Supabase SQL)
Create comprehensive database schema with:

### Tables:
1. **organizations** - Company/tenant data
   - id (UUID, PK), name, domain, slug, logo_url, settings (JSONB), timestamps

2. **users** - User profiles linked to Clerk
   - id (UUID, PK), clerk_user_id (unique), email, first_name, last_name, avatar_url
   - organization_id (FK), role (admin/manager/member), is_active, last_sign_in_at, timestamps

3. **products** - Organization's product catalog
   - id (UUID, PK), organization_id (FK), name, description, price, sku, stock_quantity, is_active, timestamps

4. **orders** - Customer orders
   - id (UUID, PK), organization_id (FK), user_id (FK), total_amount, status, timestamps

5. **order_items** - Order line items
   - id (UUID, PK), order_id (FK), product_id (FK), quantity, unit_price, total_price

### Features:
- Row Level Security (RLS) policies for multi-tenancy
- Proper indexes for performance
- Triggers for updated_at timestamps
- UUID primary keys with proper foreign key constraints

## Step 4: TypeScript Configuration
Create comprehensive type definitions:
- Database types matching Supabase schema
- Component prop types
- API response types
- Clerk user types extensions

## Step 5: Core Authentication Setup

### Clerk Integration:
1. **middleware.ts** - Protect routes and sync users
2. **app/layout.tsx** - ClerkProvider wrapper
3. **lib/supabase.ts** - Client configurations (browser + admin)
4. **lib/syncUser.ts** - Auto-sync Clerk users to Supabase

### User Sync Logic:
- On user login, check if user exists in Supabase
- If not, create user record with organization assignment
- Auto-assign organization based on email domain
- Handle organization creation for new domains

## Step 6: Core Application Structure

### Layout & Navigation:
- **app/layout.tsx** - Root layout with Clerk
- **components/Navbar.tsx** - Navigation with user menu
- **components/Sidebar.tsx** - Dashboard sidebar navigation

### Authentication Pages:
- **app/sign-in/[[...sign-in]]/page.tsx** - Clerk sign-in
- **app/sign-up/[[...sign-up]]/page.tsx** - Clerk sign-up

### Dashboard Pages:
- **app/dashboard/page.tsx** - Overview dashboard
- **app/dashboard/products/page.tsx** - Product management
- **app/dashboard/orders/page.tsx** - Order management
- **app/dashboard/users/page.tsx** - User management (admin only)
- **app/dashboard/settings/page.tsx** - Organization settings

## Step 7: API Routes

### Webhooks:
- **app/api/webhooks/clerk/route.ts** - Handle Clerk user events

### Data APIs:
- **app/api/products/route.ts** - CRUD operations for products
- **app/api/orders/route.ts** - Order management
- **app/api/users/route.ts** - User management
- **app/api/organization/route.ts** - Organization settings

## Step 8: UI Components

### Core Components:
- **components/ui/** - Reusable UI components (Button, Input, Card, Table, etc.)
- **components/ProductCard.tsx** - Product display component
- **components/OrderTable.tsx** - Order listing component
- **components/UserTable.tsx** - User management component

### Forms:
- **components/forms/ProductForm.tsx** - Add/edit products
- **components/forms/OrderForm.tsx** - Create orders
- **components/forms/UserInviteForm.tsx** - Invite users

## Step 9: Business Logic Implementation

### Product Management:
- Create, read, update, delete products
- Stock management
- Price management
- SKU generation

### Order Management:
- Create orders with multiple items
- Order status workflow
- Order history and tracking

### User Management:
- Role-based access control
- User invitation system
- Organization member management

## Step 10: Security & Permissions

### Implement:
- RLS policies enforcement
- Role-based UI rendering
- API endpoint protection
- Input validation and sanitization

## Step 11: Basic Styling & UX

### Design Requirements:
- Clean, professional B2B interface
- Responsive design for mobile/desktop
- Loading states and error handling
- Toast notifications for user feedback

## Step 12: Testing & Validation

### Create:
- Sample data seeding script
- Basic error boundary components
- Form validation
- API error handling

## Deliverables Expected:

1. **Fully functional Next.js application** with authentication
2. **Working Clerk → Supabase user sync** on first login
3. **Multi-tenant data isolation** via RLS
4. **Basic CRUD operations** for products and orders
5. **Role-based access control** (admin, manager, member)
6. **Responsive UI** with professional styling
7. **Organization management** (auto-creation, settings)
8. **Sample data and documentation** for testing

## Key Success Criteria:
- ✅ User can sign up/sign in with Clerk
- ✅ User automatically created in Supabase on first login
- ✅ Organization auto-assigned based on email domain
- ✅ Users only see data from their organization
- ✅ Admin users can manage products and orders
- ✅ Member users can view products and create orders
- ✅ All operations respect multi-tenant boundaries

## Additional Notes:
- Use TypeScript throughout for type safety
- Implement proper error handling and loading states
- Add basic form validation
- Include sample data for demonstration
- Focus on core functionality over advanced features for POC

Please implement this step by step, ensuring each component works before moving to the next. Test the authentication flow and user sync thoroughly before building the business logic components.