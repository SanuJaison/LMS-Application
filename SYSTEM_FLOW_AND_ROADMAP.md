# KIDE Sales & Lead Management Platform
## End-to-End System Flow, Current State & Remaining Work

---

## 1. Executive Summary & Architecture Overview

The **Kerala Institute of Digital Education (KIDE)** sales and lead management ecosystem consists of two primary interfaces sharing a single backend and unified MongoDB database:

```
                            ┌──────────────────────────────────────────────┐
                            │               MongoDB Atlas                  │
                            │ (Employees, Leads, Teams, Wallets, Salaries) │
                            └──────────────────────┬───────────────────────┘
                                                   │
                                                   │ Mongoose ODM
                                                   ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             Next.js Full-Stack Backend & Admin Portal                            │
│                                 (TypeScript / Next.js App Router)                                │
│                                                                                                  │
│   [Admin Web Portal]                                      [REST APIs for Flutter Mobile App]     │
│   • Dashboard & Analytics                                 • Auth & Profile (/api/login, /me)     │
│   • Team & Employee Hierarchy                             • Attendance & Leaves (/api/attendance)│
│   • Lead & Course Management                              • Leads CRUD, Followup, Close          │
│   • Accounts & P&L Module                                 • Wallet & Incentive Workflow          │
│   • Salary & Incentive Approvals                          • Salary Request Workflow              │
│   • Bulk CSV Lead Import                                  • SM/ASM Creation Hierarchy Endpoints  │
└───────────────────────────────────────▲──────────────────────────────────▲───────────────────────┘
                                        │                                  │
                                        │ Browser (HTTP)                   │ Mobile App (REST / JSON)
                                        │                                  │
                                 [Admin / Accounts]               [BDE / ASM / SM / Office]
                                  Web Management UI                  Flutter Mobile App
```

---

## 2. Organization Structure & Business Rules

### 2.1 The Hierarchy Chain
$$\text{Admin} \longrightarrow \text{Sales Manager (SM, strictly 1)} \longrightarrow \text{Area Sales Managers (ASM, strictly 7)} \longrightarrow \text{Business Development Executives (BDE, unlimited)}$$

*An additional **Office Team / Tele-callers** team operates directly under the Sales Manager.*

### 2.2 The 7 Fixed Regional ASM Teams & District Allocation
Each ASM is allocated exactly **one team** comprising **two fixed districts**. Once allocated, neither the team nor its districts can be reallocated to another ASM.

| # | Team Code | Team Name | Assigned Districts |
|---|---|---|---|
| 1 | **TVM** | TVM Team | Thiruvananthapuram, Kollam |
| 2 | **PTM** | PTM Team | Pathanamthitta, Alappuzha |
| 3 | **KTM** | KTM Team | Kottayam, Idukki |
| 4 | **EKM** | EKM Team | Ernakulam, Thrissur |
| 5 | **PKD** | PKD Team | Palakkad, Malappuram |
| 6 | **CLT** | CLT Team | Kozhikode, Wayanad |
| 7 | **KZE** | KZE Team | Kannur, Kasaragod |
| 8 | **OFFICE**| Office Team | Statewide / Head Office (Under SM) |

### 2.3 Creation Workflow
1. **Admin** creates the single **Sales Manager (SM)**.
2. **Sales Manager (SM)** creates the 7 **Area Sales Managers (ASM)** and selects one of the 7 teams (or Office Team). The backend automatically binds the team and its 2 districts to that ASM.
3. **Area Sales Manager (ASM)** creates their **Business Development Executives (BDEs)**. The BDE automatically inherits their ASM's team and operates within the team's districts.
4. **Admin** retains top-level visibility across all SM, ASM, and BDE employees.

### 2.4 Lead & Financial Workflows
1. **Lead Creation**: BDE creates lead with student contact, district, place, college, year, and course (Flutter, Full Stack, Cyber Security, Digital Marketing, Data Science Pro).
   - Generates unique `lead_id` (`KIDE-LEAD-XXXXX`).
   - Generates sequential `student_id` (`STU-001`, `STU-002`, ...).
2. **Follow-ups**: BDE logs follow-ups with student interest (Hot, Warm, Cold), next follow-up date, and remarks.
3. **Closing Admission**:
   - To close a lead, the BDE must provide the **matching `student_id`**. If the ID does not match, closing is rejected.
   - Upon successful close, **₹1,000 incentive** is automatically awarded to the BDE's wallet and recorded in the `Incentive` ledger.
4. **Incentive Withdrawal**:
   - BDE can request withdrawal up to **₹5,000 max** from available balance.
   - Approval chain: **BDE $\rightarrow$ ASM $\rightarrow$ SM $\rightarrow$ Accounts (Disbursement with UTR)**.
5. **Salary Request**:
   - BDE can request a minimum base salary of **₹5,000**.
   - Approval chain: **BDE $\rightarrow$ ASM $\rightarrow$ SM $\rightarrow$ Accounts (Disbursement with UTR)**.

---

## 3. Current System State (What is Done Now)

### 3.1 Database Clean State
- **Employees**: All previous dummy SM, ASM, BDE records have been removed.
- **Teams**: All previous dummy teams have been cleared.
- **Transactions**: All previous salary requests, wallet withdrawal requests, and incentives have been cleared.
- **Preserved System Data**:
  - Super Admin user (`admin@kide.com` / `password123`).
  - 14 Official Kerala Districts.
  - 3 Kerala Zones (North, Central, South).
  - 5 Standard KIDE Courses.

### 3.2 Backend Models & Logic Implemented
- `src/models/lead.ts`: Extended with `student_id`, `lead_id`, `whats_number`, `place`, `college_name`, `current_year`, `interested_areas`, `payment_verification`, `admission_date`.
- `src/models/salaryRequest.ts`: Strict ₹5,000 minimum check, 4-stage approval workflow (`Pending_ASM` $\rightarrow$ `Pending_SM` $\rightarrow$ `Pending_Accounts` $\rightarrow$ `Approved_Paid`).
- `src/models/incentive.ts`: Tracks every ₹1,000 incentive linked to `lead_id`, `student_id`, and `bde_id`.
- `src/models/wallet.ts`: Tracks balance, total earned, total withdrawn, and withdrawal request approvals (up to ₹5,000).
- `src/models/team.ts`: Enforces 8 unique teams (7 regional + 1 office) and 2-district constraints.
- `src/lib/jwt.ts`: Standardized token signing and verification for Flutter and Web.
- `src/lib/adminAuth.ts` & `src/lib/activityLog.ts`: Audit logging and admin role security.

### 3.3 Complete REST API Suite (26 Endpoints Built & Ready)
All endpoints reside under the `/api` prefix:

| Group | Method | Endpoint | Purpose |
|---|---|---|---|
| **Authentication** | `POST` | `/api/login` | Email/Employee ID + Password login for Mobile & Web |
| | `POST` | `/api/logout` | Token invalidation & sign out |
| | `GET` | `/api/profile` | Current user profile details & balance |
| | `GET` | `/api/auth/me` | Current session user & leave stats |
| | `POST` | `/api/set-password` | First-time password setting |
| **Home & Metrics** | `GET` | `/api/home` | Unified `HomeDashboardModel` with metrics, targets, team subordinate overview |
| **Attendance** | `GET` | `/api/attendance/status` | Today's check-in / check-out status |
| | `POST` | `/api/attendance/check-in` | Geolocation-tagged check-in |
| | `POST` | `/api/attendance/check-out` | Geolocation-tagged check-out & hours calculation |
| | `GET` | `/api/attendance/history` | Monthly attendance logs |
| **Leaves** | `GET` | `/api/leaves` | Employee leave balances & history |
| | `POST` | `/api/leaves/apply` | Submit leave application |
| **Leads** | `GET` | `/api/leads` | Scoped list of leads with pagination & search |
| | `POST` | `/api/leads` | Create lead (generates `lead_id` and sequential `student_id`) |
| | `POST` | `/api/leads/:id/followup` | Record student interest, remarks, next date |
| | `POST` | `/api/leads/:id/close` | **Validates matching `student_id`**, closes admission, awards ₹1,000 incentive |
| | `POST` | `/api/leads/import` | CSV multi-part lead bulk import |
| **Finances & Wallet** | `GET` | `/api/wallet/balance` | Balance, earned, paid, and history |
| | `POST` | `/api/wallet/withdraw` | Request incentive withdrawal (max ₹5,000) |
| | `POST` | `/api/wallet/workflow` | ASM / SM / Accounts approval transition |
| | `POST` | `/api/salary/request` | Submit salary request (min ₹5,000) |
| | `GET` | `/api/salary/requests` | List salary requests scoped to role |
| | `POST` | `/api/salary/workflow` | ASM / SM / Accounts approval & UTR disbursement |
| | `GET` | `/api/incentives` | List closed admission incentive ledger |
| **Hierarchy** | `POST` | `/api/sm/create-asm` | SM creates ASM & locks 1 of 7 teams / 2 districts |
| | `GET` | `/api/sm/asms` | List ASMs and available unallocated teams |
| | `POST` | `/api/asm/create-bde` | ASM creates BDE under their team |
| | `GET` | `/api/asm/bdes` | List BDEs under ASM |
| **Lookups** | `GET` | `/api/courses` | 5 active KIDE courses |
| | `GET` | `/api/districts` | 14 Kerala districts |
| | `GET` | `/api/hierarchy/filters`| Combined teams, districts, zones dropdown list |
| | `GET` | `/api/sources` | Lead sources (College Visit, Seminar, etc.) |

### 3.4 Admin Web Portal Additions
- **Accounts & P&L Dashboard (`AccountsView.tsx`)**:
  - Live financial cards: Total Admissions, Total Income, Total Incentives (₹1k/admission), Total Salaries Disbursed, Total Expenses, Net Profit.
  - Interactive **Salary Requests Tab**: Sanction (ASM/SM) or Approve & Disburse with UTR (Accounts).
  - Interactive **Incentive Withdrawals Tab**: Sanction (ASM/SM) or Disburse (Accounts).
  - Closed Admissions Table with student IDs, payment status, and verification badges.
- **Hierarchy Role Pills in Employees (`EmployeesView.tsx`)**:
  - Filter by `All`, `SM`, `ASM`, `BDE`, `Office Team`.
  - Regional 7-Team Reference Matrix displaying district pairs.

---

## 4. App Side (Flutter) — What is Left to Do

The Flutter mobile codebase (`keralainstitutesalesapp`) has its data models and basic screens in place, but needs the following items connected to match the new backend APIs:

| Item # | Flutter Component | Action Required |
|---|---|---|
| **APP-1** | `lib/core/constants/api_endpoints.dart` | Set `baseUrl` to your backend URL (e.g. `http://<your-ip>:3000/api` for local emulator or production domain). |
| **APP-2** | `lib/features/leads/presentation/widgets/close_lead_sheet.dart` | Ensure the dialog has an input field for `student_id`. Submit `{ "student_id": controller.text }` in the POST request to `/leads/{id}/close`. Display error message if backend returns 400 (Student ID mismatch). |
| **APP-3** | `lib/features/leads/presentation/pages/create_lead_page.dart` | Include the new fields: `whats_number`, `place`, `college_name`, `current_year` (First Year, Second Year, Working, Not Working, Passout), and `interested_areas`. |
| **APP-4** | `lib/features/leads/presentation/pages/admissions_page.dart` | Add a "My Admissions" screen for BDE that calls `/leads?admission_status=Admitted` and renders Student ID, Lead ID, Course, Admission Date, Payment Status, and Incentive status. |
| **APP-5** | `lib/features/wallet/presentation/pages/salary_request_page.dart` | Create or connect the Salary Request UI to POST `/salary/request` with `amount` (minimum ₹5,000) and `period` (e.g. `"October 2026"`). |
| **APP-6** | `lib/features/team/presentation/pages/sm_create_asm_page.dart` *(For SM Login)* | When an SM logs into the app, provide a screen to create an ASM by selecting from the available teams in `GET /sm/asms` and posting to `/sm/create-asm`. |
| **APP-7** | `lib/features/team/presentation/pages/asm_create_bde_page.dart` *(For ASM Login)* | When an ASM logs into the app, provide a screen to create a BDE posting to `/asm/create-bde`. |
| **APP-8** | `lib/features/wallet/presentation/pages/wallet_page.dart` | Verify that the withdrawal sheet enforces the ₹5,000 max limit and displays the 3-step approval timeline (`Pending_ASM` $\rightarrow$ `Pending_SM` $\rightarrow$ `Pending_Accounts` $\rightarrow$ `Approved_Paid`). |

---

## 5. Admin Side (Web) — What is Left to Do / Operational Testing

All necessary backend APIs and core UI views are written. Here are the immediate operational steps on the Admin side:

| Step # | Action | How to Perform |
|---|---|---|
| **ADM-1** | **Create the Fresh Sales Manager (SM)** | 1. Log in to the Admin Portal (`admin@kide.com` / `password123`).<br>2. Navigate to **Employees** $\rightarrow$ Click **+ Add Employee**.<br>3. Fill Name, Email, Phone, and set **Designation / Role** to `Sales Manager`.<br>4. Submit. There is now strictly 1 SM in the system. |
| **ADM-2** | **Create the 7 ASMs & Teams via SM** | 1. Using the SM account (or API `/api/sm/create-asm`), create each of the 7 ASMs, choosing from `TVM`, `PTM`, `KTM`, `EKM`, `PKD`, `CLT`, `KZE`.<br>2. Verify in **Employees** list that each ASM has their assigned team and 2 districts. |
| **ADM-3** | **Create BDEs via ASM** | Using an ASM account (or API `/api/asm/create-bde`), create BDEs under the ASM's team. Verify BDE appears in both ASM view and Admin Employees view. |
| **ADM-4** | **Test Lead Lifecycle & Incentive** | 1. Create a lead under a BDE.<br>2. Note the generated `student_id` (e.g., `STU-001`).<br>3. Perform followup.<br>4. Close lead with matching `STU-001`.<br>5. Check **Accounts & P&L** view $\rightarrow$ Incentive card increases by ₹1,000, Net Profit recalculates. |
| **ADM-5** | **Test Financial Approvals in Accounts View** | 1. Submit a salary request (₹5,000) or wallet withdrawal.<br>2. Open **Accounts & P&L** $\rightarrow$ Click **Sanction** $\rightarrow$ enter UTR reference number $\rightarrow$ Mark as Paid. |

---

## 6. Testing Credentials & Quick Reference

- **Admin Portal URL**: `http://localhost:3000` (or `http://localhost:3000/login`)
- **Admin Credentials**:
  - Email: `admin@kide.com`
  - Password: `password123`
- **API Base URL**: `http://localhost:3000/api`
- **Headers Required for Authenticated APIs**:
  - `Authorization: Bearer <jwt_token_received_from_login>`
  - `Content-Type: application/json`
