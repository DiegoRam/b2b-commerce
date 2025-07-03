import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

export const list = query({
  args: { organizationId: v.id('organizations') },
  handler: async (ctx, { organizationId }) => {
    return await ctx.db
      .query('products')
      .withIndex('byOrganization', q => q.eq('organization_id', organizationId))
      .collect()
  }
})

export const create = mutation({
  args: {
    organizationId: v.id('organizations'),
    name: v.string(),
    description: v.optional(v.string()),
    price: v.number(),
    sku: v.optional(v.string()),
    stockQuantity: v.int64(),
    createdBy: v.id('users')
  },
  handler: async (ctx, args) => {
    const productId = await ctx.db.insert('products', {
      organization_id: args.organizationId,
      name: args.name,
      description: args.description,
      price: args.price,
      sku: args.sku,
      stock_quantity: args.stockQuantity,
      created_by: args.createdBy,
      is_active: true
    })
    return productId
  }
})
