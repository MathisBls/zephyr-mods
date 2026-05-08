#!/usr/bin/env node
// Walks mods/ and produces registry.json — the flat, fast-to-fetch index that
// Zephyr downloads at runtime. Runs in CI on every merge to main.
import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './_lib.mjs';

const MODS_DIR = resolve(ROOT, 'mods');

function listDirs(p) {
	if (!existsSync(p)) return [];
	return readdirSync(p).filter((f) => statSync(resolve(p, f)).isDirectory());
}

function readJsonOrNull(p) {
	try {
		return JSON.parse(readFileSync(p, 'utf8'));
	} catch {
		return null;
	}
}

function rawUrl(game, author, slug, file) {
	return `https://raw.githubusercontent.com/Prismo-Studio/zephyr-mods/main/mods/${game}/${author}/${slug}/${file}`;
}

const entries = [];
let totalVersions = 0;

for (const game of listDirs(MODS_DIR)) {
	for (const author of listDirs(resolve(MODS_DIR, game))) {
		for (const slug of listDirs(resolve(MODS_DIR, game, author))) {
			const dir = resolve(MODS_DIR, game, author, slug);
			const mod = readJsonOrNull(resolve(dir, 'mod.json'));
			if (!mod) continue;

			const versionsDir = resolve(dir, 'versions');
			const versions = [];
			if (existsSync(versionsDir)) {
				for (const f of readdirSync(versionsDir).filter((f) => f.endsWith('.json'))) {
					const v = readJsonOrNull(resolve(versionsDir, f));
					if (v) versions.push(v);
				}
			}
			versions.sort((a, b) => (a.released < b.released ? 1 : -1));
			totalVersions += versions.length;

			entries.push({
				name: mod.name,
				slug: mod.slug,
				author: mod.author,
				game: mod.game,
				description: mod.description,
				categories: mod.categories || [],
				dependencies: mod.dependencies || [],
				latest: mod.latest,
				repository: mod.repository,
				...(mod.website ? { website: mod.website } : {}),
				...(mod.donate ? { donate: mod.donate } : {}),
				...(mod.nsfw ? { nsfw: true } : {}),
				...(mod.deprecated ? { deprecated: true } : {}),
				icon: rawUrl(game, author, slug, 'icon.png'),
				readme: rawUrl(game, author, slug, 'README.md'),
				changelog: existsSync(resolve(dir, 'CHANGELOG.md'))
					? rawUrl(game, author, slug, 'CHANGELOG.md')
					: null,
				versions
			});
		}
	}
}

// Sort by latest release timestamp descending — easier to spot what's new
entries.sort((a, b) => {
	const at = a.versions[0]?.released || '';
	const bt = b.versions[0]?.released || '';
	return at < bt ? 1 : -1;
});

const registry = {
	$schema:
		'https://raw.githubusercontent.com/Prismo-Studio/zephyr-mods/main/schema/registry.schema.json',
	version: 1,
	generated: new Date().toISOString(),
	mods: entries
};

writeFileSync(resolve(ROOT, 'registry.json'), JSON.stringify(registry, null, '\t') + '\n');
console.log(`✓ registry.json written: ${entries.length} mods, ${totalVersions} versions`);
