import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function loadGitHub() {
  const context = vm.createContext({
    window: {
      getComputedStyle(element) {
        return { visibility: element.visibility || "visible" };
      }
    }
  });
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

test("detects commit-specific and trailing-slash changed-files routes", () => {
  const github = loadGitHub();
  for (const path of ["files/abc123", "changes/abc123?diff=split", "files/", "changes/"]) {
    assert.equal(github.isPullFilesPage(`https://github.com/owner/repo/pull/7/${path}`), true);
  }
  assert.equal(github.isPullFilesPage("https://github.com/owner/repo/pull/7/files-other"), false);
});

test("skips unrecognized mounts even when generic toolbars or files exist", () => {
  const github = loadGitHub();
  const unsafeSelectors = [
    ".diffbar",
    "#files",
    "[data-testid='diff-toolbar']",
    "[data-testid='files-changed-toolbar']",
    "[class*='PullRequestDiffsList-module__diffEntry']"
  ];
  assert.equal(
    github.findLazyDiffMount({
      querySelector(selector) {
        return unsafeSelectors.includes(selector) ? {} : null;
      },
      querySelectorAll() {
        throw new Error("File parsing must not provide a mount fallback");
      }
    }),
    null
  );
});

test("reads both Unicode and ASCII minus signs in React diff counts", () => {
  const github = loadGitHub();
  for (const minus of ["−", "-"]) {
    const file = {
      querySelector() {
        return null;
      },
      querySelectorAll(selector) {
        if (selector.includes("fgColor-success")) return [{ textContent: "+1,234" }];
        if (selector.includes("fgColor-danger")) return [{ textContent: `${minus}56` }];
        return [];
      }
    };
    assert.deepEqual(plain(github.getChangedLineStats(file)), { additions: 1234, deletions: 56 });
  }
});

test("mounts before the classic diff area only inside the PR files bucket", () => {
  const github = loadGitHub();
  const files = {
    closest() {
      return null;
    }
  };
  assert.equal(
    github.findLazyDiffMount({
      querySelector(selector) {
        return selector === "#files_bucket #files" ? files : null;
      }
    }),
    files
  );
});

test("mounts before current progressive and virtualized diff lists without parsing files", () => {
  const github = loadGitHub();
  for (const testId of ["progressive-diffs-list", "virtualized-diffs-list"]) {
    const list = {
      testId,
      closest() {
        return null;
      }
    };
    assert.equal(
      github.findLazyDiffMount({
        querySelector(selector) {
          return selector.includes("[data-testid='diff-content'] ") && selector.includes(`[data-testid='${testId}']`)
            ? list
            : null;
        },
        querySelectorAll() {
          throw new Error("Mounting should use the list, not a file");
        }
      }),
      list
    );
  }
});

test("collects current React file regions after the CSS module naming change", () => {
  const github = loadGitHub();
  const regionSelector = "[role='region'][id^='diff-'][aria-labelledby]";
  const region = {
    getAttribute() {
      return null;
    },
    querySelector(selector) {
      return selector === "h3 code" ? { textContent: "src/app.test.ts" } : null;
    },
    querySelectorAll(selector) {
      if (selector.includes("fgColor-success")) return [{ textContent: "+10" }];
      if (selector.includes("fgColor-danger")) return [{ textContent: "−2" }];
      return [];
    },
    closest(selector) {
      return selector === regionSelector ? this : null;
    }
  };
  const files = github.collectFiles({
    querySelectorAll(selector) {
      return selector.includes(regionSelector) ? [region] : [];
    }
  });
  assert.equal(files.length, 1);
  assert.equal(files[0].element, region);
  assert.deepEqual(
    plain(files.map(({ path, additions, deletions, changedLines }) => ({ path, additions, deletions, changedLines }))),
    [{ path: "src/app.test.ts", additions: 10, deletions: 2, changedLines: 12 }]
  );
});

test("skips arbitrary signed counts without the GitHub count label", () => {
  const github = loadGitHub();
  assert.equal(
    github.findDiffStatMount({
      querySelector() {
        return null;
      },
      querySelectorAll(selector) {
        assert.equal(selector, "span.sr-only");
        return [];
      }
    }),
    null
  );
});

test("finds PR counts by their accessible label after GitHub moves them outside PageHeader", () => {
  const github = loadGitHub();
  const original = {
    querySelectorAll() {
      return [{ textContent: "+3" }, { textContent: "-1" }];
    },
    getClientRects() {
      return [{}];
    },
    closest() {
      return null;
    }
  };
  const label = { textContent: "Lines changed: 3 additions & 1 deletion", parentElement: original };
  const root = {
    querySelector() {
      return null;
    },
    querySelectorAll(selector) {
      assert.equal(selector, "span.sr-only");
      return [label];
    }
  };
  assert.equal(github.findDiffStatMount(root), original);
  label.textContent = "Unrelated numbers: +3 -1";
  assert.equal(github.findDiffStatMount(root), null);
});

test("reads the original diff totals when GitHub hides a zero-valued side", () => {
  const github = loadGitHub();
  for (const [additions, deletions] of [
    [3, 0],
    [0, 1],
    [1234, 56]
  ]) {
    const label = `Lines changed: ${additions.toLocaleString("en-US")} ${additions === 1 ? "addition" : "additions"} & ${deletions} ${deletions === 1 ? "deletion" : "deletions"}`;
    const original = {
      textContent: additions ? `+${additions}` : `-${deletions}`,
      querySelector() {
        return { textContent: label };
      }
    };
    assert.deepEqual(plain(github.readDiffStatCounts(original)), { additions, deletions });
  }
});

test("does not mount beside file-level counts inside the PR header", () => {
  const github = loadGitHub();
  const fileCount = {
    closest() {
      return {};
    }
  };
  assert.equal(
    github.findDiffStatMount({
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [{ textContent: "Lines changed: 3 additions & 1 deletion", parentElement: fileCount }];
      }
    }),
    null
  );
});

test("skips hidden header counts and selects a visible duplicate", () => {
  const github = loadGitHub();
  const hidden = {
    getClientRects() {
      return [];
    },
    closest() {
      return null;
    }
  };
  const visible = {
    querySelectorAll() {
      return [{ textContent: "+3" }, { textContent: "-1" }];
    },
    getClientRects() {
      return [{}];
    },
    closest() {
      return null;
    }
  };
  const root = {
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [hidden, visible].map((parentElement) => ({
        textContent: "Lines changed: 3 additions & 1 deletion",
        parentElement
      }));
    }
  };
  assert.equal(github.findDiffStatMount(root), visible);
  visible.visibility = "hidden";
  assert.equal(github.findDiffStatMount(root), null);
});

test("does not use a hidden legacy diffstat even if its counts parse", () => {
  const github = loadGitHub();
  const hidden = {
    textContent: "+3 −1",
    getClientRects() {
      return [];
    },
    closest() {
      return null;
    }
  };
  assert.equal(
    github.findDiffStatMount({
      querySelector(selector) {
        return selector === "#diffstat" ? hidden : null;
      },
      querySelectorAll() {
        return [];
      }
    }),
    null
  );
});

test("rejects a recognized list moved inside a file diff or LazyDiff's own UI", () => {
  const github = loadGitHub();
  for (const unsafeAncestor of ["[data-diff-header-wrapper]", "#lazydiff-bar"]) {
    const list = {
      closest(selector) {
        return selector.includes(unsafeAncestor) ? {} : null;
      }
    };
    assert.equal(
      github.findLazyDiffMount({
        querySelector() {
          return list;
        }
      }),
      null
    );
  }
});

test("does not guess a count mount from green signed text in a renamed header", () => {
  const github = loadGitHub();
  const misleading = {
    textContent: "+3 -1",
    closest() {
      return null;
    },
    getClientRects() {
      return [{}];
    }
  };
  const green = { ...misleading, textContent: "+3", parentElement: misleading };
  const header = {
    contains() {
      return true;
    },
    querySelectorAll() {
      return [green];
    }
  };
  assert.equal(
    github.findDiffStatMount({
      querySelector(selector) {
        return selector.includes("sticky-header-bar") ? header : null;
      },
      querySelectorAll() {
        return [];
      }
    }),
    null
  );
});

test("rejects count labels with missing or inconsistent visible values", () => {
  const github = loadGitHub();
  for (const values of [[], ["+99", "-1"], ["+3"], ["+3", "-1", "help text"]]) {
    const candidate = {
      closest() {
        return null;
      },
      getClientRects() {
        return [{}];
      },
      querySelectorAll() {
        return values.map((textContent) => ({ textContent }));
      }
    };
    assert.equal(
      github.findDiffStatMount({
        querySelector() {
          return null;
        },
        querySelectorAll() {
          return [{ textContent: "Lines changed: 3 additions & 1 deletion", parentElement: candidate }];
        }
      }),
      null
    );
  }
});

test("still recognizes GitHub's count component when a zero side is omitted", () => {
  const github = loadGitHub();
  for (const [label, values] of [
    ["Lines changed: 3 additions & 0 deletions", ["+3"]],
    ["Lines changed: 0 additions & 1 deletion", ["-1"]]
  ]) {
    const candidate = {
      closest() {
        return null;
      },
      getClientRects() {
        return [{}];
      },
      querySelectorAll() {
        return values.map((textContent) => ({ textContent }));
      }
    };
    assert.equal(
      github.findDiffStatMount({
        querySelector() {
          return null;
        },
        querySelectorAll() {
          return [{ textContent: label, parentElement: candidate }];
        }
      }),
      candidate
    );
  }
});
