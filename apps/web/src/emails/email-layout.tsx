import type { ReactNode } from "react";

// Email clients ignore stylesheets and most modern CSS, so everything here is inline styles and tables.
const ACCENT = "#ae1f27";
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const emailStyles = {
  heading: { margin: "0 0 12px", fontSize: "20px", lineHeight: "28px", fontWeight: 600, color: "#171717" },
  text: { margin: "0 0 16px", fontSize: "15px", lineHeight: "24px", color: "#171717" },
  muted: { margin: "0", fontSize: "13px", lineHeight: "20px", color: "#52525b" },
  code: {
    margin: "8px 0 24px",
    fontSize: "32px",
    lineHeight: "40px",
    fontWeight: 700,
    letterSpacing: "8px",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    color: "#171717",
  },
  button: {
    display: "inline-block",
    padding: "12px 24px",
    borderRadius: "6px",
    backgroundColor: ACCENT,
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 600,
    textDecoration: "none",
  },
} as const;

/** The frame every email shares: the wordmark, a white card and a footer line. */
export function EmailLayout({
  lang,
  preview,
  footer,
  children,
}: {
  lang: string;
  preview: string;
  footer: string;
  children: ReactNode;
}) {
  return (
    <html lang={lang}>
      {/* eslint-disable-next-line @next/next/no-head-element -- an email, not a Next page */}
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light" />
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: "#f4f4f5", fontFamily: FONT }}>
        {/* The inbox preview line, hidden in the email itself. */}
        <div style={{ display: "none", overflow: "hidden", maxHeight: 0, opacity: 0 }}>{preview}</div>
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: "#f4f4f5" }}>
          <tbody>
            <tr>
              <td align="center" style={{ padding: "32px 16px" }}>
                <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ maxWidth: "480px" }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: "0 4px 16px" }}>
                        <span style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "1px", color: "#171717" }}>
                          DEREMIKA
                        </span>
                        <div style={{ width: "112px", height: "3px", marginTop: "2px", backgroundColor: ACCENT }} />
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: "32px", borderRadius: "8px", backgroundColor: "#ffffff" }}>{children}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "16px 4px 0" }}>
                        <p style={emailStyles.muted}>{footer}</p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}
