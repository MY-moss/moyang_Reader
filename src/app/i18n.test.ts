import { afterEach, describe, expect, it } from "vitest";
import { getMessageKeys, loadLocale, saveLocale, translate } from "./i18n";

afterEach(() => localStorage.clear());

describe("i18n foundation", () => {
  it("defaults to Simplified Chinese and persists the selected locale", () => {
    expect(loadLocale()).toBe("zh-CN");
    saveLocale("en-US");
    expect(loadLocale()).toBe("en-US");
    expect(translate("en-US", "action.folder")).toBe("Folder");
  });

  it("keeps the Chinese catalog available as the fallback language", () => {
    expect(translate("zh-CN", "settings.backupNote")).toContain("不包含文档正文");
    expect(translate("en-US", "settings.language.zh")).toBe("简体中文");
  });

  it("keeps the zh-CN and en-US message key sets aligned", () => {
    expect(getMessageKeys("en-US")).toEqual(getMessageKeys("zh-CN"));
  });
});
