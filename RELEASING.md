# Releasing Query

This repo cuts signed + notarized macOS builds and publishes them through a Homebrew tap whenever a `v*` tag is pushed. The workflow is `.github/workflows/release.yml`.

## TL;DR

```bash
# 1. Bump version in src-tauri/tauri.conf.json and src-tauri/Cargo.toml
# 2. Commit + tag
git commit -am "release v0.2.0"
git tag v0.2.0
git push origin main --tags
# 3. Wait for CI — release lands on GitHub + cask bumps in wsoule/homebrew-tap
brew install --cask wsoule/tap/query
```

## What CI does

For every `v*` tag push:

1. **Creates a draft GitHub release** named "Query v{version}".
2. **Builds for macOS** on both arches (`aarch64-apple-darwin` on `macos-latest`, `x86_64-apple-darwin` on `macos-13`). The build is **signed** with a Developer ID Application certificate and **notarized** through `tauri-action`'s built-in `xcrun notarytool` call.
3. **Builds for Windows + Linux** (unsigned).
4. **Publishes the release** (un-drafts it).
5. **Updates `wsoule/homebrew-tap`**:
   - Downloads the two signed DMGs from the just-published release.
   - Verifies Gatekeeper acceptance via `spctl --assess`.
   - Computes SHA256 sums.
   - Writes a fresh `Casks/query.rb`.
   - Commits and pushes.

## GitHub secrets required

| Secret | What it is |
| --- | --- |
| `APPLE_CERTIFICATE` | Base64-encoded `.p12` of your "Developer ID Application" cert. Export from Keychain Access → right-click cert → Export → set a password. Then `base64 < cert.p12 \| pbcopy`. |
| `APPLE_CERTIFICATE_PASSWORD` | The password you set when exporting the `.p12`. |
| `KEYCHAIN_PASSWORD` | Any string — used to lock the temporary build keychain. Just pick a random value. |
| `APPLE_SIGNING_IDENTITY` | The exact identity string, e.g. `Developer ID Application: Your Name (TEAM123ABC)`. Find via `security find-identity -v -p codesigning`. |
| `APPLE_ID` | Your Apple ID email. |
| `APPLE_PASSWORD` | An **app-specific password** for `notarytool` ([generate here](https://appleid.apple.com/account/manage)). Not your regular Apple ID password. |
| `APPLE_TEAM_ID` | Your 10-character Apple Developer Team ID. |
| `TAURI_SIGNING_PRIVATE_KEY` | Tauri updater signing key (optional — only needed for in-app updates). Generate with `bun tauri signer generate -w`. |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Passphrase for the updater key. |
| `HOMEBREW_TAP_TOKEN` | A PAT with `repo` write scope to `wsoule/homebrew-tap`. Fine-grained PAT scoped to that one repo is preferred. |

Set them under **Settings → Secrets and variables → Actions** on the GitHub repo.

## Local sanity-check before tagging

```bash
# Frontend + Rust compile
bun run build && cargo build --manifest-path src-tauri/Cargo.toml

# Full Tauri build with current local signing identity
bun run tauri build
```

The local `tauri.conf.json` hardcodes a `signingIdentity` SHA. CI overrides it via the `APPLE_SIGNING_IDENTITY` env var, so the two paths don't conflict.

## Verifying a release locally

```bash
brew tap wsoule/tap
brew install --cask query

# Verify the installed bundle is signed + notarized
spctl --assess --type execute -vv /Applications/Query.app
codesign --verify --strict --deep --verbose=2 /Applications/Query.app
```

## Troubleshooting

- **"No identity found" in the Import cert step** — your `.p12` may be missing the private key. Re-export including the private key.
- **Notarization step times out or rejects** — `xcrun notarytool log <submission-id>` for details. Common causes: hardened runtime not enabled (Tauri does this by default), entitlements missing, or app sandboxed without the right entitlements.
- **Gatekeeper assess step fails in CI** — the DMG built but notarization didn't staple. Look at the tauri-action logs for the notarytool output.
- **Tap push fails with 403** — `HOMEBREW_TAP_TOKEN` lacks write access to `wsoule/homebrew-tap` or is expired.
