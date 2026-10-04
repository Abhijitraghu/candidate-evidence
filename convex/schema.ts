import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Only a shared request budget is persisted in milestone 1, never JD/CV content.
export default defineSchema({
  aiBudget: defineTable({ scope: v.string(), windowStart: v.number(), calls: v.number() }).index("by_scope", ["scope"]),
});
