# KIDE API — End-to-End Test Plan

Post security refactor (`9ec3608`) and the master-workflow update: every app
route requires a Bearer token and scopes data downward through `reports_to`.

This plan covers the full master workflow:

```
Admin → SM → ASM → BDE
```

- Admin creates the **single SM**.
- The SM creates **7 regional ASMs** (2 exclusive districts each) plus **1 Office Team**.
- The ASM creates **unlimited BDEs**.
- The SM assigns tasks to the **8 teams**; the ASM assigns tasks to **its BDEs**.
- Every closed admission credits **₹1,000** to the closing BDE.
- Withdrawals are **max ₹5,000**, approved **BDE → ASM → SM → Admin**.

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

## 9. Tasks, teams, operations

Task ownership follows the master workflow: the **SM assigns tasks to the 8
teams**, each **ASM assigns tasks to its BDEs**, the **BDE updates its own
progress**, and the **Admin is read-only**.

| # | Method | Path | Who | Body / Query | Expected |
|---|---|---|---|---|---|
| 9.1 | GET | `/api/tasks` | BDE | — | `200`, only tasks assigned to BDE001 |
| 9.2 | GET | `/api/tasks` | ASM / SM | — | `200`, own subtree |
| 9.3 | GET | `/api/tasks?assigned_to=Sanu%20Jaison` | BDE | — | `403` |
| 9.4 | GET | `/api/tasks?mine=1` | employee | — | `200`, only tasks assigned to the caller |
| 9.5 | POST | `/api/tasks` | SM | `{ "title": "Verify EKM reports", "team": "EKM Team", "priority": "high", "target_count": 25 }` | `201`, assignee is the team lead (ASM001) |
| 9.6 | POST | `/api/tasks` | SM | `{ "title": "Monthly review", "assigned_to": "ASM001" }` | `201` |
| 9.7 | POST | `/api/tasks` | ASM | `{ "title": "Call 10 leads", "assigned_to": "BDE001", "target_count": 10 }` | `201`, `assigned_by_role: "ASM"` |
| 9.8 | POST | `/api/tasks` | ASM | `{ "title": "x", "assigned_to": "SM001" }` | `403` (not a direct report) |
| 9.9 | POST | `/api/tasks` | ASM | `{ "title": "x", "team": "EKM Team" }` | `403` (only SM assigns teams) |
| 9.10 | POST | `/api/tasks` | BDE | `{ "title": "x", "assigned_to": "BDE001" }` | `403` |
| 9.11 | POST | `/api/tasks` | admin | `{ "title": "x", "assigned_to": "BDE001" }` | `403` (admin read-only) |
| 9.12 | POST | `/api/tasks` | SM | `{ "assigned_to": "ASM001" }` (no title) | `400` |
| 9.13 | PUT | `/api/tasks` | creator (SM/ASM) | `{ "id": "<task>", "priority": "medium", "notes": "Reviewed" }` | `200` |
| 9.14 | PUT | `/api/tasks` | BDE assignee | `{ "id": "<own task>", "status": "in_progress", "completed_count": 3, "notes": "Called 3" }` | `200` |
| 9.15 | PUT | `/api/tasks` | BDE assignee | `{ "id": "<own task>", "assigned_to": "BDE002" }` | `403` (assignee may only change status/count/notes) |
| 9.16 | PUT | `/api/tasks` | BDE | `{ "id": "<someone else's task>", "status": "completed" }` | `403` |
| 9.17 | PUT | `/api/tasks` | employee | `{ "id": "<task>", "priority": "urgent" }` | `400` (low / medium / high only) |
| 9.18 | DELETE | `/api/tasks?id=<task>` | creator / manager | — | `200` |
| 9.19 | DELETE | `/api/tasks?id=<task>` | BDE assignee | — | `403` (only creator/manager deletes) |
| 9.20 | GET | `/api/teams` | SM | — | `200`, the teams led by its ASMs |
| 9.21 | GET | `/api/teams` | ASM / BDE | — | `200`, own team only |
| 9.22 | GET | `/api/teams` | admin | — | `200`, all 8 teams |
| 9.23 | GET | `/api/team` | BDE | — | `200`, `members: []` |
| 9.24 | GET | `/api/team` | ASM | — | `200`, 1 member (BDE001) |
| 9.25 | GET | `/api/team?scope=all` | SM | — | `200`, 2 members |
| 9.26 | GET | `/api/operations` | employee | — | `200`; admin `403` |

`GET /api/tasks` returns
`{ success, count, data: { total, completed, pending, tasks, list } }` where
`list` is the same array as `tasks`.

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

## 11. Wallet & salary (4-step approval)

Withdrawal chain: **BDE → ASM → SM → Admin**. Every dashboard reads the shared
`status_label`: `Pending`, `Approved`, `Paid`, `Rejected`. Admin `sanction`
releases the money; `pay` only records the transaction.

| # | Method | Path | Who | Body / Query | Expected |
|---|---|---|---|---|---|
| 11.1 | GET | `/api/wallet/balance` | BDE | — | `200`, own wallet + own requests only |
| 11.2 | GET | `/api/wallet/balance?employee_id=BDE001` | another employee | — | query ignored, own data only |
| 11.3 | GET | `/api/wallet/balance` | admin | no `employee_id` | `400` (`?employee_id=` or `?employee=` required) |
| 11.4 | GET | `/api/wallet/balance?employee_id=BDE001` | admin | — | `200`, that employee's wallet |
| 11.5 | POST | `/api/wallet/withdraw` | BDE | `{ "amount": 500, "upi_id": "x@upi", "remarks": "Test" }` | `200`, `status: "Submitted to ASM"`, wallet debited |
| 11.6 | POST | `/api/wallet/withdraw` | employee | `{ "amount": 0 }` | `400` |
| 11.7 | POST | `/api/wallet/withdraw` | employee | `{ "amount": 6000 }` | `400` (max ₹5,000 per request) |
| 11.8 | POST | `/api/wallet/withdraw` | employee | `{ "amount": <balance + 1> }` | `400` insufficient balance |
| 11.9 | GET | `/api/wallet/requests` | BDE | — | `200`, own requests + `status_label` |
| 11.10 | GET | `/api/wallet/requests` | ASM | — | `200`, requests from direct BDEs only |
| 11.11 | GET | `/api/wallet/requests?status=pending` | SM | — | `200`, only `status_label: "Pending"` |
| 11.12 | GET | `/api/wallet/requests` | admin | — | `200`, every request |
| 11.13 | POST | `/api/wallet/workflow` | ASM | `{ "request_id": "<id>", "action": "forward_to_sm" }` | `200`, `status_label: "Pending"` |
| 11.14 | POST | `/api/wallet/workflow` | SM | `{ "request_id": "<id>", "action": "forward_to_accounts" }` | `200`, `Forwarded to Accounts` |
| 11.15 | POST | `/api/wallet/workflow` | admin | `{ "request_id": "<id>", "action": "sanction" }` | `200`, `status_label: "Approved"`, `total_paid` incremented |
| 11.16 | POST | `/api/wallet/workflow` | admin | `{ "request_id": "<id>", "action": "pay", "transaction_reference": "TXN-1" }` | `200`, `status_label: "Paid"`, no double credit |
| 11.17 | POST | `/api/wallet/workflow` | BDE | `{ "request_id": "<id>", "action": "forward_to_sm" }` | `403` |
| 11.18 | POST | `/api/wallet/workflow` | ASM | `{ "request_id": "<id>", "action": "sanction" }` | `403` (admin only) |
| 11.19 | POST | `/api/wallet/workflow` | SM | `{ "request_id": "<id>", "action": "forward_to_accounts" }` before ASM forwards | `400` (out-of-order transition) |
| 11.20 | POST | `/api/wallet/workflow` | ASM / SM | `{ "request_id": "<id>", "action": "reject" }` | `200`, `Rejected`, amount refunded to wallet |
| 11.21 | GET | `/api/salary/requests` | BDE | — | `200`, own only + `status_label` |
| 11.22 | GET | `/api/salary/requests` | ASM / SM | — | `200`, own subtree |
| 11.23 | POST | `/api/salary/request` | employee | `{ "amount": 5000, "period": "2026-11" }` | `200`, `Submitted to ASM` |
| 11.24 | POST | `/api/salary/request` | employee | duplicate period | `400` |
| 11.25 | POST | `/api/salary/workflow` | ASM | `{ "request_id": "<id>", "action": "forward_to_sm" }` | `200` |
| 11.26 | POST | `/api/salary/workflow` | SM | `{ "request_id": "<id>", "action": "forward_to_accounts" }` | `200` |
| 11.27 | POST | `/api/salary/workflow` | admin | `{ "request_id": "<id>", "action": "sanction" }` | `200`, `Approved` |
| 11.28 | POST | `/api/salary/workflow` | BDE | `{ "action": "forward_to_sm" }` | `403` |

Workflow actions: `forward_to_sm`, `asm_approve` (ASM/BDM/SM/ADMIN),
`forward_to_accounts`, `sm_approve` (SM/ADMIN), `sanction`, `approve`,
`accounts_approve`, `pay`, `mark_paid` (ADMIN), `reject` (ASM/BDM/SM/ADMIN).
Only one step at a time is allowed; `Approved` is terminal except for
`pay` / `mark_paid`.

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

## 13. Hierarchy management (Admin → SM → ASM → BDE)

| # | Method | Path | Who | Body / Query | Expected |
|---|---|---|---|---|---|
| 13.1 | GET | `/api/admin/create-sm` | admin | — | `200`, `exists: true`, the single SM |
| 13.2 | POST | `/api/admin/create-sm` | admin | `{ "name": "SM Two", "password": "test1234" }` while an SM exists | `400` (only one SM allowed) |
| 13.3 | POST | `/api/admin/create-sm` | employee | — | `403` |
| 13.4 | POST | `/api/admin/employees` | admin | a second employee with designation `Sales Manager` | `400` (single-SM guard) |
| 13.5 | GET | `/api/sm/asms` | SM | — | `200`, its ASMs |
| 13.6 | GET | `/api/sm/asms` | admin | — | `200`, all ASMs |
| 13.7 | GET | `/api/sm/asms` | ASM / BDE | — | `403` |
| 13.8 | GET | `/api/sm/asms/ASM001` | SM | — | `200`; another SM's ASM `404` |
| 13.9 | POST | `/api/sm/create-asm` | SM | `{ "name": "Test ASM", "email": "t@kide.com", "password": "test1234", "team_code": "TVM" }` | `201`, ASM001… assigned TVM Team |
| 13.10 | POST | `/api/sm/create-asm` | SM | same `team_code: "TVM"` again | `400` (team already has an ASM) |
| 13.11 | POST | `/api/sm/create-asm` | SM | a district already owned by another team | `400` (district exclusivity) |
| 13.12 | POST | `/api/sm/create-asm` | SM | `{ "team_code": "OFFICE" }` | `201`, the one Office Team (no districts) |
| 13.13 | POST | `/api/sm/create-asm` | SM | `{ "team_code": "OFFICE" }` again | `400` (Office Team already exists) |
| 13.14 | POST | `/api/sm/create-asm` | SM | `{ "team_code": "ZZZ" }` | `400` invalid team code |
| 13.15 | POST | `/api/sm/create-asm` | admin / ASM / BDE | — | `403` |
| 13.16 | GET | `/api/asm/bdes` | ASM | — | `200`, its BDEs only |
| 13.17 | GET | `/api/asm/bdes` | SM | — | `200`, subtree BDEs |
| 13.18 | GET | `/api/asm/bdes` | admin | — | `200`, all |
| 13.19 | GET | `/api/asm/bdes` | BDE | — | `403` |
| 13.20 | GET | `/api/asm/bdes/BDE001` | ASM | — | `200` |
| 13.21 | POST | `/api/asm/create-bde` | ASM | `{ "name": "Test BDE", "email": "tb@kide.com", "password": "test1234", "district": "Ernakulam" }` | `201`, under ASM001 |
| 13.22 | POST | `/api/asm/create-bde` | ASM | `{ "name": "Test BDE 2", "district": "Kollam" }` (not in the ASM's team) | `400` district not in team |
| 13.23 | POST | `/api/asm/create-bde` | ASM | duplicate name / email | `400` |
| 13.24 | POST | `/api/asm/create-bde` | SM | `{ "name": "Test BDE 3", "asm_id": "ASM001" }` | `201`; without `asm_id` `400` |
| 13.25 | POST | `/api/asm/create-bde` | SM | `{ "asm_id": "<ASM outside subtree>" }` | `403` |
| 13.26 | POST | `/api/asm/create-bde` | BDE | — | `403` |

Canonical teams: `TVM`, `PTM`, `KTM`, `EKM`, `PKD`, `CLT`, `KZD` (alias `KZE`)
plus `OFFICE`. Each regional team owns exactly 2 districts, and a district can
belong to only one team.

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
| 15.8 | GET | `/api/admin/activities` | — | `200` (`/api/admin/activity-logs` returns `400`) |
| 15.9 | GET | `/api/admin/incentives` | — | `200` |
| 15.10 | GET | `/api/admin/salary-requests` | — | `200` |
| 15.11 | GET | `/api/admin/create-sm` | — | `200`, `exists: true/false` |
| 15.12 | POST | `/api/admin/create-sm` | `{ "name": "...", "password": "..." }` | `201` only when no SM exists, else `400` |
| 15.13 | POST | `/api/admin/leads` | `{ ...lead fields }` | `201` |
| 15.14 | PUT | `/api/admin/leads` | `{ "id": "<id>", ... }` | `200` |
| 15.15 | DELETE | `/api/admin/leads?id=<id>` | — | `200` |
| 15.16 | POST | `/api/admin/leads/create` | `{ "name": "...", "phone": "...", "employee_id": "BDE001" }` | `201`; employee token `403` |
| 15.17 | GET | `/api/admin/stats` | `?zone=&district=` | `200` |
| 15.18 | GET | `/api/admin/:tab` | any tab in the model map | `200` |
| 15.19 | POST | `/api/admin/:tab` | tab-specific body | `201` |
| 15.20 | PUT | `/api/admin/:tab` | `{ "id": "...", ... }` | `200` |
| 15.21 | DELETE | `/api/admin/:tab?id=<id>` | — | `200` |
| 15.22 | POST | `/api/admin/tasks` | `{ "title": "Admin task", "assigned_to": "BDE001" }` | `403` (admin is read-only for tasks) |
| 15.23 | PUT | `/api/admin/tasks` | `{ "id": "<task>" }` | `403` |
| 15.24 | DELETE | `/api/admin/tasks?id=<task>` | — | `403` |
| 15.25 | GET | `/api/employee-tasks` | `?search=` | `200` |
| 15.26 | POST | `/api/employee-tasks` | `{ employee, task_template, period_start, period_end, total_target }` | `201` |
| 15.27 | PUT | `/api/employee-tasks` | `{ id, achieved, total_target }` | `200` |
| 15.28 | DELETE | `/api/employee-tasks?id=<id>` | — | `200` |
| 15.29 | GET | `/api/task-templates` | `?search=` | `200` |
| 15.30 | POST | `/api/task-templates` | `{ title, metric_type, designation, frequency, target_count }` | `201` |
| 15.31 | PUT | `/api/task-templates` | `{ id, ... }` | `200` |
| 15.32 | DELETE | `/api/task-templates?id=<id>` | — | `200` |
| 15.33 | POST | `/api/task-templates/generate` | `{ "template_ids": ["<id>"] }` | `200` |
| 15.34 | GET | `/api/seed` | — | `200` (idempotent seed) |
| 15.35 | GET | `/api/test` | — | `200`, DB connection status |

`/api/admin/:tab` model keys: `leads`, `employees`, `attendance`,
`attendanceRecords`, `zones`, `districts`, `courses`, `designations`, `teams`,
`tasks` (read-only), `taskTemplates`/`task-templates`,
`employeeTasks`/`employee-tasks`, `wallets`, `walletWithdrawRequests`,
`incentives`, `salaryRequests`/`salary-requests`, `leaves`, `activities`/`activityLogs`,
`roles`, `settings`.

---

## 16. Security negative tests (must all fail)

| # | Request | Expected |
|---|---|---|
| 16.1 | `GET /api/home` no token | `401` |
| 16.2 | `GET /api/leads` no token | `401` |
| 16.3 | `GET /api/leaves` no token | `401` |
| 16.4 | `GET /api/tasks` no token | `401` |
| 16.5 | `GET /api/teams` no token | `401` |
| 16.6 | `GET /api/wallet/requests` no token | `401` |
| 16.7 | `GET /api/attendance/history` no token | `401` |
| 16.8 | `GET /api/wallet/balance` no token | `401` |
| 16.9 | `GET /api/sm/asms` no token | `401` |
| 16.10 | `GET /api/asm/bdes` no token | `401` |
| 16.11 | `GET /api/zones` no token | `401` |
| 16.12 | `POST /api/set-password` no token | `401` |
| 16.13 | `GET /api/seed` no token | `401` |
| 16.14 | `GET /api/test` no token | `401` |
| 16.15 | `GET /api/admin/employees` no token | `401` |
| 16.16 | `POST /api/sm/create-asm` as ASM | `403` |
| 16.17 | `POST /api/sm/create-asm` as admin | `403` |
| 16.18 | `POST /api/asm/create-bde` as BDE | `403` |
| 16.19 | `GET /api/sm/asms` as ASM | `403` |
| 16.20 | `GET /api/asm/bdes` as BDE | `403` |
| 16.21 | `POST /api/attendance/check-in` as admin | `403` |
| 16.22 | `GET /api/home` as admin | `403` |
| 16.23 | `POST /api/tasks` as admin | `403` |
| 16.24 | `POST /api/admin/tasks` as admin | `403` |
| 16.25 | `POST /api/tasks` as BDE | `403` |
| 16.26 | `PUT /api/tasks` as BDE reassigning own task | `403` |
| 16.27 | `GET /api/leads?lead_id=LD-7310` as BDE | `403` |
| 16.28 | `DELETE /api/leads?id=LD-7310` as BDE | `403` |
| 16.29 | `POST /api/leads/create` as BDE with `employee: "Sanu Jaison"` | lead assigned to BDE001, not SM001 |
| 16.30 | `GET /api/incentives?bde_id=BDE999` as BDE | own data only |
| 16.31 | `POST /api/auth/refresh-token` with garbage token | `401` |

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
