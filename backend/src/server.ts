import express from 'express';
import http from 'node:http';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import { saveSimulationSnapshot } from './database/connection.js';
import { NetworkEngine } from './simulation/NetworkEngine.js';
import { createSimulationRoutes } from './routes/simulationRoutes.js';
import { registerSocketEvents } from './socket/socketHandler.js';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
  },
});

const engine = new NetworkEngine();

app.use(cors());
app.use(express.json());
app.use('/api', createSimulationRoutes(engine));

app.get('/', (_req, res) => {
  res.json({
    app: 'MiniCloudNet backend',
    status: 'online',
    api: '/api/state',
  });
});

registerSocketEvents(io, engine);

setInterval(() => {
  io.emit('simulation:update', engine.getSnapshot());
}, 100);

setInterval(() => {
  const snapshot = engine.getSnapshot();
  saveSimulationSnapshot({
    status: snapshot.status,
    speed: snapshot.speed,
    metrics: JSON.stringify(snapshot.metrics),
    topology: JSON.stringify({ nodes: snapshot.nodes, links: snapshot.links }),
    dnsRecords: JSON.stringify(snapshot.dnsRecords),
    events: JSON.stringify(snapshot.events),
  });
}, 15000);

const port = Number(process.env.PORT ?? 4000);
server.listen(port, () => {
  console.log(`MiniCloudNet backend running on http://localhost:${port}`);
});
