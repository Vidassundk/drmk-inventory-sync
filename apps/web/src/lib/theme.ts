export type Theme = "light" | "dark";

export const THEME_COOKIE = "theme";

/** No cookie means nothing was chosen yet, so the page follows the system setting. */
export const parseTheme = (value: string | undefined): Theme | undefined =>
  value === "light" || value === "dark" ? value : undefined;
