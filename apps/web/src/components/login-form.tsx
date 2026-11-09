"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Spinner } from "@/components/spinner";
import { authClient } from "@/lib/auth-client";
import type { MessageKey } from "@/lib/i18n";

const INPUT =
  "w-full rounded-md border border-zinc-300 bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent dark:border-zinc-700";
const BUTTON =
  "flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60";
const LINK = "text-sm text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-60";

type Failure = { status?: number; code?: string } | null | undefined;

/** Turns Better Auth's answer into something to tell the person. */
function failureMessage(error: Failure): MessageKey {
  if (error?.status === 429) return "login.rateLimited";
  if (error?.code === "TOO_MANY_ATTEMPTS") return "login.tooManyAttempts";
  if (error?.code === "INVALID_OTP" || error?.code === "OTP_EXPIRED") return "login.invalidCode";
  return "login.error";
}

/**
 * Email first, then the code. The email's button opens this page as /login#email=…&code=…, which fills both in. It
 * still waits for a click: some mail filters open links and run their scripts, and would use the code up otherwise.
 */
export function LoginForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [notice, setNotice] = useState<MessageKey | null>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  // The # part only exists in the browser, so it's read after the first render; reading it earlier would make the
  // server's and the browser's first render differ. It's read again if the email's button is clicked while this page
  // is already open, which changes only the # part.
  useEffect(() => {
    function readLink() {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const linkedEmail = params.get("email");
      if (!linkedEmail) return;
      // Out of the address bar and history: the code shouldn't linger there.
      window.history.replaceState(null, "", window.location.pathname);
      setEmail(linkedEmail);
      setError(null);
      setNotice(null);
      const linkedCode = params.get("code");
      setCode(linkedCode ?? "");
      setStep(linkedCode ? "code" : "email");
    }
    readLink();
    window.addEventListener("hashchange", readLink);
    return () => window.removeEventListener("hashchange", readLink);
  }, []);

  useEffect(() => {
    if (step === "code") codeInput.current?.focus();
  }, [step]);

  async function sendCode() {
    setBusy(true);
    setError(null);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type: "sign-in" });
    setBusy(false);
    if (error) {
      setError(failureMessage(error));
      return false;
    }
    return true;
  }

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    if (await sendCode()) {
      setCode("");
      setStep("code");
    }
  }

  async function resend() {
    setNotice(null);
    if (await sendCode()) {
      setCode("");
      setNotice("login.resent");
      codeInput.current?.focus();
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error } = await authClient.signIn.emailOtp({ email: email.trim(), otp: code.trim() });
    if (error) {
      setBusy(false);
      setError(failureMessage(error));
      return;
    }
    router.replace("/parts");
    router.refresh();
  }

  if (step === "email") {
    return (
      <form onSubmit={submitEmail} className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t("login.emailIntro")}</p>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("login.email")}
          <input
            type="email"
            name="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={`${INPUT} font-normal`}
          />
        </label>
        {error && <Message tone="error">{t(error)}</Message>}
        <button type="submit" disabled={busy} className={BUTTON}>
          {t("login.sendCode")}
          {busy && (
            <Spinner className="size-3.5 border-white/40 border-t-white dark:border-white/40 dark:border-t-white" />
          )}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submitCode} className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t("login.codeIntro", { email })}</p>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t("login.code")}
        <input
          ref={codeInput}
          name="code"
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          className={`${INPUT} font-mono text-lg tracking-[0.5em]`}
        />
      </label>
      {error && <Message tone="error">{t(error)}</Message>}
      {notice && <Message tone="info">{t(notice)}</Message>}
      <button type="submit" disabled={busy || code.length !== 6} className={BUTTON}>
        {t("login.signIn")}
        {busy && (
          <Spinner className="size-3.5 border-white/40 border-t-white dark:border-white/40 dark:border-t-white" />
        )}
      </button>
      <div className="flex flex-wrap justify-between gap-2">
        <button type="button" onClick={resend} disabled={busy} className={LINK}>
          {t("login.resend")}
        </button>
        <button
          type="button"
          onClick={() => {
            setStep("email");
            setError(null);
            setNotice(null);
          }}
          className={LINK}
        >
          {t("login.changeEmail")}
        </button>
      </div>
    </form>
  );
}

function Message({ tone, children }: { tone: "error" | "info"; children: string }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
          : "rounded-md bg-zinc-100 px-3 py-2 text-sm dark:bg-zinc-900"
      }
    >
      {children}
    </p>
  );
}
