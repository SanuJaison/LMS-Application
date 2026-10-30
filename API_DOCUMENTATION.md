# KIDE LMS / CRM — Complete API Documentation

This document covers all API endpoints available in the backend:
1. **Admin Panel APIs** — Used by the Admin Web Dashboard (`localhost:3001/?tab=...`)
2. **App Side APIs** — Used by the Mobile App (Flutter / Android / iOS field force app)

---

## Table of Contents
- [Authentication & Global Headers](#authentication--global-headers)
- [Admin Panel APIs](#part-1-admin-panel-apis)
  - [1. Dashboard Statistics & Analytics](#1-dashboard-statistics--analytics)
  - [2. Generic Admin Resource CRUD (/api/admin/[tab])](#2-generic-admin-resource-crud)
  - [3. Tab-by-Tab Reference & Payloads](#3-tab-by-tab-reference--payloads)
    - [Employees](#31-employees)
    - [Teams](#32-teams)
    - [Leads](#33-leads)
    - [Attendance Records](#34-attendance-records)
    - [Zones & Districts](#35-zones--districts)
    - [Designations & Courses](#36-designations--courses)
    - [Task Templates & Employee Tasks](#37-task-templates--employee-tasks)
    - [Leaves](#38-leaves)
    - [Wallet & Withdraw Requests](#39-wallet--withdraw-requests)
    - [Activity Log / Audit Trail](#310-activity-log--audit-trail)
  - [4. Automated Task Generation](#4-automated-task-generation)
  - [5. Database Seed](#5-database-seed)
- [App Side (Mobile / Field) APIs](#part-2-app-side-mobile--field-apis)
  - [1. Authentication & Profile](#1-authentication--profile)
    - [Employee / User Login](#11-employee--user-login)
    - [Current User Profile (Me)](#12-current-user-profile-me)
    - [Refresh Token](#13-refresh-token)
    - [Change / Set Password](#14-change--set-password)
    - [Logout](#15-logout)
  - [2. Mobile Home / Dashboard](#2-mobile-home--dashboard)
    - [Home Overview Feed](#21-home-overview-feed)
    - [Operations Overview](#22-operations-overview)
  - [3. Attendance & Geo-Tracking](#3-attendance--geo-tracking)
    - [Check-In](#31-check-in)
    - [Check-Out](#32-check-out)
    - [Attendance Status Today](#33-attendance-status-today)
    - [Attendance History](#34-attendance-history)
  - [4. Leads & Pipeline](#4-leads--pipeline)
    - [List Leads](#41-list-leads)
    - [Create Lead](#42-create-lead)
    - [Bulk Import Leads](#43-bulk-import-leads)
    - [Record Follow-Up](#44-record-follow-up)
    - [Close / Convert Lead](#45-close--convert-lead)
    - [Pending Follow-Ups](#46-pending-follow-ups)
  - [5. Tasks & Performance](#5-tasks--performance)
    - [List Assigned Tasks](#51-list-assigned-tasks)
    - [Update Task Progress / Status](#52-update-task-progress--status)
  - [6. Institutes & Field Visits](#6-institutes--field-visits)
    - [List Institutes](#61-list-institutes)
    - [Create Institute](#62-create-institute)
    - [Get Institute Details](#63-get-institute-details)
  - [7. Team Hierarchy (Manager Views)](#7-team-hierarchy-manager-views)
    - [Team Members Overview](#71-team-members-overview)
    - [Hierarchy Dropdown Filters](#72-hierarchy-dropdown-filters)
  - [8. Leaves Management](#8-leaves-management)
    - [List My Leaves](#81-list-my-leaves)
    - [Apply for Leave](#82-apply-for-leave)
  - [9. Wallet & Incentives](#9-wallet--incentives)
    - [Get Wallet Balance](#91-get-wallet-balance)
    - [Submit Withdraw Request](#92-submit-withdraw-request)
  - [10. Public Reference Catalogs](#10-public-reference-catalogs)
    - [Courses Catalog](#101-courses-catalog)
    - [Lead Sources](#102-lead-sources)
    - [Zones & Districts](#103-zones--districts)
    - [Designations](#104-designations)

---

## Authentication & Global Headers

All authenticated requests should provide the JSON Web Token (JWT) in the HTTP `Authorization` header:

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

Standard API responses follow either:
1. Standard envelope:
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```
2. Laravel-compatible envelope (for mobile app endpoints):
```json
{
  "success": true,
  "message": "Success",
  "data": { ... }
}
```

---

# Part 1: Admin Panel APIs

Used by the web admin portal (`/api/admin/...`).

### 1. Dashboard Statistics & Analytics

#### `GET /api/admin/stats`
Fetches live dashboard metrics, lead breakdowns, monthly trends, and live field force attendance.

- **Query Parameters**:
  - `zone` (optional): Filter stats by zone name (e.g. `Central Zone`).
  - `district` (optional): Filter stats by district name (e.g. `Ernakulam`).

- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "totalLeads": 1420,
    "newLeadsToday": 18,
    "activeFieldForce": "7/8 Active",
    "totalEmployees": 12,
    "leadsByStatus": {
      "labels": ["New", "Contacted", "Follow Up", "Admitted", "Closed"],
      "data": [450, 320, 290, 210, 150],
      "colors": ["#3b82f6", "#06b6d4", "#eab308", "#10b981", "#ef4444"]
    },
    "leadGenerationTrend": {
      "months": ["May", "Jun", "Jul", "Aug", "Sep", "Oct"],
      "data": [120, 180, 240, 310, 280, 350]
    },
    "leadsByDistrict": {
      "labels": ["Ernakulam", "Thrissur", "Kozhikode", "Kannur", "Malappuram", "Thiruvananthapuram", "Kottayam"],
      "data": [310, 240, 210, 190, 180, 160, 130]
    },
    "liveAttendance": [
      {
        "id": "672100abc123",
        "name": "Anoop Menon",
        "designation": "Area Sales Manager",
        "district": "Ernakulam",
        "check_in": "09:05 AM",
        "check_out": "",
        "status": "ONLINE"
      }
    ]
  }
}
```

---

### 2. Generic Admin Resource CRUD

The admin backend uses a dynamic RESTful endpoint `/api/admin/[tab]` supporting all tabs:
- `leads`, `employees`, `teams`, `attendance`, `attendanceRecords`, `zones`, `districts`, `courses`, `designations`, `tasks`, `taskTemplates`, `employeeTasks`, `wallets`, `walletWithdrawRequests`, `leaves`, `activities`, `roles`, `settings`.

#### `GET /api/admin/[tab]`
- **Query Parameters**:
  - `page` (number, default: 1)
  - `limit` (number, default: 1000)
  - `search` (string)
  - `sortField` (string)
  - `sortOrder` (`asc` | `desc`)
  - Any field filter (e.g. `district=Ernakulam`, `zone=Central Zone`)

- **Special Behaviour for `employees` tab**:
  - Automatically derives the employee's `team` based on the `teams` collection:
    - ASMs get their team where they are assigned as `team_lead`.
    - BDEs derive their team from the ASM they report to.
    - Sales Managers (SM) / Managing Directors (MD) have no team, zone, district, or manager.

- **Response `200 OK`**:
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "total": 24,
    "page": 1,
    "limit": 1000,
    "pages": 1
  }
}
```

#### `POST /api/admin/[tab]`
Creates a new record.

#### `PUT /api/admin/[tab]`
Updates an existing record (must include `id` or `_id`).

#### `DELETE /api/admin/[tab]`
- Single delete: `DELETE /api/admin/[tab]?id=<record_id>`
- Bulk delete: `DELETE /api/admin/[tab]` with body `{ "ids": ["id1", "id2"] }`

---

### 3. Tab-by-Tab Reference & Payloads

#### 3.1 Employees (`/api/admin/employees`)

- **Hierarchy Rules**:
  - **Sales Manager (SM)**: Top-level executive. `zone`, `district`, `reports_to`, and `team` are stripped/empty.
  - **Area Sales Manager (ASM)**: Reports **only** to the Sales Manager (`SM`). Team is automatically derived from the field team they lead.
  - **Business Development Executive (BDE)**: Reports **only** to an Area Sales Manager (`ASM`). When an ASM is selected in `reports_to`, the BDE's team and zone are automatically derived from that ASM's assigned team. The `district` field is restricted to choose between the **two districts** covered by that team.

- **Request Body Example (Create ASM)**:
```json
{
  "name": "Anoop Menon",
  "email": "anoop.menon@kide.com",
  "password": "password123",
  "employee_id": "ASM001",
  "contact_number": "9000000001",
  "designation": "Area Sales Manager",
  "zone": "Central Zone",
  "district": "Ernakulam",
  "reports_to": "SM001",
  "status": "active",
  "bank_name": "State Bank of India",
  "account_holder_name": "Anoop Menon",
  "account_number": "32165498701",
  "ifsc_code": "SBIN0001234",
  "upi_id": "anoop@okaxis"
}
```

- **Request Body Example (Create Sales Manager / SM)**:
```json
{
  "name": "Kiran Kumar",
  "email": "kiran.kumar@kide.com",
  "password": "password123",
  "employee_id": "SM001",
  "contact_number": "9000000000",
  "designation": "Sales Manager",
  "status": "active"
}
```

---

#### 3.2 Teams (`/api/admin/teams`)

- **Rules**:
  - **Field Team**: Must cover **exactly 2 districts**, and must have an **Area Sales Manager (ASM)** as `team_lead`. Each district can only belong to one team.
  - **Office Team**: Marked with `is_office: true`. Operates without districts or zone, and reports directly under a **Sales Manager (SM)** as its `team_lead`.

- **Request Body Example (Field Team)**:
```json
{
  "name": "Team Ernakulam",
  "zone": "Central Zone",
  "districts": ["Ernakulam", "Idukki"],
  "team_lead": "Anoop Menon",
  "is_office": false,
  "description": "Central Zone Field Team 1"
}
```

- **Request Body Example (Office Team)**:
```json
{
  "name": "Office Team",
  "districts": [],
  "team_lead": "Kiran Kumar",
  "is_office": true,
  "description": "Headquarters Support Team"
}
```

---

#### 3.3 Leads (`/api/admin/leads` or `/api/leads/create`)

- **Request Body Example**:
```json
{
  "name": "Rahul Verma",
  "contact": "9876543210",
  "whatsapp_number": "9876543210",
  "email": "rahul.v@gmail.com",
  "district": "Ernakulam",
  "zone": "Central Zone",
  "course": "Full-Stack Web Development",
  "source": "Instagram Ads",
  "admission_status": "New",
  "assigned_to": "Anoop Menon",
  "remarks": "Interested in morning batch"
}
```

---

#### 3.4 Attendance Records (`/api/admin/attendance`)

- **Record Structure**:
```json
{
  "name": "Anoop Menon",
  "designation": "Area Sales Manager",
  "district": "Ernakulam",
  "date": "2026-10-30",
  "check_in": "09:15 AM",
  "check_out": "06:30 PM",
  "hours_worked": 9.25,
  "status": "ONLINE"
}
```

---

#### 3.5 Zones & Districts

- **Zones (`/api/admin/zones`)**:
```json
{
  "name": "Central Zone",
  "description": "Ernakulam, Thrissur, Palakkad, Alappuzha, Idukki"
}
```

- **Districts (`/api/admin/districts`)**:
```json
{
  "name": "Ernakulam",
  "zone": "Central Zone",
  "description": "Commercial Capital"
}
```

---

#### 3.6 Designations & Courses

- **Designations (`/api/admin/designations`)**:
```json
{
  "name": "Area Sales Manager",
  "prefix": "ASM",
  "level": 2,
  "description": "Manages field sales teams"
}
```

- **Courses (`/api/admin/courses`)**:
```json
{
  "name": "AI & Data Science Professional",
  "fee": 45000,
  "duration": "6 Months",
  "status": "Active"
}
```

---

#### 3.7 Task Templates & Employee Tasks

- **Task Templates (`/api/admin/task-templates`)**:
```json
{
  "title": "College Outreach Visit",
  "description": "Visit 2 engineering colleges in assigned district",
  "target_designation": "Area Sales Manager",
  "frequency": "Daily",
  "points": 50,
  "status": "Active"
}
```

- **Employee Tasks (`/api/admin/employee-tasks`)**:
```json
{
  "employee": "Anoop Menon",
  "employee_id": "ASM001",
  "title": "College Outreach Visit",
  "due_date": "2026-10-31",
  "status": "In Progress",
  "proof_notes": "Completed visit at Rajagiri"
}
```

---

#### 3.8 Leaves (`/api/admin/leaves`)

```json
{
  "employee": "Divya Nair",
  "leave_type": "Medical Leave",
  "start_date": "2026-11-02",
  "end_date": "2026-11-03",
  "reason": "Doctor appointment",
  "status": "Pending"
}
```

---

#### 3.9 Wallet & Withdraw Requests (`/api/admin/wallet-withdraw-requests`)

```json
{
  "employee": "Anoop Menon",
  "amount": 5000,
  "upi_id": "anoop@okaxis",
  "account_number": "32165498701",
  "ifsc_code": "SBIN0001234",
  "status": "Pending"
}
```

---

#### 3.10 Activity Log / Audit Trail (`/api/admin/activities`)

Read-only log tracking system actions:
```json
{
  "description": "Created employee ASM001 (Anoop Menon)",
  "subjectType": "Employee",
  "causer": "Admin",
  "createdAt": "2026-10-30T08:45:00.000Z"
}
```

---

### 4. Automated Task Generation

#### `POST /api/task-templates/generate`
Manually triggers task generation for all active templates for today.

- **Response `200 OK`**:
```json
{
  "success": true,
  "generatedCount": 14,
  "message": "Tasks generated successfully"
}
```

---

### 5. Database Seed

#### `POST /api/seed`
Initializes foundational data: Kerala zones, 14 districts, designations, initial admin user, and sample courses.

---

# Part 2: App Side (Mobile / Field) APIs

Used by the mobile Flutter application. All endpoints require `Authorization: Bearer <token>` unless marked **Public**.

---

## 1. Authentication & Profile

### 1.1 Employee / User Login
#### `POST /api/login` (Public)

Accepts either:
1. `employee_id` + `password` (e.g. `ASM001` / `password123`)
2. `email` + `password` (e.g. `admin@kide.com` / `password123`)

- **Request Body**:
```json
{
  "employee_id": "ASM001",
  "password": "password123"
}
```

- **Response `200 OK` (Laravel / Flutter shape)**:
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "require_password_change": false,
    "user": {
      "id": 145920,
      "name": "Anoop Menon",
      "email": "anoop.menon@kide.com",
      "employee_id": "ASM001",
      "contact_number": "9000000001",
      "designation_name": "Area Sales Manager",
      "designation_id": 401,
      "team": "Team Ernakulam",
      "reports_to": "SM001",
      "zone": "Central Zone",
      "district": "Ernakulam",
      "created_at": "2026-10-30T08:30:00.000000Z",
      "updated_at": "2026-10-30T08:30:00.000000Z",
      "roles": ["employee"],
      "permissions": []
    }
  }
}
```

---

### 1.2 Current User Profile (Me)
#### `GET /api/auth/me`

- **Headers**: `Authorization: Bearer <token>`
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "id": "6720f1234567890abcdef123",
    "employee_id": "ASM001",
    "name": "Anoop Menon",
    "email": "anoop.menon@kide.com",
    "contact_number": "9000000001",
    "designation": "Area Sales Manager",
    "team": "Team Ernakulam",
    "reports_to": "SM001",
    "zone": "Central Zone",
    "district": "Ernakulam"
  }
}
```

---

### 1.3 Refresh Token
#### `POST /api/auth/refresh-token`

- **Headers**: `Authorization: Bearer <token>`
- **Response `200 OK`**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

### 1.4 Change / Set Password

#### `POST /api/employee/change-password`
- **Request Body**:
```json
{
  "current_password": "password123",
  "new_password": "NewSecretPassword@2026"
}
```

#### `POST /api/set-password`
Used for first-time password setup.
- **Request Body**:
```json
{
  "employee_id": "ASM001",
  "password": "NewSecretPassword@2026"
}
```

---

### 1.5 Logout
#### `POST /api/logout`
- **Headers**: `Authorization: Bearer <token>`
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 2. Mobile Home / Dashboard

### 2.1 Home Overview Feed
#### `GET /api/home`
Main home screen payload for the mobile app containing the employee's attendance status today, daily tasks, wallet balance, active leads summary, and team overview.

- **Query Parameters**:
  - `team_scope` (optional: `direct` | `all`, default: `direct`)

- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Home feed loaded",
  "data": {
    "employee": {
      "id": "6720f1234567890abcdef123",
      "employee_id": "ASM001",
      "name": "Anoop Menon",
      "designation": "Area Sales Manager",
      "team": "Team Ernakulam"
    },
    "attendance": {
      "date": "2026-10-30",
      "status": "ONLINE",
      "check_in": "09:05 AM",
      "check_out": null,
      "hours_worked": 5.5,
      "checked_in": true,
      "checked_out": false
    },
    "tasks": {
      "total": 3,
      "completed": 1,
      "pending": 2,
      "list": [
        {
          "id": "task_01",
          "title": "Outreach at Rajagiri School",
          "status": "Completed",
          "due_date": "2026-10-30"
        }
      ]
    },
    "wallet": {
      "balance": 7500,
      "currency": "INR"
    },
    "leads": {
      "total": 42,
      "today": 3,
      "admitted": 12
    },
    "team": {
      "name": "Team Ernakulam",
      "role": "ASM",
      "members_count": 4,
      "active_today": 3,
      "members": [
        {
          "employee_id": "BDE001",
          "name": "Siddharth V",
          "designation": "Business Development Executive",
          "status": "ONLINE"
        }
      ]
    }
  }
}
```

---

## 3. Attendance & Geo-Tracking

### 3.1 Check-In
#### `POST /api/attendance/check-in`
Marks daily attendance with timestamp and optional GPS location.

- **Request Body**:
```json
{
  "latitude": 9.9816,
  "longitude": 76.2999,
  "address": "Kakkanad, Kochi, Kerala",
  "selfie_url": "https://storage.kide.com/selfies/checkin_asm001_20261030.jpg"
}
```

- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Checked in successfully",
  "data": {
    "date": "2026-10-30",
    "check_in": "09:05 AM",
    "status": "ONLINE"
  }
}
```

---

### 3.2 Check-Out
#### `POST /api/attendance/check-out`
Marks check-out and calculates `hours_worked`.

- **Request Body**:
```json
{
  "latitude": 9.9816,
  "longitude": 76.2999,
  "notes": "Finished daily visits in Aluva cluster"
}
```

- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Checked out successfully",
  "data": {
    "date": "2026-10-30",
    "check_in": "09:05 AM",
    "check_out": "06:15 PM",
    "hours_worked": 9.17,
    "status": "OFFLINE"
  }
}
```

---

### 3.3 Attendance Status Today
#### `GET /api/attendance/status`

- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "date": "2026-10-30",
    "status": "ONLINE",
    "check_in": "09:05 AM",
    "check_out": null,
    "hours_worked": 5.5,
    "checked_in": true,
    "checked_out": false
  }
}
```

---

### 3.4 Attendance History
#### `GET /api/attendance/history`
- **Query Parameters**:
  - `month` (e.g. `2026-10`)
  - `limit` (default: 31)

- **Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "date": "2026-10-29",
      "check_in": "09:02 AM",
      "check_out": "06:05 PM",
      "hours_worked": 9.05,
      "status": "PRESENT"
    }
  ]
}
```

---

## 4. Leads & Pipeline

### 4.1 List Leads
#### `GET /api/leads`
Lists leads scoped to the authenticated employee (or team if manager).

- **Query Parameters**:
  - `status`: Numeric code (`1` = New, `2` = Contacted, `3` = Follow-up, `4` = Admitted/Won, `5` = Closed/Lost) or string.
  - `district`: Filter by district name.
  - `course`: Filter by course name.
  - `search`: Search student name, phone, email, or lead ID.
  - `lead_id` or `id`: Fetch specific lead.

- **Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1001,
      "lead_id": "LD-5821",
      "name": "Ananya Sen",
      "contact": "9876543210",
      "whatsapp_number": "9876543210",
      "email": "ananya@gmail.com",
      "district": "Ernakulam",
      "course": "Full-Stack Web Development",
      "source": "Instagram Ads",
      "status": 1,
      "status_label": "New",
      "student_id": null,
      "assigned_to": "Anoop Menon",
      "created_at": "2026-10-28T10:15:00.000000Z"
    }
  ]
}
```

---

### 4.2 Create Lead
#### `POST /api/leads/create`

- **Request Body**:
```json
{
  "name": "Deepak Raj",
  "contact": "9847123456",
  "whatsapp_number": "9847123456",
  "email": "deepak.raj@gmail.com",
  "district": "Ernakulam",
  "course": "AI & Data Science Professional",
  "source": "Campus Visit",
  "remarks": "Interested in placement assistance"
}
```

- **Response `201 Created`**:
```json
{
  "success": true,
  "message": "Lead created successfully",
  "data": {
    "id": 1002,
    "lead_id": "LD-6942",
    "name": "Deepak Raj",
    "contact": "9847123456",
    "status": 1,
    "status_label": "New"
  }
}
```

---

### 4.3 Record Follow-Up
#### `POST /api/leads/:id/follow-up`

- **Request Body**:
```json
{
  "type": "Phone Call",
  "remarks": "Student asked for syllabus; follow up tomorrow 4 PM",
  "next_followup_date": "2026-10-31 16:00:00",
  "student_id": "STU-1002"
}
```

- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Follow-up recorded successfully",
  "data": {
    "lead_id": "LD-6942",
    "status": 3,
    "status_label": "Follow Up",
    "next_followup_date": "2026-10-31 16:00:00"
  }
}
```

---

### 4.4 Close / Convert Lead
#### `POST /api/leads/:id/close`
Converts lead to "Admitted / Won". Requires confirmed `student_id`.

- **Request Body**:
```json
{
  "student_id": "STU-1002",
  "course": "AI & Data Science Professional",
  "payment": 35000,
  "payment_verification": "Verified",
  "remarks": "Admission confirmed, first installment received"
}
```

- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Lead closed successfully (Admitted)",
  "data": {
    "lead_id": "LD-6942",
    "student_id": "STU-1002",
    "status": 4,
    "status_label": "Admitted"
  }
}
```

---

### 4.5 Pending Follow-Ups
#### `GET /api/followups`
Lists all upcoming scheduled follow-ups for the logged-in employee.

- **Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "lead_id": "LD-6942",
      "name": "Deepak Raj",
      "contact": "9847123456",
      "next_followup_date": "2026-10-31 16:00:00",
      "remarks": "Discuss fee discount"
    }
  ]
}
```

---

## 5. Tasks & Performance

### 5.1 List Assigned Tasks
#### `GET /api/tasks`

- **Query Parameters**:
  - `scope` (optional):
    - Omitted: Only tasks assigned to calling employee.
    - `team`: Direct reports' tasks (for ASMs/Managers).
    - `all`: Entire subtree tasks.

- **Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "id": "6720abc12345",
      "title": "Visit Al-Ameen College",
      "description": "Meet placement officer",
      "due_date": "2026-10-30",
      "status": "In Progress",
      "points": 50
    }
  ]
}
```

---

### 5.2 Update Task Progress / Status
#### `PUT /api/tasks` or `PUT /api/employee-tasks`

- **Request Body**:
```json
{
  "id": "6720abc12345",
  "status": "Completed",
  "proof_notes": "Met placement coordinator Prof. Abdul, collected 45 leads."
}
```

---

## 6. Institutes & Field Visits

### 6.1 List Institutes
#### `GET /api/institutes`
- **Query Parameters**:
  - `district` (optional): Filter by district.
  - `search` (optional): Search institute name.

### 6.2 Create Institute
#### `POST /api/institutes/create`
- **Request Body**:
```json
{
  "name": "Model Engineering College",
  "type": "Engineering College",
  "district": "Ernakulam",
  "address": "Thrikkakara, Kochi",
  "contact_person": "Dr. Jacob",
  "contact_phone": "9847000111",
  "email": "placement@mec.ac.in"
}
```

---

## 7. Team Hierarchy (Manager Views)

### 7.1 Team Members Overview
#### `GET /api/team`
Returns team roster for the authenticated manager.
- If called by an **Area Sales Manager (ASM)**: Returns the BDEs reporting to this ASM.
- If called by the **Sales Manager (SM)**: Returns all ASMs and team structures.
- If called by a **BDE**: Returns empty list (individual contributor).

- **Query Parameters**:
  - `scope`: `direct` (default) or `all`

- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "team_name": "Team Ernakulam",
    "role": "ASM",
    "members_count": 2,
    "members": [
      {
        "employee_id": "BDE001",
        "name": "Siddharth V",
        "designation": "Business Development Executive",
        "district": "Ernakulam",
        "phone": "9000000010",
        "today_attendance": "ONLINE",
        "leads_this_month": 18
      },
      {
        "employee_id": "BDE002",
        "name": "Fathima Noor",
        "designation": "Business Development Executive",
        "district": "Idukki",
        "phone": "9000000011",
        "today_attendance": "OFFLINE",
        "leads_this_month": 12
      }
    ]
  }
}
```

---

### 7.2 Hierarchy Dropdown Filters
#### `GET /api/hierarchy/filters` (Public / App)
Provides all available dropdown options for filtering records across mobile screens.

- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "zones": [
      { "id": "z1", "name": "Central Zone" },
      { "id": "z2", "name": "North Zone" },
      { "id": "z3", "name": "South Zone" }
    ],
    "districts": [
      { "id": "d1", "name": "Ernakulam", "zone": "Central Zone" },
      { "id": "d2", "name": "Thrissur", "zone": "Central Zone" }
    ],
    "designations": [
      { "id": "des1", "name": "Sales Manager", "prefix": "SM" },
      { "id": "des2", "name": "Area Sales Manager", "prefix": "ASM" },
      { "id": "des3", "name": "Business Development Executive", "prefix": "BDE" }
    ],
    "teams": [
      {
        "id": "t1",
        "name": "Team Ernakulam",
        "district": "Ernakulam",
        "districts": ["Ernakulam", "Idukki"],
        "zone": "Central Zone"
      },
      {
        "id": "t2",
        "name": "Office Team",
        "district": null,
        "districts": [],
        "zone": "Central Zone"
      }
    ]
  }
}
```

---

## 8. Leaves Management

### 8.1 List My Leaves
#### `GET /api/leaves`
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "id": "leave_01",
      "leave_type": "Casual Leave",
      "start_date": "2026-11-05",
      "end_date": "2026-11-05",
      "reason": "Family function",
      "status": "Approved"
    }
  ]
}
```

---

### 8.2 Apply for Leave
#### `POST /api/leaves/apply`

- **Request Body**:
```json
{
  "leave_type": "Casual Leave",
  "start_date": "2026-11-10",
  "end_date": "2026-11-11",
  "reason": "Personal work"
}
```

- **Response `201 Created`**:
```json
{
  "success": true,
  "message": "Leave applied successfully",
  "data": {
    "id": "leave_02",
    "leave_type": "Casual Leave",
    "start_date": "2026-11-10",
    "end_date": "2026-11-11",
    "status": "Pending"
  }
}
```

---

## 9. Wallet & Incentives

### 9.1 Get Wallet Balance
#### `GET /api/wallet/balance`

- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "balance": 8500,
    "currency": "INR",
    "employee": "Anoop Menon"
  }
}
```

---

### 9.2 Submit Withdraw Request
#### `POST /api/wallet/withdraw`

- **Request Body**:
```json
{
  "amount": 5000,
  "upi_id": "anoop@okaxis",
  "bank_name": "State Bank of India",
  "account_number": "32165498701",
  "ifsc_code": "SBIN0001234"
}
```

- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Withdrawal request submitted successfully",
  "data": {
    "requestId": "WDR-1092",
    "amount": 5000,
    "status": "Pending"
  }
}
```

---

## 10. Public Reference Catalogs

Public reference endpoints for mobile dropdowns:

| Endpoint | Method | Description |
|---|---|---|
| `/api/courses` | `GET` | List active courses with fees and duration |
| `/api/courses/:id` | `GET` | Single course details |
| `/api/sources` | `GET` | Lead source list (e.g. Instagram, Campus, Referral) |
| `/api/zones` | `GET` | Active Kerala zones |
| `/api/districts` | `GET` | All 14 Kerala districts (supports `?zone=...`) |
| `/api/designations` | `GET` | Available employee designations and prefixes |
| `/api/hierarchy/filters` | `GET` | Combined filter options bundle |
