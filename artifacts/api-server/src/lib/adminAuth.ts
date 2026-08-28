import { createClerkClient } from "@clerk/express";

// Keep the admin user lookup on the same Clerk instance as the request
// middleware. Preview authenticates against the development instance, while
// production authenticates against the production instance.
const clerkSecretKey = process.env.NODE_ENV === "production"
  ? process.env.CLERK_SECRET_KEY
  : process.env.CLERK_DEV_SECRET_KEY;

if (!clerkSecretKey) {
  throw new Error(
    `${process.env.NODE_ENV === "production" ? "CLERK_SECRET_KEY" : "CLERK_DEV_SECRET_KEY"} environment variable is required`,
  );
}

const adminClerkClient = createClerkClient({ secretKey: clerkSecretKey });

/**
 * Returns true if the given Clerk userId has a VERIFIED email address that
 * matches one of the entries in the ADMIN_EMAILS environment variable
 * (comma-separated, case-insensitive).
 *
 * Unverified addresses (e.g. pending additions) are intentionally excluded to
 * prevent an attacker from gaining access by adding a whitelisted address
 * before verifying ownership.
 *
 * Returns null when ADMIN_EMAILS is not configured (caller should deny access).
 */
export async function isAdminUser(userId: string): Promise<boolean | null> {
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length === 0) {
    return null; // not configured — caller should deny
  }

  const user = await adminClerkClient.users.getUser(userId);

  const verifiedEmails = user.emailAddresses
    .filter((e) => e.verification?.status === "verified")
    .map((e) => e.emailAddress.trim().toLowerCase());

  return verifiedEmails.some((email) => adminEmails.includes(email));
}
