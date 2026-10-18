import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { chromeI18n } from "./helpers/chrome-i18n.mjs";

const catalog = (locale) => JSON.parse(readFileSync(`_locales/${locale}/messages.json`, "utf8"));

function loadI18n(language) {
  const context = vm.createContext({ chrome: { i18n: chromeI18n(language) } });
  vm.runInContext(readFileSync("dist/locales.js", "utf8"), context);
  vm.runInContext(readFileSync("dist/i18n.js", "utf8"), context);
  return context.LazyDiff.I18n;
}

test("English and Japanese catalogs cover the same messages and substitutions", () => {
  const english = catalog("en");
  const japanese = catalog("ja");
  assert.deepEqual(Object.keys(japanese).sort(), Object.keys(english).sort());
  for (const [key, entry] of Object.entries(english)) {
    assert.ok(entry.message.trim(), key);
    assert.ok(japanese[key].message.trim(), key);
    assert.deepEqual(japanese[key].placeholders, entry.placeholders, key);
    for (const locale of [english, japanese]) {
      const used = [...locale[key].message.matchAll(/\$([a-z_]+)\$/gi)].map((match) => match[1]);
      assert.deepEqual(used.sort(), Object.keys(entry.placeholders || {}).sort(), key);
    }
  }
});

test("browser locale variants use Japanese or fall back to English", () => {
  for (const language of ["ja", "ja-JP"]) {
    const i18n = loadI18n(language);
    assert.equal(i18n.language(), "ja");
    assert.equal(i18n.message("clear"), "クリア");
    assert.equal(i18n.message("fileCounts", [12, 24]), "12件表示・24件非表示");
    assert.equal(i18n.formatNumber(1234), "1,234");
  }
  for (const language of ["en", "en-GB", "fr-FR"]) {
    const i18n = loadI18n(language);
    assert.equal(i18n.language(), "en");
    assert.equal(i18n.message("clear"), "Clear");
    assert.equal(i18n.message("fileCounts", [12, 24]), "12 visible · 24 hidden");
  }
});

test("popup markup contains translation keys instead of hardcoded UI prose", () => {
  const html = readFileSync("popup.html", "utf8");
  assert.equal(
    html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    "lazydiff i —"
  );
  assert.doesNotMatch(html, /\s(?:title|placeholder|aria-label)="[^"]+"/);
  const english = catalog("en");
  for (const match of html.matchAll(/data-i18n(?:-[\w-]+)?="([^"]+)"/g)) {
    assert.ok(english[match[1]], `Missing message: ${match[1]}`);
  }
});

test("localizes text, accessibility labels, and placeholders from the actual popup markers", () => {
  const html = readFileSync("popup.html", "utf8");
  const nodes = [...html.matchAll(/<\w+\b([^>]*)>/g)].map((match) => {
    const attributes = Object.fromEntries(
      [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((attr) => [attr[1], attr[2]])
    );
    return {
      attributes,
      textContent: "",
      getAttribute(name) {
        return attributes[name] || null;
      },
      setAttribute(name, value) {
        attributes[name] = value;
      }
    };
  });
  const document = {
    documentElement: {},
    querySelectorAll(selector) {
      return nodes.filter((node) => node.attributes[selector.slice(1, -1)]);
    }
  };
  loadI18n("ja").localize(document);
  assert.equal(document.documentElement.lang, "ja");
  const byId = (id) => nodes.find((node) => node.attributes.id === id);
  assert.equal(byId("lazydiff-popup-clear").textContent, "クリア");
  assert.equal(byId("lazydiff-popup-info").attributes["aria-label"], "ヘルプ・設定");
  assert.equal(byId("lazydiff-popup-info").attributes.title, "ヘルプ・設定");
  assert.equal(byId("lazydiff-popup-input").attributes.placeholder, "!*.test.ts, !*.spec.ts");
  assert.equal(byId("lazydiff-help-close").textContent, "閉じる");
});

test("localized manifest preserves the product name and loads translations before UI scripts", () => {
  const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
  assert.equal(manifest.name, "lazydiff");
  assert.equal(manifest.action.default_title, "lazydiff");
  assert.equal(manifest.default_locale, "en");
  assert.equal(manifest.description, "__MSG_extensionDescription__");
  const scripts = manifest.content_scripts[0].js;
  assert.ok(scripts.indexOf("dist/locales.js") < scripts.indexOf("dist/i18n.js"));
  assert.ok(scripts.indexOf("dist/i18n.js") < scripts.indexOf("dist/content.js"));
});

test("explicit language selection overrides the browser and Auto restores it", () => {
  const i18n = loadI18n("ja-JP");
  i18n.setPreference("en");
  assert.equal(i18n.preference(), "en");
  assert.equal(i18n.message("clear"), "Clear");
  i18n.setPreference("auto");
  assert.equal(i18n.language(), "ja");
  assert.equal(i18n.message("clear"), "クリア");
  i18n.setPreference("unsupported");
  assert.equal(i18n.preference(), "auto");
  assert.equal(i18n.language(), "ja");
  const english = loadI18n("en");
  english.setPreference("ja");
  assert.equal(english.message("fileCounts", [12, 24]), "12件表示・24件非表示");
});
