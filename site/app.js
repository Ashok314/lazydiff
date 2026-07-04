const SITE = {
  extensionId: "bnoohgdhbhegnpdfhneciipfgmmjejhb",
  links: {
    github: "https://github.com/Ashok314/lazydiff",
    website: "https://ashok314.github.io/lazydiff/"
  }
};

const I18N = {
  en: {
    nav: {
      screenshots: "Screenshots",
      syntax: "Syntax",
      privacy: "Privacy",
      website: "Website",
      github: "GitHub"
    },
    hero: {
      eyebrow: "Negative filters for GitHub PRs",
      title: "Lazy enough to review.",
      lede: "Hide tests, generated files, specs, or any path you do not want to review, then see the diff size that remains."
    },
    actions: {
      install: "Install soon",
      source: "View source"
    },
    demo: {
      count: "12 visible files, 24 hidden files"
    },
    screenshots: {
      eyebrow: "Screenshots",
      title: "Before, after, closeup, and the tiny popup.",
      before: "Before: GitHub shows the full pull request diff size.",
      after: "After: hide unwanted files and see the remaining diff size.",
      closeup: "Closeup: LazyDiff count and filter bar on the files changed page.",
      popup: "Info-only popup. Filtering happens on the PR page."
    },
    syntax: {
      eyebrow: "Custom syntax",
      title: "One box for include and exclude.",
      apps: "Show matching paths.",
      notApps: "Hide matching paths.",
      root: "Hide root paths only.",
      combo: "Show apps, except specs."
    },
    privacy: {
      eyebrow: "Private by default",
      title: "No network. No analytics. No code leaves your browser.",
      body: 'LazyDiff runs locally on GitHub PR pages. Filter text is stored only in Chrome local storage. See the <a href="privacy/">privacy policy</a>.'
    },
    install: {
      eyebrow: "Chrome Web Store",
      title: "Submitted and pending review.",
      body: "LazyDiff has been submitted to the Chrome Web Store. Until review is complete, the extension can be loaded unpacked from the generated <code>extension/</code> directory.",
      statusLabel: "Status",
      status: "Pending review",
      idLabel: "Extension ID"
    },
    controls: {
      dark: "Dark",
      light: "Light",
      lang: "JA"
    },
    policy: {
      home: "Home",
      title: "Privacy - lazydiff",
      eyebrow: "Privacy policy",
      heading: "LazyDiff collects nothing.",
      lede: "No analytics, no tracking, no servers, and no network requests from the extension.",
      effective: "Effective date: July 4, 2026",
      handlingTitle: "Data handling",
      handlingOne: "LazyDiff runs locally in your browser on GitHub pull request pages.",
      handlingTwo: "No source code, file paths, filter text, or pull request content is sent anywhere.",
      storageTitle: "Local storage",
      storageBody:
        "LazyDiff stores filter text in <code>chrome.storage.local</code> so filters can persist between page reloads. This data stays in your browser.",
      notCollectedTitle: "Data not collected",
      notCollectedBody:
        "LazyDiff does not collect personally identifiable information, authentication information, financial information, health information, personal communications, location, browsing history, website content, or user activity.",
      permissionsTitle: "Permissions",
      permissionsBody:
        "LazyDiff requests only <code>storage</code>, used to save filter text locally. The extension runs only on GitHub pull request pages matched by the manifest.",
      contactTitle: "Contact",
      contactBody:
        'Questions or privacy requests can be opened on <a href="https://github.com/Ashok314/lazydiff/issues">GitHub Issues</a>.'
    }
  },
  ja: {
    nav: {
      screenshots: "スクリーンショット",
      syntax: "構文",
      privacy: "プライバシー",
      website: "Webサイト",
      github: "GitHub"
    },
    hero: {
      eyebrow: "GitHub PR向けのネガティブフィルター",
      title: "レビューを、少し楽に。",
      lede: "テスト、生成ファイル、spec、見なくてよいパスを隠して、残りの差分サイズだけを確認できます。"
    },
    actions: {
      install: "公開待ち",
      source: "ソースを見る"
    },
    demo: {
      count: "12件表示、24件非表示"
    },
    screenshots: {
      eyebrow: "スクリーンショット",
      title: "フィルター前後と、細かい表示。",
      before: "Before: GitHubはPR全体の差分サイズを表示します。",
      after: "After: 不要なファイルを隠し、残りの差分サイズを表示します。",
      closeup: "Closeup: Files changedページ上のLazyDiffカウントとフィルターバー。",
      popup: "ポップアップは情報表示用です。フィルター操作はPRページ上で行います。"
    },
    syntax: {
      eyebrow: "カスタム構文",
      title: "include と exclude を1つの入力欄で。",
      apps: "一致するパスを表示します。",
      notApps: "一致するパスを隠します。",
      root: "ルート直下のパスだけ隠します。",
      combo: "appsを表示しつつ、specを除外します。"
    },
    privacy: {
      eyebrow: "最初からプライベート",
      title: "ネットワークなし。分析なし。コードはブラウザの外へ出ません。",
      body: 'LazyDiffはGitHub PRページ上でローカルに動作します。フィルター文字列はChromeのローカルストレージだけに保存されます。詳しくは<a href="privacy/">プライバシーポリシー</a>をご覧ください。'
    },
    install: {
      eyebrow: "Chrome Web Store",
      title: "提出済み、レビュー待ちです。",
      body: "LazyDiffはChrome Web Storeへ提出済みです。レビュー完了までは、生成された<code>extension/</code>ディレクトリからunpacked拡張として読み込めます。",
      statusLabel: "ステータス",
      status: "レビュー待ち",
      idLabel: "拡張機能ID"
    },
    controls: {
      dark: "Dark",
      light: "Light",
      lang: "EN"
    },
    policy: {
      home: "ホーム",
      title: "プライバシー - lazydiff",
      eyebrow: "プライバシーポリシー",
      heading: "LazyDiffは何も収集しません。",
      lede: "分析なし、追跡なし、サーバーなし。拡張機能からのネットワーク通信もありません。",
      effective: "適用日: 2026年7月4日",
      handlingTitle: "データの扱い",
      handlingOne: "LazyDiffはGitHubのPull Requestページ上で、ブラウザ内だけで動作します。",
      handlingTwo: "ソースコード、ファイルパス、フィルター文字列、Pull Requestの内容はどこにも送信されません。",
      storageTitle: "ローカルストレージ",
      storageBody:
        "LazyDiffはフィルター文字列を<code>chrome.storage.local</code>に保存します。これはページ再読み込み後もフィルターを使えるようにするためで、データはブラウザ内に残ります。",
      notCollectedTitle: "収集しないデータ",
      notCollectedBody:
        "LazyDiffは個人識別情報、認証情報、金融情報、健康情報、個人的な通信、位置情報、閲覧履歴、Webサイトの内容、ユーザー活動を収集しません。",
      permissionsTitle: "権限",
      permissionsBody:
        "LazyDiffが要求する権限は<code>storage</code>のみです。これはフィルター文字列をローカルに保存するために使います。拡張機能はmanifestで指定されたGitHub Pull Requestページ上でのみ動作します。",
      contactTitle: "連絡先",
      contactBody:
        '質問やプライバシーに関する連絡は<a href="https://github.com/Ashok314/lazydiff/issues">GitHub Issues</a>で受け付けています。'
    }
  }
};

const state = {
  lang: localStorage.getItem("lazydiffSiteLang") || "en",
  theme:
    localStorage.getItem("lazydiffSiteTheme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
};

function read(path) {
  return path.split(".").reduce((value, key) => value?.[key], I18N[state.lang]);
}

function render() {
  document.documentElement.lang = state.lang;
  document.documentElement.dataset.theme = state.theme;

  const pageTitle = read("policy.title");
  if (document.body.dataset.page === "privacy" && pageTitle) {
    document.title = pageTitle;
  }

  document.querySelectorAll("[data-site-url]").forEach((link) => {
    const key = link.dataset.siteUrl;
    if (SITE.links[key]) link.href = SITE.links[key];
  });

  document.querySelectorAll("[data-extension-id]").forEach((node) => {
    node.textContent = SITE.extensionId;
  });

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const value = read(node.dataset.i18n);
    if (typeof value === "string") node.textContent = value;
  });

  document.querySelectorAll("[data-i18n-html]").forEach((node) => {
    const value = read(node.dataset.i18nHtml);
    if (typeof value === "string") node.innerHTML = value;
  });

  const themeToggle = document.querySelector("[data-theme-toggle]");
  if (themeToggle) {
    themeToggle.textContent = read(`controls.${state.theme === "dark" ? "light" : "dark"}`);
  }

  const langToggle = document.querySelector("[data-lang-toggle]");
  if (langToggle) {
    langToggle.textContent = read("controls.lang");
  }
}

document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  localStorage.setItem("lazydiffSiteTheme", state.theme);
  render();
});

document.querySelector("[data-lang-toggle]")?.addEventListener("click", () => {
  state.lang = state.lang === "en" ? "ja" : "en";
  localStorage.setItem("lazydiffSiteLang", state.lang);
  render();
});

render();
