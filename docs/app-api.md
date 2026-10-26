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

## 4. Close a lead (mark admitted)

`POST /leads/{id}/close`

`{id}` = numeric `id` from the lead object (Mongo `_id` and `lead_id` also work).

No body required.

Response `200`:

```json
{
  "success": true,
  "message": "Lead closed successfully",
  "data": { "...": "updated lead object, status: 4" }
}
```

Errors: `401` unauthenticated, `404` lead not found.

---

## 5. Add a follow-up

`POST /leads/{id}/follow-up`

`{id}` = numeric `id` from the lead object.

Body (all optional):

```json
{
  "notes": "Called again, asked for fee details",
  "followup_date": "2026-10-27",
  "next_followup_date": "2026-10-30",
  "student_interest": "High",
  "presentation": "Scheduled",
  "admission_status": "Follow Up",
  "proof_url": ""
}
```

`remarks` works in place of `notes`; `type` works in place of `admission_status`;
`date` works in place of `followup_date`.

Response `200`:

```json
{
  "success": true,
  "message": "Follow-up recorded successfully",
  "data": { "...": "updated lead object with the new entry appended to followups[]" }
}
```

Errors: `401` unauthenticated, `404` lead not found.

---

## Status and source codes

`status` (int) — used by `LeadModel.status`:

| Value | Meaning                 |
| ----- | ----------------------- |
| 1     | New                     |
| 2     | Follow Up               |
| 3     | Presentation Scheduled  |
| 4     | Admitted / Won          |
| 5     | Closed / Lost           |

`source` (int):

| Value | Meaning                          |
| ----- | -------------------------------- |
| 1     | Cold Call                        |
| 2     | Website                          |
| 3     | Campus Drive / College Seminar   |
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
