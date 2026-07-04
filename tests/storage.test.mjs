import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function loadStorage(initialStore = {}) {
  const writes = [];
  const store = { ...initialStore };
  const context = vm.createContext({
    chrome: {
      storage: {
        local: {
          async get(keys) {
            if (Array.isArray(keys)) {
              return Object.fromEntries(keys.map((key) => [key, store[key]]));
            }

            return { [keys]: store[keys] };
          },
          async set(items) {
            writes.push(items);
            Object.assign(store, items);
          }
        }
      }
    }
  });

  vm.runInContext(readFileSync("dist/core.js", "utf8"), context);
  vm.runInContext(readFileSync("dist/storage.js", "utf8"), context);

  return { storage: context.LazyDiff.Storage, writes };
}

function loadBrokenStorage() {
  const context = vm.createContext({
    chrome: {
      storage: {
        local: {
          async get() {
            throw new Error("extension context invalidated");
          },
          async set() {
            throw new Error("extension context invalidated");
          }
        }
      }
    }
  });

  vm.runInContext(readFileSync("dist/core.js", "utf8"), context);
  vm.runInContext(readFileSync("dist/storage.js", "utf8"), context);

  return context.LazyDiff.Storage;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("loads no patterns when the user has not saved any", async () => {
  const { storage } = loadStorage();

  assert.deepEqual(plain(await storage.loadExcludePatterns()), []);
});

test("uses chrome.storage.local only and normalizes saved patterns", async () => {
  const { storage, writes } = loadStorage();

  await storage.saveExcludePatterns([" tests/** ", "tests/**", "**/*.spec.ts"]);

  assert.deepEqual(plain(writes), [
    {
      "lazydiff.excludePatterns": ["tests/**", "**/*.spec.ts"]
    }
  ]);
});

test("loads filter input and migrates old exclude patterns", async () => {
  const { storage: migrated } = loadStorage({
    "lazydiff.excludePatterns": ["tests/**", "**/*.spec.ts"]
  });
  const { storage: current } = loadStorage({
    "lazydiff.filterInput": "apps !tests/**"
  });

  assert.equal(await migrated.loadFilterInput(), "!tests/** !**/*.spec.ts");
  assert.equal(await current.loadFilterInput(), "apps !tests/**");
});

test("saves full filter input and derived exclude patterns", async () => {
  const { storage, writes } = loadStorage();

  await storage.saveFilterInput("apps !tests/** !**/*.spec.ts");

  assert.deepEqual(plain(writes), [
    {
      "lazydiff.filterInput": "apps !tests/** !**/*.spec.ts",
      "lazydiff.excludePatterns": ["tests/**", "**/*.spec.ts"]
    }
  ]);
});

test("ignores storage failures while the extension context reloads", async () => {
  const storage = loadBrokenStorage();

  assert.deepEqual(plain(await storage.loadExcludePatterns()), []);
  assert.equal(await storage.loadFilterInput(), "");
  await assert.doesNotReject(() => storage.saveExcludePatterns(["tests/**"]));
  await assert.doesNotReject(() => storage.saveFilterInput("apps !tests/**"));
});
