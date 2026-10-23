# TrackIt - Real-Time Delivery Tracking & Order Management

Full-stack implementation of the plan in `projectscope.md`, `techstack.md` and `implementation-plan.md`.

**Stack:** React (Vite) · Node.js/Express · MongoDB (Mongoose) · Socket.IO · Leaflet + OpenStreetMap maps · JWT auth with role-based access.

## Run it

```bash
npm run install:all      # installs server + client
npm run dev:server       # API + WebSocket on :5000
npm run dev:client       # UI on http://localhost:5173
```

## Database

By default the app uses a local MongoDB with **data stored in `server/data/db`** and a **fixed port (27017)**:
`mongodb://127.0.0.1:27017/delivery` (works with MongoDB Compass). The first start downloads the MongoDB binary (~600 MB, one time).

```bash
npm run db:start   --prefix server   # (optional) run the database on its own, independent of the API
npm run db:info    --prefix server   # counts + users + recent orders
npm run db:backup  --prefix server   # export everything to server/backups/<timestamp>
npm run db:restore --prefix server -- backups/<folder> --yes   # replace data from a backup
npm run db:reset   --prefix server -- --yes                    # wipe and re-seed demo data
```

If nothing is listening on 27017, the API starts the database itself. To use your own database (e.g. MongoDB Atlas) copy `server/.env.example` to `server/.env` and set `MONGODB_URI`; set `DB_PORT` to change the local port.

Demo accounts are seeded on first run (password `password123`):
`user@demo.com` (customer) · `agent1@demo.com`, `agent2@demo.com` (agents) · `admin@demo.com` (admin).

## Try the full flow
1. Customer: **New Order** - search an address or click the map for pickup and drop, then place it.
2. Admin (second browser/profile): **Orders** - assign an agent.
3. Agent: **My Deliveries** - choose **Simulate** (or **GPS**) under *Share location*, then *Mark Picked-up* and *Mark In-Transit*.
4. Customer: open the order - watch the agent marker move live, with ETA and status timeline. Agent marks *Delivered*; customer can then rate it.
5. Admin: **Dashboard** (KPIs and charts) and **Live Map**.

## Features
- **Customer:** place/cancel orders, live map tracking, status timeline, notifications, delivery history, rating.
- **Agent:** assigned deliveries, step-by-step status updates, live location sharing (GPS or simulated).
- **Admin:** manage users and orders, assign/reassign agents, live map of deliveries, KPI dashboard (on-time rate, avg duration, tracking accuracy, active deliveries, CSAT).
- **Security:** bcrypt, JWT, role guards on REST and socket events, Helmet, rate-limited auth, zod validation.

## Structure
```
server/src  models/ routes/ services/ middleware/ socket.js seed.js
client/src  pages/ components/ auth.jsx api.js
```

## Notes
- Maps use Leaflet + OpenStreetMap (no API key needed) instead of Google Maps; swapping providers only touches `client/src/components/MapView.jsx`.
- Delivery due time = 30 min handling + distance at 25 km/h; used for the on-time rate.
- Out of scope in Phase 1: native apps, payments, AI route optimization.

## Testing

| Layer | Tool | Command | What it covers |
|---|---|---|---|
| Server unit + API + WebSocket | `node:test`, supertest, socket.io-client | `npm test --prefix server` | geo/due-time maths, validation, error handler, auth, roles, full order lifecycle, notifications, reports, live location tracking |
| Client unit/component | Vitest + Testing Library | `npm test --prefix client` | helpers, order list, error boundary, API error handling, login, navigation per role, route protection |
| End-to-end (real Chrome) | Playwright | `npm run test:e2e` | full customer -> admin -> agent delivery with live updates, access control, admin screens, error recovery, phone layout |

```bash
npm test            # server + client tests (fast, no browser)
npm run test:e2e    # browser tests (uses your installed Google Chrome)
npm run test:all    # everything
```

Tests never touch your real data: server tests use a throwaway in-memory MongoDB; the e2e run starts its own API (port 5055), database (port 27099, folder `server/data/e2e-db`, recreated each run) and web app (port 5174), so it can run while your dev servers are up.

## Error monitoring (Sentry)

Optional and off by default. Create a project at [sentry.io](https://sentry.io), then set the DSNs:

- API: `SENTRY_DSN` (and optionally `SENTRY_ENVIRONMENT`) in `server/.env`
- Web app: `VITE_SENTRY_DSN` in `client/.env` (set it in your hosting provider's environment variables for production builds)

What is reported: unexpected server errors (5xx) with route and user id, crashes in socket handlers, unhandled rejections/exceptions, browser render crashes, failed/unreachable API calls. Normal 4xx errors (bad input, wrong password) are not reported, and no emails or names are sent. The UI never shows stack traces: users see a friendly message, a Retry button on pages that fail to load, or a recovery screen if the page crashes.
