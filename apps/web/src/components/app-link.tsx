import type { ComponentProps } from "react";
import Link from "next/link";

/**
 * Use this instead of next/link. Every page here reads the database and a table holds dozens of links, so
 * Next's default prefetching ran queries for each link in view and used up the database's connection slots.
 */
export function AppLink(props: ComponentProps<typeof Link>) {
  return <Link prefetch={false} {...props} />;
}
