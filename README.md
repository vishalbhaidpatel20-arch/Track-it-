# TrackIt - Real-Time Delivery Tracking & Order Management

Full-stack implementation of the plan in `projectscope.md`, `techstack.md` and `implementation-plan.md`.

**Stack:** React (Vite) · Node.js/Express · MongoDB (Mongoose) · Socket.IO · Leaflet + OpenStreetMap maps · JWT auth with role-based access.

## Run it

```bash
npm run install:all      # installs server + client
npm run dev:server       # API + WebSocket on :5000
npm run dev:client       # UI on http://localhost:5173
```

With no `MONGODB_URI`, the server starts an embedded MongoDB (data in `server/data`; the first start downloads the MongoDB binary, ~600 MB). To use your own database, copy `server/.env.example` to `server/.env` and set `MONGODB_URI` (e.g. MongoDB Atlas).

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
