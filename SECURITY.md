# Security Policy

LazyDiff is a browser extension, so security and privacy matter even though the tool is small.

## Supported Versions

Security fixes target the latest released version.

## Security Model

LazyDiff is designed to be local-only.

- No analytics.
- No remote scripts.
- No extension network requests.
- No cookie access.
- No code or pull request content is sent anywhere.
- Filter text is stored only in `chrome.storage.local`.

The extension runs only on GitHub pull request pages matched by the manifest.

## Reporting a Vulnerability

Please report security issues privately first.

Until a dedicated security contact is available, open a minimal GitHub issue asking for a private contact path without posting exploit details publicly.

Include:

- affected LazyDiff version
- browser and version
- steps to reproduce
- impact

## Maintainer Notes

Maintainers should use 2FA for:

- GitHub
- Chrome Web Store developer account
- domain/DNS provider, if any

Do not add network access, analytics, or broad host permissions without updating the privacy policy and documenting the reason.
