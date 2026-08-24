# Technical decisions and rationale

This document explains the main technology choices in the Appointment Care project and why they were selected for a healthcare appointment system.

## 1. FastAPI for the backend

Why it was chosen:
- High-speed Python API development with native async support
- Built-in OpenAPI docs and clean route organization
- Works naturally with dependency-based auth and role validation
- Matches the need for a service-oriented healthcare workflow API

Why it fits the project:
- Patient, doctor, admin, and calendar endpoints all benefit from clear path grouping and validation models
- Pydantic request/response schemas reduce validation bugs and make API contracts explicit

## 2. Beanie + MongoDB for the data layer

Why it was chosen:
- MongoDB is schema-flexible and suitable for document-oriented healthcare records
- Beanie provides async document models consistent with FastAPI’s async design
- Index definitions can be part of the model layer, ensuring the required unique constraints are preserved
- The app includes explicit startup initialization so the Beanie document models attach to the configured MongoDB database

Why it fits the project:
- Appointment records, doctor profiles, symptom forms, visit notes, and reminder documents are naturally document-based
- Unique indexes support doctor-slot uniqueness and user email integrity
- The configured `MONGODB_URI` and `MONGODB_DATABASE_NAME` values keep the code and environment configuration aligned

## 3. JWT-based authentication and role enforcement

Why it was chosen:
- JWT is lightweight and works cleanly for stateless API authentication
- Short-lived access tokens reduce session risk
- Refresh tokens allow controlled re-authentication without forcing full login on every interaction

Why it fits the project:
- Patient and doctor workflows are separated by role
- The project uses dependency guards so the backend enforces identity and permission from trusted server-side claims rather than client-provided data

## 4. bcrypt via passlib for password hashing

Why it was chosen:
- bcrypt is well-established and intentionally slow, which is desirable for password hashing
- It prevents storing raw user passwords in the database

Why it fits the project:
- Healthcare systems must treat patient and clinician identities as sensitive
- Hashing reduces the blast radius of any database compromise

## 5. Separate Google Calendar OAuth flow from app account auth

Why it was chosen:
- Google OAuth is an external identity integration, not the same as application login
- The prompt required a distinct Google Calendar account linking flow
- Calendar access tokens must be stored separately and with explicit lifecycle handling

Why it fits the project:
- It avoids coupling patient/doctor app auth with third-party calendar authorization
- It keeps sensitive Google credentials isolated and encrypted

## 6. Encrypted storage for Google tokens

Why it was chosen:
- OAuth access and refresh tokens are sensitive credentials
- They must not be stored in plaintext in the database

Why it fits the project:
- A healthcare application often deals with personal scheduling data and linked calendar events
- Encryption reduces risk if the data store is exposed

## 7. SendGrid for email delivery

Why it was chosen:
- A reliable provider with a simple HTTP API and strong email delivery support
- Easy to integrate with background retry logic

Why it fits the project:
- The appointment system needs booking confirmations, cancellations, and reminder emails
- It decouples email sending from API request handling so the main request path stays responsive

## 8. Celery + Redis for asynchronous jobs

Why it was chosen:
- Medication reminders and retry loops are time-driven background tasks
- Celery is the standard Python worker system for queue-based execution
- Redis is a common and lightweight broker/backend for this style of tasking

Why it fits the project:
- Reminder schedules should not block the API
- Failed notifications can be retried without synchronous user interaction

## 9. Notification log model and retry handling

Why it was chosen:
- A durable notification log is important for observability and recovery
- The system can re-attempt delivery after temporary failures without losing the event

Why it fits the project:
- Healthcare communications need auditability and resilience
- Notification delivery is not always guaranteed; having explicit log state enables retry tracking

## 10. Design system centered on healthcare clarity and calm UI

Why it was chosen:
- A healthcare application needs a reassuring, professional appearance
- Soft colors, rounded cards, and clear calls to action support trust and reduce cognitive load

Why it fits the project:
- The admin, patient, and doctor portals all need quick visual scanning of appointment and patient status
- The design language is intentionally simple enough to remain usable under high-stress clinical contexts

## 11. Portal-based product structure

Why it was chosen:
- Different user roles have fundamentally different tasks
- A role-based portal approach improves clarity and keeps each UI surface focused

Why it fits the project:
- Patients need booking and symptom intake
- Doctors need queue and notes
- Admins need doctor and leave-day oversight

## 12. Validation-first implementation strategy

Why it was chosen:
- The project was built incrementally to keep risk contained and reduce debug churn
- Backend compile checks were used to validate each stage as it was added

Why it fits the project:
- The system contains several domain boundaries (auth, patient portal, doctor portal, integrations, jobs)
- Incremental validation makes it easier to detect interface issues before moving forward

## 13. Decision to keep staging explicit and delay non-core features when appropriate

Why it was chosen:
- Some production concerns like live provider credentials, deployment configuration, and end-to-end environment specifics are external to the code itself
- The build intentionally prioritizes the core workflow before finishing operational scaffolding

Why it fits the project:
- This keeps the project structured and avoids premature configuration issues
- The remaining documentation and environment setup remain explicit and ready for production deployment

## 14. Why the code is organized into domain services

Why it was chosen:
- Service modules isolate rules such as patient booking, doctor management, notifications, and Google Calendar lifecycle
- The API layer stays focused on request handling instead of business logic

Why it fits the project:
- Large healthcare systems benefit from clear boundaries between domain logic and transport concerns
- It makes future testing and extension easier

## 15. Why medical scheduling logic is modeled at the domain level

Why it was chosen:
- Scheduling integrity is a core responsibility of the platform
- Doctor, slot, leave-day, and appointment status logic must be enforced server-side

Why it fits the project:
- Booking collisions, leave-day cancellations, and appointment state transitions are business-critical and should not be based on trust in frontend code
