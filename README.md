# lazydiff

Lazy enough to review.

Negative filters for GitHub PR files, plus diff-size counts after filtering.

LazyDiff adds the missing "not this path" workflow to GitHub PR review. Hide unwanted files and folders such as tests, generated assets, snapshots, or specs, then see the additions/deletions left in the filtered review.

## Why

GitHub's PR UI can filter by file name and extension, but it does not give reviewers a simple negative filter or a filtered diff-size count. LazyDiff is for reducing a large PR into the part you actually intend to review.

## Brand

- Tagline: `Lazy enough to review.`
- Logo source: `assets/logo.svg`
- Icon source: `assets/icon.svg`
- Extension icons: `assets/icons/`

## Filter Grammar

LazyDiff uses a small custom grammar. It is intentionally gitignore-like, but it is not `.gitignore` compatible.

| Input             | Meaning                             |
| ----------------- | ----------------------------------- |
| `apps`            | Show only matching `apps` paths.    |
| `!apps`           | Hide matching `apps` paths.         |
| `-apps`           | Same as `!apps`.                    |
| `!/apps`          | Hide only root `apps` paths.        |
| `*.spec.ts`       | Match spec files at any depth.      |
| `!*.spec.ts`      | Hide spec files at any depth.       |
| `.webp`           | Match files ending in `.webp`.      |
| `apps !*.spec.ts` | Show `apps`, except spec files.     |
| `"docs pages"`    | Quote patterns that contain spaces. |

Rules:

- Plain tokens are include filters.
- `!` and `-` tokens are exclude filters.
- Excludes always win over includes.
- If there are no include filters, LazyDiff starts from all files.
- `/pattern` is root-anchored.
- Bare words like `apps` match a folder named `apps`, nested folders named `apps`, and file extensions such as `.apps`.

## Privacy

LazyDiff runs entirely in the browser on GitHub PR pages.

- No network requests.
- No analytics.
- No code is sent anywhere.
- Filter text is stored only in `chrome.storage.local`.

See `PRIVACY.md` for the release privacy policy.

## Known Limitation

GitHub's file navigation can still show empty folder rows after filtering. LazyDiff prioritizes hiding the actual diff blocks and showing accurate visible additions/deletions. Smarter folder pruning is tracked for a post-release update because GitHub's navigation tree changes dynamically when folders are expanded.

## Local Development

```sh
npm test
npm run package:extension
npm run zip:extension
```

Then load the generated `extension/` directory as an unpacked Chrome extension.

`npm run zip:extension` creates `release/lazydiff-extension.zip` for manual Chrome Web Store upload.

## Use Locally From Source

You can clone the repository and run LazyDiff locally without installing from the Chrome Web Store.

```sh
git clone https://github.com/Ashok314/lazydiff.git
cd lazydiff
npm test
npm run package:extension
```

In Chrome:

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click `Load unpacked`
4. Select the generated `extension/` directory

## Release Automation

GitHub Actions runs tests and packages the extension on pushes and pull requests.

- Workflow: `.github/workflows/extension.yml`
- Artifact: `lazydiff-extension.zip`
- Tag releases: pushing a tag like `v0.1.0` attaches the zip to a GitHub Release.

Chrome Web Store publishing can be automated later after the developer account and API credentials are ready. Until then, upload `release/lazydiff-extension.zip` manually.

## Website

The static landing page lives in `site/`.

For GitHub Pages:

- Source directory: `site/`
- Site URL: `https://ashok314.github.io/lazydiff/`
- Privacy URL: `https://ashok314.github.io/lazydiff/privacy`

## Release Checklist

- License is MIT.
- Publish the privacy policy URL.
- Keep `PRIVACY.md` and `SECURITY.md` updated.
- Export store-ready PNG icons from `assets/icon.svg`.
- Add screenshots and a short demo GIF.
- Recheck selectors against GitHub's current PR layout.
- Keep console debug disabled for release builds.
- Run `npm test` and `npm run package:extension`.
- Manually verify filtering, file navigation hiding, and visible diff counts on at least one large PR.
- Keep smart navigation folder pruning as a post-release TODO.

## Contributing

Bug reports and feature ideas are welcome.

- Report bugs with the GitHub issue template.
- Include the filter input, browser, GitHub PR URL shape, and screenshots when possible.
- GitHub changes its PR layout over time, so layout-related reports are especially useful.

Maintained by [Ashok](https://ashok314.github.io/).

Support the Project: [☕ Buy me a coffee](https://buymeacoffee.com/ashok314)

## Debugging

LazyDiff keeps console logging off by default. To debug a GitHub PR page, run this in DevTools and reload:

```js
localStorage.setItem("lazydiffDebug", "1");
```

To turn it off:

```js
localStorage.removeItem("lazydiffDebug");
```
