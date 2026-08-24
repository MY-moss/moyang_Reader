import test from "node:test";
import assert from "node:assert/strict";

import { isSemver, normalizeVersion, validateExpectedVersion, validateManifest } from "./release-check.mjs";

test("normalizes release versions and accepts semver", () => {
  assert.equal(normalizeVersion("v0.5.1"), "0.5.1");
  assert.equal(isSemver("v0.5.1"), true);
  assert.equal(isSemver("0.5"), false);
});

test("requires a release tag version to match the project version", () => {
  assert.deepEqual(validateExpectedVersion("v0.5.1", "0.5.1"), []);
  assert.equal(validateExpectedVersion("v0.5", "0.5.1").length, 1);
  assert.equal(validateExpectedVersion("v0.5.2", "0.5.1").length, 1);
});

test("accepts a complete Windows updater manifest", () => {
  const errors = validateManifest(
    {
      version: "v0.5.1",
      platforms: {
        "windows-x86_64": {
          url: "https://github.com/MY-moss/moyang_Reader/releases/download/v0.5.1/Moyang.Reader_0.5.1_x64-setup.exe",
          signature: "x".repeat(64),
        },
      },
    },
    "0.5.1",
  );

  assert.deepEqual(errors, []);
});

test("rejects incomplete or unsafe updater metadata", () => {
  const errors = validateManifest(
    {
      version: "v0.5.2",
      platforms: {
        "windows-x86_64": {
          url: "http://example.com/update.exe",
          signature: "short",
        },
      },
    },
    "0.5.1",
  );

  assert.equal(
    errors.some((error) => error.includes("version")),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes("HTTPS")),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes("signature")),
    true,
  );
});
