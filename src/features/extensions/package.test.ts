import { describe, expect, it } from "vitest";
import { builtInCatalog } from "./catalog";
import { compatiblePackage, parseCatalog, readExtensionFile, validatePackage } from "./package";

describe("extension package interoperability", () => {
  it("accepts the bundled catalog and keeps future-version packages discoverable but not installable", () => {
    for (const pkg of builtInCatalog) expect(validatePackage(pkg).id).toBe(pkg.id);
    const future = { ...builtInCatalog[0], minAppVersion: "99.0.0" };
    const entries = parseCatalog({ format: "moyang-extension-catalog", packages: [future, builtInCatalog[1]] });
    expect(entries).toHaveLength(2);
    expect(compatiblePackage(entries[0])).toBe(false);
    expect(compatiblePackage(entries[1])).toBe(true);
  });
  it("rejects broken command entrypoints, duplicate IDs and themes that hide interface controls", () => {
    expect(() => validatePackage({ ...builtInCatalog.find((p) => p.kind === "reader")!, files: {} })).toThrow(
      "入口代码",
    );
    expect(() =>
      parseCatalog({ format: "moyang-extension-catalog", packages: [builtInCatalog[0], builtInCatalog[0]] }),
    ).toThrow("重复");
    expect(() =>
      validatePackage({
        ...builtInCatalog.find((p) => p.kind === "theme")!,
        theme: { light: { display: "none" }, dark: { "--ink": "#ffffff" } },
      }),
    ).toThrow("主题颜色");
  });
  it("rejects ambiguous MCP transports and keeps argument boundaries", () => {
    const pkg = builtInCatalog.find((p) => p.kind === "mcp")!;
    expect(() => validatePackage({ ...pkg, mcp: { command: "uvx", url: "https://example.org/mcp" } })).toThrow("一种");
    expect(validatePackage({ ...pkg, mcp: { command: "server.exe", args: ["C:\\My Notes\\书房"] } }).mcp).toEqual({
      command: "server.exe",
      args: ["C:\\My Notes\\书房"],
      env: {},
    });
  });
  it("imports a standard SKILL.md without requiring Moyang metadata", async () => {
    const text = "---\nname: local-reading\ndescription: 阅读资料并保留证据。\n---\n\n## 方法\n整理来源。";
    const pkg = await readExtensionFile({ name: "SKILL.md", size: text.length, text: async () => text } as File);
    expect(pkg.id).toBe("skill.local-reading");
    expect(pkg.skill?.body).toContain("整理来源");
  });
});
