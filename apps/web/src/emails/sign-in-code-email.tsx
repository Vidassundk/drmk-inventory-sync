import type { I18n } from "@/lib/i18n";
import { EmailLayout, emailStyles } from "./email-layout";

/** The code to type in, and a button that opens the sign-in page with the code already filled in. */
export function SignInCodeEmail({ i18n, code, link }: { i18n: I18n; code: string; link: string }) {
  const { t, locale } = i18n;
  return (
    <EmailLayout lang={locale} preview={t("email.code.preview", { code })} footer={t("email.footer")}>
      <h1 style={emailStyles.heading}>{t("email.code.heading")}</h1>
      <p style={emailStyles.text}>{t("email.code.intro")}</p>
      <p style={emailStyles.code}>{code}</p>
      <p style={{ margin: "0 0 24px" }}>
        <a href={link} style={emailStyles.button}>
          {t("email.code.button")}
        </a>
      </p>
      <p style={emailStyles.muted}>{t("email.code.expiry")}</p>
    </EmailLayout>
  );
}
