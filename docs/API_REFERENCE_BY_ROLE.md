# KIDE API Reference — by role

**Deployed base URL:** `https://lms-application-pi.vercel.app`

**Local base URL:** `http://localhost:3000`

Last updated: 2026-11-01

Every endpoint below is documented with:

- the **full deployed URL** (copy-paste ready),
- the **token** it requires (or `none`),
- the **request body** (or query string),
- the **expected response structure**.

Every non-public endpoint requires a valid `Authorization: Bearer <token>` header.
Data is always scoped **downward through `reports_to`** — never by team — so an
employee can never see another employee's profile, leads, tasks, attendance,
leaves, incentives, wallet or admissions unless that employee is below them in
the reporting tree.

---

## Contents

1. [Master workflow rules](#1-master-workflow-rules)
2. [Conventions](#2-conventions)
3. [Postman setup](#3-postman-setup)
4. [Public APIs (no token)](#4-public-apis-no-token)
5. [Admin APIs](#5-admin-apis)
6. [Sales Manager (SM) APIs](#6-sales-manager-sm-apis)
7. [Area Sales Manager (ASM) APIs](#7-area-sales-manager-asm-apis)
8. [BDE / employee APIs](#8-bde--employee-apis)
9. [Security negative tests](#9-security-negative-tests)
10. [Endpoint index](#10-endpoint-index)

---

## 1. Master workflow rules

The system implements exactly this chain:

```
Admin  →  SM  →  ASM  →  BDE
```

| Rule | Where it is enforced |
|---|---|
| The organisation has **exactly one Sales Manager** | `POST /api/admin/create-sm`, `POST/PUT /api/admin/employees` |
| The SM creates **7 regional ASMs** (one per team, 2 exclusive districts each) plus **1 Office Team** (no districts) | `POST /api/sm/create-asm` |
| A district once assigned **cannot** be assigned to another team | `POST /api/sm/create-asm`, `POST/PUT /api/admin/teams` |
| A team can have **only one ASM**; an ASM can lead **only one team** | `POST /api/sm/create-asm` |
| The ASM creates **unlimited BDEs** under itself | `POST /api/asm/create-bde` |
| The SM assigns tasks to the **8 teams**; each ASM assigns tasks to **its BDEs**; Admin is **read-only** for tasks | `POST /api/tasks`, `/api/admin/tasks` |
| Every **closed admission credits ₹1,000** to the closing BDE's wallet | `POST /api/leads/{id}/close` |
| Withdrawals are **max ₹5,000 per request**, routed **BDE → ASM → SM → Admin**, and Admin approval releases the money | `POST /api/wallet/withdraw`, `POST /api/wallet/workflow` |

### The 8 teams

| Team code | Team name | Districts | Zone |
|---|---|---|---|
| `TVM` | TVM Team | Thiruvananthapuram, Kollam | South Zone |
| `PTM` | PTM Team | Pathanamthitta, Alappuzha | South Zone |
| `KTM` | KTM Team | Kottayam, Idukki | Central Zone |
| `EKM` | EKM Team | Ernakulam, Thrissur | Central Zone |
| `PKD` | PKD Team | Palakkad, Malappuram | Central Zone |
| `CLT` | CLT Team | Kozhikode, Wayanad | North Zone |
| `KZD` | KZD Team | Kannur, Kasaragod | North Zone |
| `OFFICE` | Office Team | none | — |

`KZE` is accepted as an alias for `KZD` so older clients keep working.

### Shared workflow labels

Withdrawal and salary requests keep a granular internal stage
(`Submitted to ASM`, `Forwarded to SM`, `Forwarded to Accounts`) but every
dashboard receives the same simplified `status_label`:

| `status_label` | Meaning |
|---|---|
| `Pending` | still somewhere in the ASM → SM → Admin chain |
| `Approved` | Admin sanctioned it; for withdrawals the money is released |
| `Paid` | payment disbursed and a transaction reference stored |
| `Rejected` | rejected at any step (withdrawal amount is refunded to the wallet) |

---

## 2. Conventions

### Authentication header

```
Authorization: Bearer <token>
Content-Type: application/json
```

Admin portal routes accept either a Bearer admin token (`role` = `admin`,
`superadmin` or `manager`) or:

```
x-admin-key: <ADMIN_KEY>
```

### Status codes

| Code | Meaning |
|---|---|
| `200` / `201` | success |
| `400` | missing/invalid body field, or a business rule was violated |
| `401` | token missing, invalid, expired, or the account is inactive |
| `403` | valid token but wrong role, or the record is outside your hierarchy |
| `404` | record not found |
| `500` | server error |

### Scoping

| Caller | Sees |
|---|---|
| BDE | only itself |
| ASM / BDM | itself + the employees whose `reports_to` is its `employee_id` |
| SM | itself + its whole downward subtree (ASMs + BDEs) |
| Admin | everything |

Scoping is **downward only** and is based on `reports_to`. Two ASMs that share a
team can never see each other's BDEs.

### Standard success envelope

```json
{
  "success": true,
  "message": "Human readable message",
  "count": 0,
  "data": {}
}
```

List endpoints return `data` as an array (or an object with `tasks` / `list`
where noted). Error responses always look like:

```json
{
  "success": false,
  "message": "Reason"
}
```

### Logins

| Role | Login identifier field | Value | Password |
|---|---|---|---|
| Admin | `email` | `admin@kide.com` | `password123` |
| SM | `employee_id` | `SM001` | `password123` |
| ASM | `employee_id` | `ASM001` | `password123` |
| BDE | `employee_id` | `BDE001` | `password123` |

Current hierarchy: `SM001` → `ASM001` → `BDE001`.

---

## 3. Postman setup

Collection variables:

| Variable | Value |
|---|---|
| `baseUrl` | `https://lms-application-pi.vercel.app` |
| `adminToken` | filled by **Admin Login** |
| `smToken` | filled by **SM Login** |
| `asmToken` | filled by **ASM Login** |
| `bdeToken` | filled by **BDE Login** |
| `leadId` | `LD-2019` (replace with a lead you create) |
| `studentId` | `STU-003` |
| `taskId` | Mongo `_id` returned by a task create |
| `withdrawRequestId` | `request_id` returned by `POST /api/wallet/withdraw` |
| `salaryRequestId` | `request_id` returned by `POST /api/salary/request` |

Importable collection:
`docs/postman/KIDE_API_BY_ROLE.postman_collection.json`

Run the four logins in **00 Public** first; they store the tokens automatically.

---

## 4. Public APIs (no token)

### POST /api/login — unified login

**URL**

```
https://lms-application-pi.vercel.app/api/login
```

**Token:** none

**Body**

```json
{
  "email": "admin@kide.com",
  "password": "password123"
}
```

For employees send `employee_id` instead of `email`:

```json
{
  "employee_id": "SM001",
  "password": "password123"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "6ae5a83d36c60dc78a552a04",
    "employee_id": "SM001",
    "name": "Sanu",
    "email": "sanu@gmail.com",
    "role": "SM",
    "designation": "Sales Manager",
    "designation_name": "Sales Manager",
    "team": "",
    "zone": "",
    "district": "",
    "reports_to": null,
    "status": "active",
    "require_password_change": false
  },
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {}
  }
}
```

Admin tokens return `role: "admin"` and `designation: "Administrator"`.

**Errors:** `400` missing identifier/password, `401` invalid credentials.

---

### POST /api/logout

**URL**

```
https://lms-application-pi.vercel.app/api/logout
```

**Token:** none (the client discards its token)

**Body:** none

**Response `200`**

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### POST /api/register — disabled

**URL**

```
https://lms-application-pi.vercel.app/api/register
```

**Token:** none

**Body:** none

**Response `403`**

```json
{
  "success": false,
  "message": "Self registration is disabled. Please contact your admin to create your account."
}
```

---

## 5. Admin APIs

All routes in this section require an **admin token** (or `x-admin-key`).
An employee token gets `403`.

### 5.1 GET /api/admin/stats — dashboard analytics

**URL**

```
https://lms-application-pi.vercel.app/api/admin/stats
```

**Token:** admin

**Query (optional):** `?zone=Central Zone&district=Ernakulam`

**Response `200`**

```json
{
  "success": true,
  "data": {
    "totalLeads": 15,
    "newLeadsToday": 6,
    "activeFieldForce": "5/6 Active",
    "totalEmployees": 6,
    "leadsByStatus": {
      "labels": ["New Leads", "Contacted", "Interested", "Follow Up", "Won / Admitted"],
      "data": [6, 1, 4, 2, 2],
      "colors": ["#09929e", "#8b5cf6", "#f59e0b", "#f97316", "#10b981"]
    },
    "leadGenerationTrend": {
      "months": ["May", "Jun", "Jul", "Aug", "Sep", "Oct"],
      "data": [1, 2, 1, 15, 0, 0]
    },
    "leadsByDistrict": {
      "labels": ["Ernakulam", "Thiruvananthapuram", "Kozhikode", "Thrissur", "Kollam"],
      "data": [15, 0, 0, 0, 0]
    },
    "liveAttendance": [
      {
        "id": "6ae5b1c2...",
        "name": "Vishnu Mohan",
        "designation": "Business Development Executive",
        "district": "Ernakulam",
        "date": "2026-11-01",
        "check_in": "09:00 AM",
        "check_out": "06:00 PM",
        "hours_worked": 8,
        "status": "ONLINE"
      }
    ]
  }
}
```

---

### 5.2 GET /api/admin/create-sm — does the single SM exist?

**URL**

```
https://lms-application-pi.vercel.app/api/admin/create-sm
```

**Token:** admin

**Response `200`**

```json
{
  "success": true,
  "exists": true,
  "data": {
    "id": "6ae5a83d36c60dc78a552a04",
    "employee_id": "SM001",
    "name": "Sanu",
    "email": "sanu@gmail.com",
    "designation": "Sales Manager"
  },
  "message": "A Sales Manager already exists. The organisation can have only one SM."
}
```

When no SM exists, `exists` is `false` and `data` is `null`.

---

### 5.3 POST /api/admin/create-sm — create the single SM

**URL**

```
https://lms-application-pi.vercel.app/api/admin/create-sm
```

**Token:** admin

**Body**

```json
{
  "name": "Sanu",
  "email": "sanu@gmail.com",
  "contact_number": "9847000001",
  "password": "password123"
}
```

`name` and `password` (min 6 chars) are required.

**Response `201`**

```json
{
  "success": true,
  "message": "Sales Manager Sanu (SM001) created successfully.",
  "data": {
    "id": "6ae5a83d36c60dc78a552a04",
    "employee_id": "SM001",
    "name": "Sanu",
    "email": "sanu@gmail.com",
    "designation": "Sales Manager",
    "reports_to": ""
  }
}
```

**Errors**

- `400` — a Sales Manager already exists.
- `400` — same name / email / contact number already exists.

---

### 5.4 /api/admin/{tab} — generic admin CRUD

**URLs**

```
https://lms-application-pi.vercel.app/api/admin/leads
https://lms-application-pi.vercel.app/api/admin/employees
https://lms-application-pi.vercel.app/api/admin/attendance
https://lms-application-pi.vercel.app/api/admin/zones
https://lms-application-pi.vercel.app/api/admin/districts
https://lms-application-pi.vercel.app/api/admin/courses
https://lms-application-pi.vercel.app/api/admin/designations
https://lms-application-pi.vercel.app/api/admin/teams
https://lms-application-pi.vercel.app/api/admin/tasks
https://lms-application-pi.vercel.app/api/admin/task-templates
https://lms-application-pi.vercel.app/api/admin/employee-tasks
https://lms-application-pi.vercel.app/api/admin/wallets
https://lms-application-pi.vercel.app/api/admin/wallet-withdraw-requests
https://lms-application-pi.vercel.app/api/admin/incentives
https://lms-application-pi.vercel.app/api/admin/salary-requests
https://lms-application-pi.vercel.app/api/admin/leaves
https://lms-application-pi.vercel.app/api/admin/activities
https://lms-application-pi.vercel.app/api/admin/roles
https://lms-application-pi.vercel.app/api/admin/settings
```

**Token:** admin

#### GET — list every record

**URL**

```
https://lms-application-pi.vercel.app/api/admin/employees
```

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "_id": "6ae5a83d36c60dc78a552a04",
      "id": "6ae5a83d36c60dc78a552a04",
      "employee_id": "SM001",
      "name": "Sanu",
      "email": "sanu@gmail.com",
      "designation": "Sales Manager",
      "team": "",
      "district": "",
      "zone": "Kerala",
      "reports_to": "",
      "status": "active",
      "createdAt": "2026-10-30T09:00:00.000Z",
      "updatedAt": "2026-10-30T09:00:00.000Z"
    }
  ]
}
```

`employees` responses never include `password`. The `team` value is derived from
the Teams assignment, not from the employee document.

#### POST — create a record

**URL**

```
https://lms-application-pi.vercel.app/api/admin/teams
```

**Body**

```json
{
  "name": "EKM Team",
  "districts": ["Ernakulam", "Thrissur"],
  "zone": "Central Zone",
  "team_lead": "Bipin Joseph (ASM001)",
  "is_office": false,
  "description": "EKM Team managing Ernakulam, Thrissur"
}
```

**Response `201`**

```json
{
  "success": true,
  "data": {
    "_id": "6ae5acb2b3bc1a44bc0db2c3",
    "name": "EKM Team",
    "districts": ["Ernakulam", "Thrissur"],
    "district": "Ernakulam",
    "zone": "Central Zone",
    "team_lead": "Bipin Joseph (ASM001)",
    "is_office": false,
    "description": "EKM Team managing Ernakulam, Thrissur",
    "createdAt": "2026-11-01T05:00:00.000Z",
    "updatedAt": "2026-11-01T05:00:00.000Z"
  }
}
```

Business rules applied on create/update:

- **teams** — a team covers 0 districts (office) or 1–2 field districts; a
  district already owned by another team returns `400`.
- **employees** — a second Sales Manager is rejected with `400`.
- **leads** — `employee` / `assigned_to` is required and cannot be
  `Unassigned` or `Aslam`.
- **tasks** — `403`. Admin is read-only for tasks.

#### PUT — update a record

**URL**

```
https://lms-application-pi.vercel.app/api/admin/employees
```

**Body**

```json
{
  "id": "6ae5a83d36c60dc78a552a04",
  "designation": "Sales Manager",
  "status": "active"
}
```

**Response `200`**

```json
{
  "success": true,
  "data": {
    "_id": "6ae5a83d36c60dc78a552a04",
    "employee_id": "SM001",
    "name": "Sanu",
    "designation": "Sales Manager",
    "status": "active"
  }
}
```

An empty `password` means "keep the existing password". A non-empty password is
hashed with bcrypt before saving.

#### DELETE — delete one or many

**URL**

```
https://lms-application-pi.vercel.app/api/admin/employees?id=6ae5a83d36c60dc78a552a04
```

**Body (alternative)**

```json
{
  "ids": ["6ae5a83d36c60dc78a552a04", "6ae5acb2b3bc1a44bc0db2c3"]
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Deleted successfully"
}
```

`/api/admin/tasks` returns `403` for POST, PUT and DELETE.

---

### 5.5 GET / POST /api/admin/leads/create — admin lead creation

**URL**

```
https://lms-application-pi.vercel.app/api/admin/leads/create
```

**Token:** admin

**GET** returns the field guide and sample payload.

**POST body** — `employee` or `employee_id` is **required**:

```json
{
  "name": "Rahul Krishna",
  "phone": "9847123456",
  "whatsapp_number": "9847123456",
  "email": "rahul@gmail.com",
  "address": "MG Road",
  "place": "Edappally, Kochi",
  "district": "Ernakulam",
  "age": 22,
  "qualification": "B.Tech Computer Science",
  "college_name": "Model Engineering College",
  "current_year": "Final Year",
  "interested_topic": "MERN Stack & Next.js",
  "interested_course": "Full-Stack Web Development",
  "lead_source": "Campus Drive / College Seminar",
  "admission_status": "New",
  "employee_id": "BDE001",
  "notes": "Interested in weekend batch"
}
```

**Response `201`**

```json
{
  "success": true,
  "message": "Lead Rahul Krishna (LD-4821) created and assigned to Vishnu Mohan (BDE001)",
  "data": {
    "_id": "6ae6d08fc1cd50df3108c8bd",
    "id": "6ae6d08fc1cd50df3108c8bd",
    "lead_id": "LD-4821",
    "student_id": "STU-004",
    "name": "Rahul Krishna",
    "contact_number": "9847123456",
    "phone": "9847123456",
    "district": "Ernakulam",
    "course": "Full-Stack Web Development",
    "interested_course": "Full-Stack Web Development",
    "employee": "Vishnu Mohan",
    "employee_id": "BDE001",
    "admission_status": "New",
    "status": "New"
  }
}
```

An employee token gets `403` here; employees must use `POST /api/leads/create`.

---

### 5.6 Admin catalog mutations

**URLs**

```
https://lms-application-pi.vercel.app/api/zones
https://lms-application-pi.vercel.app/api/districts
https://lms-application-pi.vercel.app/api/designations
https://lms-application-pi.vercel.app/api/courses
https://lms-application-pi.vercel.app/api/institutes/{id}
```

**Token:** admin

Example — create a district:

```
POST https://lms-application-pi.vercel.app/api/districts
```

```json
{
  "name": "Ernakulam",
  "zone": "Central Zone",
  "description": "Central Kerala"
}
```

**Response `201`**

```json
{
  "_id": "6ae5b2e1...",
  "name": "Ernakulam",
  "zone": "Central Zone",
  "description": "Central Kerala"
}
```

Delete an institute:

```
DELETE https://lms-application-pi.vercel.app/api/institutes/6ae5b2e1...
```

```json
{
  "success": true,
  "message": "Institute Test College deleted successfully"
}
```

---

### 5.7 POST /api/set-password — reset a password

**URL**

```
https://lms-application-pi.vercel.app/api/set-password
```

**Token:** admin

**Body**

```json
{
  "employee_id": "BDE001",
  "password": "newpass123"
}
```

or

```json
{
  "email": "sanu@gmail.com",
  "password": "newpass123"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Password updated successfully"
}
```

---

### 5.8 Admin task templates and employee tasks

**URLs**

```
https://lms-application-pi.vercel.app/api/task-templates
https://lms-application-pi.vercel.app/api/task-templates/generate
https://lms-application-pi.vercel.app/api/employee-tasks
```

**Token:** admin

Create a task template:

```json
{
  "title": "Daily Lead Generation",
  "metric_type": "Leads Generated",
  "designation": "Business Development Executive",
  "frequency": "daily",
  "target_count": 15,
  "is_carry_over": true,
  "is_active": true,
  "description": "Generate 15 new leads per day"
}
```

**Response `201`**

```json
{
  "_id": "6ae5c1a2...",
  "title": "Daily Lead Generation",
  "metric_type": "Leads Generated",
  "designation": "Business Development Executive",
  "frequency": "daily",
  "target_count": 15,
  "is_carry_over": true,
  "is_active": true,
  "description": "Generate 15 new leads per day"
}
```

Generate today's employee tasks from the active templates:

```
POST https://lms-application-pi.vercel.app/api/task-templates/generate
```

```json
{
  "template_ids": ["6ae5c1a2..."]
}
```

**Response `200`**

```json
{
  "success": true,
  "generatedCount": 4,
  "message": "Generated 4 task(s) for \"Daily Lead Generation\"!"
}
```

---

### 5.9 Admin read-only visibility

The following employee-scoped endpoints accept an **admin token** and return
everything:

| Method | URL | Response |
|---|---|---|
| GET | `https://lms-application-pi.vercel.app/api/sm/asms` | `{ success, count, data: [ASM] }` |
| GET | `https://lms-application-pi.vercel.app/api/asm/bdes` | `{ success, count, data: [BDE] }` |
| GET | `https://lms-application-pi.vercel.app/api/teams` | `{ success, count, data: [Team] }` |
| GET | `https://lms-application-pi.vercel.app/api/tasks` | `{ success, count, data: { total, completed, pending, tasks, list } }` |
| GET | `https://lms-application-pi.vercel.app/api/wallet/requests` | `{ success, count, summary, data: [Request] }` |
| GET | `https://lms-application-pi.vercel.app/api/incentives` | `{ success, count, summary, data: [Incentive] }` |
| GET | `https://lms-application-pi.vercel.app/api/salary/requests` | `{ success, count, data: [SalaryRequest] }` |
| GET | `https://lms-application-pi.vercel.app/api/leads` | `{ success, count, data: [Lead] }` |
| GET | `https://lms-application-pi.vercel.app/api/leaves` | `{ success, count, data: [Leave] }` |
| GET | `https://lms-application-pi.vercel.app/api/attendance/history` | `{ success, count, data: [Attendance] }` |
| GET | `https://lms-application-pi.vercel.app/api/wallet/balance?employee_id=BDE001` | `{ success, data: { balance, ... } }` |

`GET /api/wallet/balance` as admin **must** include `?employee_id=` or
`?employee=`; otherwise it returns `400`.

---

### 5.10 POST /api/wallet/workflow — admin approval (releases money)

**URL**

```
https://lms-application-pi.vercel.app/api/wallet/workflow
```

**Token:** admin (for `sanction` / `pay`), ASM / SM also allowed for
`forward_to_sm` / `forward_to_accounts` / `reject` (see section 6 and 7).

**Body — sanction (Admin approves, money is released)**

```json
{
  "request_id": "WDR-2912",
  "action": "sanction",
  "remarks": "Approved"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Withdrawal request status updated to \"Approved\".",
  "data": {
    "_id": "6ae6cf0fc1cd50df3108c88e",
    "request_id": "WDR-2912",
    "name": "Vishnu Mohan",
    "employee_id": "BDE001",
    "amount": 500,
    "status": "Approved",
    "status_label": "Approved",
    "payment_date": "2026-11-01T05:35:00.000Z",
    "transaction_reference": "TXN-1793511188174",
    "approval_history": [
      {
        "step": "Step 4 - Accounts: Incentive withdrawal sanctioned",
        "actor": "Administrator",
        "role": "ADMIN",
        "action": "SANCTION",
        "remarks": "Approved",
        "timestamp": "2026-11-01T05:35:00.000Z"
      }
    ]
  }
}
```

**Body — mark paid**

```json
{
  "request_id": "WDR-2912",
  "action": "pay",
  "transaction_reference": "TXN-BANK-001"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Withdrawal request status updated to \"Paid\".",
  "data": {
    "request_id": "WDR-2912",
    "amount": 500,
    "status": "Paid",
    "status_label": "Paid",
    "transaction_reference": "TXN-BANK-001",
    "payment_date": "2026-11-01T05:36:00.000Z"
  }
}
```

`sanction` increments the BDE wallet's `total_paid`; `pay` only records the
final status, so the payout is never counted twice.

**Errors**

- `400` — invalid action, or the request is not in the required stage.
- `403` — action requires a role you do not have, or the request is outside
  your hierarchy.
- `404` — request not found.

---

### 5.11 POST /api/salary/workflow — admin approval

**URL**

```
https://lms-application-pi.vercel.app/api/salary/workflow
```

**Token:** admin (for `sanction` / `pay`)

**Body**

```json
{
  "request_id": "SAL-4821",
  "action": "sanction",
  "remarks": "Approved"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Salary request SAL-4821 status updated to \"Approved\".",
  "data": {
    "request_id": "SAL-4821",
    "employee_id": "BDE001",
    "employee_name": "Vishnu Mohan",
    "amount": 5000,
    "period": "November 2026",
    "status": "Approved",
    "status_label": "Approved"
  }
}
```

Valid actions: `forward_to_sm`, `asm_approve`, `forward_to_accounts`,
`sm_approve`, `sanction`, `approve`, `accounts_approve`, `pay`, `mark_paid`,
`reject`.

---

## 6. Sales Manager (SM) APIs

An SM token can call every employee API below, scoped to its whole subtree.

### 6.1 GET /api/home — SM dashboard

**URL**

```
https://lms-application-pi.vercel.app/api/home
```

**Token:** employee (SM)

**Response `200`**

```json
{
  "success": true,
  "message": "SM home dashboard loaded",
  "data": {
    "user": {
      "id": 103,
      "employee_id": "SM001",
      "name": "Sanu",
      "email": "sanu@gmail.com",
      "role": "SM"
    },
    "designation_id": 301,
    "designation_name": "Sales Manager",
    "dashboard_type": "sm",
    "team_name": "",
    "scope": {
      "role": "SM",
      "visible_employees": 3,
      "visible_bdes": 2,
      "visible_asms": 1
    },
    "attendance": {
      "check_in_time": "09:12 AM",
      "check_out_time": "--:--",
      "shift_status": "ONLINE",
      "is_checked_in": true,
      "location_lat": 10.0159,
      "location_lng": 76.3419
    },
    "eod_sync": {
      "tasks_completed": 1,
      "total_tasks": 15,
      "completion_percentage": 7
    },
    "operational_overview": {
      "assigned_leads": 5,
      "follow_up_leads": 2,
      "closed_leads": 1,
      "incentives_earned": 1000
    },
    "targets": {
      "daily_target": 15,
      "daily_achieved": 0,
      "daily_remaining": 15,
      "daily_percentage": 0,
      "monthly_target": 390,
      "monthly_achieved": 0,
      "monthly_remaining": 390,
      "monthly_percentage": 0,
      "period": "2026-11"
    },
    "tasks": {
      "total": 3,
      "completed": 1,
      "pending": 2,
      "completion_percentage": 33
    },
    "team_metrics": {
      "team_leads": 5,
      "team_admissions": 1,
      "team_conversion": "20%",
      "visits_pending": 2
    },
    "team_subordinate_status": {
      "bdes": [
        {
          "id": 105,
          "employee_id": "BDE001",
          "name": "Vishnu Mohan",
          "designation": "Business Development Executive",
          "conversion_percentage": "25%",
          "leads_assigned": "4",
          "online_status": "ONLINE",
          "online_time": "09:00 AM",
          "location_lat": 10.0159,
          "location_lng": 76.3419
        }
      ],
      "asms": [
        {
          "id": 104,
          "employee_id": "ASM001",
          "name": "Bipin Joseph",
          "designation": "Area Sales Manager",
          "team": "EKM Team",
          "leads_assigned": "4",
          "online_status": "ONLINE"
        }
      ]
    },
    "territory_report": [
      {
        "district_name": "Ernakulam",
        "target": 100,
        "achieved": 1,
        "growth_rate": "+12.5%"
      }
    ]
  }
}
```

---

### 6.2 GET /api/sm/asms — list ASMs

**URL**

```
https://lms-application-pi.vercel.app/api/sm/asms
```

**Token:** SM (admin also allowed; ASM/BDE get `403`)

**Query:** `?employee_id=ASM001` or `?id=<mongo id>` or `?email=...` for a
single ASM.

**Response `200`**

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "6ae5b1c2...",
      "employee_id": "ASM001",
      "name": "Bipin Joseph",
      "email": "bipin@kide.com",
      "contact_number": "9847000002",
      "designation": "Area Sales Manager",
      "team": "EKM Team",
      "districts": ["Ernakulam", "Thrissur"],
      "zone": "Central Zone",
      "reports_to": "SM001",
      "bdes_count": 1,
      "status": "active"
    }
  ]
}
```

Single lookup returns `{ "success": true, "data": { ... } }`.

---

### 6.3 GET /api/sm/asms/{id} — ASM detail

**URL**

```
https://lms-application-pi.vercel.app/api/sm/asms/ASM001
```

**Token:** SM

**Response `200`**

```json
{
  "success": true,
  "data": {
    "id": "6ae5b1c2...",
    "employee_id": "ASM001",
    "name": "Bipin Joseph",
    "team": "EKM Team",
    "districts": ["Ernakulam", "Thrissur"],
    "reports_to": "SM001",
    "bdes_count": 1
  }
}
```

---

### 6.4 POST /api/sm/create-asm — create a regional ASM or the Office Team

**URL**

```
https://lms-application-pi.vercel.app/api/sm/create-asm
```

**Token:** SM (admin gets `403`; Admin creates the SM instead)

**Body — regional team**

```json
{
  "name": "Bipin Joseph",
  "email": "bipin@kide.com",
  "contact_number": "9847000002",
  "password": "test1234",
  "team_code": "EKM"
}
```

**Body — office team**

```json
{
  "name": "Office Lead",
  "email": "office@kide.com",
  "contact_number": "9847000009",
  "password": "test1234",
  "team_code": "OFFICE"
}
```

**Response `201`**

```json
{
  "success": true,
  "message": "Area Sales Manager Bipin Joseph (ASM001) created successfully for EKM Team. Assigned districts: Ernakulam, Thrissur",
  "data": {
    "id": "6ae5b1c2...",
    "employee_id": "ASM001",
    "name": "Bipin Joseph",
    "designation": "Area Sales Manager",
    "team": "EKM Team",
    "districts": ["Ernakulam", "Thrissur"],
    "reports_to": "SM001",
    "sm_name": "Sanu"
  }
}
```

**Errors**

- `400` — invalid team code.
- `400` — team already has an ASM.
- `400` — district already assigned to another team.
- `400` — all 7 regional ASM positions filled.
- `400` — Office Team already exists.
- `400` — duplicate employee identity.
- `403` — caller is not SM/MD.

---

### 6.5 GET /api/asm/bdes — list BDEs in the subtree

**URL**

```
https://lms-application-pi.vercel.app/api/asm/bdes
```

**Token:** SM (ASM sees only its own BDEs; BDE gets `403`)

**Query:** `?asm_id=ASM001`, `?team=EKM Team`, `?employee_id=BDE001`

**Response `200`**

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "6ae5b1d4...",
      "employee_id": "BDE001",
      "name": "Vishnu Mohan",
      "email": "vishnu@kide.com",
      "contact_number": "9847000003",
      "designation": "Business Development Executive",
      "team": "EKM Team",
      "district": "Ernakulam",
      "zone": "Central Zone",
      "reports_to": "ASM001",
      "status": "active",
      "total_leads": 4,
      "admissions": 1,
      "conversion_rate": 25
    }
  ]
}
```

---

### 6.6 GET /api/asm/bdes/{id} — BDE detail

**URL**

```
https://lms-application-pi.vercel.app/api/asm/bdes/BDE001
```

**Token:** SM

**Response `200`**

```json
{
  "success": true,
  "data": {
    "employee_id": "BDE001",
    "name": "Vishnu Mohan",
    "team": "EKM Team",
    "district": "Ernakulam",
    "reports_to": "ASM001",
    "total_leads": 4,
    "admissions": 1,
    "conversion_rate": 25
  }
}
```

---

### 6.7 POST /api/asm/create-bde — create a BDE

**URL**

```
https://lms-application-pi.vercel.app/api/asm/create-bde
```

**Token:** SM / ASM / BDM (an ASM always creates under itself; an SM may target
`asm_id` inside its subtree)

**Body**

```json
{
  "name": "Vishnu Mohan",
  "email": "vishnu@kide.com",
  "contact_number": "9847000003",
  "password": "test1234",
  "district": "Ernakulam",
  "asm_id": "ASM001"
}
```

**Response `201`**

```json
{
  "success": true,
  "message": "Business Development Executive Vishnu Mohan (BDE001) created successfully under ASM Bipin Joseph (ASM001).",
  "data": {
    "id": "6ae5b1d4...",
    "employee_id": "BDE001",
    "name": "Vishnu Mohan",
    "designation": "Business Development Executive",
    "team": "EKM Team",
    "district": "Ernakulam",
    "reports_to": "ASM001",
    "asm_name": "Bipin Joseph"
  }
}
```

**Errors**

- `400` — the target is not a real ASM.
- `400` — duplicate name/email.
- `400` — the district is not part of the ASM's team.

---

### 6.8 GET /api/teams — the 8 teams

**URL**

```
https://lms-application-pi.vercel.app/api/teams
```

**Token:** SM (admin sees all; ASM/BDE see only their own team)

**Query:** `?team=EKM Team`

**Response `200`**

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "6ae5acb2b3bc1a44bc0db2c3",
      "name": "EKM Team",
      "districts": ["Ernakulam", "Thrissur"],
      "zone": "Central Zone",
      "team_lead": "Bipin Joseph (ASM001)",
      "team_lead_id": "ASM001",
      "is_office": false,
      "description": "EKM Team managing Ernakulam, Thrissur",
      "members_count": 2,
      "members": [
        {
          "employee_id": "ASM001",
          "name": "Bipin Joseph",
          "designation": "Area Sales Manager",
          "reports_to": "SM001"
        },
        {
          "employee_id": "BDE001",
          "name": "Vishnu Mohan",
          "designation": "Business Development Executive",
          "reports_to": "ASM001"
        }
      ]
    }
  ]
}
```

`members` is built from the live reporting hierarchy (`Employee.team`), so an
ASM/BDE only ever sees its own team. The SM sees the teams whose `team_lead` is
inside its subtree; an admin sees all 8.

---

### 6.9 GET /api/tasks — tasks in the subtree

**URL**

```
https://lms-application-pi.vercel.app/api/tasks
```

**Token:** employee

**Query:** `?mine=1`, `?status=pending`, `?team=EKM%20Team`,
`?assigned_to=BDE001`

**Response `200`**

```json
{
  "success": true,
  "count": 1,
  "data": {
    "total": 1,
    "completed": 0,
    "pending": 1,
    "tasks": [
      {
        "id": 575614,
        "_id": "6ae6cecbc1cd50df3108c87e",
        "title": "Call 10 new leads",
        "description": "Follow up with today's assigned leads",
        "assigned_to": "Vishnu Mohan",
        "assigned_to_id": "BDE001",
        "assigned_by": "Bipin Joseph",
        "assigned_by_id": "ASM001",
        "assigned_by_role": "ASM",
        "team": "EKM Team",
        "priority": "high",
        "status": "pending",
        "due_date": "2026-11-10",
        "target_count": 10,
        "completed_count": 0,
        "notes": "",
        "created_at": "2026-11-01T05:31:55.255Z",
        "updated_at": "2026-11-01T05:31:55.255Z"
      }
    ],
    "list": []
  }
}
```

`data.list` is identical to `data.tasks`.

---

### 6.10 POST /api/tasks — SM assigns a task to a team or an employee

**URL**

```
https://lms-application-pi.vercel.app/api/tasks
```

**Token:** SM / ASM / BDM (admin gets `403`; BDE gets `403`)

**Body — assign to a team (SM only)**

```json
{
  "title": "Verify EKM field reports",
  "description": "Cross-check the weekly lead sheet",
  "team": "EKM Team",
  "priority": "high",
  "due_date": "2026-11-15",
  "target_count": 25,
  "notes": "Report back to SM"
}
```

**Body — assign to an employee**

```json
{
  "title": "Monthly review",
  "assigned_to": "ASM001",
  "priority": "medium",
  "due_date": "2026-11-20",
  "target_count": 1
}
```

**Response `201`**

```json
{
  "success": true,
  "message": "Task assigned to Bipin Joseph.",
  "data": {
    "id": 123456,
    "_id": "6ae6cf00c1cd50df3108c88a",
    "title": "Verify EKM field reports",
    "description": "Cross-check the weekly lead sheet",
    "assigned_to": "Bipin Joseph",
    "assigned_to_id": "ASM001",
    "assigned_by": "Sanu",
    "assigned_by_id": "SM001",
    "assigned_by_role": "SM",
    "team": "EKM Team",
    "priority": "high",
    "status": "pending",
    "due_date": "2026-11-15",
    "target_count": 25,
    "completed_count": 0,
    "notes": "Report back to SM"
  }
}
```

**Errors**

- `400` — missing title / assignee.
- `403` — ASM tries to assign outside its direct reports.
- `403` — caller is Admin or BDE.
- `404` — employee/team not found.

---

### 6.11 PUT / PATCH /api/tasks — update a task

**URL**

```
https://lms-application-pi.vercel.app/api/tasks
```

**Token:** employee

**Body**

```json
{
  "id": "6ae6cf00c1cd50df3108c88a",
  "status": "in_progress",
  "priority": "medium",
  "completed_count": 5,
  "notes": "Half done"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Task updated successfully.",
  "data": {
    "_id": "6ae6cf00c1cd50df3108c88a",
    "title": "Verify EKM field reports",
    "status": "in_progress",
    "priority": "medium",
    "completed_count": 5,
    "notes": "Half done"
  }
}
```

Rules:

- The creator and managers in scope may edit everything.
- The assignee may edit **only** `status`, `completed_count`, `notes`.
- Any other field from the assignee returns `403`.

---

### 6.12 DELETE /api/tasks — delete a task

**URL**

```
https://lms-application-pi.vercel.app/api/tasks?id=6ae6cf00c1cd50df3108c88a
```

**Token:** employee

**Response `200`**

```json
{
  "success": true,
  "message": "Task deleted successfully."
}
```

Only the creator, a manager in scope, or an admin may delete.

---

### 6.13 GET /api/team — reporting tree

**URL**

```
https://lms-application-pi.vercel.app/api/team?scope=all
```

**Token:** employee

**Query:** `?scope=all` (SM only; default `direct`)

**Response `200`**

```json
{
  "success": true,
  "message": "Team fetched successfully",
  "data": {
    "is_manager": true,
    "role": "SM",
    "scope": "all",
    "manager": null,
    "members": [
      {
        "employee_id": "ASM001",
        "name": "Bipin Joseph",
        "designation": "Area Sales Manager",
        "reports_to": "SM001"
      },
      {
        "employee_id": "BDE001",
        "name": "Vishnu Mohan",
        "designation": "Business Development Executive",
        "reports_to": "ASM001"
      }
    ],
    "totals": {
      "members": 2,
      "tasks_total": 3,
      "tasks_completed": 1,
      "tasks_pending": 2,
      "leads_total": 5
    }
  }
}
```

---

### 6.14 GET /api/leads — leads in the subtree

**URL**

```
https://lms-application-pi.vercel.app/api/leads
```

**Token:** employee

**Query:** `?lead_id=LD-9730`, `?search=Rahul`, `?district=Ernakulam`,
`?status=4`, `?course=Flutter`, `?employee=Vishnu%20Mohan`

**Response `200` (employee token — mobile shape)**

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": 128,
      "lead_id": "LD-9730",
      "student_id": "STU-004",
      "name": "Rahul Krishna",
      "contact_number": "9847123456",
      "whats_number": "9847123456",
      "district": "Ernakulam",
      "place": "Edappally, Kochi",
      "course": "Full-Stack Web Development",
      "employee": "Vishnu Mohan",
      "employee_id": "BDE001",
      "student_interest": "Medium",
      "presentation": "Not Scheduled",
      "next_followup_date": "2026-11-05",
      "admission_status": "New",
      "status": 1,
      "lead_source": "Campus Drive / College Seminar",
      "source": 5,
      "created_at": "2026-11-01 05:30:00",
      "updated_at": "2026-11-01 05:30:00"
    }
  ]
}
```

**Response `200` (admin token — Mongo shape)**

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "_id": "6ae6d08fc1cd50df3108c8bd",
      "id": "6ae6d08fc1cd50df3108c8bd",
      "lead_id": "LD-9730",
      "name": "Rahul Krishna",
      "employee": "Vishnu Mohan",
      "employee_id": "BDE001",
      "admission_status": "New"
    }
  ]
}
```

Single-lead lookup returns `{ "success": true, "data": { ... } }`.

---

### 6.15 POST /api/leads — create a lead

**URL**

```
https://lms-application-pi.vercel.app/api/leads
```

**Token:** employee / admin

**Body**

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

**Response `201`**

```json
{
  "success": true,
  "message": "Lead Rahul Krishna (LD-9730) created successfully",
  "data": {
    "_id": "6ae6d08fc1cd50df3108c8bd",
    "id": "6ae6d08fc1cd50df3108c8bd",
    "lead_id": "LD-9730",
    "student_id": "STU-004",
    "name": "Rahul Krishna",
    "contact_number": "9847123456",
    "employee": "Vishnu Mohan",
    "employee_id": "BDE001",
    "admission_status": "New"
  }
}
```

An employee-created lead is always assigned to the caller. A manager may send
`employee` / `employee_id`, which must be inside their hierarchy.

---

### 6.16 PUT /api/leads — update a lead

**URL**

```
https://lms-application-pi.vercel.app/api/leads
```

**Token:** employee

**Body**

```json
{
  "lead_id": "LD-9730",
  "remarks": "Updated from Postman",
  "next_followup_date": "2026-11-08",
  "admission_status": "Follow-up"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Lead updated successfully",
  "data": {
    "_id": "6ae6d08fc1cd50df3108c8bd",
    "lead_id": "LD-9730",
    "name": "Rahul Krishna",
    "remarks": "Updated from Postman",
    "admission_status": "Follow-up",
    "next_followup_date": "2026-11-08"
  }
}
```

Employees cannot move a lead to another employee.

---

### 6.17 DELETE /api/leads — delete a lead

**URL**

```
https://lms-application-pi.vercel.app/api/leads?id=LD-9730
```

**Token:** employee

**Body (alternative)**

```json
{
  "ids": ["LD-9730", "LD-9731"]
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "1 lead(s) deleted successfully"
}
```

---

### 6.18 GET / POST /api/followups — follow-up pipeline

**URL**

```
https://lms-application-pi.vercel.app/api/followups
```

**Token:** employee

**GET query:** `?lead_id=LD-9730`, `?due=today|upcoming|overdue`,
`?presentation=Scheduled`, `?student_interest=Hot`

**GET response `200`**

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "6ae6d08fc1cd50df3108c8bd",
      "_id": "6ae6d08fc1cd50df3108c8bd",
      "lead_id": "LD-9730",
      "name": "Rahul Krishna",
      "contact_number": "9847123456",
      "district": "Ernakulam",
      "course": "Full-Stack Web Development",
      "employee": "Vishnu Mohan",
      "student_interest": "Hot",
      "presentation": "Scheduled",
      "next_followup_date": "2026-11-05",
      "admission_status": "Follow-up",
      "student_id": "STU-004",
      "total_followups": 2,
      "latest_followup": {
        "date": "2026-11-01",
        "remarks": "Discussed fees",
        "student_interest": "Hot",
        "presentation": "Scheduled",
        "next_followup_date": "2026-11-05",
        "admission_status": "Follow-up",
        "recorded_by": "Vishnu Mohan"
      },
      "followups": []
    }
  ]
}
```

**POST body**

```json
{
  "lead_id": "LD-9730",
  "remarks": "Called the student",
  "next_followup_date": "2026-11-06",
  "student_interest": "Hot",
  "presentation": "Scheduled",
  "admission_status": "Follow-up"
}
```

**POST response `200`**

```json
{
  "success": true,
  "message": "Follow-up logged successfully for Rahul Krishna (LD-9730)",
  "data": {
    "_id": "6ae6d08fc1cd50df3108c8bd",
    "lead_id": "LD-9730",
    "admission_status": "Follow-up",
    "followups": []
  }
}
```

---

### 6.19 POST /api/leads/{id}/followup — record a follow-up

**URL**

```
https://lms-application-pi.vercel.app/api/leads/LD-9730/followup
```

**Token:** employee

**Body**

```json
{
  "remarks": "Discussed fees",
  "next_followup_date": "2026-11-05",
  "student_interest": "Hot",
  "admission_status": "Follow-up"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Follow-up recorded successfully",
  "data": {
    "lead_id": "LD-9730",
    "student_id": "STU-004",
    "name": "Rahul Krishna",
    "admission_status": "Follow-up",
    "next_followup_date": "2026-11-05",
    "remarks": "Discussed fees",
    "total_followups": 3
  }
}
```

`POST /api/leads/{id}/follow-up` is an alias.

---

### 6.20 POST /api/leads/{id}/close — close an admission (₹1,000 incentive)

**URL**

```
https://lms-application-pi.vercel.app/api/leads/LD-9730/close
```

**Token:** employee

**Body**

```json
{
  "student_id": "STU-004",
  "course": "Full-Stack Web Development",
  "payment": 50000,
  "payment_verification": "Verified",
  "remarks": "Admission confirmed"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Lead Rahul Krishna successfully closed as Admission (STU-004). ₹1,000 incentive credited to Vishnu Mohan.",
  "data": {
    "lead_id": "LD-9730",
    "student_id": "STU-004",
    "name": "Rahul Krishna",
    "status": 4,
    "admission_status": "Admitted",
    "incentive_earned": 1000,
    "incentive_id": "6ae6d091c1cd50df3108c8bf",
    "bde": "Vishnu Mohan",
    "team": "EKM Team"
  }
}
```

`student_id` is mandatory and must match the lead's registered student ID.
The close credits ₹1,000 to the closing BDE's wallet and creates an `Incentive`
record exactly once per lead.

---

### 6.21 GET /api/attendance/history

**URL**

```
https://lms-application-pi.vercel.app/api/attendance/history
```

**Token:** employee

**Query:** `?month=2026-11`, `?employee_id=BDE001`

**Response `200`**

```json
{
  "success": true,
  "message": "Attendance history loaded",
  "count": 1,
  "data": [
    {
      "date": "2026-11-01",
      "check_in": "09:12 AM",
      "check_out": "--:--",
      "hours_worked": 8,
      "status": "PRESENT"
    }
  ]
}
```

---

### 6.22 GET /api/leaves — leave applications in the subtree

**URL**

```
https://lms-application-pi.vercel.app/api/leaves
```

**Token:** employee

**Query:** `?employee=Vishnu%20Mohan`

**Response `200`**

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": 12,
      "_id": "6ae6d0a1c1cd50df3108c8c1",
      "employee": "Vishnu Mohan",
      "leave_type": "Casual Leave",
      "start_date": "2026-11-10",
      "end_date": "2026-11-11",
      "reason": "Personal work",
      "status": "Pending"
    }
  ]
}
```

---

### 6.23 POST /api/leaves/apply — apply for leave

**URL**

```
https://lms-application-pi.vercel.app/api/leaves/apply
```

**Token:** employee

**Body**

```json
{
  "leave_type": "Casual Leave",
  "start_date": "2026-11-10",
  "end_date": "2026-11-11",
  "reason": "Personal work"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Leave applied successfully",
  "data": {
    "id": 13,
    "_id": "6ae6d0b2c1cd50df3108c8c2",
    "leave_type": "Casual Leave",
    "start_date": "2026-11-10",
    "end_date": "2026-11-11",
    "status": "Pending"
  }
}
```

The employee name always comes from the token.

---

### 6.24 GET /api/incentives

**URL**

```
https://lms-application-pi.vercel.app/api/incentives
```

**Token:** employee

**Response `200`**

```json
{
  "success": true,
  "count": 1,
  "summary": {
    "total_incentives": 1000,
    "paid_incentives": 0,
    "pending_incentives": 1000
  },
  "data": [
    {
      "_id": "6ae6d091c1cd50df3108c8bf",
      "lead_id": "LD-9730",
      "student_id": "STU-004",
      "student_name": "Rahul Krishna",
      "course": "Full-Stack Web Development",
      "bde_id": "BDE001",
      "bde_name": "Vishnu Mohan",
      "asm_id": "ASM001",
      "asm_name": "Bipin Joseph",
      "team": "EKM Team",
      "amount": 1000,
      "status": "Earned",
      "admission_date": "2026-11-01T05:30:00.000Z"
    }
  ]
}
```

Scope-override params (`?bde_id=`, `?asm_id=`, `?team=`) are ignored for
employee tokens. Only an admin may narrow by them.

---

### 6.25 GET /api/wallet/requests — withdrawal requests in the subtree

**URL**

```
https://lms-application-pi.vercel.app/api/wallet/requests
```

**Token:** employee

**Query:** `?status=pending|approved|paid|rejected`, `?request_id=WDR-2912`

**Response `200`**

```json
{
  "success": true,
  "count": 1,
  "summary": {
    "total": 1,
    "pending": 1,
    "approved": 0,
    "paid": 0,
    "rejected": 0,
    "pending_amount": 500
  },
  "data": [
    {
      "id": "6ae6cf0fc1cd50df3108c88e",
      "request_id": "WDR-2912",
      "name": "Vishnu Mohan",
      "employee": "Vishnu Mohan",
      "employee_id": "BDE001",
      "designation": "Business Development Executive",
      "team": "EKM Team",
      "asm_id": "ASM001",
      "asm_name": "Bipin Joseph",
      "sm_id": "",
      "sm_name": "",
      "amount": 500,
      "available_balance": 2000,
      "status": "Submitted to ASM",
      "status_label": "Pending",
      "remarks": "test",
      "approval_history": [],
      "transaction_reference": "",
      "payment_date": null,
      "created_at": "2026-11-01T05:34:00.000Z",
      "updated_at": "2026-11-01T05:34:00.000Z"
    }
  ]
}
```

---

### 6.26 GET /api/wallet/balance — wallet of a scoped employee

**URL**

```
https://lms-application-pi.vercel.app/api/wallet/balance
```

**Token:** employee (always own wallet)

**Response `200`**

```json
{
  "success": true,
  "data": {
    "balance": 1500,
    "total_earned": 2000,
    "totalEarned": 2000,
    "total_paid": 500,
    "totalPaid": 500,
    "currency": "INR",
    "employee": "Vishnu Mohan",
    "withdraw_requests": {
      "data": [
        {
          "id": 2912,
          "reference_id": "WDR-2912",
          "amount": 500,
          "status": 2,
          "status_label": "Approved",
          "stage": "Approved",
          "remarks": "test",
          "created_at": "2026-11-01T05:34:00.000Z"
        }
      ]
    },
    "withdrawRequests": {
      "data": []
    }
  }
}
```

Numeric `status`: `1` Pending, `2` Approved, `3` Paid, `4` Rejected.

---

### 6.27 POST /api/wallet/workflow — SM forwards to Accounts

**URL**

```
https://lms-application-pi.vercel.app/api/wallet/workflow
```

**Token:** SM

**Body**

```json
{
  "request_id": "WDR-2912",
  "action": "forward_to_accounts",
  "remarks": "Verified"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Withdrawal request status updated to \"Forwarded to Accounts\".",
  "data": {
    "request_id": "WDR-2912",
    "amount": 500,
    "status": "Forwarded to Accounts",
    "status_label": "Pending"
  }
}
```

The request must currently be `Forwarded to SM`. SM may also `reject`.

---

### 6.28 GET /api/salary/requests

**URL**

```
https://lms-application-pi.vercel.app/api/salary/requests
```

**Token:** employee

**Response `200`**

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "_id": "6ae6d0c3c1cd50df3108c8c3",
      "request_id": "SAL-4821",
      "employee_id": "BDE001",
      "employee_name": "Vishnu Mohan",
      "designation": "Business Development Executive",
      "team": "EKM Team",
      "asm_id": "ASM001",
      "asm_name": "Bipin Joseph",
      "amount": 5000,
      "period": "November 2026",
      "attendance_days": 30,
      "remarks": "Monthly",
      "status": "Submitted to ASM",
      "status_label": "Pending",
      "approval_history": []
    }
  ]
}
```

---

### 6.29 POST /api/salary/workflow — SM forwards to Accounts

**URL**

```
https://lms-application-pi.vercel.app/api/salary/workflow
```

**Token:** SM

**Body**

```json
{
  "request_id": "SAL-4821",
  "action": "forward_to_accounts"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Salary request SAL-4821 status updated to \"Forwarded to Accounts\".",
  "data": {
    "request_id": "SAL-4821",
    "status": "Forwarded to Accounts",
    "status_label": "Pending"
  }
}
```

---

### 6.30 Catalogs available to every employee token

| Method | URL | Response |
|---|---|---|
| GET | `https://lms-application-pi.vercel.app/api/zones` | `{ success, data: [{ _id, name, description }] }` |
| GET | `https://lms-application-pi.vercel.app/api/districts` | `[{ _id, name, zone, description }]` |
| GET | `https://lms-application-pi.vercel.app/api/designations` | `[{ _id, name, prefix }]` |
| GET | `https://lms-application-pi.vercel.app/api/courses` | `[{ _id, name }]` |
| GET | `https://lms-application-pi.vercel.app/api/sources` | `{ success, data: [{ id, name }] }` |
| GET | `https://lms-application-pi.vercel.app/api/hierarchy/filters` | `{ success, message, data: { zones, districts, designations, teams } }` |
| GET | `https://lms-application-pi.vercel.app/api/institutes` | `{ success, data: [Institute] }` |
| POST | `https://lms-application-pi.vercel.app/api/institutes` | `{ success, message, data: Institute }` (201) |

---

## 7. Area Sales Manager (ASM) APIs

An ASM token is scoped to **itself + its direct reports**. It gets `403` on
`/api/sm/asms` and `/api/sm/create-asm`.

### 7.1 GET /api/home — ASM dashboard

**URL**

```
https://lms-application-pi.vercel.app/api/home
```

**Token:** employee (ASM)

**Response `200`** — same shape as the SM dashboard with:

```json
{
  "success": true,
  "message": "ASM home dashboard loaded",
  "data": {
    "user": { "employee_id": "ASM001", "name": "Bipin Joseph", "role": "ASM" },
    "designation_id": 401,
    "designation_name": "Area Sales Manager",
    "dashboard_type": "asm",
    "team_name": "EKM Team",
    "scope": {
      "role": "ASM",
      "visible_employees": 2,
      "visible_bdes": 1,
      "visible_asms": 0
    },
    "targets": {
      "daily_target": 15,
      "daily_achieved": 0,
      "daily_remaining": 15,
      "daily_percentage": 0,
      "monthly_target": 390,
      "monthly_achieved": 0,
      "monthly_remaining": 390,
      "monthly_percentage": 0,
      "period": "2026-11"
    },
    "tasks": {
      "total": 3,
      "completed": 1,
      "pending": 2,
      "completion_percentage": 33
    },
    "operational_overview": {
      "assigned_leads": 4,
      "follow_up_leads": 2,
      "closed_leads": 1,
      "incentives_earned": 1000
    }
  }
}
```

---

### 7.2 GET /api/asm/bdes — own BDEs

**URL**

```
https://lms-application-pi.vercel.app/api/asm/bdes
```

**Token:** ASM

**Response `200`**

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "6ae5b1d4...",
      "employee_id": "BDE001",
      "name": "Vishnu Mohan",
      "designation": "Business Development Executive",
      "team": "EKM Team",
      "district": "Ernakulam",
      "reports_to": "ASM001",
      "status": "active",
      "total_leads": 4,
      "admissions": 1,
      "conversion_rate": 25
    }
  ]
}
```

A BDE token gets `403`.

---

### 7.3 GET /api/asm/bdes/{id} — own BDE detail

**URL**

```
https://lms-application-pi.vercel.app/api/asm/bdes/BDE001
```

**Token:** ASM

**Response `200`**

```json
{
  "success": true,
  "data": {
    "employee_id": "BDE001",
    "name": "Vishnu Mohan",
    "team": "EKM Team",
    "reports_to": "ASM001",
    "total_leads": 4,
    "admissions": 1,
    "conversion_rate": 25
  }
}
```

---

### 7.4 POST /api/asm/create-bde — create a BDE under yourself

**URL**

```
https://lms-application-pi.vercel.app/api/asm/create-bde
```

**Token:** ASM

**Body**

```json
{
  "name": "Anand Raj",
  "email": "anand@kide.com",
  "contact_number": "9847000011",
  "password": "test1234",
  "district": "Thrissur"
}
```

**Response `201`**

```json
{
  "success": true,
  "message": "Business Development Executive Anand Raj (BDE003) created successfully under ASM Bipin Joseph (ASM001).",
  "data": {
    "id": "6ae6d0e4c1cd50df3108c8c4",
    "employee_id": "BDE003",
    "name": "Anand Raj",
    "designation": "Business Development Executive",
    "team": "EKM Team",
    "district": "Thrissur",
    "reports_to": "ASM001",
    "asm_name": "Bipin Joseph"
  }
}
```

`asm_id` in the body is ignored — an ASM always creates under itself. The
district must belong to the ASM's team.

---

### 7.5 GET /api/teams — own team

**URL**

```
https://lms-application-pi.vercel.app/api/teams
```

**Token:** ASM

**Response `200`**

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "6ae5acb2b3bc1a44bc0db2c3",
      "name": "EKM Team",
      "districts": ["Ernakulam", "Thrissur"],
      "zone": "Central Zone",
      "team_lead": "Bipin Joseph (ASM001)",
      "team_lead_id": "ASM001",
      "is_office": false,
      "members_count": 2,
      "members": [
        {
          "employee_id": "ASM001",
          "name": "Bipin Joseph",
          "designation": "Area Sales Manager",
          "reports_to": "SM001"
        },
        {
          "employee_id": "BDE001",
          "name": "Vishnu Mohan",
          "designation": "Business Development Executive",
          "reports_to": "ASM001"
        }
      ]
    }
  ]
}
```

---

### 7.6 GET /api/tasks — own tasks + BDE tasks

**URL**

```
https://lms-application-pi.vercel.app/api/tasks
```

**Token:** ASM

**Response `200`** — same shape as section 6.9, limited to the ASM's own tasks
and its BDEs' tasks.

---

### 7.7 POST /api/tasks — ASM assigns a task to a BDE

**URL**

```
https://lms-application-pi.vercel.app/api/tasks
```

**Token:** ASM

**Body**

```json
{
  "title": "Call 10 new leads",
  "description": "Follow up with today's assigned leads",
  "assigned_to": "BDE001",
  "priority": "high",
  "due_date": "2026-11-10",
  "target_count": 10
}
```

**Response `201`**

```json
{
  "success": true,
  "message": "Task assigned to Vishnu Mohan.",
  "data": {
    "_id": "6ae6cecbc1cd50df3108c87e",
    "title": "Call 10 new leads",
    "assigned_to": "Vishnu Mohan",
    "assigned_to_id": "BDE001",
    "assigned_by": "Bipin Joseph",
    "assigned_by_id": "ASM001",
    "assigned_by_role": "ASM",
    "team": "EKM Team",
    "priority": "high",
    "status": "pending",
    "due_date": "2026-11-10",
    "target_count": 10,
    "completed_count": 0
  }
}
```

An ASM may assign only to itself or its direct reports. Assigning to a team
returns `403`.

---

### 7.8 PUT / PATCH /api/tasks — ASM updates a task

**URL**

```
https://lms-application-pi.vercel.app/api/tasks
```

**Token:** ASM

**Body**

```json
{
  "id": "6ae6cecbc1cd50df3108c87e",
  "priority": "medium",
  "notes": "Reviewed"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Task updated successfully.",
  "data": {
    "_id": "6ae6cecbc1cd50df3108c87e",
    "priority": "medium",
    "notes": "Reviewed"
  }
}
```

---

### 7.9 DELETE /api/tasks — ASM deletes a task it manages

**URL**

```
https://lms-application-pi.vercel.app/api/tasks?id=6ae6cecbc1cd50df3108c87e
```

**Token:** ASM

**Response `200`**

```json
{
  "success": true,
  "message": "Task deleted successfully."
}
```

---

### 7.10 GET /api/team — direct reports

**URL**

```
https://lms-application-pi.vercel.app/api/team
```

**Token:** ASM

**Response `200`**

```json
{
  "success": true,
  "message": "Team fetched successfully",
  "data": {
    "is_manager": true,
    "role": "ASM",
    "scope": "direct",
    "manager": {
      "employee_id": "SM001",
      "name": "Sanu"
    },
    "members": [
      {
        "employee_id": "BDE001",
        "name": "Vishnu Mohan",
        "designation": "Business Development Executive",
        "reports_to": "ASM001"
      }
    ],
    "totals": {
      "members": 1,
      "tasks_total": 2,
      "tasks_completed": 1,
      "tasks_pending": 1,
      "leads_total": 4
    }
  }
}
```

---

### 7.11 Leads, follow-ups, attendance, leaves, incentives

The ASM uses the same endpoints as section 6, scoped to itself + its BDEs:

| Method | URL |
|---|---|
| GET / POST / PUT / DELETE | `https://lms-application-pi.vercel.app/api/leads` |
| GET / POST | `https://lms-application-pi.vercel.app/api/followups` |
| POST | `https://lms-application-pi.vercel.app/api/leads/{id}/followup` |
| POST | `https://lms-application-pi.vercel.app/api/leads/{id}/close` |
| GET | `https://lms-application-pi.vercel.app/api/attendance/history` |
| GET | `https://lms-application-pi.vercel.app/api/leaves` |
| POST | `https://lms-application-pi.vercel.app/api/leaves/apply` |
| GET | `https://lms-application-pi.vercel.app/api/incentives` |
| GET | `https://lms-application-pi.vercel.app/api/wallet/requests` |
| GET | `https://lms-application-pi.vercel.app/api/wallet/balance` |
| GET | `https://lms-application-pi.vercel.app/api/salary/requests` |

---

### 7.12 POST /api/wallet/workflow — ASM forwards to SM

**URL**

```
https://lms-application-pi.vercel.app/api/wallet/workflow
```

**Token:** ASM

**Body**

```json
{
  "request_id": "WDR-2912",
  "action": "forward_to_sm",
  "remarks": "Verified"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Withdrawal request status updated to \"Forwarded to SM\".",
  "data": {
    "request_id": "WDR-2912",
    "amount": 500,
    "status": "Forwarded to SM",
    "status_label": "Pending"
  }
}
```

The request must be `Submitted to ASM` and inside the ASM's hierarchy. ASM may
also `reject` (the amount is refunded to the BDE's wallet).

---

### 7.13 POST /api/salary/workflow — ASM forwards to SM

**URL**

```
https://lms-application-pi.vercel.app/api/salary/workflow
```

**Token:** ASM

**Body**

```json
{
  "request_id": "SAL-4821",
  "action": "forward_to_sm",
  "remarks": "Attendance verified"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Salary request SAL-4821 status updated to \"Forwarded to SM\".",
  "data": {
    "request_id": "SAL-4821",
    "status": "Forwarded to SM",
    "status_label": "Pending"
  }
}
```

---

## 8. BDE / employee APIs

A BDE token can only see and change **its own** data.

### 8.1 GET /api/home — BDE dashboard

**URL**

```
https://lms-application-pi.vercel.app/api/home
```

**Token:** employee (BDE)

**Response `200`**

```json
{
  "success": true,
  "message": "BDE home dashboard loaded",
  "data": {
    "user": {
      "employee_id": "BDE001",
      "name": "Vishnu Mohan",
      "role": "BDE"
    },
    "designation_id": 501,
    "designation_name": "Business Development Executive",
    "dashboard_type": "bde",
    "team_name": "EKM Team",
    "scope": {
      "role": "BDE",
      "visible_employees": 1,
      "visible_bdes": 0,
      "visible_asms": 0
    },
    "attendance": {
      "check_in_time": "09:12 AM",
      "check_out_time": "--:--",
      "shift_status": "ONLINE",
      "is_checked_in": true,
      "location_lat": 10.0159,
      "location_lng": 76.3419
    },
    "operational_overview": {
      "assigned_leads": 4,
      "follow_up_leads": 2,
      "closed_leads": 1,
      "incentives_earned": 1000
    },
    "targets": {
      "daily_target": 15,
      "daily_achieved": 0,
      "daily_remaining": 15,
      "daily_percentage": 0,
      "monthly_target": 390,
      "monthly_achieved": 0,
      "monthly_remaining": 390,
      "monthly_percentage": 0,
      "period": "2026-11"
    },
    "tasks": {
      "total": 2,
      "completed": 1,
      "pending": 1,
      "completion_percentage": 50
    },
    "team_metrics": {
      "team_leads": 4,
      "team_admissions": 1,
      "team_conversion": "25%",
      "visits_pending": 2
    },
    "team_subordinate_status": {
      "bdes": [],
      "asms": []
    }
  }
}
```

---

### 8.2 GET /api/profile — own profile

**URL**

```
https://lms-application-pi.vercel.app/api/profile
```

**Token:** employee

**Response `200`**

```json
{
  "success": true,
  "message": "Profile loaded",
  "data": {
    "id": "6ae5b1d4...",
    "employee_id": "BDE001",
    "name": "Vishnu Mohan",
    "designation": "Business Development Executive",
    "designation_name": "Business Development Executive",
    "email": "vishnu@kide.com",
    "contact_number": "9847000003",
    "phone": "9847000003",
    "team": "EKM Team",
    "zone": "Central Zone",
    "district": "Ernakulam",
    "reports_to": "ASM001",
    "leave_balances": {
      "casual": 12,
      "medical": 8,
      "earned": 15
    }
  }
}
```

`GET /api/auth/me` is an alias of this endpoint.

---

### 8.3 POST /api/auth/refresh-token

**URL**

```
https://lms-application-pi.vercel.app/api/auth/refresh-token
```

**Token:** valid Bearer token (or `{ "token": "..." }` in the body)

**Body:** none required when the Authorization header is present.

**Response `200`**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

An invalid/expired token returns `401`.

---

### 8.4 GET /api/operations — combined operations data

**URL**

```
https://lms-application-pi.vercel.app/api/operations
```

**Token:** employee

**Response `200`**

```json
{
  "success": true,
  "message": "Operations data fetched successfully",
  "data": {
    "leaves": [
      {
        "_id": "6ae6d0a1c1cd50df3108c8c1",
        "employee": "Vishnu Mohan",
        "leave_type": "Casual Leave",
        "start_date": "2026-11-10",
        "end_date": "2026-11-11",
        "status": "Pending"
      }
    ],
    "wallet": {
      "balance": 0,
      "currency": "INR"
    },
    "attendance": {
      "today": {
        "date": "2026-11-01",
        "check_in": "09:12 AM",
        "check_out": null,
        "status": "ONLINE"
      },
      "records": []
    },
    "tasks": [
      {
        "_id": "6ae6d101c1cd50df3108c8c5",
        "employee": "Vishnu Mohan",
        "task_template": "Daily Lead Generation",
        "total_target": 15,
        "achieved": 4,
        "is_completed": false
      }
    ],
    "summary": {
      "leaves_pending": 1,
      "leaves_approved": 0,
      "tasks_pending": 1,
      "tasks_completed": 0
    }
  }
}
```

---

### 8.5 GET /api/team — own team view

**URL**

```
https://lms-application-pi.vercel.app/api/team
```

**Token:** employee (BDE)

**Response `200`**

```json
{
  "success": true,
  "message": "Team fetched successfully",
  "data": {
    "is_manager": false,
    "role": "BDE",
    "scope": "direct",
    "manager": {
      "employee_id": "ASM001",
      "name": "Bipin Joseph"
    },
    "members": [],
    "totals": {
      "members": 0,
      "tasks_total": 0,
      "tasks_completed": 0,
      "tasks_pending": 0,
      "leads_total": 0
    }
  }
}
```

---

### 8.6 GET /api/teams — own team

**URL**

```
https://lms-application-pi.vercel.app/api/teams
```

**Token:** employee (BDE)

**Response `200`**

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "6ae5acb2b3bc1a44bc0db2c3",
      "name": "EKM Team",
      "districts": ["Ernakulam", "Thrissur"],
      "team_lead": "Bipin Joseph (ASM001)",
      "team_lead_id": "ASM001",
      "is_office": false,
      "members_count": 2
    }
  ]
}
```

---

### 8.7 Leads

#### GET /api/leads

**URL**

```
https://lms-application-pi.vercel.app/api/leads
```

**Token:** employee

**Response `200`**

```json
{
  "success": true,
  "count": 4,
  "data": [
    {
      "id": 128,
      "lead_id": "LD-9730",
      "student_id": "STU-004",
      "name": "Rahul Krishna",
      "contact_number": "9847123456",
      "district": "Ernakulam",
      "course": "Full-Stack Web Development",
      "employee": "Vishnu Mohan",
      "admission_status": "New",
      "status": 1
    }
  ]
}
```

#### POST /api/leads/create

**URL**

```
https://lms-application-pi.vercel.app/api/leads/create
```

**Token:** employee

**Body**

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
  "notes": "Interested in weekend batch"
}
```

**Response `201`**

```json
{
  "success": true,
  "message": "Lead Rahul Krishna (LD-9730) created successfully",
  "endpoint": "/api/leads/create",
  "authorized_by": "employee",
  "data": {
    "id": 128,
    "lead_id": "LD-9730",
    "student_id": "STU-004",
    "name": "Rahul Krishna",
    "contact_number": "9847123456",
    "employee": "Vishnu Mohan",
    "employee_id": "BDE001",
    "admission_status": "New",
    "status": 1
  }
}
```

`GET /api/leads/create` returns the field guide and the 5 most recent leads in
your hierarchy.

#### GET /api/leads/next-student-id

**URL**

```
https://lms-application-pi.vercel.app/api/leads/next-student-id
```

**Token:** employee

**Response `200`**

```json
{
  "success": true,
  "student_id": "STU-005",
  "data": {
    "student_id": "STU-005"
  }
}
```

#### POST /api/leads/import

**URL**

```
https://lms-application-pi.vercel.app/api/leads/import
```

**Token:** employee

**Body (JSON)**

```json
{
  "csv": "name,phone,district,course\nImport One,9000000004,Ernakulam,Flutter"
}
```

Multipart form-data with a `file` field is also accepted.

**Response `200`**

```json
{
  "success": true,
  "message": "Successfully imported 1 leads",
  "data": {
    "total_imported": 1,
    "imported_count": 1,
    "skipped_count": 0
  }
}
```

#### PUT /api/leads

**URL**

```
https://lms-application-pi.vercel.app/api/leads
```

**Token:** employee

**Body**

```json
{
  "lead_id": "LD-9730",
  "remarks": "Updated from Postman"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Lead updated successfully",
  "data": {
    "_id": "6ae6d08fc1cd50df3108c8bd",
    "lead_id": "LD-9730",
    "remarks": "Updated from Postman"
  }
}
```

#### DELETE /api/leads

**URL**

```
https://lms-application-pi.vercel.app/api/leads?id=LD-9730
```

**Token:** employee

**Response `200`**

```json
{
  "success": true,
  "message": "1 lead(s) deleted successfully"
}
```

---

### 8.8 Follow-ups and admission close

| Method | URL | Body / response |
|---|---|---|
| GET | `https://lms-application-pi.vercel.app/api/followups` | `{ success, count, data: [FollowUp] }` |
| GET | `https://lms-application-pi.vercel.app/api/followups?lead_id=LD-9730` | `{ success, data: { lead_id, followups: [] } }` |
| POST | `https://lms-application-pi.vercel.app/api/followups` | `{ lead_id, remarks, next_followup_date }` |
| POST | `https://lms-application-pi.vercel.app/api/leads/LD-9730/followup` | `{ remarks, next_followup_date, student_interest }` |
| POST | `https://lms-application-pi.vercel.app/api/leads/LD-9730/close` | `{ student_id, course, payment, payment_verification }` |

Close response:

```json
{
  "success": true,
  "message": "Lead Rahul Krishna successfully closed as Admission (STU-004). ₹1,000 incentive credited to Vishnu Mohan.",
  "data": {
    "lead_id": "LD-9730",
    "student_id": "STU-004",
    "status": 4,
    "admission_status": "Admitted",
    "incentive_earned": 1000,
    "bde": "Vishnu Mohan",
    "team": "EKM Team"
  }
}
```

---

### 8.9 Attendance

#### GET /api/attendance

**URL**

```
https://lms-application-pi.vercel.app/api/attendance
```

**Token:** employee

**Response `200`**

```json
{
  "success": true,
  "message": "Attendance fetched successfully",
  "data": {
    "today": {
      "date": "2026-11-01",
      "check_in": "09:12 AM",
      "check_out": null,
      "status": "ONLINE"
    },
    "records": []
  }
}
```

#### GET /api/attendance/status

**URL**

```
https://lms-application-pi.vercel.app/api/attendance/status
```

**Token:** employee

**Response `200`**

```json
{
  "success": true,
  "message": "Attendance status loaded",
  "data": {
    "employee_id": "BDE001",
    "name": "Vishnu Mohan",
    "date": "2026-11-01",
    "check_in": "09:12 AM",
    "check_out": null,
    "status": "ONLINE",
    "shift_status": "ONLINE",
    "is_checked_in": true,
    "checked_in": true,
    "checked_out": false,
    "hours_worked": 0,
    "latitude": 10.0159,
    "longitude": 76.3419
  }
}
```

#### POST /api/attendance/check-in

**URL**

```
https://lms-application-pi.vercel.app/api/attendance/check-in
```

**Token:** employee

**Body**

```json
{
  "latitude": 10.0159,
  "longitude": 76.3419,
  "address": "Kochi"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Checked in successfully at 09:12 AM.",
  "data": {
    "date": "2026-11-01",
    "check_in": "09:12 AM",
    "status": "ONLINE",
    "hours_worked": 0
  }
}
```

#### POST /api/attendance/check-out

**URL**

```
https://lms-application-pi.vercel.app/api/attendance/check-out
```

**Token:** employee

**Body**

```json
{
  "notes": "Done for the day"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Checked out successfully at 06:05 PM.",
  "data": {
    "date": "2026-11-01",
    "check_in": "09:12 AM",
    "check_out": "06:05 PM",
    "hours_worked": 8.88,
    "status": "OFFLINE"
  }
}
```

#### GET /api/attendance/history

**URL**

```
https://lms-application-pi.vercel.app/api/attendance/history?month=2026-11
```

**Token:** employee

**Response `200`**

```json
{
  "success": true,
  "message": "Attendance history loaded",
  "count": 1,
  "data": [
    {
      "date": "2026-11-01",
      "check_in": "09:12 AM",
      "check_out": "06:05 PM",
      "hours_worked": 8.88,
      "status": "PRESENT"
    }
  ]
}
```

---

### 8.10 Tasks

#### GET /api/tasks

**URL**

```
https://lms-application-pi.vercel.app/api/tasks
```

**Token:** employee

**Query:** `?mine=1`

**Response `200`**

```json
{
  "success": true,
  "count": 2,
  "data": {
    "total": 2,
    "completed": 1,
    "pending": 1,
    "tasks": [
      {
        "id": 575614,
        "_id": "6ae6cecbc1cd50df3108c87e",
        "title": "Call 10 new leads",
        "assigned_to": "Vishnu Mohan",
        "assigned_to_id": "BDE001",
        "assigned_by": "Bipin Joseph",
        "assigned_by_role": "ASM",
        "team": "EKM Team",
        "priority": "high",
        "status": "pending",
        "due_date": "2026-11-10",
        "target_count": 10,
        "completed_count": 0
      }
    ],
    "list": []
  }
}
```

#### PUT /api/tasks — update own progress only

**URL**

```
https://lms-application-pi.vercel.app/api/tasks
```

**Token:** employee

**Body**

```json
{
  "id": "6ae6cecbc1cd50df3108c87e",
  "status": "completed",
  "completed_count": 10,
  "notes": "All leads called"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Task updated successfully.",
  "data": {
    "_id": "6ae6cecbc1cd50df3108c87e",
    "status": "completed",
    "completed_count": 10,
    "notes": "All leads called"
  }
}
```

A BDE may send **only** `status`, `completed_count` and `notes`. Any other field
returns `403`.

---

### 8.11 Leaves

#### GET /api/leaves

**URL**

```
https://lms-application-pi.vercel.app/api/leaves
```

**Token:** employee

**Response `200`**

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": 12,
      "_id": "6ae6d0a1c1cd50df3108c8c1",
      "employee": "Vishnu Mohan",
      "leave_type": "Casual Leave",
      "start_date": "2026-11-10",
      "end_date": "2026-11-11",
      "reason": "Personal work",
      "status": "Pending"
    }
  ]
}
```

#### POST /api/leaves/apply

**URL**

```
https://lms-application-pi.vercel.app/api/leaves/apply
```

**Token:** employee

**Body**

```json
{
  "leave_type": "Casual Leave",
  "start_date": "2026-11-10",
  "end_date": "2026-11-11",
  "reason": "Personal work"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Leave applied successfully",
  "data": {
    "id": 13,
    "_id": "6ae6d0b2c1cd50df3108c8c2",
    "leave_type": "Casual Leave",
    "start_date": "2026-11-10",
    "end_date": "2026-11-11",
    "status": "Pending"
  }
}
```

---

### 8.12 Wallet

#### GET /api/wallet/balance

**URL**

```
https://lms-application-pi.vercel.app/api/wallet/balance
```

**Token:** employee

**Response `200`**

```json
{
  "success": true,
  "data": {
    "balance": 1000,
    "total_earned": 1000,
    "totalEarned": 1000,
    "total_paid": 0,
    "totalPaid": 0,
    "currency": "INR",
    "employee": "Vishnu Mohan",
    "withdraw_requests": {
      "data": []
    },
    "withdrawRequests": {
      "data": []
    }
  }
}
```

#### GET /api/wallet/requests

**URL**

```
https://lms-application-pi.vercel.app/api/wallet/requests
```

**Token:** employee

**Response `200`**

```json
{
  "success": true,
  "count": 0,
  "summary": {
    "total": 0,
    "pending": 0,
    "approved": 0,
    "paid": 0,
    "rejected": 0,
    "pending_amount": 0
  },
  "data": []
}
```

#### POST /api/wallet/withdraw — request up to ₹5,000

**URL**

```
https://lms-application-pi.vercel.app/api/wallet/withdraw
```

**Token:** employee

**Body**

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

**Response `200`**

```json
{
  "success": true,
  "message": "Incentive withdrawal request for ₹500 submitted successfully to ASM.",
  "data": {
    "request_id": "WDR-2912",
    "amount": 500,
    "status": "Submitted to ASM",
    "asm_name": "Bipin Joseph",
    "remaining_balance": 1500
  }
}
```

**Errors**

- `400` — amount ≤ 0, amount > 5000, or insufficient balance.

`POST /api/wallet/withdraw` returns the raw stage (`Submitted to ASM`).
Every dashboard reads the simplified label from `GET /api/wallet/requests` /
`GET /api/wallet/balance`, which return `status_label: "Pending"` for a new
request.

---

### 8.13 Salary requests

#### GET /api/salary/requests

**URL**

```
https://lms-application-pi.vercel.app/api/salary/requests
```

**Token:** employee

**Response `200`**

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "request_id": "SAL-4821",
      "employee_id": "BDE001",
      "employee_name": "Vishnu Mohan",
      "amount": 5000,
      "period": "November 2026",
      "status": "Submitted to ASM",
      "status_label": "Pending"
    }
  ]
}
```

#### POST /api/salary/request

**URL**

```
https://lms-application-pi.vercel.app/api/salary/request
```

**Token:** employee

**Body**

```json
{
  "amount": 5000,
  "period": "November 2026",
  "attendance_days": 30,
  "remarks": "Monthly"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Salary request of ₹5,000 submitted to ASM Bipin Joseph for review.",
  "data": {
    "_id": "6ae6d0c3c1cd50df3108c8c3",
    "request_id": "SAL-4821",
    "employee_id": "BDE001",
    "employee_name": "Vishnu Mohan",
    "amount": 5000,
    "period": "November 2026",
    "status": "Submitted to ASM",
    "approval_history": []
  }
}
```

Minimum amount is ₹5,000. A duplicate request for the same period (not
rejected) returns `400`.

---

### 8.14 GET /api/incentives

**URL**

```
https://lms-application-pi.vercel.app/api/incentives
```

**Token:** employee

**Response `200`**

```json
{
  "success": true,
  "count": 1,
  "summary": {
    "total_incentives": 1000,
    "paid_incentives": 0,
    "pending_incentives": 1000
  },
  "data": [
    {
      "_id": "6ae6d091c1cd50df3108c8bf",
      "lead_id": "LD-9730",
      "student_name": "Rahul Krishna",
      "bde_id": "BDE001",
      "bde_name": "Vishnu Mohan",
      "amount": 1000,
      "status": "Earned"
    }
  ]
}
```

---

### 8.15 POST /api/employee/change-password

**URL**

```
https://lms-application-pi.vercel.app/api/employee/change-password
```

**Token:** employee

**Body**

```json
{
  "current_password": "password123",
  "new_password": "newpass123"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

### 8.16 Catalogs

| Method | URL | Response |
|---|---|---|
| GET | `https://lms-application-pi.vercel.app/api/zones` | `{ success, data: [Zone] }` |
| GET | `https://lms-application-pi.vercel.app/api/districts` | `[District]` |
| GET | `https://lms-application-pi.vercel.app/api/designations` | `[Designation]` |
| GET | `https://lms-application-pi.vercel.app/api/courses` | `[Course]` |
| GET | `https://lms-application-pi.vercel.app/api/sources` | `{ success, data: [Source] }` |
| GET | `https://lms-application-pi.vercel.app/api/hierarchy/filters` | `{ success, data: { zones, districts, designations, teams } }` |
| GET | `https://lms-application-pi.vercel.app/api/institutes` | `{ success, data: [Institute] }` |
| POST | `https://lms-application-pi.vercel.app/api/institutes` | `{ success, message, data }` (201) |

---

## 9. Security negative tests

Every call below must **fail**. Run them after the logins.

| Test | Method | URL | Token | Expected |
|---|---|---|---|---|
| No token: home | GET | `https://lms-application-pi.vercel.app/api/home` | none | `401` |
| No token: leads | GET | `https://lms-application-pi.vercel.app/api/leads` | none | `401` |
| No token: leaves | GET | `https://lms-application-pi.vercel.app/api/leaves` | none | `401` |
| No token: tasks | GET | `https://lms-application-pi.vercel.app/api/tasks` | none | `401` |
| No token: teams | GET | `https://lms-application-pi.vercel.app/api/teams` | none | `401` |
| No token: wallet requests | GET | `https://lms-application-pi.vercel.app/api/wallet/requests` | none | `401` |
| No token: attendance | GET | `https://lms-application-pi.vercel.app/api/attendance/history` | none | `401` |
| No token: wallet | GET | `https://lms-application-pi.vercel.app/api/wallet/balance` | none | `401` |
| No token: sm/asms | GET | `https://lms-application-pi.vercel.app/api/sm/asms` | none | `401` |
| No token: asm/bdes | GET | `https://lms-application-pi.vercel.app/api/asm/bdes` | none | `401` |
| No token: catalogs | GET | `https://lms-application-pi.vercel.app/api/zones` | none | `401` |
| No token: admin employees | GET | `https://lms-application-pi.vercel.app/api/admin/employees` | none | `401` |
| No token: admin stats | GET | `https://lms-application-pi.vercel.app/api/admin/stats` | none | `401` |
| No token: set-password | POST | `https://lms-application-pi.vercel.app/api/set-password` | none | `401` |
| No token: seed | GET | `https://lms-application-pi.vercel.app/api/seed` | none | `401` |
| No token: test | GET | `https://lms-application-pi.vercel.app/api/test` | none | `401` |
| BDE blocked: sm/asms | GET | `https://lms-application-pi.vercel.app/api/sm/asms` | BDE | `403` |
| BDE blocked: asm/bdes | GET | `https://lms-application-pi.vercel.app/api/asm/bdes` | BDE | `403` |
| BDE blocked: create-bde | POST | `https://lms-application-pi.vercel.app/api/asm/create-bde` | BDE | `403` |
| BDE blocked: another lead | GET | `https://lms-application-pi.vercel.app/api/leads?lead_id=LD-7310` | BDE | `403` |
| BDE blocked: another employee's leaves | GET | `https://lms-application-pi.vercel.app/api/leaves?employee=Sanu%20Jaison` | BDE | `403` |
| BDE blocked: another employee's tasks | GET | `https://lms-application-pi.vercel.app/api/tasks?assigned_to=Sanu%20Jaison` | BDE | `403` |
| BDE blocked: another employee's attendance | GET | `https://lms-application-pi.vercel.app/api/attendance/history?employee_id=SM001` | BDE | `403` |
| BDE blocked: reassign own task | PUT | `https://lms-application-pi.vercel.app/api/tasks` | BDE | `403` |
| ASM blocked: sm/asms | GET | `https://lms-application-pi.vercel.app/api/sm/asms` | ASM | `403` |
| ASM blocked: create-asm | POST | `https://lms-application-pi.vercel.app/api/sm/create-asm` | ASM | `403` |
| Admin blocked: home | GET | `https://lms-application-pi.vercel.app/api/home` | Admin | `403` |
| Admin blocked: create task | POST | `https://lms-application-pi.vercel.app/api/tasks` | Admin | `403` |
| Admin blocked: admin task create | POST | `https://lms-application-pi.vercel.app/api/admin/tasks` | Admin | `403` |
| Admin blocked: create ASM | POST | `https://lms-application-pi.vercel.app/api/sm/create-asm` | Admin | `403` |
| Admin blocked: check-in | POST | `https://lms-application-pi.vercel.app/api/attendance/check-in` | Admin | `403` |
| Invalid refresh token | POST | `https://lms-application-pi.vercel.app/api/auth/refresh-token` | none | `401` |

Verified production results:

- No-token calls → `401`.
- Leads visible: BDE `4`, ASM `4`, SM `5`, admin `5`.
- Home dashboards: BDE `1`, ASM `2`, SM `3` employees in scope.
- `sm/asms`: BDE `403`, ASM `403`, SM `200`.
- `asm/bdes`: BDE `403`, ASM `200`.

---

## 10. Endpoint index

| # | Method | URL | Token |
|---|---|---|---|
| 1 | POST | `https://lms-application-pi.vercel.app/api/login` | none |
| 2 | POST | `https://lms-application-pi.vercel.app/api/logout` | none |
| 3 | POST | `https://lms-application-pi.vercel.app/api/register` | none (403) |
| 4 | GET | `https://lms-application-pi.vercel.app/api/admin/stats` | admin |
| 5 | GET | `https://lms-application-pi.vercel.app/api/admin/create-sm` | admin |
| 6 | POST | `https://lms-application-pi.vercel.app/api/admin/create-sm` | admin |
| 7 | GET/POST/PUT/DELETE | `https://lms-application-pi.vercel.app/api/admin/{tab}` | admin |
| 8 | GET/POST | `https://lms-application-pi.vercel.app/api/admin/leads/create` | admin |
| 9 | POST | `https://lms-application-pi.vercel.app/api/set-password` | admin |
| 10 | GET/POST/PUT/DELETE | `https://lms-application-pi.vercel.app/api/task-templates` | admin |
| 11 | POST | `https://lms-application-pi.vercel.app/api/task-templates/generate` | admin |
| 12 | GET/POST/PUT/DELETE | `https://lms-application-pi.vercel.app/api/employee-tasks` | admin |
| 13 | GET | `https://lms-application-pi.vercel.app/api/home` | employee |
| 14 | GET | `https://lms-application-pi.vercel.app/api/profile` | employee |
| 15 | GET | `https://lms-application-pi.vercel.app/api/auth/me` | employee |
| 16 | POST | `https://lms-application-pi.vercel.app/api/auth/refresh-token` | employee |
| 17 | POST | `https://lms-application-pi.vercel.app/api/employee/change-password` | employee |
| 18 | GET | `https://lms-application-pi.vercel.app/api/operations` | employee |
| 19 | GET | `https://lms-application-pi.vercel.app/api/team` | employee |
| 20 | GET | `https://lms-application-pi.vercel.app/api/teams` | employee |
| 21 | GET | `https://lms-application-pi.vercel.app/api/sm/asms` | SM/admin |
| 22 | GET | `https://lms-application-pi.vercel.app/api/sm/asms/{id}` | SM/admin |
| 23 | POST | `https://lms-application-pi.vercel.app/api/sm/create-asm` | SM |
| 24 | GET | `https://lms-application-pi.vercel.app/api/asm/bdes` | ASM/SM/admin |
| 25 | GET | `https://lms-application-pi.vercel.app/api/asm/bdes/{id}` | ASM/SM/admin |
| 26 | POST | `https://lms-application-pi.vercel.app/api/asm/create-bde` | ASM/SM |
| 27 | GET | `https://lms-application-pi.vercel.app/api/tasks` | employee |
| 28 | POST | `https://lms-application-pi.vercel.app/api/tasks` | SM/ASM |
| 29 | PUT/PATCH | `https://lms-application-pi.vercel.app/api/tasks` | employee |
| 30 | DELETE | `https://lms-application-pi.vercel.app/api/tasks?id=` | employee |
| 31 | GET | `https://lms-application-pi.vercel.app/api/leads` | employee |
| 32 | POST | `https://lms-application-pi.vercel.app/api/leads` | employee |
| 33 | POST | `https://lms-application-pi.vercel.app/api/leads/create` | employee |
| 34 | GET | `https://lms-application-pi.vercel.app/api/leads/create` | employee |
| 35 | GET | `https://lms-application-pi.vercel.app/api/leads/next-student-id` | employee |
| 36 | POST | `https://lms-application-pi.vercel.app/api/leads/import` | employee |
| 37 | PUT | `https://lms-application-pi.vercel.app/api/leads` | employee |
| 38 | DELETE | `https://lms-application-pi.vercel.app/api/leads?id=` | employee |
| 39 | POST | `https://lms-application-pi.vercel.app/api/leads/{id}/followup` | employee |
| 40 | POST | `https://lms-application-pi.vercel.app/api/leads/{id}/follow-up` | employee |
| 41 | POST | `https://lms-application-pi.vercel.app/api/leads/{id}/close` | employee |
| 42 | GET/POST | `https://lms-application-pi.vercel.app/api/followups` | employee |
| 43 | GET | `https://lms-application-pi.vercel.app/api/attendance` | employee |
| 44 | GET | `https://lms-application-pi.vercel.app/api/attendance/status` | employee |
| 45 | POST | `https://lms-application-pi.vercel.app/api/attendance/check-in` | employee |
| 46 | POST | `https://lms-application-pi.vercel.app/api/attendance/check-out` | employee |
| 47 | GET | `https://lms-application-pi.vercel.app/api/attendance/history` | employee |
| 48 | GET | `https://lms-application-pi.vercel.app/api/leaves` | employee |
| 49 | POST | `https://lms-application-pi.vercel.app/api/leaves/apply` | employee |
| 50 | GET | `https://lms-application-pi.vercel.app/api/incentives` | employee |
| 51 | GET | `https://lms-application-pi.vercel.app/api/wallet/balance` | employee/admin |
| 52 | GET | `https://lms-application-pi.vercel.app/api/wallet/requests` | employee |
| 53 | POST | `https://lms-application-pi.vercel.app/api/wallet/withdraw` | employee |
| 54 | POST | `https://lms-application-pi.vercel.app/api/wallet/workflow` | ASM/SM/admin |
| 55 | GET | `https://lms-application-pi.vercel.app/api/salary/requests` | employee |
| 56 | POST | `https://lms-application-pi.vercel.app/api/salary/request` | employee |
| 57 | POST | `https://lms-application-pi.vercel.app/api/salary/workflow` | ASM/SM/admin |
| 58 | GET | `https://lms-application-pi.vercel.app/api/zones` | employee |
| 59 | GET | `https://lms-application-pi.vercel.app/api/districts` | employee |
| 60 | GET | `https://lms-application-pi.vercel.app/api/designations` | employee |
| 61 | GET | `https://lms-application-pi.vercel.app/api/courses` | employee |
| 62 | GET | `https://lms-application-pi.vercel.app/api/sources` | employee |
| 63 | GET | `https://lms-application-pi.vercel.app/api/hierarchy/filters` | employee |
| 64 | GET/POST | `https://lms-application-pi.vercel.app/api/institutes` | employee |
| 65 | DELETE | `https://lms-application-pi.vercel.app/api/institutes/{id}` | admin |
| 66 | GET | `https://lms-application-pi.vercel.app/api/test` | admin |
| 67 | GET | `https://lms-application-pi.vercel.app/api/seed` | admin |
