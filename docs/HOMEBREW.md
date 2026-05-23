# Homebrew Distribution

Query is distributed through Homebrew as a cask because the release artifact is
a signed and notarized macOS `.app` inside a `.dmg`.

## Tap

The current tap is:

```bash
brew tap wsoule/tap
brew install --cask wsoule/tap/query
```

Tap repository:

```text
https://github.com/wsoule/homebrew-tap
```

Source repository:

```text
https://github.com/wsoule/Query
```

## Release Flow

The release workflow in `.github/workflows/release.yml` publishes Query to the
tap when a `v*` tag is pushed.

For each release, the workflow:

1. Creates a draft GitHub release.
2. Builds macOS artifacts for Apple Silicon and Intel.
3. Signs and notarizes the macOS DMGs.
4. Builds Windows and Linux artifacts.
5. Publishes the GitHub release.
6. Downloads the signed macOS DMGs.
7. Computes SHA256 checksums.
8. Writes `Casks/query.rb` in `wsoule/homebrew-tap`.
9. Commits and pushes the cask update.

## Required GitHub Secrets

Set these on `wsoule/Query` under:

```text
Settings -> Secrets and variables -> Actions
```

Required:

```text
APPLE_CERTIFICATE
APPLE_CERTIFICATE_PASSWORD
KEYCHAIN_PASSWORD
APPLE_SIGNING_IDENTITY
APPLE_ID
APPLE_PASSWORD
APPLE_TEAM_ID
HOMEBREW_TAP_TOKEN
```

Optional, only needed for Tauri in-app updates:

```text
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

`HOMEBREW_TAP_TOKEN` should be a fine-grained GitHub personal access token with
read/write Contents access to `wsoule/homebrew-tap`.

## Manual Cask Shape

CI generates this file automatically after a release exists:

```text
Casks/query.rb
```

The generated cask has this shape:

```ruby
cask "query" do
  arch arm: "aarch64", intel: "x64"

  version "0.1.0"
  sha256 arm:   "ARM64_SHA256",
         intel: "X64_SHA256"

  url "https://github.com/wsoule/Query/releases/download/v#{version}/Query_#{version}_#{arch}.dmg",
      verified: "github.com/wsoule/Query/"
  name "Query"
  desc "Modern SQL database client with git-friendly saved queries"
  homepage "https://github.com/wsoule/Query"

  livecheck do
    url :url
    strategy :github_latest
  end

  depends_on macos: ">= :monterey"

  app "Query.app"

  zap trash: [
    "~/.query",
    "~/Library/Application Support/com.brassraven.query",
    "~/Library/Caches/com.brassraven.query",
    "~/Library/Preferences/com.brassraven.query.plist",
    "~/Library/Saved Application State/com.brassraven.query.savedState",
    "~/Library/HTTPStorages/com.brassraven.query",
    "~/Library/WebKit/com.brassraven.query",
  ]
end
```

Do not commit placeholder checksums. Commit the cask only after the release DMGs
exist and the real SHA256 values are known.

## Local Verification

Before tagging:

```bash
bun run build
cargo build --manifest-path src-tauri/Cargo.toml
```

After CI publishes the release and tap update:

```bash
brew tap wsoule/tap
brew install --cask wsoule/tap/query
spctl --assess --type execute -vv /Applications/Query.app
codesign --verify --strict --deep --verbose=2 /Applications/Query.app
```

## Release Checklist

1. Update versions in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.
2. Commit the version bump.
3. Tag the release, for example `git tag v0.1.0`.
4. Push `main` and tags with `git push origin main --tags`.
5. Wait for the release workflow to finish.
6. Pull `wsoule/homebrew-tap` and verify `Casks/query.rb`.
7. Install with `brew install --cask wsoule/tap/query`.
