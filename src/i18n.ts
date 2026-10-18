namespace LazyDiff.I18n {
  let languagePreference: LazyDiff.LanguagePreference = "auto";

  export function setPreference(value: unknown): void {
    languagePreference = value === "en" || value === "ja" ? value : "auto";
  }

  export function preference(): LazyDiff.LanguagePreference {
    return languagePreference;
  }

  export function message(key: string, substitutions: Array<string | number> = []): string {
    const entry = LAZYDIFF_LOCALES[language()][key] || LAZYDIFF_LOCALES.en[key];
    if (!entry) return "";
    return entry.message.replace(/\$([a-z_]+)\$/gi, (_match, name: string) => {
      const position = Number(entry.placeholders?.[name.toLowerCase()]?.content.slice(1)) - 1;
      return String(substitutions[position] ?? "");
    });
  }

  export function language(): LazyDiff.Language {
    if (languagePreference !== "auto") return languagePreference;
    return chrome?.i18n?.getMessage("languageCode") === "ja" ? "ja" : "en";
  }

  export function formatNumber(value: number): string {
    return value.toLocaleString(language());
  }

  export function localize(root: Document): void {
    root.documentElement.lang = language();
    for (const node of Array.from(root.querySelectorAll<HTMLElement>("[data-i18n]"))) {
      node.textContent = message(node.getAttribute("data-i18n") || "");
    }
    for (const attribute of ["aria-label", "title", "placeholder"]) {
      const marker = `data-i18n-${attribute}`;
      for (const node of Array.from(root.querySelectorAll<HTMLElement>(`[${marker}]`))) {
        node.setAttribute(attribute, message(node.getAttribute(marker) || ""));
      }
    }
  }
}
