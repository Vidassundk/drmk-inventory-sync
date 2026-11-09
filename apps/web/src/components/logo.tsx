import { BRAND_LOGO_SVG, BRAND_NAME } from "@/lib/brand";

/**
 * The brand's logo from its brand folder, or its name as text. Parts of the drawing filled with `currentColor` follow
 * the theme; the rest keeps its own colours.
 */
export function Logo({ className = "" }: { className?: string }) {
  if (!BRAND_LOGO_SVG) {
    return (
      <span className={`inline-flex items-center text-2xl leading-none font-extrabold ${className}`}>{BRAND_NAME}</span>
    );
  }
  return (
    <span
      role="img"
      aria-label={BRAND_NAME}
      className={`inline-flex text-[#231f20] dark:text-white [&>svg]:h-full [&>svg]:w-auto ${className}`}
      dangerouslySetInnerHTML={{ __html: BRAND_LOGO_SVG }}
    />
  );
}
