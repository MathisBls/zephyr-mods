#!/usr/bin/env node
// Publish a new release of an existing mod. Usage: pnpm new-version <game>/<author>/<slug>
import { confirm, input } from '@inquirer/prompts';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	parseGithubUrl,
	ghJson,
	downloadAndHash,
	pickPrimaryAsset,
	modDir,
	readJson,
	writeJson
} from './_lib.mjs';

async function main() {
	const target = process.argv[2];
	if (!target) {
		console.error('Usage: pnpm new-version <game>/<author>/<slug>');
		console.error('Example: pnpm new-version repo/johndoe/better-inventory');
		process.exit(1);
	}
	const parts = target.split('/');
	if (parts.length !== 3) {
		console.error('Format: <game>/<author>/<slug>');
		process.exit(1);
	}
	const [game, author, slug] = parts;

	const dir = modDir(game, author, slug);
	const modJsonPath = resolve(dir, 'mod.json');
	if (!existsSync(modJsonPath)) {
		console.error(`✗ ${target} not found. Use \`pnpm new-mod\` to create a new mod first.`);
		process.exit(1);
	}
	const modJson = readJson(modJsonPath);

	const parsed = parseGithubUrl(modJson.repository);
	if (!parsed) {
		console.error(`✗ Invalid repository in mod.json: ${modJson.repository}`);
		process.exit(1);
	}
	const { owner, repo } = parsed;

	console.log(`\n  Publishing new version for ${target}\n`);
	console.log(`  Source repo: ${modJson.repository}`);
	console.log(`  Currently published: v${modJson.latest}\n`);

	// Fetch latest release
	let release;
	try {
		release = await ghJson(`/repos/${owner}/${repo}/releases/latest`);
	} catch (err) {
		console.error(`✗ Could not fetch latest release: ${err.message}`);
		process.exit(1);
	}

	const tag = release.tag_name;
	const version = (tag.startsWith('v') ? tag.slice(1) : tag).match(/^\d+\.\d+\.\d+/)?.[0];
	if (!version) {
		console.error(`✗ Tag '${tag}' is not semver`);
		process.exit(1);
	}

	if (version === modJson.latest) {
		console.log(`  Latest GitHub release (${tag}) matches what's already published.`);
		const force = await confirm({ message: 'Re-process anyway?', default: false });
		if (!force) process.exit(0);
	}

	const versionPath = resolve(dir, 'versions', `${version}.json`);
	if (existsSync(versionPath)) {
		console.error(`✗ versions/${version}.json already exists.`);
		process.exit(1);
	}

	const asset = pickPrimaryAsset(release.assets);
	if (!asset) {
		console.error('✗ Release has no .dll / .zip / .jar asset');
		process.exit(1);
	}
	console.log(`  ✓ Tag ${tag} → version ${version}`);
	console.log(`  ✓ Asset: ${asset.name} (${(asset.size / 1024).toFixed(1)} KB)`);

	console.log('  Computing SHA-256...');
	const { sha256 } = await downloadAndHash(asset.browser_download_url);
	console.log(`  ✓ SHA-256: ${sha256.slice(0, 16)}...`);

	const ok = await confirm({ message: 'Write the new version?', default: true });
	if (!ok) process.exit(0);

	const versionJson = {
		version,
		released: release.published_at || release.created_at || new Date().toISOString(),
		url: asset.browser_download_url,
		sha256,
		size: asset.size,
		...(release.body ? { changelog: release.body.slice(0, 4000) } : {})
	};
	writeJson(versionPath, versionJson);

	// Bump latest
	modJson.latest = version;
	writeJson(modJsonPath, modJson);

	// Update changelog
	if (release.body) {
		const cl = resolve(dir, 'CHANGELOG.md');
		const existing = existsSync(cl) ? readFileSync(cl, 'utf8') : '# Changelog\n\n';
		const entry = `## ${version}\n\n${release.body}\n\n`;
		// Inject right after the title
		const updated = existing.replace(/^(# Changelog\s*\n+)/, `$1${entry}`);
		writeFileSync(cl, updated.endsWith('\n') ? updated : updated + '\n');
	}

	console.log(`\n  ✓ Published ${target} v${version}`);
	console.log('\n  Next steps:');
	console.log(`    git checkout -b ${slug}-${version}`);
	console.log(`    git add mods/${game}/${author}/${slug}/`);
	console.log(`    git commit -m "Update ${modJson.name} to ${version}"`);
	console.log('    gh pr create');
}

main().catch((err) => {
	console.error('\n  ✗ Wizard failed:', err.message || err);
	process.exit(1);
});
