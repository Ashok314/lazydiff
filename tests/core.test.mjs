import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function loadCore() {
  const context = vm.createContext({});
  vm.runInContext(readFileSync("dist/core.js", "utf8"), context);
  return context.LazyDiff.Core;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("parses exclude tokens from existing GitHub filter input syntax", () => {
  const core = loadCore();

  assert.deepEqual(plain(core.extractExcludePatterns("src !tests/** -'**/*.spec.ts' \"docs/**\"")), [
    "tests/**",
    "**/*.spec.ts"
  ]);
});

test("keeps include tokens separate from lazydiff exclude tokens", () => {
  const core = loadCore();

  assert.deepEqual(plain(core.extractIncludePatterns("src/components !tests/** -'**/*.spec.ts' \"docs pages\"")), [
    "src/components",
    "docs pages"
  ]);
  assert.equal(core.serializeIncludePatterns(["src/components", " docs pages "]), "src/components docs pages");
});

test("normalizes patterns without choosing defaults for users", () => {
  const core = loadCore();

  assert.deepEqual(plain(core.normalizePatterns(["", " tests/** ", "tests/**", "**/*.snap"])), [
    "tests/**",
    "**/*.snap"
  ]);
});

test("matches root and nested glob exclusions", () => {
  const core = loadCore();

  assert.equal(core.shouldHidePath("foo.spec.ts", ["**/*.spec.ts"]), true);
  assert.equal(core.shouldHidePath("src/foo.spec.ts", ["**/*.spec.ts"]), true);
  assert.equal(core.shouldHidePath("tests/foo.ts", ["tests/**"]), true);
  assert.equal(core.shouldHidePath("src/tests/foo.ts", ["**/tests/**"]), true);
  assert.equal(core.shouldHidePath("src/package-lock.json", ["package-lock.json"]), true);
  assert.equal(core.shouldHidePath("src/package-lock.json", ["/package-lock.json"]), false);
});

test("supports reviewer-friendly extension shorthand", () => {
  const core = loadCore();

  assert.equal(core.shouldHidePath("public/card.webp", [".webp"]), true);
  assert.equal(core.shouldHidePath("public/card.webp", ["webp"]), true);
  assert.equal(core.shouldHidePath("public/card.png", [".webp"]), false);
  assert.equal(core.shouldHidePath("src/apps/home.ts", ["apps"]), true);
  assert.equal(core.shouldHidePath("apps/home.ts", ["apps"]), true);
  assert.equal(core.shouldHidePath("apps/home.ts", ["apps/**"]), true);
  assert.equal(core.shouldHidePath("src/apps/home.ts", ["**/apps/**"]), true);
  assert.equal(core.shouldHidePath("apps/home.ts", ["/apps"]), true);
  assert.equal(core.shouldHidePath("src/apps/home.ts", ["/apps"]), false);
  assert.equal(core.shouldHidePath("src/app.spec.ts", ["*.spec.ts"]), true);
  assert.equal(
    core.shouldHidePath("src/vs/platform/agentHost/test/node/shared/editChunkExtractor.test.ts", [
      "editChunkExtractor.test.ts"
    ]),
    true
  );
  assert.equal(
    core.shouldHidePath("src/vs/platform/agentHost/test/node/shared/editChunkExtractor.test.ts", [
      "/editChunkExtractor.test.ts"
    ]),
    false
  );
});

test("filters with include patterns and excludes winning over includes", () => {
  const core = loadCore();
  const filter = core.parseFilterExpression("apps !*.spec.ts");

  assert.equal(core.shouldShowPath("apps/home.ts", filter), true);
  assert.equal(core.shouldShowPath("apps/home.spec.ts", filter), false);
  assert.equal(core.shouldShowPath("src/home.ts", filter), false);
});

test("calculates visible and hidden review size after exclusions", () => {
  const core = loadCore();
  const element = {};
  const files = [
    { element, path: "src/app.ts", additions: 15, deletions: 10, changedLines: 25 },
    { element, path: "src/app.spec.ts", additions: 70, deletions: 5, changedLines: 75 },
    { element, path: "tests/app.test.ts", additions: 60, deletions: 40, changedLines: 100 }
  ];

  assert.deepEqual(plain(core.calculateTotals(files, ["**/*.spec.ts", "tests/**"])), {
    totalFiles: 3,
    visibleFiles: 1,
    hiddenFiles: 2,
    visibleAdditions: 15,
    visibleDeletions: 10,
    visibleLines: 25,
    hiddenAdditions: 130,
    hiddenDeletions: 45,
    hiddenLines: 175
  });
});

test("calculates visible and hidden review size after include and exclude filters", () => {
  const core = loadCore();
  const element = {};
  const files = [
    { element, path: "apps/app.ts", additions: 15, deletions: 10, changedLines: 25 },
    { element, path: "apps/app.spec.ts", additions: 70, deletions: 5, changedLines: 75 },
    { element, path: "docs/readme.md", additions: 60, deletions: 40, changedLines: 100 }
  ];

  assert.deepEqual(plain(core.calculateTotalsForFilter(files, core.parseFilterExpression("apps !**/*.spec.ts"))), {
    totalFiles: 3,
    visibleFiles: 1,
    hiddenFiles: 2,
    visibleAdditions: 15,
    visibleDeletions: 10,
    visibleLines: 25,
    hiddenAdditions: 130,
    hiddenDeletions: 45,
    hiddenLines: 175
  });
});
