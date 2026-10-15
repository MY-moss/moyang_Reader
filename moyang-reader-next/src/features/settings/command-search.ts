type Command = { id: string; label: string; disabled?: boolean };
const aliases: Record<string, string> = {
  open: "dakaiwenjian dkwj open file",
  workspace: "tianjiawenjianjia tjwjj yueduku ydk folder workspace",
  "quick-open": "kuaisudakai ksdk quick open",
  "toggle-mode": "bianji bj yuedu yd qiehuan qh edit read",
  save: "baocun bc save",
  undo: "chexiao cx undo",
  redo: "chongzuo cz redo",
  link: "charulianjie crlj link",
  context: "shangxiawen sxw mulu ml context outline",
  focus: "zhuanzhuyuedu zzyd focus",
};
const key = "moyang-reader-recent-commands";
export function recentCommands(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string").slice(0, 10) : [];
  } catch {
    return [];
  }
}
export function rememberCommand(id: string) {
  try {
    localStorage.setItem(key, JSON.stringify([id, ...recentCommands().filter((item) => item !== id)].slice(0, 10)));
  } catch {
    /* History is optional; commands remain usable. */
  }
}
export function searchCommands<T extends Command>(commands: T[], query: string, recent: string[]): T[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return commands
    .filter((command) =>
      words.every((word) => `${command.label} ${command.id} ${aliases[command.id] ?? ""}`.toLowerCase().includes(word)),
    )
    .sort(
      (a, b) =>
        Number(Boolean(a.disabled)) - Number(Boolean(b.disabled)) ||
        (recent.includes(a.id) ? recent.indexOf(a.id) : 100) - (recent.includes(b.id) ? recent.indexOf(b.id) : 100),
    );
}
