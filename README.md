# Mission Control

A multi-tenant B2B platform for space organisations to manage missions and intelligently assign crew based on skills, availability, and workload.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 · TypeScript · Vite · Chakra UI · TanStack Query |
| Backend | Node.js · TypeScript · Express · Prisma · SQLite |

## Prerequisites

- **Node.js** v18 or later (`node --version`)
- **npm** v9 or later (`npm --version`)

## Quick Start

### 1. Install dependencies

From the project root, install all dependencies for both packages:

```bash
npm run install:all
```

Or manually:

```bash
npm install --prefix backend
npm install --prefix frontend
```

### 2. Set up environment variables

The backend ships with a `.env` file preconfigured for local development. No changes are needed to run locally. If you want to customise it:

```bash
# backend/.env
DATABASE_URL="file:./dev.db"
JWT_SECRET="dev-secret"
PORT=3001
```

### 3. Migrate and seed the database

```bash
npm run db:migrate   # applies all Prisma migrations
npm run db:seed      # seeds two organisations with missions, crew, and skills
```

### 4. Start the development servers

```bash
npm run dev
```

This starts both servers concurrently:

| Server | URL |
|--------|-----|
| Backend API | http://localhost:3001 |
| Frontend | http://localhost:5173 |

The frontend proxies all `/api` requests to the backend automatically — no CORS configuration needed.

---

## Seeded Accounts

The seed script creates two organisations. Use these to log in:

### Artemis Space Agency — slug: `artemis`

| Role | Email | Password |
|------|-------|----------|
| Director | `chen@artemis.space` | `password123` |
| Mission Lead | `hayes@artemis.space` | `password123` |
| Mission Lead | `okafor@artemis.space` | `password123` |
| Crew Member | `torres@artemis.space` | `password123` |
| Crew Member | `morgan@artemis.space` | `password123` |

### Helios Orbital Systems — slug: `helios`

| Role | Email | Password |
|------|-------|----------|
| Director | `director@helios.orbital` | `password123` |
| Mission Lead | `fischer@helios.orbital` | `password123` |
| Crew Member | `tanaka@helios.orbital` | `password123` |

---

## Individual Commands

```bash
# Run backend only
npm run dev:backend

# Run frontend only
npm run dev:frontend

# Re-seed the database (resets all data)
npm run db:seed

# Run backend tests
npm test
```

---

## Architecture Overview

### Multi-tenancy

Every entity in the system belongs to an `Organisation`. The `orgId` is embedded in the JWT at login and injected by the `authenticate` middleware on every request. All database queries are scoped to `req.user.orgId` in the service layer — the client never sends an `orgId` in the request body. This makes cross-organisation data leakage structurally impossible at the query level.

---

### Data Model

```
Organisation
  ├── User (role: DIRECTOR | MISSION_LEAD | CREW_MEMBER)
  │     ├── CrewSkill (skillId, proficiencyLevel 1–5)
  │     └── Availability (startDate, endDate, reason?)   ← blackout windows
  │
  ├── Skill (name, category)                             ← org-scoped taxonomy
  │
  └── Mission (createdBy → User)
        ├── MissionRequirement (skillId, minProficiency, headcount)
        └── MissionAssignment (userId, missionRequirementId?)
```

Key design decisions:

- **Skills are org-scoped.** Each organisation maintains its own skill taxonomy, allowing proprietary or specialised skill definitions.
- **Availability is a blackout model.** Crew are assumed available unless an `Availability` record covers a date range. This simplifies the common case and keeps the data model lean.
- **`missionRequirementId` is nullable on `MissionAssignment`.** Assignments made by the matcher carry the requirement reference for full traceability. Assignments added manually (e.g. a director adding a crew member without matching against a specific requirement) set it to `null`.

---

### Mission Lifecycle

Missions follow a strict state machine enforced in `missions.service.ts`. All transitions are validated in a single `transition()` function against a declarative table — adding a new transition requires one line in that table.

```
DRAFT ──────────────────────────────────────► SUBMITTED
  │                                               │
  └──► CANCELLED                    ┌────────────┼────────────┐
                                    ▼            ▼            ▼
                                APPROVED      REJECTED     CANCELLED
                                    │            │
                              ┌─────┴──┐         └──► DRAFT  (reopen)
                              ▼        ▼
                         IN_PROGRESS  CANCELLED
                              │
                        ┌─────┴──────┐
                        ▼            ▼
                    COMPLETED     CANCELLED
```

| Transition | Permitted roles |
|------------|----------------|
| DRAFT → SUBMITTED | Director, owning Mission Lead |
| DRAFT → CANCELLED | Director, owning Mission Lead |
| SUBMITTED → APPROVED | Director only |
| SUBMITTED → REJECTED | Director only (with optional reason) |
| SUBMITTED → CANCELLED | Director, owning Mission Lead |
| APPROVED → IN_PROGRESS | Director only |
| APPROVED → CANCELLED | Director only |
| IN_PROGRESS → COMPLETED | Director only |
| IN_PROGRESS → CANCELLED | Director only |
| REJECTED → DRAFT | Owning Mission Lead only (clears rejection reason) |

`COMPLETED` and `CANCELLED` are terminal — no transitions out.

---

### Smart Matcher

The matcher (`matcher.service.ts`) assigns crew to mission requirement slots using a **scored greedy algorithm with global pool depletion**. It goes beyond naive greedy by scoring all candidate–slot pairs globally before assigning anyone.

**Scoring** (max 100 points per candidate per requirement):

| Component | Max | Logic |
|-----------|-----|-------|
| Proficiency | 40 | `(level / 5) × 40` — rewards higher skill |
| Availability | 30 | `30` if no blackout overlaps mission window, `0` if blocked |
| Workload | 30 | `30 × (1 − activeAssignments / 3)` — penalises crew already on active missions |

**Assignment algorithm:**

1. Compute scores for every valid (crew member, requirement) pair. Crew who don't meet `minProficiency` are hard-filtered out — they never appear in suggestions.
2. Sort all pairs by score descending.
3. Greedily assign: pick the highest-scoring unmatched pair, add the crew member to that requirement, and remove them from the global pool. A crew member can fill at most one requirement slot per mission.
4. Continue until all slots are filled or the pool is exhausted.

The endpoint (`GET /api/missions/:id/match`) returns a dry-run result — suggested assignments with full score breakdowns — without writing to the database. The Mission Lead or Director reviews the suggestions, optionally adjusts the selection, and confirms via `POST /api/missions/:id/assign`.

---
