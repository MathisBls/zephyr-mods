// Ensures a PR only modifies mods/<game>/<author>/... folders where <author>
// matches the PR's GitHub login. Prismo-Studio members can override.
import { execSync } from 'node:child_process';

const PR_AUTHOR = (process.env.PR_AUTHOR || '').toLowerCase();
const PRISMO_MEMBERS = ['mathisbls', 'thefable1']; // extend as the team grows

const baseSha = execSync('git merge-base HEAD origin/master', { encoding: 'utf8' }).trim();
const diff = execSync(`git diff --name-only ${baseSha}...HEAD`, { encoding: 'utf8' });
const files = diff.split('\n').filter(Boolean);

const isAdmin = PRISMO_MEMBERS.includes(PR_AUTHOR);
if (isAdmin) {
	console.log(`PR author "${PR_AUTHOR}" is an admin — ownership check skipped.`);
	process.exit(0);
}

const violations = [];
for (const f of files) {
	if (!f.startsWith('mods/')) continue;
	const parts = f.split('/');
	if (parts.length < 4) continue;
	const author = parts[2].toLowerCase();
	if (author !== PR_AUTHOR) {
		violations.push({ file: f, author, prAuthor: PR_AUTHOR });
	}
}

if (violations.length) {
	console.error('\n✗ Ownership violation:\n');
	for (const v of violations) {
		console.error(`  ${v.file}`);
		console.error(`    folder author: "${v.author}", PR author: "${v.prAuthor}"`);
	}
	console.error(
		'\n  Mods can only be edited by their author (matching GitHub username) or Prismo-Studio admins.\n'
	);
	process.exit(1);
}

console.log('✓ Ownership check passed.');
