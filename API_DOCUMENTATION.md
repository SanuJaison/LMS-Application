# Kerala Institute of Digital Education (KIDE)
## Sales & Lead Management Application — Complete System & API Documentation

This document provides complete, end-to-end documentation for the **Kerala Institute of Digital Education (KIDE)** Sales Management and Lead Management Platform, covering both the **Backend API Architecture**, the **Admin / Accounts Portal**, and the **Mobile Field Force Application (Flutter)**.

---

## Table of Contents

1. [Executive Summary & Organization Architecture](#1-executive-summary--organization-architecture)
2. [District & Team Allocation Structure (8 Teams)](#2-district--team-allocation-structure-8-teams)
3. [Course Catalog (5 Standard Courses)](#3-course-catalog-5-standard-courses)
4. [Business & Financial Rules](#4-business--financial-rules)
   - [Lead Generation & Sequential Student ID Rule](#41-lead-generation--sequential-student-id-rule)
   - [Lead Closure, Student ID Verification & ₹1,000 Incentive](#42-lead-closure-student-id-verification--1000-incentive)
   - [Incentive Withdrawal Request Workflow (Max ₹5,000 Limit)](#43-incentive-withdrawal-request-workflow-max-5000-limit)
   - [Monthly Salary Request Workflow (Min ₹5,000 Limit)](#44-monthly-salary-request-workflow-min-5000-limit)
   - [Accounts Financial Formulas & Profit Calculation](#45-accounts-financial-formulas--profit-calculation)
5. [Analysis: What APIs the Mobile App is Currently Using](#5-analysis-what-apis-the-mobile-app-is-currently-using)
6. [Master API Reference (Grouped by Capability)](#6-master-api-reference-grouped-by-capability)
   - [Group 1: Authentication & Profile APIs](#group-1-authentication--profile-apis)
   - [Group 2: Mobile Home & Dashboard Feed APIs](#group-2-mobile-home--dashboard-feed-apis)
   - [Group 3: Attendance & Geo-Tracking APIs](#group-3-attendance--geo-tracking-apis)
   - [Group 4: Leads, Follow-ups, Admissions & Bulk Import APIs](#group-4-leads-follow-ups-admissions--bulk-import-apis)
   - [Group 5: Incentive Withdrawal Workflow APIs](#group-5-incentive-withdrawal-workflow-apis)
   - [Group 6: Monthly Salary Request Workflow APIs](#group-6-monthly-salary-request-workflow-apis)
   - [Group 7: SM & ASM Management Hierarchy APIs](#group-7-sm--asm-management-hierarchy-apis)
   - [Group 8: Tasks, Field Institutes & Leaves APIs](#group-8-tasks-field-institutes--leaves-apis)
   - [Group 9: Public Reference Catalogs & Dropdown APIs](#group-9-public-reference-catalogs--dropdown-apis)
   - [Group 10: Admin & Accounts Department APIs](#group-10-admin--accounts-department-apis)

---

## 1. Executive Summary & Organization Architecture

The application enforces a strictly governed organizational hierarchy:

$$\text{Admin / Accounts} \longrightarrow \text{Sales Manager (SM: 1)} \longrightarrow \text{Area Sales Managers (ASM: 7)} \longrightarrow \text{Business Development Executives (BDE: N)}$$
$$\text{Office Team / Tele-callers} \longrightarrow \text{Reports directly to Sales Manager (SM)}$$

### Role Responsibilities

| Role | Count | Direct Supervisor | Key Responsibilities |
|---|---|---|---|
| **Admin / Accounts** | Multi-user | Board / Management | Approves salary sanctions, verifies payments, disburses incentive payouts, audits profits, monitors statewide operations. |
| **Sales Manager (SM)** | **Strictly 1** | Admin / Board | Manages all 7 regional teams and the Office Team. Creates ASMs, assigns regional team & 2 districts, sets team targets, forwards requests to Accounts. |
| **Area Sales Manager (ASM)** | **Strictly 7** | Sales Manager (SM) | Manages 1 assigned regional team and its 2 assigned districts. Creates and monitors BDEs, reviews daily follow-ups, sets BDE targets, verifies salary/incentive requests. |
| **Business Development Executive (BDE)** | Unlimited | Assigned ASM | Generates leads, conducts student follow-ups, confirms admissions, earns ₹1,000 per admission, submits withdrawal requests (max ₹5k), requests minimum monthly salary (min ₹5k). |
| **Office Team / Tele-caller** | Unlimited | Sales Manager (SM) | Statewide calling, telephonic follow-ups, admissions directly under SM supervision. |

---

## 2. District & Team Allocation Structure (8 Teams)

There are **7 Regional ASM Teams** covering all 14 districts of Kerala (2 districts per team) plus **1 Office Team**:

| Team No. | Team Name | Team Code | Assigned Districts | Zone | Supervisor | Team Lead |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | **TVM Team** | `TVM` | Thiruvananthapuram, Kollam | South Zone | SM | ASM 1 |
| 2 | **PTM Team** | `PTM` | Pathanamthitta, Alappuzha | South Zone | SM | ASM 2 |
| 3 | **KTM Team** | `KTM` | Kottayam, Idukki | Central Zone | SM | ASM 3 |
| 4 | **EKM Team** | `EKM` | Ernakulam, Thrissur | Central Zone | SM | ASM 4 |
| 5 | **PKD Team** | `PKD` | Palakkad, Malappuram | Central Zone | SM | ASM 5 |
| 6 | **CLT Team** | `CLT` | Kozhikode, Wayanad | North Zone | SM | ASM 6 |
| 7 | **KZE Team** | `KZE` | Kannur, Kasaragod | North Zone | SM | ASM 7 |
| 8 | **Office Team** | `OFFICE` | None (Central Office / Statewide) | Central Zone | SM | SM / Office Lead |

### Strict Allocation Constraints:
1. **Single SM Constraint**: There is only **one Sales Manager** in the system.
2. **One Team per ASM**: Once an ASM is assigned to a team, that ASM cannot be assigned to another team.
3. **One Team per District**: Once a district is allocated to a team, it cannot be chosen by any other team.
4. **SM Creates ASM**: ASMs are created and assigned their regional team and 2 districts by the Sales Manager (SM).
5. **ASM Creates BDE**: BDEs are created by their respective ASM and automatically inherit the ASM's team, zone, and district.

---

## 3. Course Catalog (5 Standard Courses)

The application provides 5 courses for lead generation and admissions:

| No. | Course Name | Standard Fee | Standard Duration | Status |
|:---:|:---|:---:|:---:|:---:|
| 1 | **Flutter** | ₹20,000 | 4 Months | Active |
| 2 | **Full Stack Development** | ₹25,000 | 6 Months | Active |
| 3 | **Cyber Security** | ₹30,000 | 6 Months | Active |
| 4 | **Digital Marketing** | ₹15,000 | 3 Months | Active |
| 5 | **Data Science Pro** | ₹35,000 | 6 Months | Active |

---

## 4. Business & Financial Rules

### 4.1 Lead Generation & Sequential Student ID Rule
- When a lead is generated (via Mobile App or Admin Panel), the system assigns:
  1. A unique **Lead ID** (e.g. `LD-1001` or `LD-4921`).
  2. A unique custom sequential **Student ID** (e.g. `STU-001`, `STU-002`, `STU-003`...).
- If created from the mobile app by an authenticated BDE, the lead is automatically assigned to that BDE without requiring manual employee selection.

### 4.2 Lead Closure, Student ID Verification & ₹1,000 Incentive
- **Validation Rule**: When a BDE or Manager submits a request to close a lead (`POST /api/leads/:id/close`), the payload **must** include `student_id`.
- The system checks that `student_id.toUpperCase() === lead.student_id.toUpperCase()`.
- **If the student ID is not identical, the lead WILL NOT close** (returns `400 Bad Request` with validation error).
- **Incentive Allocation**:
  - Upon valid admission closure, an incentive of **₹1,000** is credited immediately to the BDE's wallet.
  - An individual `Incentive` record is created linking `lead_id`, `student_id`, `student_name`, `bde_id`, `course`, and `amount = 1000`.
  - For example, if a BDE closes 10 admissions, 10 distinct incentive records are stored and the BDE's wallet balance increases by ₹10,000.

### 4.3 Incentive Withdrawal Request Workflow (Max ₹5,000 Limit)
- **Constraint**: BDEs can withdraw a maximum of **₹5,000 per request**. Requests exceeding ₹5,000 are rejected immediately with a validation error.
- **Controlled Route**:
  $$\text{BDE Request} \xrightarrow{\text{Step 1}} \text{ASM Review} \xrightarrow{\text{Step 2}} \text{SM Review} \xrightarrow{\text{Step 3}} \text{Accounts Sanction} \xrightarrow{\text{Step 4}} \text{Payment Disbursed}$$
- **Status Lifecycle**:
  1. `Submitted to ASM`: BDE submits request to the assigned ASM who created them.
  2. `Forwarded to SM`: ASM verifies requested amount, eligibility, and forwards to SM.
  3. `Forwarded to Accounts`: SM verifies and forwards recommendation to Accounts.
  4. `Approved`: Accounts verifies financial books and sanctions the payout.
  5. `Paid`: Accounts enters bank transaction reference (UTR/IMPS) and marks as paid.
  6. `Rejected`: If rejected at any stage, the reserved balance is immediately refunded back to the BDE wallet.

### 4.4 Monthly Salary Request Workflow (Min ₹5,000 Limit)
- **Salary Policy**: Minimum fixed salary ₹5,000 + performance incentives.
- **Constraint**: Minimum allowable salary request amount is **₹5,000**.
- **Controlled Route**:
  $$\text{BDE Request} \xrightarrow{\text{Step 1}} \text{ASM Review} \xrightarrow{\text{Step 2}} \text{SM Review} \xrightarrow{\text{Step 3}} \text{Accounts Sanction} \xrightarrow{\text{Step 4}} \text{Payment Disbursed}$$
- **Status Lifecycle**:
  1. `Submitted to ASM`: BDE submits monthly salary request with attendance details.
  2. `Forwarded to SM`: ASM checks monthly attendance and performance, and forwards to SM.
  3. `Forwarded to Accounts`: SM reviews and forwards to Accounts.
  4. `Approved` / `Paid`: Accounts sanctions payment and records transaction reference.

### 4.5 Accounts Financial Formulas & Profit Calculation
The Admin Accounts dashboard tracks live revenue and expenditures:

$$\text{Total Admissions} = \text{Count of closed leads with status Admitted / Closed}$$
$$\text{Total Income} = \sum \text{Admission Fees Collected}$$
$$\text{Total Incentives} = \text{Total Admissions} \times ₹1,000$$
$$\text{Total Salary Expenses} = \sum \text{Approved / Paid Salary Requests}$$
$$\text{Total Expenses} = \text{Total Incentives} + \text{Total Salary Expenses}$$
$$\text{Total Profit} = \text{Total Income} - \text{Total Expenses}$$

---

## 5. Analysis: What APIs the Mobile App is Currently Using

Based on a comprehensive audit of the Flutter codebase (`keralainstitutesalesapp/lib`), here is the exact breakdown of all API calls currently made by the mobile application, what fields are sent, what fields are returned, and who uses them:

| Mobile API Endpoint | HTTP | Flutter Provider / Screen | Who Uses It | Fields Sent in Request | Key Fields Expected in Response |
|---|:---:|---|---|---|---|
| `/api/login` | `POST` | `auth_service.dart` | All (BDE, ASM, SM) | `employee_id` (or `email`), `password` | `token`, `user: { id, name, email, role, designation, team, zone, district, reports_to }` |
| `/api/logout` | `POST` | `auth_service.dart` | All | None | `success`, `message` |
| `/api/auth/refresh-token` | `POST` | `auth_service.dart` | All | Header `Authorization: Bearer <token>` | `token`, `success` |
| `/api/set-password` | `POST` | `auth_service.dart` | All | `employee_id`, `password` | `success`, `message` |
| `/api/profile` | `GET` | `user_profile_provider.dart` | All | Header `Authorization: Bearer <token>` | `data: { name, email, employee_id, designation, leave_balances }` |
| `/api/home` | `GET` | `home_provider.dart` | All (BDE, ASM, SM) | Query: `?district_id=...`, Bearer token | `data: { user, attendance, operational_overview, team_metrics, team_subordinate_status }` |
| `/api/attendance/status` | `GET` | `attendance_provider.dart` | All Field Staff | Header `Authorization: Bearer <token>` | `data: { check_in, check_out, is_checked_in, shift_status, status }` |
| `/api/attendance/check-in` | `POST` | `attendance_provider.dart` | BDE, ASM | FormData: `latitude`, `longitude`, `address`, `selfie` | `data: { check_in, status: 'ONLINE', date }` |
| `/api/attendance/check-out` | `POST` | `attendance_provider.dart` | BDE, ASM | FormData: `latitude`, `longitude`, `notes` | `data: { check_out, hours_worked, status: 'OFFLINE' }` |
| `/api/attendance/history` | `GET` | `attendance_provider.dart` | All Field Staff | Query: `?month=YYYY-MM` | `data: [ { date, check_in, check_out, hours_worked, status } ]` |
| `/api/leads` | `GET` | `operations_provider.dart` | BDE, ASM, SM | Query: `?status=1`, `?search=...`, `?district=...` | `data: [ { id, lead_id, name, student_id, phone, course, status, admission_status, followups } ]` |
| `/api/leads/create` | `POST` | `operations_provider.dart` | BDE, ASM, Admin | JSON: `name`, `phone`, `whatsapp_number`, `district`, `course_id`, `interested_course`, `notes` | `data: { id, lead_id, student_id, name, status: 1 }` |
| `/api/leads/:id/followup` | `POST` | `operations_provider.dart` | BDE | JSON: `next_followup_date`, `remarks`, `student_id`, `student_interest`, `admission_status` | `data: { lead_id, student_id, next_followup_date, remarks }` |
| `/api/leads/:id/close` | `POST` | `operations_provider.dart` | BDE | JSON: `student_id` (REQUIRED), `course`, `payment`, `payment_verification`, `remarks` | `data: { lead_id, student_id, status: 4, incentive_earned: 1000 }` |
| `/api/leads/import` | `POST` | `operations_provider.dart` | ASM, BDE | Multipart: `file` (CSV) | `data: { total_imported, imported_count }` |
| `/api/wallet/balance` | `GET` | `wallet_provider.dart` | BDE, ASM | Header `Authorization: Bearer <token>` | `data: { balance, total_earned, total_paid, withdraw_requests: { data: [...] } }` |
| `/api/wallet/withdraw` | `POST` | `wallet_provider.dart` | BDE | JSON: `amount` (max ₹5k), `remarks`, `upi_id` | `data: { request_id, amount, status: 'Submitted to ASM', remaining_balance }` |
| `/api/courses` | `GET` | `operations_provider.dart` | All | None | `data: [ { id, name, fee, duration, status } ]` |
| `/api/districts` | `GET` | `operations_provider.dart` | All | None | `data: [ { id, name, zone } ]` |
| `/api/hierarchy/filters` | `GET` | `operations_provider.dart` | All | None | `data: { zones: [...], districts: [...], designations: [...], teams: [...] }` |
| `/api/tasks` | `GET` | `home_provider.dart` | BDE, ASM | None | `data: { tasks: [...], total, completed, pending }` |
| `/api/institutes` | `GET` / `POST` | `operations_provider.dart` | BDE, ASM | `name`, `type`, `district`, `address`, `contact_person` | `data: [ { id, name, district, address } ]` |
| `/api/leaves` | `GET` | `operations_provider.dart` | All Field Staff | Header `Authorization: Bearer <token>` | `data: [ { id, leave_type, start_date, end_date, status } ]` |
| `/api/leaves/apply` | `POST` | `operations_provider.dart` | All Field Staff | JSON: `leave_type`, `start_date`, `end_date`, `reason` | `data: { id, leave_type, status: 'Pending' }` |

---

## 6. Master API Reference (Grouped by Capability)

### Group 1: Authentication & Profile APIs

#### 1.1 User Login
- **Endpoint**: `POST /api/login`
- **Purpose**: Authenticates employees (BDE, ASM, SM) or administrators into the system.
- **Who Uses It**: Admin, SM, ASM, BDE.
- **Request Body**:
```json
{
  "employee_id": "BDE001",
  "password": "password123"
}
```
*(Also accepts `"email": "admin@kide.com"`)*
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsIn...",
  "user": {
    "id": "672400a1b2c3d4e5f6071829",
    "employee_id": "BDE001",
    "name": "Siddharth V",
    "email": "bde001@kide.com",
    "role": "BDE",
    "designation": "Business Development Executive",
    "team": "EKM Team",
    "zone": "Central Zone",
    "district": "Ernakulam",
    "reports_to": "ASM004",
    "status": "active"
  }
}
```

#### 1.2 User Profile
- **Endpoint**: `GET /api/profile` (or `GET /api/auth/me`)
- **Purpose**: Retrieves the authenticated user's profile and leave balances.
- **Who Uses It**: Admin, SM, ASM, BDE.
- **Headers**: `Authorization: Bearer <token>`
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "name": "Siddharth V",
    "designation": "Business Development Executive",
    "email": "bde001@kide.com",
    "contact_number": "+91 98470 54321",
    "employee_id": "BDE001",
    "team": "EKM Team",
    "leave_balances": {
      "casual": 12,
      "medical": 8,
      "earned": 15
    }
  }
}
```

---

### Group 2: Mobile Home & Dashboard Feed APIs

#### 2.1 Home Feed Overview
- **Endpoint**: `GET /api/home`
- **Purpose**: Returns the complete dashboard state required by `HomeDashboardModel` in the mobile app.
- **Who Uses It**: BDE, ASM, SM.
- **Headers**: `Authorization: Bearer <token>`
- **Query Parameters**: `district_id` (optional).
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Home dashboard data loaded",
  "data": {
    "user": {
      "id": 101,
      "name": "Siddharth V",
      "email": "bde001@kide.com"
    },
    "designation_id": 501,
    "designation_name": "Business Development Executive",
    "attendance": {
      "check_in_time": "09:05 AM",
      "check_out_time": "--:--",
      "shift_status": "ONLINE",
      "is_checked_in": true,
      "location_lat": 10.0159,
      "location_lng": 76.3419
    },
    "eod_sync": {
      "tasks_completed": 4,
      "total_tasks": 15,
      "completion_percentage": 27
    },
    "operational_overview": {
      "assigned_leads": 15,
      "follow_up_leads": 8,
      "closed_leads": 4,
      "incentives_earned": 4000
    },
    "dashboard_type": "bde",
    "team_name": "EKM Team",
    "team_metrics": {
      "team_leads": 15,
      "team_admissions": 4,
      "team_conversion": "27%",
      "visits_pending": 8
    },
    "team_subordinate_status": {
      "bdes": []
    }
  }
}
```

---

### Group 3: Attendance & Geo-Tracking APIs

#### 3.1 Attendance Status
- **Endpoint**: `GET /api/attendance/status`
- **Purpose**: Retrieves today's live check-in and check-out status.
- **Who Uses It**: BDE, ASM.

#### 3.2 Check-In
- **Endpoint**: `POST /api/attendance/check-in`
- **Purpose**: Marks daily check-in with GPS location.
- **Who Uses It**: BDE, ASM.
- **Request Body (JSON or Multipart)**:
```json
{
  "latitude": 9.9816,
  "longitude": 76.2999,
  "address": "Kochi, Ernakulam"
}
```

#### 3.3 Check-Out
- **Endpoint**: `POST /api/attendance/check-out`
- **Purpose**: Marks check-out and computes hours worked.
- **Who Uses It**: BDE, ASM.

#### 3.4 Attendance History
- **Endpoint**: `GET /api/attendance/history`
- **Purpose**: Retrieves monthly attendance history.
- **Query Parameters**: `month=2026-10`

---

### Group 4: Leads, Follow-ups, Admissions & Bulk Import APIs

#### 4.1 List Leads
- **Endpoint**: `GET /api/leads`
- **Purpose**: Lists leads scoped to the calling employee or team.
- **Who Uses It**: BDE (own leads), ASM (team leads), SM/Admin (all leads).
- **Query Parameters**:
  - `status`: Filter by status (`1`=New, `2`=Follow-up, `4`=Admitted, `5`=Closed).
  - `search`: Search student name, contact, course, student ID.
  - `district`: Filter by district.

#### 4.2 Next Student ID Generator
- **Endpoint**: `GET /api/leads/next-student-id`
- **Purpose**: Returns the next sequential Student ID (`STU-001`, `STU-002`, `STU-003`...) for form autofill.
- **Who Uses It**: BDE, ASM, Admin.
- **Response `200 OK`**:
```json
{
  "success": true,
  "student_id": "STU-001",
  "data": {
    "student_id": "STU-001"
  }
}
```

#### 4.3 Create New Lead
- **Endpoint**: `POST /api/leads/create` (or `POST /api/leads`)
- **Purpose**: Creates a student lead with Lead ID and auto-generated Student ID.
- **Who Uses It**: BDE (auto-assigned to self), ASM, Admin.
- **Request Body**:
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
- **Response `201 Created`**:
```json
{
  "success": true,
  "message": "Lead Arjun Menon (LD-4091) created successfully",
  "data": {
    "id": 1092,
    "lead_id": "LD-4091",
    "student_id": "STU-001",
    "name": "Arjun Menon",
    "district": "Ernakulam",
    "course": "Flutter",
    "status": 1,
    "employee": "Siddharth V"
  }
}
```

#### 4.4 Record Follow-Up
- **Endpoint**: `POST /api/leads/:id/followup` (and `/follow-up`)
- **Purpose**: Records follow-up call, student interest, and next follow-up date.
- **Who Uses It**: BDE.
- **Request Body**:
```json
{
  "student_id": "STU-001",
  "next_followup_date": "2026-11-02 10:30:00",
  "remarks": "Student interested in weekend Flutter batch",
  "student_interest": "Hot",
  "admission_status": "Follow-up"
}
```

#### 4.5 Close Lead (Admission Confirmation) — Strict Student ID Check & ₹1,000 Incentive
- **Endpoint**: `POST /api/leads/:id/close`
- **Purpose**: Confirms student admission. **Verifies Student ID matches.** Credits ₹1,000 incentive to BDE.
- **Who Uses It**: BDE, ASM, Admin.
- **Request Body**:
```json
{
  "student_id": "STU-001",
  "course": "Flutter",
  "payment": 20000,
  "payment_verification": "Verified",
  "remarks": "Admission confirmed; first installment received via UPI"
}
```
- **Response `200 OK` (Matching Student ID)**:
```json
{
  "success": true,
  "message": "Lead Arjun Menon successfully closed as Admission (STU-001). ₹1,000 incentive credited to Siddharth V.",
  "data": {
    "lead_id": "LD-4091",
    "student_id": "STU-001",
    "status": 4,
    "admission_status": "Admitted",
    "incentive_earned": 1000,
    "incentive_id": "672411b2c3d4e5f6071829aa",
    "bde": "Siddharth V",
    "team": "EKM Team"
  }
}
```
- **Response `400 Bad Request` (Mismatched Student ID)**:
```json
{
  "success": false,
  "message": "Validation failed: Provided Student ID (STU-999) does not match the registered Student ID (STU-001) for this lead. Lead cannot be closed."
}
```

#### 4.6 Bulk Import Leads
- **Endpoint**: `POST /api/leads/import`
- **Purpose**: Imports multiple leads from CSV file.
- **Who Uses It**: ASM, BDE, Admin.

---

### Group 5: Incentive Withdrawal Workflow APIs

#### 5.1 Get Wallet Balance & Requests
- **Endpoint**: `GET /api/wallet/balance`
- **Purpose**: Returns current incentive balance and past withdrawal requests.
- **Who Uses It**: BDE, ASM.
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "balance": 4000,
    "total_earned": 4000,
    "total_paid": 0,
    "currency": "INR",
    "withdraw_requests": {
      "data": []
    }
  }
}
```

#### 5.2 Submit Withdrawal Request (Max ₹5,000 Limit)
- **Endpoint**: `POST /api/wallet/withdraw`
- **Purpose**: BDE submits an incentive withdrawal request to their assigned ASM.
- **Constraint**: **Maximum ₹5,000 per request.**
- **Who Uses It**: BDE.
- **Request Body**:
```json
{
  "amount": 4000,
  "remarks": "Monthly incentive withdrawal for 4 closed Flutter admissions",
  "upi_id": "siddharth@okaxis"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Incentive withdrawal request for ₹4000 submitted successfully to ASM.",
  "data": {
    "request_id": "WDR-5821",
    "amount": 4000,
    "status": "Submitted to ASM",
    "asm_name": "Anoop Menon",
    "remaining_balance": 0
  }
}
```

#### 5.3 Incentive Workflow Progression
- **Endpoint**: `POST /api/wallet/workflow`
- **Purpose**: Moves withdrawal request through the approval route (ASM → SM → Accounts).
- **Who Uses It**: ASM, SM, Accounts / Admin.
- **Request Body**:
```json
{
  "request_id": "WDR-5821",
  "action": "forward_to_sm",
  "remarks": "Verified 4 closed admissions. Approved."
}
```
*(Actions: `forward_to_sm`, `forward_to_accounts`, `sanction`, `pay`, `reject`)*

---

### Group 6: Monthly Salary Request Workflow APIs

#### 6.1 Submit Monthly Salary Request (Min ₹5,000 Limit)
- **Endpoint**: `POST /api/salary/request`
- **Purpose**: BDE submits minimum salary request to assigned ASM.
- **Constraint**: **Minimum ₹5,000.**
- **Who Uses It**: BDE.
- **Request Body**:
```json
{
  "amount": 5000,
  "period": "October 2026",
  "attendance_days": 28,
  "remarks": "Monthly minimum salary request for October 2026"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Salary request of ₹5000 submitted to ASM Anoop Menon for review.",
  "data": {
    "request_id": "SAL-8392",
    "employee_id": "BDE001",
    "amount": 5000,
    "status": "Submitted to ASM"
  }
}
```

#### 6.2 List Salary Requests
- **Endpoint**: `GET /api/salary/requests`
- **Purpose**: Lists salary requests according to caller's role permissions:
  - **BDE**: Sees only their own salary requests
  - **ASM**: Sees salary requests from BDEs under their team
  - **SM / Accounts / Admin**: Sees all forwarded salary requests
- **Who Uses It**: BDE, ASM, SM, Accounts, Admin.
- **Headers**: `Authorization: Bearer <token>`
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "6724391ab2c3d4e5f6071830",
      "request_id": "SAL-8392",
      "employee_id": "BDE001",
      "employee_name": "Siddharth V",
      "team": "EKM Team",
      "amount": 5000,
      "period": "October 2026",
      "attendance_days": 28,
      "remarks": "Monthly minimum salary request for October 2026",
      "status": "Submitted to ASM",
      "created_at": "2026-10-31T09:30:00.000Z",
      "approval_history": [
        {
          "stage": "Submitted to ASM",
          "action_by": "BDE001",
          "action_at": "2026-10-31T09:30:00.000Z",
          "remarks": "Request initiated"
        }
      ]
    }
  ]
}
```

#### 6.3 Salary Workflow Progression
- **Endpoint**: `POST /api/salary/workflow`
- **Purpose**: Advances salary request through ASM → SM → Accounts → Payment.
- **Who Uses It**: ASM, SM, Accounts, Admin.
- **Request Body (ASM forwarding to SM)**:
```json
{
  "request_id": "SAL-8392",
  "action": "forward_to_sm",
  "remarks": "28 days attendance verified. Recommended."
}
```
- **Request Body (SM forwarding to Accounts)**:
```json
{
  "request_id": "SAL-8392",
  "action": "forward_to_accounts",
  "remarks": "SM approval granted. Forwarded to Accounts for sanction."
}
```
- **Request Body (Accounts Sanction / Disbursement with UTR)**:
```json
{
  "request_id": "SAL-8392",
  "action": "pay",
  "utr": "SBIN002918239102",
  "remarks": "Salary disbursed via NEFT"
}
```
*(Actions: `forward_to_sm`, `forward_to_accounts`, `sanction`, `pay`, `reject`)*
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Salary request SAL-8392 marked as Paid with UTR SBIN002918239102.",
  "data": {
    "request_id": "SAL-8392",
    "status": "Paid",
    "utr": "SBIN002918239102"
  }
}
```

---

### Group 7: SM & ASM Management Hierarchy APIs

#### 7.1 Sales Manager (SM) Creates Area Sales Manager (ASM)
- **Endpoint**: `POST /api/sm/create-asm`
- **Purpose**: Allows SM to create an ASM and assign one of the 7 regional teams and its 2 districts.
- **Rules**: Exactly 7 regional teams. 1 ASM per team. One district cannot belong to two teams.
- **Who Uses It**: Sales Manager (SM), Admin.
- **Request Body**:
```json
{
  "name": "Bipin Joseph",
  "email": "bipin.tvm@kide.com",
  "contact_number": "+91 90000 00001",
  "password": "password123",
  "team_code": "TVM"
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "message": "Area Sales Manager Bipin Joseph (ASM001) created successfully for TVM Team. Assigned districts: Thiruvananthapuram, Kollam",
  "data": {
    "employee_id": "ASM001",
    "name": "Bipin Joseph",
    "team": "TVM Team",
    "districts": ["Thiruvananthapuram", "Kollam"],
    "reports_to": "SM001"
  }
}
```

#### 7.2 List All ASMs & Available Unallocated Teams
- **Endpoint**: `GET /api/sm/asms`
- **Purpose**: Lists all registered ASMs with their assigned teams, districts, and subordinate BDE counts, plus the unallocated regional teams available for new ASM assignments.
- **Who Uses It**: Sales Manager (SM), Admin.
- **Headers**: `Authorization: Bearer <token>`
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "asms": [
      {
        "employee_id": "ASM001",
        "name": "Bipin Joseph",
        "email": "bipin.tvm@kide.com",
        "team": "TVM Team",
        "team_code": "TVM",
        "districts": ["Thiruvananthapuram", "Kollam"],
        "bde_count": 4,
        "status": "active"
      }
    ],
    "available_teams": [
      { "code": "PTM", "name": "PTM Team", "districts": ["Pathanamthitta", "Alappuzha"] },
      { "code": "KTM", "name": "KTM Team", "districts": ["Kottayam", "Idukki"] },
      { "code": "EKM", "name": "EKM Team", "districts": ["Ernakulam", "Thrissur"] },
      { "code": "PKD", "name": "PKD Team", "districts": ["Palakkad", "Malappuram"] },
      { "code": "CLT", "name": "CLT Team", "districts": ["Kozhikode", "Wayanad"] },
      { "code": "KZE", "name": "KZE Team", "districts": ["Kannur", "Kasaragod"] },
      { "code": "OFFICE", "name": "Office Team", "districts": [] }
    ]
  }
}
```

#### 7.3 Area Sales Manager (ASM) Creates Business Development Executive (BDE)
- **Endpoint**: `POST /api/asm/create-bde`
- **Purpose**: Allows an ASM to create a BDE under their assigned team.
- **Rules**: Unlimited BDEs. BDE automatically inherits the ASM's team, zone, and district.
- **Who Uses It**: ASM, Admin.
- **Request Body**:
```json
{
  "name": "Vishnu Mohan",
  "email": "vishnu.bde@kide.com",
  "contact_number": "+91 98471 99999",
  "password": "password123",
  "district": "Ernakulam"
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "message": "Business Development Executive Vishnu Mohan (BDE006) created successfully under ASM Anoop Menon (EKM Team).",
  "data": {
    "employee_id": "BDE006",
    "name": "Vishnu Mohan",
    "team": "EKM Team",
    "district": "Ernakulam",
    "reports_to": "ASM004"
  }
}
```

#### 7.4 List BDEs
- **Endpoint**: `GET /api/asm/bdes`
- **Purpose**: Lists BDEs under the ASM or across the institution with conversion stats.
- **Who Uses It**: ASM, SM, Admin.
- **Headers**: `Authorization: Bearer <token>`
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "employee_id": "BDE001",
      "name": "Siddharth V",
      "email": "bde001@kide.com",
      "contact_number": "+91 98470 54321",
      "team": "EKM Team",
      "district": "Ernakulam",
      "status": "active",
      "metrics": {
        "total_leads": 42,
        "closed_admissions": 10,
        "conversion_rate": 23.8
      }
    }
  ]
}
```

---

### Group 8: Tasks, Field Institutes & Leaves APIs

| Endpoint | Method | Purpose | Who Uses It |
|---|:---:|---|---|
| `/api/tasks` | `GET` | Performance tasks list | BDE, ASM |
| `/api/institutes` | `GET` | List colleges & partner institutes | BDE, ASM |
| `/api/institutes` | `POST` | Add newly visited institute / college | BDE, ASM |
| `/api/leaves` | `GET` | List leave history | All |
| `/api/leaves/apply` | `POST` | Apply for casual / sick leave | All |

---

### Group 9: Public Reference Catalogs & Dropdown APIs

| Endpoint | Method | Description | Content |
|---|:---:|---|---|
| `/api/courses` | `GET` | Catalog of 5 standard courses | Flutter, Full Stack Development, Cyber Security, Digital Marketing, Data Science Pro |
| `/api/districts` | `GET` | All 14 Kerala districts | Thiruvananthapuram, Kollam, Pathanamthitta, Alappuzha, Kottayam, Idukki, Ernakulam, Thrissur, Palakkad, Malappuram, Kozhikode, Wayanad, Kannur, Kasaragod |
| `/api/zones` | `GET` | Kerala administrative zones | South Zone, Central Zone, North Zone |
| `/api/sources` | `GET` | Standard lead sources | College Visit, Referral, Seminar, Event, Campus Drive |
| `/api/designations` | `GET` | Available roles | SM, ASM, BDE, Tele-caller |
| `/api/hierarchy/filters` | `GET` | Bundled filters for mobile dropdowns | Zones, districts, designations, teams |

---

### Group 10: Admin & Accounts Department APIs

#### 10.1 Financial & Operational Statistics
- **Endpoint**: `GET /api/admin/stats`
- **Purpose**: Provides high-level dashboard metrics for the Admin and Accounts portals.
- **Who Uses It**: Admin, Accounts.

#### 10.2 Admission Incentive Records
- **Endpoint**: `GET /api/incentives`
- **Purpose**: Lists all individual ₹1,000 incentive records earned per closed admission. Supports filtering by BDE or date range.
- **Who Uses It**: Accounts, Admin, SM, ASM, BDE.
- **Headers**: `Authorization: Bearer <token>`
- **Query Parameters**: `?bde_id=BDE001`, `?student_id=STU-001` (optional)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "672411b2c3d4e5f6071829aa",
      "lead_id": "LD-4091",
      "student_id": "STU-001",
      "student_name": "Arjun Menon",
      "course": "Flutter",
      "bde_id": "BDE001",
      "bde_name": "Siddharth V",
      "team": "EKM Team",
      "amount": 1000,
      "status": "Earned",
      "admission_date": "2026-10-31T10:15:00.000Z"
    }
  ],
  "summary": {
    "total_incentives_count": 1,
    "total_amount": 1000
  }
}
```

#### 10.3 Generic Admin Resource Management
- **Endpoints**: `GET`, `POST`, `PUT`, `DELETE` on `/api/admin/:tab`
- **Supported Tabs**: `employees`, `teams`, `districts`, `zones`, `courses`, `leads`, `attendance`, `wallets`, `wallet-withdraw-requests`, `salary-requests`, `leaves`, `activities`.
- **Who Uses It**: Admin.

---

## 7. Verification & Compliance Checklist

| Requirement | Implementation Detail | Status |
|---|---|:---:|
| **Admin -> SM -> ASM -> BDE Hierarchy** | Enforced across database schemas, JWT tokens, and routes. | Verified |
| **Single Sales Manager (SM)** | Only 1 SM active in system (`SM001`). SM creates ASMs. | Verified |
| **7 Regional Teams + 1 Office Team** | 7 regional teams with 2 districts each + 1 Office Team for tele-callers under SM. | Verified |
| **No Duplicate District Assignment** | District uniqueness enforced across teams. | Verified |
| **1 Team per ASM** | ASM uniqueness enforced per team. | Verified |
| **ASM Creates BDEs** | BDE creation inherits ASM team, district, and sets `reports_to: asm.employee_id`. | Verified |
| **Unique Lead ID & STU-xxx ID** | Generated sequentially (`STU-001`, `STU-002`...). | Verified |
| **Lead Close Requires Matching Student ID** | Rejects closing if provided Student ID does not match registered Student ID. | Verified |
| **₹1,000 Incentive per Closed Lead** | Credited to BDE wallet on close; stored in `Incentives` collection. | Verified |
| **Withdrawal Request Max ₹5,000** | Strict validation rule in `/api/wallet/withdraw`. | Verified |
| **Incentive Withdrawal Approval Flow** | BDE → ASM → SM → Accounts. | Verified |
| **Salary Request Min ₹5,000** | Strict validation rule in `/api/salary/request`. | Verified |
| **Salary Approval Flow** | BDE → ASM → SM → Accounts. | Verified |
| **Accounts Section in Admin Portal** | Dedicated `AccountsView.tsx` with P&L KPIs, salary sanctions, incentive disbursements, and admission records. | Verified |
| **5 Standard Courses** | Flutter, Full Stack Development, Cyber Security, Digital Marketing, Data Science Pro. | Verified |
| **No Git Commits or Pushes** | Strictly preserved local state without committing or pushing. | Verified |
