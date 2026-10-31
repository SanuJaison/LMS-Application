# KIDE API Reference — by role (Postman-ready)

Base URL (production): `https://lms-application-pi.vercel.app`

Last updated: 2026-10-31 · commit `755ca04`

Every route below has been secured: a valid Bearer token is required and data is
scoped downward through `reports_to`.

| Role | Login | Password | Token variable |
|---|---|---|---|
| Admin | `admin@kide.com` (field `email`) | `password123` | `{{adminToken}}` |
| SM | `SM001` | `password123` | `{{smToken}}` |
| ASM | `ASM001` | `password123` | `{{asmToken}}` |
| BDE | `BDE001` | `password123` | `{{bdeToken}}` |

Hierarchy: `SM001 → ASM001 → BDE001`. Current data: 4 leads under BDE001,
1 lead under SM001.

---

## 0. Postman setup

Create a collection with these variables:

| Variable | Value |
|---|---|
| `baseUrl` | `https://lms-application-pi.vercel.app` |
| `adminToken` | (empty — filled by the Admin Login request) |
| `smToken` | (empty) |
| `asmToken` | (empty) |
| `bdeToken` | (empty) |
| `leadId` | `LD-2019` (a BDE001 lead — replace with a lead you create) |
| `studentId` | `STU-003` (student id of that lead) |
| `employeeMongoId` | (copy from `GET /api/admin/employees`) |
| `withdrawRequestId` | (from `POST /api/wallet/withdraw`) |
| `salaryRequestId` | (from `POST /api/salary/request`) |

An importable Postman collection with these folders and variables is at
`docs/postman/KIDE_API_BY_ROLE.postman_collection.json`. Import it, run the four
login requests in **00 Public**, then run any folder.

On every authenticated request add:

```
Authorization: Bearer {{adminToken}}   (or smToken / asmToken / bdeToken)
Content-Type: application/json
```

**Status codes**

| Code | Meaning |
|---|---|
| `200` / `201` | success |
| `400` | missing/invalid body field |
| `401` | token missing, invalid, expired, or inactive account |
| `403` | valid token, wrong role, or record outside your hierarchy |
| `404` | record not found |
| `500` | server error |

**Role matrix (who can call what)**

| API group | Public | BDE | ASM | SM | Admin |
|---|:--:|:--:|:--:|:--:|:--:|
| Login / logout / register | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/home` | ❌ | ✅ | ✅ | ✅ | ❌ |
| Employee app APIs (`/api/leads`, `/api/followups`, `/api/attendance`, `/api/tasks`, `/api/leaves`, `/api/wallet/*`, `/api/salary/*`, `/api/incentives`, `/api/team`, `/api/operations`, `/api/profile`) | ❌ | ✅ own | ✅ subtree | ✅ subtree | ⚠️ read-only where allowed |
| `/api/sm/asms`, `/api/sm/create-asm` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `/api/asm/bdes`, `/api/asm/create-bde` | ❌ | ❌ | ✅ | ✅ | ✅ |
| Catalog GETs (`/api/zones`, `/api/districts`, `/api/designations`, `/api/courses`, `/api/sources`, `/api/hierarchy/filters`, `/api/institutes`) | ❌ | ✅ | ✅ | ✅ | ✅ |
| Catalog mutations | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/api/admin/*`, `/api/seed`, `/api/test`, `/api/set-password`, `/api/employee-tasks`, `/api/task-templates*` | ❌ | ❌ | ❌ | ❌ | ✅ |

> SM can call every **BDE/employee** API in §5 (scoped to its whole subtree).
> ASM can call every API in §5 (scoped to itself + direct reports).
> BDE can call only §5 (itself).

---

## 1. Public APIs — no token

### 1.1 `POST /api/login`

```
POST {{baseUrl}}/api/login
Content-Type: application/json
```

Employee body:

```json
{ "employee_id": "BDE001", "password": "password123" }
```

Admin body:

```json
{ "email": "admin@kide.com", "password": "password123" }
```

`200` → `{ success, message, token, user, data: { token, user, require_password_change } }`.
Wrong password → `401`.

Postman test script (saves the token):

```js
const j = pm.response.json();
if (j.token) pm.collectionVariables.set('bdeToken', j.token);
```

### 1.2 `POST /api/logout`

```
POST {{baseUrl}}/api/logout
```

No token. Always `200`.

### 1.3 `POST /api/register`

```
POST {{baseUrl}}/api/register
```

No token. Always `403` — self-registration is disabled.

---

## 2. Admin APIs

All require `Authorization: Bearer {{adminToken}}` (or header
`x-admin-key: kide-admin-secret`).

### 2.1 Admin dashboard & system

| # | Method | URL | Body / Query | Expected |
|---|---|---|---|---|
| 2.1.1 | GET | `{{baseUrl}}/api/admin/stats` | `?zone=&district=` optional | `200` analytics |
| 2.1.2 | GET | `{{baseUrl}}/api/test` | — | `200` DB status |
| 2.1.3 | GET | `{{baseUrl}}/api/seed` | — | `200` idempotent seed |
| 2.1.4 | POST | `{{baseUrl}}/api/set-password` | `{ "employee_id": "BDE001", "password": "newpass123" }` | `200` |

### 2.2 Admin panel CRUD — `/api/admin/{tab}`

```
GET    {{baseUrl}}/api/admin/employees
POST   {{baseUrl}}/api/admin/employees
PUT    {{baseUrl}}/api/admin/employees
DELETE {{baseUrl}}/api/admin/employees?id={{employeeMongoId}}
```

Valid `{tab}` values:

```
leads, employees, attendance, attendanceRecords, zones, districts, courses,
designations, teams, tasks, taskTemplates, task-templates, employeeTasks,
employee-tasks, wallets, walletWithdrawRequests, wallet-withdraw-requests,
leaves, activities, roles, settings
```

> `activities` is the activity log. `activity-logs` is **not** a valid tab
> (`400 Invalid tab category`).

Bodies for the most-used tabs:

**Employee**

```json
{
  "name": "Test Employee",
  "employee_id": "BDE010",
  "email": "test.bde@kide.com",
  "contact_number": "9000000010",
  "designation": "Business Development Executive",
  "zone": "Central Zone",
  "district": "Ernakulam",
  "reports_to": "ASM001",
  "password": "test1234",
  "status": "active"
}
```

**Team** — `districts` must contain exactly 2 unassigned districts for a field
team, or `[]` for the office team. A field team's `team_lead` must be an
existing ASM that is not already leading another team; the office team's lead
must be an SM. This office-team body succeeds with the current data:

```json
{
  "name": "Test Office Team",
  "districts": [],
  "zone": "Central Zone",
  "team_lead": "Sanu",
  "description": "Test office team",
  "is_office": true
}
```

Field-team example (create a second ASM via `/api/sm/create-asm` first, and use
two districts not already taken by `EKM Team`):

```json
{
  "name": "Test Field Team",
  "districts": ["Kollam", "Pathanamthitta"],
  "zone": "South Zone",
  "team_lead": "<new ASM name>",
  "description": "Test field team",
  "is_office": false
}
```

**Lead**

```json
{
  "name": "Admin Lead",
  "contact_number": "9000000011",
  "employee": "Vishnu Mohan",
  "employee_id": "BDE001",
  "district": "Ernakulam",
  "course": "Full-Stack Web Development",
  "admission_status": "New"
}
```

**Task**

```json
{
  "title": "Follow up 10 leads",
  "description": "Daily target",
  "assigned_to": "Vishnu Mohan",
  "priority": "high",
  "status": "pending",
  "due_date": "2026-11-05"
}
```

**Attendance**

```json
{
  "name": "Vishnu Mohan",
  "employee_id": "BDE001",
  "date": "2026-10-31",
  "check_in": "09:30 AM",
  "check_out": "06:00 PM",
  "status": "ONLINE"
}
```

**Wallet**

```json
{
  "employee": "Vishnu Mohan",
  "employee_id": "BDE001",
  "balance": 0,
  "total_earned": 0,
  "total_paid": 0,
  "currency": "INR"
}
```

**Leave**

```json
{
  "employee": "Vishnu Mohan",
  "leave_type": "Casual Leave",
  "start_date": "2026-11-10",
  "end_date": "2026-11-11",
  "reason": "Personal",
  "status": "Pending"
}
```

**Role / Setting**

```json
{ "name": "Manager", "description": "Read-only manager", "permissions": [] }
```

```json
{ "name": "Company Name", "key": "company_name", "value": "KIDE", "description": "" }
```

Update (`PUT`) uses the same body plus `"id": "<mongo _id>"`.
Delete (`DELETE`) accepts `?id=` or `{ "ids": ["...", "..."] }`.

### 2.3 Admin lead creation

```
POST {{baseUrl}}/api/admin/leads/create
```

```json
{
  "name": "Rahul Krishna",
  "phone": "9847123456",
  "email": "rahul@gmail.com",
  "district": "Ernakulam",
  "place": "Edappally, Kochi",
  "interested_course": "Full-Stack Web Development",
  "lead_source": "Campus Drive / College Seminar",
  "admission_status": "New",
  "employee": "Vishnu Mohan",
  "employee_id": "BDE001",
  "notes": "Interested in weekend batch"
}
```

`employee` or `employee_id` is required. Employee token → `403`.

### 2.4 Admin-only task management

| # | Method | URL | Body |
|---|---|---|---|
| 2.4.1 | GET | `{{baseUrl}}/api/employee-tasks` | `?search=` |
| 2.4.2 | POST | `{{baseUrl}}/api/employee-tasks` | `{ "employee": "Vishnu Mohan", "task_template": "Daily Calls", "period_start": "2026-10-31", "period_end": "2026-10-31", "total_target": 15 }` |
| 2.4.3 | PUT | `{{baseUrl}}/api/employee-tasks` | `{ "id": "<id>", "achieved": 10, "total_target": 15 }` |
| 2.4.4 | DELETE | `{{baseUrl}}/api/employee-tasks?id=<id>` | — |
| 2.4.5 | GET | `{{baseUrl}}/api/task-templates` | `?search=` |
| 2.4.6 | POST | `{{baseUrl}}/api/task-templates` | `{ "title": "Daily Calls", "metric_type": "Calls", "designation": "Business Development Executive", "frequency": "daily", "target_count": 15 }` |
| 2.4.7 | PUT | `{{baseUrl}}/api/task-templates` | `{ "id": "<id>", "target_count": 20 }` |
| 2.4.8 | DELETE | `{{baseUrl}}/api/task-templates?id=<id>` | — |
| 2.4.9 | POST | `{{baseUrl}}/api/task-templates/generate` | `{ "template_ids": ["<id>"] }` |

### 2.5 Catalog mutations (admin only)

| # | Method | URL | Body |
|---|---|---|---|
| 2.5.1 | POST | `{{baseUrl}}/api/zones` | `{ "name": "Test Zone", "description": "..." }` |
| 2.5.2 | POST | `{{baseUrl}}/api/districts` | `{ "name": "Test District", "zone": "Central Zone" }` |
| 2.5.3 | PUT | `{{baseUrl}}/api/districts` | `{ "id": "<id>", "name": "Test District", "zone": "Central Zone" }` |
| 2.5.4 | DELETE | `{{baseUrl}}/api/districts?id=<id>` | — |
| 2.5.5 | PUT | `{{baseUrl}}/api/districts/{id}` | `{ "name": "Test District", "zone": "Central Zone" }` |
| 2.5.6 | DELETE | `{{baseUrl}}/api/districts/{id}` | — |
| 2.5.7 | POST | `{{baseUrl}}/api/designations` | `{ "name": "Test Designation", "prefix": "TST" }` |
| 2.5.8 | PUT | `{{baseUrl}}/api/designations` | `{ "id": "<id>", "name": "Test Designation", "prefix": "TST" }` |
| 2.5.9 | DELETE | `{{baseUrl}}/api/designations?id=<id>` | — |
| 2.5.10 | PUT | `{{baseUrl}}/api/designations/{id}` | `{ "name": "Test Designation", "prefix": "TST" }` |
| 2.5.11 | DELETE | `{{baseUrl}}/api/designations/{id}` | — |
| 2.5.12 | POST | `{{baseUrl}}/api/courses` | `{ "name": "Test Course" }` |
| 2.5.13 | PUT | `{{baseUrl}}/api/courses` | `{ "id": "<id>", "name": "Test Course" }` |
| 2.5.14 | DELETE | `{{baseUrl}}/api/courses?id=<id>` | — |
| 2.5.15 | PUT | `{{baseUrl}}/api/courses/{id}` | `{ "name": "Test Course" }` |
| 2.5.16 | DELETE | `{{baseUrl}}/api/courses/{id}` | — |
| 2.5.17 | DELETE | `{{baseUrl}}/api/institutes/{id}` | — |

### 2.6 Admin workflow actions

```
POST {{baseUrl}}/api/wallet/workflow
POST {{baseUrl}}/api/salary/workflow
```

```json
{ "request_id": "WDR-xxxx", "action": "sanction", "remarks": "Approved" }
```

Admin can run: `sanction`, `approve`, `accounts_approve`, `pay`, `mark_paid`,
`reject` (plus the earlier steps).

### 2.7 Admin on hierarchy endpoints

| # | Method | URL | Body |
|---|---|---|---|
| 2.7.1 | GET | `{{baseUrl}}/api/sm/asms` | — |
| 2.7.2 | POST | `{{baseUrl}}/api/sm/create-asm` | `{ "name": "Test ASM", "email": "asm@kide.com", "password": "test1234", "team_code": "TVM" }` |
| 2.7.3 | GET | `{{baseUrl}}/api/asm/bdes` | — |
| 2.7.4 | POST | `{{baseUrl}}/api/asm/create-bde` | `{ "name": "Test BDE", "email": "bde@kide.com", "password": "test1234", "asm_id": "ASM001" }` |

### 2.8 Admin calls that must fail

| Request | Expected |
|---|---|
| `GET {{baseUrl}}/api/home` | `403` (employee token required) |
| `POST {{baseUrl}}/api/attendance/check-in` | `403` |
| `POST {{baseUrl}}/api/attendance/check-out` | `403` |
| `POST {{baseUrl}}/api/leads/create` | `403` |
| `GET {{baseUrl}}/api/operations` | `403` |
| `GET {{baseUrl}}/api/team` | `403` |

---

## 3. SM APIs

Header: `Authorization: Bearer {{smToken}}`.

An SM can also call every employee API in §5, scoped to its whole subtree
(SM001 + ASM001 + BDE001).

### 3.1 SM-specific

| # | Method | URL | Body / Query | Expected |
|---|---|---|---|---|
| 3.1.1 | GET | `{{baseUrl}}/api/sm/asms` | — | `200`, own ASMs (`count: 1`) |
| 3.1.2 | GET | `{{baseUrl}}/api/sm/asms/ASM001` | — | `200` |
| 3.1.3 | GET | `{{baseUrl}}/api/sm/asms?id=<mongo id>` | — | `200` |
| 3.1.4 | GET | `{{baseUrl}}/api/sm/asms?employee_id=ASM001` | — | `200` |
| 3.1.5 | POST | `{{baseUrl}}/api/sm/create-asm` | see below | `201` |
| 3.1.6 | GET | `{{baseUrl}}/api/asm/bdes` | — | `200`, subtree BDEs |
| 3.1.7 | GET | `{{baseUrl}}/api/asm/bdes/BDE001` | — | `200` |
| 3.1.8 | POST | `{{baseUrl}}/api/asm/create-bde` | see below | `201` |
| 3.1.9 | GET | `{{baseUrl}}/api/home` | — | `200`, `dashboard_type:"sm"`, `visible_employees:3` |
| 3.1.10 | GET | `{{baseUrl}}/api/team?scope=all` | — | `200`, whole subtree |

**Create ASM body**

```json
{
  "name": "Test ASM",
  "email": "test.asm@kide.com",
  "contact_number": "9000000020",
  "password": "test1234",
  "team_code": "TVM"
}
```

`team_code`: `TVM`, `PTM`, `KTM`, `EKM`, `PKD`, `CLT`, `KZE`
(or `custom_team_name`).

**Create BDE body** (`asm_id` is required for SM)

```json
{
  "name": "Test BDE",
  "email": "test.bde2@kide.com",
  "contact_number": "9000000021",
  "password": "test1234",
  "district": "Ernakulam",
  "asm_id": "ASM001"
}
```

Without `asm_id` → `400`. `asm_id` outside the SM subtree → `403`.

### 3.2 SM workflow actions

| # | Method | URL | Body |
|---|---|---|---|
| 3.2.1 | POST | `{{baseUrl}}/api/wallet/workflow` | `{ "request_id": "WDR-xxxx", "action": "forward_to_accounts", "remarks": "OK" }` |
| 3.2.2 | POST | `{{baseUrl}}/api/salary/workflow` | `{ "request_id": "SAL-xxxx", "action": "forward_to_accounts" }` |
| 3.2.3 | POST | `{{baseUrl}}/api/wallet/workflow` | `{ "request_id": "WDR-xxxx", "action": "reject", "remarks": "Invalid" }` |

SM cannot run `sanction` / `pay` (admin only → `403`).

### 3.3 SM must-fail checks

| Request | Expected |
|---|---|
| `GET {{baseUrl}}/api/sm/asms` as ASM/BDE | `403` |
| `POST {{baseUrl}}/api/sm/create-asm` as ASM/BDE | `403` |
| `GET {{baseUrl}}/api/leads?lead_id=<lead outside subtree>` | `403` |
| `GET {{baseUrl}}/api/admin/stats` | `401`/`403` |

---

## 4. ASM APIs

Header: `Authorization: Bearer {{asmToken}}`.

An ASM can also call every employee API in §5, scoped to itself + its direct
reports (ASM001 + BDE001). It never sees another ASM's BDEs.

### 4.1 ASM-specific

| # | Method | URL | Body / Query | Expected |
|---|---|---|---|---|
| 4.1.1 | GET | `{{baseUrl}}/api/asm/bdes` | — | `200`, own BDEs (`count: 1`) |
| 4.1.2 | GET | `{{baseUrl}}/api/asm/bdes/BDE001` | — | `200` |
| 4.1.3 | GET | `{{baseUrl}}/api/asm/bdes?id=<mongo id>` | — | `200` |
| 4.1.4 | GET | `{{baseUrl}}/api/asm/bdes?employee_id=BDE001` | — | `200` |
| 4.1.5 | POST | `{{baseUrl}}/api/asm/create-bde` | see below | `201` |
| 4.1.6 | GET | `{{baseUrl}}/api/home` | — | `200`, `"asm"`, `visible_employees:2` |
| 4.1.7 | GET | `{{baseUrl}}/api/team` | — | `200`, 1 member |
| 4.1.8 | GET | `{{baseUrl}}/api/team?scope=all` | — | `200`, same subtree |

**Create BDE body** — `asm_id` is ignored for ASM; the BDE is always created
under the caller.

```json
{
  "name": "Test BDE",
  "email": "test.bde3@kide.com",
  "contact_number": "9000000022",
  "password": "test1234",
  "district": "Ernakulam",
  "asm_id": "ASM999"
}
```

→ `201`, `reports_to: "ASM001"`.

### 4.2 ASM workflow actions

| # | Method | URL | Body |
|---|---|---|---|
| 4.2.1 | POST | `{{baseUrl}}/api/wallet/workflow` | `{ "request_id": "WDR-xxxx", "action": "forward_to_sm" }` |
| 4.2.2 | POST | `{{baseUrl}}/api/salary/workflow` | `{ "request_id": "SAL-xxxx", "action": "forward_to_sm" }` |
| 4.2.3 | POST | `{{baseUrl}}/api/wallet/workflow` | `{ "request_id": "WDR-xxxx", "action": "reject", "remarks": "Invalid" }` |

ASM cannot run `forward_to_accounts` or `sanction` (→ `403`).

### 4.3 ASM must-fail checks

| Request | Expected |
|---|---|
| `GET {{baseUrl}}/api/sm/asms` | `403` |
| `POST {{baseUrl}}/api/sm/create-asm` | `403` |
| `GET {{baseUrl}}/api/asm/bdes?asm_id=<another ASM>` | own BDEs only |
| `GET {{baseUrl}}/api/leads?lead_id=<SM's lead>` | `403` |
| `GET {{baseUrl}}/api/attendance/history?employee_id=SM001` | `403` |

---

## 5. BDE APIs — employee app (all employee roles)

Header: `Authorization: Bearer {{bdeToken}}` (or `{{asmToken}}` / `{{smToken}}`).

Scope: BDE → itself; ASM → itself + direct reports; SM → whole subtree.

### 5.1 Dashboard, profile, session

| # | Method | URL | Body | Expected |
|---|---|---|---|---|
| 5.1.1 | GET | `{{baseUrl}}/api/home` | — | `200` role dashboard |
| 5.1.2 | GET | `{{baseUrl}}/api/profile` | — | `200` own profile |
| 5.1.3 | GET | `{{baseUrl}}/api/auth/me` | — | same as 5.1.2 |
| 5.1.4 | POST | `{{baseUrl}}/api/auth/refresh-token` | — | `200` new token |
| 5.1.5 | POST | `{{baseUrl}}/api/employee/change-password` | `{ "current_password": "password123", "new_password": "newpass123" }` | `200` |
| 5.1.6 | GET | `{{baseUrl}}/api/operations` | — | `200` |
| 5.1.7 | GET | `{{baseUrl}}/api/team` | — | BDE: empty; ASM/SM: reports |

### 5.2 Leads

| # | Method | URL | Body / Query | Expected |
|---|---|---|---|---|
| 5.2.1 | GET | `{{baseUrl}}/api/leads` | — | BDE 4 / ASM 4 / SM 5 |
| 5.2.2 | GET | `{{baseUrl}}/api/leads?lead_id={{leadId}}` | — | `200` if in scope, `403` otherwise |
| 5.2.3 | GET | `{{baseUrl}}/api/leads?search=Rahul` | — | `200` scoped |
| 5.2.4 | GET | `{{baseUrl}}/api/leads?status=New` | — | `200` scoped |
| 5.2.5 | GET | `{{baseUrl}}/api/leads?district=Ernakulam` | — | `200` scoped |
| 5.2.6 | GET | `{{baseUrl}}/api/leads?employee=Sanu%20Jaison` | — | BDE/ASM `403`; SM `200` |
| 5.2.7 | POST | `{{baseUrl}}/api/leads` | see below | `201` |
| 5.2.8 | PUT | `{{baseUrl}}/api/leads` | `{ "lead_id": "{{leadId}}", "remarks": "Updated" }` | `200` in scope |
| 5.2.9 | DELETE | `{{baseUrl}}/api/leads?id={{leadId}}` | — | `200` in scope |
| 5.2.10 | POST | `{{baseUrl}}/api/leads/create` | see below | `201` |
| 5.2.11 | GET | `{{baseUrl}}/api/leads/create` | — | `200` schema guide |
| 5.2.12 | GET | `{{baseUrl}}/api/leads/next-student-id` | — | `200`, `STU-xxx` |
| 5.2.13 | POST | `{{baseUrl}}/api/leads/import` | multipart `file`, or `{ "csv": "name,phone\nA,9000000004" }` | `200` |
| 5.2.14 | POST | `{{baseUrl}}/api/leads/{id}/followup` | see below | `200` |
| 5.2.15 | POST | `{{baseUrl}}/api/leads/{id}/follow-up` | alias of 5.2.14 | `200` |
| 5.2.16 | POST | `{{baseUrl}}/api/leads/{id}/close` | `{ "student_id": "<lead.student_id>" }` | `200` + ₹1000 |

**Create lead (5.2.7 / 5.2.10)**

```json
{
  "name": "Rahul Krishna",
  "phone": "9847123456",
  "whatsapp_number": "9847123456",
  "email": "rahul@gmail.com",
  "district": "Ernakulam",
  "place": "Edappally, Kochi",
  "age": 22,
  "qualification": "B.Tech Computer Science",
  "college_name": "Model Engineering College",
  "current_year": "Final Year",
  "interested_topic": "MERN Stack",
  "interested_course": "Full-Stack Web Development",
  "lead_source": "Campus Drive / College Seminar",
  "admission_status": "New",
  "next_followup_date": "2026-11-05",
  "notes": "Interested in weekend batch"
}
```

For an employee token the lead is **always** assigned to the caller, even if
`employee` / `employee_id` are sent. Admin tokens must pass a valid employee
(or use `/api/admin/leads/create`).

**Follow-up body (5.2.14)**

```json
{
  "remarks": "Discussed fees",
  "next_followup_date": "2026-11-05",
  "student_interest": "Hot",
  "presentation": "Scheduled",
  "admission_status": "Follow-up",
  "proof_url": ""
}
```

**Close body (5.2.16)**

```json
{
  "student_id": "STU-001",
  "course": "Full-Stack Web Development",
  "payment": 50000,
  "payment_verification": "Verified",
  "remarks": "Admission confirmed"
}
```

`student_id` must match the lead's stored `student_id`, otherwise `400`.

### 5.3 Follow-up pipeline

| # | Method | URL | Body / Query | Expected |
|---|---|---|---|---|
| 5.3.1 | GET | `{{baseUrl}}/api/followups` | — | `200` scoped |
| 5.3.2 | GET | `{{baseUrl}}/api/followups?lead_id={{leadId}}` | — | `200`/`403` |
| 5.3.3 | GET | `{{baseUrl}}/api/followups?due=today` | `today`/`upcoming`/`overdue` | `200` |
| 5.3.4 | POST | `{{baseUrl}}/api/followups` | `{ "lead_id": "{{leadId}}", "remarks": "Called", "next_followup_date": "2026-11-06" }` | `200` |

### 5.4 Attendance

| # | Method | URL | Body / Query | Expected |
|---|---|---|---|---|
| 5.4.1 | GET | `{{baseUrl}}/api/attendance` | — | `200` own today + recent |
| 5.4.2 | GET | `{{baseUrl}}/api/attendance/status` | — | `200` own status |
| 5.4.3 | POST | `{{baseUrl}}/api/attendance/check-in` | `{ "latitude": 10.0159, "longitude": 76.3419, "address": "Kochi" }` | `200` |
| 5.4.4 | POST | `{{baseUrl}}/api/attendance/check-out` | `{ "notes": "Done for the day" }` | `200`, `status:"OFFLINE"` |
| 5.4.5 | GET | `{{baseUrl}}/api/attendance/history` | — | `200` scoped |
| 5.4.6 | GET | `{{baseUrl}}/api/attendance/history?month=2026-10` | — | `200` scoped |
| 5.4.7 | GET | `{{baseUrl}}/api/attendance/history?employee_id=SM001` | — | BDE/ASM `403` |

### 5.5 Tasks & leaves

| # | Method | URL | Body / Query | Expected |
|---|---|---|---|---|
| 5.5.1 | GET | `{{baseUrl}}/api/tasks` | — | `200` scoped |
| 5.5.2 | GET | `{{baseUrl}}/api/tasks?assigned_to=Sanu%20Jaison` | — | `403` for BDE |
| 5.5.3 | GET | `{{baseUrl}}/api/leaves` | — | `200` scoped |
| 5.5.4 | GET | `{{baseUrl}}/api/leaves?employee=Sanu%20Jaison` | — | `403` for BDE |
| 5.5.5 | POST | `{{baseUrl}}/api/leaves/apply` | see below | `200`/`201` |

**Apply leave body**

```json
{
  "leave_type": "Casual Leave",
  "start_date": "2026-11-10",
  "end_date": "2026-11-11",
  "reason": "Personal work"
}
```

### 5.6 Wallet, salary, incentives

| # | Method | URL | Body / Query | Expected |
|---|---|---|---|---|
| 5.6.1 | GET | `{{baseUrl}}/api/wallet/balance` | — | `200` own wallet + own requests |
| 5.6.2 | GET | `{{baseUrl}}/api/wallet/balance?employee_id=BDE001` | — | override ignored for employees |
| 5.6.3 | POST | `{{baseUrl}}/api/wallet/withdraw` | see below | `200` |
| 5.6.4 | GET | `{{baseUrl}}/api/salary/requests` | — | `200` scoped |
| 5.6.5 | POST | `{{baseUrl}}/api/salary/request` | `{ "amount": 5000, "period": "2026-10", "remarks": "Monthly" }` | `200` (min ₹5,000) |
| 5.6.6 | GET | `{{baseUrl}}/api/incentives` | — | `200` own |
| 5.6.7 | GET | `{{baseUrl}}/api/incentives?bde_id=BDE999` | — | override ignored |
| 5.6.8 | GET | `{{baseUrl}}/api/incentives?status=Pending` | — | `200` scoped |

**Withdraw body**

```json
{
  "amount": 500,
  "upi_id": "vishnu@upi",
  "bank_name": "SBI",
  "account_number": "1234567890",
  "ifsc_code": "SBIN0001234",
  "remarks": "Incentive withdrawal"
}
```

Max ₹5,000 per request and never more than the wallet balance (`400`).

### 5.7 Catalog reads (any valid token)

| # | Method | URL | Query |
|---|---|---|---|
| 5.7.1 | GET | `{{baseUrl}}/api/zones` | — |
| 5.7.2 | GET | `{{baseUrl}}/api/districts` | `?search=` |
| 5.7.3 | GET | `{{baseUrl}}/api/districts/{id}` | — |
| 5.7.4 | GET | `{{baseUrl}}/api/designations` | `?search=` |
| 5.7.5 | GET | `{{baseUrl}}/api/designations/{id}` | — |
| 5.7.6 | GET | `{{baseUrl}}/api/courses` | `?search=` |
| 5.7.7 | GET | `{{baseUrl}}/api/courses/{id}` | — |
| 5.7.8 | GET | `{{baseUrl}}/api/sources` | — |
| 5.7.9 | GET | `{{baseUrl}}/api/hierarchy/filters` | — |
| 5.7.10 | GET | `{{baseUrl}}/api/institutes` | `?district=&search=` |
| 5.7.11 | POST | `{{baseUrl}}/api/institutes` | body below (any valid token) |
| 5.7.12 | POST | `{{baseUrl}}/api/institutes/create` | alias of 5.7.11 |

**Create institute body**

```json
{
  "name": "Test College",
  "type": "College",
  "district": "Ernakulam",
  "address": "MG Road, Kochi",
  "contact_person": "Principal",
  "contact_phone": "9847000000",
  "email": "college@example.com"
}
```

### 5.8 BDE must-fail checks

| Request | Expected |
|---|---|
| `GET {{baseUrl}}/api/sm/asms` | `403` |
| `GET {{baseUrl}}/api/asm/bdes` | `403` |
| `POST {{baseUrl}}/api/sm/create-asm` | `403` |
| `POST {{baseUrl}}/api/asm/create-bde` | `403` |
| `GET {{baseUrl}}/api/leads?lead_id=<another employee's lead>` | `403` |
| `DELETE {{baseUrl}}/api/leads?id=<another employee's lead>` | `403` |
| `GET {{baseUrl}}/api/attendance/history?employee_id=ASM001` | `403` |
| `GET {{baseUrl}}/api/leaves?employee=Sanu%20Jaison` | `403` |
| `GET {{baseUrl}}/api/tasks?assigned_to=Sanu%20Jaison` | `403` |
| `POST {{baseUrl}}/api/leads/create` with `employee:"Sanu Jaison"` | `201` but assigned to BDE001 |
| `GET {{baseUrl}}/api/admin/employees` | `401`/`403` |
| `GET {{baseUrl}}/api/home` with no token | `401` |

---

## 6. No-token checks (must all be `401`)

```
GET  {{baseUrl}}/api/home
GET  {{baseUrl}}/api/profile
GET  {{baseUrl}}/api/leads
GET  {{baseUrl}}/api/followups
GET  {{baseUrl}}/api/attendance
GET  {{baseUrl}}/api/attendance/history
GET  {{baseUrl}}/api/tasks
GET  {{baseUrl}}/api/leaves
GET  {{baseUrl}}/api/wallet/balance
GET  {{baseUrl}}/api/salary/requests
GET  {{baseUrl}}/api/incentives
GET  {{baseUrl}}/api/team
GET  {{baseUrl}}/api/operations
GET  {{baseUrl}}/api/sm/asms
GET  {{baseUrl}}/api/asm/bdes
GET  {{baseUrl}}/api/zones
GET  {{baseUrl}}/api/districts
GET  {{baseUrl}}/api/designations
GET  {{baseUrl}}/api/courses
GET  {{baseUrl}}/api/sources
GET  {{baseUrl}}/api/hierarchy/filters
GET  {{baseUrl}}/api/institutes
GET  {{baseUrl}}/api/leads/next-student-id
GET  {{baseUrl}}/api/admin/employees
GET  {{baseUrl}}/api/admin/stats
GET  {{baseUrl}}/api/employee-tasks
GET  {{baseUrl}}/api/task-templates
GET  {{baseUrl}}/api/seed
GET  {{baseUrl}}/api/test
POST {{baseUrl}}/api/set-password
POST {{baseUrl}}/api/leads
POST {{baseUrl}}/api/leads/create
POST {{baseUrl}}/api/leads/import
POST {{baseUrl}}/api/followups
POST {{baseUrl}}/api/attendance/check-in
POST {{baseUrl}}/api/wallet/withdraw
POST {{baseUrl}}/api/salary/request
POST {{baseUrl}}/api/leaves/apply
POST {{baseUrl}}/api/wallet/workflow
POST {{baseUrl}}/api/salary/workflow
```

`POST /api/login`, `POST /api/logout` and `POST /api/register` are the only
public routes.

---

## 7. Notes

1. `:id` in lead URLs accepts the Mongo `_id`, the numeric app id, or
   `LD-xxxx`.
2. Employee tokens always read their own wallet; `?employee_id=` is ignored.
   Admin tokens must pass `?employee_id=` or `?employee=` to
   `/api/wallet/balance`.
3. Employee-created leads are always assigned to the caller. Managers can
   assign within their own hierarchy only.
4. Wallet/salary workflow actions are role-gated:
   `forward_to_sm`/`asm_approve` (ASM/BDM/SM/admin),
   `forward_to_accounts`/`sm_approve` (SM/admin),
   `sanction`/`approve`/`accounts_approve`/`pay`/`mark_paid` (admin),
   `reject` (ASM/BDM/SM/admin).
5. `POST /api/employee/change-password` and `POST /api/set-password` change
   real passwords — test them on a throwaway BDE, then reset with admin.
6. The full endpoint-by-endpoint checklist lives in `docs/API_TEST_PLAN.md`.
7. Employee-token lead responses are the mobile shape (numeric `id`, `lead_id`,
   no Mongo `_id`). Use `lead_id` (`LD-xxxx`) in `PUT /api/leads` and
   `DELETE /api/leads?id=`; admin-token responses include both `_id` and `id`.
