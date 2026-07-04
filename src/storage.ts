namespace LazyDiff.Storage {
  export const STORAGE_KEY = "lazydiff.excludePatterns";
  export const FILTER_INPUT_KEY = "lazydiff.filterInput";

  export async function loadExcludePatterns(): Promise<string[]> {
    const area = getLocalStorageArea();
    if (!area) return [];

    const result = await safeGet(area, STORAGE_KEY);
    const saved = result[STORAGE_KEY];
    return Array.isArray(saved) ? LazyDiff.Core.normalizePatterns(saved.filter(isString)) : [];
  }

  export async function saveExcludePatterns(patterns: string[]): Promise<void> {
    const area = getLocalStorageArea();
    if (!area) return;

    await safeSet(area, { [STORAGE_KEY]: LazyDiff.Core.normalizePatterns(patterns) });
  }

  export async function loadFilterInput(): Promise<string> {
    const area = getLocalStorageArea();
    if (!area) return "";

    const result = await safeGet(area, [FILTER_INPUT_KEY, STORAGE_KEY]);
    const savedFilterInput = result[FILTER_INPUT_KEY];
    if (typeof savedFilterInput === "string") return savedFilterInput;

    const savedExcludePatterns = result[STORAGE_KEY];
    return Array.isArray(savedExcludePatterns)
      ? LazyDiff.Core.serializeExcludePatterns(savedExcludePatterns.filter(isString))
      : "";
  }

  export async function saveFilterInput(value: string): Promise<void> {
    const area = getLocalStorageArea();
    if (!area) return;

    await safeSet(area, {
      [FILTER_INPUT_KEY]: value,
      [STORAGE_KEY]: LazyDiff.Core.parseFilterExpression(value).excludePatterns
    });
  }

  async function safeGet(area: ChromeStorageArea, keys: string | string[]): Promise<Record<string, unknown>> {
    try {
      return await area.get(keys);
    } catch {
      return {};
    }
  }

  async function safeSet(area: ChromeStorageArea, value: Record<string, unknown>): Promise<void> {
    try {
      await area.set(value);
    } catch {
      // Storage can reject while the extension is being reloaded. The in-page
      // filter value still applies for the current render, so fail closed.
    }
  }

  function getLocalStorageArea(): ChromeStorageArea | null {
    return typeof chrome !== "undefined" && chrome.storage?.local ? chrome.storage.local : null;
  }

  function isString(value: unknown): value is string {
    return typeof value === "string";
  }
}
