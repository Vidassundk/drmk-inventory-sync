const ICON = "shrink-0 fill-none stroke-current stroke-[1.5]";

// A gear for parts.
export function PartsIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={`${ICON} ${className}`}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8" r="2.25" />
      <path d="M8 1.5v1.75M8 12.75v1.75M1.5 8h1.75M12.75 8h1.75M3.4 3.4l1.25 1.25M11.35 11.35l1.25 1.25M3.4 12.6l1.25-1.25M11.35 4.65l1.25-1.25" />
      <circle cx="8" cy="8" r="4.75" />
    </svg>
  );
}

// A car seen from the side.
export function CarsIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={`${ICON} ${className}`}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1.75 10.5V8.25L3.5 5h7.25l2.5 3.25h.5c.55 0 1 .45 1 1v1.25h-1.25" />
      <path d="M5.5 10.5h4.5M1.75 10.5h1" />
      <circle cx="4.25" cy="10.75" r="1.5" />
      <circle cx="11.75" cy="10.75" r="1.5" />
      <path d="M6.75 5v3.25H2.25M6.75 8.25h6.25" />
    </svg>
  );
}

// A framed picture, shown where a photo is missing or hasn't loaded.
export function PhotoIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={`${ICON} ${className}`}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1.5" />
      <circle cx="5.5" cy="6.25" r="1.25" />
      <path d="m1.75 11.5 3.5-3.5 3 3 2-2 4 4" />
    </svg>
  );
}

// A person, for the account menu.
export function UserIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={`${ICON} ${className}`}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="5.5" r="2.75" />
      <path d="M2.75 14c.6-2.6 2.7-4.25 5.25-4.25S12.65 11.4 13.25 14" />
    </svg>
  );
}

// Two people, for managing who has access.
export function UsersIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={`${ICON} ${className}`}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="6" cy="5.75" r="2.25" />
      <path d="M1.75 13.5c.45-2.15 2.1-3.5 4.25-3.5s3.8 1.35 4.25 3.5" />
      <path d="M10.5 3.75a2.25 2.25 0 0 1 0 4M12.25 10.4c1 .55 1.75 1.6 2 3.1" />
    </svg>
  );
}
