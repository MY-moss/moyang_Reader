const paths = {
  extensions: "M4 4h6V2a2 2 0 0 1 4 0v2h6v6h2a2 2 0 0 1 0 4h-2v6h-6v-2a2 2 0 0 0-4 0v2H4v-6h2a2 2 0 0 0 0-4H4z",
  theme:
    "M12 3a9 9 0 1 0 0 18c2 0 3-1 2-3s0-3 2-3h2c4 0 4-5 1-8a10 10 0 0 0-7-4 M8 7h.1 M5 12h.1 M9 17h.1 M14 7h.1 M18 11h.1",
  search: "m20 20-5-5 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  plus: "M12 5v14 M5 12h14",
  settings: "M4 7h16 M4 17h16 M8 4v6 M16 14v6",
  help: "M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3 M12 17v.1 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  split: "M4 4h16v16H4z M12 4v16",
  back: "m14 6-6 6 6 6",
  forward: "m10 6 6 6-6 6",
  close: "m6 6 12 12 M18 6 6 18",
  sidebar: "M4 4h16v16H4z M9 4v16",
  context: "M4 4h16v16H4z M15 4v16",
  focus: "M9 4H4v5 M15 4h5v5 M4 15v5h5 M20 15v5h-5",
  more: "M5 12h.1 M12 12h.1 M19 12h.1",
  bookmark: "M6 3h12v18l-6-4-6 4z",
  excerpt: "M5 5h5v6H5z M14 5h5v6h-5z M10 11c0 5-2 7-5 8 M19 11c0 5-2 7-5 8",
  history: "M4 5v5h5 M4 10a8 8 0 1 1 1 8 M12 8v5l3 2",
  knowledge: "M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3z M12 6v15",
  memory: "M7 4h10v17H7z M10 8h4 M10 12h4 M10 16h3 M4 7h3 M4 12h3 M4 17h3",
  skill: "m8 7-5 5 5 5 M16 7l5 5-5 5 M14 4l-4 16",
  connection: "M8 3v5 M16 3v5 M6 8h12v3a6 6 0 0 1-12 0z M12 17v4",
} as const;
export function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
