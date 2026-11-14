# Home Healthcare Dispatch – React frontend

React 18 + Vite 6 + Tailwind CSS v4 + react-router-dom. Plain JavaScript (JSX).
All API calls go through `src/api.js` and use relative `/api/...` paths, so one build works behind the Vite proxy (dev) and behind nginx (Docker).

## Run

```bash
npm install
npm run dev        # http://localhost:5173, proxies /api and /mock to http://localhost:8090
npm test           # vitest run (jsdom + Testing Library)
npm run build      # production build into dist/
```

Set `BACKEND_URL` to proxy to another backend in dev (e.g. `BACKEND_URL=http://localhost:9090 npm run dev`).

## Docker

```bash
docker build -t homecare-frontend .
```

Multi-stage build (node:22-alpine → nginx:1.27-alpine). nginx listens on port 80, serves the SPA with history fallback and proxies `/api/` and `/mock/` to `http://backend:8090` (docker-compose service `backend`).

## Pages

| Route | Page |
|---|---|
| `/` | Dashboard: KPIs, workflows by status, recent workflows, latest alerts |
| `/patients` | Register patients (with sample data), discharge & start the 7-day plan (physio sessions and prescriptions array builders, demo timers) |
| `/nurses` | Nurse pool with availability toggle, assignments with distance/travel/source |
| `/visits` | 7-day visit schedules per care plan, health assessments |
| `/physio` | Physiotherapy appointments, reschedule |
| `/pharmacy` | Prescriptions, deliveries (confirm delivery publishes a Camunda message), stock |
| `/risk` | Readmission-risk interventions and staff alerts |
| `/tasks` | Custom Tasklist: user/group selector, claim, task-specific forms per BPMN `elementId` |
| `/tracker`, `/tracker/:processInstanceKey` | Live process tracker (polls every 3 s), link to Camunda Operate |
| `/notifications` | Notification log (e-mail / SMS / in-app) |
| `/demo` | Fault injection for demonstrating exception paths |

## Structure

- `src/api.js`: REST client (throws `ApiError` with the server `message` + `details`)
- `src/components/`: Layout, Sidebar, StatusBadge, Toast, DataTable, ArrayBuilder, forms, feedback (spinner, error banner, empty state)
- `src/pages/`: one component per route
- `src/tasks/`: one form per user task type + `validation.js` (mirrors the server-side `TaskService` validation)
- `src/__tests__/`: Vitest tests
