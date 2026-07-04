namespace LazyDiff.Content {
  const DEBUG = false;
  const HIDDEN_FILE_CLASS = "lazydiff-hidden-file";
  const BAR_ID = "lazydiff-bar";
  const INPUT_ID = "lazydiff-bar-input";
  const STATUS_ID = "lazydiff-bar-status";
  const DIFFSTAT_ID = "lazydiff-diffstat";

  let filterInput = "";
  let observer: MutationObserver | null = null;
  let debounceTimer = 0;
  let isRendering = false;
  let suppressObserverUntil = 0;
  let lastRenderDebugKey = "";
  let lastDiffStatDebugKey = "";

  void init();

  async function init(): Promise<void> {
    debug("loaded", { url: window.location.href });
    filterInput = await LazyDiff.Storage.loadFilterInput();
    debug("loaded filter input", filterInput);
    render();
    observePage();
    observeStorage();
    observeMessages();
  }

  function observePage(): void {
    observer?.disconnect();
    observer = new MutationObserver((mutations) => {
      if (isRendering || Date.now() < suppressObserverUntil || mutations.every(isLazyDiffMutation)) return;
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(render, 200);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    debug("observing GitHub page changes");
  }

  function observeStorage(): void {
    chrome?.storage?.onChanged?.addListener((changes, areaName) => {
      if (areaName !== "local") return;

      const change = changes[LazyDiff.Storage.FILTER_INPUT_KEY] || changes[LazyDiff.Storage.STORAGE_KEY];
      if (!change) return;

      filterInput =
        typeof change.newValue === "string"
          ? change.newValue
          : Array.isArray(change.newValue)
            ? LazyDiff.Core.serializeExcludePatterns(change.newValue.filter(isString))
            : "";
      debug("storage changed", filterInput);
      render();
    });
  }

  function observeMessages(): void {
    chrome?.runtime?.onMessage?.addListener((message) => {
      if (!isApplyMessage(message)) return;

      filterInput = isApplyFilterMessage(message)
        ? message.filterInput
        : LazyDiff.Core.serializeExcludePatterns(message.patterns);
      debug("message apply", filterInput);
      render();
    });
  }

  function render(): void {
    if (!LazyDiff.GitHub.isPullFilesPage()) {
      debug("not a PR files page", { url: window.location.href });
      return;
    }

    try {
      isRendering = true;
      upsertBar();
      syncBarInput();
      clearLazyDiffHides();
      const files = LazyDiff.GitHub.collectFiles();
      const fileTreeEntries = LazyDiff.GitHub.collectFileTreeEntries();
      const filter = LazyDiff.Core.parseFilterExpression(filterInput);
      const totals = LazyDiff.Core.calculateTotalsForFilter(files, filter);
      const filterActive = isFilterActive(filter);
      const matchedPaths = files
        .filter((file) => !LazyDiff.Core.shouldShowPath(file.path, filter))
        .map((file) => file.path);
      const matchedTreePaths = fileTreeEntries
        .filter((file) => !LazyDiff.Core.shouldShowPath(file.path, filter))
        .map((file) => file.path);
      let hiddenFileElements = 0;
      let hiddenTreeElements = 0;

      for (const file of files) {
        const hidden = !LazyDiff.Core.shouldShowPath(file.path, filter);
        if (hidden) {
          setHidden(file.element, true);
          hiddenFileElements += 1;
        }
      }

      for (const file of fileTreeEntries) {
        const hidden = !LazyDiff.Core.shouldShowPath(file.path, filter);
        if (hidden) {
          const treeElement = findFileTreeElement(file.element);
          if (!treeElement) continue;

          setHidden(treeElement, true);
          hiddenTreeElements += 1;
        }
      }

      debugChanged(
        "render",
        createRenderDebugKey(totals, files.length, fileTreeEntries.length, hiddenFileElements, hiddenTreeElements),
        {
          filterInput,
          layout: LazyDiff.GitHub.getLayoutDebugSnapshot(),
          includePatterns: filter.includePatterns,
          excludePatterns: filter.excludePatterns,
          fileCount: files.length,
          fileTreeCount: fileTreeEntries.length,
          samplePaths: files.slice(0, 8).map((file) => file.path),
          largestFiles: files
            .slice()
            .sort((left, right) => right.changedLines - left.changedLines)
            .slice(0, 8)
            .map((file) => ({
              path: file.path,
              additions: file.additions,
              deletions: file.deletions,
              lines: file.changedLines
            })),
          sampleTreePaths: fileTreeEntries.slice(0, 8).map((file) => file.path),
          matchedPaths: matchedPaths.slice(0, 20),
          matchedTreePaths: matchedTreePaths.slice(0, 20),
          hiddenFileElements,
          hiddenTreeElements,
          totals
        }
      );
      updateBarStatus(totals, hiddenFileElements, hiddenTreeElements);
      upsertLazyDiffStat(totals, filter, filterActive);
    } finally {
      suppressObserverUntil = Date.now() + 500;
      isRendering = false;
    }
  }

  function upsertBar(): void {
    if (document.getElementById(BAR_ID)) return;

    const mount = LazyDiff.GitHub.findLazyDiffMount();
    const bar = document.createElement("div");
    bar.id = BAR_ID;
    bar.className = "lazydiff-bar";

    const label = document.createElement("label");
    label.className = "lazydiff-bar-label";
    label.htmlFor = INPUT_ID;
    label.textContent = "lazydiff";

    const input = document.createElement("input");
    input.id = INPUT_ID;
    input.className = "lazydiff-bar-input";
    input.type = "text";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.placeholder = "apps !tests/** !*.spec.ts";
    input.value = filterInput;

    const status = document.createElement("div");
    status.id = STATUS_ID;
    status.className = "lazydiff-bar-status";

    input.addEventListener("input", () => {
      filterInput = input.value;
      void LazyDiff.Storage.saveFilterInput(filterInput);
      render();
    });

    bar.append(label, input, status);

    if (mount.matches("[class*='PullRequestDiffsList-module__diffEntry'], #files")) {
      mount.insertAdjacentElement("beforebegin", bar);
    } else {
      mount.insertAdjacentElement("afterbegin", bar);
    }
  }

  function syncBarInput(): void {
    const input = document.getElementById(INPUT_ID);
    if (!(input instanceof HTMLInputElement)) return;
    if (document.activeElement === input) return;

    const nextValue = filterInput;
    if (input.value !== nextValue) {
      input.value = nextValue;
    }
  }

  function isString(value: unknown): value is string {
    return typeof value === "string";
  }

  function updateBarStatus(
    totals: LazyDiff.ReviewTotals,
    hiddenFileElements: number,
    hiddenTreeElements: number
  ): void {
    const status = document.getElementById(STATUS_ID);
    if (!status) return;

    status.textContent = `${totals.visibleFiles} visible files, ${totals.hiddenFiles} hidden files`;
    status.title = `${hiddenFileElements} diff nodes hidden, ${hiddenTreeElements} navigation nodes hidden`;
  }

  function upsertLazyDiffStat(
    totals: LazyDiff.ReviewTotals,
    filter: LazyDiff.FilterExpression,
    filterActive: boolean
  ): void {
    if (!filterActive) {
      removeLazyDiffStat();
      return;
    }

    const githubDiffstat = LazyDiff.GitHub.findDiffStatMount();
    if (!githubDiffstat) {
      debug("diffstat mount not found, using bar fallback", getDiffStatDebugSnapshot());
      upsertFallbackLazyDiffStat(totals);
      return;
    }

    if (!githubDiffstat.dataset.lazydiffOriginalText) {
      githubDiffstat.dataset.lazydiffOriginalText = githubDiffstat.textContent?.trim() || "";
    }
    const visibleDiffStat = calculateVisibleDiffStat(totals, githubDiffstat, filter);

    let lazyDiffstat = document.getElementById(DIFFSTAT_ID);
    if (!lazyDiffstat) {
      lazyDiffstat = document.createElement("span");
      lazyDiffstat.id = DIFFSTAT_ID;
      lazyDiffstat.className = "lazydiff-diffstat";
    }

    githubDiffstat.insertAdjacentElement("beforebegin", lazyDiffstat);

    lazyDiffstat.replaceChildren(
      createDiffStatValue(`+${formatNumber(visibleDiffStat.additions)}`, "success"),
      createDiffStatValue(`−${formatNumber(visibleDiffStat.deletions)}`, "danger"),
      createDiffStatLabel("lazydiff")
    );

    lazyDiffstat.title = [
      "lazydiff filtered diff count",
      `Visible: +${formatNumber(visibleDiffStat.additions)} −${formatNumber(visibleDiffStat.deletions)} (${formatNumber(visibleDiffStat.lines)} lines)`,
      `Hidden: +${formatNumber(totals.hiddenAdditions)} −${formatNumber(totals.hiddenDeletions)} (${formatNumber(totals.hiddenLines)} lines)`,
      `GitHub original: ${githubDiffstat.dataset.lazydiffOriginalText}`
    ].join("\n");

    debugDiffStatChanged("diffstat rendered", {
      mount: describeElement(githubDiffstat),
      original: githubDiffstat.dataset.lazydiffOriginalText,
      lazydiff: lazyDiffstat.textContent?.trim(),
      visibleAdditions: visibleDiffStat.additions,
      visibleDeletions: visibleDiffStat.deletions,
      hiddenAdditions: totals.hiddenAdditions,
      hiddenDeletions: totals.hiddenDeletions,
      source: visibleDiffStat.source
    });
  }

  function removeLazyDiffStat(): void {
    document.getElementById(DIFFSTAT_ID)?.remove();
  }

  function upsertFallbackLazyDiffStat(totals: LazyDiff.ReviewTotals): void {
    const status = document.getElementById(STATUS_ID);
    if (!status?.parentElement) return;

    let lazyDiffstat = document.getElementById(DIFFSTAT_ID);
    if (!lazyDiffstat) {
      lazyDiffstat = document.createElement("span");
      lazyDiffstat.id = DIFFSTAT_ID;
      lazyDiffstat.className = "lazydiff-diffstat lazydiff-diffstat-fallback";
    }

    status.insertAdjacentElement("beforebegin", lazyDiffstat);
    lazyDiffstat.replaceChildren(
      createDiffStatValue(`+${formatNumber(totals.visibleAdditions)}`, "success"),
      createDiffStatValue(`−${formatNumber(totals.visibleDeletions)}`, "danger"),
      createDiffStatLabel("lazydiff")
    );
    lazyDiffstat.title = "lazydiff could not find GitHub's original diff count mount";

    debugDiffStatChanged("diffstat fallback rendered", {
      lazydiff: lazyDiffstat.textContent?.trim(),
      visibleAdditions: totals.visibleAdditions,
      visibleDeletions: totals.visibleDeletions
    });
  }

  function createDiffStatLabel(text: string): HTMLElement {
    const label = document.createElement("span");
    label.className = "lazydiff-diffstat-label";
    label.textContent = text;
    return label;
  }

  function createDiffStatValue(text: string, tone: "success" | "danger"): HTMLElement {
    const value = document.createElement("span");
    value.className = tone === "success" ? "color-fg-success" : "color-fg-danger";
    value.textContent = text;
    return value;
  }

  function isFilterActive(filter: LazyDiff.FilterExpression): boolean {
    return filter.includePatterns.length > 0 || filter.excludePatterns.length > 0;
  }

  function calculateVisibleDiffStat(
    totals: LazyDiff.ReviewTotals,
    githubDiffstat: HTMLElement,
    filter: LazyDiff.FilterExpression
  ): { additions: number; deletions: number; lines: number; source: "github-minus-hidden" | "collected-visible" } {
    if (filter.includePatterns.length > 0) {
      return {
        additions: totals.visibleAdditions,
        deletions: totals.visibleDeletions,
        lines: totals.visibleLines,
        source: "collected-visible"
      };
    }

    const githubTotals = parseGitHubDiffStat(githubDiffstat);
    if (!githubTotals) {
      return {
        additions: totals.visibleAdditions,
        deletions: totals.visibleDeletions,
        lines: totals.visibleLines,
        source: "collected-visible"
      };
    }

    const additions = Math.max(0, githubTotals.additions - totals.hiddenAdditions);
    const deletions = Math.max(0, githubTotals.deletions - totals.hiddenDeletions);
    return {
      additions,
      deletions,
      lines: additions + deletions,
      source: "github-minus-hidden"
    };
  }

  function parseGitHubDiffStat(element: HTMLElement): { additions: number; deletions: number } | null {
    const text = element.textContent || "";
    const additions = text.match(/\+\s*(\d[\d,]*)/);
    const deletions = text.match(/[−-]\s*(\d[\d,]*)/);
    if (!additions || !deletions) return null;

    return {
      additions: Number(additions[1].replace(/,/g, "")),
      deletions: Number(deletions[1].replace(/,/g, ""))
    };
  }

  function formatNumber(value: number): string {
    return new Intl.NumberFormat().format(value);
  }

  function getDiffStatDebugSnapshot(): unknown {
    return {
      successNodes: Array.from(
        document.querySelectorAll<HTMLElement>(".color-fg-success, .text-green, [class*='fgColor-success']")
      )
        .slice(0, 8)
        .map(describeElement),
      dangerNodes: Array.from(
        document.querySelectorAll<HTMLElement>(".color-fg-danger, .text-red, [class*='fgColor-danger']")
      )
        .slice(0, 8)
        .map(describeElement)
    };
  }

  function describeElement(element: HTMLElement): Record<string, string> {
    return {
      tag: element.tagName.toLowerCase(),
      id: element.id,
      className: typeof element.className === "string" ? element.className : "",
      text: element.textContent?.trim().replace(/\s+/g, " ").slice(0, 120) || ""
    };
  }

  function isLazyDiffMutation(mutation: MutationRecord): boolean {
    return (
      isLazyDiffNode(mutation.target) ||
      Array.from(mutation.addedNodes).some(isLazyDiffNode) ||
      Array.from(mutation.removedNodes).some(isLazyDiffNode)
    );
  }

  function isLazyDiffNode(node: Node): boolean {
    return (
      node instanceof HTMLElement && Boolean(node.closest("#lazydiff-bar, #lazydiff-diffstat, [class*='lazydiff-']"))
    );
  }

  function createRenderDebugKey(
    totals: LazyDiff.ReviewTotals,
    fileCount: number,
    fileTreeCount: number,
    hiddenFileElements: number,
    hiddenTreeElements: number
  ): string {
    return [
      filterInput,
      fileCount,
      fileTreeCount,
      totals.visibleFiles,
      totals.hiddenFiles,
      totals.visibleAdditions,
      totals.visibleDeletions,
      totals.hiddenAdditions,
      totals.hiddenDeletions,
      hiddenFileElements,
      hiddenTreeElements
    ].join("|");
  }

  function debugChanged(message: string, key: string, detail: unknown): void {
    if (key === lastRenderDebugKey) return;
    lastRenderDebugKey = key;
    debug(message, detail);
  }

  function debugDiffStatChanged(message: string, detail: unknown): void {
    const key = JSON.stringify(detail);
    if (key === lastDiffStatDebugKey) return;
    lastDiffStatDebugKey = key;
    debug(message, detail);
  }

  function setHidden(element: HTMLElement, hidden: boolean): void {
    element.classList.toggle(HIDDEN_FILE_CLASS, hidden);
    element.hidden = hidden;
    if (hidden) {
      element.dataset.lazydiffHidden = "true";
      element.style.setProperty("display", "none", "important");
    } else {
      delete element.dataset.lazydiffHidden;
      element.style.removeProperty("display");
    }
  }

  function clearLazyDiffHides(): void {
    for (const element of Array.from(document.querySelectorAll<HTMLElement>("[data-lazydiff-hidden='true']"))) {
      setHidden(element, false);
    }
  }

  function findFileTreeElement(element: HTMLElement): HTMLElement | null {
    const treeItem = element.closest<HTMLElement>("[role='treeitem']");
    if (!treeItem || isFileTreeFolderElement(treeItem)) return null;
    return treeItem;
  }

  function isFileTreeFolderElement(element: HTMLElement): boolean {
    return (
      element.getAttribute("aria-expanded") !== null ||
      element.getAttribute("data-tree-entry-type") === "directory" ||
      Boolean(element.querySelector(":scope > [role='group']"))
    );
  }

  function isApplyMessage(
    value: unknown
  ): value is { type: "lazydiff.apply"; patterns: string[] } | { type: "lazydiff.apply"; filterInput: string } {
    return Boolean(
      value &&
      typeof value === "object" &&
      "type" in value &&
      value.type === "lazydiff.apply" &&
      (("patterns" in value && Array.isArray(value.patterns)) ||
        ("filterInput" in value && typeof value.filterInput === "string"))
    );
  }

  function isApplyFilterMessage(
    value: { type: "lazydiff.apply"; patterns: string[] } | { type: "lazydiff.apply"; filterInput: string }
  ): value is { type: "lazydiff.apply"; filterInput: string } {
    return "filterInput" in value;
  }

  function debug(message: string, detail?: unknown): void {
    if (!isDebugEnabled()) return;
    if (detail === undefined) {
      console.info(`[lazydiff] ${message}`);
    } else {
      console.info(`[lazydiff] ${message}`, detail);
    }
  }

  function isDebugEnabled(): boolean {
    return DEBUG || window.localStorage.getItem("lazydiffDebug") === "1";
  }
}
