declare namespace LazyDiff {
  type PatternMode = "include" | "exclude";

  interface PatternToken {
    mode: PatternMode;
    pattern: string;
  }

  interface FilterExpression {
    includePatterns: string[];
    excludePatterns: string[];
  }

  interface DiffFile {
    element: HTMLElement;
    path: string;
    additions: number;
    deletions: number;
    changedLines: number;
  }

  interface ReviewTotals {
    totalFiles: number;
    visibleFiles: number;
    hiddenFiles: number;
    visibleAdditions: number;
    visibleDeletions: number;
    visibleLines: number;
    hiddenAdditions: number;
    hiddenDeletions: number;
    hiddenLines: number;
  }

  interface RuntimeState {
    savedExcludePatterns: string[];
    filterInputValue: string;
  }
}

interface ChromeStorageArea {
  get(keys: string | string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

interface ChromeStorageChange {
  newValue?: unknown;
  oldValue?: unknown;
}

interface ChromeExtensionApi {
  storage?: {
    local?: ChromeStorageArea;
    onChanged?: {
      addListener(callback: (changes: Record<string, ChromeStorageChange>, areaName: string) => void): void;
    };
  };
  runtime?: {
    onMessage?: {
      addListener(callback: (message: unknown) => void): void;
    };
  };
  tabs?: {
    query(queryInfo: { active: boolean; currentWindow: boolean }): Promise<Array<{ id?: number; url?: string }>>;
    sendMessage(tabId: number, message: unknown): Promise<unknown>;
  };
}

declare const chrome: ChromeExtensionApi | undefined;
