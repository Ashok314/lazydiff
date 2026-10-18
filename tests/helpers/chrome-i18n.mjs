import { readFileSync } from "node:fs";

const catalog = (locale) => JSON.parse(readFileSync(`_locales/${locale}/messages.json`, "utf8"));

export function chromeI18n(language = "en") {
  const english = catalog("en");
  const messages = language.toLowerCase().startsWith("ja") ? catalog("ja") : english;
  return {
    getMessage(key, substitutions = []) {
      const entry = messages[key] || english[key];
      if (!entry) return "";
      return entry.message.replace(/\$([a-z_]+)\$/gi, (_, name) => {
        const position = Number(entry.placeholders[name.toLowerCase()].content.slice(1)) - 1;
        return substitutions[position] ?? "";
      });
    }
  };
}
