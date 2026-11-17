import { Router } from 'express';
import { getRecentHistory } from '../database/connection.js';
import type { NetworkEngine } from '../simulation/NetworkEngine.js';

export function createSimulationRoutes(engine: NetworkEngine) {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'MiniCloudNet backend', timestamp: Date.now() });
  });

  router.get('/state', (_req, res) => {
    res.json(engine.getSnapshot());
  });

  router.post('/start', (_req, res) => {
    engine.start();
    res.json(engine.getSnapshot());
  });

  router.post('/pause', (_req, res) => {
    engine.pause();
    res.json(engine.getSnapshot());
  });

  router.post('/stop', (_req, res) => {
    engine.stop();
    res.json(engine.getSnapshot());
  });

  router.post('/reset', (_req, res) => {
    engine.reset();
    res.json(engine.getSnapshot());
  });

  router.post('/speed', (req, res) => {
    const speed = Number(req.body?.speed ?? 1);
    engine.setSpeed(speed);
    res.json(engine.getSnapshot());
  });

  router.post('/fault', (req, res) => {
    const { type, target } = req.body ?? {};
    if (type && target) {
      engine.triggerFault(type, target);
    }
    res.json(engine.getSnapshot());
  });

  router.get('/history', (_req, res) => {
    const rows = getRecentHistory() as Array<{
      id: number;
      created_at: string;
      status: string;
      speed: number;
      metrics: string;
      topology: string;
      dns_records: string;
      events: string;
    }>;

    const history = rows.map((item) => ({
      id: item.id,
      createdAt: item.created_at,
      status: item.status,
      speed: item.speed,
      metrics: JSON.parse(item.metrics),
      topology: JSON.parse(item.topology),
      dnsRecords: JSON.parse(item.dns_records),
      events: JSON.parse(item.events),
    }));

    res.json({ history });
  });

  return router;
}
