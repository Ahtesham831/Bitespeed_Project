# Bitespeed Identity Reconciliation

A production-ready backend service for customer identity reconciliation. Built with **Node.js**, **Express.js**, **Prisma ORM**, and **MySQL**.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Database
Update the `.env` file with your PostgreSQL connection string:
```
DATABASE_URL="postgresql://postgres:password@localhost:5432/bitespeed"
PORT=3000
```

### 3. Run Database Migration
```bash
npx prisma migrate dev --name init
```

### 4. Generate Prisma Client
```bash
npx prisma generate
```

### 5. Start Server
```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

### 6. Open Frontend
Navigate to `http://localhost:3000` in your browser.

## 📡 API

### `POST /identify`

**Request:**
```json
{
  "email": "user@example.com",
  "phoneNumber": "1234567890"
}
```

**Response:**
```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["user@example.com"],
    "phoneNumbers": ["1234567890"],
    "secondaryContactIds": []
  }
}
```

### `GET /health`
Returns server health status.

## 🧪 Tests
```bash
npm test
```

## 📁 Project Structure
```
├── src/
│   ├── config/database.js         # Prisma client singleton
│   ├── models/contact.model.js    # Data access layer
│   ├── services/identity.service.js  # Core business logic
│   ├── controllers/identity.controller.js  # HTTP handler
│   ├── routes/identity.routes.js  # Express routes
│   ├── middlewares/               # Validation & error handling
│   ├── public/index.html          # Frontend UI
│   ├── app.js                     # Express app setup
│   └── server.js                  # Entry point
├── tests/identity.test.js         # Jest test suite
├── prisma/schema.prisma           # Database schema
└── package.json
```
