# Zephyr Mods

Community mod registry for [Zephyr](https://github.com/Prismo-Studio/Zephyr).

This repo hosts the metadata for every community mod that shows up in the Zephyr Mods source. Binaries themselves live on each mod author's GitHub Releases — we just keep a verified pointer to them.

## Submit a mod

```bash
git clone https://github.com/Prismo-Studio/zephyr-mods.git
cd zephyr-mods
pnpm install
pnpm new-mod
```

The wizard will ask a handful of questions, fetch your repo's README, icon and latest GitHub release automatically, compute the SHA-256 of the asset and write everything in the right place. You then push and open a PR.

## Publish a new version

```bash
pnpm new-version <game>/<author>/<slug>
# example
pnpm new-version repo/johndoe/better-inventory
```

The wizard pulls the latest release from your source repo, computes the new hash, updates `mod.json`, writes a new `versions/X.Y.Z.json` and appends to the `CHANGELOG.md`.

## Manual edits

Anything the wizard does, you can do by hand — just keep the schema valid:

```
mods/
└── <game-slug>/
    └── <github-username>/
        └── <mod-slug>/
            ├── mod.json
            ├── icon.png            (256x256 png)
            ├── README.md
            ├── CHANGELOG.md
            └── versions/
                └── 1.0.0.json
```

Run `pnpm validate` before pushing — CI runs the same script.

## Security

- Asset URLs **must** point at GitHub Releases of the declared `repository`. Anything else is rejected by CI.
- Every version file ships a SHA-256. Zephyr verifies the hash after download and refuses to install on mismatch.
- A mod folder under `mods/<game>/<author>/...` can only be modified by PRs from `<author>` (or Prismo-Studio admins). Enforced by CI.

## License

[GPL-3.0](LICENSE) for this registry. Each mod retains its own license.
