import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { serverEnv } from "./env";

const DEFAULT_FROM = "Deremika <prisijungimas@deremika.lt>";

/**
 * Sends through Resend's API. Without RESEND_API_KEY, local runs print the email's text to the server log instead,
 * so sign-in can be tried without sending anything.
 */
export async function sendEmail({ to, subject, body }: { to: string; subject: string; body: ReactElement }) {
  const [html, text] = await Promise.all([render(body), render(body, { plainText: true })]);
  const apiKey = serverEnv("RESEND_API_KEY");

  if (!apiKey) {
    // A production build only logs when told to, for trying it locally with `wrangler dev`: codes must never reach real logs.
    if (process.env.NODE_ENV === "production" && !serverEnv("EMAIL_LOG_ONLY"))
      throw new Error("Missing RESEND_API_KEY");
    console.info(`[email] To: ${to}\nSubject: ${subject}\n\n${text}`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: serverEnv("EMAIL_FROM") ?? DEFAULT_FROM, to, subject, html, text }),
  });
  if (!response.ok) throw new Error(`Resend refused the email: ${response.status} ${await response.text()}`);
}
