namespace LazyDiff.Popup {
  const input = document.getElementById("lazydiff-popup-input") as HTMLInputElement;
  const status = document.getElementById("lazydiff-popup-status") as HTMLElement;
  const counts = document.getElementById("lazydiff-popup-counts") as HTMLElement;
  const additions = document.getElementById("lazydiff-popup-additions") as HTMLElement;
  const deletions = document.getElementById("lazydiff-popup-deletions") as HTMLElement;
  const clear = document.getElementById("lazydiff-popup-clear") as HTMLButtonElement;
  const info = document.getElementById("lazydiff-popup-info") as HTMLButtonElement;
  const help = document.getElementById("lazydiff-help") as HTMLDialogElement;
  const closeHelp = document.getElementById("lazydiff-help-close") as HTMLButtonElement;
  const layoutWarning = document.getElementById("lazydiff-popup-layout-warning") as HTMLElement;
  const languageSelect = document.getElementById("lazydiff-popup-language") as HTMLSelectElement;
  let activeTabId: number | undefined;
  let pendingWrites = 0;
  let writeQueue = Promise.resolve();
  let requestVersion = 0;

  void init();

  async function init(): Promise<void> {
    const [savedFilter, savedLanguage] = await Promise.all([
      LazyDiff.Storage.loadFilterInput(),
      LazyDiff.Storage.loadLanguagePreference()
    ]);
    LazyDiff.I18n.setPreference(savedLanguage);
    localizePopup();
    languageSelect.disabled = false;
    languageSelect.addEventListener("change", () => {
      LazyDiff.I18n.setPreference(languageSelect.value);
      localizePopup();
      void LazyDiff.Storage.saveLanguagePreference(LazyDiff.I18n.preference());
      void requestState();
    });
    info.addEventListener("click", () => {
      help.showModal();
      info.setAttribute("aria-expanded", "true");
    });
    closeHelp.addEventListener("click", () => help.close());
    help.addEventListener("close", () => {
      info.setAttribute("aria-expanded", "false");
      info.focus();
    });
    help.addEventListener("click", (event) => {
      if (event.target !== help) return;
      const bounds = help.getBoundingClientRect();
      if (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      ) {
        help.close();
      }
    });
    input.value = savedFilter;
    input.disabled = false;
    clear.disabled = false;
    input.addEventListener("input", saveAndApply);
    clear.addEventListener("click", () => {
      input.value = "";
      input.focus();
      saveAndApply();
    });
    chrome?.storage?.onChanged?.addListener((changes, area) => {
      if (area !== "local") return;
      let refresh = false;
      const languageChange = changes[LazyDiff.Storage.LANGUAGE_KEY];
      if (languageChange) {
        const previous = LazyDiff.I18n.preference();
        LazyDiff.I18n.setPreference(languageChange.newValue);
        if (previous !== LazyDiff.I18n.preference()) {
          localizePopup();
          refresh = true;
        }
      }
      const change = changes[LazyDiff.Storage.FILTER_INPUT_KEY];
      if (change && pendingWrites === 0) {
        input.value = typeof change.newValue === "string" ? change.newValue : "";
        refresh = true;
      }
      if (refresh) void requestState();
    });
    chrome?.runtime?.onMessage?.addListener((message, sender) => {
      if (sender.tab?.id === activeTabId && isPageState(message)) showState(message);
    });
    try {
      const [tab] = (await chrome?.tabs?.query({ active: true, currentWindow: true })) || [];
      activeTabId = tab?.id;
    } catch {
      activeTabId = undefined;
    }
    await requestState();
  }

  function localizePopup(): void {
    LazyDiff.I18n.localize(document);
    languageSelect.value = LazyDiff.I18n.preference();
  }

  function saveAndApply(): void {
    const value = input.value;
    pendingWrites += 1;
    status.textContent = LazyDiff.I18n.message("applyingFilter");
    counts.hidden = true;
    writeQueue = writeQueue.then(async () => {
      try {
        await LazyDiff.Storage.saveFilterInput(value);
        if (value === input.value) await requestState({ type: "lazydiff.apply", filterInput: value });
      } finally {
        pendingWrites -= 1;
      }
    });
  }

  async function requestState(
    message: { type: "lazydiff.get-state" } | { type: "lazydiff.apply"; filterInput: string } = {
      type: "lazydiff.get-state"
    }
  ): Promise<void> {
    const version = ++requestVersion;
    try {
      if (activeTabId === undefined || !chrome?.tabs) throw new Error("No active tab");
      const state = await chrome.tabs.sendMessage(activeTabId, {
        ...message,
        languagePreference: LazyDiff.I18n.preference()
      });
      if (version !== requestVersion) return;
      if (!isPageState(state)) throw new Error("Page unavailable");
      showState(state);
    } catch {
      if (version !== requestVersion) return;
      status.textContent = LazyDiff.I18n.message("openOrRefresh");
      counts.hidden = true;
      layoutWarning.hidden = true;
    }
  }

  function showState(state: LazyDiff.PageState): void {
    if (pendingWrites > 0 && state.filterInput !== input.value) return;
    input.value = state.filterInput;
    counts.hidden = true;
    layoutWarning.hidden = !state.isFilesPage || state.layoutRecognized;
    if (!state.isFilesPage) {
      status.textContent = LazyDiff.I18n.message("openFilesTab");
      return;
    }
    if (!state.totals || state.totals.totalFiles === 0) {
      status.textContent = LazyDiff.I18n.message(state.layoutRecognized ? "waitingForFiles" : "filesNotRecognized");
      return;
    }
    const totals = state.totals;
    status.textContent = LazyDiff.I18n.message("fileCounts", [
      LazyDiff.I18n.formatNumber(totals.visibleFiles),
      LazyDiff.I18n.formatNumber(totals.hiddenFiles)
    ]);
    additions.textContent = `+${LazyDiff.I18n.formatNumber(totals.visibleAdditions)}`;
    deletions.textContent = `−${LazyDiff.I18n.formatNumber(totals.visibleDeletions)}`;
    counts.hidden = false;
  }

  function isPageState(value: unknown): value is LazyDiff.PageState {
    return Boolean(
      value &&
      typeof value === "object" &&
      "type" in value &&
      value.type === "lazydiff.state" &&
      "filterInput" in value &&
      typeof value.filterInput === "string" &&
      "isFilesPage" in value &&
      typeof value.isFilesPage === "boolean" &&
      "barInjected" in value &&
      typeof value.barInjected === "boolean" &&
      "layoutRecognized" in value &&
      typeof value.layoutRecognized === "boolean" &&
      "totals" in value
    );
  }
}
