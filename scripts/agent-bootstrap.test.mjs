import assert from "node:assert/strict";
import test from "node:test";
import { findFirstActiveTask, parseGitHubRepositoryUrl } from "./agent-bootstrap.mjs";

test("parseGitHubRepositoryUrl accepts HTTPS and SSH origins", () => {
  assert.equal(parseGitHubRepositoryUrl("https://github.com/MY-moss/moyang_Reader.git"), "MY-moss/moyang_Reader");
  assert.equal(parseGitHubRepositoryUrl("git@github.com:MY-moss/moyang_Reader.git"), "MY-moss/moyang_Reader");
  assert.equal(parseGitHubRepositoryUrl("ssh://git@github.com/MY-moss/moyang_Reader.git"), "MY-moss/moyang_Reader");
  assert.equal(parseGitHubRepositoryUrl("https://example.com/owner/repo.git"), null);
});

test("findFirstActiveTask skips DONE and stops at the first unfinished task", () => {
  const markdown = `### A01 — first\n\n**状态：DONE — PR #1**\n\n### A02 — second\n\n**状态：WAITING — PR #2**\n\n### A03 — third\n\n**状态：TODO**\n`;
  assert.deepEqual(findFirstActiveTask(markdown), {
    id: "A02",
    title: "second",
    status: "WAITING — PR #2",
  });
});

test("findFirstActiveTask returns first TODO when previous tasks are complete", () => {
  const markdown = `### A01 — done\n\n**状态：DONE — PR #1**\n\n### A02 — next\n\n**状态：TODO**\n`;
  assert.deepEqual(findFirstActiveTask(markdown), {
    id: "A02",
    title: "next",
    status: "TODO",
  });
});
