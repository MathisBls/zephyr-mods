#!/usr/bin/env node
// Validates the entire mods/ tree. Run locally before opening a PR; CI runs the
// same script on every PR.
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { ROOT, parseGithubUrl } from './_lib.mjs';

const MODS_DIR = resolve(ROOT, 'mods');
const SCHEMA_DIR = resolve(ROOT, 'schema');

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const modSchema = JSON.parse(readFileSync(resolve(SCHEMA_DIR, 'mod.schema.json'), 'utf8'));
const versionSchema = JSON.parse(
	readFileSync(resolve(SCHEMA_DIR, 'version.schema.json'), 'utf8')
);
const validateMod = ajv.compile(modSchema);
const validateVersion = ajv.compile(versionSchema);

const errors = [];

function err(path, msg) {
	errors.push(`  ${path}: ${msg}`);
}

function listDirs(p) {
	if (!existsSync(p)) return [];
	return readdirSync(p).filter((f) => statSync(resolve(p, f)).isDirectory());
}

function validateOneMod(game, author, slug) {
	const dir = resolve(MODS_DIR, game, author, slug);
	const rel = `mods/${game}/${author}/${slug}`;
	const modJsonPath = resolve(dir, 'mod.json');

	if (!existsSync(modJsonPath)) {
		err(rel, 'missing mod.json');
		return;
	}

	let mod;
	try {
		mod = JSON.parse(readFileSync(modJsonPath, 'utf8'));
	} catch (e) {
		err(`${rel}/mod.json`, `invalid JSON: ${e.message}`);
		return;
	}

	if (!validateMod(mod)) {
		for (const e of validateMod.errors) {
			err(`${rel}/mod.json`, `${e.instancePath || '/'} ${e.message}`);
		}
	}

	// Cross-checks: file path must match mod.json fields
	if (mod.game !== game) err(rel, `mod.json/game="${mod.game}" doesn't match folder "${game}"`);
	if (mod.slug !== slug) err(rel, `mod.json/slug="${mod.slug}" doesn't match folder "${slug}"`);
	if (mod.author !== author) {
		err(rel, `mod.json/author="${mod.author}" doesn't match folder "${author}"`);
	}

	// Repo owner must match the author folder (ownership lock)
	const parsed = parseGithubUrl(mod.repository || '');
	if (parsed && parsed.owner.toLowerCase() !== author.toLowerCase()) {
		err(
			rel,
			`repository owner "${parsed.owner}" doesn't match author folder "${author}". ` +
				`Mods must live under the GitHub owner that publishes them.`
		);
	}

	// Required side files
	if (!existsSync(resolve(dir, 'icon.png'))) err(rel, 'missing icon.png');
	if (!existsSync(resolve(dir, 'README.md'))) err(rel, 'missing README.md');

	// Versions
	const versionsDir = resolve(dir, 'versions');
	if (!existsSync(versionsDir)) {
		err(rel, 'missing versions/ directory');
		return;
	}
	const versionFiles = readdirSync(versionsDir).filter((f) => f.endsWith('.json'));
	if (versionFiles.length === 0) {
		err(rel, 'no version files in versions/');
	}

	const versions = new Set();
	for (const f of versionFiles) {
		const vname = f.replace(/\.json$/, '');
		versions.add(vname);
		const vPath = resolve(versionsDir, f);
		let v;
		try {
			v = JSON.parse(readFileSync(vPath, 'utf8'));
		} catch (e) {
			err(`${rel}/versions/${f}`, `invalid JSON: ${e.message}`);
			continue;
		}
		if (!validateVersion(v)) {
			for (const e of validateVersion.errors) {
				err(`${rel}/versions/${f}`, `${e.instancePath || '/'} ${e.message}`);
			}
		}
		if (v.version !== vname) {
			err(`${rel}/versions/${f}`, `version="${v.version}" doesn't match filename`);
		}
		// URL must point to the same repo as mod.json
		if (parsed && v.url) {
			const expected = `https://github.com/${parsed.owner}/${parsed.repo}/releases/download/`;
			if (!v.url.startsWith(expected)) {
				err(
					`${rel}/versions/${f}`,
					`url must start with ${expected} (release of the declared repo)`
				);
			}
		}
	}

	// Latest must point to an existing version file
	if (mod.latest && !versions.has(mod.latest)) {
		err(rel, `latest="${mod.latest}" but versions/${mod.latest}.json doesn't exist`);
	}
}

function main() {
	const games = listDirs(MODS_DIR);
	let count = 0;
	for (const game of games) {
		for (const author of listDirs(resolve(MODS_DIR, game))) {
			for (const slug of listDirs(resolve(MODS_DIR, game, author))) {
				validateOneMod(game, author, slug);
				count++;
			}
		}
	}

	if (errors.length) {
		console.error(`\n  ✗ ${errors.length} validation error${errors.length > 1 ? 's' : ''}:\n`);
		for (const e of errors) console.error(e);
		process.exit(1);
	}

	console.log(`\n  ✓ ${count} mod${count !== 1 ? 's' : ''} validated, no errors.`);
}

main();
