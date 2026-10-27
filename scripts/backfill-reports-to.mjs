/**
 * One-time backfill for the employee reporting hierarchy.
 *
 *   BDE  -> reports_to = a BDM in the same team (or zone)
 *   BDM  -> reports_to = an ASM in the same team (or zone)
 *
 * The manager is only written when `reports_to` is currently empty, so the
 * script is safe to re-run and never overwrites a value set in the admin UI.
 *
 * Usage:
 *   node scripts/backfill-reports-to.mjs --dry-run
 *   node scripts/backfill-reports-to.mjs
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const mongoose = require('mongoose');

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return {};
  const text = fs.readFileSync(envPath, 'utf8');
  return Object.fromEntries(
    text
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

function suffix(employeeId) {
  const match = String(employeeId || '').match(/(\d+)\s*$/);
  return match ? Number(match[1]) : 0;
}

function roleOf(employee) {
  const id = String(employee.employee_id || '').trim().toUpperCase();
  const designation = String(employee.designation || '').trim().toLowerCase();

  if (id.startsWith('ASM') || designation.includes('area sales manager')) return 'ASM';
  if (
    id.startsWith('BDM') ||
    designation.includes('business development manager') ||
    designation.includes('bussiness development manager') ||
    designation.includes('bussinss development manager')
  ) {
    return 'BDM';
  }
  if (id.startsWith('BDE') || designation.includes('business development executive')) return 'BDE';
  if (id.startsWith('SM') || designation.includes('sales manager')) return 'SM';
  if (id.startsWith('MD') || designation.includes('managing director')) return 'MD';
  return 'OTHER';
}

function same(a, b) {
  return Boolean(a && b) && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

const dryRun = process.argv.includes('--dry-run');

await mongoose.connect(uri);
const db = mongoose.connection.db;
const employees = await db.collection('employees').find({}).toArray();

const active = employees.filter(
  (employee) => String(employee.status || '').toLowerCase() !== 'inactive'
);

const byRole = { ASM: [], BDM: [], BDE: [], SM: [], MD: [], OTHER: [] };
for (const employee of active) {
  byRole[roleOf(employee)].push(employee);
}

function bdmScore(employee) {
  const designation = String(employee.designation || '').toLowerCase();
  const managerBonus = designation.includes('manager') ? 1000 : 0;
  return managerBonus + suffix(employee.employee_id);
}

function pickManager(employee, managerRole) {
  const pool = byRole[managerRole].filter(
    (candidate) => String(candidate._id) !== String(employee._id)
  );
  if (pool.length === 0) return null;

  const sameTeam = pool.filter((candidate) => same(candidate.team, employee.team));
  const sameZone = pool.filter((candidate) => same(candidate.zone, employee.zone));
  const candidates = sameTeam.length > 0 ? sameTeam : sameZone;
  if (candidates.length === 0) return null;

  if (managerRole === 'BDM') {
    // Prefer the BDM whose designation actually says "manager", then the
    // highest numeric suffix (the most recently created account).
    return [...candidates].sort((a, b) => bdmScore(b) - bdmScore(a))[0];
  }

  // ASM: prefer the lowest numeric suffix (the primary/oldest account).
  return [...candidates].sort(
    (a, b) => suffix(a.employee_id) - suffix(b.employee_id)
  )[0];
}

const planned = [];
for (const employee of active) {
  const role = roleOf(employee);
  const managerRole = role === 'BDE' ? 'BDM' : role === 'BDM' || role === 'SM' ? 'ASM' : null;
  if (!managerRole) continue;
  if (String(employee.reports_to || '').trim()) continue;

  const manager = pickManager(employee, managerRole);
  planned.push({ employee, role, manager });
}

for (const item of planned) {
  if (!item.manager || dryRun) continue;
  await db.collection('employees').updateOne(
    { _id: item.employee._id },
    { $set: { reports_to: item.manager.employee_id, updatedAt: new Date() } }
  );
}

console.log(dryRun ? 'DRY RUN — no changes written.' : 'Backfill complete.');
for (const item of planned) {
  if (item.manager) {
    console.log(
      `${item.employee.employee_id} (${item.employee.name}) -> ${item.manager.employee_id} (${item.manager.name})`
    );
  } else {
    console.log(
      `${item.employee.employee_id} (${item.employee.name}) -> no ${item.role === 'BDE' ? 'BDM' : 'ASM'} found in the same team/zone`
    );
  }
}

await mongoose.disconnect();
