import { getAuth } from "@/lib/auth";

/** Better Auth's endpoints: send a code, sign in with it, read the session, sign out. */
async function handle(request: Request) {
  const auth = await getAuth();
  return auth.handler(request);
}

export { handle as GET, handle as POST };
