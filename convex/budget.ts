import { internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";

// A public demo has no accounts yet. Bound total paid calls until private accounts arrive.
export const consume = internalMutation({
  args: {}, returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const budget = await ctx.db.query("aiBudget").withIndex("by_scope", q => q.eq("scope", "milestone1")).unique();
    if (!budget) {
      await ctx.db.insert("aiBudget", { scope: "milestone1", windowStart: now, calls: 1 });
    } else if (now - budget.windowStart >= 60 * 60 * 1000) {
      await ctx.db.patch(budget._id, { windowStart: now, calls: 1 });
    } else if (budget.calls >= 30) {
      throw new ConvexError("The shared demo has reached 30 AI requests this hour. Try again when the hour resets.");
    } else {
      await ctx.db.patch(budget._id, { calls: budget.calls + 1 });
    }
    return null;
  },
});
