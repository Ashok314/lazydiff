# lazydiff

Lazy enough to review.

LazyDiff is a Chrome extension for GitHub pull request review. It hides PR files with negative filters and shows the diff size left after filtering.

## What it does

- Adds a LazyDiff filter bar to GitHub PR changed-files pages.
- Hides matching files from the visible diff.
- Shows visible and hidden file counts.
- Shows additions/deletions left after filtering.
- Stores filter text locally in Chrome.
- Makes no network requests.

## Status

Chrome Web Store status: published.

- Website: <https://ashok314.github.io/lazydiff/>
- Chrome Web Store: <https://chromewebstore.google.com/detail/bnoohgdhbhegnpdfhneciipfgmmjejhb>
- Privacy policy: <https://ashok314.github.io/lazydiff/privacy/>
- Extension ID: `bnoohgdhbhegnpdfhneciipfgmmjejhb`

Install from the Chrome Web Store, or load the generated `extension/` directory as an unpacked Chrome extension for local development.

## Filter Grammar

LazyDiff uses a small custom grammar. It is gitignore-like, but not `.gitignore` compatible.

| Input             | Meaning                         |
| ----------------- | ------------------------------- |
| `apps`            | Show matching `apps` paths.     |
| `!apps`           | Hide matching `apps` paths.     |
| `-apps`           | Same as `!apps`.                |
| `!/apps`          | Hide only root `apps` paths.    |
| `*.spec.ts`       | Match spec files at any depth.  |
| `!*.spec.ts`      | Hide spec files at any depth.   |
| `.webp`           | Match files ending in `.webp`.  |
| `apps !*.spec.ts` | Show `apps`, except spec files. |
| `"docs pages"`    | Quote patterns that use spaces. |

Rules:

- Plain tokens are include filters.
- `!` and `-` tokens are exclude filters.
- Excludes always win over includes.
- If there are no include filters, LazyDiff starts from all files.
- `/pattern` is root-anchored.
- Bare words like `apps` match a folder named `apps`, nested folders named `apps`, and file extensions such as `.apps`.

## Install Locally

```sh
git clone https://github.com/Ashok314/lazydiff.git
cd lazydiff
npm ci
npm run package:extension
```

In Chrome:

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click `Load unpacked`
4. Select the generated `extension/` directory

## Development

```sh
npm test
npm run package:extension
npm run zip:extension
npm run format:check
```

`npm run zip:extension` creates `release/lazydiff-extension-v<version>.zip`.

## Release Automation

GitHub Actions packages the extension on pushes to `main`, version tags, and manual dispatch.

- Workflow: `.github/workflows/extension.yml`
- Artifact: `release/lazydiff-extension-v*.zip`
- Tag releases: pushing a tag like `v0.1.0` attaches the zip to a GitHub Release.

The static website deploys to GitHub Pages from `site/` on pushes to `main`.

## Privacy

LazyDiff runs locally in the browser on GitHub PR pages.

- No network requests.
- No analytics.
- No source code is sent anywhere.
- No PR file paths are sent anywhere.
- Filter text is stored only in `chrome.storage.local`.

See `PRIVACY.md` and the published privacy page for the release policy.

## Brand Assets

- Tagline: `Lazy enough to review.`
- Logo: `assets/logo.svg`
- Icon: `assets/icon.svg`
- Extension icons: `assets/icons/`

## Known Limitation

GitHub's file navigation can still show empty folder rows after filtering. LazyDiff prioritizes hiding the actual diff blocks and showing accurate visible additions/deletions. Smarter folder pruning is tracked for a post-release update because GitHub's navigation tree changes dynamically when folders are expanded.

## Debugging

LazyDiff keeps console logging off by default. To debug a GitHub PR page, run this in DevTools and reload:

```js
localStorage.setItem("lazydiffDebug", "1");
```

To turn it off:

```js
localStorage.removeItem("lazydiffDebug");
```

## Contributing

Bug reports and feature ideas are welcome.

- Report bugs with the GitHub issue template.
- Include the filter input, browser, GitHub PR URL shape, and screenshots when possible.
- GitHub changes its PR layout over time, so layout-related reports are especially useful.

Maintained by [Ashok](https://ashok314.github.io/).

Support the project: [Buy me a coffee](https://buymeacoffee.com/ashok314)
