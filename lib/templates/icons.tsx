import React from "react";

const baseProps = {
  width: 14,
  height: 14,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
} as const;

export function GithubMark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      {...props}
    >
      <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94a2.91 2.91 0 0 0-.82-1.13c-.28-.15-.68-.52-.01-.53a1.6 1.6 0 0 1 1.23.82 1.62 1.62 0 0 0 2.21.62 1.6 1.6 0 0 1 .48-1.01c-1.78-.2-3.64-.89-3.64-3.95a3.1 3.1 0 0 1 .82-2.15 2.88 2.88 0 0 1 .08-2.12s.67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.43 1.05.16 1.84.08 2.04a3.09 3.09 0 0 1 .82 2.15c0 3.07-1.87 3.75-3.65 3.95a1.81 1.81 0 0 1 .52 1.41c0 1.02-.01 1.84-.01 2.09 0 .21.15.46.55.38A7.95 7.95 0 0 0 16 7.95C16 3.58 12.42 0 8 0z" />
    </svg>
  );
}

export function LinkedinMark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      {...props}
    >
      <path d="M14.82 0H1.18A1.18 1.18 0 0 0 0 1.18v13.64A1.18 1.18 0 0 0 1.18 16h13.64A1.18 1.18 0 0 0 16 14.82V1.18A1.18 1.18 0 0 0 14.82 0zM4.74 13.63H2.37V6.06h2.37zm-1.18-8.61a1.37 1.37 0 1 1 0-2.74 1.37 1.37 0 0 1 0 2.74zm10.07 8.61h-2.37V9.95c0-.88-.02-2.01-1.22-2.01-1.23 0-1.42.96-1.42 1.95v3.74H6.25V6.06h2.27v1.04h.03c.32-.6 1.09-1.22 2.24-1.22 2.4 0 2.84 1.58 2.84 3.63z" />
    </svg>
  );
}

export function MailIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="1.5" y="3" width="13" height="10" rx="1.5" />
      <path d="m2 4.5 6 4 6-4" />
    </svg>
  );
}

export function PhoneIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M3.5 1.5h2l1 3-1.5 1a10 10 0 0 0 4.5 4.5l1-1.5 3 1v2a1.5 1.5 0 0 1-1.6 1.5C8.4 13.9 2.1 7.6 2 3.1A1.5 1.5 0 0 1 3.5 1.5z" />
    </svg>
  );
}

export function GlobeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M1.5 8h13M8 1.5c2 2 2 11 0 13M8 1.5c-2 2-2 11 0 13" />
    </svg>
  );
}

export function MapPinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M8 14.5s5-4.2 5-8a5 5 0 1 0-10 0c0 3.8 5 8 5 8z" />
      <circle cx="8" cy="6.5" r="2" />
    </svg>
  );
}
