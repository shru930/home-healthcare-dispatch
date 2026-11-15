<div align="center">

# CareFlow: Home Healthcare Nurse & Pharmacy Dispatch

**A Camunda 8 workflow automation platform for seven-day post-operative home care**

Camunda 8.8 (Zeebe) · Spring Boot 3.5 · React 18 · PostgreSQL 17 · Docker

`2 executable BPMN processes` · `7 Camunda Forms` · `32 typed job workers` · `7 outbound connector tasks` · `23 + 50 unit tests` · `15 / 15 end-to-end scenarios passing`

</div>

---

> **Every screenshot and diagram in this README comes from the running system.**
> - The coloured execution-path diagrams are drawn from real process-instance data that Camunda returns through `/v2/element-instances` (the same data Operate uses).
> - The Operate and portal screenshots were captured from the live stack by [`tools/capture-screenshots.js`](tools/capture-screenshots.js).
> - The process-instance keys in the captions can be opened in Operate.

> **Clinical disclaimer.** The readmission-risk flags are a *workflow-support* tool. They use configurable demonstration thresholds and are **not a clinical diagnosis**. A qualified clinician makes every clinical decision in a user task.

## Table of contents
1. [Business problem](#1-business-problem)
2. [Solution overview](#2-solution-overview)
3. [How the rubric is covered](#3-how-the-rubric-is-covered)
4. [System architecture](#4-system-architecture)
5. [BPMN process architecture: element-by-element walkthrough](#5-bpmn-process-architecture)
6. [Mandatory constructs in detail](#6-mandatory-constructs-in-detail)
7. [Failure handling and exception architecture](#7-failure-handling-and-exception-architecture)
8. [Data contracts, variable scoping and FEEL dictionary](#8-data-contracts-variable-scoping-and-feel-dictionary)
9. [Spring Boot backend](#9-spring-boot-backend)
10. [Database](#10-database)
11. [React portal (with screenshots)](#11-react-portal)
12. [Execution evidence: every path, proven](#12-execution-evidence)
13. [Testing](#13-testing)
14. [Running the project](#14-running-the-project)
15. [Docker deployment](#15-docker-deployment)
16. [Configuration and secrets](#16-configuration-and-secrets)
17. [Repository structure](#17-repository-structure)
18. [Team](#18-team)

---

## 1. Business problem

*Enterprise inspiration: **Cigna** home-health coordination.*

After surgery, a patient goes home with a **seven-day post-operative plan**:
- a nurse visit every day
- physiotherapy on some days
- several medicines to be dispensed and delivered
- family members who need to know what is happening

Hospitals usually coordinate all of this by phone and spreadsheet. That causes four problems:

| Problem | Consequence |
|---|---|
| Nurses are assigned by hand, without travel data | Long travel times and late first visits |
| Visits, physiotherapy and deliveries are tracked in different places | Missed visits and undelivered medicines go unnoticed |
| Pain or wound-infection signs reported by the nurse are not escalated reliably | Avoidable **hospital readmissions** |
| Families are not informed | Anxiety, repeated phone calls, missed hand-overs |

## 2. Solution overview

CareFlow automates the whole seven-day plan with **Camunda 8**:

1. A coordinator registers the patient and records the discharge in the **React portal**. The discharge includes physiotherapy sessions and prescriptions, entered with dynamic array builders.
2. The **main BPMN process** validates the data and generates the 7-day plan. It then picks the **nearest suitable nurse** using the **Google Distance Matrix REST connector**, and notifies the family through the **Email connector**, with an SMS fallback.
3. Three care tracks run **in parallel**:
   - **Daily visits**: a *sequential* multi-instance over 7 days. On each day the nurse submits a health assessment in the **custom Tasklist**.
   - **Physiotherapy**: a *parallel* multi-instance.
   - **Pharmacy**: a *parallel multi-instance call activity* to the reusable **Pharmacy Prescription Fulfillment** process.
4. If the nurse reports high pain or infection indicators, the **Readmission Risk Intervention sub-process** escalates to a doctor or dispatches an urgent response. Its **error and timer boundary events** guarantee that someone always acts.
5. At the end the plan is verified, gaps are reviewed by a coordinator, and the family receives a final status e-mail.

Every step is visible live in the portal's **process tracker** and in **Camunda Operate**.

## 3. How the rubric is covered

### Milestone 1: BPMN design and architecture (25 marks)

| Criterion | Where it is implemented | Proof |
|---|---|---|
| **BPMN 2.0 executability (5)** | [`main-home-healthcare.bpmn`](bpmn-models/main-home-healthcare.bpmn), [`pharmacy-prescription-fulfillment.bpmn`](bpmn-models/pharmacy-prescription-fulfillment.bpmn); every gateway branch has a FEEL condition, with no dead ends | Deployed to Camunda 8.8 ([deployment log](documentation/evidence/deployment-log.txt)); 15/15 scenarios executed |
| **Mandatory constructs (10)** | Sequential MI `Sub_DailyVisit`; parallel MI `Sub_Physio`; parallel MI **call activity** `Call_Pharmacy`; **sub-process** `Sub_RiskIntervention` with **error** and **timer** boundary events; 7 error boundaries, 5 timer boundaries, 1 intermediate timer, 1 message receive task | [§6](#6-mandatory-constructs-in-detail), [§12](#12-execution-evidence) |
| **Connectors and FEEL (5)** | REST connector (Google Distance Matrix, SMS gateway), **Email connector** (SMTP); secrets via `{{secrets.*}}`; FEEL in conditions, mappings, result and error expressions | [§6.4](#64-outbound-connectors), [§8.4](#84-feel-expression-dictionary) |
| **Data contract and scoping (5)** | Input/output mappings on every task; MI `inputElement`/`outputElement`/`outputCollection`; call activity with `propagateAllParentVariables="false"` and explicit mappings; local MI variables via `=null` input mappings | [§8](#8-data-contracts-variable-scoping-and-feel-dictionary) |

### Milestone 2: Full-stack integration and deployment (25 marks)

| Criterion | Where it is implemented | Proof |
|---|---|---|
| **Spring Boot and job workers (8)** | 10 REST controllers, JPA + **PostgreSQL**, **32 strongly typed `@JobWorker`s**, `ZeebeBpmnError` for 5 business errors | [§9](#9-spring-boot-backend), 23/23 JUnit tests |
| **React portal (8)** | **Dynamic array builders** for the MI collections, **custom Tasklist inbox** with 7 task-specific forms, **live process tracker** | [§11](#11-react-portal), 50/50 Vitest tests |
| **Camunda 8 engine integration (5)** | React → REST → Spring Boot → Zeebe (CamundaClient commands) and the Camunda REST `/v2` task and search APIs; message correlation for deliveries | [§4](#4-system-architecture), [§12](#12-execution-evidence) |
| **Docker packaging (4)** | Multi-stage backend and frontend Dockerfiles, root `docker-compose.yml` with PostgreSQL, health checks and an optional Camunda profile | [§15](#15-docker-deployment) |

---

## 4. System architecture

```mermaid
flowchart LR
    subgraph Browser
      UI["React 18 + Vite + Tailwind<br/>CareFlow portal :5173 / :3000"]
    end
    subgraph Backend["Spring Boot 3.5 backend :8090"]
      API["REST controllers<br/>DTO + Bean Validation"]
      SVC["Services<br/>Patient · Workflow · Care · Pharmacy · Task · Notification"]
      WRK["32 typed @JobWorker<br/>hh.* and rx.*"]
      MOCK["Demo providers<br/>Distance Matrix mock · SMS gateway mock · GreenMail SMTP"]
      REPO["Spring Data JPA repositories"]
    end
    DB[("PostgreSQL 17<br/>13 tables, Flyway")]
    subgraph Camunda["Camunda 8.8 (c8run)"]
      ZB["Zeebe engine :26500"]
      REST["Orchestration REST API /v2 :8080"]
      OP["Operate / Tasklist"]
      CON["Connector runtime :8086<br/>REST + Email connectors"]
    end
    UI -- "JSON /api" --> API
    API --> SVC --> REPO --> DB
    SVC -- "start instance · complete task · publish message" --> ZB
    SVC -- "search tasks, element instances, incidents" --> REST
    ZB -- "jobs (gRPC streaming)" --> WRK
    WRK --> SVC
    ZB -- "connector jobs" --> CON
    CON -- "HTTP {{secrets.DISTANCE_MATRIX_URL}}" --> MOCK
    CON -- "HTTP {{secrets.SMS_GATEWAY_URL}}" --> MOCK
    CON -- "SMTP {{secrets.SMTP_HOST}}" --> MOCK
    ZB --> OP
```

**Layered design.**
- The **presentation** layer (React) only talks to the **API** layer.
- **Controllers** validate DTOs and delegate to **services**.
- **Services** hold the business rules and the transactions.
- **Repositories** do the persistence.
- **Workers** are thin adapters that receive typed variables from Zeebe, call services, and return typed results or throw `ZeebeBpmnError`.
- External integrations are **Camunda outbound connectors**, configured in the BPMN model and not hidden in Java.

**Communication flows**

| From → to | Mechanism | Example |
|---|---|---|
| React → Spring Boot | REST/JSON over `/api`, proxied by Vite (dev) or nginx (Docker) | `POST /api/patients/{id}/discharge` |
| Spring Boot → Zeebe | `CamundaClient` (gRPC / REST) commands | `newCreateInstanceCommand()`, `newCompleteUserTaskCommand()`, `newPublishMessageCommand()` |
| Spring Boot → Camunda read side | Orchestration Cluster REST API `/v2/*/search` | user tasks, task variables, element instances, incidents for the tracker |
| Zeebe → Spring Boot | Job workers (`@JobWorker`, job streaming) | `hh.match-nurse`, `rx.dispatch-delivery` |
| Zeebe → external services | Connector runtime, outbound connectors | `io.camunda:http-json:1`, `io.camunda:email:1` |
| External → Zeebe | Message correlation | courier confirms → `MedicationDelivered` (correlation key `deliveryRef`) |

---

## 5. BPMN process architecture

### 5.1 Main process: `home-healthcare-dispatch`

![Main BPMN process](documentation/diagrams/main-home-healthcare.png)
*Figure 5.1: Main process, rendered from [`bpmn-models/main-home-healthcare.bpmn`](bpmn-models/main-home-healthcare.bpmn).*

The process has four phases.

#### Phase A: intake and nurse dispatch

| # | Element (ID) | Type | What happens | Implementation |
|---|---|---|---|---|
| 1 | Patient discharged (`Start_Discharged`) | Start event | Started by `POST /api/patients/{id}/discharge` with the start payload (§8.2) | `WorkflowService.start` |
| 2 | Validate discharge details (`Task_ValidateDischarge`) | Service task | Checks phone numbers, family e-mail, location, the discharge date (no more than 14 days old) and at least one prescription | worker `hh.validate-discharge` |
| 3 | Details valid? (`Gw_DischargeValid`) | Exclusive gateway | `=dischargeValid = true` → continue; `=dischargeValid = false` → correction | FEEL |
| 4 | Correct discharge details (`Task_CorrectDischarge`) | **User task** (coordinators) | Coordinator fixes the data in the Tasklist, then the flow loops back to validation | form `correct-discharge-form` |
| 5 | Generate 7-day care plan (`Task_GenerateCarePlan`) | Service task | Persists `HomeCarePlan`, builds `carePlanDays` (7 items) and numbers the `physioSessions` | worker `hh.generate-care-plan` |
| 6 | Retrieve available nurses (`Task_FetchNurses`) | Service task | Nurses with the required skill and spare capacity → `candidateNurses`, `nurseDestinations` | worker `hh.fetch-available-nurses` |
| 7 | Nurses found? (`Gw_NursesFound`) | Exclusive gateway | Found → distance; none and fewer than 3 attempts → **timer** `Timer_NurseRetry` (`=nurseRetryWait`) → retry; none after 3 attempts → manual | FEEL |
| 8 | Get travel times (`Task_DistanceMatrix`) | **REST connector** | `GET {{secrets.DISTANCE_MATRIX_URL}}`, Google Distance Matrix format | `io.camunda:http-json:1` |
| 9 | Rank nurses by straight-line distance (`Task_FallbackDistance`) | Service task | Fallback when the API fails (`Err_DistanceApi`) or returns an unusable body (`Err_DistanceInvalid`) | worker `hh.rank-nurses-fallback` |
| 10 | Select nearest suitable nurse (`Task_MatchNurse`) | Service task | Shortest travel time within `maxTravelMinutes`. Throws `NO_SUITABLE_NURSE` or `DISTANCE_API_ERROR` | worker `hh.match-nurse` |
| 11 | Arrange nurse manually (`Task_ManualNurse`) | **User task** (coordinators) | Coordinator selects a nurse; the output mapping sets `assignmentMode = "MANUAL"` | form `manual-nurse-form` |
| 12 | Assign nurse (`Task_AssignNurse`) | Service task | Persists `NurseAssignment`, updates the nurse's load, returns `assignedNurse` | worker `hh.assign-nurse` |
| 13 | E-mail family: nurse assigned (`Task_EmailAssignment`) | **Email connector** | SMTP e-mail with the nurse and the 7-day schedule. Failure → `NOTIFICATION_FAILED` | `io.camunda:email:1` |
| 14 | SMS family (fallback) (`Task_SmsAssignment`) | **REST connector** | Bearer-authenticated SMS gateway | `io.camunda:http-json:1` |
| 15 | Record failed notification (`Task_RecordNotifyFailure`) | Service task | Logs the failure and alerts the coordinator to phone the family. **Care continues.** | worker `hh.record-notification-failure` |

#### Phase B: three parallel care tracks

The parallel gateway `Gw_Fork` starts all three tracks; the parallel gateway `Gw_Join` waits for all three.

| Track | Construct | Inner flow |
|---|---|---|
| **Daily visits** | `Sub_DailyVisit`: **sequential multi-instance** over `carePlanDays` | Schedule daily visit → **Home visit and health assessment** (user task, assignee `=assignedNurse.username`, interrupting timer `=visitWindow` → *Record missed visit*) → *Visit completed?* (incomplete → *Record incomplete visit*) → *Evaluate readmission risk* → *Risk level?* (NORMAL → end, ELEVATED or CRITICAL → **Readmission Risk Intervention**) |
| **Physiotherapy** | `Sub_Physio`: **parallel multi-instance** over `physioSessions` | Book appointment → **Record physiotherapy session** (user task, assignee `=physiotherapist`, interrupting timer `=physioWindow` → *Record missed appointment*) → *Save session outcome* |
| **Pharmacy** | `Call_Pharmacy`: **parallel multi-instance call activity** over `prescriptions` | Calls `pharmacy-prescription-fulfillment` once per prescription (§5.2) |

#### Phase C: Readmission Risk Intervention (embedded sub-process `Sub_RiskIntervention`)

| Element | Behaviour |
|---|---|
| Open intervention and alert doctor | Creates a `RiskIntervention` record and an in-app alert for doctors (`hh.open-intervention`) |
| Severity? | `=riskLevel = "CRITICAL"` → **Dispatch urgent response** (`hh.dispatch-emergency`) → **SMS family: critical alert** (REST connector); `=riskLevel = "ELEVATED"` → **Doctor review** (user task, group `doctors`) |
| Reminder (non-interrupting timer on Doctor review, `=doctorReviewReminder`) | Reminds the on-call doctor while the review **stays open** |
| Doctor decision? | `READMIT` → *Arrange hospital readmission*; `HOME_CARE` or `URGENT_VISIT` → close |
| Close intervention | Sets the final `interventionStatus` |
| **Error boundary** `EMERGENCY_DISPATCH_FAILED` | If the urgent-response service rejects the dispatch: **Coordinate emergency manually** (user task) → record the escalation |
| **Timer boundary** `=interventionTimeout` (interrupting) | If nobody resolves the intervention in time, the whole sub-process is cancelled and the case goes to **Escalate to clinical lead** |

#### Phase D: close-out

| Element | Behaviour |
|---|---|
| Verify 7-day plan completion (`hh.verify-plan`) | Counts completed visits, physiotherapy sessions and deliveries → `planOutcome` (`COMPLETED` / `COMPLETED_WITH_GAPS`), `planSummary`, `gapCount` |
| Plan complete? | Gaps → **Coordinator reviews gaps** (user task) |
| E-mail family: final status | Email connector; failure → record it, then still close the plan |
| Close care plan (`hh.complete-workflow`) | Closes the plan, frees the nurse, marks the workflow COMPLETED |

### 5.2 Child process: `pharmacy-prescription-fulfillment` (reusable)

![Pharmacy child process](documentation/diagrams/pharmacy-prescription-fulfillment.png)
*Figure 5.2: Pharmacy Prescription Fulfillment, invoked once per prescription by the call activity `Call_Pharmacy`.*

| Step | Outcome paths |
|---|---|
| **Verify prescription** (`rx.verify-prescription`) | Controlled drug without doctor approval, quantity over 90, or no dosage → **Notify prescribing doctor** → *Prescription rejected* (`fulfillmentStatus = REJECTED`) |
| **Check and reserve stock** (`rx.check-stock`) | In stock at the primary pharmacy → dispatch. Out of stock → **Source from partner pharmacy**; if no partner has it → *Mark unavailable and alert coordinator* (`UNAVAILABLE`) |
| **Dispense and book courier** (`rx.dispatch-delivery`) | Error boundary `COURIER_UNAVAILABLE` → *Reschedule delivery* (`DELAYED`) |
| **Await delivery confirmation** (receive task, message `MedicationDelivered`, key `=deliveryRef`) | Non-interrupting timer `=deliveryReminder` → *SMS family: delivery delayed*; interrupting timer `=deliveryTimeout` → *Mark delivery failed* (`FAILED`) |
| **Record delivery** → **SMS family: medicine delivered** | `fulfillmentStatus = DELIVERED` |

The child returns only `fulfillmentStatus`, `deliveryRef` and `fulfillmentNote` to the parent, through the call activity's output mappings.

---

## 6. Mandatory constructs in detail

### 6.1 Multi-instance activities (both execution modes)

| | `Sub_DailyVisit` | `Sub_Physio` | `Call_Pharmacy` |
|---|---|---|---|
| Execution | **Sequential** (`isSequential="true"`): day 2 only starts after day 1 ends | **Parallel**: all sessions open at the same time | **Parallel**: one child instance per prescription |
| Collection | `=carePlanDays` | `=physioSessions` | `=prescriptions` |
| Element variable | `careDay` | `session` | `prescription` |
| Input mappings (local) | `visitId, visitStatus, painScore, temperature, woundRedness, woundDischarge, swelling, nurseNotes, riskLevel, riskReasons, assessmentId, interventionId, interventionStatus, doctorDecision, doctorNotes, ...` ← `=null` | `appointmentId, physiotherapist, physioStatus, physioNotes` ← `=null` | `workflowId, patientId, patientName, familyPhone, patientAddress, prescription, deliveryReminder, deliveryTimeout`; `fulfillmentStatus, deliveryRef, fulfillmentNote` ← `=null` |
| Output element | `={day: careDay.day, date: careDay.date, visitId: visitId, visitStatus: visitStatus, riskLevel: riskLevel, interventionStatus: interventionStatus}` | `={sessionNo: session.sessionNo, dayNumber: session.dayNumber, appointmentId: appointmentId, status: physioStatus}` | `={prescriptionId: prescription.prescriptionId, medication: prescription.medication, status: fulfillmentStatus, deliveryRef: deliveryRef, note: fulfillmentNote}` |
| Output collection | `visitResults` | `physioResults` | `pharmacyResults` |
| Completion tracking | Each day writes its outcome to `visitResults`; `hh.verify-plan` counts COMPLETED / MISSED / INCOMPLETE | `physioResults`, plus `PhysiotherapyAppointment.status` | `pharmacyResults`, plus `Prescription.status` / `MedicationDelivery.status` |
| Error behaviour | Missed visit (timer) and incomplete visit are **handled per day**, so the loop continues. Risk errors are caught inside by the sub-process boundaries | A missed session is handled per instance and the other sessions continue | Every business failure is an end state of the child, so one bad prescription never stops the others |

**Why the `=null` input mappings matter.** Zeebe propagates variables to the nearest scope where they already exist. Declaring the per-day and per-session variables as **local** to each multi-instance inner instance means:
- the 7 sequential days never overwrite each other's results
- the parallel physiotherapy sessions and pharmacy calls never overwrite each other's results

The proof is in the evidence: each day keeps its own `riskLevel` (§12).

### 6.2 Readmission Risk Intervention sub-process

This is an embedded sub-process inside each day of `Sub_DailyVisit`. It is triggered when the nurse submits a high pain score or infection indicators through the React Tasklist (§11). The rules are demonstration thresholds, configurable in `application.yml` under `homecare.risk.*`:

| Result | Rule (any of) |
|---|---|
| **CRITICAL** | pain ≥ 8 · temperature ≥ 39.0 °C · wound discharge **with** fever ≥ 38.0 °C |
| **ELEVATED** | pain ≥ 6 · fever ≥ 38.0 °C · wound redness · wound discharge · swelling |
| NORMAL | none of the above |

Its boundary events are the **error boundary** `EMERGENCY_DISPATCH_FAILED` and the interrupting **timer boundary** `=interventionTimeout`. A further non-interrupting timer sits on *Doctor review*. Each is proven in §12.

### 6.3 Pharmacy call activity

```xml
<bpmn:callActivity id="Call_Pharmacy" name="Pharmacy fulfilment">
  <zeebe:calledElement processId="pharmacy-prescription-fulfillment"
                       propagateAllChildVariables="false" propagateAllParentVariables="false" />
  <zeebe:ioMapping>
    <zeebe:input source="=prescription" target="prescription" />   <!-- + patient, delivery address, family phone, timers -->
    <zeebe:output source="=fulfillmentStatus" target="fulfillmentStatus" />
    <zeebe:output source="=deliveryRef" target="deliveryRef" />
    <zeebe:output source="=fulfillmentNote" target="fulfillmentNote" />
  </zeebe:ioMapping>
  <bpmn:multiInstanceLoopCharacteristics isSequential="false"> ... inputCollection="=prescriptions" ...
```

With `propagateAllParentVariables="false"`, the child sees **only** the patient, prescription and delivery details it needs. With `propagateAllChildVariables="false"`, only the three result variables come back.

`tools/deploy.js` deploys the child process **before** the main process.

### 6.4 Outbound connectors

| Task | Connector | Configuration |
|---|---|---|
| Get travel times (Google Distance Matrix) | REST `io.camunda:http-json:1` | `GET {{secrets.DISTANCE_MATRIX_URL}}`; query `={origins: patientLocation, destinations: nurseDestinations, key: "{{secrets.GOOGLE_MAPS_API_KEY}}", mode: "driving"}`; result `={distanceMatrix: response.body, distanceSource: "DISTANCE_MATRIX_API"}`; error `=if is defined(error) then bpmnError("DISTANCE_API_ERROR", ...) else null`; retries 3, backoff PT5S |
| E-mail family: nurse assigned / final status | Email `io.camunda:email:1` (SMTP) | `authentication.type = simple` with `{{secrets.SMTP_USERNAME}}` / `{{secrets.SMTP_PASSWORD}}`; host and port `{{secrets.SMTP_HOST}}` / `{{secrets.SMTP_PORT}}`; to `=familyEmail`; FEEL subject and body; error → `NOTIFICATION_FAILED` |
| SMS family (fallback, critical alert, delivery delayed, delivered) | REST `io.camunda:http-json:1` | `POST {{secrets.SMS_GATEWAY_URL}}`, `authentication.type = bearer`, token `{{secrets.SMS_API_KEY}}`, body `={to: familyPhone, category: ..., message: ...}` |

**Mock / demo mode, clearly identified.** No real Google or SMS credentials are available, so the secrets point at endpoints in the backend:
- `/mock/google/maps/api/distancematrix/json` returns **exactly Google's response format**: `rows[].elements[].distance/duration/status`, and `status: OK / OVER_QUERY_LIMIT / REQUEST_DENIED`. It checks the API key.
- `/mock/sms/messages` is a Twilio-style gateway. It checks the Bearer key and returns 201, 401, 422 or 503.
- A GreenMail SMTP server receives the Email connector's mail.

Switching to the real providers is a **configuration change only** (§16). The BPMN models do not change. The connectors themselves are the real Camunda out-of-the-box connectors, running in the Camunda connector runtime.

---

## 7. Failure handling and exception architecture

| # | Failure | Detected by | BPMN handling | Business result | Scenario |
|---|---|---|---|---|---|
| 1 | Invalid discharge data | `hh.validate-discharge` | Gateway → user task *Correct discharge details* → loop | Data corrected, process continues | TC12 |
| 2 | No nurse available | `hh.fetch-available-nurses` | Gateway → **intermediate timer** retry ×3 → user task | Agency nurse assigned manually | TC08 |
| 3 | Distance Matrix HTTP failure (500, timeout) | REST connector `errorExpression` | **Error boundary** `Err_DistanceApi` → straight-line fallback | Nurse still matched | TC15 |
| 4 | Distance Matrix logical failure (HTTP 200 with `OVER_QUERY_LIMIT`, `REQUEST_DENIED`, malformed body) | `hh.match-nurse` → `ZeebeBpmnError("DISTANCE_API_ERROR")` | **Error boundary** `Err_DistanceInvalid` → fallback | Nurse still matched | TC06 |
| 5 | Nobody within the travel limit | `hh.match-nurse` → `ZeebeBpmnError("NO_SUITABLE_NURSE")` | **Error boundary** `Err_NoNurse` → manual assignment | Coordinator assigns | TC07 |
| 6 | E-mail delivery failure | Email connector `errorExpression` | **Error boundary** → SMS fallback | Family still informed | TC09 |
| 7 | SMS also fails | REST connector `errorExpression` | **Error boundary** → *Record failed notification* | Coordinator alerted to phone the family; care continues | TC09 |
| 8 | Missed nurse visit | — | **Timer boundary** (interrupting) `=visitWindow` | Visit MISSED, alert, next day continues | TC05 |
| 9 | Incomplete visit | Nurse selects INCOMPLETE | Gateway → *Record incomplete visit* | Follow-up alert | (UI) |
| 10 | Missed physiotherapy | — | **Timer boundary** `=physioWindow` | Session MISSED, re-book alert | TC05 |
| 11 | Urgent-response service fails | `hh.dispatch-emergency` → `ZeebeBpmnError("EMERGENCY_DISPATCH_FAILED")` | **Error boundary on the sub-process** → manual emergency coordination | Ambulance arranged by phone | TC04 |
| 12 | Doctor slow to review | — | **Non-interrupting timer** → remind on-call doctor | Review stays open | TC02 |
| 13 | Intervention unresolved | — | **Interrupting timer on the sub-process** → clinical lead | Escalated | TC14 |
| 14 | Prescription invalid | `rx.verify-prescription` | Gateway → notify doctor | REJECTED | TC10 |
| 15 | Out of stock everywhere | `rx.check-stock` / `rx.source-partner` | Gateways → mark unavailable | UNAVAILABLE + coordinator alert | TC10 |
| 16 | No courier | `rx.dispatch-delivery` → `ZeebeBpmnError("COURIER_UNAVAILABLE")` | **Error boundary** in the child → reschedule | DELAYED | TC11 |
| 17 | Delivery late / never confirmed | — | **Non-interrupting timer** → SMS; **interrupting timer** → FAILED | Family informed / FAILED | TC10 |
| 18 | Transient technical error (e.g. SMS gateway down during a critical alert) | Connector exception, no BPMN error | **3 retries with PT5S backoff → incident** in Operate, repaired by retrying | No data lost; operator fixes and retries | live case, §12.10 |
| 19 | Gaps at the end of the plan | `hh.verify-plan` | Gateway → coordinator gap review | Documented closure | TC05, TC10, TC11 |

**Design rule.** *Business* failures (an expected outcome such as "no courier") are modelled with **BPMN errors and gateways**. *Technical* failures (an unexpected outage) use **job retries and incidents**, so an operator can fix the cause and resume from Operate. Notification failures never block patient care.

---

## 8. Data contracts, variable scoping and FEEL dictionary

### 8.1 Scoping principles
1. **Process scope (root):** case data that every step needs: patient, family, `assignedNurse`, the plan collections and the timers.
2. **Multi-instance inner scope:** every variable a single day, session or prescription produces is declared local with an `=null` input mapping (§6.1). Only the `outputElement` leaves the loop.
3. **Call activity:** an explicit contract in both directions (`propagateAll*Variables="false"`).
4. **Tasks with input mappings** also declare **output mappings** whenever an output has the same name as an input. This prevents a job result being kept only in the task's local scope. It was a real bug, found and fixed during testing (§13.4).
5. **Error boundaries** carry variables from `ZeebeBpmnError` (for example `nurseDistances` for the manual nurse task).

### 8.2 Initial process start payload (built by `WorkflowService.start`)

```json
{
  "workflowId": 24, "patientId": 24, "patientMrn": "MRN-DEMO-C1", "patientName": "Saraswathi Krishnan",
  "patientPhone": "9840033001", "patientAddress": "18 Temple Street, Guindy, Chennai",
  "patientLat": 13.0102, "patientLng": 80.2157, "patientLocation": "13.0102,80.2157",
  "familyContactName": "Lakshmi Krishnan", "familyEmail": "lakshmi.krishnan@example.com", "familyPhone": "9840033002",
  "surgeryType": "Laparoscopic cholecystectomy", "dischargeDate": "2026-11-14", "hospital": "City General Hospital",
  "doctorName": "Dr. Arvind Menon", "doctorEmail": "arvind.menon@citygeneral.example", "requiredSkill": "WOUND_CARE",
  "physioSessions": [ { "dayNumber": 3, "focus": "Breathing and mobility" } ],
  "prescriptions": [
    { "prescriptionId": 41, "medication": "Paracetamol 500mg", "dosage": "1 tablet every 8 hours", "quantity": 15, "controlled": false, "doctorApproved": true },
    { "prescriptionId": 42, "medication": "Ondansetron 4mg",  "dosage": "1 tablet when nauseous",  "quantity": 6,  "controlled": false, "doctorApproved": true }
  ],
  "visitWindow": "PT10M", "physioWindow": "PT10M", "doctorReviewReminder": "PT2M", "interventionTimeout": "PT15M",
  "deliveryReminder": "PT2M", "deliveryTimeout": "PT30M", "nurseRetryWait": "PT15S",
  "maxTravelMinutes": 60, "maxNurseSearchAttempts": 3
}
```

The timers are short **demonstration** durations, set from `application.yml` and environment variables. A discharge request may override them in demo mode (`timerOverrides`).

**REST request that starts it** (`POST /api/patients/{id}/discharge`):

```json
{
  "surgeryType": "Total knee replacement", "surgeryDate": "2026-11-11", "dischargeDate": "2026-11-14",
  "hospital": "City General Hospital", "doctorName": "Dr. Meera Rao", "doctorEmail": "meera.rao@citygeneral.example",
  "requiredSkill": "WOUND_CARE",
  "physioSessions": [ { "dayNumber": 2, "focus": "Knee mobility" }, { "dayNumber": 4, "focus": "Walking practice" } ],
  "prescriptions": [ { "medication": "Paracetamol 500mg", "dosage": "1 tablet every 8 hours", "quantity": 21, "controlled": false, "doctorApproved": true } ],
  "timerOverrides": { "visitWindow": "PT2H" }
}
```

Response `201 Created`:

```json
{ "workflowId": 26, "processInstanceKey": 2251799813890188, "patientId": 26, "status": "ACTIVE", "currentStage": "Validating discharge details" }
```

### 8.3 Variable dictionary (main variables)

| Variable | Type | Scope | Producer | Consumer | Example |
|---|---|---|---|---|---|
| `patientId`, `workflowId` | number | process | start payload | all workers | `24` |
| `patientLocation` | string | process | start payload | Distance Matrix connector | `"13.0102,80.2157"` |
| `familyEmail`, `familyPhone` | string | process | start / correction task | Email / SMS connectors | `"lakshmi.krishnan@example.com"` |
| `dischargeValid`, `validationErrors` | boolean, list | process | `hh.validate-discharge` | gateway, correction form | `false`, `["Family phone must have 10 digits"]` |
| `carePlanId` | number | process | `hh.generate-care-plan` | visit, physio and plan workers | `24` |
| `carePlanDays` | list of `{day, date, visitType}` | process | `hh.generate-care-plan` | **sequential MI collection** | `[{"day":1,"date":"2026-11-15","visitType":"ADMISSION_ASSESSMENT"}, ...]` |
| `careDay` | object | MI inner | MI input element | visit tasks | `{"day":2,"date":"2026-11-16","visitType":"WOUND_AND_VITALS_CHECK"}` |
| `physioSessions` / `session` | list / object | process / MI inner | discharge + `hh.generate-care-plan` | **parallel MI** | `{"sessionNo":1,"dayNumber":3,"date":"2026-11-17","focus":"Mobility"}` |
| `prescriptions` / `prescription` | list / object | process / MI inner + child | start payload | **call activity MI**, child workers | `{"prescriptionId":41,"medication":"Paracetamol 500mg",...}` |
| `candidateNurses`, `nurseDestinations`, `nurseCount`, `nurseSearchAttempts` | list, string, number, number | process | `hh.fetch-available-nurses` | connector, gateway, matcher | `"13.0067,80.2206\|12.9815,80.218"` |
| `distanceMatrix`, `distanceSource` | object, string | process | REST connector result | `hh.match-nurse` | `{"status":"OK","rows":[...]}`, `"DISTANCE_MATRIX_API"` |
| `nurseDistances` | list | process | matcher / fallback | manual task, audit | `[{"username":"nurse.priya","travelSeconds":71,...}]` |
| `selectedNurseId`, `assignmentMode` | number, string | process | matcher or manual task | `hh.assign-nurse` | `3`, `"AUTO"` |
| `assignedNurse` | `{nurseId, username, fullName, phone}` | process | `hh.assign-nurse` | visit task assignee, SMS | `{"username":"nurse.priya",...}` |
| `visitStatus`, `painScore`, `temperature`, `woundRedness`, `woundDischarge`, `swelling`, `nurseNotes` | mixed | **MI inner (local)** | health-assessment task | gateway, `hh.evaluate-risk` | `"COMPLETED"`, `7`, `38.6`, `true` |
| `riskLevel`, `riskReasons`, `assessmentId` | string, list, number | MI inner | `hh.evaluate-risk` | gateways, intervention | `"ELEVATED"`, `["Pain score 7 >= 6"]` |
| `interventionId`, `interventionStatus`, `doctorDecision` | mixed | MI inner | intervention workers, doctor task | gateways, close | `"RESOLVED_HOME_CARE"` |
| `fulfillmentStatus`, `deliveryRef`, `fulfillmentNote` | string | child → MI inner | child workers | call activity outputs | `"DELIVERED"`, `"DLV-17"` |
| `visitResults`, `physioResults`, `pharmacyResults` | lists | process | MI output collections | `hh.verify-plan`, gap review | `[{"day":1,"visitStatus":"COMPLETED","riskLevel":"NORMAL"}, ...]` |
| `planOutcome`, `planSummary`, `gapCount` | string, string, number | process | `hh.verify-plan` | gateway, final e-mail | `"COMPLETED_WITH_GAPS"`, `"Visits completed 5/7, ..."` |

### 8.4 FEEL expression dictionary

| Purpose | FEEL |
|---|---|
| Discharge valid / invalid | `=dischargeValid = true` · `=dischargeValid = false` |
| Nurse availability (3 branches) | `=nurseCount > 0` · `=nurseCount = 0 and nurseSearchAttempts < maxNurseSearchAttempts` · `=nurseCount = 0 and nurseSearchAttempts >= maxNurseSearchAttempts` |
| Visit outcome | `=visitStatus = "COMPLETED"` · `=visitStatus = "INCOMPLETE"` |
| Risk routing | `=riskLevel = "NORMAL"` · `=riskLevel = "ELEVATED" or riskLevel = "CRITICAL"` |
| Severity | `=riskLevel = "CRITICAL"` · `=riskLevel = "ELEVATED"` |
| Doctor decision | `=doctorDecision = "READMIT"` · `=doctorDecision = "HOME_CARE" or doctorDecision = "URGENT_VISIT"` |
| Plan outcome | `=planOutcome = "COMPLETED"` · `=planOutcome = "COMPLETED_WITH_GAPS"` |
| Child gateways | `=rxValid = true / false` · `=stockStatus = "IN_STOCK" / "OUT_OF_STOCK"` · `=partnerFound = true / false` |
| User-task assignment | `=assignedNurse.username` · `=physiotherapist` · output mapping `="MANUAL"` → `assignmentMode` |
| Timers | `=visitWindow` · `=physioWindow` · `=doctorReviewReminder` · `=interventionTimeout` · `=deliveryReminder` · `=deliveryTimeout` · `=nurseRetryWait` |
| Message correlation | message `MedicationDelivered`, key `=deliveryRef` |
| Connector query | `={origins: patientLocation, destinations: nurseDestinations, key: "{{secrets.GOOGLE_MAPS_API_KEY}}", mode: "driving"}` |
| Connector result | `={distanceMatrix: response.body, distanceSource: "DISTANCE_MATRIX_API"}` · `={smsSid: response.body.sid}` |
| Connector error | `=if is defined(error) then bpmnError("NOTIFICATION_FAILED", "E-mail failed: " + error.message) else null` |
| E-mail subject | `="Home-care nurse assigned for " + patientName` |
| E-mail body (excerpt) | `="Dear " + familyContactName + ",\n\n" + patientName + " is enrolled ... " + string(count(physioSessions)) + " physiotherapy sessions ..."` |
| SMS body | `={to: familyPhone, category: "CRITICAL_ALERT", message: "URGENT: " + patientName + " needs urgent clinical attention..."}` |
| MI output elements | see §6.1 |

---

## 9. Spring Boot backend

**Package layout** (`backend-springboot/src/main/java/com/homecare/dispatch`):

| Package | Contents |
|---|---|
| `web` | `ApiControllers` (10 REST controllers), `Views` (JSON projections), `mock/MockProviders` (Distance Matrix and SMS demo providers) |
| `dto` | `Dtos` (request/response records with Bean Validation), `Payloads` (typed process-variable records: `CareDay`, `PhysioSession`, `PrescriptionItem`, `AssignedNurse`) |
| `service` | `PatientService`, `WorkflowService` (start + live tracker), `CareService`, `PharmacyService`, `TaskService` (custom Tasklist), `NotificationService`, `CamundaQueryService` (`/v2` search), `RiskEvaluator`, `NurseMatcher`, `DistanceCalculator` |
| `worker` | `DischargeAndPlanWorkers`, `NurseWorkers`, `VisitAndRiskWorkers`, `PharmacyWorkers` |
| `domain` / `repository` | 13 JPA entities and Spring Data repositories |
| `config` / `exception` | Typed `@ConfigurationProperties`, demo fault switches, embedded SMTP, CORS, `GlobalExceptionHandler` |

### 9.1 Job workers (strongly typed)

Each worker matches a BPMN task type exactly. It receives typed variables (`@Variable Long workflowId`, `@Variable CareDay careDay`, or `@VariablesAsType MatchInput in` for generic lists) and returns a typed record or map.

```java
@JobWorker(type = "hh.match-nurse")
public Map<String, Object> matchNurse(@VariablesAsType MatchInput in) {
    ...
    NurseDistance best = NurseMatcher.nearest(distances, limit).orElseThrow(() -> new ZeebeBpmnError("NO_SUITABLE_NURSE",
            "No available nurse can reach the patient within " + limit + " minutes", Map.of("nurseDistances", distances)));
```

| Job type | Worker | Business errors thrown |
|---|---|---|
| `hh.validate-discharge`, `hh.generate-care-plan`, `hh.verify-plan`, `hh.complete-workflow`, `hh.record-notification-failure` | `DischargeAndPlanWorkers` | |
| `hh.fetch-available-nurses`, `hh.rank-nurses-fallback`, `hh.match-nurse`, `hh.assign-nurse` | `NurseWorkers` | `NO_SUITABLE_NURSE`, `DISTANCE_API_ERROR` |
| `hh.schedule-visit`, `hh.evaluate-risk`, `hh.record-incomplete-visit`, `hh.record-missed-visit`, `hh.open-intervention`, `hh.dispatch-emergency`, `hh.remind-doctor`, `hh.arrange-readmission`, `hh.close-intervention`, `hh.record-escalation`, `hh.escalate-clinical-lead`, `hh.schedule-physio`, `hh.complete-physio`, `hh.record-missed-physio` | `VisitAndRiskWorkers` | `EMERGENCY_DISPATCH_FAILED` |
| `rx.verify-prescription`, `rx.notify-rejection`, `rx.check-stock`, `rx.source-partner`, `rx.mark-unavailable`, `rx.dispatch-delivery`, `rx.reschedule-delivery`, `rx.mark-delivery-failed`, `rx.record-delivery` | `PharmacyWorkers` | `COURIER_UNAVAILABLE` |

The workers are **idempotent** where a retry could duplicate data. Scheduling a visit, scheduling physiotherapy, generating the plan, reserving stock and dispatching a courier all look up existing records first.

### 9.2 REST API reference (port 8090)

| Method | Path | Purpose | Status codes |
|---|---|---|---|
| POST | `/api/patients` | Register a patient | 201, 400 (validation), 409 (duplicate MRN) |
| GET | `/api/patients`, `/api/patients/{id}` | List / get | 200, 404 |
| POST | `/api/patients/{id}/discharge` | Discharge + **start the workflow** | 201, 400, 409 (already in care), 503 (engine down) |
| GET | `/api/workflows` | Workflow list | 200 |
| GET | `/api/workflows/{processInstanceKey}/status` | **Live tracker** (engine state, active steps, incidents, visits, deliveries, interventions, notifications) | 200, 404 |
| GET | `/api/nurses` · `/api/nurses/assignments` | Nurses, assignments with distance and travel time | 200 |
| PATCH | `/api/nurses/{id}/availability` | Change availability | 200, 404 |
| GET / PATCH | `/api/visits` · `/api/visits/{id}/status` | 7-day schedule / coordinator correction | 200, 400, 404 |
| GET | `/api/assessments` | Health assessments with risk level | 200 |
| GET / PATCH | `/api/physio` · `/api/physio/{id}` | Appointments / reschedule | 200, 404 |
| GET | `/api/prescriptions` · `/api/deliveries` · `/api/pharmacy/stock` | Pharmacy tracking | 200 |
| POST | `/api/deliveries/{deliveryRef}/confirm` | Courier confirmation → **publishes `MedicationDelivered`** | 200, 404, 409 |
| GET | `/api/alerts` · `/api/notifications` · `/api/interventions` | Alerts and logs | 200 |
| GET | `/api/tasks?assignee=&candidateGroup=&state=&processInstanceKey=` | **Custom Tasklist** (Camunda user-task search) | 200 |
| GET | `/api/tasks/{key}` | Task details and context variables | 200, 404 |
| POST | `/api/tasks/{key}/claim` · `/api/tasks/{key}/complete` | Claim / validated completion | 200, 400, 409 |
| GET | `/api/dashboard` | KPIs | 200 |
| GET / POST | `/api/demo/faults` · `/api/demo/faults/reset` | Fault injection for demonstrating the exception paths | 200, 400 |

Error responses always have the same shape:

```json
{ "timestamp": "2026-11-14T17:21:23Z", "status": 400, "error": "Bad Request", "message": "Validation failed",
  "path": "/api/patients", "details": ["phone: must be 10 digits"] }
```

---

## 10. Database

PostgreSQL 17. The schema is managed by Flyway: [`V1__schema.sql`](backend-springboot/src/main/resources/db/migration/V1__schema.sql) (13 tables with keys, foreign keys, unique and check constraints, indexes) and [`V2__seed_data.sql`](backend-springboot/src/main/resources/db/migration/V2__seed_data.sql) (5 nurses, pharmacy stock). Hibernate runs with `ddl-auto=validate`, so the entities must match the migrations exactly.

```mermaid
erDiagram
    PATIENT ||--o{ WORKFLOW_INSTANCE : "has"
    PATIENT ||--o{ HOME_CARE_PLAN : "has"
    WORKFLOW_INSTANCE ||--|| HOME_CARE_PLAN : "drives"
    HOME_CARE_PLAN ||--o{ NURSE_ASSIGNMENT : ""
    NURSE ||--o{ NURSE_ASSIGNMENT : ""
    HOME_CARE_PLAN ||--|{ HOME_CARE_VISIT : "7 days"
    NURSE ||--o{ HOME_CARE_VISIT : "visits"
    HOME_CARE_VISIT ||--o| HEALTH_ASSESSMENT : ""
    HEALTH_ASSESSMENT ||--o{ RISK_INTERVENTION : "triggers"
    HOME_CARE_PLAN ||--o{ PHYSIOTHERAPY_APPOINTMENT : ""
    PATIENT ||--o{ PRESCRIPTION : ""
    PRESCRIPTION ||--o{ MEDICATION_DELIVERY : ""
    PATIENT ||--o{ NOTIFICATION : ""
    PATIENT {
        bigint id PK
        varchar mrn UK
        varchar status
        double latitude
        double longitude
    }
    WORKFLOW_INSTANCE {
        bigint id PK
        bigint process_instance_key UK
        varchar status
        varchar current_stage
    }
    HOME_CARE_VISIT {
        bigint id PK
        int day_number
        varchar status
    }
    HEALTH_ASSESSMENT {
        int pain_score
        double temperature
        boolean wound_discharge
        varchar risk_level
    }
    MEDICATION_DELIVERY {
        varchar delivery_ref UK
        varchar status
    }
    PHARMACY_STOCK {
        varchar pharmacy
        boolean partner
        varchar medication
        int quantity
    }
```

`WORKFLOW_INSTANCE.process_instance_key` links every business record to its Camunda process instance. No secrets are stored in the database.

---

## 11. React portal

React 18 + Vite + Tailwind CSS. The portal uses a calm clinical design: IBM Plex Sans, Source Serif headings and a single navy accent. Every screen reads **live backend data**; nothing is hard-coded. All screens have loading, empty, error and success states.

### 11.1 Dashboard
![Dashboard](documentation/screenshots/01-dashboard.png)
The KPIs come from `GET /api/dashboard`: active patients, active care plans, available nurses, scheduled visits, pending deliveries, critical alerts, open interventions and failed notifications. Below them are workflows by status, the most recent workflows (linked to the tracker) and the latest alerts.

### 11.2 Patient registration and discharge, with dynamic array builders
![Patients](documentation/screenshots/02-patients.png)
![Discharge form with array builders](documentation/screenshots/03-discharge-form-array-builders.png)

The discharge form has two **dynamic array item builders**: *Physiotherapy sessions* (day + focus) and *Prescriptions* (medicine, dosage, quantity, controlled, doctor approved). Rows can be added and removed. These arrays become the multi-instance collections `physioSessions` and `prescriptions`. An optional "demo timers" section sets `timerOverrides`.

### 11.3 Custom Tasklist inbox
![Tasklist inbox](documentation/screenshots/09-tasklist-inbox.png)

The inbox lists Camunda user tasks (`GET /api/tasks`, backed by the Camunda `/v2/user-tasks/search` API). It can be filtered by role or user (coordinator, doctor, physiotherapists, each nurse) and refreshes every 5 seconds. Users can claim and complete tasks.

![Health assessment form](documentation/screenshots/10-tasklist-health-assessment-form.png)
*The nurse's daily assessment. The context (patient, care day, nurse, family) is loaded from the task's variables. Pain score, temperature and the three infection indicators are validated on the client **and** again on the server (`TaskService.validate`). Submitting completes the Zeebe user task.*

![Doctor review](documentation/screenshots/11-tasklist-doctor-review.png)
*A live doctor review. Day 2 of Meena Subramanian's plan was classified **ELEVATED** ("Swelling around the surgical site"). The doctor chooses Home care, Urgent visit or Readmit.*

### 11.4 Live process status tracker
![Tracker: active plan](documentation/screenshots/12-tracker-active-plan.png)
*Polled every 3 seconds from `GET /api/workflows/{key}/status`, which combines Camunda runtime data (engine state, active BPMN steps, incidents, pharmacy child instances) with the business records (7-day timeline, nurse, physiotherapy, prescriptions and deliveries, interventions, notifications).*

![Tracker: incident](documentation/screenshots/13-tracker-incident.png)
*The same tracker during a real incident. The SMS gateway was down while a CRITICAL alert was being sent, so after 3 retries Camunda raised an incident. The error is shown with a link to Operate.*

![Tracker: completed](documentation/screenshots/14-tracker-completed-plan.png)
*A completed plan (TC01): 7/7 visits, physiotherapy done, both medicines delivered, the e-mails and SMS sent.*

### 11.5 Other screens

| | |
|---|---|
| ![Nurses](documentation/screenshots/04-nurses-and-assignments.png) **Nurses**: availability toggle, load, skills; assignments with distance (km), travel time and source (`DISTANCE_MATRIX_API` / `FALLBACK_STRAIGHT_LINE` / `MANUAL`) | ![Visits](documentation/screenshots/05-home-care-visits.png) **Home visits**: the 7-day schedule per patient, colour-coded COMPLETED / MISSED / INCOMPLETE / SCHEDULED, with assessments and risk levels |
| ![Physio](documentation/screenshots/06-physiotherapy.png) **Physiotherapy**: appointments created by the parallel MI, completion status, reschedule | ![Pharmacy](documentation/screenshots/07-pharmacy-deliveries.png) **Pharmacy**: prescription status (DELIVERED / REJECTED / UNAVAILABLE / DELAYED), deliveries with **Confirm delivery** (publishes the message), stock |
| ![Risk](documentation/screenshots/08-readmission-risk.png) **Readmission risk**: interventions, escalation level, doctor decisions, with the clinical disclaimer | ![Notifications](documentation/screenshots/15-notifications.png) **Notifications**: every e-mail (Email connector → SMTP), SMS (REST connector → gateway), in-app alert and failure |
| ![Demo](documentation/screenshots/16-demo-fault-injection.png) **Demo controls**: switch faults on (Distance API 500 / quota / denied / invalid, SMTP down, SMS down / reject, courier, emergency dispatch, empty or far nurse pool) to demonstrate the exception paths live | |

---

## 12. Execution evidence

**How to read the coloured diagrams.** Each one is drawn from the element instances Camunda recorded for that process instance:
- 🟩 **green**: completed
- 🟦 **blue**: active (waiting)
- 🟥 **red**: incident
- ⬜ **grey dashed**: cancelled by a boundary event or timer

Each diagram is followed by the matching **Camunda Operate** screenshot.

![Operate instances](documentation/screenshots/20-operate-instances.png)
*Camunda Operate: all `home-healthcare-dispatch` instances created by the test runs and the live demo cases (completed, active, cancelled, and one with an incident).*

### 12.1 Happy path: TC01 (process instance 2251799813864477)
![TC01 full path](documentation/diagrams/exec-tc01-happy-path-full.png)

| Nurse dispatch | Seven sequential visits |
|---|---|
| ![](documentation/diagrams/exec-tc01-dispatch.png) | ![](documentation/diagrams/exec-tc01-daily-visits.png) |

- **Nurse dispatch.** Discharge validated, the Google Distance Matrix connector returned travel times, and **Priya Natarajan (0.6 km, 1 min)** was chosen as the nearest suitable nurse. The family was e-mailed by the Email connector.
- **Seven sequential visits.** Each day was completed with NORMAL risk. The engine timestamps show day *n+1* started only after day *n* ended. The `x7` badges are the 7 completions of the sequential MI.
- **Physiotherapy.** Both sessions were open **at the same time** (parallel MI).
- **Pharmacy.** Two child instances ran in parallel; both medicines were delivered (message correlation) and SMS-confirmed.
- **Close-out.** `planOutcome = COMPLETED`, the final e-mail was sent, and the plan was closed. 93 BPMN steps completed.

![Operate TC01](documentation/screenshots/21-operate-happy-path-completed.png)

![Child: delivered](documentation/diagrams/exec-tc01-child-delivered.png)
*One of TC01's pharmacy child instances: verified → in stock → courier → message `MedicationDelivered` → recorded → SMS.*

### 12.2 High pain → ELEVATED → doctor review with a non-interrupting reminder (TC02)
![TC02](documentation/diagrams/exec-tc02-elevated-doctor-reminder.png)
1. The nurse entered **pain 7** on day 1, so `hh.evaluate-risk` returned ELEVATED and the Readmission Risk Intervention started.
2. The doctor did not decide within `doctorReviewReminder` (PT5S in the test), so the **non-interrupting timer** fired and *Remind on-call doctor* ran **while the review stayed open**.
3. The doctor then chose HOME_CARE and the intervention closed.

![Operate TC02](documentation/screenshots/28-operate-doctor-reminder-timer.png)

### 12.3 Infection indicators → CRITICAL → urgent response and SMS (TC03)
![TC03](documentation/diagrams/exec-tc03-critical-infection.png)
On day 2 the nurse reported wound discharge with **fever 38.6 °C**, which is CRITICAL. The flow dispatched an urgent response and sent the family a critical SMS through the REST connector.

### 12.4 Error boundary on the sub-process: EMERGENCY_DISPATCH_FAILED (TC04)
![TC04](documentation/diagrams/exec-tc04-error-boundary.png)
1. A pain score of 9 made the case CRITICAL.
2. The urgent-response service was down (fault injected), so `hh.dispatch-emergency` threw `ZeebeBpmnError("EMERGENCY_DISPATCH_FAILED")`.
3. The **error boundary event on `Sub_RiskIntervention`** caught it. The sub-process was cancelled (grey) and a coordinator arranged an ambulance in the Tasklist.
4. The 7-day plan still completed.

![Operate TC04](documentation/screenshots/22-operate-error-boundary-emergency.png)

### 12.5 Interrupting timer boundaries: missed visits and missed physiotherapy (TC05)

| Missed visits (days 3 and 5) | Missed physiotherapy session |
|---|---|
| ![](documentation/diagrams/exec-tc05-missed-visits.png) | ![](documentation/diagrams/exec-tc05-missed-physio.png) |

`visitWindow` and `physioWindow` were set to PT6S. The nurse did not submit days 3 and 5, so the **interrupting timers** cancelled those assessment tasks, *Record missed visit* ran, and the sequential loop **continued with the next day**. At the end, `hh.verify-plan` returned `COMPLETED_WITH_GAPS` and a coordinator reviewed the gaps.

![Operate TC05](documentation/screenshots/23-operate-timer-boundaries-missed-visits.png)

### 12.6 External API failure: Distance Matrix (TC15: HTTP 500; TC06: OVER_QUERY_LIMIT)

| TC15: HTTP 500 → connector `errorExpression` → `Err_DistanceApi` | TC06: HTTP 200 with `OVER_QUERY_LIMIT` → matcher → `Err_DistanceInvalid` |
|---|---|
| ![](documentation/diagrams/exec-tc15-http-500.png) | ![](documentation/diagrams/exec-tc06-over-query-limit.png) |

Google signals some errors with HTTP 200 and an error `status` in the body, so both kinds of failure are handled:
- **Transport errors** (HTTP 500, timeouts) are mapped to a BPMN error by the **connector's FEEL `errorExpression`**.
- **Logical errors** (quota exceeded, request denied, malformed body) are detected by the typed matcher worker.

Both routes lead to the straight-line fallback, so a nurse is still found.

![Operate TC06](documentation/screenshots/24-operate-distance-api-fallback.png)

### 12.7 Nurse unavailable (TC07: nobody within the travel limit; TC08: empty pool)

| TC07: `NO_SUITABLE_NURSE` → manual assignment | TC08: retry timer ×2, 3 searches → manual assignment |
|---|---|
| ![](documentation/diagrams/exec-tc07-no-suitable-nurse.png) | ![](documentation/diagrams/exec-tc08-nurse-retry.png) |

### 12.8 Notification failure: e-mail down and SMS rejected (TC09)
![TC09](documentation/diagrams/exec-tc09-notification-failure.png)
1. The SMTP server was stopped, so the **Email connector** failed and its error expression raised `NOTIFICATION_FAILED`. The boundary caught it and tried the **SMS fallback**.
2. The gateway rejected the SMS (HTTP 422), so a second boundary fired: *Record failed notification* logged it and alerted the coordinator.
3. The **care plan continued and completed.**

![Operate TC09](documentation/screenshots/25-operate-notification-failure.png)

### 12.9 Pharmacy call activity: rejected, partner pharmacy, unavailable, delay reminder (TC10)

| Tramadol: controlled, no approval → **REJECTED** | Cefuroxime: out of stock → **partner pharmacy** → delay reminder SMS → **DELIVERED** | Insulin: nowhere in stock → **UNAVAILABLE** |
|---|---|---|
| ![](documentation/diagrams/exec-tc10-child-1.png) | ![](documentation/diagrams/exec-tc10-child-2.png) | ![](documentation/diagrams/exec-tc10-child-3.png) |

All three child instances ran **in parallel** from one multi-instance call activity. Each returned its own `fulfillmentStatus` through the output mappings, collected into `pharmacyResults`.

![Operate TC10 parent](documentation/screenshots/26-operate-pharmacy-call-activity.png)
![Operate child instance](documentation/screenshots/29-operate-child-pharmacy-instance.png)

**Courier unavailable (TC11).** The `COURIER_UNAVAILABLE` error boundary in the child set the delivery to DELAYED, and the status flowed back to the parent:

![TC11](documentation/diagrams/exec-tc11-courier-unavailable.png)

### 12.10 Readmission and intervention timeout (TC13, TC14)

| TC13: doctor decides READMIT | TC14: no decision in time → **interrupting timer on the sub-process** → clinical lead |
|---|---|
| ![](documentation/diagrams/exec-tc13-readmit.png) | ![](documentation/diagrams/exec-tc14-intervention-timeout.png) |

![Operate TC14](documentation/screenshots/27-operate-intervention-timeout.png)

### 12.11 Live incident and recovery (transient technical failure)
![Live incident](documentation/diagrams/exec-live-incident.png)
![Operate incident](documentation/screenshots/30-operate-incident-sms-gateway-down.png)
1. The SMS gateway was **down** (HTTP 503) while a critical alert was being sent.
2. The REST connector retried 3 times with a 5-second backoff, then Camunda raised an **incident**, shown in red in Operate and in the portal tracker.
3. To recover: bring the gateway back (*Demo controls → Reset*), then click *Retry* in Operate. During development the same mechanism was used on a real worker bug (§13.4).

![Live waiting case](documentation/diagrams/exec-live-doctor-review-waiting.png)
*A live, active instance waiting at the Doctor review (blue): the demo case for presentations.*

---

## 13. Testing

### 13.1 Summary (all executed; results in [`documentation/evidence`](documentation/evidence))

| Level | Tool | Tests | Result |
|---|---|---|---|
| Backend unit tests (risk rules, nurse matching, distance, task validation) | JUnit 5 + AssertJ | 17 | ✅ pass |
| Backend web layer (validation, status codes, error body) | Spring MockMvc `@WebMvcTest` | 4 | ✅ pass |
| Backend persistence (Flyway migrations + JPA mapping + queries) | `@DataJpaTest`, H2 in PostgreSQL mode | 2 | ✅ pass |
| Frontend (array builder, task forms, badges, API client, discharge form) | Vitest + Testing Library | 50 | ✅ pass |
| **End-to-end** against Camunda 8.8 + PostgreSQL + connectors | [`tools/run-scenarios.js`](tools/run-scenarios.js) | 15 scenarios, 69 assertions | ✅ 15/15 |
| Production builds | `mvnw package`, `vite build` | | ✅ |

### 13.2 End-to-end scenarios (mapped to the 18 required test areas)

| Required test area | Scenario(s) |
|---|---|
| 1 Patient registration · 2 Workflow initiation | TC01, TC12 |
| 3 Nurse matching and assignment · 4 Nearest suitable nurse | TC01, TC06, TC07, TC08, TC15 |
| 5 Seven-day visit scheduling · 7 Sequential MI | TC01, TC05 |
| 6 Parallel MI | TC01 (physiotherapy), TC10 (call activity) |
| 8 Pharmacy call activity · 9 Prescription fulfilment · 10 Delivery tracking | TC01, TC10, TC11 |
| 11 High-pain risk · 12 Infection-indicator risk · 13 Readmission Risk Intervention | TC02, TC03, TC13, TC14 |
| 14 Error boundary path | TC04, TC06, TC07, TC09, TC11, TC15 |
| 15 Timer boundary path | TC02, TC05, TC08, TC14 |
| 16 External API failure · 17 Notification failure | TC06, TC15 · TC09 |
| 18 Seven-day plan completion | TC01, TC05 |

See [`scenario-results.md`](documentation/evidence/scenario-results.md) and [`scenario-run-log.txt`](documentation/evidence/scenario-run-log.txt).

### 13.3 Run the tests
```bash
cd backend-springboot && ./mvnw test        # 23 tests
cd frontend-react && npm test               # 50 tests
node tools/run-scenarios.js                 # 15 end-to-end scenarios (stack must be running)
```

### 13.4 Defects found by testing (and fixed)
| Defect | How it showed up | Fix |
|---|---|---|
| A generic `List<Record>` job variable lost its element type (type erasure) | Incident `ClassCastException` on *Generate 7-day care plan*, seen in Operate | Switched to `@VariablesAsType` input records; the incident was resolved with *Retry* |
| An input mapping made a worker's output stay local (`physioSessions`, `nurseSearchAttempts`) | Physiotherapy sessions without dates; the retry counter would never increase | Added explicit output mappings (§8.1 rule 4) |
| Google errors arrive as HTTP 200 | OVER_QUERY_LIMIT was not caught by the HTTP error expression | Added worker-side validation and a second boundary `Err_DistanceInvalid` |
| A just-created task is visible before its variables are indexed | 404 from the task-variables search | The API returns `contextLoading`; the UI and test runner retry |

---

## 14. Running the project

**Prerequisites:** Java 21, Node 18+, PostgreSQL 17, Camunda 8 Run 8.8.

```bash
cp .env.example .env                     # set the passwords and keys
```
```sql
CREATE ROLE homecare LOGIN PASSWORD '<DB_PASSWORD>';
CREATE DATABASE homecare OWNER homecare;
```
```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-camunda.ps1 -C8Run "C:\path\to\c8run-8.8.32"   # exports the connector secrets
node tools\deploy.js                                                                                # child process first, then main + forms
powershell -ExecutionPolicy Bypass -File scripts\start-backend.ps1                                  # Flyway creates the schema
cd frontend-react; npm install; npm run dev
```

| URL | |
|---|---|
| http://localhost:5173 | CareFlow portal |
| http://localhost:8090/actuator/health | Backend health (database + Camunda) |
| http://localhost:8080/operate | Camunda Operate (`demo` / `demo`) |

**Demo script (about 5 minutes)**
1. **Patients** → *Discharge & start 7-day plan*. Add sessions and prescriptions with the array builders.
2. **Tracker**: watch the nurse being matched by the Distance Matrix connector, the e-mail being sent, and the three care tracks starting.
3. **Tasklist** → pick the nurse → day-1 assessment with **pain 7** → pick *Doctor* → decide. Show the **reminder timer**.
4. **Pharmacy** → *Confirm delivery* (message correlation) → the tracker shows DELIVERED and the SMS.
5. **Demo controls** → e.g. *Distance API = HTTP_500* or *SMTP = DOWN*, discharge another patient, and show the error boundary path in **Operate**.

## 15. Docker deployment

| File | Strategy |
|---|---|
| [`backend-springboot/Dockerfile`](backend-springboot/Dockerfile) | Stage 1 `eclipse-temurin:21-jdk-alpine` + Maven wrapper (dependency layer cached) → stage 2 `eclipse-temurin:21-jre-alpine`, non-root user, `HEALTHCHECK` on `/actuator/health` |
| [`frontend-react/Dockerfile`](frontend-react/Dockerfile) | Stage 1 `node:22-alpine` `npm ci && vite build` → stage 2 `nginx:1.27-alpine` with SPA fallback and an `/api` reverse proxy ([`nginx.conf`](frontend-react/nginx.conf)) |
| [`docker-compose.yml`](docker-compose.yml) | `postgres:17-alpine` (named volume, `pg_isready` health check) → `backend` (waits for a healthy database) → `frontend` (waits for a healthy backend). Optional profile `camunda` adds Camunda 8.8, connectors and Elasticsearch |

```bash
docker compose up --build                       # uses Camunda 8 Run on the host (host.docker.internal)
docker compose --profile camunda up --build     # everything in containers (about 4 GB RAM)
```

> **Verification status.** The Dockerfiles and the Compose file are complete. Docker Desktop was installed on the development machine and needs a Windows restart (WSL 2) before the containers can be started; container verification will be added here after that run. The application itself is fully verified on the same versions (above).

## 16. Configuration and secrets

All secrets are environment variables, loaded from `.env` (**git-ignored**; [`.env.example`](.env.example) is the template). There are no keys in the source code, the BPMN files or the database.

| Variable | Read by | Purpose |
|---|---|---|
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | backend | PostgreSQL |
| `CAMUNDA_GRPC_ADDRESS`, `CAMUNDA_REST_ADDRESS` | backend | Zeebe gateway, Orchestration REST API |
| `DISTANCE_MATRIX_URL`, `GOOGLE_MAPS_API_KEY` | connector runtime → `{{secrets.*}}` | Demo: backend mock. Live: `https://maps.googleapis.com/maps/api/distancematrix/json` + a real key |
| `SMS_GATEWAY_URL`, `SMS_API_KEY` | connector runtime | SMS gateway (Bearer) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` | connector runtime + backend | SMTP for the Email connector |
| `HOMECARE_DEMO_MODE`, `MAIL_EMBEDDED_SERVER` | backend | Mock providers, embedded SMTP, timer overrides |
| `TIMER_*` | backend | Default ISO-8601 timer durations |

## 17. Repository structure

```text
home-healthcare-dispatch/
├── bpmn-models/
│   ├── main-home-healthcare.bpmn
│   ├── pharmacy-prescription-fulfillment.bpmn
│   ├── forms/                      7 Camunda Forms
│   └── README.md
├── backend-springboot/
│   ├── src/main/java/com/homecare/dispatch/{web,dto,service,worker,domain,repository,config,exception}
│   ├── src/main/resources/{application.yml, db/migration/V1__schema.sql, V2__seed_data.sql}
│   ├── src/test/java/...            JUnit, MockMvc, DataJpa tests
│   ├── pom.xml
│   └── Dockerfile
├── frontend-react/
│   ├── src/{pages,components,tasks,__tests__}
│   ├── package.json · vite.config.js · nginx.conf
│   └── Dockerfile
├── tools/        build_bpmn.py · deploy.js · run-scenarios.js · capture-screenshots.js · render-execution.js
├── scripts/      start-camunda.ps1 · start-backend.ps1 · start-frontend.ps1
├── documentation/{diagrams, screenshots, evidence}
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

## 18. Team

| Name | Register number | Role |
|---|---|---|
| [Student Name] | [Register Number] | [Role] |
| [Student Name] | [Register Number] | [Role] |

SRM Institute of Science and Technology · 21CSE735P Workflow Automation Engineering
