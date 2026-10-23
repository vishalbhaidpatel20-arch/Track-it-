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
