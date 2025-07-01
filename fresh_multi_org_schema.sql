-- ============================================================================
-- FRESH MULTI-ORGANIZATION DATABASE SCHEMA
-- ============================================================================
-- Complete database schema for multi-tenant B2B e-commerce platform
-- with subdomain-based organization isolation and multi-organization users.
--
-- This script creates the entire database from scratch - perfect for POCs.
-- Run this in your Supabase SQL editor to set up the complete schema.
-- ============================================================================

-- ============================================================================
-- STEP 1: Create Organizations Table
-- ============================================================================

CREATE TABLE organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_org_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  domain TEXT UNIQUE,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: Create Users Table
-- ============================================================================

CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_sign_in_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 3: Create Organization Memberships Table (Many-to-Many)
-- ============================================================================

CREATE TABLE organization_memberships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'manager', 'member')),
  is_active BOOLEAN DEFAULT true,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: user can only have one membership per organization
  UNIQUE(user_id, organization_id)
);

-- ============================================================================
-- STEP 4: Create Products Table
-- ============================================================================

CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  sku TEXT,
  stock_quantity INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique SKU per organization
  UNIQUE(organization_id, sku)
);

-- ============================================================================
-- STEP 5: Create Orders Table
-- ============================================================================

CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 6: Create Order Items Table
-- ============================================================================

CREATE TABLE order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL
);

-- ============================================================================
-- STEP 7: Create Updated At Triggers
-- ============================================================================

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for all tables with updated_at
CREATE TRIGGER update_organizations_updated_at 
  BEFORE UPDATE ON organizations 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_memberships_updated_at 
  BEFORE UPDATE ON organization_memberships 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at 
  BEFORE UPDATE ON products 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at 
  BEFORE UPDATE ON orders 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 8: Create Performance Indexes
-- ============================================================================

-- Organizations indexes
CREATE INDEX idx_organizations_clerk_org_id ON organizations(clerk_org_id);
CREATE INDEX idx_organizations_subdomain ON organizations(subdomain);
CREATE INDEX idx_organizations_is_active ON organizations(is_active);

-- Users indexes
CREATE INDEX idx_users_clerk_user_id ON users(clerk_user_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_active ON users(is_active);

-- Organization memberships indexes
CREATE INDEX idx_org_memberships_user_id ON organization_memberships(user_id);
CREATE INDEX idx_org_memberships_org_id ON organization_memberships(organization_id);
CREATE INDEX idx_org_memberships_is_active ON organization_memberships(is_active);
CREATE INDEX idx_org_memberships_role ON organization_memberships(role);

-- Products indexes
CREATE INDEX idx_products_org_id ON products(organization_id);
CREATE INDEX idx_products_created_by ON products(created_by);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_sku ON products(sku);

-- Orders indexes
CREATE INDEX idx_orders_org_id ON orders(organization_id);
CREATE INDEX idx_orders_created_by ON orders(created_by);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_customer_email ON orders(customer_email);

-- Order items indexes
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- ============================================================================
-- STEP 9: Enable Row Level Security (RLS)
-- ============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 10: Create RLS Policies
-- ============================================================================

-- Organizations: Users can only view organizations they're members of
CREATE POLICY "Users can view member organizations" ON organizations FOR SELECT 
USING (
  id IN (
    SELECT om.organization_id 
    FROM organization_memberships om
    JOIN users u ON u.id = om.user_id
    WHERE u.clerk_user_id = auth.jwt() ->> 'sub'
    AND om.is_active = true
  )
);

-- Users: Users can view other users in their organizations
CREATE POLICY "Users can view organization members" ON users FOR SELECT 
USING (
  id IN (
    SELECT DISTINCT u2.id
    FROM users u2
    JOIN organization_memberships om2 ON om2.user_id = u2.id
    WHERE om2.organization_id IN (
      SELECT om1.organization_id
      FROM organization_memberships om1
      JOIN users u1 ON u1.id = om1.user_id
      WHERE u1.clerk_user_id = auth.jwt() ->> 'sub'
      AND om1.is_active = true
    )
    AND om2.is_active = true
  )
);

-- Organization memberships: Users can view memberships in their organizations
CREATE POLICY "Users can view organization memberships" ON organization_memberships FOR SELECT 
USING (
  organization_id IN (
    SELECT om.organization_id
    FROM organization_memberships om
    JOIN users u ON u.id = om.user_id
    WHERE u.clerk_user_id = auth.jwt() ->> 'sub'
    AND om.is_active = true
  )
);

-- Products: Users can view products from their organizations
CREATE POLICY "Users can view organization products" ON products FOR SELECT 
USING (
  organization_id IN (
    SELECT om.organization_id
    FROM organization_memberships om
    JOIN users u ON u.id = om.user_id
    WHERE u.clerk_user_id = auth.jwt() ->> 'sub'
    AND om.is_active = true
  )
);

-- Orders: Users can view orders from their organizations
CREATE POLICY "Users can view organization orders" ON orders FOR SELECT 
USING (
  organization_id IN (
    SELECT om.organization_id
    FROM organization_memberships om
    JOIN users u ON u.id = om.user_id
    WHERE u.clerk_user_id = auth.jwt() ->> 'sub'
    AND om.is_active = true
  )
);

-- Order items: Users can view order items from their organizations
CREATE POLICY "Users can view organization order items" ON order_items FOR SELECT 
USING (
  order_id IN (
    SELECT o.id
    FROM orders o
    WHERE o.organization_id IN (
      SELECT om.organization_id
      FROM organization_memberships om
      JOIN users u ON u.id = om.user_id
      WHERE u.clerk_user_id = auth.jwt() ->> 'sub'
      AND om.is_active = true
    )
  )
);

-- ============================================================================
-- STEP 11: Create Helpful Views
-- ============================================================================

-- View to get user's organization memberships with org details
CREATE VIEW user_organization_memberships AS
SELECT 
  om.id,
  om.user_id,
  om.organization_id,
  om.role,
  om.is_active,
  om.joined_at,
  u.clerk_user_id,
  u.email,
  u.first_name,
  u.last_name,
  o.name AS organization_name,
  o.subdomain,
  o.domain,
  o.clerk_org_id
FROM organization_memberships om
JOIN users u ON u.id = om.user_id
JOIN organizations o ON o.id = om.organization_id
WHERE om.is_active = true
  AND u.is_active = true
  AND o.is_active = true;

-- ============================================================================
-- STEP 12: Insert Sample Data for POC Testing
-- ============================================================================

-- Sample Organizations
INSERT INTO organizations (clerk_org_id, name, subdomain, domain, settings) VALUES
('org_educabot_sample', 'Educabot', 'educabot', 'educabot.com', '{"theme": "blue", "features": ["ai", "education"]}'),
('org_minimalart_sample', 'Minimal Art', 'minimalart', 'minimalart.com', '{"theme": "minimal", "features": ["art", "gallery"]}'),
('org_testcompany_sample', 'Test Company', 'testorg', null, '{"theme": "default"}');

-- Sample Users
INSERT INTO users (clerk_user_id, email, first_name, last_name) VALUES
('user_sample_admin', 'admin@example.com', 'Admin', 'User'),
('user_sample_manager', 'manager@example.com', 'Manager', 'User'),
('user_sample_member', 'member@example.com', 'Member', 'User'),
('user_sample_multiorg', 'multiorg@example.com', 'Multi', 'Org User');

-- Sample Organization Memberships
INSERT INTO organization_memberships (user_id, organization_id, role) VALUES
-- Admin user in Educabot
((SELECT id FROM users WHERE clerk_user_id = 'user_sample_admin'), 
 (SELECT id FROM organizations WHERE subdomain = 'educabot'), 
 'admin'),

-- Manager user in Minimal Art
((SELECT id FROM users WHERE clerk_user_id = 'user_sample_manager'), 
 (SELECT id FROM organizations WHERE subdomain = 'minimalart'), 
 'manager'),

-- Member user in Test Company
((SELECT id FROM users WHERE clerk_user_id = 'user_sample_member'), 
 (SELECT id FROM organizations WHERE subdomain = 'testorg'), 
 'member'),

-- Multi-org user in multiple organizations
((SELECT id FROM users WHERE clerk_user_id = 'user_sample_multiorg'), 
 (SELECT id FROM organizations WHERE subdomain = 'educabot'), 
 'admin'),
((SELECT id FROM users WHERE clerk_user_id = 'user_sample_multiorg'), 
 (SELECT id FROM organizations WHERE subdomain = 'minimalart'), 
 'manager'),
((SELECT id FROM users WHERE clerk_user_id = 'user_sample_multiorg'), 
 (SELECT id FROM organizations WHERE subdomain = 'testorg'), 
 'member');

-- Sample Products
INSERT INTO products (organization_id, name, description, price, sku, stock_quantity, created_by) VALUES
-- Educabot products
((SELECT id FROM organizations WHERE subdomain = 'educabot'), 
 'AI Learning Platform', 'Advanced AI-powered learning management system', 299.99, 'EDU-AI-001', 50,
 (SELECT id FROM users WHERE clerk_user_id = 'user_sample_admin')),

((SELECT id FROM organizations WHERE subdomain = 'educabot'), 
 'Smart Quiz Generator', 'Automatically generate quizzes from content', 99.99, 'EDU-QUIZ-001', 100,
 (SELECT id FROM users WHERE clerk_user_id = 'user_sample_admin')),

-- Minimal Art products
((SELECT id FROM organizations WHERE subdomain = 'minimalart'), 
 'Digital Art Collection', 'Curated collection of minimal digital art', 199.99, 'ART-DIG-001', 25,
 (SELECT id FROM users WHERE clerk_user_id = 'user_sample_manager')),

((SELECT id FROM organizations WHERE subdomain = 'minimalart'), 
 'Gallery Management Tool', 'Professional gallery management software', 149.99, 'ART-GAL-001', 30,
 (SELECT id FROM users WHERE clerk_user_id = 'user_sample_manager')),

-- Test Company products
((SELECT id FROM organizations WHERE subdomain = 'testorg'), 
 'Sample Product', 'A sample product for testing', 49.99, 'TEST-001', 999,
 (SELECT id FROM users WHERE clerk_user_id = 'user_sample_member'));

-- Sample Orders
INSERT INTO orders (organization_id, customer_name, customer_email, total_amount, status, created_by) VALUES
-- Educabot orders
((SELECT id FROM organizations WHERE subdomain = 'educabot'), 
 'John Smith', 'john.smith@school.edu', 299.99, 'confirmed',
 (SELECT id FROM users WHERE clerk_user_id = 'user_sample_admin')),

((SELECT id FROM organizations WHERE subdomain = 'educabot'), 
 'Jane Doe', 'jane.doe@university.edu', 99.99, 'shipped',
 (SELECT id FROM users WHERE clerk_user_id = 'user_sample_admin')),

-- Minimal Art orders
((SELECT id FROM organizations WHERE subdomain = 'minimalart'), 
 'Art Collector', 'collector@artgallery.com', 199.99, 'delivered',
 (SELECT id FROM users WHERE clerk_user_id = 'user_sample_manager')),

-- Test Company orders
((SELECT id FROM organizations WHERE subdomain = 'testorg'), 
 'Test Customer', 'test@customer.com', 49.99, 'pending',
 (SELECT id FROM users WHERE clerk_user_id = 'user_sample_member'));

-- Sample Order Items
INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price) VALUES
-- First Educabot order
((SELECT id FROM orders WHERE customer_email = 'john.smith@school.edu'),
 (SELECT id FROM products WHERE sku = 'EDU-AI-001'),
 1, 299.99, 299.99),

-- Second Educabot order
((SELECT id FROM orders WHERE customer_email = 'jane.doe@university.edu'),
 (SELECT id FROM products WHERE sku = 'EDU-QUIZ-001'),
 1, 99.99, 99.99),

-- Minimal Art order
((SELECT id FROM orders WHERE customer_email = 'collector@artgallery.com'),
 (SELECT id FROM products WHERE sku = 'ART-DIG-001'),
 1, 199.99, 199.99),

-- Test Company order
((SELECT id FROM orders WHERE customer_email = 'test@customer.com'),
 (SELECT id FROM products WHERE sku = 'TEST-001'),
 1, 49.99, 49.99);

-- ============================================================================
-- STEP 13: Create Types/Enums for Application Use
-- ============================================================================

CREATE TYPE user_role AS ENUM ('admin', 'manager', 'member');
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled');

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '==========================================================';
  RAISE NOTICE 'MULTI-ORGANIZATION DATABASE SCHEMA CREATED SUCCESSFULLY!';
  RAISE NOTICE '==========================================================';
  RAISE NOTICE 'Database includes:';
  RAISE NOTICE '- ✅ Complete multi-organization table structure';
  RAISE NOTICE '- ✅ Row Level Security policies';
  RAISE NOTICE '- ✅ Performance indexes';
  RAISE NOTICE '- ✅ Sample test data for 3 organizations';
  RAISE NOTICE '- ✅ Sample users with multi-org memberships';
  RAISE NOTICE '- ✅ Sample products and orders';
  RAISE NOTICE '';
  RAISE NOTICE 'Test Organizations Created:';
  RAISE NOTICE '- educabot.localhost:3000 (Educabot)';
  RAISE NOTICE '- minimalart.localhost:3000 (Minimal Art)';
  RAISE NOTICE '- testorg.localhost:3000 (Test Company)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '1. Update Clerk organization IDs in organizations table';
  RAISE NOTICE '2. Set up Clerk webhook for user/org sync';
  RAISE NOTICE '3. Test subdomain routing in your application';
  RAISE NOTICE '==========================================================';
END $$;

-- ============================================================================
-- QUICK VERIFICATION QUERIES
-- ============================================================================

-- View all organizations
-- SELECT id, name, subdomain, clerk_org_id, is_active FROM organizations;

-- View all users and their organization memberships
-- SELECT * FROM user_organization_memberships;

-- View products by organization
-- SELECT o.name as org_name, p.name as product_name, p.price, p.sku 
-- FROM products p 
-- JOIN organizations o ON o.id = p.organization_id 
-- ORDER BY o.name, p.name;

-- View orders by organization
-- SELECT o.name as org_name, ord.customer_name, ord.total_amount, ord.status
-- FROM orders ord
-- JOIN organizations o ON o.id = ord.organization_id
-- ORDER BY o.name, ord.created_at DESC;