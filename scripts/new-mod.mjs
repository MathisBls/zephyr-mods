#!/usr/bin/env node
// Interactive wizard for adding a new mod to the Zephyr registry.
import { input, search, checkbox, confirm } from '@inquirer/prompts';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	fetchSupportedGames,
	parseGithubUrl,
	ghJson,
	downloadAndHash,
	fetchText,
	pickPrimaryAsset,
	slugify,
	modDir,
	modExists,
	writeJson,
	ROOT
} from './_lib.mjs';

const CATEGORIES = [
	'gameplay',
	'cosmetic',
	'quality-of-life',
	'library',
	'audio',
	'visual',
	'server',
	'client',
	'tool',
	'misc'
];

async function main() {
	console.log('\n  Zephyr Mods — new mod wizard\n');

	// ---------- Game ----------
	const games = await fetchSupportedGames();
	const game = await search({
		message: 'Which game is this mod for?',
		source: async (input) => {
			const q = (input ?? '').toLowerCase();
			return games
				.filter((g) => !q || g.name.toLowerCase().includes(q) || g.slug.includes(q))
				.map((g) => ({ name: `${g.name}  (${g.slug})`, value: g.slug }));
		}
	});

	// ---------- Mod identity ----------
	const name = await input({
		message: 'Mod name (display name)',
		validate: (v) => v.trim().length >= 2 || 'Need at least 2 characters'
	});
	const slug = await input({
		message: 'Slug (URL identifier)',
		default: slugify(name),
		validate: (v) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) || 'Lowercase, dashes only'
	});
	const author = await input({
		message: 'Your GitHub username',
		validate: (v) =>
			/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38}[A-Za-z0-9])?$/.test(v) || 'Invalid GitHub username'
	});

	if (modExists(game, author, slug)) {
		console.error(`\n  ✗ mods/${game}/${author}/${slug} already exists.`);
		console.error('    Use `pnpm new-version` to publish a new release for an existing mod.');
		process.exit(1);
	}

	const description = await input({
		message: 'Short description (under 200 chars)',
		validate: (v) => (v.length >= 8 && v.length <= 200) || 'Between 8 and 200 chars'
	});

	// ---------- GitHub repo ----------
	const repoUrl = await input({
		message: 'GitHub repo URL (we will pull README, icon, releases automatically)',
		default: `https://github.com/${author}/${slug}`,
		validate: (v) => parseGithubUrl(v) !== null || 'Must be a valid github.com URL'
	});
	const { owner, repo } = parseGithubUrl(repoUrl);

	// ---------- Pull repo metadata ----------
	console.log('\n  Fetching repository metadata...');
	let repoMeta;
	try {
		repoMeta = await ghJson(`/repos/${owner}/${repo}`);
		console.log(`  ✓ Repo found (${repoMeta.stargazers_count} stars)`);
	} catch (err) {
		console.error(`  ✗ Could not fetch repo: ${err.message}`);
		process.exit(1);
	}

	// README
	const readme = await fetchText(
		`https://raw.githubusercontent.com/${owner}/${repo}/${repoMeta.default_branch}/README.md`
	);
	if (readme) console.log('  ✓ README.md fetched');
	else console.log('  ⚠  No README.md found in repo (you can add one manually later)');

	// Icon — try a few conventional paths
	const iconCandidates = [
		`https://raw.githubusercontent.com/${owner}/${repo}/${repoMeta.default_branch}/icon.png`,
		`https://raw.githubusercontent.com/${owner}/${repo}/${repoMeta.default_branch}/assets/icon.png`,
		`https://raw.githubusercontent.com/${owner}/${repo}/${repoMeta.default_branch}/.zephyr/icon.png`
	];
	let iconBuffer = null;
	for (const url of iconCandidates) {
		const res = await fetch(url);
		if (res.ok) {
			iconBuffer = Buffer.from(await res.arrayBuffer());
			console.log(`  ✓ Icon fetched from ${url.split(`${repo}/`).pop()}`);
			break;
		}
	}
	if (!iconBuffer) {
		console.log(
			'  ⚠  No icon.png found in repo at /icon.png, /assets/icon.png or /.zephyr/icon.png'
		);
		console.log('     Add a 256x256 icon.png to the mod folder before opening the PR.');
	}

	// Latest release
	let release;
	try {
		release = await ghJson(`/repos/${owner}/${repo}/releases/latest`);
		console.log(`  ✓ Latest release: ${release.tag_name}`);
	} catch (err) {
		console.error(`  ✗ No GitHub release found in ${owner}/${repo}`);
		console.error('    Create a GitHub release with your mod artifact attached, then re-run.');
		process.exit(1);
	}

	const asset = pickPrimaryAsset(release.assets);
	if (!asset) {
		console.error('  ✗ Release has no .dll / .zip / .jar asset');
		process.exit(1);
	}
	console.log(`  ✓ Asset: ${asset.name} (${(asset.size / 1024).toFixed(1)} KB)`);

	// Hash the asset
	console.log('  Computing SHA-256...');
	const { sha256 } = await downloadAndHash(asset.browser_download_url);
	console.log(`  ✓ SHA-256: ${sha256.slice(0, 16)}...`);

	// ---------- Categories ----------
	const categories = await checkbox({
		message: 'Categories (space to select, enter to confirm)',
		choices: CATEGORIES.map((c) => ({ name: c, value: c }))
	});

	// ---------- Confirm ----------
	const version = (release.tag_name.startsWith('v') ? release.tag_name.slice(1) : release.tag_name)
		.replace(/[^0-9.A-Za-z-]/g, '')
		.match(/^\d+\.\d+\.\d+/)?.[0];
	if (!version) {
		console.error(`  ✗ Tag '${release.tag_name}' does not parse as semver (e.g. 1.0.0)`);
		process.exit(1);
	}

	console.log('\n  Summary:');
	console.log(`    ${game}/${author}/${slug}  v${version}`);
	const ok = await confirm({ message: 'Create files?', default: true });
	if (!ok) process.exit(0);

	// ---------- Write files ----------
	const dir = modDir(game, author, slug);
	mkdirSync(dir, { recursive: true });

	const modJson = {
		name,
		slug,
		author,
		description,
		game,
		latest: version,
		repository: `https://github.com/${owner}/${repo}`,
		...(repoMeta.homepage ? { website: repoMeta.homepage } : {}),
		...(categories.length ? { categories } : {})
	};
	writeJson(resolve(dir, 'mod.json'), modJson);

	if (readme) writeFileSync(resolve(dir, 'README.md'), readme);
	if (iconBuffer) writeFileSync(resolve(dir, 'icon.png'), iconBuffer);

	const versionJson = {
		version,
		released: release.published_at || release.created_at || new Date().toISOString(),
		url: asset.browser_download_url,
		sha256,
		size: asset.size,
		...(release.body ? { changelog: release.body.slice(0, 4000) } : {})
	};
	writeJson(resolve(dir, 'versions', `${version}.json`), versionJson);

	if (release.body) {
		const changelog = `# Changelog\n\n## ${version}\n\n${release.body}\n`;
		writeFileSync(resolve(dir, 'CHANGELOG.md'), changelog);
	}

	console.log(`\n  ✓ Created mods/${game}/${author}/${slug}/`);
	console.log('    ├── mod.json');
	console.log(`    ├── icon.png${iconBuffer ? '' : '   ⚠  add this manually'}`);
	console.log(`    ├── README.md${readme ? '' : '   ⚠  add this manually'}`);
	console.log(`    ├── CHANGELOG.md${release.body ? '' : '   (none)'}`);
	console.log(`    └── versions/${version}.json`);
	console.log('\n  Next steps:');
	console.log(`    git checkout -b add-${slug}`);
	console.log('    git add mods/');
	console.log(`    git commit -m "Add ${name}"`);
	console.log('    gh pr create  (or push and open the PR on github.com)');
}

main().catch((err) => {
	console.error('\n  ✗ Wizard failed:', err.message || err);
	process.exit(1);
});
