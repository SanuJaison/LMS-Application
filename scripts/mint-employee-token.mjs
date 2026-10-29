/**
 * Mint an employee JWT so the mobile endpoints can be tested from Postman/curl
 * without the employee's password.
 *
 * Employees log in with an employee_id + password, and those passwords are
 * bcrypt hashes we cannot recover, so this script signs the same token that
 * POST /api/login would return for that employee.
 *
 * Usage:
 *   node scripts/mint-employee-token.mjs                 (defaults to BDE001)
 *   node scripts/mint-employee-token.mjs ASM001
 *   node scripts/mint-employee-token.mjs BDE001 --days 30
 *
 * The token is signed with JWT_SECRET from .env. Treat it as a password:
 * anyone holding it can act as that employee until it expires.
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

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
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      })
  );
}

const args = process.argv.slice(2);
const employeeId = (args.find((a) => !a.startsWith('--')) || 'BDE001').trim();
const daysIndex = args.indexOf('--days');
const days = daysIndex >= 0 ? parseInt(args[daysIndex + 1], 10) || 7 : 7;

const env = loadEnv();
const uri = env.MONGODB_URL;
const secret = env.JWT_SECRET || 'kide_kerala_crm_super_secret_jwt_key_2026';

if (!uri) {
  console.error('MONGODB_URL is missing from .env');
  process.exit(1);
}

await mongoose.connect(uri);
const db = mongoose.connection.db;

const employee = await db.collection('employees').findOne({
  employee_id: { $regex: `^${employeeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
});

if (!employee) {
  console.error(`No employee found with employee_id "${employeeId}"`);
  await mongoose.disconnect();
  process.exit(1);
}

const token = jwt.sign(
  {
    id: employee._id.toString(),
    name: employee.name,
    email: employee.email || '',
    role: 'employee',
  },
  secret,
  { expiresIn: `${days}d` }
);

const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

console.log(`Employee : ${employee.name} (${employee.employee_id})`);
console.log(`Expires  : ${expiresAt.toISOString()} (${days} days)`);
console.log(`Token    : ${token}`);

await mongoose.disconnect();
