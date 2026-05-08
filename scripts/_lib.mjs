// Shared helpers for wizard scripts.
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** GitHub games supported by Zephyr — fetched fresh from the main repo so we
 *  don't go stale. Falls back to a small static list if offline. */
const GAMES_URL =
	'https://raw.githubusercontent.com/Prismo-Studio/Zephyr/master/src-tauri/games.json';
const FALLBACK_GAMES = [
	{ slug: 'lethal-company', name: 'Lethal Company' },
	{ slug: 'repo', name: 'R.E.P.O.' },
	{ slug: 'risk-of-rain-2', name: 'Risk of Rain 2' },
	{ slug: 'valheim', name: 'Valheim' },
	{ slug: 'h3vr', name: 'H3VR' },
	{ slug: 'northstar', name: 'Northstar' }
];

export async function fetchSupportedGames() {
	try {
		const res = await fetch(GAMES_URL, { headers: { Accept: 'application/json' } });
		if (!res.ok) throw new Error(`status ${res.status}`);
		const data = await res.json();
		const list = Array.isArray(data) ? data : Array.isArray(data.games) ? data.games : null;
		if (!list) throw new Error('Unexpected shape');
		return list
			.map((g) => ({ slug: g.slug, name: g.name }))
			.filter((g) => g.slug && g.name);
	} catch (err) {
		console.warn(`[zephyr-mods] could not fetch games list (${err.message}), using fallback`);
		return FALLBACK_GAMES;
	}
}

/** Slugify a free-form name. */
export function slugify(name) {
	return name
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/** Parse an HTTPS GitHub URL into { owner, repo }. */
export function parseGithubUrl(url) {
	const m = url.match(/^https:\/\/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/);
	if (!m) return null;
	return { owner: m[1], repo: m[2] };
}

/** Fetch JSON from GitHub API with optional token from env. */
export async function ghJson(path) {
	const headers = { Accept: 'application/vnd.github+json' };
	if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
	const res = await fetch(`https://api.github.com${path}`, { headers });
	if (!res.ok) {
		throw new Error(`GitHub API ${path} returned ${res.status} ${res.statusText}`);
	}
	return res.json();
}

/** Fetch a binary asset and compute size + sha256 in one pass. */
export async function downloadAndHash(url) {
	const res = await fetch(url, { redirect: 'follow' });
	if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
	const buf = Buffer.from(await res.arrayBuffer());
	const sha256 = createHash('sha256').update(buf).digest('hex');
	return { buffer: buf, sha256, size: buf.length };
}

/** Download a small text file, return as string. */
export async function fetchText(url) {
	const res = await fetch(url);
	if (!res.ok) return null;
	return res.text();
}

/** Write JSON formatted with tabs (matches the rest of the repo). */
export function writeJson(filePath, data) {
	mkdirSync(dirname(filePath), { recursive: true });
	writeFileSync(filePath, JSON.stringify(data, null, '\t') + '\n');
}

/** Read JSON. */
export function readJson(filePath) {
	return JSON.parse(readFileSync(filePath, 'utf8'));
}

export function modDir(game, author, slug) {
	return resolve(ROOT, 'mods', game, author, slug);
}

export function modExists(game, author, slug) {
	return existsSync(resolve(modDir(game, author, slug), 'mod.json'));
}

/** Pick the asset that looks like a primary mod artifact (.dll / .zip). */
export function pickPrimaryAsset(assets) {
	if (!Array.isArray(assets) || assets.length === 0) return null;
	const score = (a) => {
		const n = (a.name || '').toLowerCase();
		if (n.endsWith('.dll')) return 100;
		if (n.endsWith('.zip')) return 80;
		if (n.endsWith('.jar')) return 70;
		if (n.endsWith('.tar.gz') || n.endsWith('.tgz')) return 50;
		return 0;
	};
	return [...assets].sort((a, b) => score(b) - score(a))[0] || null;
}
