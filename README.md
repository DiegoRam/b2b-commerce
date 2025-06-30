# B2B E-commerce Platform

A multi-tenant B2B e-commerce platform built with Next.js, Clerk authentication, and Supabase database. Features organization-based access control, automated user management, and a comprehensive product/order management system.

## 🚀 Features

- **Multi-tenant Architecture**: Organization-based data isolation with automatic domain assignment
- **Authentication**: Secure authentication with Clerk, including sign-in/sign-up flows
- **User Management**: Automatic user sync between Clerk and Supabase with role-based access control
- **Dashboard**: Professional B2B interface with navigation and user management
- **Real-time Sync**: Webhook-based synchronization between authentication and database
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Modern UI**: Clean, responsive design built with Tailwind CSS

## 🛠 Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) with App Router
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Authentication**: [Clerk](https://clerk.com/)
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Fonts**: Geist Sans and Geist Mono

## 📋 Prerequisites

Before running this project, make sure you have:

- Node.js 18+ installed
- A Clerk account and application set up
- A Supabase project with database configured
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

   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

## 🗄️ Database Setup

### Supabase Schema

Run the following SQL commands in your Supabase SQL editor to set up the database schema:

```sql
-- Create organizations table
CREATE TABLE organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create users table
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  avatar_url TEXT,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'manager', 'member')),
  is_active BOOLEAN DEFAULT true,
  last_sign_in_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create products table
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  sku TEXT NOT NULL,
  stock_quantity INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, sku)
);

-- Create orders table
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  total_amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create order_items table
CREATE TABLE order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL
);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (basic examples - customize based on your needs)
-- Users can only access their own organization's data
CREATE POLICY "Users can view own organization" ON organizations FOR SELECT USING (
  id IN (
    SELECT organization_id FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
  )
);

CREATE POLICY "Users can view own organization users" ON users FOR SELECT USING (
  organization_id IN (
    SELECT organization_id FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
  )
);
```

### Clerk Webhook Setup

1. Go to your Clerk Dashboard
2. Navigate to "Webhooks" section
3. Add a new webhook endpoint: `https://your-domain.com/api/webhooks/clerk`
4. Select the following events:
   - `user.created`
   - `user.updated`
   - `user.deleted`
5. Copy the webhook secret and add it to your `.env.local` file

## 🚀 Development

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

3. **Available routes**:
   - `/` - Landing page
   - `/sign-in` - User sign-in
   - `/sign-up` - User registration
   - `/dashboard` - Main dashboard (protected)
   - `/dashboard/products` - Product management (coming soon)
   - `/dashboard/orders` - Order management (coming soon)
   - `/dashboard/users` - User management (coming soon)
   - `/dashboard/settings` - Organization settings (coming soon)

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