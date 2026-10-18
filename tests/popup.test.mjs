import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const settle = () => new Promise((resolve) => setImmediate(resolve));

async function loadPopup({ connected = true, saved = "!*.snap" } = {}) {
  const elements = new Map();
  for (const id of ["input", "status", "counts", "clear", "additions", "deletions", "info", "layout-warning"]
    .map((name) => `lazydiff-popup-${name}`)
    .concat(["lazydiff-help", "lazydiff-help-close"])) {
    elements.set(id, {
      value: "",
      textContent: "",
      hidden: false,
      disabled: true,
      listeners: {},
      addEventListener(event, listener) {
        this.listeners[event] = listener;
      },
      attributes: {},
      focused: false,
      open: false,
      focus() {
        this.focused = true;
      },
      setAttribute(name, value) {
        this.attributes[name] = value;
      },
      showModal() {
        this.open = true;
      },
      close() {
        this.open = false;
        this.listeners.close();
      },
      getBoundingClientRect() {
        return { left: 14, right: 326, top: 40, bottom: 320 };
      }
    });
  }
  const messages = [];
  const writes = [];
  let storageListener;
  let messageListener;
  let filterInput = saved;
  const state = () => ({
    type: "lazydiff.state",
    filterInput,
    isFilesPage: true,
    barInjected: false,
    layoutRecognized: false,
    totals: { totalFiles: 3, visibleFiles: 1, hiddenFiles: 2, visibleAdditions: 5, visibleDeletions: 2 }
  });
  const context = vm.createContext({
    document: {
      getElementById(id) {
        return elements.get(id);
      }
    },
    LazyDiff: {
      Storage: {
        FILTER_INPUT_KEY: "lazydiff.filterInput",
        async loadFilterInput() {
          return saved;
        },
        async saveFilterInput(value) {
          writes.push(value);
          filterInput = value;
          storageListener({ "lazydiff.filterInput": { newValue: value } }, "local");
        }
      }
    },
    chrome: {
      storage: {
        onChanged: {
          addListener(callback) {
            storageListener = callback;
          }
        }
      },
      runtime: {
        onMessage: {
          addListener(callback) {
            messageListener = callback;
          }
        }
      },
      tabs: {
        async query() {
          return [{ id: 42 }];
        },
        async sendMessage(id, message) {
          messages.push({ id, ...message });
          if (!connected) throw new Error("No receiving end");
          if (message.type === "lazydiff.apply") filterInput = message.filterInput;
          return state();
        }
      }
    }
  });
  vm.runInContext(readFileSync("dist/popup.js", "utf8"), context);
  await settle();
  return {
    input: elements.get("lazydiff-popup-input"),
    clear: elements.get("lazydiff-popup-clear"),
    status: elements.get("lazydiff-popup-status"),
    counts: elements.get("lazydiff-popup-counts"),
    additions: elements.get("lazydiff-popup-additions"),
    deletions: elements.get("lazydiff-popup-deletions"),
    layoutWarning: elements.get("lazydiff-popup-layout-warning"),
    info: elements.get("lazydiff-popup-info"),
    help: elements.get("lazydiff-help"),
    closeHelp: elements.get("lazydiff-help-close"),
    messages,
    writes,
    changeFromPage(value) {
      filterInput = value;
      storageListener({ "lazydiff.filterInput": { newValue: value } }, "local");
    },
    broadcast(tabId, changes) {
      messageListener({ ...state(), ...changes }, { tab: { id: tabId } });
    }
  };
}

test("popup restores the shared filter and shows counts when the injected bar is missing", async () => {
  const popup = await loadPopup();
  assert.equal(popup.input.value, "!*.snap");
  assert.equal(popup.input.disabled, false);
  assert.equal(popup.status.textContent, "1 visible · 2 hidden");
  assert.equal(popup.additions.textContent, "+5");
  assert.equal(popup.deletions.textContent, "−2");
});

test("typing rapidly applies the latest filter to the active tab and Clear removes it", async () => {
  const popup = await loadPopup();
  for (const value of ["!*.test.ts", "!*.test.ts, !*.spec.ts"]) {
    popup.input.value = value;
    popup.input.listeners.input();
  }
  await settle();
  assert.deepEqual(popup.writes, ["!*.test.ts", "!*.test.ts, !*.spec.ts"]);
  assert.deepEqual(
    popup.messages.filter((message) => message.type === "lazydiff.apply"),
    [{ id: 42, type: "lazydiff.apply", filterInput: "!*.test.ts, !*.spec.ts" }]
  );
  popup.clear.listeners.click();
  await settle();
  assert.equal(popup.writes.at(-1), "");
  assert.equal(popup.messages.at(-1).filterInput, "");
  assert.equal(popup.input.value, "");
});

test("page edits synchronize into the popup and counts from other tabs are ignored", async () => {
  const popup = await loadPopup();
  popup.changeFromPage("src, !*.test.ts");
  await settle();
  assert.equal(popup.input.value, "src, !*.test.ts");
  popup.broadcast(99, { filterInput: "wrong-tab" });
  assert.equal(popup.input.value, "src, !*.test.ts");
  popup.broadcast(42, {
    totals: { totalFiles: 4, visibleFiles: 2, hiddenFiles: 2, visibleAdditions: 8, visibleDeletions: 3 }
  });
  assert.equal(popup.additions.textContent, "+8");
  assert.equal(popup.deletions.textContent, "−3");
});

test("disconnected pages still allow saving a filter without reporting success", async () => {
  const popup = await loadPopup({ connected: false });
  popup.input.value = "!*.test.ts";
  popup.input.listeners.input();
  await settle();
  assert.equal(popup.writes.at(-1), "!*.test.ts");
  assert.match(popup.status.textContent, /Open or refresh/);
  assert.equal(popup.counts.hidden, true);
  assert.equal(popup.layoutWarning.hidden, true);
});

test("help opens as a modal and closes with Close, outside click, or native dismissal", async () => {
  const popup = await loadPopup();
  popup.info.listeners.click();
  assert.equal(popup.help.open, true);
  assert.equal(popup.info.attributes["aria-expanded"], "true");
  popup.closeHelp.listeners.click();
  assert.equal(popup.help.open, false);
  assert.equal(popup.info.attributes["aria-expanded"], "false");
  assert.equal(popup.info.focused, true);

  popup.info.listeners.click();
  popup.help.listeners.click({ target: popup.help, clientX: 100, clientY: 100 });
  assert.equal(popup.help.open, true, "Clicking dialog padding must not close it");
  popup.help.listeners.click({ target: popup.help, clientX: 5, clientY: 5 });
  assert.equal(popup.help.open, false);

  popup.info.listeners.click();
  popup.help.close();
  assert.equal(popup.info.attributes["aria-expanded"], "false");
});

test("unknown GitHub layouts show a report notice while popup filtering and counts still work", async () => {
  const popup = await loadPopup();
  assert.equal(popup.layoutWarning.hidden, false);
  assert.equal(popup.input.disabled, false);
  assert.equal(popup.counts.hidden, false);
  popup.broadcast(42, { barInjected: true, layoutRecognized: true });
  assert.equal(popup.layoutWarning.hidden, true);
  popup.broadcast(42, { barInjected: true, layoutRecognized: false });
  assert.equal(popup.layoutWarning.hidden, false, "A missing count anchor also needs a notice");
  popup.broadcast(42, { barInjected: false, layoutRecognized: false, totals: { totalFiles: 0 } });
  assert.equal(popup.layoutWarning.hidden, false);
  assert.equal(popup.status.textContent, "Files not recognized.");
  assert.equal(popup.counts.hidden, true, "Unknown file layouts must not present zero counts as valid");
  popup.broadcast(42, { barInjected: true, layoutRecognized: true, totals: { totalFiles: 0 } });
  assert.equal(popup.layoutWarning.hidden, true);
  assert.equal(popup.status.textContent, "Waiting for files…");
  popup.broadcast(42, { isFilesPage: false, layoutRecognized: false });
  assert.equal(popup.layoutWarning.hidden, true, "Other tabs must not be reported as a layout failure");
});
