# CRM Sales Management System – Backend API

A role-based REST API for managing a sales pipeline: **Lead → Customer → Deal → Won / Lost**, with activities, an audit timeline and sales analytics.

**Stack:** Node.js · Express · TypeScript · MongoDB (Mongoose) · Zod · JWT

- **Live API:** `<your-deployed-url>/api/v1`
- **Health check:** `<your-deployed-url>/health`
- **Postman collection:** `docs/CRM.postman_collection.json` (+ `docs/CRM.postman_environment.json`)

---

## Table of contents

1. [Features](#features)
2. [Getting started](#getting-started)
3. [Seeded accounts](#seeded-accounts)
4. [Project structure](#project-structure)
5. [Roles and permissions](#roles-and-permissions)
6. [API overview](#api-overview)
7. [Business rules](#business-rules)
8. [Design decisions](#design-decisions)
9. [Response and error format](#response-and-error-format)
10. [Assumptions](#assumptions)
11. [Deployment](#deployment)
12. [Possible improvements](#possible-improvements)

---

## Features

- **Authentication:** register, login, logout, refresh, `/me`. JWT access + refresh tokens (HTTP-only cookies, or `Authorization: Bearer`). Passwords hashed with bcrypt; refresh tokens stored hashed and rotated on every refresh.
- **Role-based access control:** Admin, Sales Manager, Sales Executive, enforced in the backend on every endpoint and every query.
- **User management** (Admin): CRUD, activate/deactivate, manager → executive team structure.
- **Leads:** CRUD, status updates, assign/reassign, search, filters, date range, pagination, sorting.
- **Lead conversion:** Qualified lead → Customer + Deal inside a **MongoDB transaction** (all-or-nothing, double-conversion safe).
- **Customers:** CRUD, keeps the link to the original lead and its deals.
- **Deals:** CRUD, stage rules, server-calculated expected revenue, min/max amount and closing-date filters.
- **Activities:** calls, emails, meetings, demos, follow-ups, reminders, notes; linkable to a lead, customer, deal or user; overdue status computed by the backend.
- **Timeline / audit history** for leads, customers and deals (who, what, previous value, new value, when).
- **Analytics:** dashboard statistics, sales pipeline by stage, manager/admin team performance.
- **Hardening:** Zod validation on all inputs, centralised error handler, helmet, CORS, rate limiting, indexed queries.

---

## Getting started

### Prerequisites

- Node.js 18+
- A MongoDB Atlas cluster (the free M0 tier works). Atlas runs as a replica set, which **transactions require**; a standalone local `mongod` will not work for lead conversion.

### Setup

```bash
git clone <repo-url>
cd crm-backend
npm install
cp .env.example .env      # then fill in the values
npm run seed              # creates demo users and sample data
npm run dev               # http://localhost:5000
```

### Environment variables

| Variable | Description | Example |
|---|---|---|
| `NODE_ENV` | `development` or `production` | `development` |
| `PORT` | HTTP port | `5000` |
| `MONGO_URI` | Atlas connection string (include the `/crm` database name) | `mongodb+srv://user:pass@cluster0.xxxx.mongodb.net/crm?retryWrites=true&w=majority` |
| `JWT_ACCESS_SECRET` | Secret for access tokens | long random string |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens (different from the above) | long random string |
| `JWT_ACCESS_EXPIRES` | Access token lifetime | `15m` |
| `JWT_REFRESH_EXPIRES` | Refresh token lifetime | `7d` |
| `CORS_ORIGIN` | Comma-separated allowed origins | `http://localhost:3000` |

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start with hot reload (tsx) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled build |
| `npm run seed` | Create demo users + sample data (skips if data already exists) |
| `npm run seed:reset` | **Clears every collection**, then re-seeds (blocked in production) |

---

## Seeded accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@crm.com` | `Admin@1234` |
| Sales Manager | `maya@crm.com` | `Password@123` |
| Sales Manager | `neha@crm.com` | `Password@123` |
| Sales Executive (Maya's team) | `eli@crm.com` | `Password@123` |
| Sales Executive (Maya's team) | `ravi@crm.com` | `Password@123` |
| Sales Executive (Neha's team) | `tara@crm.com` | `Password@123` |

Seed data includes leads in every status, converted leads with customers and deals (open, won and lost), and activities including overdue ones, so every endpoint returns meaningful data straight away.

---

## Project structure

```
src/
├── config/        env validation, database connection
├── constants/     roles, statuses, stages, timeline actions (single source of truth)
├── models/        Mongoose schemas, typed interfaces, indexes
├── validators/    Zod schemas for body / query / params
├── middleware/    authenticate, authorize, validate, rate limiter, error handler
├── services/      business logic (controllers stay thin)
├── controllers/   request/response handling
├── routes/        route definitions, mounted under /api/v1
├── scripts/       seed scripts
├── types/         Express request augmentation (req.user)
└── utils/         ApiError, response helper, JWT/cookies, access scope, query builder
```

---

## Roles and permissions

Authorization is enforced in the backend in two layers: **route-level** (`authorize(roles)`) and **data-level** (an access-scope filter merged into every query).

| Capability | Admin | Sales Manager | Sales Executive |
|---|:--:|:--:|:--:|
| Manage users | ✅ | ❌ | ❌ |
| View data | All records | Own + team's records | Own assigned records |
| Create leads | ✅ | ✅ | ✅ (auto-assigned to self) |
| Update leads, change status | ✅ | ✅ (in scope) | ✅ (own) |
| Assign / reassign leads and deals | ✅ | ✅ (own team only) | ❌ |
| Convert qualified leads | ✅ | ✅ (in scope) | ✅ (own) |
| Create / update customers and deals | ✅ | ✅ (in scope) | ✅ (own) |
| Create activities, add notes | ✅ | ✅ | ✅ |
| Delete leads / customers / deals | ✅ | ❌ | ❌ |
| Team performance analytics | ✅ | ✅ (own team) | ❌ |
| Dashboard and pipeline analytics | All | Team | Own |

**Access scope:** Admin → no filter. Manager → `assignedTo ∈ {self + executives whose managerId = self}`. Executive → `assignedTo = self`. Records outside a user's scope return **404** (not 403), so IDs cannot be probed.

---

## API overview

Base path: `/api/v1`. Authenticate with the cookie set at login, or `Authorization: Bearer <accessToken>`.

### Auth
| Method | Endpoint | Notes |
|---|---|---|
| POST | `/auth/register` | Public. Always creates a Sales Executive |
| POST | `/auth/login` | Sets cookies, returns user + `accessToken` |
| POST | `/auth/refresh` | Rotates refresh token |
| POST | `/auth/logout` | Revokes refresh token, clears cookies |
| GET | `/auth/me` | Current user |

### Users (Admin only)
| Method | Endpoint |
|---|---|
| POST / GET | `/users` |
| GET / PATCH / DELETE | `/users/:id` |
| PATCH | `/users/:id/status` |

List filters: `search`, `role`, `isActive`, `managerId`, `dateFrom`, `dateTo`, `sortBy`, `order`, `page`, `limit`.

### Leads
| Method | Endpoint | Notes |
|---|---|---|
| POST / GET | `/leads` | Filters: `status`, `priority`, `source`, `assignedTo` (id or `unassigned`), `search`, `dateFrom`, `dateTo` |
| GET / PATCH | `/leads/:id` | |
| DELETE | `/leads/:id` | Admin only; not for converted leads |
| PATCH | `/leads/:id/status` | `Converted` cannot be set here |
| PATCH | `/leads/:id/assign` | Admin / Manager |
| POST | `/leads/:id/convert` | Qualified leads only; creates Customer + Deal atomically |
| GET | `/leads/:id/timeline` | |
| GET | `/leads/assignable-users` | Executives the caller may assign to |

### Customers
| Method | Endpoint |
|---|---|
| POST / GET | `/customers` |
| GET / PATCH | `/customers/:id` (detail includes original lead and visible deals) |
| DELETE | `/customers/:id` (Admin only) |
| GET | `/customers/:id/timeline` |

### Deals
| Method | Endpoint | Notes |
|---|---|---|
| POST / GET | `/deals` | Filters: `stage`, `status` (open/won/lost), `assignedTo`, `customerId`, `minAmount`, `maxAmount`, `closeDateFrom`, `closeDateTo`, `search` |
| GET / PATCH | `/deals/:id` | |
| PATCH | `/deals/:id/stage` | Stage rules apply |
| PATCH | `/deals/:id/assign` | Admin / Manager |
| DELETE | `/deals/:id` | Admin only |
| GET | `/deals/:id/timeline` | |

### Activities
| Method | Endpoint | Notes |
|---|---|---|
| POST / GET | `/activities` | Filters: `type`, `status` (Pending/Completed/Overdue), `assignedTo`, `entityType`, `entityId`, `dueFrom`, `dueTo`, `search` |
| GET / PATCH / DELETE | `/activities/:id` | |
| PATCH | `/activities/:id/complete` | |

### Analytics
| Method | Endpoint | Notes |
|---|---|---|
| GET | `/analytics/dashboard` | Optional `dateFrom`, `dateTo`, `assignedTo` |
| GET | `/analytics/pipeline` | Count and value per stage |
| GET | `/analytics/team-performance` | Admin / Manager. Admin may pass `managerId` |

### Pagination, search, sorting (all list endpoints)

`?page=1&limit=10&sortBy=createdAt&order=desc&search=acme&dateFrom=2026-10-01&dateTo=2026-10-31`

`limit` is capped at 100. Responses include:

```json
"pagination": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 }
```

---

## Business rules

**Leads**
- New leads start as `New`. Statuses: New, Contacted, Qualified, Unqualified, Converted, Lost.
- Only `Qualified` leads can be converted, only once, and only if assigned to a sales executive.
- `Converted` is reachable only through the convert endpoint. Converted leads are read-only and cannot be deleted.

**Conversion (transactional)**
- In one MongoDB transaction: create the Customer, create the Deal, atomically mark the lead `Converted` (guarded by `status = Qualified AND convertedCustomerId = null`), and write three timeline entries.
- Any failure rolls everything back. Two simultaneous conversions of the same lead result in one success and one `409`.
- The customer and deal inherit the lead's assignee.

**Deals**
- Stages: Qualification → Discovery → Proposal → Negotiation → Won / Lost. Active stages can move in any direction.
- `value > 0`, `probability` 0–100, close date not in the past.
- `expectedRevenue = value × probability / 100`, always calculated on the server (client input is ignored).
- **Won** forces probability to 100 and requires an active customer. **Lost** forces probability to 0 and requires a reason.
- Closed deals are locked (no edits, no reassignment, no stage changes). Only an Admin can reopen one, to an active stage, and must supply a probability.
- Won deals and deals created by conversion cannot be deleted.

**Activities**
- Statuses are stored as `Pending` or `Completed` only. **`Overdue` is derived**: `Pending` and due date in the past, computed in responses (`isOverdue`, `effectiveStatus`), filters and analytics.
- Notes are created already `Completed` and have no due date.
- Completed activities cannot be edited. Completing twice returns `409`.
- Activities can only be attached to records the caller can already see.

**Users**
- Public registration can never choose a role; Admins create managers and admins.
- Admins cannot deactivate, delete or change the role of their own account.
- Users with related records cannot be deleted. Deactivate them instead.
- A manager with team members cannot change role until the team is reassigned.

---

## Design decisions

- **Thin controllers, fat services.** Business rules live in `services/`, so they are reusable (the seed script calls the same services as the API).
- **One access-scope helper** (`buildAccessScope`) used by every module. Authorization cannot be forgotten on an individual query.
- **Shared query builder** for pagination, search (escaped regex), whitelisted sorting with an `_id` tiebreaker, date and number ranges.
- **Timeline is a single generic collection** keyed by `entityType + entityId`, written through one `logTimeline()` service (which accepts a transaction session).
- **Derived overdue status** avoids stale data and needs no background job.
- **Fresh user lookup on every request** in `authenticate`, so deactivation and role changes apply immediately, not at token expiry.
- **Refresh token rotation with hashed storage** limits the damage of a leaked token.
- **Compound indexes** match the main query shapes, for example `assignedTo + status + createdAt`.

---

## Response and error format

Success:

```json
{ "success": true, "message": "Leads fetched successfully", "data": [], "pagination": {} }
```

Error:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{ "field": "email", "message": "Invalid email" }]
}
```

| Status | Meaning |
|---|---|
| 400 | Validation error or invalid input / state |
| 401 | Missing, invalid or expired token |
| 403 | Authenticated but not permitted |
| 404 | Not found (also used for records outside the caller's scope) |
| 409 | Conflict (duplicate, already converted, closed deal, related records) |
| 429 | Rate limit exceeded |
| 500 | Unexpected server error (details hidden in production) |

---

## Assumptions

- A manager's **team** is the set of executives whose `managerId` points to that manager.
- Leads can only be assigned to **active Sales Executives**; a manager can assign only within their own team.
- Executives creating leads, customers or deals are auto-assigned as the owner.
- A manager also sees unassigned leads created by their team.
- Customers created by conversion cannot be deleted (set them to `Inactive`).
- Past due dates are allowed when creating activities (to log or back-fill work).
- Conversion rate = converted leads ÷ total leads. Total revenue = sum of Won deal values. Expected revenue = probability-weighted value of open deals.
- Analytics date ranges filter on each record's creation date.
- Team performance covers executives only (deactivated ones included, flagged via `isActive`).

---

## Deployment

Deployed on Render (any Node host works).

| Setting | Value |
|---|---|
| Build command | `npm install --include=dev && npm run build` |
| Start command | `npm start` |
| Health check path | `/health` |

Set all environment variables from the table above, with `NODE_ENV=production` and `CORS_ORIGIN` set to the frontend origin. In MongoDB Atlas, allow the host's outbound IPs (or `0.0.0.0/0` for a demo) under **Network Access**. After the first deploy, run the seed once (`npm run seed`, via the host's shell or locally against the production `MONGO_URI`).

Cookies are `Secure` + `SameSite=None` in production, so the API must be served over HTTPS (the Bearer header also works).

---

## Possible improvements

- Swagger/OpenAPI generated from the Zod schemas
- Automated tests (Jest + Supertest with an in-memory replica set)
- Email/notification reminders for overdue activities
- Soft delete and restore for leads, customers and deals
- CSV export for reports
- Redis-backed rate limiting and token blacklist
