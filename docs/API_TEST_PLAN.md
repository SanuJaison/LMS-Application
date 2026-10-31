# KIDE API — End-to-End Test Plan

Post security refactor (commit `9ec3608`). Every app route now requires a
Bearer token and scopes data downward through `reports_to`.

## 1. Environments & accounts

| | URL |
|---|---|
| Local | `http://localhost:3000` |
| Production | `https://lms-application-pi.vercel.app` |

| Role | Login field | Identifier | Password |
|---|---|---|---|
| Admin | `email` | `admin@kide.com` | `password123` |
| SM | `employee_id` or `email` | `SM001` | `password123` |
| ASM | `employee_id` or `email` | `ASM001` | `password123` |
| BDE | `employee_id` or `email` | `BDE001` | `password123` |

Current hierarchy (both environments share the same MongoDB):

```
SM001 (Sanu)
└── ASM001 (Bipin Joseph)
    └── BDE001 (Vishnu Mohan)
```

Current data: 5 leads — 4 under BDE001, 1 under SM001.

## 2. Get a token

```http
POST /api/login
Content-Type: application/json

{ "employee_id": "BDE001", "password": "password123" }
```

Admin:

```http
POST /api/login
Content-Type: application/json

{ "email": "admin@kide.com", "password": "password123" }
```

Both return `{ "success": true, "token": "...", "user": { ... } }`.

Send the token on every other call:

```
Authorization: Bearer <token>
Content-Type: application/json
```

## 3. Global expected status codes

| Situation | Status |
|---|---|
| No / invalid / expired token | `401` |
| Valid token, wrong role | `403` |
| Valid token, record outside hierarchy | `403` |
| Missing required body field | `400` |
| Record not found | `404` |
| Success | `200` (create `201`) |

---

## 4. Auth & session

| # | Method | Path | Who | Body / Query | Expected |
|---|---|---|---|---|---|
| 4.1 | POST | `/api/login` | public | `{ employee_id/email, password }` | `200` + token; wrong password `401` |
| 4.2 | POST | `/api/logout` | public | — | `200` |
| 4.3 | POST | `/api/register` | public | — | `403` self-registration disabled |
| 4.4 | POST | `/api/auth/refresh-token` | valid token | — | `200` + new token |
| 4.5 | POST | `/api/auth/refresh-token` | invalid token | `{ "token": "garbage" }` | `401` |
| 4.6 | GET | `/api/profile` | employee | — | `200` own profile |
| 4.7 | GET | `/api/auth/me` | employee | — | same as 4.6 |
| 4.8 | GET | `/api/profile` | admin token | — | `403` employee token required |
| 4.9 | POST | `/api/employee/change-password` | employee | `{ current_password, new_password }` | `200`; wrong current `401`; `<6` chars `400` |
| 4.10 | POST | `/api/set-password` | admin only | `{ employee_id, password }` | `200`; no admin auth `401` |

> 4.9 / 4.10 change real passwords. Use a throwaway BDE created via 9.7, or
> reset with `/api/set-password` as admin afterwards.

---

## 5. Dashboard

| # | Method | Path | Who | Expected |
|---|---|---|---|---|
| 5.1 | GET | `/api/home` | BDE | `200`, `dashboard_type: "bde"`, `scope.visible_employees: 1`, `assigned_leads: 4` |
| 5.2 | GET | `/api/home` | ASM | `200`, `"asm"`, `visible_employees: 2`, 1 BDE |
| 5.3 | GET | `/api/home` | SM | `200`, `"sm"`, `visible_employees: 3` |
| 5.4 | GET | `/api/home` | admin | `403` (employee-only) |
| 5.5 | GET | `/api/home` | none | `401` |

---

## 6. Leads

| # | Method | Path | Who | Body / Query | Expected |
|---|---|---|---|---|---|
| 6.1 | GET | `/api/leads` | BDE | — | `200`, `count: 4` |
| 6.2 | GET | `/api/leads` | ASM | — | `200`, `count: 4` |
| 6.3 | GET | `/api/leads` | SM | — | `200`, `count: 5` |
| 6.4 | GET | `/api/leads` | admin | — | `200`, `count: 5` |
| 6.5 | GET | `/api/leads?lead_id=LD-7310` | SM | — | `200` own lead |
| 6.6 | GET | `/api/leads?lead_id=LD-7310` | BDE / ASM | — | `403` outside hierarchy |
| 6.7 | GET | `/api/leads?employee=Sanu%20Jaison` | BDE | — | `403` |
| 6.8 | GET | `/api/leads?search=Sanu` | BDE | — | `200`, only own matches |
| 6.9 | POST | `/api/leads` | BDE | `{ "name": "Test A", "contact_number": "9000000001", "employee": "Sanu Jaison" }` | `201`, forced to **Vishnu Mohan / BDE001** |
| 6.10 | POST | `/api/leads` | admin | `{ "name": "Test B", "contact_number": "9000000002", "employee_id": "BDE001" }` | `201` |
| 6.11 | POST | `/api/leads` | admin | no `employee` | `400` assigned employee required |
| 6.12 | PUT | `/api/leads` | BDE | `{ "lead_id": "<own>", "remarks": "updated" }` | `200` |
| 6.13 | PUT | `/api/leads` | BDE | `{ "lead_id": "LD-7310", "remarks": "x" }` | `403` |
| 6.14 | DELETE | `/api/leads?id=<own>` | BDE | — | `200` |
| 6.15 | DELETE | `/api/leads?id=LD-7310` | BDE | — | `403` |
| 6.16 | POST | `/api/leads/create` | employee | `{ "name": "Test C", "phone": "9000000003" }` | `201`, assigned to caller |
| 6.17 | GET | `/api/leads/create` | any token | — | `200` schema guide + own recent leads |
| 6.18 | GET | `/api/leads/next-student-id` | any token | — | `200`, `student_id: "STU-xxx"` |
| 6.19 | POST | `/api/leads/import` | employee | multipart `file` = CSV, or JSON `{ "csv": "name,phone\nA,9000000004" }` | `200`, rows assigned to caller |
| 6.20 | POST | `/api/leads/import` | admin | JSON `{ "csv": "...", "employee_id": "BDE001" }` | `200` |
| 6.21 | POST | `/api/leads/:id/followup` | BDE | `{ "remarks": "Called", "next_followup_date": "2026-11-05" }` | `200` on own lead; `403` outside |
| 6.22 | POST | `/api/leads/:id/follow-up` | BDE | same | alias of 6.21 |
| 6.23 | POST | `/api/leads/:id/close` | BDE | `{ "student_id": "<lead.student_id>" }` | `200`, ₹1000 credited; wrong student id `400` |
| 6.24 | POST | `/api/leads/:id/close` | BDE | lead outside hierarchy | `403` |

> `:id` accepts the Mongo `_id`, the numeric app id, or `lead_id` (`LD-xxxx`).

---

## 7. Follow-up pipeline

| # | Method | Path | Who | Body / Query | Expected |
|---|---|---|---|---|---|
| 7.1 | GET | `/api/followups` | BDE | — | `200`, only own leads |
| 7.2 | GET | `/api/followups` | ASM / SM | — | `200`, own subtree |
| 7.3 | GET | `/api/followups?lead_id=LD-7310` | BDE | — | `403` |
| 7.4 | GET | `/api/followups?due=overdue` | BDE | — | `200`, scoped |
| 7.5 | POST | `/api/followups` | BDE | `{ "lead_id": "<own>", "remarks": "Discussed fees" }` | `200` |
| 7.6 | POST | `/api/followups` | BDE | `{ "lead_id": "LD-7310", "remarks": "x" }` | `403` |
| 7.7 | POST | `/api/followups` | BDE | `{ "lead_id": "<own>" }` | `400` remarks required |

---

## 8. Attendance

| # | Method | Path | Who | Body / Query | Expected |
|---|---|---|---|---|---|
| 8.1 | GET | `/api/attendance` | employee | — | `200`, own today + recent |
| 8.2 | GET | `/api/attendance/status` | employee | — | `200`, own status |
| 8.3 | POST | `/api/attendance/check-in` | employee | `{ "latitude": 10.0159, "longitude": 76.3419, "address": "Kochi" }` | `200` |
| 8.4 | POST | `/api/attendance/check-out` | employee | `{ "notes": "Done" }` | `200`, `status: "OFFLINE"` |
| 8.5 | GET | `/api/attendance/history` | BDE | — | `200`, own records only |
| 8.6 | GET | `/api/attendance/history` | ASM | — | `200`, self + BDE001 |
| 8.7 | GET | `/api/attendance/history` | SM | — | `200`, whole subtree |
| 8.8 | GET | `/api/attendance/history` | admin | — | `200`, all |
| 8.9 | GET | `/api/attendance/history?employee_id=SM001` | BDE | — | `403` |
| 8.10 | GET | `/api/attendance/history?month=2026-10` | any token | — | `200`, scoped + filtered |
| 8.11 | POST | `/api/attendance/check-in` | admin | — | `403` employee token required |

---

## 9. Tasks, team, operations

| # | Method | Path | Who | Body / Query | Expected |
|---|---|---|---|---|---|
| 9.1 | GET | `/api/tasks` | BDE | — | `200`, own tasks |
| 9.2 | GET | `/api/tasks` | ASM / SM | — | `200`, own subtree |
| 9.3 | GET | `/api/tasks?assigned_to=Sanu%20Jaison` | BDE | — | `403` |
| 9.4 | GET | `/api/team` | BDE | — | `200`, `members: []` |
| 9.5 | GET | `/api/team` | ASM | — | `200`, 1 member (BDE001) |
| 9.6 | GET | `/api/team?scope=all` | SM | — | `200`, 2 members |
| 9.7 | GET | `/api/operations` | employee | — | `200`; admin `403` |

---

## 10. Leaves

| # | Method | Path | Who | Body / Query | Expected |
|---|---|---|---|---|---|
| 10.1 | GET | `/api/leaves` | BDE | — | `200`, own leaves |
| 10.2 | GET | `/api/leaves` | ASM / SM | — | `200`, own subtree |
| 10.3 | GET | `/api/leaves?employee=Sanu%20Jaison` | BDE | — | `403` |
| 10.4 | POST | `/api/leaves/apply` | employee | `{ "leave_type": "Casual Leave", "start_date": "2026-11-10", "end_date": "2026-11-11", "reason": "Test" }` | `201` / `200` |
| 10.5 | POST | `/api/leaves/apply` | admin | — | `403` |

---

## 11. Wallet & salary

| # | Method | Path | Who | Body / Query | Expected |
|---|---|---|---|---|---|
| 11.1 | GET | `/api/wallet/balance` | BDE | — | `200`, own wallet + own requests only |
| 11.2 | GET | `/api/wallet/balance?employee_id=BDE001` | another employee | — | ignored / own data only |
| 11.3 | POST | `/api/wallet/withdraw` | employee | `{ "amount": 100, "upi_id": "x@upi", "remarks": "Test" }` | `200` request created for caller |
| 11.4 | POST | `/api/wallet/withdraw` | employee | `{ "amount": 0 }` | `400` |
| 11.5 | POST | `/api/wallet/workflow` | ASM | `{ "request_id": "<id>", "action": "forward_to_sm" }` | `200` |
| 11.6 | POST | `/api/wallet/workflow` | BDE | `{ "request_id": "<id>", "action": "forward_to_sm" }` | `403` |
| 11.7 | POST | `/api/wallet/workflow` | ASM | `{ "action": "sanction" }` | `403` (admin only) |
| 11.8 | GET | `/api/salary/requests` | BDE | — | `200`, own only |
| 11.9 | GET | `/api/salary/requests` | ASM / SM | — | `200`, own subtree |
| 11.10 | POST | `/api/salary/request` | employee | `{ "amount": 5000, "period": "2026-10" }` | `200` |
| 11.11 | POST | `/api/salary/workflow` | SM | `{ "request_id": "<id>", "action": "forward_to_accounts" }` | `200` |
| 11.12 | POST | `/api/salary/workflow` | BDE | `{ "action": "forward_to_sm" }` | `403` |

Workflow actions: `forward_to_sm`, `asm_approve` (ASM/BDM/SM/ADMIN),
`forward_to_accounts`, `sm_approve` (SM/ADMIN), `sanction`, `approve`,
`accounts_approve`, `pay`, `mark_paid` (ADMIN), `reject` (ASM/BDM/SM/ADMIN).

---

## 12. Incentives

| # | Method | Path | Who | Expected |
|---|---|---|---|---|
| 12.1 | GET | `/api/incentives` | BDE | `200`, own only |
| 12.2 | GET | `/api/incentives?bde_id=BDE999` | BDE | override ignored, still own (`count: 0`) |
| 12.3 | GET | `/api/incentives?asm_id=ASM001` | ASM | own subtree only |
| 12.4 | GET | `/api/incentives?team=Other` | ASM | team override ignored |
| 12.5 | GET | `/api/incentives` | SM / admin | subtree / all |

---

## 13. Hierarchy management

| # | Method | Path | Who | Body / Query | Expected |
|---|---|---|---|---|---|
| 13.1 | GET | `/api/sm/asms` | SM | — | `200`, `count: 1` |
| 13.2 | GET | `/api/sm/asms` | admin | — | `200`, all ASMs |
| 13.3 | GET | `/api/sm/asms` | ASM / BDE | — | `403` |
| 13.4 | GET | `/api/sm/asms/ASM001` | SM | — | `200`; another SM's ASM `404`/`403` |
| 13.5 | POST | `/api/sm/create-asm` | SM | `{ "name": "Test ASM", "email": "t@kide.com", "password": "test1234", "team_code": "TVM" }` | `201` |
| 13.6 | POST | `/api/sm/create-asm` | ASM / BDE | — | `403` |
| 13.7 | GET | `/api/asm/bdes` | ASM | — | `200`, `count: 1` |
| 13.8 | GET | `/api/asm/bdes` | SM | — | `200`, subtree BDEs |
| 13.9 | GET | `/api/asm/bdes` | admin | — | `200`, all |
| 13.10 | GET | `/api/asm/bdes` | BDE | — | `403` |
| 13.11 | GET | `/api/asm/bdes/BDE001` | ASM | — | `200` |
| 13.12 | POST | `/api/asm/create-bde` | ASM | `{ "name": "Test BDE", "password": "test1234", "asm_id": "ASM999" }` | `201`, forced under ASM001 |
| 13.13 | POST | `/api/asm/create-bde` | SM | `{ "name": "Test BDE 2", "asm_id": "ASM001" }` | `201`; without `asm_id` `400` |
| 13.14 | POST | `/api/asm/create-bde` | BDE | — | `403` |
| 13.15 | POST | `/api/asm/create-bde` | SM | `{ "asm_id": "<ASM outside subtree>" }` | `403` |

Clean up test accounts with `DELETE /api/admin/employees?id=<mongo id>` and
`DELETE /api/admin/wallets?id=<mongo id>` (admin token).

---

## 14. Catalog & reference data

Read endpoints — **any valid token**, no token `401`:

| # | Method | Path | Query |
|---|---|---|---|
| 14.1 | GET | `/api/zones` | — |
| 14.2 | GET | `/api/districts` | `?search=` |
| 14.3 | GET | `/api/districts/:id` | — |
| 14.4 | GET | `/api/designations` | `?search=` |
| 14.5 | GET | `/api/designations/:id` | — |
| 14.6 | GET | `/api/courses` | `?search=` |
| 14.7 | GET | `/api/courses/:id` | — |
| 14.8 | GET | `/api/sources` | — (8 sources) |
| 14.9 | GET | `/api/hierarchy/filters` | zones + districts + designations + teams |
| 14.10 | GET | `/api/institutes` | `?district=&search=` |
| 14.11 | POST | `/api/institutes` | `{ "name": "Test College", "district": "Ernakulam" }` (any valid token) |

Mutations — **admin only** (employee token → `403`, no token → `401`):

| # | Method | Path | Body |
|---|---|---|---|
| 14.12 | POST | `/api/zones` | `{ "name": "Test Zone", "description": "..." }` |
| 14.13 | POST | `/api/districts` | `{ "name": "Test District", "zone": "Central Zone" }` |
| 14.14 | PUT | `/api/districts` | `{ "id": "<id>", "name": "...", "zone": "..." }` |
| 14.15 | DELETE | `/api/districts?id=<id>` | — |
| 14.16 | PUT | `/api/districts/:id` | `{ "name": "...", "zone": "..." }` |
| 14.17 | DELETE | `/api/districts/:id` | — |
| 14.18 | POST | `/api/designations` | `{ "name": "Test Desig", "prefix": "TST" }` |
| 14.19 | PUT | `/api/designations` | `{ "id": "<id>", "name": "...", "prefix": "..." }` |
| 14.20 | DELETE | `/api/designations?id=<id>` | — |
| 14.21 | PUT | `/api/designations/:id` | `{ "name": "...", "prefix": "..." }` |
| 14.22 | DELETE | `/api/designations/:id` | — |
| 14.23 | POST | `/api/courses` | `{ "name": "Test Course" }` |
| 14.24 | PUT | `/api/courses` | `{ "id": "<id>", "name": "..." }` |
| 14.25 | DELETE | `/api/courses?id=<id>` | — |
| 14.26 | PUT | `/api/courses/:id` | `{ "name": "..." }` |
| 14.27 | DELETE | `/api/courses/:id` | — |
| 14.28 | DELETE | `/api/institutes/:id` | — |

---

## 15. Admin panel

All require `Authorization: Bearer <admin token>` or `x-admin-key`.

| # | Method | Path | Body / Query | Expected |
|---|---|---|---|---|
| 15.1 | GET | `/api/admin/employees` | — | `200` all employees |
| 15.2 | GET | `/api/admin/leads` | `?search=&page=` | `200` all leads |
| 15.3 | GET | `/api/admin/teams` | — | `200` |
| 15.4 | GET | `/api/admin/wallets` | — | `200` |
| 15.5 | GET | `/api/admin/attendance` | — | `200` |
| 15.6 | GET | `/api/admin/leaves` | — | `200` |
| 15.7 | GET | `/api/admin/wallet-withdraw-requests` | — | `200` |
| 15.8 | GET | `/api/admin/activity-logs` | — | `200` |
| 15.9 | POST | `/api/admin/leads` | `{ ...lead fields }` | `201` |
| 15.10 | PUT | `/api/admin/leads` | `{ "id": "<id>", ... }` | `200` |
| 15.11 | DELETE | `/api/admin/leads?id=<id>` | — | `200` |
| 15.12 | POST | `/api/admin/leads/create` | `{ "name": "...", "phone": "...", "employee_id": "BDE001" }` | `201`; employee token `403` |
| 15.13 | GET | `/api/admin/stats` | `?zone=&district=` | `200` |
| 15.14 | GET | `/api/admin/:tab` | any tab in the model map | `200` |
| 15.15 | POST | `/api/admin/:tab` | tab-specific body | `201` |
| 15.16 | PUT | `/api/admin/:tab` | `{ "id": "...", ... }` | `200` |
| 15.17 | DELETE | `/api/admin/:tab?id=<id>` | — | `200` |
| 15.18 | GET | `/api/employee-tasks` | `?search=` | `200` |
| 15.19 | POST | `/api/employee-tasks` | `{ employee, task_template, period_start, period_end, total_target }` | `201` |
| 15.20 | PUT | `/api/employee-tasks` | `{ id, achieved, total_target }` | `200` |
| 15.21 | DELETE | `/api/employee-tasks?id=<id>` | — | `200` |
| 15.22 | GET | `/api/task-templates` | `?search=` | `200` |
| 15.23 | POST | `/api/task-templates` | `{ title, metric_type, designation, frequency, target_count }` | `201` |
| 15.24 | PUT | `/api/task-templates` | `{ id, ... }` | `200` |
| 15.25 | DELETE | `/api/task-templates?id=<id>` | — | `200` |
| 15.26 | POST | `/api/task-templates/generate` | `{ "template_ids": ["<id>"] }` | `200` |
| 15.27 | GET | `/api/seed` | — | `200` (idempotent seed) |
| 15.28 | GET | `/api/test` | — | `200`, DB connection status |

`/api/admin/:tab` model keys: `leads`, `employees`, `attendance`,
`attendanceRecords`, `zones`, `districts`, `courses`, `designations`, `teams`,
`tasks`, `taskTemplates`/`task-templates`, `employeeTasks`/`employee-tasks`,
`wallets`/`wallet`, `walletWithdrawRequests`, `leaves`, `activityLogs`,
`roles`, `settings`.

---

## 16. Security negative tests (must all fail)

| # | Request | Expected |
|---|---|---|
| 16.1 | `GET /api/home` no token | `401` |
| 16.2 | `GET /api/leads` no token | `401` |
| 16.3 | `GET /api/leaves` no token | `401` |
| 16.4 | `GET /api/tasks` no token | `401` |
| 16.5 | `GET /api/attendance/history` no token | `401` |
| 16.6 | `GET /api/wallet/balance` no token | `401` |
| 16.7 | `GET /api/sm/asms` no token | `401` |
| 16.8 | `GET /api/asm/bdes` no token | `401` |
| 16.9 | `GET /api/zones` no token | `401` |
| 16.10 | `POST /api/set-password` no token | `401` |
| 16.11 | `GET /api/seed` no token | `401` |
| 16.12 | `GET /api/test` no token | `401` |
| 16.13 | `GET /api/admin/employees` no token | `401` |
| 16.14 | `POST /api/sm/create-asm` as ASM | `403` |
| 16.15 | `POST /api/asm/create-bde` as BDE | `403` |
| 16.16 | `GET /api/sm/asms` as ASM | `403` |
| 16.17 | `GET /api/asm/bdes` as BDE | `403` |
| 16.18 | `POST /api/attendance/check-in` as admin | `403` |
| 16.19 | `GET /api/home` as admin | `403` |
| 16.20 | `GET /api/leads?lead_id=LD-7310` as BDE | `403` |
| 16.21 | `DELETE /api/leads?id=LD-7310` as BDE | `403` |
| 16.22 | `POST /api/leads/create` as BDE with `employee: "Sanu Jaison"` | lead assigned to BDE001, not SM001 |
| 16.23 | `GET /api/incentives?bde_id=BDE999` as BDE | own data only |
| 16.24 | `POST /api/auth/refresh-token` with garbage token | `401` |

---

## 17. Quick PowerShell smoke test

```powershell
$base = 'http://localhost:3000'   # or https://lms-application-pi.vercel.app

function Login($id, $pw) {
  $b = @{ employee_id = $id; email = $id; password = $pw } | ConvertTo-Json
  (Invoke-RestMethod "$base/api/login" -Method Post -ContentType 'application/json' -Body $b).token
}

function Call($method, $path, $token, $body) {
  $h = @{ Authorization = "Bearer $token" }
  $p = @{ Uri = "$base$path"; Method = $method; Headers = $h; UseBasicParsing = $true }
  if ($body) { $p.ContentType = 'application/json'; $p.Body = ($body | ConvertTo-Json -Depth 8) }
  try {
    $r = Invoke-WebRequest @p
    "$($r.StatusCode) $($r.Content.Substring(0, [Math]::Min(160, $r.Content.Length)))"
  } catch {
    $resp = $_.Exception.Response
    $code = if ($resp) { [int]$resp.StatusCode } else { 0 }
    "$code $($_.ErrorDetails.Message)"
  }
}

$bde = Login 'BDE001' 'password123'
$asm = Login 'ASM001' 'password123'
$sm  = Login 'SM001'  'password123'
$adm = Login 'admin@kide.com' 'password123'

Call 'GET' '/api/home'      $bde
Call 'GET' '/api/leads'     $bde
Call 'GET' '/api/leads'     $sm
Call 'GET' '/api/sm/asms'   $asm
Call 'GET' '/api/asm/bdes'  $asm
Call 'GET' '/api/admin/stats' $adm
Call 'GET' '/api/leads'     ''
```
