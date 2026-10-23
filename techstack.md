# Tech Stack

## Summary
| Layer | Choice | Why |
|---|---|---|
| Frontend | React.js (+ HTML, CSS, JavaScript) | Component-based UI, large ecosystem, easy responsive design |
| Backend | Node.js + Express.js | Single language across stack, strong WebSocket support |
| Database | MongoDB (alt: PostgreSQL) | Flexible documents for orders/status logs; geospatial queries built in |
| Real-time | Socket.IO (WebSockets) (alt: Firebase) | Low-latency bidirectional updates, rooms per order |
| Maps & Tracking | Google Maps JavaScript API | Markers, routes, geocoding, ETA |
| Auth | JWT + bcrypt, role-based middleware | Stateless, secure, simple RBAC |
| Deployment | Vercel/Netlify (frontend), AWS (backend + DB) | Cheap static hosting plus controllable backend |

## Frontend
- **React.js** with Vite, React Router
- State: Context API or Redux Toolkit
- HTTP: Axios; real-time: `socket.io-client`
- Maps: `@react-google-maps/api`
- Styling: CSS Modules or Tailwind CSS; mobile-first responsive layout
- Charts for admin reports: Recharts

## Backend
- **Node.js** (LTS) + **Express.js**
- `socket.io` for WebSockets
- `mongoose` (MongoDB) or `pg`/Prisma (PostgreSQL)
- `jsonwebtoken`, `bcryptjs`, `helmet`, `cors`, `express-rate-limit`
- Validation: Joi or Zod
- Logging: Winston / Morgan

## Database
**Recommended: MongoDB (Atlas)**
- Collections: `users`, `orders`, `agents`, `locations`, `statuslogs`
- `2dsphere` index on locations for geo queries
- TTL index on raw location pings to cap storage
- Alternative: PostgreSQL + PostGIS if relational reporting dominates

## Real-Time Design
- Agent app emits `location:update` every 3-5 s
- Server validates, stores (throttled), and broadcasts to room `order:<id>`
- Status changes emit `order:status` to user and admin rooms
- Scale-out later: Redis adapter for Socket.IO

## Maps & Tracking
- Google Maps API: Maps JS, Geocoding, Directions (ETA/route display)
- Browser Geolocation API (`watchPosition`) for agent GPS
- Restrict API key by HTTP referrer; keep it in env vars

## Security
- HTTPS everywhere, JWT with short expiry + refresh
- Role-based route and socket-event guards (User / Agent / Admin)
- Input validation, rate limiting, Helmet headers, CORS allowlist

## DevOps & Tooling
- Git + GitHub, ESLint + Prettier
- Testing: Jest + Supertest (API), React Testing Library (UI)
- API docs: Postman collection / Swagger
- CI: GitHub Actions
- Deployment: frontend on Vercel/Netlify; backend on AWS EC2 or Elastic Beanstalk (alt: Render/Railway); MongoDB Atlas
- Config via `.env` files

## Out of Stack (Phase 1)
Native mobile apps, payment gateways, AI route optimization.
