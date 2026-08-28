---
name: Referral cashback reconciliation
description: Referral rewards must remain recoverable when order completion and referral-profile creation happen in different deployments or requests.
---

Completed referred orders can be missing their referral ledger entry even when the order itself and the referrer profile exist. Referral reward creation should therefore be idempotent and reconcile missing credits without downgrading an already-approved reward.

**Why:** Referral attribution spans two accounts and may cross deployment boundaries; a one-time status transition is not enough to guarantee the reward survives retries, older builds, or ordering races.

**How to apply:** Keep the reward tied to the completed order and referrer, use the existing uniqueness guard, preserve `available` rewards, and require normal payment confirmation/approval before the credit can be spent.