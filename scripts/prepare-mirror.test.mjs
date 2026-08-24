import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { prepareMirror } from "./prepare-mirror.mjs";

test("prepares a versioned Cloudflare mirror and rewrites all platform URLs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-mirror-"));
  try {
    const assetDir = path.join(root, "assets");
    const outputDir = path.join(root, "mirror");
    fs.mkdirSync(assetDir);
    const assetName = "Moyang.Reader_0.5.5_x64-setup.exe";
    fs.writeFileSync(path.join(assetDir, assetName), Uint8Array.from([1, 2, 3]));
    fs.writeFileSync(path.join(assetDir, `${assetName}.sig`), "signature");
    const manifestPath = path.join(assetDir, "latest.json");
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        version: "0.5.5",
        platforms: {
          "windows-x86_64": { url: `https://github.com/example/${assetName}`, signature: "signature" },
          "windows-x86_64-nsis": { url: `https://github.com/example/${assetName}`, signature: "signature" },
        },
      }),
    );

    const result = prepareMirror({
      manifestPath,
      assetDir,
      outputDir,
      baseUrl: "https://moyang-reader-mirror.pages.dev/",
      expectedVersion: "v0.5.5",
    });

    assert.deepEqual(result, { version: "0.5.5", assets: [assetName] });
    assert.deepEqual(
      new Uint8Array(fs.readFileSync(path.join(outputDir, "v0.5.5", assetName))),
      Uint8Array.from([1, 2, 3]),
    );
    assert.equal(fs.readFileSync(path.join(outputDir, "v0.5.5", `${assetName}.sig`), "utf8"), "signature");
    const mirroredManifest = JSON.parse(fs.readFileSync(path.join(outputDir, "latest.json"), "utf8"));
    assert.equal(
      mirroredManifest.platforms["windows-x86_64"].url,
      `https://moyang-reader-mirror.pages.dev/v0.5.5/${assetName}`,
    );
    assert.equal(
      mirroredManifest.platforms["windows-x86_64-nsis"].url,
      `https://moyang-reader-mirror.pages.dev/v0.5.5/${assetName}`,
    );
    assert.equal(
      fs.readFileSync(path.join(outputDir, "v0.5.5", "latest.json"), "utf8"),
      fs.readFileSync(path.join(outputDir, "latest.json"), "utf8"),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects an insecure mirror base URL", () => {
  assert.throws(
    () =>
      prepareMirror({
        manifestPath: "missing.json",
        assetDir: "missing",
        outputDir: "missing-output",
        baseUrl: "http://example.com",
      }),
    /HTTPS/,
  );
});

test("rejects encoded path separators in release asset names", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moyang-mirror-"));
  try {
    const manifestPath = path.join(root, "latest.json");
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        version: "0.5.5",
        platforms: {
          "windows-x86_64": { url: "https://github.com/example/Moyang%2FReader.exe" },
        },
      }),
    );

    assert.throws(
      () =>
        prepareMirror({
          manifestPath,
          assetDir: root,
          outputDir: path.join(root, "mirror"),
          baseUrl: "https://moyang-reader-mirror.pages.dev",
        }),
      /缺少安装包文件名/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
