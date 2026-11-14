# CareFlow: Home Healthcare Nurse & Pharmacy Dispatch

A full-stack workflow automation application built on **Camunda 8.8**, **Spring Boot 3.5**, **React 18** and **PostgreSQL 17**.

When a patient is discharged after surgery, the system runs a **seven-day post-operative home-care plan**. The plan covers:
- daily visiting-nurse assessments
- physiotherapy sessions
- prescription fulfilment and medicine deliveries
- family notifications by e-mail and SMS
- readmission-risk detection with escalation to a doctor

*Enterprise inspiration: Cigna home-health coordination.*

> **Clinical disclaimer.** The risk flags are a workflow-support tool. They use configurable demonstration thresholds and are not a clinical diagnosis. Every clinical decision is made by a qualified professional in a user task.

---

## 1. Contents

| Folder | What it holds |
|---|---|
| `bpmn-models/` | `main-home-healthcare.bpmn`, `pharmacy-prescription-fulfillment.bpmn` and 7 Camunda Forms in `forms/` |
| `backend-springboot/` | REST API, JPA entities, repositories, services, 34 typed Zeebe `@JobWorker`s, Flyway migrations, tests, `Dockerfile` |
| `frontend-react/` | React + Vite + Tailwind portal: dashboard, custom Tasklist, live process tracker, dynamic array builders, `Dockerfile` |
| `docker-compose.yml` | PostgreSQL + backend + frontend, with an optional Camunda 8.8 profile |
| `tools/` | `build_bpmn.py` (generates the models), `deploy.js`, `run-scenarios.js` (end-to-end tests), `make-demo-cases.js` |
| `scripts/` | Windows start scripts for Camunda 8 Run, the backend and the frontend |
| `documentation/` | Technical report (DOCX/PDF), diagrams, screenshots, test evidence |

## 2. Technology stack

| Layer | Technology | Version |
|---|---|---|
| Workflow engine | Camunda 8 Run (Zeebe, Operate, Tasklist, Connectors) | 8.8.32 (connectors 8.8.15) |
| Modelling | BPMN 2.0, FEEL, Camunda Forms, Camunda Modeler | 5.50 |
| Backend | Java 21, Spring Boot, `camunda-spring-boot-starter`, Spring Data JPA / Hibernate, Flyway, Bean Validation | Boot 3.5.6, starter 8.8.32 |
| Database | PostgreSQL (H2 in PostgreSQL mode for unit tests only) | 17.12 |
| Frontend | React, Vite, Tailwind CSS, React Router, Vitest + Testing Library | 18.3 / 6.4 / 4.3 |
| Packaging | Docker, Docker Compose (multi-stage images) | |

Only Camunda 8 APIs are used: Zeebe job workers and the Orchestration Cluster REST API (`/v2`). There is no Camunda 7 code.

## 3. Architecture

```text
 React portal (5173 / 3000)
    |  REST + JSON (/api)
    v
 Spring Boot backend (8090) -------> PostgreSQL 17 (patients, plans, visits, deliveries, interventions, notifications)
    |  CamundaClient: start instance, complete task, publish message          ^
    |  REST /v2 search: tasks, element instances, incidents, variables       | JPA
    v                                                                         |
 Camunda 8.8: Zeebe (26500), Operate, Tasklist, REST (8080) <-- job workers --+  (34 @JobWorker types run inside the backend)
    |
    +--> Connector runtime (8086)
           - REST connector -> Google Distance Matrix (mock or live)
           - REST connector -> SMS gateway (mock or live)
           - Email connector -> SMTP (embedded demo server or real relay)
```

### Processes

**Main process `home-healthcare-dispatch`**

1. Validate discharge. If invalid, a coordinator corrects the details and validation runs again.
2. Generate the 7-day care plan.
3. Retrieve available nurses. If none are found, a timer retries up to 3 times, then a coordinator assigns one manually.
4. Get travel times with the **Google Distance Matrix REST connector**, then select the nearest suitable nurse.
   - If the API fails or returns an unusable response, a straight-line fallback ranks the nurses.
   - If nobody can reach the patient in time, the `NO_SUITABLE_NURSE` error routes to manual assignment.
5. Assign the nurse.
6. **E-mail connector** to the family. If the e-mail fails, an **SMS fallback** is sent; if that also fails, the failure is recorded.
7. A **parallel gateway** starts three care tracks:
   - **Daily visits.** A **sequential multi-instance** sub-process runs once per day over `carePlanDays`. It schedules the visit, then the nurse's health-assessment user task runs (a **timer boundary** records a missed visit). Next comes a completed/incomplete gateway, then risk evaluation, then a risk-level gateway.
     - For ELEVATED or CRITICAL risk, the **Readmission Risk Intervention sub-process** runs. It has an **error boundary** (`EMERGENCY_DISPATCH_FAILED`) and a **timer boundary** (intervention timeout).
     - CRITICAL: urgent response plus an SMS alert.
     - ELEVATED: doctor review, with a non-interrupting reminder timer. The doctor chooses home care, urgent visit or readmission.
   - **Physiotherapy.** A **parallel multi-instance** sub-process runs over `physioSessions`: book, then record the session, with a timer for missed appointments.
   - **Pharmacy.** A **parallel multi-instance call activity** runs over `prescriptions` and calls the child process.
8. Join the three tracks.
9. Verify plan completion. If there are gaps, a coordinator reviews them.
10. Send the final e-mail, then close the plan.

**Child process `pharmacy-prescription-fulfillment`** (reusable, called once per prescription)

1. Verify the prescription. If it is rejected, the doctor is notified.
2. Check stock. If it is out of stock, source it from a partner pharmacy; if no pharmacy has it, mark it UNAVAILABLE.
3. Dispatch a courier. The `COURIER_UNAVAILABLE` error routes to DELAYED.
4. A **receive task** waits for the `MedicationDelivered` message, correlated by `deliveryRef`.
   - A non-interrupting timer sends a delay SMS.
   - An interrupting timer marks the delivery FAILED.
5. Record the delivery, then send an SMS that the medicine was delivered.

## 4. Running locally (Windows, as developed)

**Prerequisites:** Java 21, Node 18+, PostgreSQL 17, and Camunda 8 Run 8.8 (the `c8run` folder).

```bash
cp .env.example .env          # set DB_PASSWORD, SMTP_PASSWORD, SMS_API_KEY, GOOGLE_MAPS_API_KEY
```

```sql
-- once, as the postgres superuser
CREATE ROLE homecare LOGIN PASSWORD '<DB_PASSWORD>';
CREATE DATABASE homecare OWNER homecare;
```

```powershell
# 1. Camunda 8 Run with the connector secrets exported from .env
powershell -ExecutionPolicy Bypass -File scripts\start-camunda.ps1 -C8Run "C:\path\to\c8run-8.8.32"
# 2. Deploy the child process first, then the main process and the forms
node tools\deploy.js
# 3. Backend (Flyway creates the schema and seed data on first start)
powershell -ExecutionPolicy Bypass -File scripts\start-backend.ps1
# 4. Frontend
cd frontend-react; npm install; npm run dev
```

| URL | What |
|---|---|
| http://localhost:5173 | CareFlow portal (Dashboard, Tasklist, Tracker, ...) |
| http://localhost:8090/actuator/health | Backend health (database, Camunda client) |
| http://localhost:8080/operate | Camunda Operate (default c8run login `demo` / `demo`) |
| http://localhost:8080/tasklist | Camunda Tasklist (the same user tasks, rendered from the Camunda Forms) |

### Demo walk-through
1. **Patients**: click *Register patient*, then *Fill sample data*, then *Discharge & start 7-day plan*. Add physiotherapy sessions and prescriptions with the array builders.
2. **Tracker**: watch the nurse assignment, the visits, the pharmacy child instances and the notifications update live.
3. **Tasklist**: pick the nurse and complete the day-1 assessment. Enter pain 7 to trigger the intervention, then pick *Doctor* to decide.
4. **Pharmacy**: click *Confirm delivery*, which publishes the `MedicationDelivered` message.
5. **Demo controls**: switch faults on (Distance API errors, SMTP down, SMS rejected, courier unavailable, emergency dispatch failure, empty or far nurse pool) to show the exception paths live.

## 5. Docker

```bash
cp .env.example .env
docker compose up --build                     # postgres + backend + frontend; uses Camunda 8 Run on the host
docker compose --profile camunda up --build   # also runs Camunda 8.8 + connectors + Elasticsearch in containers (~4 GB RAM)
```

The frontend is served on http://localhost:3000. Nginx proxies `/api` to the backend.

The images are multi-stage: a JDK build stage feeds a JRE runtime image running as a non-root user, and a Node build stage feeds an Nginx image. Health checks on PostgreSQL and the backend control the start-up order.

> Status: the Dockerfiles and Compose file are written. Docker Desktop was installed during development and needs a Windows restart (WSL 2) before `docker compose up` can be run. Container verification is recorded in the report once it has been run.

## 6. Configuration and secrets

All secrets come from environment variables (`.env`, which is git-ignored). Nothing is hard-coded and nothing is stored in the database.

| Variable | Used by | Purpose |
|---|---|---|
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | backend | PostgreSQL connection |
| `CAMUNDA_GRPC_ADDRESS`, `CAMUNDA_REST_ADDRESS` | backend | Zeebe gateway and Orchestration REST API |
| `DISTANCE_MATRIX_URL`, `GOOGLE_MAPS_API_KEY` | connector runtime (`{{secrets.*}}`) | Google Distance Matrix. The demo value points at the backend mock; for live use, set the Google URL and a real key |
| `SMS_GATEWAY_URL`, `SMS_API_KEY` | connector runtime | SMS gateway (Bearer key) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` | connector runtime + backend | SMTP for the Email connector |
| `HOMECARE_DEMO_MODE`, `MAIL_EMBEDDED_SERVER` | backend | Enable the mock providers, the embedded SMTP server and demo timer overrides |
| `TIMER_*` | backend | Default ISO-8601 durations for the BPMN timers |

**Mock / demo mode, clearly separated:** `/mock/google/maps/api/distancematrix/json` returns responses in exactly Google's format; `/mock/sms/messages` is a Twilio-style gateway; GreenMail receives the SMTP mail. Switching to the real providers is a configuration change only. The BPMN models do not change.

## 7. FEEL expression dictionary

| Where | FEEL |
|---|---|
| Gateway *Details valid?* | `=dischargeValid = true` / `=dischargeValid = false` |
| Gateway *Nurses available?* | `=nurseCount > 0`; `=nurseCount = 0 and nurseSearchAttempts < maxNurseSearchAttempts`; `=nurseCount = 0 and nurseSearchAttempts >= maxNurseSearchAttempts` |
| Gateway *Visit completed?* | `=visitStatus = "COMPLETED"` / `=visitStatus = "INCOMPLETE"` |
| Gateway *Risk level?* | `=riskLevel = "NORMAL"` / `=riskLevel = "ELEVATED" or riskLevel = "CRITICAL"` |
| Gateway *Severity?* | `=riskLevel = "CRITICAL"` / `=riskLevel = "ELEVATED"` |
| Gateway *Doctor decision?* | `=doctorDecision = "READMIT"` / `=doctorDecision = "HOME_CARE" or doctorDecision = "URGENT_VISIT"` |
| Gateway *Plan complete?* | `=planOutcome = "COMPLETED"` / `=planOutcome = "COMPLETED_WITH_GAPS"` |
| Child gateways | `=rxValid = true/false`, `=stockStatus = "IN_STOCK"/"OUT_OF_STOCK"`, `=partnerFound = true/false` |
| Sequential MI (visits) | collection `=carePlanDays`, element `careDay`, output `visitResults` ← `={day: careDay.day, date: careDay.date, visitId: visitId, visitStatus: visitStatus, riskLevel: riskLevel, interventionStatus: interventionStatus}` |
| Parallel MI (physio) | collection `=physioSessions`, element `session`, output `physioResults` ← `={sessionNo: session.sessionNo, dayNumber: session.dayNumber, appointmentId: appointmentId, status: physioStatus}` |
| Parallel MI call activity | collection `=prescriptions`, element `prescription`, output `pharmacyResults` ← `={prescriptionId: prescription.prescriptionId, medication: prescription.medication, status: fulfillmentStatus, deliveryRef: deliveryRef, note: fulfillmentNote}` |
| Distance Matrix query | `={origins: patientLocation, destinations: nurseDestinations, key: "{{secrets.GOOGLE_MAPS_API_KEY}}", mode: "driving"}` |
| Distance Matrix result / error | `={distanceMatrix: response.body, distanceSource: "DISTANCE_MATRIX_API"}`; `=if is defined(error) then bpmnError("DISTANCE_API_ERROR", "Distance Matrix call failed: " + error.message) else null` |
| SMS body | `={to: familyPhone, category: "CRITICAL_ALERT", message: "URGENT: " + patientName + " needs urgent clinical attention..."}` |
| Timers | `=visitWindow`, `=physioWindow`, `=doctorReviewReminder`, `=interventionTimeout`, `=deliveryReminder`, `=deliveryTimeout`, `=nurseRetryWait` (ISO-8601 durations set at start) |
| Message correlation | `MedicationDelivered`, correlation key `=deliveryRef` |
| MI local scope | input mappings `=null` → `visitStatus`, `riskLevel`, ... so that parallel and sequential instances never overwrite each other |

## 8. REST API (backend, port 8090)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/patients` | Register a patient (validated, 409 on duplicate MRN) |
| GET | `/api/patients`, `/api/patients/{id}` | List / get patients |
| POST | `/api/patients/{id}/discharge` | Record the discharge, prescriptions and physio plan, and **start the workflow** (201) |
| GET | `/api/workflows` | Workflow instances with stage and status |
| GET | `/api/workflows/{processInstanceKey}/status` | **Live tracker**: engine state, active steps, incidents, visits, deliveries, interventions |
| GET | `/api/nurses`, `/api/nurses/assignments` | Nurse availability and assignments (distance, travel time, source) |
| PATCH | `/api/nurses/{id}/availability` | Set availability |
| GET / PATCH | `/api/visits`, `/api/visits/{id}/status` | Seven-day visit schedule / coordinator correction |
| GET | `/api/assessments` | Health assessments with risk level |
| GET / PATCH | `/api/physio`, `/api/physio/{id}` | Physiotherapy appointments / reschedule |
| GET | `/api/prescriptions`, `/api/deliveries`, `/api/pharmacy/stock` | Pharmacy tracking |
| POST | `/api/deliveries/{deliveryRef}/confirm` | Courier confirmation: publishes the `MedicationDelivered` message |
| GET | `/api/alerts`, `/api/notifications`, `/api/interventions` | Alerts, notification log, risk interventions |
| GET | `/api/tasks?assignee=&candidateGroup=&processInstanceKey=` | **Custom Tasklist**: open user tasks from Camunda |
| GET | `/api/tasks/{key}` | Task details and context variables |
| POST | `/api/tasks/{key}/claim`, `/api/tasks/{key}/complete` | Claim / complete with validated variables |
| GET | `/api/dashboard` | KPIs |
| GET / POST | `/api/demo/faults`, `/api/demo/faults/reset` | Demo fault injection |

Errors always have the same shape: `{timestamp, status, error, message, path, details[]}`.

## 9. Testing

| Suite | Command | Result |
|---|---|---|
| Backend unit, web and JPA tests (JUnit 5, MockMvc, H2 + Flyway) | `cd backend-springboot && ./mvnw test` | **23 / 23 passed** |
| Frontend tests (Vitest + Testing Library) | `cd frontend-react && npm test` | **50 / 50 passed** |
| End-to-end scenarios against the running stack | `node tools/run-scenarios.js` | **15 / 15 passed** |

The end-to-end scenarios are listed in [`documentation/evidence/scenario-results.md`](documentation/evidence/scenario-results.md). They cover the happy path, both multi-instance modes, the call activity, high-pain and infection risk, readmission, every error and timer boundary, Distance Matrix failures (HTTP 500 and in-body error), notification failure, pharmacy rejection, partner and unavailable stock, courier failure, and discharge correction.

## 10. Team

| Name | Register number | Role |
|---|---|---|
| [Student Name] | [Register Number] | [Role] |
| [Student Name] | [Register Number] | [Role] |

SRM Institute of Science and Technology, 21CSE735P Workflow Automation Engineering.
