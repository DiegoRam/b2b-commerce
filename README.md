# B2B E-commerce Platform

A multi-tenant B2B e-commerce platform built with Next.js, Clerk authentication, and Convex database (migrating from Supabase). Features organization-based access control, automated user management, and a comprehensive product/order management system.

## 🚀 Features

- **Multi-tenant Architecture**: Organization-based data isolation with automatic domain assignment
- **Authentication**: Secure authentication with Clerk, including sign-in/sign-up flows
- **User Management**: Automatic user sync between Clerk and the database (currently migrating from Supabase to Convex) with role-based access control
- **Dashboard**: Professional B2B interface with navigation and user management
- **Real-time Sync**: Webhook-based synchronization between authentication and database
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Modern UI**: Clean, responsive design built with Tailwind CSS

## 🛠 Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) with App Router
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Authentication**: [Clerk](https://clerk.com/)
- **Database**: [Convex](https://www.convex.dev) (migrating from Supabase)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Fonts**: Geist Sans and Geist Mono

## 📋 Prerequisites

Before running this project, make sure you have:

- Node.js 18+ installed
- A Clerk account and application set up
- A Convex project set up (sign up at convex.dev)
- npm or yarn package manager

## 🔧 Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd b2b-ecommerce
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Copy the `.env.local` file and fill in your actual API keys:
   ```env
   # Clerk Configuration
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_actual_key_here
   CLERK_SECRET_KEY=sk_test_your_actual_key_here
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
   NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
   CLERK_WEBHOOK_SECRET=whsec_your_webhook_secret

   # Convex Configuration
CONVEX_URL=https://your-convex-url
CONVEX_DEPLOYMENT=your-deployment
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

## 🗄️ Database Setup

### Fresh Multi-Organization Schema

**For POC/Development**: Use the complete fresh schema script that creates the entire multi-organization database from scratch.

1. **Copy the schema script**:
   ```bash
   # The file fresh_multi_org_schema.sql contains the complete database schema
   ```

2. **Run in Supabase SQL Editor**:
   - Go to your Supabase project
   - Navigate to "SQL Editor"
   - Copy and paste the entire contents of `fresh_multi_org_schema.sql`
   - Execute the script

3. **What gets created**:
   - ✅ Complete multi-organization table structure
   - ✅ Row Level Security policies for data isolation
   - ✅ Performance indexes for fast queries
   - ✅ Sample test data for 3 organizations
   - ✅ Sample users with multi-organization memberships
   - ✅ Sample products and orders for testing

### Sample Organizations Created

The schema includes test data for immediate testing:

| Organization | Subdomain | Test User | Role |
|-------------|-----------|-----------|------|
| Educabot | `educabot` | multiorg@example.com | admin |
| Minimal Art | `minimalart` | multiorg@example.com | manager |
| Test Company | `testorg` | multiorg@example.com | member |

### Database Features

- **Multi-organization users**: Users can belong to multiple organizations with different roles
- **Subdomain routing**: Each organization has a unique subdomain for access
- **Data isolation**: Row Level Security ensures organization-scoped data access
- **Performance optimized**: Comprehensive indexes for fast queries
- **Clerk integration**: Ready for Clerk organization and user synchronization

### Clerk Webhook Setup

1. Go to your Clerk Dashboard
2. Navigate to "Webhooks" section
3. Add a new webhook endpoint: `https://your-domain.com/api/webhooks/clerk`
4. Select the following events:
   - `user.created`
   - `user.updated`
   - `user.deleted`
   - `organization.created`
   - `organization.updated`
   - `organization.deleted`
   - `organizationMembership.created`
   - `organizationMembership.updated`
   - `organizationMembership.deleted`
5. Copy the webhook secret and add it to your `.env.local` file

### Update Organization IDs

After running the fresh schema, update the organizations with your actual Clerk organization IDs:

```sql
-- Replace with your actual Clerk organization IDs
UPDATE organizations 
SET clerk_org_id = 'org_your_actual_clerk_id_here'
WHERE subdomain = 'educabot';

UPDATE organizations 
SET clerk_org_id = 'org_your_actual_clerk_id_here'
WHERE subdomain = 'minimalart';
```

## 🚀 Development

### Standard Development


1. **Start the Convex dev server**:
   ```bash
   npm run convex
   ```

2. **Start the Next.js dev server**:
   ```bash
   npm run dev
   ```

3. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)


### 🌐 Subdomain Testing Setup

The application uses subdomain-based multi-tenancy. Follow these steps to test subdomain functionality:

#### 1. Configure Local Subdomains

**Option A: Browser-only (Recommended for quick testing)**
- Chrome/Firefox automatically resolve `*.localhost` domains
- No additional configuration needed
- Access: `http://educabot.localhost:3000`, `http://minimalart.localhost:3000`

**Option B: System hosts file (For advanced testing)**
Add to `/etc/hosts` (macOS/Linux) or `C:\Windows\System32\drivers\etc\hosts` (Windows):
```
127.0.0.1 educabot.localhost
127.0.0.1 minimalart.localhost
127.0.0.1 testorg.localhost
```

#### 2. Set Up Test Organizations in Clerk

1. **Go to Clerk Dashboard** → Organizations
2. **Create test organizations** with specific slugs:
   ```
   Organization Name: "Educabot"
   Slug: "educabot"
   
   Organization Name: "Minimal Art" 
   Slug: "minimalart"
   
   Organization Name: "Test Organization"
   Slug: "testorg"
   ```

3. **Add test users to organizations** with different roles:
   - Add the same user to multiple organizations
   - Assign different roles (admin, manager, member) per organization

#### 3. Test Subdomain Access

Once the server is running (`npm run dev`):

**Multi-Organization User Testing:**
```bash
# Main domain - should show organization selection
http://localhost:3000

# Educabot organization - should load Educabot data
http://educabot.localhost:3000

# Minimal Art organization - should load Minimal Art data  
http://minimalart.localhost:3000

# Test organization - should load Test org data
http://testorg.localhost:3000
```

**Access Control Testing:**
- Try accessing a subdomain the user doesn't belong to
- Should see "Access Denied" with organization switcher
- Should show available organizations for the user

#### 4. Expected Behavior

✅ **Valid subdomain + authorized user**: Organization dashboard loads  
✅ **Valid subdomain + unauthorized user**: Access denied screen  
✅ **Invalid subdomain**: Organization selection or first available org  
✅ **Multi-org user**: Can switch between organizations seamlessly  

### 🧪 Development Commands

```bash
# Start development server
npm run dev

# Type checking without build (useful during development)
npx tsc --noEmit

# Linting
npm run lint

# Build (requires valid API keys)
npm run build
```

### 🔧 Available Routes

**Public Routes:**
- `/` - Landing page / Organization selection
- `/sign-in` - User sign-in  
- `/sign-up` - User registration

**Protected Routes (require authentication + organization access):**
- `/dashboard` - Organization-specific dashboard
- `/dashboard/products` - Product management (coming soon)
- `/dashboard/orders` - Order management (coming soon) 
- `/dashboard/users` - User management (coming soon)
- `/dashboard/settings` - Organization settings (coming soon)

**API Routes:**
- `/api/webhooks/clerk` - Clerk webhook handler (user/org sync)

### 🐛 Troubleshooting Subdomain Setup

#### Common Issues & Solutions

**🔸 "Organization not found" Error**
```bash
# Check if organizations exist in database
SELECT * FROM organizations WHERE subdomain = 'educabot';

# Verify Clerk organization slug matches subdomain
# Clerk Dashboard → Organizations → Check slug field
```
*Solution*: Ensure Clerk organization slug exactly matches the subdomain name.

**🔸 "Access Denied" for Valid User**
```bash
# Check user membership in database
SELECT om.*, o.name, u.email 
FROM organization_memberships om
JOIN organizations o ON o.id = om.organization_id  
JOIN users u ON u.id = om.user_id
WHERE u.clerk_user_id = 'your_clerk_user_id';
```
*Solution*: Verify user is added to organization in Clerk and webhook has synced the membership.

**🔸 Subdomain Not Detected**
- Ensure using `http://subdomain.localhost:3000` format
- Check browser network tab for correct Host header
- Verify middleware is running (check server logs)

**🔸 Webhook Not Syncing Data**
1. Check webhook URL in Clerk Dashboard: `https://your-domain.com/api/webhooks/clerk`
2. Verify webhook secret in `.env.local`
3. Check webhook logs in Clerk Dashboard
4. Look for errors in application server logs

**🔸 Build Failures During Development**
```bash
# Use TypeScript check instead of full build during development
npx tsc --noEmit

# Or run with skip build step
npm run dev
```
*Note*: Build failures with placeholder API keys are normal during development.

#### Quick Health Check

Run these steps to verify your setup:

1. **Database Schema Verification**:
   ```sql
   -- Check if all tables exist
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   
   -- Should show: organization_memberships, organizations, order_items, orders, products, users
   ```

2. **Sample Data Verification**:
   ```sql
   -- Check organizations
   SELECT name, subdomain, clerk_org_id FROM organizations;
   
   -- Check multi-org memberships
   SELECT * FROM user_organization_memberships;
   
   -- Check sample products
   SELECT o.name as org, p.name as product, p.price 
   FROM products p 
   JOIN organizations o ON o.id = p.organization_id;
   ```

3. **API Keys Validation**:
   - Clerk keys should start with `pk_test_` or `pk_live_`
   - Supabase URL should be `https://your-project.supabase.co`

4. **Subdomain Testing**:
   ```bash
   # Test main domain
   curl -I http://localhost:3000
   
   # Test subdomain (should work with modern browsers)
   curl -I http://educabot.localhost:3000
   ```

#### Debug Mode

Enable detailed logging by adding to your `.env.local`:
```env
NODE_ENV=development
DEBUG=clerk:*
```

## 🏗️ Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── api/                     # API routes
│   │   └── webhooks/clerk/      # Clerk webhook handler
│   ├── dashboard/               # Protected dashboard pages
│   ├── sign-in/                 # Authentication pages
│   ├── sign-up/
│   ├── layout.tsx               # Root layout with ClerkProvider
│   └── page.tsx                 # Landing page
├── lib/                         # Utility functions
│   ├── supabase.ts             # Supabase client configurations
│   └── syncUser.ts             # User synchronization logic
└── types/                       # TypeScript type definitions
    ├── database.ts             # Supabase database types
    └── index.ts                # Application types
```

## 🔐 Authentication Flow

1. **User Registration/Login**: Users authenticate through Clerk
2. **Organization Assignment**: Users are automatically assigned to organizations based on email domain
3. **Auto-Organization Creation**: New organizations are created for unrecognized domains
4. **Database Sync**: User data is synchronized to Supabase via webhooks
5. **Dashboard Access**: Authenticated users access the multi-tenant dashboard

## 👥 User Roles

- **Admin**: Full access to organization management, products, orders, and users
- **Manager**: Access to products and orders, limited user management
- **Member**: Read-only access to products, can create orders

## 🛡️ Security Features

- **Row Level Security (RLS)**: Data isolation at the database level
- **Multi-tenant Architecture**: Organization-scoped data access
- **Protected Routes**: Middleware-based route protection
- **Input Validation**: Type-safe API endpoints and form validation

## 📝 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key | Yes |
| `CLERK_SECRET_KEY` | Clerk secret key | Yes |
| `CLERK_WEBHOOK_SECRET` | Clerk webhook secret | Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |

## 🧪 Testing

```bash
# Run ESLint
npm run lint

# Build the application
npm run build

# Start production server
npm start
```

## 🚧 Roadmap

- [ ] Product management pages and API
- [ ] Order management system
- [ ] User invitation and management
- [ ] Organization settings
- [ ] Analytics dashboard
- [ ] Email notifications
- [ ] Advanced reporting

## 📚 Documentation

For more detailed information about the project architecture and development guidelines, see [CLAUDE.md](./CLAUDE.md).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [CLAUDE.md](./CLAUDE.md) file for development guidelines
2. Review the Clerk and Supabase documentation
3. Open an issue in the repository

---

**Built with ❤️ using Next.js, Clerk, and Supabase**