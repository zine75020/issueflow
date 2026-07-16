export function ChevronIcon({
  collapsed,
  className,
}: {
  collapsed: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className={`shrink-0 transition-transform ${collapsed ? "-rotate-90" : ""} ${className ?? ""}`}
    >
      <path d="M5 7.5L10 12.5L15 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SunIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} {...props}>
      <circle cx="10" cy="10" r="3.5" />
      <path
        d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MoonIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path d="M16.5 12.3A7 7 0 018 3.5a.7.7 0 00-.9-.8A8 8 0 1017.3 13a.7.7 0 00-.8-.7z" />
    </svg>
  );
}

export function BugTypeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} {...props}>
      <rect x="6" y="7" width="8" height="8" rx="3" />
      <path
        d="M10 7V4M7 5.5L5.5 4M13 5.5L14.5 4M3 10h3M14 10h3M4 14l2-1M16 14l-2-1M4 7l2 1M16 7l-2 1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function StoryTypeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} {...props}>
      <path d="M5 3.5h10v13l-5-3-5 3v-13z" strokeLinejoin="round" />
    </svg>
  );
}

export function CloseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
    </svg>
  );
}

export function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="M10 4v12M4 10h12" strokeLinecap="round" />
    </svg>
  );
}

export function LockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} {...props}>
      <rect x="5" y="9" width="10" height="7" rx="1.5" />
      <path d="M7 9V6.5a3 3 0 016 0V9" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowUpIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="M10 15V5M5 9l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowDownIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="M10 5v10M5 11l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SparkleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path d="M10 2.5c.4 2.7 1 4.2 2 5.2s2.5 1.6 5.2 2c-2.7.4-4.2 1-5.2 2s-1.6 2.5-2 5.2c-.4-2.7-1-4.2-2-5.2s-2.5-1.6-5.2-2c2.7-.4 4.2-1 5.2-2s1.6-2.5 2-5.2z" />
      <path d="M16 2.2c.16 1 .38 1.6.75 1.97.37.37.97.6 1.97.75-1 .16-1.6.38-1.97.75-.37.37-.6.97-.75 1.97-.16-1-.38-1.6-.75-1.97-.37-.37-.97-.6-1.97-.75 1-.16 1.6-.38 1.97-.75.37-.37.6-.97.75-1.97z" />
    </svg>
  );
}

export function MenuIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" />
    </svg>
  );
}

export function SendIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="M17 3L2.5 9l6 2.5L11 17.5 17 3z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
