# Implementation Plan

Phased plan for the Real-Time Delivery Tracking & Order Management System. See `projectscope.md` for scope and `techstack.md` for technology choices. Durations assume a small team and can be compressed or stretched to fit the fixed timeline.

## Phase 0: Setup & Planning (Week 1)
- [ ] Finalize requirements and user stories per role
- [ ] Create repo with `client/` and `server/` folders, ESLint/Prettier
- [ ] Set up MongoDB Atlas, Google Maps API key, `.env` templates
- [ ] Design wireframes (user, agent, admin screens)
- [ ] Define API contract and DB schema

**Exit:** repo runs locally, schema and wireframes approved.

## Phase 1: Backend Foundation (Weeks 2-3)
- [ ] Express app skeleton, error handling, logging, config
- [ ] Mongoose models: User, Order, Agent, Location, StatusLog
- [ ] Auth: register, login, JWT, password hashing
- [ ] Role-based middleware (User / Agent / Admin)
- [ ] Order APIs: create, list, get, update, cancel
- [ ] Admin APIs: manage users, assign agent to order
- [ ] Agent APIs: list assigned orders, update status
- [ ] Status log written on every status change (Placed -> Picked-up -> In-Transit -> Delivered)
- [ ] API tests with Jest + Supertest

**Exit:** full order lifecycle works via API.

## Phase 2: Real-Time Layer (Week 4)
- [ ] Socket.IO server with JWT-authenticated connections
- [ ] Rooms: `order:<id>`, `admin`, `agent:<id>`
- [ ] Events: `location:update`, `order:status`, `order:assigned`
- [ ] Throttled persistence of location pings
- [ ] Authorization checks on every socket event
- [ ] Notification records for status changes

**Exit:** two clients see location and status updates within ~1 s.

## Phase 3: Frontend, Core (Weeks 5-6)
- [ ] Vite + React app, routing, protected routes by role
- [ ] Auth pages (login/register)
- [ ] **User:** place order form, my orders, order detail, history
- [ ] **Agent:** assigned deliveries list, status update buttons
- [ ] **Admin:** orders table, users table, assign-agent dialog
- [ ] Responsive layout (mobile-first)

**Exit:** each role can complete its non-map workflows.

## Phase 4: Live Tracking & Maps (Weeks 7-8)
- [ ] Google Maps component with pickup/drop markers
- [ ] Agent: `watchPosition` GPS sharing while delivery is active
- [ ] User: live agent marker, route and ETA, status timeline
- [ ] Admin: live map of all active deliveries
- [ ] In-app toast notifications for status changes
- [ ] Handle offline/reconnect and stale location states

**Exit:** end-to-end user flow works: place -> assign -> pick up -> live track -> delivered.

## Phase 5: Admin Dashboard & Reports (Week 9)
- [ ] KPI cards: active deliveries, on-time rate, avg delivery duration
- [ ] Charts: orders over time, agent performance
- [ ] Filters by date, agent, status
- [ ] Tracking accuracy and customer rating capture (post-delivery rating for CSAT)

**Exit:** all listed KPIs viewable.

## Phase 6: Testing, Security & Hardening (Week 10)
- [ ] Unit and integration tests; manual end-to-end test of full flow
- [ ] Load test of Socket.IO (e.g., Artillery) with simulated agents
- [ ] Security pass: Helmet, rate limiting, input validation, CORS, key restrictions
- [ ] Cross-browser and mobile responsiveness checks
- [ ] Fix bugs, polish UX

**Exit:** no critical bugs; latency and load targets met.

## Phase 7: Deployment & Documentation (Week 11)
- [ ] Deploy frontend (Vercel/Netlify), backend (AWS/Render), DB (Atlas)
- [ ] Environment configs, HTTPS, monitoring and logs
- [ ] CI via GitHub Actions
- [ ] Technical documentation: architecture, API reference, DB schema, setup guide, user guide
- [ ] Demo walkthrough and handover

**Exit:** live URL, docs delivered.

## Timeline Overview
| Week | Focus |
|---|---|
| 1 | Setup & planning |
| 2-3 | Backend foundation |
| 4 | Real-time layer |
| 5-6 | Frontend core |
| 7-8 | Live tracking & maps |
| 9 | Admin dashboard & reports |
| 10 | Testing & hardening |
| 11 | Deployment & docs |

## Risks & Mitigations
| Risk | Mitigation |
|---|---|
| Google Maps cost/quota | Restrict key, cache geocoding, throttle updates |
| Inaccurate or missing GPS | Show last-known location + timestamp, filter bad pings |
| WebSocket scaling | Redis adapter, room-based broadcasts, throttled pings |
| Scope creep | Hold to Phase 1 scope; log extras as future enhancements |
| Unauthorized data access | Role checks on REST and socket events |

## Definition of Done
- All Phase 1 in-scope features work for the three roles
- Real-time updates visible with minimal latency
- Responsive on desktop and mobile
- Deployed, documented, and demonstrated end to end

## Deliverables Checklist
- [ ] Functional web application
- [ ] Admin dashboard
- [ ] Real-time tracking module
- [ ] Technical documentation
