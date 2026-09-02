import type { SVGProps } from "react";

export type IconName =
  | "alert-triangle"
  | "book-open"
  | "chevron-down"
  | "chevron-up"
  | "close"
  | "command"
  | "copy"
  | "download"
  | "edit"
  | "folder-open"
  | "folder-plus"
  | "history"
  | "maximize"
  | "more-horizontal"
  | "panel-left"
  | "panel-right"
  | "printer"
  | "refresh-cw"
  | "save"
  | "search"
  | "settings"
  | "sun"
  | "undo"
  | "redo";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children" | "name" | "viewBox"> & {
  name: IconName;
  size?: number;
};

export function Icon({ name, size = 16, className, ...props }: IconProps) {
  return (
    <svg
      {...props}
      className={className ? `moyang-icon ${className}` : "moyang-icon"}
      data-icon={name}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      aria-hidden="true"
    >
      {renderIcon(name)}
    </svg>
  );
}

function renderIcon(name: IconName) {
  switch (name) {
    case "alert-triangle":
      return (
        <>
          <path d="m12 3 9 16H3L12 3Z" />
          <path d="M12 9v4" />
          <path d="M12 16h.01" />
        </>
      );
    case "book-open":
      return (
        <>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" />
          <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5v-16Z" />
        </>
      );
    case "chevron-down":
      return <path d="m6 9 6 6 6-6" />;
    case "chevron-up":
      return <path d="m6 15 6-6 6 6" />;
    case "close":
      return <path d="m6 6 12 12M18 6 6 18" />;
    case "command":
      return (
        <>
          <path d="M8 8v8a4 4 0 1 1-4-4h12a4 4 0 1 1-4 4V8a4 4 0 1 1 4 4H8a4 4 0 1 1 4-4V4a4 4 0 1 1 4 4H8a4 4 0 1 1 0-4h8" />
        </>
      );
    case "copy":
      return (
        <>
          <rect x="8" y="8" width="11" height="12" rx="2" />
          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2" />
        </>
      );
    case "download":
      return (
        <>
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M4 20h16" />
        </>
      );
    case "edit":
      return (
        <>
          <path d="m4 16.5-.8 3.3 3.3-.8L18.8 6.7a2.3 2.3 0 0 0-3.3-3.3L4 16.5Z" />
          <path d="m14 5 5 5" />
        </>
      );
    case "folder-open":
      return (
        <>
          <path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h4l2 2h8.5A1.5 1.5 0 0 1 21 8.5v1" />
          <path d="m3 10 1.4 8.1A2 2 0 0 0 6.4 20h11.2a2 2 0 0 0 2-1.6L21 10H3Z" />
        </>
      );
    case "folder-plus":
      return (
        <>
          <path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h4l2 2h8.5A1.5 1.5 0 0 1 21 8.5v1" />
          <path d="m3 10 1.4 8.1A2 2 0 0 0 6.4 20h11.2a2 2 0 0 0 2-1.6L21 10H3Z" />
          <path d="M12 11v5M9.5 13.5h5" />
        </>
      );
    case "history":
      return (
        <>
          <path d="M4 8V4m0 0h4M4 4a8.5 8.5 0 1 1-1.2 9.7" />
          <path d="M12 7v5l3 2" />
        </>
      );
    case "maximize":
      return (
        <>
          <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5" />
        </>
      );
    case "more-horizontal":
      return (
        <>
          <circle cx="5" cy="12" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
        </>
      );
    case "panel-left":
      return (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M8 4v16" />
        </>
      );
    case "panel-right":
      return (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M16 4v16" />
        </>
      );
    case "printer":
      return (
        <>
          <path d="M6 9V3h12v6" />
          <path d="M6 17H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
          <path d="M6 14h12v7H6z" />
          <path d="M17 12h.01" />
        </>
      );
    case "redo":
      return (
        <>
          <path d="M15 7h5l-3-3" />
          <path d="M20 7a8 8 0 1 0 0 10" />
        </>
      );
    case "refresh-cw":
      return (
        <>
          <path d="M20 11a8 8 0 0 0-14.7-4L3 10" />
          <path d="M3 5v5h5M4 13a8 8 0 0 0 14.7 4L21 14" />
          <path d="M21 19v-5h-5" />
        </>
      );
    case "save":
      return (
        <>
          <path d="M4 4h13l3 3v13H4V4Z" />
          <path d="M8 4v6h8V4M8 20v-6h8v6" />
        </>
      );
    case "search":
      return (
        <>
          <circle cx="10.8" cy="10.8" r="6.8" />
          <path d="m16 16 5 5" />
        </>
      );
    case "settings":
      return (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2.8v2.1M12 19.1v2.1M21.2 12h-2.1M4.9 12H2.8M18.5 5.5 17 7M7 17l-1.5 1.5M18.5 18.5 17 17M7 7 5.5 5.5" />
        </>
      );
    case "sun":
      return (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>
      );
    case "undo":
      return (
        <>
          <path d="M9 7H4l3-3" />
          <path d="M4 7a8 8 0 1 1 0 10" />
        </>
      );
  }
}
