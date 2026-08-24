# CareConnect

CareConnect is a healthcare appointment and follow-up management platform for patients, doctors, and administrators. It supports booking workflows, symptom intake, doctor notes, leave-day management, Google Calendar linking, and reminder jobs.

## Architecture

- Backend: FastAPI + Beanie + MongoDB
- Authentication: JWT access/refresh tokens with role enforcement
- Frontend: Next.js/Tailwind UI pages for admin, patient, and doctor portals
- Background jobs: Celery + Redis for medication reminders and retry processing
- Integrations: Google Calendar OAuth + Gmail SMTP email delivery

## Core features

- Patient self-registration and sign-in
- Doctor browsing and appointment slot search
- Hold and confirm appointment flow
- Symptom intake and AI-assisted pre-visit summary
- Doctor queue and visit record capture
- Prescription and post-visit summary workflow
- Admin doctor management and leave-day cancellation logic
- Calendar sync and notification dispatch for booking updates

## Local setup

### 1. Create environment file

Copy the example file into the backend project folder so the app reads it as `backend/.env`:

```bash
cp .env.example backend/.env
```

Then update values for your MongoDB, Google OAuth, SendGrid, and Redis settings.

### 2. Create and activate a Python virtual environment

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Run the API server

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Run the Celery worker and scheduler

```bash
cd backend
celery -A app.celery_app worker -l info
celery -A app.celery_app beat -l info
```

### 5. Run the frontend

Use your standard Next.js app setup in the frontend workspace, then start the UI:

```bash
cd frontend
npm install
npm run dev
```

## Required environment variables

The project expects the following values in `backend/.env`:

- `MONGODB_URI`: MongoDB connection string for Beanie document storage
- `MONGODB_DATABASE_NAME`: MongoDB database name for Appointment Care data
- `JWT_SECRET_KEY`: signing secret for access and refresh tokens
- `JWT_ALGORITHM`: token algorithm, default `HS256`
- `ACCESS_TOKEN_EXP_MINUTES`: access token lifetime
- `REFRESH_TOKEN_EXP_DAYS`: refresh token lifetime
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `GOOGLE_REDIRECT_URI`: OAuth callback URL
- `GOOGLE_TOKEN_ENCRYPTION_SECRET`: encryption key for stored Google tokens
- `GMAIL_ADDRESS`: Your Gmail email address
- `GMAIL_APP_PASSWORD`: 16-character Google App Password (generated via Google Account -> Security -> App Passwords)
- `CELERY_BROKER_URL`: Redis broker URL
- `CELERY_RESULT_BACKEND`: Redis result backend URL

## Security notes

- Passwords are hashed with bcrypt.
- Access and refresh tokens are JWT-based and role-aware.
- Role checks are enforced by FastAPI dependencies rather than client trust.
- Google OAuth refresh/access tokens are encrypted before storage.
- OAuth state tokens are signed to prevent tampering.

## Deployment and operational notes

- MongoDB should be hosted and reachable from the backend service.
- Redis should be available for Celery task scheduling and worker execution.
- Gmail SMTP and Google OAuth credentials should be set in a production-safe secret manager or environment store.
- Notification logs and medication reminder rows are designed to support retries and auditability.

## Project structure

- `backend/app/models`: Beanie documents and indexes
- `backend/app/services`: business logic for auth, patient, doctor, admin, calendar, notifications, and scheduler tasks
- `backend/app/api/routes`: API endpoints grouped by domain
- `backend/app/schemas`: request/response validation models
- `frontend/app`: portal screens
- `frontend/components/ui`: shared UI primitives
   