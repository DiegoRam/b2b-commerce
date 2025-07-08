import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { MedusaProductService } from '@/lib/medusa-client'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: productId } = await params
    const body = await request.json()
    const { name, description, price, sku, stock_quantity } = body

    // Validate required fields
    if (!name || !price) {
      return NextResponse.json({ error: 'Name and price are required' }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    
    // Get organization ID from subdomain
    const url = new URL(request.url)
    const host = request.headers.get('host') || url.host
    const subdomain = host.split('.')[0]
    
    if (subdomain === 'localhost' || subdomain === host) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 })
    }

    // Get organization by subdomain
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('subdomain', subdomain)
      .eq('is_active', true)
      .single()

    if (orgError || !organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get current user
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_user_id', userId)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify user has access to this organization (admin or manager can update products)
    const { data: membership } = await supabase
      .from('organization_memberships')
      .select('role')
      .eq('organization_id', organization.id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!membership || !['admin', 'manager'].includes(membership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Update product in MedusaJS - no organization check needed since catalog is shared
    const product = await MedusaProductService.updateProduct(productId, {
      name,
      description: description || undefined,
      price: parseFloat(price),
      sku: sku || undefined,
      stock_quantity: parseInt(stock_quantity) || 0
    })

    return NextResponse.json({ product })
  } catch (error) {
    console.error('Error in product PUT API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: productId } = await params
    const supabase = await createSupabaseServerClient()
    
    // Get organization ID from subdomain
    const url = new URL(request.url)
    const host = request.headers.get('host') || url.host
    const subdomain = host.split('.')[0]
    
    if (subdomain === 'localhost' || subdomain === host) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 })
    }

    // Get organization by subdomain
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('subdomain', subdomain)
      .eq('is_active', true)
      .single()

    if (orgError || !organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get current user
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_user_id', userId)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify user has access to this organization (admin or manager can delete products)
    const { data: membership } = await supabase
      .from('organization_memberships')
      .select('role')
      .eq('organization_id', organization.id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!membership || !['admin', 'manager'].includes(membership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Delete product in MedusaJS - no organization check needed since catalog is shared
    await MedusaProductService.deleteProduct(productId)

    return NextResponse.json({ message: 'Product deleted successfully' })
  } catch (error) {
    console.error('Error in product DELETE API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}