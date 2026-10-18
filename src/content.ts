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
  let lastRenderDebugKey = "";
  let lastDiffStatDebugKey = "";
  let lastPublishedState = "";
  let reviewTotals: LazyDiff.ReviewTotals | null = null;
  let countAnchorRecognized = false;

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
      if (isRendering || mutations.every(isLazyDiffMutation)) return;
      scheduleRender();
    });

    observer.observe(document, {
      childList: true,
      subtree: true
    });
    let lastUrl = window.location.href;
    window.setInterval(() => {
      const url = window.location.href;
      if (url === lastUrl) return;
      lastUrl = url;
      scheduleRender();
    }, 500);
    window.addEventListener("resize", () => {
      if (LazyDiff.GitHub.isPullFilesPage()) scheduleRender();
    });
    debug("observing GitHub page changes");
  }

  function scheduleRender(): void {
    if (debounceTimer) return;
    debounceTimer = window.setTimeout(() => {
      debounceTimer = 0;
      render();
    }, 200);
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
    chrome?.runtime?.onMessage?.addListener((message, _sender, sendResponse) => {
      if (isStateRequest(message)) {
        render();
        sendResponse(getPageState());
        return;
      }
      if (!isApplyMessage(message)) return;

      filterInput = isApplyFilterMessage(message)
        ? message.filterInput
        : LazyDiff.Core.serializeExcludePatterns(message.patterns);
      debug("message apply", filterInput);
      render();
      sendResponse(getPageState());
    });
  }

  function render(): void {
    if (!LazyDiff.GitHub.isPullFilesPage()) {
      document.getElementById(BAR_ID)?.remove();
      removeLazyDiffStat();
      clearLazyDiffHides();
      reviewTotals = null;
      countAnchorRecognized = false;
      publishState();
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
      reviewTotals = totals;
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
      upsertLazyDiffStat(totals, filter);
      publishState();
    } finally {
      isRendering = false;
    }
  }

  function upsertBar(): void {
    const mount = LazyDiff.GitHub.findLazyDiffMount();
    const existing = document.getElementById(BAR_ID);
    if (existing) {
      if (!mount) existing.remove();
      else if (mount.previousElementSibling !== existing) mount.insertAdjacentElement("beforebegin", existing);
      return;
    }
    if (!mount) return;
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
    input.placeholder = "!*.test.ts, !*.spec.ts";
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

    mount.insertAdjacentElement("beforebegin", bar);
  }

  function syncBarInput(): void {
    const input = document.getElementById(INPUT_ID);
    if (!(input instanceof HTMLInputElement)) return;

    const nextValue = filterInput;
    if (input.value !== nextValue) {
      input.value = nextValue;
    }
  }

  function isString(value: unknown): value is string {
    return typeof value === "string";
  }

  function getPageState(): LazyDiff.PageState {
    const barInjected = Boolean(document.getElementById(BAR_ID));
    const hasChangedLines = Boolean(reviewTotals && reviewTotals.visibleLines + reviewTotals.hiddenLines > 0);
    return {
      type: "lazydiff.state",
      filterInput,
      isFilesPage: LazyDiff.GitHub.isPullFilesPage(),
      barInjected,
      layoutRecognized: barInjected && (!hasChangedLines || countAnchorRecognized),
      totals: reviewTotals
    };
  }

  function publishState(): void {
    const state = getPageState();
    const key = JSON.stringify(state);
    if (key === lastPublishedState) return;
    lastPublishedState = key;
    void chrome?.runtime?.sendMessage?.(state).catch(() => {});
  }

  function isStateRequest(value: unknown): boolean {
    return Boolean(value && typeof value === "object" && "type" in value && value.type === "lazydiff.get-state");
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

  function upsertLazyDiffStat(totals: LazyDiff.ReviewTotals, filter: LazyDiff.FilterExpression): void {
    const githubDiffstat = LazyDiff.GitHub.findDiffStatMount();
    countAnchorRecognized = Boolean(githubDiffstat);
    const bar = document.getElementById(BAR_ID);
    const status = document.getElementById(STATUS_ID);
    const mount = githubDiffstat || (bar && status?.parentElement === bar ? status : null);
    if (!mount) {
      debug("diffstat mount not found", getDiffStatDebugSnapshot());
      removeLazyDiffStat();
      return;
    }

    if (githubDiffstat && !githubDiffstat.dataset.lazydiffOriginalText) {
      githubDiffstat.dataset.lazydiffOriginalText = githubDiffstat.textContent?.trim() || "";
    }
    const visibleDiffStat = githubDiffstat
      ? calculateVisibleDiffStat(totals, githubDiffstat, filter)
      : {
          additions: totals.visibleAdditions,
          deletions: totals.visibleDeletions,
          lines: totals.visibleLines,
          source: "collected-visible"
        };

    let lazyDiffstat = document.getElementById(DIFFSTAT_ID);
    if (!lazyDiffstat) {
      lazyDiffstat = document.createElement("span");
      lazyDiffstat.id = DIFFSTAT_ID;
      lazyDiffstat.className = "lazydiff-diffstat";
    }

    mount.insertAdjacentElement("beforebegin", lazyDiffstat);

    lazyDiffstat.replaceChildren(
      createDiffStatValue(`+${formatNumber(visibleDiffStat.additions)}`, "success"),
      createDiffStatValue(`−${formatNumber(visibleDiffStat.deletions)}`, "danger"),
      createDiffStatLabel("lazydiff")
    );

    lazyDiffstat.title = [
      "lazydiff filtered diff count",
      `Visible: +${formatNumber(visibleDiffStat.additions)} −${formatNumber(visibleDiffStat.deletions)} (${formatNumber(visibleDiffStat.lines)} lines)`,
      `Hidden: +${formatNumber(totals.hiddenAdditions)} −${formatNumber(totals.hiddenDeletions)} (${formatNumber(totals.hiddenLines)} lines)`,
      githubDiffstat
        ? `GitHub original: ${githubDiffstat.dataset.lazydiffOriginalText}`
        : "Counts for loaded files; GitHub's count location is unavailable."
    ].join("\n");

    debugDiffStatChanged("diffstat rendered", {
      mount: describeElement(mount),
      original: githubDiffstat?.dataset.lazydiffOriginalText,
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

    const githubTotals = LazyDiff.GitHub.readDiffStatCounts(githubDiffstat);
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
    if (isLazyDiffNode(mutation.target)) return true;
    const changedNodes = [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)];
    return changedNodes.length > 0 && changedNodes.every(isLazyDiffNode);
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
