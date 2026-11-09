import type { I18n } from "@/lib/i18n";
import { EmailLayout, emailStyles } from "./email-layout";

/** Tells someone they've been given access, with a button to the sign-in page. */
export function InviteEmail({ i18n, inviter, link }: { i18n: I18n; inviter: string; link: string }) {
  const { t, locale } = i18n;
  return (
    <EmailLayout lang={locale} preview={t("email.invite.preview", { inviter })} footer={t("email.footer")}>
      <h1 style={emailStyles.heading}>{t("email.invite.heading")}</h1>
      <p style={emailStyles.text}>{t("email.invite.intro", { inviter })}</p>
      <p style={{ margin: "0 0 24px" }}>
        <a href={link} style={emailStyles.button}>
          {t("email.invite.button")}
        </a>
      </p>
      <p style={emailStyles.muted}>{t("email.invite.how")}</p>
    </EmailLayout>
  );
}
