import {v, ConvexError} from 'convex/values';
import {mutation,query} from './_generated/server';
const stage = v.union(v.literal('Applied'),v.literal('Interviewed'),v.literal('Shortlisted'),v.literal('Selected'),v.literal('Offered'));
const entry = v.object({name:v.string(),stage,history:v.array(v.object({stage:v.string(),date:v.string()}))});
export const list = query({args:{workspace:v.string()},returns:v.array(v.object({key:v.string(),name:v.string(),payload:v.string(),candidates:v.array(entry)})),handler:async(ctx,{workspace})=>{
 const openings=await ctx.db.query('openings').withIndex('by_workspace',q=>q.eq('workspace',workspace)).take(501);
 if(openings.length>500) throw new ConvexError('This workspace has too many openings to display.');
 return Promise.all(openings.map(async o=>({key:o.key,name:o.name,payload:o.payload,candidates:(await ctx.db.query('pipeline').withIndex('by_opening',q=>q.eq('opening',o._id)).take(101)).map(c=>({name:c.name,stage:c.stage??'Applied',history:c.history??[{stage:'Applied',date:new Date(c._creationTime).toISOString()}]}))})));
}});
export const save = mutation({args:{workspace:v.string(),key:v.string(),name:v.string(),payload:v.string(),names:v.array(v.string())},returns:v.null(),handler:async(ctx,args)=>{
 if(args.workspace.length<32 || args.payload.length>900000 || args.names.length>100) throw new ConvexError('Could not save this opening: use at most 100 candidates and a smaller batch.');
 const old=await ctx.db.query('openings').withIndex('by_workspace_key',q=>q.eq('workspace',args.workspace).eq('key',args.key)).unique();
 const opening=old?old._id:await ctx.db.insert('openings',{workspace:args.workspace,key:args.key,name:args.name,payload:args.payload});
 if(old) await ctx.db.patch(opening,{name:args.name,payload:args.payload});
 for(const name of args.names){
 const existing=await ctx.db.query('pipeline').withIndex('by_opening_name',q=>q.eq('opening',opening).eq('name',name)).unique();
 if(!existing) await ctx.db.insert('pipeline',{opening,name,stage:'Applied',history:[{stage:'Applied',date:new Date().toISOString()}]});
 }
 return null;
}});
export const changeStage = mutation({args:{workspace:v.string(),key:v.string(),name:v.string(),stage},returns:v.null(),handler:async(ctx,args)=>{
 const opening=await ctx.db.query('openings').withIndex('by_workspace_key',q=>q.eq('workspace',args.workspace).eq('key',args.key)).unique();
 if(!opening) throw new ConvexError('Opening not found. Reload and try again.');
 const candidate=await ctx.db.query('pipeline').withIndex('by_opening_name',q=>q.eq('opening',opening._id).eq('name',args.name)).unique();
 if(!candidate) throw new ConvexError('Candidate not found. Reload and try again.');
 if((candidate.stage??'Applied')!==args.stage) await ctx.db.patch(candidate._id,{stage:args.stage,history:[...(candidate.history??[{stage:'Applied',date:new Date(candidate._creationTime).toISOString()}]),{stage:args.stage,date:new Date().toISOString()}]});
 return null;
}});
