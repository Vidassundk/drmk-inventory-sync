import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** For client components. Talks to /api/auth on whichever address the page is on. */
export const authClient = createAuthClient({ plugins: [emailOTPClient()] });
