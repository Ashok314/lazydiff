namespace LazyDiff.GitHub {
  export function isPullFilesPage(url: string = window.location.href): boolean {
    return /\/pull\/\d+\/(?:files|changes)(?:$|[?#])/.test(url);
  }

  export function collectFiles(root: ParentNode = document): LazyDiff.DiffFile[] {
    const containers = uniqueElements(
      Array.from(
        root.querySelectorAll<HTMLElement>(
          [
            "[class*='PullRequestDiffsList-module__diffEntry']",
            "copilot-diff-entry[data-file-path]",
            "[data-targets*='diff-file-filter.diffEntries']",
            ".file.js-file",
            ".js-file[data-path]",
            ".js-file[id^='diff-']",
            "[data-file-path]",
            "[data-tagsearch-path]",
            "[data-details-container-group='file']"
          ].join(",")
        )
      )
    );
    const filesByPath = new Map<string, LazyDiff.DiffFile>();

    for (const element of containers) {
      const path = getFilePath(element);
      if (!path) continue;

      const fileElement = findFileContainer(element);
      if (!fileElement) continue;

      const lineStats = getChangedLineStats(fileElement);
      const file = {
        element: fileElement,
        path,
        additions: lineStats.additions,
        deletions: lineStats.deletions,
        changedLines: lineStats.additions + lineStats.deletions
      };
      const existing = filesByPath.get(path);

      if (!existing || isBetterFileCandidate(file, existing)) {
        filesByPath.set(path, file);
      }
    }

    return Array.from(filesByPath.values());
  }

  export function collectFileTreeEntries(root: ParentNode = document): LazyDiff.DiffFile[] {
    const entries = uniqueElements(
      Array.from(
        root.querySelectorAll<HTMLElement>(
          "[role='treeitem'][id], [data-tree-entry-type='file'], [data-targets*='file-tree.fileTreeNodes'], [data-target*='fileTreeNode'], [data-filterable-item-text]"
        )
      )
    );

    const filesByPath = new Map<string, LazyDiff.DiffFile>();

    for (const element of entries) {
      if (isFileTreeFolder(element)) continue;

      const path = getFileTreePath(element);
      if (!path || filesByPath.has(path)) continue;

      filesByPath.set(path, {
        element,
        path,
        additions: 0,
        deletions: 0,
        changedLines: 0
      });
    }

    return Array.from(filesByPath.values());
  }

  export function getLayoutDebugSnapshot(root: ParentNode = document): Record<string, number> {
    return {
      reactDiffEntries: root.querySelectorAll("[class*='PullRequestDiffsList-module__diffEntry']").length,
      copilotDiffEntries: root.querySelectorAll("copilot-diff-entry[data-file-path]").length,
      legacyFiles: root.querySelectorAll(".file.js-file, .js-file[id^='diff-']").length,
      dataFilePaths: root.querySelectorAll("[data-file-path]").length,
      dataTagSearchPaths: root.querySelectorAll("[data-tagsearch-path]").length,
      legacyFileHeaders: root.querySelectorAll(".js-file-header[data-path]").length,
      progressiveLoaders: root.querySelectorAll(".js-diff-progressive-loader, include-fragment.diff-progressive-loader")
        .length,
      treeItems: root.querySelectorAll("[role='treeitem']").length,
      filterableText: root.querySelectorAll("[data-filterable-item-text]").length
    };
  }

  export function getFilePath(element: HTMLElement): string | null {
    const candidates = [
      element.getAttribute("data-file-path"),
      element.getAttribute("data-tagsearch-path"),
      element.getAttribute("data-path"),
      getPathFromReactDiffHeader(element),
      getPathFromAriaLabel(element),
      getPathFromDiffTable(element),
      element.querySelector(".js-file-header")?.getAttribute("data-path"),
      element.querySelector("[data-path]")?.getAttribute("data-path"),
      element.querySelector(".file-info a[title]")?.getAttribute("title"),
      element.querySelector(".file-header a[title]")?.getAttribute("title"),
      element.querySelector(".Link--primary[title]")?.getAttribute("title"),
      element.querySelector(".Truncate-text")?.textContent
    ];

    return (
      candidates.map((value) => (value || "").trim()).find((value) => value.length > 0 && !value.includes("\n")) || null
    );
  }

  export function getChangedLineCount(element: HTMLElement): number {
    const lineStats = getChangedLineStats(element);
    return lineStats.additions + lineStats.deletions;
  }

  export function getChangedLineStats(element: HTMLElement): { additions: number; deletions: number } {
    const additions = parseCount(element, ".diffstat .color-fg-success, .diffstat .text-green");
    const deletions = parseCount(element, ".diffstat .color-fg-danger, .diffstat .text-red");

    if (additions !== null || deletions !== null) {
      return {
        additions: additions || 0,
        deletions: deletions || 0
      };
    }

    const reactHeaderStats = getReactHeaderChangedLineStats(element);
    if (reactHeaderStats !== null) {
      return reactHeaderStats;
    }

    const rows = Array.from(element.querySelectorAll("tr"));
    return {
      additions: rows.filter(
        (row) =>
          row.classList.contains("blob-code-addition") ||
          Boolean(row.querySelector(".diff-text.syntax-highlighted-line.addition"))
      ).length,
      deletions: rows.filter(
        (row) =>
          row.classList.contains("blob-code-deletion") ||
          Boolean(row.querySelector(".diff-text.syntax-highlighted-line.deletion"))
      ).length
    };
  }

  export function findLazyDiffMount(root: ParentNode = document): HTMLElement {
    return (
      root.querySelector<HTMLElement>("[class*='PullRequestDiffsList-module__diffEntry']") ||
      root.querySelector<HTMLElement>("#files") ||
      root.querySelector<HTMLElement>("#files_bucket") ||
      root.querySelector<HTMLElement>("[data-testid='files-changed-toolbar']") ||
      root.querySelector<HTMLElement>("[data-testid='diff-toolbar']") ||
      root.querySelector<HTMLElement>("#files_bucket .diffbar") ||
      root.querySelector<HTMLElement>(".diffbar") ||
      root.querySelector<HTMLElement>("[data-pjax-container]") ||
      document.body
    );
  }

  export function findDiffStatMount(root: ParentNode = document): HTMLElement | null {
    const stableMount = root.querySelector<HTMLElement>("#diffstat, .diffstat");
    if (stableMount && hasSignedDiffCounts(stableMount) && !isIgnoredDiffStatCandidate(stableMount)) {
      return stableMount;
    }

    const successNodes = Array.from(
      root.querySelectorAll<HTMLElement>(".color-fg-success, .text-green, [class*='fgColor-success']")
    );
    const candidates: HTMLElement[] = [];

    for (const node of successNodes) {
      if (isIgnoredDiffStatCandidate(node) || !hasAdditionCount(node)) continue;

      let current: HTMLElement | null = node;
      for (let depth = 0; current && depth < 6; depth += 1) {
        if (
          !isIgnoredDiffStatCandidate(current) &&
          hasSignedDiffCounts(current) &&
          current.textContent &&
          current.textContent.trim().length <= 140
        ) {
          candidates.push(current);
          break;
        }

        current = current.parentElement;
      }
    }

    return candidates.sort((left, right) => textLength(left) - textLength(right))[0] || null;
  }

  function parseCount(element: HTMLElement, selector: string): number | null {
    const text = element.querySelector(selector)?.textContent || "";
    const match = text.match(/\d[\d,]*/);
    return match ? Number(match[0].replace(/,/g, "")) : null;
  }

  function hasSignedDiffCounts(element: HTMLElement): boolean {
    const text = element.textContent || "";
    return /\+\s*\d[\d,]*/.test(text) && /[−-]\s*\d[\d,]*/.test(text);
  }

  function hasAdditionCount(element: HTMLElement): boolean {
    return /\+\s*\d[\d,]*/.test(element.textContent || "");
  }

  function isInsideFileDiff(element: HTMLElement): boolean {
    return Boolean(
      element.closest(
        "[class*='PullRequestDiffsList-module__diffEntry'], copilot-diff-entry[data-file-path], [data-targets*='diff-file-filter.diffEntries'], .file.js-file, .js-file[data-path], [data-file-path]"
      )
    );
  }

  function isInsideLazyDiff(element: HTMLElement): boolean {
    return Boolean(element.closest("#lazydiff-bar, #lazydiff-diffstat, [class*='lazydiff-']"));
  }

  function isIgnoredDiffStatCandidate(element: HTMLElement): boolean {
    return isInsideFileDiff(element) || isInsideLazyDiff(element);
  }

  function textLength(element: HTMLElement): number {
    return element.textContent?.trim().length || Number.MAX_SAFE_INTEGER;
  }

  function getReactHeaderChangedLineStats(element: HTMLElement): { additions: number; deletions: number } | null {
    const additions = parseSignedCount(element, "[class*='fgColor-success'], .fgColor-success", "+");
    const deletions = parseSignedCount(element, "[class*='fgColor-danger'], .fgColor-danger", "-");

    if (additions === null && deletions === null) return null;
    return {
      additions: additions || 0,
      deletions: deletions || 0
    };
  }

  function parseSignedCount(element: HTMLElement, selector: string, sign: "+" | "-"): number | null {
    for (const node of Array.from(element.querySelectorAll(selector))) {
      const text = node.textContent?.trim() || "";
      const match = text.match(new RegExp(`\\${sign}\\s*(\\d[\\d,]*)`));
      if (match) return Number(match[1].replace(/,/g, ""));
    }

    return null;
  }

  function uniqueElements(elements: HTMLElement[]): HTMLElement[] {
    return elements.filter((element, index) => elements.indexOf(element) === index);
  }

  function isBetterFileCandidate(candidate: LazyDiff.DiffFile, current: LazyDiff.DiffFile): boolean {
    const candidateScore = fileCandidateScore(candidate.element);
    const currentScore = fileCandidateScore(current.element);
    if (candidateScore !== currentScore) return candidateScore > currentScore;

    return candidate.changedLines > current.changedLines;
  }

  function fileCandidateScore(element: HTMLElement): number {
    if (element.matches("[class*='PullRequestDiffsList-module__diffEntry']")) return 5;
    if (element.matches("copilot-diff-entry[data-file-path]")) return 4;
    if (element.matches("[data-targets*='diff-file-filter.diffEntries']")) return 3;
    if (element.matches(".file.js-file, .file, .js-file, [data-details-container-group='file']")) return 2;
    if (element.matches("[data-file-path]")) return 1;
    return 0;
  }

  function findFileContainer(element: HTMLElement): HTMLElement | null {
    const container =
      element.closest<HTMLElement>("[class*='PullRequestDiffsList-module__diffEntry']") ||
      element.closest<HTMLElement>("copilot-diff-entry[data-file-path]") ||
      element.closest<HTMLElement>("[data-targets*='diff-file-filter.diffEntries']") ||
      element.closest<HTMLElement>(".file, .js-file") ||
      element.closest<HTMLElement>("[data-details-container-group='file']");

    if (container) return container;
    if (element.matches("[data-file-path], [data-tagsearch-path], [data-path]") && looksLikeDiffContainer(element))
      return element;

    return null;
  }

  function looksLikeDiffContainer(element: HTMLElement): boolean {
    return (
      Boolean(element.querySelector("table[aria-label^='Diff for:']")) ||
      Boolean(element.querySelector("tr.blob-code-addition, tr.blob-code-deletion")) ||
      Boolean(element.querySelector(".diff-text.syntax-highlighted-line")) ||
      Boolean(element.querySelector("h3 code")) ||
      Boolean(element.querySelector(".js-file-header[data-path]")) ||
      Boolean(element.querySelector("[class*='fgColor-success'], [class*='fgColor-danger']"))
    );
  }

  function getFileTreePath(element: HTMLElement): string | null {
    const treeItem = element.closest<HTMLElement>("[role='treeitem']");
    if (treeItem && treeItem !== element && isFileTreeFolder(treeItem)) return null;

    const id = normalizePathText(element.id);
    if (id && looksLikePath(id)) return id;

    if (element.matches("[data-filterable-item-text]")) {
      return (
        normalizePathText(element.getAttribute("data-filterable-item-text")) || normalizePathText(element.textContent)
      );
    }

    const textNode = element.querySelector("[data-filterable-item-text]");
    const textPath =
      normalizePathText(textNode?.getAttribute("data-filterable-item-text")) ||
      normalizePathText(textNode?.textContent);
    if (textPath) return textPath;

    const payload = element.getAttribute("data-hydro-click-payload");
    if (!payload) return null;

    try {
      const parsed = JSON.parse(payload.replace(/&quot;/g, '"'));
      const path = parsed?.payload?.data?.path;
      return typeof path === "string" ? path : null;
    } catch {
      return null;
    }
  }

  function getPathFromReactDiffHeader(element: HTMLElement): string | null {
    const codeText = element.querySelector("h3 code")?.textContent;
    return normalizePathText(codeText);
  }

  function getPathFromAriaLabel(element: HTMLElement): string | null {
    const labelled = element.querySelector<HTMLElement>("[aria-label*=': ']");
    const label = labelled?.getAttribute("aria-label") || "";
    const match = label.match(/:\s*(.+)$/);
    return normalizePathText(match?.[1]);
  }

  function getPathFromDiffTable(element: HTMLElement): string | null {
    const label = element.querySelector("table[aria-label^='Diff for:']")?.getAttribute("aria-label") || "";
    return normalizePathText(label.replace(/^Diff for:\s*/, ""));
  }

  export function normalizePathText(value: string | null | undefined): string | null {
    const normalized = (value || "").replace(/[\u200e\u200f]/g, "").trim();
    const deduped = collapseDuplicatedPath(normalized);
    return deduped && looksLikePath(deduped) ? deduped : null;
  }

  function looksLikePath(value: string): boolean {
    return value.includes("/") || /\.[a-z0-9]+$/i.test(value);
  }

  function collapseDuplicatedPath(value: string): string {
    if (value.length % 2 !== 0) return value;

    const midpoint = value.length / 2;
    const first = value.slice(0, midpoint);
    const second = value.slice(midpoint);
    return first === second && looksLikePath(first) ? first : value;
  }

  function isFileTreeFolder(element: HTMLElement): boolean {
    return (
      element.getAttribute("aria-expanded") !== null ||
      Boolean(element.querySelector("[role='group']")) ||
      element.getAttribute("data-tree-entry-type") === "directory"
    );
  }
}
