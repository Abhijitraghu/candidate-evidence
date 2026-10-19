import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Explicitly shared shortlists expire and are deleted after 14 days.
export default defineSchema({
  shares: defineTable({token:v.string(),expiresAt:v.number(),payload:v.string()}).index("by_token",["token"]),
  aiBudget: defineTable({ scope: v.string(), windowStart: v.number(), calls: v.number() }).index("by_scope", ["scope"]),
});
