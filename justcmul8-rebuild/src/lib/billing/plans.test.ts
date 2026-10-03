// Run: node --test src/lib/billing/plans.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error -- Node runs the .ts file directly; the extension is required there.
import { creditErrorMessage, razorpayToPlan } from "./plans.ts";

const now = 1_700_000_000_000;
const future = now / 1000 + 14 * 86400;

test("Razorpay status maps to plan", () => {
  assert.deepEqual(razorpayToPlan("authenticated", future, now), { plan: "pro", status: "trialing" });
  assert.deepEqual(razorpayToPlan("authenticated", null, now), { plan: "pro", status: "active" });
  assert.deepEqual(razorpayToPlan("authenticated", now / 1000 - 60, now), { plan: "pro", status: "active" });
  assert.deepEqual(razorpayToPlan("active", null, now), { plan: "pro", status: "active" });
  assert.deepEqual(razorpayToPlan("pending", null, now), { plan: "pro", status: "past_due" });
  for (const s of ["halted", "cancelled", "completed", "expired", "paused"]) {
    assert.deepEqual(razorpayToPlan(s, future, now), { plan: "free", status: "cancelled" });
  }
});

test("only credit errors get the friendly message", () => {
  assert.match(creditErrorMessage("INSUFFICIENT_CREDITS: 40 credits needed")!, /this needs 40/);
  assert.equal(creditErrorMessage("duplicate key"), null);
  assert.equal(creditErrorMessage(undefined), null);
});
