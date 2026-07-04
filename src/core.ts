namespace LazyDiff.Core {
  const EXCLUDE_PREFIXES = ["!", "-"];

  export function parseFilterInput(value: string): LazyDiff.PatternToken[] {
    return tokenize(value)
      .map((token) => token.trim())
      .filter(Boolean)
      .map((token) => {
        const prefix = EXCLUDE_PREFIXES.find((candidate) => token.startsWith(candidate));
        if (!prefix) {
          return { mode: "include" as const, pattern: unquote(token) };
        }

        return { mode: "exclude" as const, pattern: unquote(token.slice(prefix.length).trim()) };
      })
      .filter((token) => token.pattern.length > 0);
  }

  export function extractExcludePatterns(value: string): string[] {
    return parseFilterInput(value)
      .filter((token) => token.mode === "exclude")
      .map((token) => token.pattern);
  }

  export function extractIncludePatterns(value: string): string[] {
    return parseFilterInput(value)
      .filter((token) => token.mode === "include")
      .map((token) => token.pattern);
  }

  export function parseFilterExpression(value: string): LazyDiff.FilterExpression {
    return {
      includePatterns: normalizePatterns(extractIncludePatterns(value)),
      excludePatterns: normalizePatterns(extractExcludePatterns(value))
    };
  }

  export function serializeExcludePatterns(patterns: string[]): string {
    return normalizePatterns(patterns)
      .map((pattern) => `!${pattern}`)
      .join(" ");
  }

  export function serializeIncludePatterns(patterns: string[]): string {
    return normalizePatterns(patterns).join(" ");
  }

  export function normalizePatterns(patterns: string[]): string[] {
    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const pattern of patterns) {
      const trimmed = pattern.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      normalized.push(trimmed);
    }

    return normalized;
  }

  export function shouldHidePath(path: string, patterns: string[]): boolean {
    return normalizePatterns(patterns)
      .flatMap(expandPattern)
      .some((pattern) => globToRegExp(pattern).test(path));
  }

  export function shouldShowPath(path: string, filter: LazyDiff.FilterExpression): boolean {
    if (matchesAnyPattern(path, filter.excludePatterns)) return false;
    if (filter.includePatterns.length === 0) return true;
    return matchesAnyPattern(path, filter.includePatterns);
  }

  export function calculateTotals(files: LazyDiff.DiffFile[], excludePatterns: string[]): LazyDiff.ReviewTotals {
    return calculateTotalsForFilter(files, {
      includePatterns: [],
      excludePatterns
    });
  }

  export function calculateTotalsForFilter(
    files: LazyDiff.DiffFile[],
    filter: LazyDiff.FilterExpression
  ): LazyDiff.ReviewTotals {
    const totals: LazyDiff.ReviewTotals = {
      totalFiles: files.length,
      visibleFiles: 0,
      hiddenFiles: 0,
      visibleAdditions: 0,
      visibleDeletions: 0,
      visibleLines: 0,
      hiddenAdditions: 0,
      hiddenDeletions: 0,
      hiddenLines: 0
    };

    for (const file of files) {
      if (shouldShowPath(file.path, filter)) {
        totals.visibleFiles += 1;
        totals.visibleAdditions += file.additions;
        totals.visibleDeletions += file.deletions;
        totals.visibleLines += file.changedLines;
      } else {
        totals.hiddenFiles += 1;
        totals.hiddenAdditions += file.additions;
        totals.hiddenDeletions += file.deletions;
        totals.hiddenLines += file.changedLines;
      }
    }

    return totals;
  }

  export function globToRegExp(glob: string): RegExp {
    let source = "";

    for (let index = 0; index < glob.length; index += 1) {
      const char = glob[index];
      const next = glob[index + 1];
      const afterNext = glob[index + 2];

      if (char === "*" && next === "*" && afterNext === "/") {
        source += "(?:.*/)?";
        index += 2;
      } else if (char === "*" && next === "*") {
        source += ".*";
        index += 1;
      } else if (char === "*") {
        source += "[^/]*";
      } else if (char === "?") {
        source += "[^/]";
      } else {
        source += escapeRegExp(char);
      }
    }

    return new RegExp(`^${source}$`);
  }

  export function expandPattern(pattern: string): string[] {
    const normalized = pattern.trim();
    if (!normalized) return [];
    const rootAnchored = normalized.startsWith("/");
    const unanchored = rootAnchored ? normalized.replace(/^\/+/, "") : normalized;
    if (!unanchored) return [];

    if (unanchored.includes("/") || unanchored.includes("*") || unanchored.includes("?")) {
      return expandPathLikePattern(unanchored, rootAnchored);
    }

    if (unanchored.startsWith(".")) {
      return [`**/*${unanchored}`];
    }

    if (/^[a-z0-9]+$/i.test(unanchored)) {
      return rootAnchored
        ? [unanchored, `${unanchored}/**`]
        : [`**/*.${unanchored}`, unanchored, `${unanchored}/**`, `**/${unanchored}/**`];
    }

    return rootAnchored ? [unanchored] : [unanchored, `**/${unanchored}`];
  }

  function matchesAnyPattern(path: string, patterns: string[]): boolean {
    return normalizePatterns(patterns)
      .flatMap(expandPattern)
      .some((pattern) => globToRegExp(pattern).test(path));
  }

  function expandPathLikePattern(pattern: string, rootAnchored: boolean): string[] {
    if (rootAnchored) return [pattern, `${pattern}/**`];
    if (!pattern.includes("/") && (pattern.includes("*") || pattern.includes("?"))) {
      return [pattern, `**/${pattern}`];
    }
    if (pattern.endsWith("/**") || pattern.includes("*") || pattern.includes("?")) return [pattern];
    return [pattern, `${pattern}/**`];
  }

  function tokenize(value: string): string[] {
    const matches = value.match(/"[^"]+"|'[^']+'|\S+/g) || [];
    return matches.map((token) => token.trim());
  }

  function unquote(value: string): string {
    return value.replace(/^["']|["']$/g, "");
  }

  function escapeRegExp(value: string): string {
    return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
  }
}
