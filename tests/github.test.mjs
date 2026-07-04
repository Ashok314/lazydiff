import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function loadGitHub() {
  const context = vm.createContext({});
  vm.runInContext(readFileSync("dist/github.js", "utf8"), context);
  return context.LazyDiff.GitHub;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("detects GitHub PR changed-files routes", () => {
  const github = loadGitHub();

  assert.equal(github.isPullFilesPage("https://github.com/owner/repo/pull/7/files"), true);
  assert.equal(github.isPullFilesPage("https://github.com/owner/repo/pull/7/files?plain=1"), true);
  assert.equal(github.isPullFilesPage("https://github.com/owner/repo/pull/7/changes?"), true);
  assert.equal(github.isPullFilesPage("https://github.com/owner/repo/pull/7"), false);
});

test("normalizes duplicated deep file tree text", () => {
  const github = loadGitHub();
  const path = "src/vs/platform/agentHost/node/shared/editChunkExtractor.ts";
  const element = {
    id: "",
    matches(selector) {
      return selector === "[data-filterable-item-text]";
    },
    getAttribute(name) {
      return name === "data-filterable-item-text" ? null : null;
    },
    closest() {
      return null;
    },
    querySelector() {
      return null;
    },
    textContent: `${path}${path}`
  };

  assert.deepEqual(
    plain(
      github
        .collectFileTreeEntries({
          querySelectorAll() {
            return [element];
          }
        })
        .map((file) => file.path)
    ),
    [path]
  );
});
