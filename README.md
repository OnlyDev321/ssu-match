<div align="center">
  <img src="frontend/public/images/ssumatch-logo.png" alt="SSUMatch" width="160" />

# SSUMatch

### Study Groups & Project Teams for Soongsil University

A campus community for finding study partners and building project teams.

[Features](#-features) · [Tech Stack](#️-tech-stack) · [Getting Started](#-getting-started) · [Architecture](#-architecture)
</div>

---

## 🚀 Features

- **u-SAINT Sign-In:** Verify Soongsil students through the university portal.
- **Group Discovery:** Search and filter study and project teams.
- **Team Recruitment:** Create groups, set role quotas, and manage applications.
- **Messaging & Notifications:** Coordinate with applicants and group members.
- **Student Profile:** View academic details and timetable information.
- **Three Languages:** Use the app in English, Korean, or Vietnamese.
- **Light & Dark Themes:** Choose the appearance that works for you.

## 🛠️ Tech Stack

- **Web:** Next.js 16, React 19, TypeScript, Tailwind CSS, Zustand
- **API:** Java 17, Spring Boot 4, Spring Data JPA, Spring Security
- **Database:** PostgreSQL
- **Authentication:** u-SAINT SSO and JWT

## 💻 Getting Started

### Requirements

Node.js, pnpm, JDK 17, and PostgreSQL.

### Start the API

```bash
cd backend
cp .env.example .env
# Set DB_URL, DB_USERNAME, DB_PASSWORD, and JWT_SECRET in .env
set -a && source .env && set +a
./gradlew bootRun
```

The API runs at `http://localhost:8080/api` by default.

### Start the web app

In another terminal:

```bash
cd frontend
cp .env.example .env.local
pnpm install
pnpm dev
```

Open `http://localhost:3000`. The web app uses `http://localhost:8080/api` by default. Set `FACTCHAT_API_KEY` in `.env.local` to enable group content translation.

## 📑 Architecture

See [architecture.md](architecture.md) for the current data flow, database model, and API overview.
