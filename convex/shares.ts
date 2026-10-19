import { v, ConvexError } from 'convex/values';
import { mutation, query, internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import { shareSchema } from '../shared/share';
const lifetime = 14 * 24 * 60 * 60 * 1000;
export const create = mutation({
  args: {payload:v.string()},
  handler: async (ctx, {payload}) => {
    if (payload.length > 750000) throw new ConvexError('This shortlist is too large. Share fewer candidates.');
    const parsed = shareSchema.safeParse(JSON.parse(payload));
    if (!parsed.success || parsed.data.candidates.some(c => parsed.data.requirements.some(r => !c.result.evidence.some(e => e.requirementId === r.id)))) throw new ConvexError('The shortlist is incomplete. Assess the selected CVs again.');
    const token = crypto.randomUUID().replaceAll('-','') + crypto.randomUUID().replaceAll('-','');
    const expiresAt = Date.now() + lifetime;
    const id = await ctx.db.insert('shares',{token,expiresAt,payload:JSON.stringify(parsed.data)});
    await ctx.scheduler.runAfter(lifetime,internal.shares.remove,{id});
    return {token,expiresAt};
  },
});
export const get = query({args:{token:v.string()},handler:async(ctx,{token})=>{
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const share = await ctx.db.query('shares').withIndex('by_token',q=>q.eq('token',token)).unique();
  if (!share || share.expiresAt <= Date.now()) return null;
  return {payload:share.payload,expiresAt:share.expiresAt};
}});
export const remove = internalMutation({args:{id:v.id('shares')},handler:async(ctx,{id})=>{await ctx.db.delete(id);}});
