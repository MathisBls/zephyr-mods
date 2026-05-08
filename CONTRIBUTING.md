# Contributing

## Quick path (recommended)

1. Fork this repo.
2. `pnpm install`
3. `pnpm new-mod` — interactive wizard.
4. `git checkout -b add-<your-mod-slug>`
5. `git add mods/`
6. `git commit -m "Add <ModName>"`
7. `gh pr create` (or push and open the PR on github.com).

## Requirements for your mod

- The mod source must live in a public GitHub repo owned by the same account you submit the PR from.
- Your mod artifact (`.dll`, `.zip` or similar) must be attached to a GitHub Release.
- You must have an `icon.png` (256x256, square) — either in the wizard-detected paths (`/icon.png`, `/assets/icon.png`, `/.zephyr/icon.png`) or copied manually into the mod folder before the PR.
- Your repo must have a `README.md`.

## What the wizard generates

```
mods/<game>/<author>/<slug>/
├── mod.json          ← display metadata
├── icon.png          ← copied from your repo
├── README.md         ← copied from your repo
├── CHANGELOG.md      ← built from your release notes
└── versions/
    └── X.Y.Z.json    ← SHA-256 + release URL for each version
```

## Updating to a new version

When you tag and release `vX.Y.Z` on your repo:

```bash
pnpm new-version <game>/<author>/<slug>
```

That writes a new `versions/X.Y.Z.json`, bumps `mod.json`, and adds the release notes to `CHANGELOG.md`. Open a PR.

## Things that will fail CI

- Missing `mod.json`, `icon.png`, `README.md`, or any version file.
- Folder structure that doesn't match `mod.json`'s `game` / `author` / `slug` fields.
- Asset URL that doesn't point at the declared `repository`'s GitHub Releases.
- A PR that touches another author's mod folder (ownership lock).
- An invalid SHA-256 (the registry value must match what's actually at the URL — re-run `pnpm new-version` if you re-uploaded the asset).

## Removing or deprecating your mod

Set `"deprecated": true` in `mod.json`. Zephyr keeps the entry browsable but won't recommend new installs. To fully remove, open a PR deleting the folder.
