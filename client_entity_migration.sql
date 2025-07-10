-- ============================================================================
-- CLIENT ENTITY MIGRATION FOR B2B CART AND CHECKOUT SYSTEM
-- ============================================================================
-- This migration adds the Client entity to support B2B operations where:
-- - Users (platform operators) place orders on behalf of Clients (B2B customers)
-- - Clients are synced with MedusaJS customers for e-commerce operations
-- - Orders maintain Organization + Client + User context
-- 
-- Run this in your Supabase SQL editor after the base schema is in place.
-- ============================================================================

-- ============================================================================
-- STEP 1: Create Clients Table
-- ============================================================================

CREATE TABLE clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  medusa_customer_id TEXT UNIQUE, -- Links to MedusaJS customer
  
  -- Basic client information
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  
  -- Business details
  tax_id TEXT,
  business_type TEXT CHECK (business_type IN ('corporation', 'partnership', 'llc', 'sole_proprietorship', 'other')),
  industry TEXT,
  
  -- Billing information
  billing_address_line1 TEXT,
  billing_address_line2 TEXT,
  billing_city TEXT,
  billing_state TEXT,
  billing_postal_code TEXT,
  billing_country TEXT DEFAULT 'US',
  
  -- Shipping information
  shipping_address_line1 TEXT,
  shipping_address_line2 TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_postal_code TEXT,
  shipping_country TEXT DEFAULT 'US',
  
  -- Client settings and preferences
  payment_terms TEXT CHECK (payment_terms IN ('net_15', 'net_30', 'net_60', 'cod', 'prepaid')) DEFAULT 'net_30',
  credit_limit DECIMAL(10,2) DEFAULT 0,
  preferred_currency TEXT DEFAULT 'USD',
  notes TEXT,
  
  -- Status and metadata
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: company name must be unique per organization
  UNIQUE(organization_id, company_name),
  
  -- Unique constraint: contact email must be unique per organization
  UNIQUE(organization_id, contact_email)
);

-- ============================================================================
-- STEP 2: Create Client Contacts Table (Optional - for multiple contacts)
-- ============================================================================

CREATE TABLE client_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  title TEXT,
  department TEXT,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: email must be unique per client
  UNIQUE(client_id, email)
);

-- ============================================================================
-- STEP 3: Modify Orders Table to Reference Clients
-- ============================================================================

-- Add client_id column to orders table
ALTER TABLE orders ADD COLUMN client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- Create index for client_id
CREATE INDEX idx_orders_client_id ON orders(client_id);

-- ============================================================================
-- STEP 4: Create Carts Table for MedusaJS Integration
-- ============================================================================

CREATE TABLE carts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medusa_cart_id TEXT UNIQUE, -- Links to MedusaJS cart
  
  -- Cart metadata
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  currency TEXT DEFAULT 'USD',
  total_amount DECIMAL(10,2) DEFAULT 0,
  item_count INTEGER DEFAULT 0,
  
  -- Session information
  session_id TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Note: Unique constraint for active carts will be created as index below
);

-- ============================================================================
-- STEP 5: Create Cart Items Table
-- ============================================================================

CREATE TABLE cart_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  medusa_line_item_id TEXT, -- Links to MedusaJS line item
  
  -- Item details
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  
  -- Product snapshot (in case product changes)
  product_name TEXT NOT NULL,
  product_sku TEXT,
  product_description TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: one entry per product per cart
  UNIQUE(cart_id, product_id)
);

-- ============================================================================
-- STEP 6: Create Updated At Triggers for New Tables
-- ============================================================================

-- Clients table trigger
CREATE TRIGGER update_clients_updated_at 
  BEFORE UPDATE ON clients 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Client contacts table trigger
CREATE TRIGGER update_client_contacts_updated_at 
  BEFORE UPDATE ON client_contacts 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Carts table trigger
CREATE TRIGGER update_carts_updated_at 
  BEFORE UPDATE ON carts 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Cart items table trigger
CREATE TRIGGER update_cart_items_updated_at 
  BEFORE UPDATE ON cart_items 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 7: Create Performance Indexes
-- ============================================================================

-- Clients indexes
CREATE INDEX idx_clients_organization_id ON clients(organization_id);
CREATE INDEX idx_clients_medusa_customer_id ON clients(medusa_customer_id);
CREATE INDEX idx_clients_contact_email ON clients(contact_email);
CREATE INDEX idx_clients_is_active ON clients(is_active);
CREATE INDEX idx_clients_created_by ON clients(created_by);

-- Client contacts indexes
CREATE INDEX idx_client_contacts_client_id ON client_contacts(client_id);
CREATE INDEX idx_client_contacts_email ON client_contacts(email);
CREATE INDEX idx_client_contacts_is_primary ON client_contacts(is_primary);

-- Carts indexes
CREATE INDEX idx_carts_organization_id ON carts(organization_id);
CREATE INDEX idx_carts_client_id ON carts(client_id);
CREATE INDEX idx_carts_user_id ON carts(user_id);
CREATE INDEX idx_carts_medusa_cart_id ON carts(medusa_cart_id);
CREATE INDEX idx_carts_status ON carts(status);
CREATE INDEX idx_carts_expires_at ON carts(expires_at);

-- Unique constraint: one active cart per client per organization
CREATE UNIQUE INDEX idx_carts_unique_active 
  ON carts(organization_id, client_id) 
  WHERE status = 'active';

-- Cart items indexes
CREATE INDEX idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX idx_cart_items_product_id ON cart_items(product_id);
CREATE INDEX idx_cart_items_medusa_line_item_id ON cart_items(medusa_line_item_id);

-- ============================================================================
-- STEP 8: Enable Row Level Security for New Tables
-- ============================================================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 9: Create RLS Policies for New Tables
-- ============================================================================

-- Clients: Users can view clients from their organizations
CREATE POLICY "Users can view organization clients" ON clients FOR SELECT 
USING (
  organization_id IN (
    SELECT om.organization_id
    FROM organization_memberships om
    JOIN users u ON u.id = om.user_id
    WHERE u.clerk_user_id = auth.jwt() ->> 'sub'
    AND om.is_active = true
  )
);

-- Clients: Admins and managers can manage clients
CREATE POLICY "Admins and managers can manage clients" ON clients FOR ALL 
USING (
  organization_id IN (
    SELECT om.organization_id
    FROM organization_memberships om
    JOIN users u ON u.id = om.user_id
    WHERE u.clerk_user_id = auth.jwt() ->> 'sub'
    AND om.is_active = true
    AND om.role IN ('admin', 'manager')
  )
);

-- Client contacts: Users can view contacts for clients in their organizations
CREATE POLICY "Users can view client contacts" ON client_contacts FOR SELECT 
USING (
  client_id IN (
    SELECT c.id
    FROM clients c
    WHERE c.organization_id IN (
      SELECT om.organization_id
      FROM organization_memberships om
      JOIN users u ON u.id = om.user_id
      WHERE u.clerk_user_id = auth.jwt() ->> 'sub'
      AND om.is_active = true
    )
  )
);

-- Carts: Users can view carts from their organizations
CREATE POLICY "Users can view organization carts" ON carts FOR SELECT 
USING (
  organization_id IN (
    SELECT om.organization_id
    FROM organization_memberships om
    JOIN users u ON u.id = om.user_id
    WHERE u.clerk_user_id = auth.jwt() ->> 'sub'
    AND om.is_active = true
  )
);

-- Carts: Users can manage their own carts
CREATE POLICY "Users can manage their own carts" ON carts FOR ALL 
USING (
  user_id IN (
    SELECT u.id
    FROM users u
    WHERE u.clerk_user_id = auth.jwt() ->> 'sub'
  )
);

-- Cart items: Users can view cart items for carts in their organizations
CREATE POLICY "Users can view cart items" ON cart_items FOR SELECT 
USING (
  cart_id IN (
    SELECT c.id
    FROM carts c
    WHERE c.organization_id IN (
      SELECT om.organization_id
      FROM organization_memberships om
      JOIN users u ON u.id = om.user_id
      WHERE u.clerk_user_id = auth.jwt() ->> 'sub'
      AND om.is_active = true
    )
  )
);

-- ============================================================================
-- STEP 10: Create Helpful Views for Client Management
-- ============================================================================

-- View to get client details with organization information
CREATE VIEW client_details AS
SELECT 
  c.id,
  c.organization_id,
  c.medusa_customer_id,
  c.company_name,
  c.contact_name,
  c.contact_email,
  c.contact_phone,
  c.tax_id,
  c.business_type,
  c.industry,
  c.payment_terms,
  c.credit_limit,
  c.preferred_currency,
  c.is_active,
  c.created_at,
  c.updated_at,
  o.name AS organization_name,
  o.subdomain,
  u.first_name || ' ' || u.last_name AS created_by_name
FROM clients c
JOIN organizations o ON o.id = c.organization_id
LEFT JOIN users u ON u.id = c.created_by
WHERE c.is_active = true
  AND o.is_active = true;

-- View to get cart summary with client and organization details
CREATE VIEW cart_summary AS
SELECT 
  c.id,
  c.organization_id,
  c.client_id,
  c.user_id,
  c.medusa_cart_id,
  c.status,
  c.currency,
  c.total_amount,
  c.item_count,
  c.created_at,
  c.updated_at,
  o.name AS organization_name,
  o.subdomain,
  cl.company_name AS client_company_name,
  cl.contact_name AS client_contact_name,
  cl.contact_email AS client_contact_email,
  u.first_name || ' ' || u.last_name AS user_name
FROM carts c
JOIN organizations o ON o.id = c.organization_id
JOIN clients cl ON cl.id = c.client_id
JOIN users u ON u.id = c.user_id
WHERE c.status = 'active';

-- ============================================================================
-- STEP 11: Create Types/Enums for Client Management
-- ============================================================================

CREATE TYPE business_type AS ENUM ('corporation', 'partnership', 'llc', 'sole_proprietorship', 'other');
CREATE TYPE payment_terms AS ENUM ('net_15', 'net_30', 'net_60', 'cod', 'prepaid');
CREATE TYPE cart_status AS ENUM ('active', 'completed', 'abandoned');

-- ============================================================================
-- STEP 12: Insert Sample Client Data for Testing
-- ============================================================================

-- Sample clients for each organization
INSERT INTO clients (
  organization_id, 
  company_name, 
  contact_name, 
  contact_email, 
  contact_phone,
  business_type,
  industry,
  payment_terms,
  credit_limit,
  billing_address_line1,
  billing_city,
  billing_state,
  billing_postal_code,
  created_by
) VALUES
-- Educabot clients
(
  (SELECT id FROM organizations WHERE subdomain = 'educabot'),
  'Springfield Elementary School',
  'Seymour Skinner',
  'skinner@springfield.edu',
  '555-0123',
  'corporation',
  'Education',
  'net_30',
  5000.00,
  '123 Education Ave',
  'Springfield',
  'IL',
  '62701',
  (SELECT id FROM users WHERE clerk_user_id = 'user_sample_admin')
),
(
  (SELECT id FROM organizations WHERE subdomain = 'educabot'),
  'Shelbyville University',
  'Dr. Sarah Johnson',
  's.johnson@shelbyville.edu',
  '555-0456',
  'corporation',
  'Higher Education',
  'net_15',
  10000.00,
  '456 University Blvd',
  'Shelbyville',
  'IN',
  '46176',
  (SELECT id FROM users WHERE clerk_user_id = 'user_sample_admin')
),

-- Minimal Art clients
(
  (SELECT id FROM organizations WHERE subdomain = 'minimalart'),
  'Modern Art Gallery',
  'Isabella Torres',
  'isabella@modernart.com',
  '555-0789',
  'llc',
  'Art & Culture',
  'net_30',
  7500.00,
  '789 Gallery Row',
  'New York',
  'NY',
  '10001',
  (SELECT id FROM users WHERE clerk_user_id = 'user_sample_manager')
),
(
  (SELECT id FROM organizations WHERE subdomain = 'minimalart'),
  'Contemporary Spaces Inc',
  'Marcus Chen',
  'marcus@contempspaces.com',
  '555-0101',
  'corporation',
  'Interior Design',
  'net_60',
  12000.00,
  '101 Design District',
  'Los Angeles',
  'CA',
  '90028',
  (SELECT id FROM users WHERE clerk_user_id = 'user_sample_manager')
),

-- Test Company clients
(
  (SELECT id FROM organizations WHERE subdomain = 'testorg'),
  'Test Client Co',
  'Test Contact',
  'test@testclient.com',
  '555-9999',
  'corporation',
  'Technology',
  'prepaid',
  1000.00,
  '999 Test St',
  'Test City',
  'TX',
  '12345',
  (SELECT id FROM users WHERE clerk_user_id = 'user_sample_member')
);

-- Sample client contacts
INSERT INTO client_contacts (
  client_id,
  name,
  email,
  phone,
  title,
  department,
  is_primary
) VALUES
-- Springfield Elementary contacts
(
  (SELECT id FROM clients WHERE company_name = 'Springfield Elementary School'),
  'Seymour Skinner',
  'skinner@springfield.edu',
  '555-0123',
  'Principal',
  'Administration',
  true
),
(
  (SELECT id FROM clients WHERE company_name = 'Springfield Elementary School'),
  'Edna Krabappel',
  'ekrabappel@springfield.edu',
  '555-0124',
  'Teacher',
  'Education',
  false
),

-- Modern Art Gallery contacts
(
  (SELECT id FROM clients WHERE company_name = 'Modern Art Gallery'),
  'Isabella Torres',
  'isabella@modernart.com',
  '555-0789',
  'Gallery Director',
  'Management',
  true
),
(
  (SELECT id FROM clients WHERE company_name = 'Modern Art Gallery'),
  'James Wilson',
  'james@modernart.com',
  '555-0790',
  'Curator',
  'Collections',
  false
);

-- ============================================================================
-- STEP 13: Update Existing Orders to Reference Clients (Optional)
-- ============================================================================

-- For demonstration purposes, we'll update existing orders to reference clients
-- based on customer email matching. In production, this should be done more carefully.

-- Update Educabot orders
UPDATE orders 
SET client_id = (
  SELECT id FROM clients 
  WHERE organization_id = orders.organization_id 
  AND contact_email = 'skinner@springfield.edu'
)
WHERE organization_id = (SELECT id FROM organizations WHERE subdomain = 'educabot')
AND customer_email = 'john.smith@school.edu';

-- Update Minimal Art orders
UPDATE orders 
SET client_id = (
  SELECT id FROM clients 
  WHERE organization_id = orders.organization_id 
  AND contact_email = 'isabella@modernart.com'
)
WHERE organization_id = (SELECT id FROM organizations WHERE subdomain = 'minimalart')
AND customer_email = 'collector@artgallery.com';

-- ============================================================================
-- STEP 14: Create Functions for Cart Management
-- ============================================================================

-- Function to calculate cart totals
CREATE OR REPLACE FUNCTION calculate_cart_totals(cart_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE carts 
  SET 
    total_amount = (
      SELECT COALESCE(SUM(total_price), 0)
      FROM cart_items 
      WHERE cart_id = cart_uuid
    ),
    item_count = (
      SELECT COALESCE(COUNT(*), 0)
      FROM cart_items 
      WHERE cart_id = cart_uuid
    ),
    updated_at = NOW()
  WHERE id = cart_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to convert cart to order
CREATE OR REPLACE FUNCTION convert_cart_to_order(cart_uuid UUID)
RETURNS UUID AS $$
DECLARE
  new_order_id UUID;
  cart_record RECORD;
  client_record RECORD;
BEGIN
  -- Get cart and client information
  SELECT c.*, cl.company_name, cl.contact_name, cl.contact_email
  INTO cart_record
  FROM carts c
  JOIN clients cl ON cl.id = c.client_id
  WHERE c.id = cart_uuid AND c.status = 'active';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cart not found or not active';
  END IF;
  
  -- Create new order
  INSERT INTO orders (
    organization_id,
    client_id,
    customer_name,
    customer_email,
    total_amount,
    status,
    created_by
  ) VALUES (
    cart_record.organization_id,
    cart_record.client_id,
    cart_record.company_name,
    cart_record.contact_email,
    cart_record.total_amount,
    'pending',
    cart_record.user_id
  ) RETURNING id INTO new_order_id;
  
  -- Copy cart items to order items
  INSERT INTO order_items (
    order_id,
    product_id,
    quantity,
    unit_price,
    total_price
  )
  SELECT 
    new_order_id,
    product_id,
    quantity,
    unit_price,
    total_price
  FROM cart_items
  WHERE cart_id = cart_uuid;
  
  -- Mark cart as completed
  UPDATE carts 
  SET status = 'completed', updated_at = NOW()
  WHERE id = cart_uuid;
  
  RETURN new_order_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '==========================================================';
  RAISE NOTICE 'CLIENT ENTITY MIGRATION COMPLETED SUCCESSFULLY!';
  RAISE NOTICE '==========================================================';
  RAISE NOTICE 'New features added:';
  RAISE NOTICE '- ✅ Clients table with B2B customer information';
  RAISE NOTICE '- ✅ Client contacts for multiple contacts per client';
  RAISE NOTICE '- ✅ Carts table with MedusaJS integration';
  RAISE NOTICE '- ✅ Cart items for shopping cart functionality';
  RAISE NOTICE '- ✅ Orders table updated with client references';
  RAISE NOTICE '- ✅ RLS policies for client and cart access control';
  RAISE NOTICE '- ✅ Sample client data for testing';
  RAISE NOTICE '- ✅ Cart management functions';
  RAISE NOTICE '';
  RAISE NOTICE 'New entity relationships:';
  RAISE NOTICE '- Organization → Client (one-to-many)';
  RAISE NOTICE '- Client → Order (one-to-many)';
  RAISE NOTICE '- User → Cart (one-to-many)';
  RAISE NOTICE '- Client → Cart (one-to-many)';
  RAISE NOTICE '- Cart → Cart Items (one-to-many)';
  RAISE NOTICE '';
  RAISE NOTICE 'B2B workflow:';
  RAISE NOTICE '1. User selects Client from their organization';
  RAISE NOTICE '2. User adds products to cart on behalf of Client';
  RAISE NOTICE '3. User completes checkout for Client';
  RAISE NOTICE '4. Order is created linking Organization + Client + User';
  RAISE NOTICE '==========================================================';
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- View all clients by organization
-- SELECT o.name as org_name, c.company_name, c.contact_name, c.contact_email 
-- FROM clients c 
-- JOIN organizations o ON o.id = c.organization_id 
-- ORDER BY o.name, c.company_name;

-- View client contacts
-- SELECT c.company_name, cc.name, cc.email, cc.title, cc.is_primary
-- FROM client_contacts cc
-- JOIN clients c ON c.id = cc.client_id
-- ORDER BY c.company_name, cc.name;

-- View cart summary
-- SELECT * FROM cart_summary;

-- View orders with client information
-- SELECT o.name as org_name, c.company_name, ord.customer_name, ord.total_amount, ord.status
-- FROM orders ord
-- JOIN organizations o ON o.id = ord.organization_id
-- LEFT JOIN clients c ON c.id = ord.client_id
-- ORDER BY o.name, ord.created_at DESC;