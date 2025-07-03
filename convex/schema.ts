import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  organizations: defineTable({
    name: v.string(),
    subdomain: v.string(),
    is_active: v.boolean()
  }),
  users: defineTable({
    clerk_user_id: v.string(),
    email: v.string(),
    is_active: v.boolean()
  }),
  organization_memberships: defineTable({
    organization_id: v.id('organizations'),
    user_id: v.id('users'),
    role: v.string(),
    is_active: v.boolean()
  }).index('byOrganization', ['organization_id']),
  products: defineTable({
    organization_id: v.id('organizations'),
    name: v.string(),
    description: v.optional(v.string()),
    price: v.number(),
    sku: v.optional(v.string()),
    stock_quantity: v.int64(),
    created_by: v.id('users'),
    is_active: v.boolean()
  }).index('byOrganization', ['organization_id'])
})
