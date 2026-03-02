# 🧠 Bitespeed Identity Reconciliation Service

A production-ready backend service that consolidates customer identity based on **email** and **phone number**. Built as part of the [Bitespeed Backend Task](https://bitespeed.io/backend-task).

> **🌐 Live Demo:** [https://bitespeed-project-oygu.onrender.com/]

---

## � Table of Contents

- [Overview](#-overview)
- [Tech Stack](#-tech-stack)
- [Project Architecture](#-project-architecture)
- [Database Schema](#-database-schema)
- [API Reference](#-api-reference)
- [Business Logic](#-business-logic)
- [Getting Started](#-getting-started)
- [Running Tests](#-running-tests)
- [Deployment](#-deployment)

---

## 🔍 Overview

Customers may use different emails and phone numbers across multiple purchases. This service identifies and links such contacts, maintaining a **primary-secondary** relationship hierarchy. It ensures that:

- The **oldest** contact always remains the **primary**.
- New information creates a **secondary** contact linked to the primary.
- Two separate primary contacts that turn out to be the same person are **merged** intelligently.
- Exact duplicate requests **do not** create redundant rows.

The service exposes a single REST endpoint (`POST /identify`) and includes a built-in **web UI** for testing.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js |
| **Language** | JavaScript (ES6+) |
| **Framework** | Express.js |
| **ORM** | Prisma |
| **Database** | PostgreSQL |
| **Testing** | Jest + Supertest |
| **Deployment** | Render |

### Key Libraries

| Package | Purpose |
|---|---|
| `express` | HTTP server & routing |
| `@prisma/client` | Type-safe database client |
| `cors` | Cross-origin resource sharing |
| `dotenv` | Environment variable management |
| `jest` | Unit testing framework |
| `supertest` | HTTP assertion testing |

---

## 🏗 Project Architecture

```
BiteSpeedBackend/
│
├── prisma/
│   └── schema.prisma           # Database schema & model definition
│
├── src/
│   ├── config/
│   │   └── database.js         # Prisma client singleton
│   │
│   ├── models/
│   │   └── contact.model.js    # Data access layer (repository pattern)
│   │
│   ├── services/
│   │   └── identity.service.js # Core business logic (reconciliation engine)
│   │
│   ├── controllers/
│   │   └── identity.controller.js  # HTTP request handler
│   │
│   ├── routes/
│   │   └── identity.routes.js  # Route definitions
│   │
│   ├── middlewares/
│   │   ├── validation.js       # Request body validation
│   │   └── errorHandler.js     # Global error handling
│   │
│   ├── public/
│   │   └── index.html          # Frontend UI for testing
│   │
│   ├── app.js                  # Express app configuration
│   └── server.js               # Server entry point
│
├── tests/
│   └── identity.test.js        # Unit tests (9 test cases)
│
├── .env                        # Environment variables
├── .gitignore
├── jest.config.js
├── package.json
└── README.md
```

### Architecture Flow

```
Client Request (POST /identify)
        │
        ▼
┌─────────────────┐
│   Express App   │  ← CORS, JSON parsing
│   (app.js)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Validation    │  ← Checks email/phone presence & types
│  Middleware     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Controller    │  ← Extracts params, calls service
│                 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Service      │  ← Core reconciliation logic
│  (Transaction)  │  ← Serializable isolation level
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Prisma ORM     │  ← SQL query generation
│  + PostgreSQL   │
└─────────────────┘
```

---

## 🗄 Database Schema

```prisma
model Contact {
  id             Int       @id @default(autoincrement())
  phoneNumber    String?
  email          String?
  linkedId       Int?              // References the primary contact
  linkPrecedence String    @default("primary")  // "primary" | "secondary"
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  deletedAt      DateTime?

  @@index([email])
  @@index([phoneNumber])
  @@index([linkedId])
}
```

**Indexes** on `email`, `phoneNumber`, and `linkedId` ensure fast lookups and avoid N+1 query issues.

---

## 📡 API Reference

### `POST /identify`

Identify and consolidate a contact.

**Request:**
```json
{
  "email": "user@example.com",
  "phoneNumber": "1234567890"
}
```
> At least one of `email` or `phoneNumber` is required.

**Response (200):**
```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["user@example.com", "other@example.com"],
    "phoneNumbers": ["1234567890", "9876543210"],
    "secondaryContactIds": [2, 3]
  }
}
```

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-03T00:00:00.000Z"
}
```

---

## 🧠 Business Logic

The service handles **four core scenarios** within a single database transaction:

### Case 1 — New Contact
No existing contact matches → Create a new **primary** contact.

### Case 2 — Existing Match with New Info
Email or phone matches existing contacts, but the other field is new → Create a **secondary** contact linked to the primary.

### Case 3 — Merging Two Primaries
Email matches Contact A, phone matches Contact B, and both are primary → The **older** one stays primary, the newer one becomes secondary. All its secondaries are re-linked.

### Case 4 — Exact Duplicate
Both email and phone already exist in the cluster → **No new row** is created. Returns the existing consolidated data.

**Key guarantees:**
- All operations use **Serializable transactions** to prevent race conditions.
- The **oldest** contact always remains the primary.
- Response arrays are **deduplicated** with the primary's values appearing first.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+
- **PostgreSQL** database (local or hosted, e.g., Render, Supabase, Neon)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/BiteSpeedBackend.git
cd BiteSpeedBackend

# Install dependencies
npm install
```

### Configuration

Create a `.env` file:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/bitespeed"
PORT=3000
```

### Database Setup

```bash
# Run migration
npm run migrate

# Generate Prisma client
npx prisma generate
```

### Start the Server

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

Open **http://localhost:3000** to access the web UI.

---

## 🧪 Running Tests

```bash
npm test
```

**Test Coverage:**

| Category | Tests | Status |
|---|---|---|
| New contact creation | 3 | ✅ |
| Secondary contact creation | 2 | ✅ |
| Primary contact merging | 1 | ✅ |
| Duplicate handling | 1 | ✅ |
| Input validation | 1 | ✅ |
| Health check | 1 | ✅ |
| **Total** | **9** | **All passing** |

---

## 🌐 Deployment

This project is deployment-ready for **Render**, **Railway**, **Heroku**, or any Node.js hosting platform.

### Render Deployment

1. Push your code to GitHub.
2. Create a new **Web Service** on [Render](https://render.com).
3. Set the **Build Command:** `npm install && npx prisma generate && npx prisma migrate deploy`
4. Set the **Start Command:** `npm start`
5. Add environment variables (`DATABASE_URL`, `PORT`).
6. Deploy.

---

## 📄 License

ISC

---

<p align="center">
  Built with ❤️ for the <a href="https://bitespeed.io">Bitespeed</a> Backend Task
</p>
