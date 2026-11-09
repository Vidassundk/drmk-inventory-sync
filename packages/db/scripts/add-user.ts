// Adds someone who can sign in, without sending an invite email. For the first admin, who then invites everyone else
// from the dashboard's Users page:
//
//   pnpm users:add you@example.com admin
//
// They sign in at /login with a code sent to that address.
import { createDb } from "../src/index.ts";
import { authUsers, userRole, type UserRole } from "../src/schema.ts";

const [email, roleArg = "member"] = process.argv.slice(2);
const role = userRole.enumValues.find((value) => value === roleArg);
if (!email?.includes("@") || !role) {
  console.error(`Usage: pnpm users:add <email> [${userRole.enumValues.join("|")}]`);
  process.exit(1);
}

const { db, client } = createDb();
const normalized = email.trim().toLowerCase();
const [user] = await db
  .insert(authUsers)
  .values({ id: crypto.randomUUID(), email: normalized, name: normalized.split("@")[0], role: role as UserRole })
  .onConflictDoUpdate({ target: authUsers.email, set: { role: role as UserRole } })
  .returning();
console.log(`${user.email} can now sign in, as ${user.role}.`);
await client.end();
