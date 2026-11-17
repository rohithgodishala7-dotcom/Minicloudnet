# MiniCloudNet – 3D Cloud Network Simulator

MiniCloudNet is an interactive educational cloud network simulation platform. It combines a real-time simulation engine, Express + Socket.IO backend, SQLite persistence, and a React + Three.js frontend to model cloud topology, routing, packet behavior, DNS, load balancing, and fault recovery.

## Features

- 3D interactive topology using React Three Fiber
- Real-time network metrics and event logs
- Dijkstra shortest-path routing logic
- TCP and UDP simulation streams
- DNS record lookup and resolution
- Round robin, least connections, and random load balancing
- Manual fault injection for servers, routers, links, congestion, latency, and packet loss
- SQLite-backed simulation history persistence
- Responsive dashboard with Recharts visualizations

## Architecture

- Frontend: React + Vite + TypeScript + Tailwind + Recharts + Framer Motion
- 3D visualization: Three.js + React Three Fiber + Drei
- Backend: Node.js + Express + Socket.IO
- Storage: SQLite using better-sqlite3
- Simulation engine: discrete-event, graph-based routing and traffic generation

## Project Structure

```text
CN_CBP/
├── backend/
│   ├── data/
│   ├── src/
│   │   ├── database/
│   │   ├── routes/
│   │   ├── simulation/
│   │   ├── socket/
│   │   ├── server.ts
│   │   └── types.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── index.html
├── README.md
└── package-lock.json (optional if root package is added later)
```

## Installation

1. Open a terminal in the project root.
2. Install frontend dependencies:

```bash
cd frontend
npm install
```

3. Install backend dependencies:

```bash
cd ../backend
npm install
```

## Running the Application

### Start backend

```bash
cd backend
npm run dev
```

### Start frontend

```bash
cd frontend
npm run dev -- --host 0.0.0.0
```

Then open:

- Frontend: http://localhost:5173/
- Backend API: http://localhost:4000/api/health

## API Overview

### Health

```http
GET /api/health
```

### Simulation state

```http
GET /api/state
```

### Start / pause / stop / reset

```http
POST /api/start
POST /api/pause
POST /api/stop
POST /api/reset
```

### Speed

```http
POST /api/speed
Content-Type: application/json

{ "speed": 5 }
```

### Fault injection

```http
POST /api/fault
Content-Type: application/json

{ "type": "server-failure", "target": "server-1" }
```

### Simulation history

```http
GET /api/history
```

## Default simulation topology

The engine starts with a cloud model composed of:

- 4 client nodes
- 2 edge routers
- 1 core switch
- 1 firewall
- 1 load balancer
- 1 DNS server
- 3 cloud servers

Packets now traverse the intermediate network devices hop by hop. The default data route is:

```text
Client → Edge Router → Core Switch → Firewall → Load Balancer → Cloud Server
```

In the 3D view, packet markers move across the active link, the route is highlighted, and each node is labeled. A failed link is shown as a broken red connection; a packet currently crossing it is dropped and shown at the interruption point. If an upcoming link fails, packets still on an earlier hop are rerouted when a path remains. Manually failed links automatically return to active after 10 simulated seconds; pausing the simulation also pauses this recovery timer.

The topology has backup client-router links, a second router-to-load-balancer path, and alternate routes around the firewall. When a packet is interrupted mid-link, the failed attempt remains visible and the engine retries from the client over a newly calculated path (up to three attempts). If the selected server is no longer reachable, the retry is sent to another healthy server.

Link congestion is measured from the simulator's in-flight and queued packet counts against each link's concurrent packet capacity. Use **Load the core switch link** to reduce capacity and observe the live load percentage, queue count, queue markers, and added transmission delay. Reset restores the default link capacities.

The routing engine calculates shortest paths using graph weights based on link latency and packet loss.

## Notes

This is an educational simulation. It models network behavior in a simplified and visual manner for classroom learning and prototyping, not real-world internet traffic.
Link capacity and congestion are intentionally modeled as concurrent packet slots rather than physical Mbps; latency, queueing, packet movement, and link failure are simulated, not real network measurements.

## Checklists

- Frontend application: implemented
- Backend service: implemented
- Simulation engine: implemented
- 3D visualization: implemented
- TCP/UDP flow simulation: implemented
- DNS simulation: implemented
- Routing logic: implemented
- Load balancing logic: implemented
- Fault simulation: implemented
- Performance analytics: implemented
- Database integration: implemented
- Simulation history: implemented
- README and installation guide: included
