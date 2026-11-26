# SSUMatch — Current Architecture

This document describes the **codebase in this repository as of 2026-11-26**, not a future roadmap or production SLA. The current source of truth for the database schema is the JPA entity definitions under `backend/src/main/java/com/campusmatch/entity/` and `backend/src/main/java/com/campusmatch/academic/`. Flyway dependencies and `spring.flyway.enabled: true` are configured, but there are no versioned migration scripts under `backend/src/main/resources/db/migration/` yet; Hibernate currently manages schema updates with `ddl-auto: update`.

## 1. Layers and Data Flow

```text
Browser (Next.js 16 / React 19 / TypeScript / Tailwind CSS v4)
  ├─ app/pages + components + design-system (light/dark themes, en/vi/ko i18n)
  ├─ Zustand stores: auth, language, notifications
  ├─ Client query cache (lib/queryCache.ts) + REST services → lib/api.ts → Spring Boot /api/* (JWT Bearer)
  ├─ WebSocket client (RealtimeConnection.tsx) ↔ Spring Boot /ws (first-frame JWT auth)
  └─ Next.js Route Handlers (BFF)
       ├─ /api/auth/usaint            → u-SAINT/SAP → Spring Boot /api/auth/sso/usaint
       │                                            → Spring Boot /api/internal/usaint-sessions
       ├─ /api/auth/usaint/timetable  → Spring Boot /api/internal/usaint-sessions → u-SAINT/SAP
       └─ /api/translate              → FactChat (when FACTCHAT_API_KEY is configured)

Spring Boot 4.1.1 / Java 17 (Jackson 3)
  ├─ REST controllers → services (@Transactional) → Spring Data JPA repositories
  │    └─ PostgreSQL (configured via DB_URL)
  ├─ Realtime WebSocket (/ws) ← @TransactionalEventListener(AFTER_COMMIT)
  └─ In-memory UsaintSessionStore (30-min TTL, shared-secret internal API)
```

- `frontend/src/app/layout.tsx` composes `ThemeProvider`, `Header`, `Sidebar`, `PageTransition`, `Footer`, and `LoginModal` (with an inline theme-init script to avoid dark/light flash). `frontend/src/design-system/` contains design tokens, reusable UI components, and theme primitives. UI localization uses three dictionaries (`en`, `vi`, `ko`) in `frontend/src/i18n/dictionaries/`.
- `frontend/src/lib/types.ts` centralizes shared TypeScript interfaces; `frontend/src/services/` encapsulates HTTP calls; `frontend/src/lib/queryCache.ts` provides stale-time caching, in-flight request deduplication, and prefix-based invalidation; `frontend/src/stores/` holds Zustand state. `authStore` persists the user profile, JWT, and fetched timetable snapshots in `localStorage` (never passwords or SAP cookies). When a request receives `401` with an active JWT, `lib/api.ts` clears the expired session and opens `LoginModal` while preserving the current path and query string for post-login redirect.
- `/api/auth/usaint` authenticates against u-SAINT/SAP, extracts the student profile, fetches the current or nearest academic term with timetable data, and exchanges the profile for a Spring Boot JWT. SAP session cookies are stored in Spring Boot's in-memory `UsaintSessionStore` for up to 30 minutes via `/api/internal/usaint-sessions` (protected by a constant-time shared-secret header `X-Internal-Secret`), while the browser only receives an opaque random session ID in an `HttpOnly` cookie (`usaint_timetable_session`). Additional timetable terms are fetched on demand via `POST /api/auth/usaint/timetable` and cleared on logout via `DELETE /api/auth/usaint/timetable`. Passwords and SAP cookies are never persisted to PostgreSQL.
- The browser calls Spring Boot directly via `NEXT_PUBLIC_API_BASE_URL` for REST and derives the `/ws` WebSocket URL from it. Public endpoints cover group browsing/details, post years, academic units, public statistics, and health checks; user-specific actions require a JWT Bearer token, and backend services enforce leader, member, participant, or applicant authorization per operation.
- `RealtimeConnection.tsx` maintains a WebSocket connection to `/ws` while logged in, authenticates with an initial `{ type: "auth", token }` frame (8-second server timeout), sends 25-second `ping` heartbeats, and reconnects with exponential backoff (re-fetching notifications and signaling messenger refresh on reconnect).

## 2. Repository Structure

```text
ssu-match/
├─ frontend/
│  ├─ src/app/
│  │  ├─ page.tsx                       # Landing page + public statistics
│  │  ├─ groups/page.tsx                # Group search, filtering, and pagination
│  │  ├─ groups/[id]/page.tsx           # Group details, roster, translation, and apply flow
│  │  ├─ create-group/page.tsx          # Group creation form + role quota editor
│  │  ├─ manage/page.tsx                # Led and joined groups overview
│  │  ├─ manage/[groupId]/page.tsx      # Group editing, application review, privacy toggle, deletion
│  │  ├─ mypage/
│  │  │  ├─ page.tsx                    # Student profile and timetable page
│  │  │  ├─ ProfileCard.tsx             # Academic profile card
│  │  │  └─ TimetableCard.tsx           # Interactive timetable + on-demand term selector
│  │  └─ api/
│  │     ├─ auth/usaint/route.ts        # u-SAINT SSO login + initial timetable fetch
│  │     ├─ auth/usaint/timetable/route.ts # On-demand term fetch + session cleanup
│  │     └─ translate/route.ts          # Optional FactChat translation proxy
│  ├─ src/components/{application,auth,common,group,layout}/
│  ├─ src/design-system/{components,theme,tokens.ts,index.ts}
│  ├─ src/i18n/dictionaries/{en,vi,ko}.ts
│  ├─ src/lib/{api,format,hooks,manageGroup,queryCache,realtimeEvents,textScramble,timetable,timetableParser,types,usaint}.ts
│  ├─ src/services/{academic,application,group,messenger,notification,statistics,translation}Service.ts
│  ├─ src/stores/{auth,language,notification}Store.ts
│  ├─ DESIGN.md
│  └─ .env.example
├─ backend/
│  ├─ src/main/java/com/campusmatch/
│  │  ├─ academic/                      # SSU academic catalog sync, snapshot entity, and API
│  │  ├─ config/                        # Spring Security filter chain and CORS configuration
│  │  ├─ controller/                    # Auth, User, Group, Application, Conversation, Notification, Statistics, Health, InternalUsaintSession
│  │  ├─ dto/                           # Request and response DTOs
│  │  ├─ entity/                        # JPA entities and enums
│  │  ├─ realtime/                      # WebSocket config, handler, events, and AFTER_COMMIT listener
│  │  ├─ repository/                    # Spring Data JPA repositories
│  │  ├─ security/                      # JWT provider/filter and student ID / email privacy masking
│  │  └─ service/                       # Transactional business logic and in-memory UsaintSessionStore
│  ├─ src/main/resources/{application.yaml,academic/ssu-catalog.json}
│  ├─ src/test/java/com/campusmatch/    # Unit and context tests
│  ├─ Dockerfile                        # Multi-stage Gradle 9.8.1 / Temurin 17 JRE build
│  └─ .env.example
├─ README.md
└─ architecture.md
```

## 3. Database Model

| Table | Key Columns | Relationships & Rules |
| --- | --- | --- |
| `users` | unique `student_id`, name, department, faculty, email, academic_year, phone_number, avatar_url, role, last_login_at | Synced from u-SAINT on sign-in; `student_id` is immutable while other profile fields are refreshed on login. |
| `study_groups` | leader, `leader_anonymous`, `post_anonymous` (immutable), title, description, college, department, `post_year`, course_code/name, `meeting_format`, `tags` (JSONB), `roles_quota` (JSONB), contact_email/phone, `max_members`, `status`, timestamps | `college`/`department` come from the leader at creation; contact fields are stored only when the leader opts in. Up to 5 tags (max 50 chars each); `roles_quota[].max` sums to `max_members` at creation with the leader occupying 1 slot. Indexed on `(college, department, post_year)`. |
| `group_members` | `(group_id, user_id)`, role, `member_anonymous`, `joined_at` | Composite primary key; role is `LEADER` or `MEMBER`. Members can toggle `member_anonymous` for their display identity in the group. |
| `applications` | group, applicant, `applicant_anonymous`, statement, `desired_role`, status, timestamps | Unique `(group_id, applicant_id)`; status is `PENDING`, `ACCEPTED`, or `REJECTED`. |
| `conversations` | group, requester, leader, `group_chat`, `requester_anonymous`, timestamps | Unique `(group_id, requester_id)`. Supports both 1:1 applicant–leader chats (`group_chat = false`) and shared group chats (`group_chat = true`). |
| `chat_messages` | conversation, sender, content (TEXT), `system_message`, `created_at` | Indexed on `(conversation_id, created_at)`. Stores user messages and group system announcements. |
| `notifications` | recipient, actor, group, type, title, message, link, `is_read`, `created_at` | Read state (`is_read`) and deletions are persisted in PostgreSQL. |
| `academic_catalog_snapshot` | fixed `id = 1`, payload (TEXT) | Stores the validated SSU college/department catalog; bootstrapped from bundled `ssu-catalog.json` and synced periodically from SSU sources. |

- `GroupStatus` retains `CLOSED` for legacy records; the management UI does not allow setting status manually. On group creation or capacity updates, status is derived automatically: `RECRUITING` when spots remain and `COMPLETED` when full. Accepting the final member transitions the group to `COMPLETED`. Reducing capacity below the current member count is rejected, and role quotas cannot be lowered below the number of members already holding a role.
- Older groups created before `meeting_format` and `tags` were introduced leave those fields empty without automatic backfill.

## 4. REST API & WebSocket Endpoints

Backend REST base path: `/api`. The Next.js BFF exposes its own `/api/*` routes solely for u-SAINT SSO, on-demand timetable loading, and translation.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/sso/usaint` | Public (called by BFF) | Sync student profile and issue a 24-hour JWT. |
| GET | `/users/me` | JWT | Current user profile with full `studentId`. |
| GET | `/users/me/groups` | JWT | Groups led or joined by the current user. |
| GET | `/users/me/applications` | JWT | Current user's applications and up-to-date statuses. |
| GET | `/groups`, `/groups/years`, `/groups/{id}` | Public | Search/paginate groups, list post years, fetch group detail and roster. |
| POST | `/groups` | JWT | Create a study group and add the creator as `LEADER` in `group_members`. |
| PUT | `/groups/{id}` | JWT + leader | Update group fields (title, description, course, format, tags, contacts, capacity, role quotas); recompute status. |
| PATCH | `/groups/{id}/members/me/privacy` | JWT + member | Toggle the current member's anonymous display setting (`memberAnonymous`). |
| DELETE | `/groups/{id}` | JWT + leader | Delete the group and associated records. |
| POST | `/groups/{id}/applications` | JWT | Submit an application; rejects leaders, existing members, and duplicate pending applications. |
| GET | `/groups/{id}/applications` | JWT + leader | List applications submitted to the group. |
| PUT | `/applications/{id}/accept`, `/applications/{id}/reject` | JWT + leader | Process `PENDING` applications; accepting adds the member and increments role quota. |
| DELETE | `/applications/{id}` | JWT + applicant | Withdraw a `PENDING` application. |
| GET | `/conversations` | JWT | List 1:1 application chats and group chats with latest message and participant count. |
| GET | `/conversations/{id}/messages` | JWT + participant | Load chronological message history for an authorized conversation. |
| POST | `/conversations/{id}/messages` | JWT + participant | Persist a chat message and push `message.created` over WebSocket. |
| GET | `/notifications`, `/notifications/unread-count` | JWT | Fetch notifications and unread count. |
| PATCH | `/notifications/{id}/read`, `/notifications/read-all` | JWT | Mark one or all notifications as read. |
| DELETE | `/notifications/{id}`, `/notifications` | JWT | Delete one or all notifications. |
| GET | `/statistics`, `/academic-units`, `/health` | Public | Database `COUNT` statistics, academic catalog snapshot, health check. |
| POST / GET / DELETE | `/internal/usaint-sessions[/{id}]` | `X-Internal-Secret` | Ephemeral in-memory SAP cookie store for Next.js BFF timetable requests. |
| WS | `/ws` | First-frame JWT `auth` | Server-push channel for `notification.created` and `message.created` events (`ping`/`pong` keepalive). |

- `GET /groups` supports `keyword`, `college`, `department`, `postYear`, `status`, and Spring pagination (`page`, `size`, `sort`). Sorting by remaining spots uses the Hibernate `@Formula` `availableSpots` column in SQL prior to pagination.
- **Privacy masking (`StudentIdPrivacy`)**: Public responses always mask student IDs to only the last two characters (e.g., `******12`), and omit emails that contain another user's full student ID. Authenticated `/users/me` returns the full student ID to the account owner.

## 5. Core Workflows (UI → API → Database)

1. **Authentication & On-Demand Timetable:** Submitting u-SAINT credentials posts to Next.js `/api/auth/usaint`, which verifies via `usaint-lib`/SAP, loads the current or nearest term with timetable data, saves SAP cookies in `UsaintSessionStore` behind an `HttpOnly` session ID cookie, and calls `/api/auth/sso/usaint` for a JWT. Switching terms in `TimetableCard` calls `/api/auth/usaint/timetable` to fetch and cache that term on demand.
2. **Create Group:** The form submits title, description, optional course code/name, capacity (2–20), meeting format, tags, optional public contacts, anonymous posting preference, and role quotas. The backend attaches leader metadata (`college`, `department`, `postYear`) and writes `study_groups` (JSONB `tags` and `roles_quota`) and the leader's `group_members` row in a single transaction.
3. **Browse & Detail:** Pages fetch paginated summaries and group details through `queryCache.ts` to minimize redundant requests. The Join button is disabled for the leader, current members, users with a `PENDING` application, and full groups. Group Detail supports optional client-triggered translation via `/api/translate` (translations are not persisted).
4. **Apply & Review:** Applicants submit a statement (with optional skills/GitHub/portfolio fields concatenated into `statement`), desired role, and anonymity preference. Rejected applicants may re-apply; `PENDING`/`ACCEPTED` duplicates are blocked. Leaders accept or reject pending applications in `/manage/[groupId]`, while applicants can withdraw pending applications.
5. **Manage & Privacy:** Leaders edit group details via a transactional `PUT`, review applications, and delete groups. Members can view their joined groups and toggle their per-group anonymity via `PATCH /groups/{id}/members/me/privacy`.
6. **Messenger & Real-Time Notifications:** Application and group conversations are persisted in `conversations` and `chat_messages`. When messages or notifications are saved, Spring publishes domain events consumed by `RealtimeEventListener` (`TransactionPhase.AFTER_COMMIT`), pushing `message.created` and `notification.created` frames to connected WebSocket sessions. The frontend deduplicates REST responses against WebSocket deliveries in `MessengerDropdown` and `notificationStore`.

## 6. Configuration, Deployment, and Verification

- **Backend environment (`backend/.env.example`):** `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `INTERNAL_API_SECRET`. Packaged via `backend/Dockerfile` (multi-stage `gradle:9.8.1-jdk17` builder + `eclipse-temurin:17-jre` runtime).
- **Frontend environment (`frontend/.env.example`):** `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8080/api`), `SPRING_BOOT_API_URL` (default `http://localhost:8080`), `SPRING_BOOT_INTERNAL_SECRET` (must match backend `INTERNAL_API_SECRET`), and optional `FACTCHAT_API_KEY` / `FACTCHAT_MODEL` for translation.
- **CORS & WebSocket origins:** Both `SecurityConfig` and `RealtimeWebSocketConfig` currently allow `http://localhost:3000`, `http://127.0.0.1:3000`, `https://campus-frontend-xi.vercel.app`, `https://ssumatch.com`, and `https://www.ssumatch.com`.
- **Verification commands:**
  - Frontend: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build`
  - Backend: `./gradlew test --offline` (Spring context tests run only when `DB_URL` is present; unit tests for academic catalog, statistics, notifications, privacy masking, applications, and group updates run without a database).

## 7. Current Limitations

- **No versioned SQL migrations yet:** Although Flyway is enabled in `application.yaml`, no migration files exist in `backend/src/main/resources/db/migration/`, so Hibernate `ddl-auto: update` still applies schema changes. Add baseline and versioned Flyway migrations before performing destructive or multi-environment schema changes.
- **Unauthenticated BFF-to-backend SSO endpoint:** `POST /api/auth/sso/usaint` is permitted in `SecurityConfig` without server-to-server authentication (unlike `/api/internal/usaint-sessions`). Protect this endpoint with shared-secret or mutual authentication so arbitrary clients cannot mint JWTs for arbitrary `studentId` payloads.
- **Single-instance in-memory state:** `UsaintSessionStore` and `RealtimeWebSocketHandler` session maps live in JVM memory. Scaling the backend horizontally across multiple instances will require externalizing session storage and WebSocket fan-out (e.g., via Redis).
- **Database-gated integration tests:** Spring context startup and PostgreSQL JSONB persistence tests only execute when `DB_URL` is configured in the test environment.
