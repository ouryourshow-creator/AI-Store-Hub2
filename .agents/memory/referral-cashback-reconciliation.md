---
name: Referral cashback reconciliation
description: Referral rewards must remain recoverable when order completion and referral-profile creation happen in different deployments or requests.
---

Completed referred orders can be missing their referral ledger entry even when the order itself and the referrer profile exist. Referral reward creation should therefore be idempotent and reconcile missing credits without downgrading an already-approved reward. A referred customer can create only one referral reward: 50 EGP for their first successful/completed purchase; later purchases remain ineligible, even if the first reward is later voided.

**Why:** Referral attribution spans two accounts and may cross deployment boundaries; a one-time status transition is not enough to guarantee the reward survives retries, older builds, or ordering races. A strict first-purchase rule also prevents duplicate bonuses through later orders or alternate referral links.

**How to apply:** Keep the reward tied to the completed order and referrer, use the existing uniqueness guard plus a referred-customer history check, preserve `available` rewards, and require normal payment confirmation/approval before the credit can be spent.