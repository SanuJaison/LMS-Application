# KIDE LMS API Documentation

> **Base URL:** `https://lms-application-pi.vercel.app` (Production) / `http://localhost:3000` (Local)  
> **Headers:** For all authenticated requests, pass `Authorization: Bearer <token>` and `Content-Type: application/json`.

---

## Table of Contents
1. [Authentication & Public APIs (No Token)](#1-authentication--public-apis-no-token)
2. [Admin & Accounts APIs (Admin Token)](#2-admin--accounts-apis-admin-token)
3. [Sales Manager (SM) APIs (SM Token)](#3-sales-manager-sm-apis-sm-token)
4. [Area Sales Manager (ASM) & Office Team Lead APIs (ASM / Office Lead Token)](#4-area-sales-manager-asm--office-team-lead-apis-asm--office-lead-token)
5. [Business Development Executive (BDE) & Tele-caller APIs (BDE / Tele-caller Token)](#5-business-development-executive-bde--tele-caller-apis-bde--tele-caller-token)
6. [Shared Employee APIs (Any Employee Token)](#6-shared-employee-apis-any-employee-token)

---

## 1. Authentication & Public APIs (No Token)

### 1.1 User Login
- **Endpoint:** `POST /api/login`
- **Token Needed:** None
- **Request Body:**
```json
{
  "employee_id": "SM001",
  "password": "password123"
}
```
*(Supports `email` instead of `employee_id` for both Admin and Employee logins).*
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": "672322...",
      "numeric_id": 101,
      "employee_id": "SM001",
      "name": "State Sales Manager",
      "email": "sm@kide.com",
      "designation": "Sales Manager",
      "team": "Office Team",
      "zone": "Central Zone",
      "district": "Ernakulam",
      "role": "SM"
    }
  }
}
```

### 1.2 User Logout
- **Endpoint:** `POST /api/logout`
- **Token Needed:** None
- **Request Body:** None `{}`
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### 1.3 First-Time Password Setup
- **Endpoint:** `POST /api/set-password`
- **Token Needed:** None
- **Request Body:**
```json
{
  "employee_id": "ASM001",
  "password": "newSecurePassword123"
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Password set successfully. You can now log in."
}
```

### 1.4 Bundled Mobile Dropdown Filters
- **Endpoint:** `GET /api/hierarchy/filters`
- **Token Needed:** None
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "zones": ["South Zone", "Central Zone", "North Zone"],
    "districts": ["Thiruvananthapuram", "Kollam", "Pathanamthitta", "Alappuzha", "Kottayam", "Idukki", "Ernakulam", "Thrissur", "Palakkad", "Malappuram", "Kozhikode", "Wayanad", "Kannur", "Kasaragod"],
    "designations": ["Sales Manager", "Area Sales Manager", "Business Development Executive", "Office Team Lead", "Tele-caller"],
    "teams": ["TVM Team", "PTM Team", "KTM Team", "EKM Team", "PKD Team", "CLT Team", "KZD Team", "Office Team"]
  }
}
```

### 1.5 List Courses Catalog
- **Endpoint:** `GET /api/courses`
- **Token Needed:** None
- **Response `200 OK`:**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "_id": "6724a...",
      "id": 1,
      "name": "Flutter & Mobile App Development",
      "fee": 20000,
      "duration": "4 Months",
      "status": "active"
    }
  ]
}
```

### 1.6 List Districts
- **Endpoint:** `GET /api/districts`
- **Token Needed:** None
- **Response `200 OK`:**
```json
{
  "success": true,
  "count": 14,
  "data": [
    {
      "_id": "6724b...",
      "name": "Ernakulam",
      "zone": "Central Zone"
    }
  ]
}
```

### 1.7 List Zones
- **Endpoint:** `GET /api/zones`
- **Token Needed:** None
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    { "name": "South Zone", "description": "South Kerala operations" },
    { "name": "Central Zone", "description": "Central Kerala operations" },
    { "name": "North Zone", "description": "North Kerala operations" }
  ]
}
```

### 1.8 List Designations
- **Endpoint:** `GET /api/designations`
- **Token Needed:** None
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    { "name": "Sales Manager", "prefix": "SM" },
    { "name": "Area Sales Manager", "prefix": "ASM" },
    { "name": "Business Development Executive", "prefix": "BDE" }
  ]
}
```

### 1.9 List Lead Sources
- **Endpoint:** `GET /api/sources`
- **Token Needed:** None
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": ["Campus Drive / College Seminar", "College Visit", "Referral", "Walk-in", "Social Media", "Tele-calling"]
}
```

---

## 2. Admin & Accounts APIs (Admin Token)

### 2.1 Create Sales Manager (Strictly 1 in Org)
- **Endpoint:** `POST /api/admin/create-sm`
- **Token Needed:** `Admin`
- **Request Body:**
```json
{
  "name": "Vikram Seth",
  "email": "sm@kide.com",
  "contact_number": "+91 98470 00001",
  "password": "password123"
}
```
- **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Sales Manager Vikram Seth (SM001) created successfully.",
  "data": {
    "employee_id": "SM001",
    "name": "Vikram Seth",
    "email": "sm@kide.com",
    "designation": "Sales Manager",
    "zone": "Central Zone"
  }
}
```

### 2.2 Financial & System Statistics
- **Endpoint:** `GET /api/admin/stats`
- **Token Needed:** `Admin`
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "total_leads": 350,
    "total_admissions": 120,
    "total_revenue": 2400000,
    "total_incentives": 120000,
    "total_salary_disbursed": 450000,
    "active_asms": 7,
    "active_bdes": 28,
    "active_telecallers": 4
  }
}
```

### 2.3 Resource Management CRUD
- **Endpoints:**
  - `GET /api/admin/:tab` (Tabs: `employees`, `teams`, `districts`, `courses`, `leads`, `wallets`, `leaves`)
  - `POST /api/admin/:tab`
  - `PUT /api/admin/:tab`
  - `DELETE /api/admin/:tab?id=<id>`
- **Token Needed:** `Admin`
- **Example Create Employee Request Body:**
```json
{
  "name": "Rahul Das",
  "email": "rahul@kide.com",
  "contact_number": "+91 98000 12345",
  "designation": "Business Development Executive",
  "team": "EKM Team",
  "district": "Ernakulam",
  "reports_to": "ASM004"
}
```

### 2.4 Admin Direct Lead Creation
- **Endpoint:** `POST /api/admin/leads/create`
- **Token Needed:** `Admin`
- **Request Body:**
```json
{
  "name": "Nandana Ramesh",
  "phone": "+91 97450 12345",
  "district": "Ernakulam",
  "course": "Full-Stack Web Development",
  "source": "Direct Admin Entry",
  "employee_id": "BDE001"
}
```
- **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Lead created successfully",
  "data": {
    "lead_id": "LD-8901",
    "name": "Nandana Ramesh",
    "status": 1
  }
}
```

### 2.5 Generate Daily Employee Tasks
- **Endpoint:** `POST /api/task-templates/generate`
- **Token Needed:** `Admin`
- **Request Body:** None `{}` (or `{"template_id": "..."}`)
- **Response `200 OK`:**
```json
{
  "success": true,
  "generatedCount": 35,
  "message": "Generated 35 tasks across active templates for active employees!"
}
```

### 2.6 Salary Request Sanction & Disbursement (Stages 3 & 4)
- **Endpoint:** `POST /api/salary/workflow`
- **Token Needed:** `Admin` / `Accounts`
- **Request Body (Sanction by Admin):**
```json
{
  "request_id": "6724c...",
  "action": "sanction",
  "notes": "Verified by Accounts"
}
```
- **Request Body (Disburse by Accounts with UTR):**
```json
{
  "request_id": "6724c...",
  "action": "disburse",
  "transaction_id": "UTR892301982301",
  "notes": "Disbursed to BDE bank account"
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Salary request disbursed successfully with UTR UTR892301982301.",
  "data": {
    "status": "Approved_Paid",
    "transaction_id": "UTR892301982301"
  }
}
```

### 2.7 Incentive Withdrawal Sanction & Disbursement (Stages 3 & 4)
- **Endpoint:** `POST /api/wallet/workflow`
- **Token Needed:** `Admin` / `Accounts`
- **Request Body:**
```json
{
  "request_id": "6724d...",
  "action": "disburse",
  "transaction_id": "UPI78129371239"
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Withdrawal request disbursed successfully."
}
```

---

## 3. Sales Manager (SM) APIs (SM Token)

### 3.1 Create Area Sales Manager (ASM) or Office Team
- **Endpoint:** `POST /api/sm/create-asm`
- **Token Needed:** `SM` (or `Admin`)
- **Allowed `team_code` values:** `TVM`, `PTM`, `KTM`, `EKM`, `PKD`, `CLT`, `KZD` (or `KZE`), and `OFFICE`.
- **Request Body (Regional ASM):**
```json
{
  "name": "Bipin Joseph",
  "email": "bipin.tvm@kide.com",
  "contact_number": "+91 90000 00001",
  "password": "password123",
  "team_code": "TVM"
}
```
- **Request Body (Office Team Lead):**
```json
{
  "name": "Geetha Menon",
  "email": "geetha.office@kide.com",
  "contact_number": "+91 90000 00008",
  "password": "password123",
  "team_code": "OFFICE"
}
```
- **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Area Sales Manager Bipin Joseph (ASM001) created successfully for TVM Team. Assigned districts: Thiruvananthapuram, Kollam",
  "data": {
    "id": "6724e...",
    "employee_id": "ASM001",
    "name": "Bipin Joseph",
    "designation": "Area Sales Manager",
    "team": "TVM Team",
    "districts": ["Thiruvananthapuram", "Kollam"],
    "reports_to": "SM001",
    "sm_name": "Sales Manager"
  }
}
```

### 3.2 List All ASMs with Daily & Monthly Lead Targets
- **Endpoint:** `GET /api/sm/asms`
- **Token Needed:** `SM` (or `Admin`)
- **Response `200 OK`:**
```json
{
  "success": true,
  "count": 8,
  "data": [
    {
      "id": "6724...",
      "employee_id": "ASM001",
      "name": "Bipin Joseph",
      "email": "bipin.tvm@kide.com",
      "contact_number": "+91 90000 00001",
      "designation": "Area Sales Manager",
      "team": "TVM Team",
      "districts": ["Thiruvananthapuram", "Kollam"],
      "zone": "South Zone",
      "reports_to": "SM001",
      "bdes_count": 4,
      "status": "active",
      "daily_target": 12,
      "daily_achieved": 5,
      "daily_pending": 7,
      "daily_completion_percentage": 42,
      "monthly_target": 45,
      "monthly_achieved": 28,
      "monthly_pending": 17,
      "monthly_completion_percentage": 62,
      "total_leads": 120,
      "completed_leads": 84,
      "pending_leads": 36,
      "completion_percentage": 70,
      "targets": {
        "daily": {
          "total_leads": 12,
          "completed_leads": 5,
          "pending_leads": 7,
          "completion_percentage": 42
        },
        "monthly": {
          "total_leads": 45,
          "completed_leads": 28,
          "pending_leads": 17,
          "completion_percentage": 62
        },
        "overall": {
          "total_leads": 120,
          "completed_leads": 84,
          "pending_leads": 36,
          "completion_percentage": 70
        }
      }
    }
  ]
}
```

### 3.3 Get Single ASM by ID
- **Endpoint:** `GET /api/sm/asms/:id` (or `GET /api/sm/asms?employee_id=ASM001`)
- **Token Needed:** `SM` (or `Admin`)
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "employee_id": "ASM001",
    "name": "Bipin Joseph",
    "team": "TVM Team",
    "bdes_count": 4,
    "daily_target": 12,
    "daily_achieved": 5,
    "monthly_target": 45,
    "monthly_achieved": 28
  }
}
```

### 3.4 Create Tele-caller under Office Team
- **Endpoint:** `POST /api/office/create-telecaller`
- **Token Needed:** `SM`, `Office Team Lead`, or `Admin`
- **Request Body:**
```json
{
  "name": "Ananya Nair",
  "email": "ananya.tc@kide.com",
  "contact_number": "+91 98471 11223",
  "password": "password123",
  "district": "Ernakulam"
}
```
- **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Tele-caller Ananya Nair (TC001) created successfully under Office Team.",
  "data": {
    "id": "6724f...",
    "employee_id": "TC001",
    "name": "Ananya Nair",
    "designation": "Tele-caller",
    "team": "Office Team",
    "district": "Ernakulam",
    "zone": "Central Zone",
    "reports_to": "ASM008",
    "supervisor_name": "Geetha Menon"
  }
}
```

### 3.5 List Office Team Tele-callers
- **Endpoint:** `GET /api/office/telecallers`
- **Token Needed:** `SM`, `Office Team Lead`, or `Admin`
- **Response `200 OK`:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "6724f...",
      "employee_id": "TC001",
      "name": "Ananya Nair",
      "email": "ananya.tc@kide.com",
      "contact_number": "+91 98471 11223",
      "designation": "Tele-caller",
      "team": "Office Team",
      "zone": "Central Zone",
      "district": "Ernakulam",
      "reports_to": "ASM008",
      "leads_assigned": 45,
      "admissions_closed": 12,
      "conversion_rate": "27%",
      "status": "active"
    }
  ]
}
```

### 3.6 Review & Forward Salary Request (Stage 2: SM to Accounts)
- **Endpoint:** `POST /api/salary/workflow`
- **Token Needed:** `SM`
- **Request Body:**
```json
{
  "request_id": "6724c...",
  "action": "forward_to_accounts",
  "notes": "Verified team monthly performance. Recommended for approval."
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Salary request forwarded to Accounts.",
  "data": {
    "status": "Pending_Accounts"
  }
}
```

### 3.7 Review & Forward Incentive Withdrawal Request (Stage 2: SM to Accounts)
- **Endpoint:** `POST /api/wallet/workflow`
- **Token Needed:** `SM`
- **Request Body:**
```json
{
  "request_id": "6724d...",
  "action": "forward_to_accounts",
  "notes": "Verified student admissions."
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Withdrawal request forwarded to Accounts."
}
```

### 3.8 List Salary Requests in Hierarchy
- **Endpoint:** `GET /api/salary/requests`
- **Token Needed:** `SM` (or `Admin` / `ASM`)
- **Query Params (Optional):** `?status=Pending_SM`
- **Response `200 OK`:**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": "6724c...",
      "employee_id": "BDE001",
      "employee": "Siddharth V",
      "amount": 15000,
      "period": "October 2026",
      "status": "Pending_SM",
      "attendance_days": 24
    }
  ]
}
```

### 3.9 List Incentive Withdrawal Requests in Hierarchy
- **Endpoint:** `GET /api/wallet/requests`
- **Token Needed:** `SM` (or `Admin` / `ASM`)
- **Query Params (Optional):** `?status=Pending_SM`
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "6724d...",
      "employee_id": "BDE001",
      "employee": "Siddharth V",
      "amount": 11000,
      "upi_id": "siddharth@okaxis",
      "status": "Pending_SM"
    }
  ]
}
```

### 3.10 SM Dashboard Feed
- **Endpoint:** `GET /api/home`
- **Token Needed:** `SM`
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "dashboard_type": "sm",
    "team_metrics": {
      "team_leads": 180,
      "team_admissions": 45,
      "team_conversion": "25%"
    },
    "team_subordinate_status": {
      "bdes": [
        {
          "name": "Bipin Joseph",
          "designation": "Area Sales Manager",
          "online_status": "ONLINE"
        }
      ]
    }
  }
}
```

---

## 4. Area Sales Manager (ASM) & Office Team Lead APIs (ASM / Office Lead Token)

### 4.1 Create Subordinate BDE or Tele-caller
- **Endpoint:** `POST /api/asm/create-bde`
- **Token Needed:** `ASM` or `Office Team Lead`
- **Request Body (Regional ASM creating BDE):**
```json
{
  "name": "Siddharth V",
  "email": "siddharth.bde@kide.com",
  "contact_number": "+91 98470 11223",
  "password": "password123",
  "district": "Ernakulam"
}
```
- **Request Body (Office Lead creating Tele-caller):**
```json
{
  "name": "Deepa K",
  "email": "deepa.tc@kide.com",
  "contact_number": "+91 98470 55667",
  "password": "password123"
}
```
- **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Business Development Executive Siddharth V (BDE001) created successfully under ASM Anoop Menon (EKM Team).",
  "data": {
    "id": "6725a...",
    "employee_id": "BDE001",
    "name": "Siddharth V",
    "designation": "Business Development Executive",
    "team": "EKM Team",
    "district": "Ernakulam",
    "reports_to": "ASM004"
  }
}
```

### 4.2 List Subordinate BDEs & Tele-callers
- **Endpoint:** `GET /api/asm/bdes`
- **Token Needed:** `ASM` or `Office Team Lead`
- **Response `200 OK`:**
```json
{
  "success": true,
  "count": 4,
  "data": [
    {
      "id": "6725a...",
      "employee_id": "BDE001",
      "name": "Siddharth V",
      "email": "siddharth.bde@kide.com",
      "contact_number": "+91 98470 11223",
      "designation": "Business Development Executive",
      "team": "EKM Team",
      "district": "Ernakulam",
      "reports_to": "ASM004",
      "leads_assigned": 32,
      "admissions_closed": 8,
      "conversion_rate": "25%",
      "status": "active"
    }
  ]
}
```

### 4.3 Get Single Subordinate by ID
- **Endpoint:** `GET /api/asm/bdes/:id`
- **Token Needed:** `ASM` (or `SM` / `Admin`)
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "employee_id": "BDE001",
    "name": "Siddharth V",
    "team": "EKM Team",
    "leads_assigned": 32,
    "admissions_closed": 8
  }
}
```

### 4.4 Review & Forward BDE Salary Request (Stage 1: ASM to SM)
- **Endpoint:** `POST /api/salary/workflow`
- **Token Needed:** `ASM`
- **Request Body:**
```json
{
  "request_id": "6724c...",
  "action": "forward_to_sm",
  "notes": "Verified attendance and monthly field activity."
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Salary request forwarded to Sales Manager.",
  "data": {
    "status": "Pending_SM"
  }
}
```

### 4.5 Review & Forward BDE Withdrawal Request (Stage 1: ASM to SM)
- **Endpoint:** `POST /api/wallet/workflow`
- **Token Needed:** `ASM`
- **Request Body:**
```json
{
  "request_id": "6724d...",
  "action": "forward_to_sm",
  "notes": "Verified closed admission."
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Withdrawal request forwarded to Sales Manager."
}
```

### 4.6 ASM Home Dashboard Feed
- **Endpoint:** `GET /api/home`
- **Token Needed:** `ASM`
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "dashboard_type": "asm",
    "team_name": "EKM Team",
    "team_metrics": {
      "team_leads": 45,
      "team_admissions": 12,
      "team_conversion": "27%"
    },
    "territory_report": [
      { "district_name": "Ernakulam", "target": 100, "achieved": 12 }
    ]
  }
}
```

---

## 5. Business Development Executive (BDE) & Tele-caller APIs (BDE / Tele-caller Token)

### 5.1 Create Lead
- **Endpoint:** `POST /api/leads/create`
- **Token Needed:** `BDE` or `Tele-caller`
- **Request Body:**
```json
{
  "name": "Arjun Menon",
  "phone": "+91 98460 12345",
  "whats_number": "+91 98460 12345",
  "email": "arjun.m@gmail.com",
  "district": "Ernakulam",
  "place": "Aluva",
  "college_name": "UC College Aluva",
  "qualification": "B.Tech Computer Science",
  "current_year": "Passout",
  "interested_course": "Flutter & Mobile App Development",
  "source": "Campus Drive / College Seminar",
  "student_interest": "Hot",
  "notes": "Wants weekend batch with placement assistance"
}
```
- **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Lead Arjun Menon (LD-4091) created successfully",
  "data": {
    "id": 1092,
    "lead_id": "LD-4091",
    "student_id": "STU-001",
    "name": "Arjun Menon",
    "phone": "+91 98460 12345",
    "course": "Flutter & Mobile App Development",
    "district": "Ernakulam",
    "status": 1,
    "admission_status": "New",
    "employee": "Siddharth V",
    "employee_id": "BDE001",
    "team": "EKM Team"
  }
}
```

### 5.2 List Assigned Leads
- **Endpoint:** `GET /api/leads`
- **Token Needed:** `BDE` (or Manager/Admin)
- **Query Params (Optional):** `?status=1`, `?search=Arjun`, `?page=1&per_page=20`
- **Response `200 OK`:**
```json
{
  "success": true,
  "count": 15,
  "data": [
    {
      "id": 1092,
      "lead_id": "LD-4091",
      "student_id": "STU-001",
      "name": "Arjun Menon",
      "phone": "+91 98460 12345",
      "course": "Flutter & Mobile App Development",
      "district": "Ernakulam",
      "status": 1,
      "admission_status": "New"
    }
  ]
}
```

### 5.3 Get Single Lead Details
- **Endpoint:** `GET /api/leads/:id`
- **Token Needed:** `BDE` (or Manager/Admin)
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "lead_id": "LD-4091",
    "student_id": "STU-001",
    "name": "Arjun Menon",
    "phone": "+91 98460 12345",
    "college_name": "UC College Aluva",
    "followups": []
  }
}
```

### 5.4 Record Follow-Up Call
- **Endpoint:** `POST /api/leads/:id/follow-up` (or `/followup`)
- **Token Needed:** `BDE` or `Tele-caller`
- **Request Body:**
```json
{
  "student_id": "STU-001",
  "admission_status": "Follow-up",
  "student_interest": "Hot",
  "next_followup_date": "2026-11-05 10:30 AM",
  "remarks": "Parent requested syllabus breakdown via WhatsApp."
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Follow-up recorded successfully",
  "data": {
    "lead_id": "LD-4091",
    "status": 2,
    "admission_status": "Follow-up",
    "next_followup_date": "2026-11-05 10:30 AM"
  }
}
```

### 5.5 Close Lead (Admission Confirmation) — Strict Student ID Check
- **Endpoint:** `POST /api/leads/:id/close`
- **Token Needed:** `BDE`, `Tele-caller`, or Manager
- **Request Body:**
```json
{
  "student_id": "STU-001",
  "course": "Flutter & Mobile App Development",
  "payment": 20000,
  "payment_verification": "Verified",
  "remarks": "Admission confirmed; full fee paid via UPI."
}
```
*(Validation Rule: Provided `student_id` MUST match the lead's registered `student_id`).*
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Lead Arjun Menon successfully closed as Admission (STU-001). ₹1,000 incentive credited to Siddharth V.",
  "data": {
    "lead_id": "LD-4091",
    "student_id": "STU-001",
    "name": "Arjun Menon",
    "status": 4,
    "admission_status": "Admitted",
    "incentive_earned": 1000,
    "bde": "Siddharth V",
    "team": "EKM Team"
  }
}
```

### 5.6 Get Next Sequential Student ID
- **Endpoint:** `GET /api/leads/next-student-id`
- **Token Needed:** `BDE`, `Tele-caller`, or Manager
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "student_id": "STU-002",
    "number": 2
  }
}
```

### 5.7 Bulk Upload Leads (CSV)
- **Endpoint:** `POST /api/leads/import`
- **Token Needed:** `BDE` or Manager
- **Request Body (Multipart/form-data or JSON array):**
```json
{
  "leads": [
    {
      "name": "Fahad Fazil",
      "phone": "+91 98470 99881",
      "district": "Ernakulam",
      "course": "Data Science & Machine Learning",
      "college_name": "Rajagiri College"
    }
  ]
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "importedCount": 1,
  "message": "Successfully imported 1 lead."
}
```

### 5.8 Submit Monthly Salary Request (Min ₹15,000)
- **Endpoint:** `POST /api/salary/request`
- **Token Needed:** `BDE`
- **Request Body:**
```json
{
  "amount": 15000,
  "period": "October 2026",
  "notes": "Completed 24 field duty days."
}
```
- **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Monthly salary request for ₹15,000 submitted successfully for October 2026. Forwarded to ASM for verification.",
  "data": {
    "request_id": "6724c...",
    "employee_id": "BDE001",
    "amount": 15000,
    "period": "October 2026",
    "status": "Pending_ASM",
    "attendance_days": 24
  }
}
```

### 5.9 Request Incentive Payout Withdrawal (Max ₹15,000)
- **Endpoint:** `POST /api/wallet/withdraw`
- **Token Needed:** `BDE`
- **Request Body:**
```json
{
  "amount": 11000,
  "upi_id": "siddharth@okaxis",
  "account_number": "1234567890",
  "ifsc_code": "UTIB0000123",
  "notes": "Payout for confirmed admissions."
}
```
- **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Withdrawal request for ₹11,000 submitted successfully.",
  "data": {
    "request_id": "6724d...",
    "amount": 11000,
    "status": "Pending_ASM"
  }
}
```

### 5.10 Check Wallet Balance & Lifetime Earnings
- **Endpoint:** `GET /api/wallet/balance`
- **Token Needed:** `BDE`
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "balance": 22000,
    "total_earned": 33000,
    "total_paid": 11000,
    "currency": "INR"
  }
}
```

### 5.11 BDE Home Dashboard Feed
- **Endpoint:** `GET /api/home`
- **Token Needed:** `BDE`
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "dashboard_type": "bde",
    "attendance": {
      "check_in_time": "09:15 AM",
      "check_out_time": "--:--",
      "shift_status": "ONLINE",
      "is_checked_in": true
    },
    "eod_sync": {
      "tasks_completed": 8,
      "total_tasks": 15,
      "completion_percentage": 53
    },
    "operational_overview": {
      "assigned_leads": 32,
      "follow_up_leads": 14,
      "closed_leads": 8,
      "incentives_earned": 8000
    }
  }
}
```

---

## 6. Shared Employee APIs (Any Employee Token)

### 6.1 Get Current User Profile & Role
- **Endpoint:** `GET /api/auth/me`
- **Token Needed:** Any valid `Employee` or `Admin` token
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": "6725a...",
    "employee_id": "BDE001",
    "name": "Siddharth V",
    "email": "siddharth.bde@kide.com",
    "designation": "Business Development Executive",
    "role": "BDE",
    "team": "EKM Team",
    "zone": "Central Zone",
    "district": "Ernakulam",
    "reports_to": "ASM004"
  }
}
```

### 6.2 Refresh JWT Token
- **Endpoint:** `POST /api/auth/refresh-token`
- **Token Needed:** Any valid token
- **Request Body:** None `{}`
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsIn..."
  }
}
```

### 6.3 Detailed Employee Profile
- **Endpoint:** `GET /api/profile`
- **Token Needed:** Any active employee
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "employee_id": "BDE001",
    "name": "Siddharth V",
    "email": "siddharth.bde@kide.com",
    "contact_number": "+91 98470 11223",
    "designation": "Business Development Executive",
    "team": "EKM Team",
    "district": "Ernakulam",
    "zone": "Central Zone",
    "reports_to": "ASM004"
  }
}
```

### 6.4 Change Password
- **Endpoint:** `POST /api/employee/change-password`
- **Token Needed:** Any active employee
- **Request Body:**
```json
{
  "current_password": "password123",
  "new_password": "NewSecretPassword@2026"
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Password changed successfully."
}
```

### 6.5 Daily Check-In
- **Endpoint:** `POST /api/attendance/check-in`
- **Token Needed:** Any active employee
- **Request Body:**
```json
{
  "latitude": 10.0159,
  "longitude": 76.3419,
  "remarks": "Reached campus on time"
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Checked in successfully at 09:15 AM",
  "data": {
    "date": "2026-11-02",
    "check_in": "09:15 AM",
    "is_checked_in": true
  }
}
```

### 6.6 Daily Check-Out
- **Endpoint:** `POST /api/attendance/check-out`
- **Token Needed:** Any active employee
- **Request Body:**
```json
{
  "latitude": 10.0159,
  "longitude": 76.3419,
  "remarks": "Completed day visits"
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Checked out successfully at 06:00 PM",
  "data": {
    "date": "2026-11-02",
    "check_out": "06:00 PM",
    "shift_status": "COMPLETED"
  }
}
```

### 6.7 Today's Attendance Status
- **Endpoint:** `GET /api/attendance/status`
- **Token Needed:** Any active employee
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "date": "2026-11-02",
    "check_in": "09:15 AM",
    "check_out": "--:--",
    "is_checked_in": true,
    "shift_status": "ONLINE"
  }
}
```

### 6.8 Attendance History Logs
- **Endpoint:** `GET /api/attendance/history`
- **Token Needed:** Any active employee
- **Query Params (Optional):** `?month=11&year=2026`
- **Response `200 OK`:**
```json
{
  "success": true,
  "count": 22,
  "data": [
    {
      "date": "2026-11-01",
      "check_in": "09:00 AM",
      "check_out": "06:15 PM",
      "status": "Present"
    }
  ]
}
```

### 6.9 List Assigned Tasks
- **Endpoint:** `GET /api/tasks`
- **Token Needed:** Any active employee
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "total": 5,
    "completed": 3,
    "pending": 2,
    "tasks": [
      {
        "id": "6724a...",
        "title": "Visit UC College Aluva",
        "priority": "high",
        "status": "completed"
      }
    ]
  }
}
```

### 6.10 List Performance Tasks
- **Endpoint:** `GET /api/employee-tasks`
- **Token Needed:** Any active employee
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "task_template": "Daily Lead Generation",
      "period_start": "Nov 2, 2026",
      "total_target": 15,
      "achieved": 8,
      "is_completed": false
    }
  ]
}
```

### 6.11 List Colleges & Partner Institutes
- **Endpoint:** `GET /api/institutes`
- **Token Needed:** Any active employee
- **Query Params (Optional):** `?district=Ernakulam`
- **Response `200 OK`:**
```json
{
  "success": true,
  "count": 12,
  "data": [
    {
      "id": "6724b...",
      "name": "Rajagiri College of Social Sciences",
      "district": "Ernakulam",
      "contact_person": "Dr. Joseph",
      "contact_number": "+91 94470 12345"
    }
  ]
}
```

### 6.12 Record Field College Visit
- **Endpoint:** `POST /api/institutes/create` (or `POST /api/institutes`)
- **Token Needed:** Any active employee
- **Request Body:**
```json
{
  "name": "St. Albert's College",
  "district": "Ernakulam",
  "contact_person": "Prof. Thomas",
  "contact_number": "+91 94471 99887",
  "notes": "Met placement coordinator for upcoming Flutter seminar."
}
```
- **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Institute recorded successfully",
  "data": {
    "id": "6724c...",
    "name": "St. Albert's College",
    "district": "Ernakulam"
  }
}
```

### 6.13 Apply for Leave
- **Endpoint:** `POST /api/leaves/apply`
- **Token Needed:** Any active employee
- **Request Body:**
```json
{
  "leave_type": "Casual Leave",
  "start_date": "2026-11-10",
  "end_date": "2026-11-11",
  "reason": "Personal work"
}
```
- **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Leave application submitted successfully.",
  "data": {
    "leave_type": "Casual Leave",
    "start_date": "2026-11-10",
    "end_date": "2026-11-11",
    "status": "Pending"
  }
}
```

### 6.14 List Leave History
- **Endpoint:** `GET /api/leaves`
- **Token Needed:** Any active employee
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "leave_type": "Casual Leave",
      "start_date": "2026-11-10",
      "end_date": "2026-11-11",
      "status": "Pending"
    }
  ]
}
```

### 6.15 List Earned Admission Incentives Ledger
- **Endpoint:** `GET /api/incentives`
- **Token Needed:** Any active employee
- **Response `200 OK`:**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "lead_id": "LD-4091",
      "student_id": "STU-001",
      "student_name": "Arjun Menon",
      "course": "Flutter & Mobile App Development",
      "amount": 1000,
      "status": "Earned",
      "admission_date": "2026-11-02T10:30:00.000Z"
    }
  ]
}
```
