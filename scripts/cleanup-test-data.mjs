/**
 * One-off cleanup of employee + transactional test data.
 *
 * Deletes:
 *   employees, employeetasks, leads, attendances, leaves, wallets,
 *   walletwithdrawrequests, tasks (legacy), activitylogs
 *
 * Keeps (master/config data):
 *   users (admin logins), designations, teams, zones, districts, courses,
 *   institutes, tasktemplates, roles, settings, articles, breakingnews, videos
 *
 * A JSON backup of every deleted document is written before anything is
 * removed, so the cleanup can be reversed.
 *
 * Usage:
 *   node scripts/cleanup-test-data.mjs --dry-run
 *   node scripts/cleanup-test-data.mjs
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const mongoose = require('mongoose');

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line && !line.trim().startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [
          line.slice(0, index).trim(),
          line.slice(index + 1).trim().replace(/^["']|["']$/g, ''),
        ];
      })
  );
}

const env = loadEnv();
const uri = process.env.MONGODB_URL || env.MONGODB_URL;
if (!uri) {
  console.error('MONGODB_URL is not set (checked the environment and .env).');
  process.exit(1);
}

const dryRun = process.argv.includes('--dry-run');

const WIPE = [
  'employees',
  'employeetasks',
  'leads',
  'attendances',
  'leaves',
  'wallets',
  'walletwithdrawrequests',
  'tasks',
  'activitylogs',
];

const KEEP = [
  'users',
  'designations',
  'teams',
  'zones',
  'districts',
  'courses',
  'institutes',
  'tasktemplates',
  'roles',
  'settings',
  'articles',
  'breakingnews',
  'videos',
];

await mongoose.connect(uri);
const db = mongoose.connection.db;

const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));

console.log('=== WIPE ===');
const counts = {};
for (const name of WIPE) {
  if (!existing.has(name)) {
    counts[name] = 0;
    console.log(`  ${name.padEnd(24)} (collection does not exist)`);
    continue;
  }
  counts[name] = await db.collection(name).countDocuments();
  console.log(`  ${name.padEnd(24)} ${counts[name]}`);
}

console.log('\n=== KEEP ===');
for (const name of KEEP) {
  if (!existing.has(name)) continue;
  const count = await db.collection(name).countDocuments();
  console.log(`  ${name.padEnd(24)} ${count}`);
}

const totalToDelete = Object.values(counts).reduce((sum, value) => sum + value, 0);

if (dryRun) {
  console.log(`\nDRY RUN — would delete ${totalToDelete} document(s). Nothing written.`);
  await mongoose.disconnect();
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Backup first
// ---------------------------------------------------------------------------
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(process.env.TEMP || '.', 'opencode', 'cleanup-backups');
fs.mkdirSync(backupDir, { recursive: true });
const backupPath = path.join(backupDir, `cleanup-${stamp}.json`);

const backup = {};
for (const name of WIPE) {
  if (!existing.has(name) || counts[name] === 0) continue;
  backup[name] = await db.collection(name).find({}).toArray();
}

fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8');
console.log(`\nBackup written to: ${backupPath}`);

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------
let deleted = 0;
for (const name of WIPE) {
  if (!existing.has(name) || counts[name] === 0) continue;
  const result = await db.collection(name).deleteMany({});
  deleted += result.deletedCount || 0;
  console.log(`  deleted ${String(result.deletedCount || 0).padStart(3)} from ${name}`);
}

console.log(`\nCleanup complete — ${deleted} document(s) deleted.`);

// Verify master data is still intact
console.log('\n=== AFTER ===');
for (const name of KEEP) {
  if (!existing.has(name)) continue;
  const count = await db.collection(name).countDocuments();
  console.log(`  ${name.padEnd(24)} ${count}`);
}

await mongoose.disconnect();
