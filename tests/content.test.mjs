import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const settle = () => new Promise((resolve) => setImmediate(resolve));

async function loadContent({ initialFilesPage = true, savedFilter = "" } = {}) {
  let onMutation;
  let onMessage;
  let onStorage;
  let mounts = 0;
  let filesPage = initialFilesPage;
  const intervals = [];
  const windowEvents = new Map();
  const observed = [];
  let recognizedMount = null;
  let diffstatMount = null;
  let allowUi = false;
  const pendingTimers = [];
  const broadcasts = [];
  const nodes = new Map();
  class Element {
    tagName = "SPAN";
    id = "";
    className = "";
    dataset = {};
    hidden = false;
    classList = { toggle() {} };
    style = { setProperty() {}, removeProperty() {} };
    children = [];
    textContent = "";
    replaceChildren(...children) {
      this.children = children;
    }
    insertAdjacentElement(_position, node) {
      nodes.set(node.id, node);
    }
    querySelector() {
      return null;
    }
    closest() {
      return null;
    }
    remove() {
      for (const [id, node] of nodes) if (node === this) nodes.delete(id);
    }
  }
  class Input extends Element {
    value = "";
  }
  const files = [
    { element: new Element(), path: "src/app.ts", additions: 5, deletions: 2, changedLines: 7 },
    { element: new Element(), path: "src/app.test.ts", additions: 10, deletions: 1, changedLines: 11 },
    { element: new Element(), path: "src/app.spec.ts", additions: 3, deletions: 1, changedLines: 4 }
  ];
  const context = vm.createContext({
    LazyDiff: {
      Storage: {
        FILTER_INPUT_KEY: "filter",
        STORAGE_KEY: "exclude",
        async loadFilterInput() {
          return savedFilter;
        }
      },
      GitHub: {
        isPullFilesPage() {
          return filesPage;
        },
        findLazyDiffMount() {
          mounts += 1;
          return recognizedMount;
        },
        findDiffStatMount() {
          return diffstatMount;
        },
        collectFiles() {
          return files;
        },
        collectFileTreeEntries() {
          return [];
        },
        getLayoutDebugSnapshot() {
          return {};
        }
      }
    },
    window: {
      addEventListener(event, callback) {
        windowEvents.set(event, callback);
      },
      location: {
        href: initialFilesPage ? "https://github.com/owner/repo/pull/7/files" : "https://github.com/owner/repo/pulls"
      },
      localStorage: {
        getItem() {
          return null;
        }
      },
      clearTimeout() {},
      setInterval(callback) {
        intervals.push(callback);
        return intervals.length;
      },
      setTimeout(callback) {
        pendingTimers.push(callback);
        return pendingTimers.length;
      }
    },
    document: {
      body: {},
      getElementById(id) {
        return nodes.get(id) || null;
      },
      querySelectorAll(selector) {
        return selector === "[data-lazydiff-hidden='true']"
          ? files.filter((file) => file.element.hidden).map((file) => file.element)
          : [];
      },
      createElement() {
        if (allowUi) return new Element();
        throw new Error("No recognized mount: do not inject UI anywhere");
      }
    },
    chrome: {
      runtime: {
        onMessage: {
          addListener(callback) {
            onMessage = callback;
          }
        },
        async sendMessage(message) {
          broadcasts.push(message);
        }
      },
      storage: {
        onChanged: {
          addListener(callback) {
            onStorage = callback;
          }
        }
      }
    },
    HTMLElement: Element,
    HTMLInputElement: Input,
    MutationObserver: class {
      constructor(callback) {
        onMutation = callback;
      }
      observe(target) {
        observed.push(target);
      }
    }
  });
  const githubStubs = { ...context.LazyDiff.GitHub };
  vm.runInContext(readFileSync("dist/github.js", "utf8"), context);
  Object.assign(context.LazyDiff.GitHub, githubStubs);
  vm.runInContext(readFileSync("dist/core.js", "utf8"), context);
  vm.runInContext(readFileSync("dist/content.js", "utf8"), context);
  await settle();
  return {
    files,
    pendingTimers,
    observed,
    document: context.document,
    resize() {
      windowEvents.get("resize")();
    },
    checkNavigation() {
      intervals[0]();
    },
    navigate(url, isFilesPage) {
      context.window.location.href = url;
      filesPage = isFilesPage;
    },
    broadcasts,
    nodes,
    Element,
    Input,
    focusInput(input) {
      context.document.activeElement = input;
    },
    enableCountUi(original = null) {
      allowUi = true;
      diffstatMount = original;
    },
    setMount(mount) {
      recognizedMount = mount;
    },
    get mounts() {
      return mounts;
    },
    mutate(mutations = [{ target: {}, addedNodes: [{}], removedNodes: [] }]) {
      onMutation(mutations);
    },
    message(message) {
      let response;
      onMessage(message, {}, (value) => {
        response = value;
      });
      return response;
    },
    storage(value) {
      onStorage({ filter: { newValue: value } }, "local");
    },
    leaveFilesPage() {
      filesPage = false;
    }
  };
}

test("retries mounting when GitHub loads the diff immediately after initial render", async () => {
  const page = await loadContent();
  assert.equal(page.mounts, 1);
  page.mutate();
  assert.equal(page.pendingTimers.length, 1);
  page.pendingTimers[0]();
  assert.equal(page.mounts, 2);
});

test("popup applies filters and receives counts without any injection mount", async () => {
  const page = await loadContent();
  const state = page.message({ type: "lazydiff.apply", filterInput: "!*.test.ts, !*.spec.ts" });
  assert.equal(state.barInjected, false);
  assert.equal(state.layoutRecognized, false);
  assert.equal(state.totals.visibleFiles, 1);
  assert.equal(state.totals.hiddenFiles, 2);
  assert.equal(state.totals.visibleAdditions, 5);
  assert.deepEqual(
    page.files.map((file) => file.element.hidden),
    [false, true, true]
  );
  const cleared = page.message({ type: "lazydiff.apply", filterInput: "" });
  assert.equal(cleared.totals.visibleFiles, 3);
  assert.deepEqual(
    page.files.map((file) => file.element.hidden),
    [false, false, false]
  );
});

test("shared storage edits update filtering and broadcast the new state", async () => {
  const page = await loadContent();
  page.storage("!*.test.ts");
  assert.equal(page.broadcasts.at(-1).filterInput, "!*.test.ts");
  assert.equal(page.broadcasts.at(-1).totals.hiddenFiles, 1);
});

test("navigation removes old injected controls and restores hidden files", async () => {
  const page = await loadContent();
  page.message({ type: "lazydiff.apply", filterInput: "!*.test.ts" });
  page.nodes.set("lazydiff-bar", new page.Element());
  page.nodes.set("lazydiff-diffstat", new page.Element());
  page.leaveFilesPage();
  const state = page.message({ type: "lazydiff.get-state" });
  assert.equal(state.isFilesPage, false);
  assert.equal(state.barInjected, false);
  assert.equal(state.totals, null);
  assert.equal(page.nodes.size, 0);
  assert.deepEqual(
    page.files.map((file) => file.element.hidden),
    [false, false, false]
  );
});

test("removes an existing bar when its recognized anchor disappears", async () => {
  const page = await loadContent();
  page.nodes.set("lazydiff-bar", new page.Element());
  const state = page.message({ type: "lazydiff.get-state" });
  assert.equal(state.barInjected, false);
  assert.equal(page.nodes.has("lazydiff-bar"), false);
});

test("popup edits synchronize into the in-page input even if it previously had focus", async () => {
  const page = await loadContent();
  const bar = new page.Element();
  const input = new page.Input();
  page.nodes.set("lazydiff-bar", bar);
  page.nodes.set("lazydiff-bar-input", input);
  page.focusInput(input);
  page.setMount({ previousElementSibling: bar });
  page.message({ type: "lazydiff.apply", filterInput: "!*.test.ts, !*.spec.ts" });
  assert.equal(input.value, "!*.test.ts, !*.spec.ts");
});

test("starts on GitHub listing pages and follows changes routes without a reload", async () => {
  const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
  assert.ok(manifest.content_scripts.some((script) => script.matches.includes("https://github.com/*")));
  const page = await loadContent({ initialFilesPage: false, savedFilter: "!*.test.ts" });
  assert.equal(page.mounts, 0);
  assert.equal(page.broadcasts.at(-1).isFilesPage, false);
  page.navigate("https://github.com/owner/repo/pull/7/changes", true);
  page.checkNavigation();
  assert.equal(page.pendingTimers.length, 1);
  page.pendingTimers.shift()();
  assert.equal(page.mounts, 1);
  assert.equal(page.files[1].element.hidden, true);
  assert.equal(page.broadcasts.at(-1).isFilesPage, true);

  page.checkNavigation();
  assert.equal(page.pendingTimers.length, 0);
  page.navigate("https://github.com/owner/repo/pull/7", false);
  page.checkNavigation();
  page.pendingTimers.shift()();
  assert.equal(page.broadcasts.at(-1).isFilesPage, false);
  assert.equal(page.files[1].element.hidden, false);
});

test("observes the document so body replacement does not disconnect page updates", async () => {
  const page = await loadContent();
  assert.equal(page.observed[0], page.document);
  page.document.body = {};
  page.mutate();
  page.pendingTimers.shift()();
  assert.equal(page.mounts, 2);
});

test("continuous page updates do not postpone rendering indefinitely", async () => {
  const page = await loadContent();
  for (let index = 0; index < 10; index += 1) page.mutate();
  assert.equal(page.pendingTimers.length, 1);
  page.pendingTimers.shift()();
  assert.equal(page.mounts, 2);
  page.mutate();
  assert.equal(page.pendingTimers.length, 1);
});

test("mixed GitHub and LazyDiff mutations still trigger a render", async () => {
  const page = await loadContent();
  const ownNode = new page.Element();
  ownNode.closest = () => ownNode;
  page.mutate([{ target: {}, addedNodes: [ownNode, {}], removedNodes: [] }]);
  assert.equal(page.pendingTimers.length, 1);
  page.pendingTimers.shift()();
  assert.equal(page.mounts, 2);
});

test("keeps filtered counts in the recognized in-page bar when the GitHub count anchor is unavailable", async () => {
  const page = await loadContent();
  const bar = new page.Element();
  const status = new page.Element();
  status.parentElement = bar;
  page.nodes.set("lazydiff-bar", bar);
  page.nodes.set("lazydiff-bar-status", status);
  page.setMount({ previousElementSibling: bar });
  page.enableCountUi();
  page.message({ type: "lazydiff.apply", filterInput: "!*.test.ts, !*.spec.ts" });
  const counts = page.nodes.get("lazydiff-diffstat");
  assert.deepEqual(
    counts.children.map((child) => child.textContent),
    ["+5", "−2", "lazydiff"]
  );
});

test("adds filtered counts beside GitHub's original counts without replacing them", async () => {
  const page = await loadContent();
  const original = new page.Element();
  original.textContent = "+18 −4";
  page.enableCountUi(original);
  page.message({ type: "lazydiff.apply", filterInput: "!*.test.ts, !*.spec.ts" });
  assert.equal(original.textContent, "+18 −4");
  assert.deepEqual(
    page.nodes.get("lazydiff-diffstat").children.map((child) => child.textContent),
    ["+5", "−2", "lazydiff"]
  );
});

test("uses accessible original totals for filtered counts when a signed zero is omitted", async () => {
  const page = await loadContent();
  const original = new page.Element();
  original.textContent = "+18";
  original.querySelector = () => ({ textContent: "Lines changed: 18 additions & 0 deletions" });
  page.enableCountUi(original);
  page.message({ type: "lazydiff.apply", filterInput: "!*.test.ts, !*.spec.ts" });
  assert.equal(original.textContent, "+18");
  assert.deepEqual(
    page.nodes.get("lazydiff-diffstat").children.map((child) => child.textContent),
    ["+5", "−0", "lazydiff"]
  );
});

test("moves filtered counts from a hidden header fallback back beside the visible original count on resize", async () => {
  const page = await loadContent();
  const bar = new page.Element();
  const status = new page.Element();
  status.parentElement = bar;
  page.nodes.set("lazydiff-bar", bar);
  page.nodes.set("lazydiff-bar-status", status);
  page.setMount({ previousElementSibling: bar });
  page.enableCountUi();
  page.message({ type: "lazydiff.apply", filterInput: "!*.test.ts, !*.spec.ts" });
  const filtered = page.nodes.get("lazydiff-diffstat");
  const original = new page.Element();
  original.textContent = "+18 −4";
  page.enableCountUi(original);
  page.resize();
  page.pendingTimers.shift()();
  assert.equal(page.nodes.get("lazydiff-diffstat"), filtered);
  assert.equal(original.textContent, "+18 −4");
  assert.deepEqual(
    filtered.children.map((child) => child.textContent),
    ["+5", "−2", "lazydiff"]
  );
});

test("keeps the injected count visible before filtering and after Clear", async () => {
  const page = await loadContent();
  const original = new page.Element();
  original.textContent = "+18 −4";
  page.enableCountUi(original);
  page.message({ type: "lazydiff.get-state" });
  const count = page.nodes.get("lazydiff-diffstat");
  assert.ok(count, "A recognized count location should show LazyDiff before entering a filter");
  assert.deepEqual(
    count.children.map((child) => child.textContent),
    ["+18", "−4", "lazydiff"]
  );
  page.message({ type: "lazydiff.apply", filterInput: "!*.test.ts, !*.spec.ts" });
  assert.deepEqual(
    count.children.map((child) => child.textContent),
    ["+5", "−2", "lazydiff"]
  );
  page.message({ type: "lazydiff.apply", filterInput: "" });
  assert.equal(page.nodes.get("lazydiff-diffstat"), count);
  assert.deepEqual(
    count.children.map((child) => child.textContent),
    ["+18", "−4", "lazydiff"]
  );
  assert.equal(original.textContent, "+18 −4");
});

test("removes both injected controls when known anchors disappear and reports the layout failure", async () => {
  const page = await loadContent();
  const bar = new page.Element();
  const status = new page.Element();
  status.parentElement = bar;
  page.nodes.set("lazydiff-bar", bar);
  page.nodes.set("lazydiff-bar-status", status);
  page.setMount({ previousElementSibling: bar });
  const original = new page.Element();
  original.textContent = "+18 −4";
  page.enableCountUi(original);
  assert.equal(page.message({ type: "lazydiff.get-state" }).layoutRecognized, true);
  page.setMount(null);
  page.enableCountUi(null);
  const state = page.message({ type: "lazydiff.get-state" });
  assert.equal(state.layoutRecognized, false);
  assert.equal(state.barInjected, false);
  assert.equal(page.nodes.has("lazydiff-diffstat"), false);
  assert.equal(original.textContent, "+18 −4");
  assert.equal(state.totals.totalFiles, 3);
  page.enableCountUi(original);
  page.nodes.set("lazydiff-bar", bar);
  page.setMount({ previousElementSibling: bar });
  assert.equal(page.message({ type: "lazydiff.get-state" }).layoutRecognized, true);
});

test("does not report a layout change when GitHub omits a zero-line diff count", async () => {
  const page = await loadContent();
  for (const file of page.files) {
    file.additions = 0;
    file.deletions = 0;
    file.changedLines = 0;
  }
  const bar = new page.Element();
  const status = new page.Element();
  status.parentElement = bar;
  page.nodes.set("lazydiff-bar", bar);
  page.nodes.set("lazydiff-bar-status", status);
  page.setMount({ previousElementSibling: bar });
  page.enableCountUi();
  const state = page.message({ type: "lazydiff.get-state" });
  assert.equal(state.layoutRecognized, true);
  assert.equal(state.totals.visibleLines, 0);
});
