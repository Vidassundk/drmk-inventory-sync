import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { cache } from "react";
import { authAccounts, authRateLimits, authSessions, authUsers, authVerifications, eq } from "@deremika/db";
import { SignInCodeEmail } from "@/emails/sign-in-code-email";
import { getDb } from "./db";
import { sendEmail } from "./email";
import { serverEnv, SITE_ORIGINS, siteOrigin } from "./env";
import { getI18n } from "./i18n-server";

const DAY = 60 * 60 * 24;
export const CODE_MINUTES = 10;

/** Sends work past the response, so a known and an unknown email take equally long to answer. */
function inBackground(promise: Promise<unknown>) {
  const { ctx } = getCloudflareContext();
  if (ctx?.waitUntil) ctx.waitUntil(promise);
}

/**
 * Better Auth for this request. Built per request because the database client is (see getDb), and so links in emails
 * use the address the person is actually on.
 *
 * Sign-in is invite-only: a user row exists from the moment someone is invited, and with `disableSignUp` a code is only
 * sent to, and only accepted for, an email that has one. Anyone else gets the same "sent" answer and no email.
 */
export const getAuth = cache(async () => {
  const secret = serverEnv("BETTER_AUTH_SECRET");
  if (!secret) throw new Error("Missing BETTER_AUTH_SECRET");
  const origin = siteOrigin(await headers());
  const i18n = await getI18n();

  return betterAuth({
    secret,
    baseURL: origin,
    trustedOrigins: SITE_ORIGINS,
    telemetry: { enabled: false },
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: { authUsers, authSessions, authAccounts, authVerifications, authRateLimits },
    }),
    user: {
      modelName: "authUsers",
      additionalFields: {
        role: { type: "string", input: false },
        locale: { type: "string", input: false },
      },
    },
    session: {
      modelName: "authSessions",
      expiresIn: 30 * DAY,
      updateAge: DAY,
      // Pages check the signed cookie instead of the database, for up to 5 minutes. Removing someone's access takes
      // effect within that time.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    account: { modelName: "authAccounts" },
    databaseHooks: {
      session: {
        create: {
          // Every new session is a sign-in. Kept on the user, because sessions go away on sign-out.
          after: async (session) => {
            await getDb().update(authUsers).set({ lastSignInAt: new Date() }).where(eq(authUsers.id, session.userId));
          },
        },
      },
    },
    verification: { modelName: "authVerifications" },
    rateLimit: {
      enabled: true,
      // Each Worker instance has its own memory, so counts live in the database.
      storage: "database",
      modelName: "authRateLimits",
    },
    advanced: {
      cookiePrefix: "deremika",
      // Set by Cloudflare itself, replacing anything the visitor sends.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      backgroundTasks: { handler: inBackground },
    },
    plugins: [
      emailOTP({
        disableSignUp: true,
        otpLength: 6,
        expiresIn: CODE_MINUTES * 60,
        allowedAttempts: 5,
        storeOTP: "hashed",
        // 3 code emails per minute per IP.
        rateLimit: { window: 60, max: 3 },
        async sendVerificationOTP({ email, otp, type }) {
          if (type !== "sign-in") return;
          // The address and code ride in the # part, which browsers never send to a server or put in logs.
          const link = `${origin}/login#${new URLSearchParams({ email, code: otp })}`;
          await sendEmail({
            to: email,
            subject: i18n.t("email.code.subject", { code: otp }),
            body: <SignInCodeEmail i18n={i18n} code={otp} link={link} />,
          });
        },
      }),
      // Lets sign-in calls from server actions set cookies. Keep it last.
      nextCookies(),
    ],
  });
});

export type Session = NonNullable<Awaited<ReturnType<Awaited<ReturnType<typeof getAuth>>["api"]["getSession"]>>>;
