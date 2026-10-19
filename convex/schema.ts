import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Explicitly shared shortlists expire and are deleted after 14 days.
export default defineSchema({
  openings: defineTable({workspace:v.string(), key:v.string(), name:v.string(), payload:v.string()}).index("by_workspace",["workspace"]).index("by_workspace_key",["workspace","key"]),
  pipeline: defineTable({opening:v.id("openings"), name:v.string(), stage:v.optional(v.union(v.literal("Applied"),v.literal("Interviewed"),v.literal("Shortlisted"),v.literal("Selected"),v.literal("Offered"))), history:v.optional(v.array(v.object({stage:v.string(),date:v.string()})))}).index("by_opening",["opening"]).index("by_opening_name",["opening","name"]),
  shares: defineTable({token:v.string(),expiresAt:v.number(),payload:v.string()}).index("by_token",["token"]),
  aiBudget: defineTable({ scope: v.string(), windowStart: v.number(), calls: v.number() }).index("by_scope", ["scope"]),
});
