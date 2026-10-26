# KIDE LMS — Mobile App API (Lead Flow)

Base URL: `https://lms-application-pi.vercel.app/api`

All authenticated calls need this header:

```
Authorization: Bearer <token>
Content-Type: application/json
```

The token is the `data.token` returned by `POST /api/login`.

---

## 1. Login (employee)

`POST /login`

Body:

```json
{
  "employee_id": "BDE005",
  "password": "your-password"
}
```

Response `200`:

```json
{
  "success": true,
  "message": "Logged in successfully",
  "token": "eyJhbGciOi...",
  "user": {
    "id": "6adc54c56b2496306524a6c4",
    "name": "test",
    "email": "test@gmail.com",
    "employee_id": "BDE005",
    "designation": "Business Development Executive",
    "team": "Sales",
    "zone": "Central",
    "district": "Ernakulam",
    "role": "employee",
    "status": "Active"
  },
  "data": {
    "token": "eyJhbGciOi...",
    "user": {
      "id": 178654321,
      "name": "test",
      "email": "test@gmail.com",
      "email_verified_at": null,
      "created_at": "2026-09-01T10:00:00.000000Z",
      "updated_at": "2026-10-20T08:30:00.000000Z",
      "designation_name": "Business Development Executive",
      "designation_id": 12,
      "roles": [],
      "permissions": []
    },
    "require_password_change": false
  }
}
```

> Use `data.token` as the bearer token and `data.require_password_change` to
> decide whether to show the change-password screen. `data.user` follows the
> Laravel user shape and does **not** contain `employee_id` — the app already
> knows the ID the employee typed at login. The top-level `user` object is kept
> for the admin web UI and does include `employee_id`.

Errors: `401` invalid employee ID or password, `403` inactive account.

---

## 2. Create a lead (app side)

`POST /leads/create`

The app **does not send** `employee` or `employee_id`. The lead is automatically
assigned to the logged-in employee (both name and employee ID are filled in from
the token), so it shows up in their own list and in the admin panel.

### Required fields

| Field   | Type   | Notes                                   |
| ------- | ------ | --------------------------------------- |
| `name`  | string | Student name.                           |
| `phone` | string | Contact number (`contact_number` also accepted). |

### Optional fields

| Field              | Type           | Notes                                              |
| ------------------ | -------------- | -------------------------------------------------- |
| `whatsapp_number`  | string         | Defaults to `phone`.                               |
| `email`            | string         |                                                    |
| `address`          | string         |                                                    |
| `place`            | string         |                                                    |
| `district`         | string         | Defaults to `Ernakulam`.                           |
| `age`              | number         |                                                    |
| `qualification`    | string         |                                                    |
| `college_name`     | string         | College / institute name.                          |
| `current_year`     | string         | e.g. `"Final Year"`.                               |
| `interested_topic` | string         |                                                    |
| `interested_course`| string         | `course` also accepted.                            |
| `lead_source`      | string         | `source` also accepted. Defaults to `Campus Drive / College Seminar`. |
| `admission_status` | string         | `status` also accepted. Defaults to `New`.         |
| `notes`            | string         | `remarks` also accepted.                           |

### Minimal body

```json
{
  "name": "Rahul Krishna",
  "phone": "9847123456"
}
```

### Full body

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
  "notes": "Interested in weekend batch"
}
```

### Success response `201`

`data` is already in the `LeadModel` shape — it can be inserted into the list
directly. `id` is the numeric ID to use for close / follow-up.

```json
{
  "success": true,
  "message": "Lead Rahul Krishna (LD-4821) created successfully",
  "endpoint": "/leads/create",
  "authorized_by": "employee",
  "data": {
    "id": 436888973,
    "name": "Rahul Krishna",
    "phone": "9847123456",
    "email": "rahul@gmail.com",
    "address": "MG Road",
    "place": "Edappally, Kochi",
    "whatsapp_number": "9847123456",
    "age": 22,
    "qualification": "B.Tech Computer Science",
    "college_name": "Model Engineering College",
    "current_year": "Final Year",
    "interested_topic": "MERN Stack & Next.js",
    "interested_course": "Full-Stack Web Development",
    "lead_source": "Campus Drive / College Seminar",
    "employee": "test",
    "employee_id": "BDE005",
    "district_id": 12,
    "course_id": 3,
    "source": 3,
    "status": 1,
    "notes": "Interested in weekend batch",
    "created_at": "2026-10-26T09:15:42.000000Z",
    "updated_at": "2026-10-26T09:15:42.000000Z",
    "district": { "id": 12, "name": "Ernakulam" },
    "course": { "id": 3, "name": "Full-Stack Web Development" },
    "followups": []
  }
}
```

### Errors

| Status | Message                                                              |
| ------ | -------------------------------------------------------------------- |
| `400`  | `Validation failed: Student Name (name) is required.`                |
| `400`  | `Validation failed: Contact Number (contact_number or phone) is required.` |
| `400`  | `Invalid JSON request body. Please provide lead data.`                |
| `500`  | `Failed to create lead`                                               |

> Field guide for testing: `GET /leads/create` returns the same schema,
> a sample payload and the latest leads.

---

## 3. List leads

`GET /leads`

Returns only the leads assigned to the logged-in employee (by name or employee ID).

Query params (all optional):

| Param      | Example   | Notes                                                          |
| ---------- | --------- | -------------------------------------------------------------- |
| `search`   | `Rahul`   | Name, lead ID, phone, district, place, college, course.        |
| `status`   | `1`       | 1 New, 2 Follow Up, 3 Presentation, 4 Admitted, 5 Closed.      |
| `district` | `Ernakulam` |                                                              |
| `course`   | `MERN`    |                                                                |
| `id`       | `436888973` | Numeric app ID; returns a single lead.                       |
| `lead_id`  | `LD-4821` | Human-readable lead ID; returns a single lead.                 |

> There is no pagination — the endpoint returns every matching lead.

Response `200`:

```json
{
  "success": true,
  "count": 1,
  "data": [ { "...": "same lead object as above" } ]
}
```

> Always send the employee token. Without a valid employee token the endpoint
> returns the admin shape (every lead in the database), so the app must never
> call it unauthenticated.

---

## 4. Add a follow-up

`POST /leads/{id}/followup`  ← use this path (no hyphen)

`POST /leads/{id}/follow-up` also works; both do exactly the same thing.

`{id}` = numeric `id` from the lead object (Mongo `_id` and `lead_id` also work).

### Body

| Field                  | Type   | Values / notes                                                        |
| ---------------------- | ------ | --------------------------------------------------------------------- |
| `lead_source`          | string | `College Visit`, `Seminar`, `Referral`, `Social Media`, `Cold Call`, `Website`, `Walk-in`, `Google Ads`, `Other` |
| `student_interest`     | string | `Cold`, `Warm`, `Hot`                                                 |
| `next_followup_date`   | string | `YYYY-MM-DD`                                                          |
| `remarks` / `notes`    | string | Free text. Either key works.                                          |
| `admission_status`     | string | `New Lead`, `Follow Uped`, `Payment Pending`, `Admission`, `Not Interested` |
| `payment_verification` | string | `Pending`, `Verified` (the typo `verifed` is accepted too)            |
| `student_id`           | string | e.g. `STU-1001`. Required when `admission_status` is `Admission`. Once a lead has a Student ID it can never change — sending a different value returns `400`. |
| `course`               | string | Course the student is joining.                                        |
| `followup_date`        | string | `YYYY-MM-DD`; defaults to today.                                      |
| `proof_url`            | string | Optional screenshot / recording link.                                 |

All fields are optional, but the app should send the first eight.

```json
{
  "lead_source": "College Visit",
  "student_interest": "Warm",
  "next_followup_date": "2026-10-30",
  "remarks": "Visited the college, interested in the MERN batch",
  "admission_status": "Follow Uped",
  "payment_verification": "Pending",
  "student_id": "STU-1001",
  "course": "Full-Stack Web Development"
}
```

Response `200`:

```json
{
  "success": true,
  "message": "Follow-up recorded successfully",
  "data": {
    "id": 436888973,
    "status": 2,
    "admission_status": "Follow Uped",
    "student_interest": "Warm",
    "next_followup_date": "2026-10-30",
    "lead_source": "College Visit",
    "source": 3,
    "payment_verification": "Pending",
    "student_id": "STU-1001",
    "interested_course": "Full-Stack Web Development",
    "followups": [
      {
        "id": 771203,
        "lead_id": 436888973,
        "employee_id": 331,
        "followup_date": "2026-10-27",
        "type": "Follow Uped",
        "notes": "Visited the college, interested in the MERN batch",
        "student_interest": "Warm",
        "lead_source": "College Visit",
        "next_followup_date": "2026-10-30",
        "payment_verification": "Pending",
        "student_id": "STU-1001",
        "course": "Full-Stack Web Development"
      }
    ]
  }
}
```

Errors: `400` Student ID mismatch (a different ID than the one already on the lead),
`400` `student_id is required when admission_status is "Admission"`,
`401` unauthenticated, `404` lead not found.

---

## 5. Close a lead (admission confirmed)

`POST /leads/{id}/close`

`{id}` = numeric `id` from the lead object.

### Body

| Field                  | Type             | Values / notes                                              |
| ---------------------- | ---------------- | ----------------------------------------------------------- |
| `student_id`           | string           | **Required** unless a follow-up already set it. Must match the follow-up Student ID (case-insensitive). |
| `course`               | string           | Course the student joined.                                  |
| `payment`              | number \| string | Amount paid (e.g. `25000`) **or** `verified` / `pending`.   |
| `payment_amount`       | number           | Use instead of `payment` when sending the amount separately.|
| `payment_verification` | string           | `Pending`, `Verified` (typo `verifed` accepted).            |
| `remarks` / `notes`    | string           | Optional. Defaults to `Admission confirmed`.                |
| `lead_source`          | string           | Optional.                                                   |

The Student ID must be the same one used during follow-up. If the lead already
has a different ID, the request is rejected with `400`. If the lead has no ID
yet, the close request must supply one.

```json
{
  "student_id": "STU-1001",
  "course": "Full-Stack Web Development",
  "payment": 25000,
  "payment_verification": "Verified",
  "remarks": "Admission confirmed, fee paid"
}
```

Response `200`:

```json
{
  "success": true,
  "message": "Lead closed successfully",
  "data": {
    "id": 436888973,
    "status": 4,
    "admission_status": "Admission",
    "student_id": "STU-1001",
    "interested_course": "Full-Stack Web Development",
    "payment_verification": "Verified",
    "payment_amount": 25000,
    "followups": [ "...including an Admission entry..." ]
  }
}
```

Errors: `400` `Validation failed: student_id is required to close a lead.`,
`400` Student ID mismatch (a different ID than the one on the lead),
`401` unauthenticated, `404` lead not found.

---

## 6. Institutes (ASM)

Only employees with the **Area Sales Manager** designation (or an `ASM…`
employee ID) can add institutes. The ASM is taken from the token, so the app
never sends `created_by`.

### Add an institute

`POST /institutes`  (alias: `POST /institutes/create`)

Body:

| Field            | Type   | Required | Notes                                          |
| ---------------- | ------ | -------- | ---------------------------------------------- |
| `institute_name` | string | yes      | Institute / college name.                      |
| `person_name`    | string | yes      | Contact person at the institute.               |
| `position`       | string | no       | Their position, e.g. `Principal`, `HOD`.       |
| `phone`          | string | yes      | Contact number (`contact_number` also accepted).|
| `email`          | string | no       |                                                |
| `district`       | string | no       |                                                |
| `place`          | string | no       |                                                |
| `notes`          | string | no       | Free text.                                     |

```json
{
  "institute_name": "XYZ College of Arts & Science",
  "person_name": "Dr. Rajesh Kumar",
  "position": "Principal",
  "phone": "9847123456",
  "email": "principal@xyz.edu",
  "district": "Ernakulam",
  "place": "Kakkanad",
  "notes": "Interested in BCA batch"
}
```

Response `201`:

```json
{
  "success": true,
  "message": "Institute XYZ College of Arts & Science added successfully",
  "data": {
    "id": "6adefdf3c87a0a94af369a46",
    "legacy_id": 453429794,
    "institute_name": "XYZ College of Arts & Science",
    "person_name": "Dr. Rajesh Kumar",
    "position": "Principal",
    "phone": "9847123456",
    "email": "principal@xyz.edu",
    "district": "Ernakulam",
    "place": "Kakkanad",
    "notes": "Interested in BCA batch",
    "created_by": "Arya",
    "created_by_id": "ASM001",
    "created_at": "2026-10-26T10:20:00.000000Z",
    "updated_at": "2026-10-26T10:20:00.000000Z"
  }
}
```

Errors: `400` validation, `401` unauthenticated,
`403` `Only Area Sales Managers (ASM) can add institutes.`

### List institutes

`GET /institutes`

- ASM / employee token → only the institutes that employee added.
- Admin / manager token → every institute (used by the admin panel).

Optional query: `?search=text` (institute, person, position, phone, district,
place, ASM name or ID).

Response `200`:

```json
{
  "success": true,
  "count": 1,
  "data": [ { "...": "same institute object as above" } ]
}
```

### Delete an institute (admin panel)

`DELETE /institutes/{id}` — admin / manager only. `{id}` is the `id` from the
list response.

---

## Status and source codes

`status` (int) — used by `LeadModel.status`, mapped from `admission_status`:

| Value | `admission_status` values that map to it                          | Meaning                 |
| ----- | ----------------------------------------------------------------- | ----------------------- |
| 1     | `New Lead`, `New`                                                 | New                     |
| 2     | `Follow Uped`, `Follow Up`, `Followup`                            | Follow Up               |
| 3     | `Payment Pending`, `Presentation Scheduled`                       | In progress             |
| 4     | `Admission`, `Admitted`, `Won`                                    | Admitted / Won          |
| 5     | `Not Interested`, `Lost`, `Closed`, `Rejected`                    | Closed / Lost           |

The full string is also returned as `data.admission_status`, so the app can show
the exact label instead of only the integer.

`source` (int):

| Value | Meaning                          |
| ----- | -------------------------------- |
| 1     | Cold Call                        |
| 2     | Website                          |
| 3     | College Visit / Seminar / Campus Drive |
| 4     | Referral                         |
| 5     | Social Media                     |
| 6     | Instagram Ad                     |
| 7     | Facebook Ad                      |
| 8     | WhatsApp Enquiry                 |
| 9     | Walk-in                          |
| 10    | Google Ads                       |
| 11    | Other                            |

---

## Quick cURL test

```bash
curl -X POST https://lms-application-pi.vercel.app/api/leads/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Lead","phone":"9847000000"}'
```
