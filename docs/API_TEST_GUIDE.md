# KIDE API Test Guide

End-to-end test guide for every API documented in `API_DOCUMENTATION.md` and
`docs/app-api.md`, for **both the admin portal and the mobile app**.

Bodies below match the **actual route code**, not just the docs. Where the docs
are wrong, the difference is called out in [§8](#8-doc-vs-code-mismatches).

---

## 0. Setup

### Base URLs

| Environment | Base URL |
|---|---|
| Local dev | `http://localhost:3000` |
| Production | `https://lms-application-pi.vercel.app` |

Every path below is relative to `/api`, e.g. `/login` → `http://localhost:3000/api/login`.

### Headers

Send on every authenticated call:

```
Authorization: Bearer <token>
Content-Type: application/json
```

`POST /leads/import` uses `multipart/form-data` instead (no JSON content type).

### Test accounts (current local DB)

| Account | Login | Password | Role |
|---|---|---|---|
| Admin | `admin@kide.com` | `password123` | `admin` |
| Sales Manager | `SM001` or `sanu@gmail.com` | `password123` | SM |

> **Important:** employee passwords are **not persisted** (see [§8.1](#81-employee-passwords-are-never-stored)).
> Every employee account can log in with `password123` or `kide1234`, whatever
> password you passed when creating it.

### Current DB snapshot (verified live)

- Employees: `SM001` only — **0 ASMs, 0 BDEs**.
- Teams: `Office Team`, `Team Ernakulam`, `Team Thrissur`, `Team Kozhikode`, `Team Kannur` (5).
- Leads: 15. Next student ID: `STU-004`.
- Incentives / salary requests / withdrawal requests: 0.
- Wallets exist for seeded names (`Rahul Nair`, …) with balance `0`.

### Get a token — PowerShell

```powershell
$BASE = "http://localhost:3000"

# Admin
$admin = Invoke-RestMethod "$BASE/api/login" -Method Post -ContentType "application/json" `
  -Body (@{ email = "admin@kide.com"; password = "password123" } | ConvertTo-Json)
$ADMIN = $admin.token
$HA = @{ Authorization = "Bearer $ADMIN" }

# Employee (SM)
$sm = Invoke-RestMethod "$BASE/api/login" -Method Post -ContentType "application/json" `
  -Body (@{ employee_id = "SM001"; password = "password123" } | ConvertTo-Json)
$SM = $sm.token
$HS = @{ Authorization = "Bearer $SM" }

Invoke-RestMethod "$BASE/api/admin/stats" -Headers $HA
```

### Get a token — cURL

```bash
BASE=http://localhost:3000
TOKEN=$(curl -s -X POST $BASE/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kide.com","password":"password123"}' | jq -r .token)

curl -s $BASE/api/admin/stats -H "Authorization: Bearer $TOKEN"
```

The login response contains the token in **two** places — either works:

```json
{ "success": true, "token": "...", "user": { ... }, "data": { "token": "...", "user": { ... } } }
```

`user.role` in the response is the hierarchy role (`admin`, `SM`, `ASM`, `BDE`);
inside the JWT the role is `admin` or `employee`.

### Suggested test order

1. Login (§1) — get tokens.
2. Catalogs (§2) — confirm reference data.
3. Hierarchy (§4) — create ASM → BDE so you have app accounts.
4. App flows (§5) — attendance, leads, follow-up, close, wallet, salary.
5. Admin flows (§3) — stats, generic CRUD, incentives.
6. Run the full sequence in [§6](#6-end-to-end-happy-path) top to bottom.

---

## 1. Authentication & profile

| # | Method | Endpoint | Body | Expected |
|---|---|---|---|---|
| 1.1 | POST | `/login` (admin) | `{ "email": "admin@kide.com", "password": "password123" }` | 200, `token`, `user.role = admin` |
| 1.2 | POST | `/login` (employee) | `{ "employee_id": "SM001", "password": "password123" }` | 200, `token`, `user.role = SM` |
| 1.3 | GET | `/profile` | — | 200, profile + leave balances |
| 1.4 | GET | `/auth/me` | — | 200, same shape as profile |
| 1.5 | POST | `/auth/refresh-token` | `{ "token": "<token>" }` (or send Bearer) | 200, new `token` |
| 1.6 | POST | `/logout` | — | 200 (stateless, no server invalidation) |
| 1.7 | POST | `/set-password` | `{ "employee_id": "BDE001", "password": "newpass" }` | 200 — **but employee password is not saved**, see §8.1 |

Notes:

- Login accepts **either** `employee_id` or `email` in the same field position.
- Wrong password → `401`; missing identifier/password → `400`.
- Admin login also auto-seeds an admin user only if the `users` collection is empty and the identifier contains `admin`.

---

## 2. Public reference catalogs (no token needed)

| # | Method | Endpoint | Expected |
|---|---|---|---|
| 2.1 | GET | `/courses` | 200, 5 courses |
| 2.2 | GET | `/districts` | 200, 14 Kerala districts |
| 2.3 | GET | `/zones` | 200, South / Central / North |
| 2.4 | GET | `/sources` | 200, lead sources |
| 2.5 | GET | `/designations` | 200, SM / ASM / BDE / … |
| 2.6 | GET | `/hierarchy/filters` | 200, `data.zones / districts / designations / teams` |

Optional query: `/institutes?district=Ernakulam&search=college` (see §5.7).

---

## 3. Admin APIs

### 3.1 Dashboard statistics

| # | Method | Endpoint | Query | Expected |
|---|---|---|---|---|
| 3.1 | GET | `/admin/stats` | `?zone=Central Zone&district=Ernakulam` (optional) | 200, `totalLeads`, `newLeadsToday`, `activeFieldForce`, … |

### 3.2 Generic admin resource management

`GET | POST | PUT | DELETE` on `/admin/:tab`.

**Supported tabs (from the code):**

`leads`, `employees`, `attendance` / `attendanceRecords`, `zones`, `districts`,
`courses`, `designations`, `teams`, `tasks`, `taskTemplates` / `task-templates`,
`employeeTasks` / `employee-tasks`, `wallets`, `walletWithdrawRequests` /
`wallet-withdraw-requests` / `walletWithdrawRequest`, `leaves`, `activities`,
`roles`, `settings`.

> `salary-requests` is **not** a supported tab — it returns `400 Invalid tab category`.
> Use `GET /salary/requests` instead (§5.10).

**Common behaviour**

- `GET /admin/:tab` → `{ success, data: [...] }`, every record gets `id`.
- `POST /admin/:tab` → `201`, `{ success, data }`.
- `PUT /admin/:tab` → body **must include `id`** (or `_id`); returns `{ success, data }`.
- `DELETE /admin/:tab?id=<id>` or body `{ "id": "..." }` or `{ "ids": ["...", "..."] }` → `{ success, message }`.

**Example bodies**

`POST /admin/employees` (note: `password` is ignored — §8.1; `employee_id` auto-generated as `EMP-xxxx` if omitted):

```json
{
  "name": "API Test BDE",
  "email": "apitest.bde@kide.com",
  "contact_number": "9000000001",
  "designation": "Business Development Executive",
  "zone": "Central Zone",
  "district": "Ernakulam",
  "team": "Team Ernakulam",
  "reports_to": "ASM001",
  "status": "active",
  "password": "password123"
}
```

`POST /admin/teams` — field team needs **exactly 2 districts + an ASM name as lead**;
office team needs **0 districts + an SM name as lead**:

```json
{
  "name": "Test Team",
  "team_lead": "Bipin Joseph",
  "districts": ["Pathanamthitta", "Alappuzha"],
  "zone": "South Zone"
}
```

`POST /admin/districts`:

```json
{ "name": "Ernakulam", "zone": "Central Zone", "description": "" }
```

`POST /admin/zones`:

```json
{ "name": "Central Zone", "description": "Kottayam to Palakkad" }
```

`POST /admin/courses`:

```json
{ "name": "Flutter", "fee": 25000, "duration": "6 Months", "status": "active" }
```

`POST /admin/leads` (assigned employee required; `student_id`/`lead_id` auto-generated):

```json
{
  "name": "Arjun Menon",
  "contact_number": "9847123456",
  "district": "Ernakulam",
  "course": "Flutter",
  "employee": "Vishnu Mohan",
  "status": "New"
}
```

`POST /admin/attendance`:

```json
{ "name": "Vishnu Mohan", "employee_id": "BDE001", "date": "2026-10-31", "check_in": "09:05 AM", "check_out": "06:10 PM", "status": "COMPLETED" }
```

`POST /admin/wallets`:

```json
{ "employee": "Vishnu Mohan", "employee_id": "BDE001", "balance": 0, "total_earned": 0, "total_paid": 0, "currency": "INR" }
```

`POST /admin/leaves`:

```json
{ "employee": "Vishnu Mohan", "leave_type": "Casual Leave", "start_date": "2026-11-05", "end_date": "2026-11-06", "reason": "Personal", "status": "Pending" }
```

`POST /admin/tasks`:

```json
{ "title": "Visit 5 colleges", "description": "Ernakulam zone", "assigned_to": "Vishnu Mohan", "priority": "high", "status": "pending", "due_date": "2026-11-05" }
```

`POST /admin/roles`:

```json
{ "name": "Accounts", "guard_name": "web", "description": "Finance team", "permissions": [] }
```

`POST /admin/settings`:

```json
{ "name": "Incentive amount", "key": "incentive_amount", "value": 1000, "description": "₹ per admission" }
```

`PUT /admin/<tab>` — same body plus the record `id`:

```json
{ "id": "6ae5ca13504d38b316051be3", "name": "Updated Name" }
```

### 3.3 Incentive records

| # | Method | Endpoint | Query | Expected |
|---|---|---|---|---|
| 3.3 | GET | `/incentives` | `?bde_id=BDE001&asm_id=ASM001&team=Team%20Ernakulam&status=Earned` | 200, `data[]` + `summary` |

Supported filters in code: `bde_id` / `employee_id`, `asm_id`, `team`, `status`.
`student_id` is **ignored** (docs mention it).

---

## 4. SM & ASM hierarchy

### 4.1 SM creates an ASM

`POST /sm/create-asm` — send the **SM token** (or admin token).

```json
{
  "name": "Bipin Joseph",
  "email": "bipin.ekm@kide.com",
  "contact_number": "+91 90000 00001",
  "password": "password123",
  "team_code": "EKM"
}
```

- `team_code` must be one of `TVM`, `PTM`, `KTM`, `EKM`, `PKD`, `CLT`, `KZE`, or `OFFICE`.
- `custom_team_name` is optional (overrides the default `<CODE> Team` name).
- Rules enforced: one ASM per team, max 7 regional ASMs, a team keeps its fixed 2 districts.
- Response `201`: `{ employee_id: "ASM00x", team, districts, reports_to }`.

### 4.2 List ASMs / available teams

| # | Method | Endpoint | Expected |
|---|---|---|---|
| 4.2 | GET | `/sm/asms` | 200, `{ count, data: [...] }` — ASMs with team, districts, BDE count |
| 4.2.1 | GET | `/sm/asms/:id` | 200, single ASM — `:id` can be `ASM001`, the Mongo `id`, or the email |
| 4.2.2 | GET | `/sm/asms?id=ASM001` | 200, same single ASM (also accepts `employee_id=` / `email=`) |

### 4.3 ASM creates a BDE

`POST /asm/create-bde` — send the **ASM token**. Admin can pass `asm_id`.

```json
{
  "name": "Vishnu Mohan",
  "email": "vishnu.bde@kide.com",
  "contact_number": "+91 98471 99999",
  "password": "password123",
  "district": "Ernakulam"
}
```

- BDE inherits the ASM's team/zone, `reports_to = ASM employee_id`.
- A wallet with balance `0` is created automatically.
- Response `201`: `{ employee_id: "BDE00x", team, district, reports_to }`.
- Admin variant: add `"asm_id": "ASM001"` to the body.

### 4.4 List BDEs

| # | Method | Endpoint | Expected |
|---|---|---|---|
| 4.4 | GET | `/asm/bdes` | 200, BDEs with ASM + metrics (ASM token = own team; admin/SM = all) |
| 4.4.1 | GET | `/asm/bdes/:id` | 200, single BDE — `:id` can be `BDE001`, the Mongo `id`, or the email |
| 4.4.2 | GET | `/asm/bdes?id=BDE001` | 200, same single BDE (also accepts `employee_id=` / `email=`) |
| 4.4.3 | GET | `/asm/bdes?asm_id=ASM001` | 200, list of BDEs under that ASM |

---

## 5. Mobile app APIs

### 5.1 Home dashboard

| # | Method | Endpoint | Query | Expected |
|---|---|---|---|---|
| 5.1 | GET | `/home` | `?district_id=` (optional) | 200, user, attendance, EOD sync, operational overview, team metrics |

### 5.2 Attendance

| # | Method | Endpoint | Body | Expected |
|---|---|---|---|---|
| 5.2.1 | GET | `/attendance/status` | — | 200, today's check-in/out + shift status |
| 5.2.2 | POST | `/attendance/check-in` | `{ "latitude": 9.9816, "longitude": 76.2999, "address": "Kochi, Ernakulam" }` | 200, `ONLINE` (or "Already checked in today.") |
| 5.2.3 | POST | `/attendance/check-out` | `{ "notes": "Day completed" }` | **currently 500** — see §8.11 |
| 5.2.4 | GET | `/attendance/history` | `?month=2026-10` | 200, up to 31 records |

Check-in also accepts `multipart/form-data` with the same field names plus
`employee_id` / `name` for admin-side calls.

### 5.3 Leads

| # | Method | Endpoint | Body / Query | Expected |
|---|---|---|---|---|
| 5.3.1 | GET | `/leads` | `?status=2&search=Arjun&district=Ernakulam&course=Flutter&interest=Hot&employee=Vishnu` | 200, `{ count, data }` |
| 5.3.2 | GET | `/leads/next-student-id` | — | 200, `student_id: "STU-00x"` |
| 5.3.3 | GET | `/leads/create` | — | 200, schema + sample payload |
| 5.3.4 | POST | `/leads/create` | see below | 201, mobile-shaped lead |
| 5.3.5 | POST | `/leads` | same body as 5.3.4 | 201, admin-shaped lead |
| 5.3.6 | POST | `/leads/:id/followup` | see below | 200 |
| 5.3.7 | POST | `/leads/:id/follow-up` | same as 5.3.6 | 200 (alias) |
| 5.3.8 | POST | `/leads/:id/close` | see below | 200, incentive credited |
| 5.3.9 | POST | `/leads/import` | `multipart/form-data`, field `file` = CSV | 200, import summary |

`{id}` accepts the numeric `id`, the Mongo `_id`, or the `lead_id` (`LD-xxxx`).

**Create lead (5.3.4 / 5.3.5)** — required: `name` and one of `contact_number` / `phone`.
An employee token auto-assigns the lead; an admin token **must** send `employee` or `assigned_to`.

```json
{
  "name": "Arjun Menon",
  "contact_number": "9847123456",
  "whatsapp_number": "9847123456",
  "district": "Ernakulam",
  "place": "Aluva, Kochi",
  "age": 21,
  "qualification": "B.Tech Computer Science",
  "college_name": "SCMS School of Engineering",
  "current_year": "Passout",
  "interested_areas": "Mobile Apps & Backend",
  "interested_course": "Flutter",
  "lead_source": "College Visit",
  "admission_status": "New",
  "notes": "Looking for placement guarantee"
}
```

Admin-only extra field: `"employee": "Vishnu Mohan"` (name or `BDE001`).

**Follow-up (5.3.6)** — all fields optional; if `student_id` is sent it must match the lead's existing ID:

```json
{
  "lead_source": "College Visit",
  "student_interest": "Hot",
  "next_followup_date": "2026-11-02",
  "remarks": "Student interested in weekend Flutter batch",
  "admission_status": "Follow-up",
  "payment_verification": "Pending",
  "student_id": "STU-004",
  "course": "Flutter",
  "followup_date": "2026-10-31",
  "proof_url": ""
}
```

**Close lead (5.3.8)** — `student_id` is **always required in the body** and must match the lead's ID:

```json
{
  "student_id": "STU-004",
  "course": "Flutter",
  "payment": 20000,
  "payment_verification": "Verified",
  "remarks": "Admission confirmed; first installment received via UPI"
}
```

Effects: lead `status = 4`, `admission_status = "Admitted"`, ₹1,000 incentive
record created and credited to the BDE wallet (only once per lead).

**CSV import (5.3.9)** — header must include name + phone/contact/mobile:

```bash
curl -X POST $BASE/api/leads/import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@leads.csv"
```

### 5.4 Institutes

| # | Method | Endpoint | Body | Expected |
|---|---|---|---|---|
| 5.4.1 | GET | `/institutes` | `?district=Ernakulam&search=xyz` | 200, `data[]` |
| 5.4.2 | POST | `/institutes` (alias `/institutes/create`) | see below | 201 |
| 5.4.3 | DELETE | `/institutes/:id` | — | 200 |

```json
{
  "name": "XYZ College of Arts & Science",
  "type": "College",
  "district": "Ernakulam",
  "address": "Kakkanad, Kochi",
  "contact_person": "Dr. Rajesh Kumar",
  "contact_phone": "9847123456",
  "email": "principal@xyz.edu"
}
```

Only `name` is required; the rest have defaults. The `institute_name` /
`person_name` / `position` / `phone` / `place` / `notes` payload from
`docs/app-api.md` is **not** read by the route (§8.3).

### 5.5 Tasks

| # | Method | Endpoint | Query | Expected |
|---|---|---|---|---|
| 5.5.1 | GET | `/tasks` | `?assigned_to=Vishnu Mohan` (optional) | 200, `{ total, completed, pending, tasks, list }` |

Tasks are created/updated via `/admin/tasks` (§3.2).

### 5.6 Leaves

| # | Method | Endpoint | Body | Expected |
|---|---|---|---|---|
| 5.6.1 | GET | `/leaves` | `?employee=Vishnu Mohan` (optional) | 200, leave history |
| 5.6.2 | POST | `/leaves/apply` | see below | 200, `status: "Pending"` |

```json
{
  "leave_type": "Casual Leave",
  "start_date": "2026-11-05",
  "end_date": "2026-11-06",
  "reason": "Family function"
}
```

Approve/reject with `PUT /admin/leaves` `{ "id": "...", "status": "Approved" }`.

### 5.7 Wallet (incentive withdrawal)

| # | Method | Endpoint | Body | Expected |
|---|---|---|---|---|
| 5.7.1 | GET | `/wallet/balance` | — (admin: `?employee=Vishnu Mohan&employee_id=BDE001`) | 200, balance + requests |
| 5.7.2 | POST | `/wallet/withdraw` | see below | 200, `WDR-xxxx`, `Submitted to ASM` |
| 5.7.3 | POST | `/wallet/workflow` | see below | 200, new status |

```json
{
  "amount": 1000,
  "remarks": "Monthly incentive withdrawal",
  "upi_id": "vishnu@okaxis"
}
```

Rules: amount must be `> 0`, `<= 5000`, and `<= wallet balance`. The amount is
deducted from the balance when the request is created.

Workflow body:

```json
{
  "request_id": "WDR-1234",
  "action": "forward_to_sm",
  "remarks": "Verified closed admissions",
  "transaction_reference": "TXN987654"
}
```

Actions: `forward_to_sm` → `forward_to_accounts` → `sanction` → `pay` (or `reject`).
`transaction_reference` is only used by `pay`; `reject` refunds the amount.

### 5.8 Salary requests

| # | Method | Endpoint | Body | Expected |
|---|---|---|---|---|
| 5.8.1 | POST | `/salary/request` | see below | 200, `SAL-xxxx`, `Submitted to ASM` |
| 5.8.2 | GET | `/salary/requests` | — | 200, role-scoped list |
| 5.8.3 | POST | `/salary/workflow` | see below | 200, new status |

```json
{
  "amount": 5000,
  "period": "October 2026",
  "attendance_days": 28,
  "remarks": "Monthly minimum salary request for October 2026"
}
```

Rules: `amount >= 5000` (defaults to 5000 if omitted); only **one non-rejected
request per employee per period**.

Workflow body:

```json
{
  "request_id": "SAL-1234",
  "action": "pay",
  "remarks": "Salary disbursed via NEFT",
  "transaction_reference": "SBIN002918239102"
}
```

Actions: `forward_to_sm` → `forward_to_accounts` → `sanction` → `pay` (or `reject`).
`pay` reads **`transaction_reference`**, not `utr`.

### 5.9 Incentives

See §3.3 (`GET /incentives`).

### 5.10 Endpoint aliases worth knowing

- `/leads/:id/followup` and `/leads/:id/follow-up` are identical.
- `/institutes` and `/institutes/create` are identical.
- `/profile` and `/auth/me` return the same payload.

---

## 6. End-to-end happy path

Run these in order. Replace IDs (`ASM001`, `BDE001`, `STU-00x`, `LD-xxxx`,
`WDR-xxxx`, `SAL-xxxx`) with the values returned by the previous step.

### Step 1 — Admin login

```http
POST /api/login
{ "email": "admin@kide.com", "password": "password123" }
```

Save `token` as `$ADMIN`.

### Step 2 — SM login

```http
POST /api/login
{ "employee_id": "SM001", "password": "password123" }
```

Save `token` as `$SM`.

### Step 3 — See available teams

```http
GET /api/sm/asms
Authorization: Bearer $SM
```

`data.available_teams` lists the unallocated team codes.

### Step 4 — Create an ASM

```http
POST /api/sm/create-asm
Authorization: Bearer $SM

{
  "name": "Bipin Joseph",
  "email": "bipin.ekm@kide.com",
  "contact_number": "+91 90000 00001",
  "password": "password123",
  "team_code": "EKM"
}
```

→ `employee_id: "ASM001"`. Save it as `$ASM_ID`.

### Step 5 — ASM login

```http
POST /api/login
{ "employee_id": "ASM001", "password": "password123" }
```

Save `token` as `$ASM`.

### Step 6 — Create a BDE

```http
POST /api/asm/create-bde
Authorization: Bearer $ASM

{
  "name": "Vishnu Mohan",
  "email": "vishnu.bde@kide.com",
  "contact_number": "+91 98471 99999",
  "password": "password123",
  "district": "Ernakulam"
}
```

→ `employee_id: "BDE001"`. Save it as `$BDE_ID`.

### Step 7 — BDE login

```http
POST /api/login
{ "employee_id": "BDE001", "password": "password123" }
```

Save `token` as `$BDE`.

### Step 8 — Get the next student ID

```http
GET /api/leads/next-student-id
Authorization: Bearer $BDE
```

→ `student_id: "STU-004"`. Save it as `$STU`.

### Step 9 — Create a lead (auto-assigned to the BDE)

```http
POST /api/leads/create
Authorization: Bearer $BDE

{
  "name": "Arjun Menon",
  "contact_number": "9847123456",
  "district": "Ernakulam",
  "place": "Aluva, Kochi",
  "qualification": "B.Tech Computer Science",
  "interested_course": "Flutter",
  "lead_source": "College Visit",
  "admission_status": "New",
  "notes": "Interested in weekend batch"
}
```

→ `data.id` (numeric) and `data.student_id` (should be `$STU`). Save the id as `$LEAD`.

### Step 10 — List own leads

```http
GET /api/leads
Authorization: Bearer $BDE
```

→ `count: 1`.

### Step 11 — Record a follow-up

```http
POST /api/leads/$LEAD/followup
Authorization: Bearer $BDE

{
  "student_id": "STU-004",
  "next_followup_date": "2026-11-02",
  "remarks": "Student interested in weekend Flutter batch",
  "student_interest": "Hot",
  "admission_status": "Follow-up",
  "payment_verification": "Pending",
  "course": "Flutter"
}
```

### Step 12 — Close the lead (admission + ₹1,000 incentive)

```http
POST /api/leads/$LEAD/close
Authorization: Bearer $BDE

{
  "student_id": "STU-004",
  "course": "Flutter",
  "payment": 20000,
  "payment_verification": "Verified",
  "remarks": "Admission confirmed; first installment received via UPI"
}
```

→ `status: 4`, `admission_status: "Admitted"`, `incentive_earned: 1000`.

### Step 13 — Check the wallet

```http
GET /api/wallet/balance
Authorization: Bearer $BDE
```

→ `balance: 1000`, `total_earned: 1000`.

### Step 14 — Withdraw ₹1,000

```http
POST /api/wallet/withdraw
Authorization: Bearer $BDE

{
  "amount": 1000,
  "remarks": "October incentive withdrawal",
  "upi_id": "vishnu@okaxis"
}
```

→ `request_id: "WDR-xxxx"`. Save it as `$WDR`.

### Step 15 — Withdrawal approvals

```http
POST /api/wallet/workflow   (Authorization: Bearer $ASM)
{ "request_id": "WDR-xxxx", "action": "forward_to_sm", "remarks": "Verified" }

POST /api/wallet/workflow   (Authorization: Bearer $SM)
{ "request_id": "WDR-xxxx", "action": "forward_to_accounts", "remarks": "Approved" }

POST /api/wallet/workflow   (Authorization: Bearer $ADMIN)
{ "request_id": "WDR-xxxx", "action": "sanction", "remarks": "Sanctioned" }

POST /api/wallet/workflow   (Authorization: Bearer $ADMIN)
{ "request_id": "WDR-xxxx", "action": "pay", "transaction_reference": "TXN987654" }
```

→ final status `Paid`, `total_paid` incremented.

### Step 16 — Salary request

```http
POST /api/salary/request
Authorization: Bearer $BDE

{
  "amount": 5000,
  "period": "October 2026",
  "attendance_days": 28,
  "remarks": "Monthly minimum salary request"
}
```

→ `request_id: "SAL-xxxx"`. Save it as `$SAL`.

### Step 17 — Salary approvals

```http
POST /api/salary/workflow   (Authorization: Bearer $ASM)
{ "request_id": "SAL-xxxx", "action": "forward_to_sm", "remarks": "28 days verified" }

POST /api/salary/workflow   (Authorization: Bearer $SM)
{ "request_id": "SAL-xxxx", "action": "forward_to_accounts", "remarks": "SM approved" }

POST /api/salary/workflow   (Authorization: Bearer $ADMIN)
{ "request_id": "SAL-xxxx", "action": "sanction", "remarks": "Sanctioned" }

POST /api/salary/workflow   (Authorization: Bearer $ADMIN)
{ "request_id": "SAL-xxxx", "action": "pay", "transaction_reference": "SBIN002918239102" }
```

→ final status `Paid`.

### Step 18 — Verify records

```http
GET /api/incentives            (Authorization: Bearer $ADMIN)
GET /api/salary/requests       (Authorization: Bearer $ADMIN)
GET /api/wallet/balance?employee=Vishnu%20Mohan&employee_id=BDE001   (Authorization: Bearer $ADMIN)
GET /api/admin/stats           (Authorization: Bearer $ADMIN)
```

### Step 19 — Attendance

```http
POST /api/attendance/check-in   (Authorization: Bearer $BDE)
{ "latitude": 9.9816, "longitude": 76.2999, "address": "Kochi, Ernakulam" }

GET  /api/attendance/status     (Authorization: Bearer $BDE)

POST /api/attendance/check-out  (Authorization: Bearer $BDE)
{ "notes": "Day completed" }

GET  /api/attendance/history?month=2026-10   (Authorization: Bearer $BDE)
```

### Step 20 — Leave

```http
POST /api/leaves/apply   (Authorization: Bearer $BDE)
{ "leave_type": "Casual Leave", "start_date": "2026-11-05", "end_date": "2026-11-06", "reason": "Family function" }

GET  /api/leaves         (Authorization: Bearer $BDE)
```

### Step 21 — Institute

```http
POST /api/institutes   (Authorization: Bearer $ASM)
{
  "name": "XYZ College of Arts & Science",
  "type": "College",
  "district": "Ernakulam",
  "address": "Kakkanad, Kochi",
  "contact_person": "Dr. Rajesh Kumar",
  "contact_phone": "9847123456",
  "email": "principal@xyz.edu"
}

GET /api/institutes?district=Ernakulam   (Authorization: Bearer $ASM)
```

### Step 22 — Admin cleanup (optional)

```http
DELETE /api/admin/leads?id=$LEAD
DELETE /api/admin/employees?id=$BDE_DOC_ID
DELETE /api/admin/employees?id=$ASM_DOC_ID
```

> Deleting employees does **not** delete their wallet, incentives, salary
> requests, or team assignment. Clean those separately if you need a pristine DB.

---

## 7. Negative tests (should fail)

| Test | Call | Expected |
|---|---|---|
| Wrong password | `POST /login` with `"password": "wrong"` | `401` |
| Missing login fields | `POST /login` `{}` | `400` |
| Admin creates lead without assignee | `POST /leads/create` with admin token, no `employee` | `400 Assigned employee is required` |
| Lead without contact | `POST /leads/create` `{ "name": "X" }` | `400 Contact Number … required` |
| Student ID mismatch on follow-up | send a different `student_id` than the lead's | `400` |
| Close without `student_id` | `POST /leads/:id/close` `{}` | `400 Student ID is required` |
| Close with wrong `student_id` | different ID | `400` mismatch |
| Withdraw > ₹5,000 | `POST /wallet/withdraw` `{ "amount": 6000 }` | `400 max ₹5,000` |
| Withdraw > balance | amount above wallet balance | `400 insufficient balance` |
| Salary < ₹5,000 | `POST /salary/request` `{ "amount": 4000 }` | `400 minimum ₹5,000` |
| Duplicate salary period | same `employee_id` + `period` again | `400 already exists` |
| Invalid workflow action | `action: "approve_now"` | `400 invalid action` |
| Invalid team code | `POST /sm/create-asm` `"team_code": "XXX"` | `400` |
| Team with 1 district | `POST /admin/teams` 1 district | `400 exactly 2 districts` |
| Duplicate district across teams | two teams with the same district | `400 already assigned` |
| Unsupported admin tab | `GET /admin/salary-requests` | `400 Invalid tab category` |
| Institute without name | `POST /institutes` `{}` | `400 Institute name is required` |

---

## 8. Doc vs code mismatches

### 8.1 Employee passwords are never stored

`src/models/employee.ts` has **no `password` field**. The login route reads
`employee.password`, but Mongoose strips unknown fields, so:

- `password` sent to `/sm/create-asm`, `/asm/create-bde`, or `/admin/employees` is ignored.
- `POST /set-password` returns `200` but does not persist the new password for employees.
- Login only succeeds with the fallback passwords **`password123`** or **`kide1234`**.

Confirmed live: created an employee with `TestPass@123`, login with it returned
`401`, login with `password123` and `kide1234` returned `200`.

**Fix needed:** add `password: { type: String, select: false }` to the Employee
schema (or a dedicated credentials collection) before relying on custom passwords.

### 8.2 `GET /admin/salary-requests` is not implemented

`API_DOCUMENTATION.md` §10.3 lists `salary-requests` as a supported tab, but the
route's model map has no such key → `400 Invalid tab category`.
Use `GET /salary/requests`.

### 8.3 Institute payload differs from `docs/app-api.md`

| Docs send | Code reads |
|---|---|
| `institute_name` | `name` (required) |
| `person_name` | `contact_person` |
| `position` | — (ignored) |
| `phone` / `contact_number` | `contact_phone` |
| `place` | `address` |
| `notes` | — (ignored) |
| `type` | `type` |

Also: the route does **not** enforce "ASM only", does not set `created_by`, and
`GET /institutes` does **not** scope results to the caller — it returns every
institute (optionally filtered by `district` / `search`).

### 8.4 Close always needs `student_id`

`docs/app-api.md` says `student_id` is required "unless a follow-up already set
it". In the code, `POST /leads/:id/close` rejects the request when the body has
no `student_id`, even if the lead already has one.

### 8.5 Follow-up does not require `student_id` for admissions

Docs say `student_id` is required when `admission_status` is `Admission`. The
route only validates a mismatch **if** a `student_id` is provided.

### 8.6 Close response status string

Code sets `admission_status: "Admitted"`; `docs/app-api.md` shows `"Admission"`.

### 8.7 Salary `pay` uses `transaction_reference`, not `utr`

`API_DOCUMENTATION.md` §6.3 sends `"utr"`. The route reads
`transaction_reference` and otherwise auto-generates `TXN-<timestamp>`.

### 8.8 `GET /incentives?student_id=` is ignored

Docs list `?student_id=STU-001`; the code only filters `bde_id` / `employee_id`,
`asm_id`, `team`, `status`.

### 8.9 Admin auth is permissive

`requireAdmin()` returns `null` (allowed) when the `Referer` contains
`localhost`, `127.0.0.1`, `kide`, or `vercel.app`, or when `x-admin-key` matches
`ADMIN_KEY` (default `kide-admin-secret`). So admin endpoints can return `200`
without a token. Always test with a real Bearer token to validate auth, and
tighten this before production.

### 8.10 Other small notes

- `GET /admin/:tab` returns **all** records, no pagination.
- `POST /admin/leads` is a second lead-creation path (besides `/leads/create`).
- `/leads` also supports `PUT` and `DELETE` (not covered by the docs).
- Team lead must be an **exact employee name**; the seeded team strings like
  `"Anoop Menon (ASM001)"` will not match any employee, so creating teams via
  `/admin/teams` requires a real ASM/SM employee first.
- `POST /leads/create` assigns the lead to the token's employee; admin-created
  leads need `employee` / `assigned_to`.

### 8.11 Attendance check-out returns 500

`POST /attendance/check-out` sets `record.status = 'COMPLETED'`, but the
`Attendance` schema only allows `ONLINE` / `OFFLINE`:

```json
{
  "success": false,
  "message": "Attendance validation failed: status: `COMPLETED` is not a valid enum value for path `status`."
}
```

Confirmed live on 2026-10-31. Fix: add `'COMPLETED'` to the enum in
`src/models/attendence.ts` (the status/history routes already map `COMPLETED`
to `PRESENT`).

---

## 9. Live smoke test results (read-only)

Run on **2026-10-31** against `http://localhost:3000` with admin + SM tokens.

| Endpoint | Status | Result |
|---|---|---|
| `POST /api/login` (admin) | 200 | Pass — role `admin` |
| `POST /api/login` (SM001) | 200 | Pass — role `SM` |
| `GET /api/admin/stats` | 200 | Pass |
| `GET /api/admin/employees` | 200 | Pass (1 employee) |
| `GET /api/admin/teams` | 200 | Pass (5 teams) |
| `GET /api/admin/leads` | 200 | Pass (15 leads) |
| `GET /api/admin/wallets` | 200 | Pass |
| `GET /api/admin/leaves` | 200 | Pass |
| `GET /api/admin/activities` | 200 | Pass |
| `GET /api/admin/wallet-withdraw-requests` | 200 | Pass |
| `GET /api/admin/salary-requests` | **400** | **Fail — invalid tab** (§8.2) |
| `GET /api/incentives` | 200 | Pass (0 records) |
| `GET /api/salary/requests` | 200 | Pass (0 records) |
| `GET /api/sm/asms` | 200 | Pass (0 ASMs) |
| `GET /api/asm/bdes` | 200 | Pass (0 BDEs) |
| `GET /api/institutes` | 200 | Pass (0 records) |
| `GET /api/home` | 200 | Pass |
| `GET /api/profile` | 200 | Pass |
| `GET /api/auth/me` | 200 | Pass |
| `GET /api/tasks` | 200 | Pass (0 tasks) |
| `GET /api/leaves` | 200 | Pass |
| `GET /api/attendance/status` | 200 | Pass |
| `POST /api/attendance/check-in` | 200 | Pass |
| `POST /api/attendance/check-out` | **500** | **Fail — enum validation** (§8.11) |
| `GET /api/attendance/history?month=2026-10` | 200 | Pass |
| `GET /api/wallet/balance` | 200 | Pass (balance 0) |
| `GET /api/leads` | 200 | Pass (1 lead for SM) |
| `GET /api/leads/next-student-id` | 200 | Pass (`STU-004`) |
| `GET /api/leads/create` (schema) | 200 | Pass |
| `GET /api/courses` | 200 | Pass |
| `GET /api/districts` | 200 | Pass |
| `GET /api/zones` | 200 | Pass |
| `GET /api/sources` | 200 | Pass |
| `GET /api/designations` | 200 | Pass |
| `GET /api/hierarchy/filters` | 200 | Pass |

Attendance check-in/check-out were also exercised (and the created attendance row
deleted afterwards). The remaining write endpoints (create ASM/BDE/lead,
follow-up, close, withdraw, salary, leaves, institutes) were **not** run against
your DB to avoid polluting it — use §6 to run them when you are ready.

---

## 10. Quick reference

### All endpoints

| Group | Method | Endpoint |
|---|---|---|
| Auth | POST | `/login` |
| Auth | POST | `/logout` |
| Auth | POST | `/auth/refresh-token` |
| Auth | POST | `/set-password` |
| Profile | GET | `/profile`, `/auth/me` |
| Catalog | GET | `/courses`, `/districts`, `/zones`, `/sources`, `/designations`, `/hierarchy/filters` |
| Admin | GET | `/admin/stats` |
| Admin | GET/POST/PUT/DELETE | `/admin/:tab` |
| Admin | GET | `/incentives` |
| Hierarchy | POST | `/sm/create-asm` |
| Hierarchy | GET | `/sm/asms` |
| Hierarchy | POST | `/asm/create-bde` |
| Hierarchy | GET | `/asm/bdes` |
| App | GET | `/home` |
| App | GET/POST | `/attendance/status`, `/attendance/check-in`, `/attendance/check-out`, `/attendance/history` |
| App | GET/POST/PUT/DELETE | `/leads`, `/leads/create`, `/leads/:id/followup`, `/leads/:id/close`, `/leads/import`, `/leads/next-student-id` |
| App | GET/POST/DELETE | `/institutes`, `/institutes/create`, `/institutes/:id` |
| App | GET | `/tasks` |
| App | GET/POST | `/leaves`, `/leaves/apply` |
| App | GET/POST | `/wallet/balance`, `/wallet/withdraw`, `/wallet/workflow` |
| App | GET/POST | `/salary/request`, `/salary/requests`, `/salary/workflow` |

### PowerShell test helper

```powershell
function Invoke-Kide {
  param(
    [Parameter(Mandatory)] [string] $Method,
    [Parameter(Mandatory)] [string] $Path,
    [string] $Token,
    $Body
  )
  $uri = "http://localhost:3000$Path"
  $headers = @{}
  if ($Token) { $headers.Authorization = "Bearer $Token" }
  $args = @{ Uri = $uri; Method = $Method; Headers = $headers; TimeoutSec = 60 }
  if ($null -ne $Body) {
    $args.ContentType = "application/json"
    $args.Body = ($Body | ConvertTo-Json -Depth 10)
  }
  try {
    $r = Invoke-RestMethod @args
    [pscustomobject]@{ Ok = $true; Status = 200; Data = $r }
  } catch {
    [pscustomobject]@{
      Ok = $false
      Status = $_.Exception.Response.StatusCode.value__
      Data = $_.ErrorDetails.Message
    }
  }
}

# Usage
$login = Invoke-Kide -Method Post -Path "/api/login" -Body @{ email = "admin@kide.com"; password = "password123" }
$ADMIN = $login.Data.token

Invoke-Kide -Method Get  -Path "/api/admin/stats" -Token $ADMIN | Select-Object -ExpandProperty Data
Invoke-Kide -Method Post -Path "/api/leads/create" -Token $ADMIN -Body @{
  name = "Test Student"; contact_number = "9000000000"; district = "Ernakulam";
  interested_course = "Flutter"; employee = "Vishnu Mohan"
} | Select-Object -ExpandProperty Data
```
