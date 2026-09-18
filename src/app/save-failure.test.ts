import { describe, expect, it } from "vitest";
import { classifySaveFailure, formatSaveFailure } from "./save-failure";

describe("save failure recovery", () => {
  it.each([
    ["磁盘空间不足：原文件未被覆盖。", "disk-full"],
    ["目标文件为只读，无法写入。", "read-only"],
    ["无法写入文件：系统找不到指定的路径。", "missing"],
    ["拒绝访问目标文件。", "permission"],
  ])("classifies %s", (message, expected) => {
    expect(classifySaveFailure({ code: "FILE_WRITE_FAILED", message })).toBe(expected);
  });

  it("keeps conflict separate from filesystem failures", () => {
    expect(classifySaveFailure({ code: "FILE_CONFLICT", message: "文件已被其他程序修改" })).toBe("conflict");
  });

  it("explains the recovery path when a local draft was preserved", () => {
    expect(formatSaveFailure({ code: "FILE_WRITE_FAILED", message: "磁盘空间不足" }, true)).toContain(
      "当前内容已保留到草稿恢复中心",
    );
  });

  it("does not promise a draft when local recovery storage also failed", () => {
    expect(formatSaveFailure({ code: "FILE_WRITE_FAILED", message: "拒绝访问" }, false)).toContain(
      "请立即使用“另存为”保存副本",
    );
  });
});
