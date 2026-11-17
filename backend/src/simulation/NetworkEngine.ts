import type {
  DNSRecord,
  EventLog,
  FaultType,
  LoadBalancerPolicy,
  NetworkLink,
  NetworkNode,
  Packet,
  RouteInfo,
  SimulationMetrics,
  SimulationSnapshot,
  SimulationStatus,
} from '../types.js';

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(16).slice(2, 9)}`;
}

export class NetworkEngine {
  private nodes: NetworkNode[] = [];
  private links: NetworkLink[] = [];
  private dnsRecords: DNSRecord[] = [];
  private packets: Packet[] = [];
  private events: EventLog[] = [];
  private lastAlert: EventLog | null = null;
  private status: SimulationStatus = 'running';
  private speed = 1;
  private loadBalancerPolicy: LoadBalancerPolicy = 'round-robin';
  private roundRobinIndex = 0;
  private metrics: SimulationMetrics = {
    totalClients: 0,
    activeServers: 0,
    activeRouters: 0,
    packetsTransmitted: 0,
    packetsReceived: 0,
    packetsDropped: 0,
    networkLatency: 0,
    packetDeliveryRatio: 0,
    networkThroughput: 0,
    serverUtilization: 0,
    bandwidthUtilization: 0,
    activeConnections: 0,
    packetsPerSecond: 0,
    congestedLinks: 0,
  };

  private tickTimer: NodeJS.Timeout | null = null;
  private tickCounter = 0;
  private simulationTimeMs = 0;
  private linkRecoveryAt = new Map<string, number>();

  constructor() {
    this.bootstrapDefaultTopology();
    this.refreshMetrics();
    this.addEvent({
      id: createId('evt'),
      timestamp: Date.now(),
      type: 'system.bootstrap',
      source: 'controller',
      destination: 'network',
      description: 'MiniCloudNet simulation initialized with a default fault-tolerant topology.',
      severity: 'info',
    });
    this.start();
  }

  bootstrapDefaultTopology() {
    this.simulationTimeMs = 0;
    this.linkRecoveryAt.clear();
    this.nodes = [
      { id: 'client-1', name: 'Client A', type: 'client', ip: '10.0.0.10', status: 'online', position: { x: -18, y: 0, z: 12 }, bandwidth: 120, latency: 12, cpu: 35, memory: 70, activeConnections: 1, packetLoss: 2 },
      { id: 'client-2', name: 'Client B', type: 'client', ip: '10.0.0.11', status: 'online', position: { x: -18, y: 0, z: 4 }, bandwidth: 120, latency: 13, cpu: 42, memory: 68, activeConnections: 1, packetLoss: 2 },
      { id: 'client-3', name: 'Client C', type: 'client', ip: '10.0.0.12', status: 'online', position: { x: -18, y: 0, z: -4 }, bandwidth: 120, latency: 14, cpu: 41, memory: 66, activeConnections: 1, packetLoss: 2 },
      { id: 'client-4', name: 'Client D', type: 'client', ip: '10.0.0.13', status: 'online', position: { x: -18, y: 0, z: -12 }, bandwidth: 120, latency: 15, cpu: 38, memory: 64, activeConnections: 1, packetLoss: 2 },
      { id: 'router-1', name: 'Edge Router R1', type: 'router', ip: '10.0.0.1', status: 'online', position: { x: -9, y: 0, z: 4 }, bandwidth: 900, latency: 8, cpu: 52, memory: 73, activeConnections: 4, packetLoss: 1 },
      { id: 'router-2', name: 'Edge Router R2', type: 'router', ip: '10.0.0.2', status: 'online', position: { x: -9, y: 0, z: -8 }, bandwidth: 900, latency: 8, cpu: 48, memory: 72, activeConnections: 4, packetLoss: 1 },
      { id: 'core-switch', name: 'Core Switch', type: 'switch', ip: '10.0.0.3', status: 'online', position: { x: -2, y: 0, z: -2 }, bandwidth: 1400, latency: 4, cpu: 46, memory: 70, activeConnections: 6, packetLoss: 0 },
      { id: 'firewall-1', name: 'Firewall FW1', type: 'firewall', ip: '10.0.0.4', status: 'online', position: { x: 4, y: 0, z: -2 }, bandwidth: 1200, latency: 5, cpu: 54, memory: 75, activeConnections: 5, packetLoss: 0 },
      { id: 'load-balancer', name: 'Load Balancer', type: 'load-balancer', ip: '10.0.0.5', status: 'online', position: { x: 10, y: 0, z: -2 }, bandwidth: 1000, latency: 5, cpu: 60, memory: 82, activeConnections: 7, packetLoss: 1 },
      { id: 'dns-1', name: 'DNS Primary', type: 'dns', ip: '10.0.0.8', status: 'online', position: { x: 5, y: 0, z: 13 }, bandwidth: 700, latency: 6, cpu: 58, memory: 80, activeConnections: 2, packetLoss: 1 },
      { id: 'server-1', name: 'Server S1', type: 'server', ip: '10.0.0.20', status: 'online', position: { x: 18, y: 0, z: -12 }, bandwidth: 1000, latency: 14, cpu: 65, memory: 76, activeConnections: 5, packetLoss: 2 },
      { id: 'server-2', name: 'Server S2', type: 'server', ip: '10.0.0.21', status: 'online', position: { x: 18, y: 0, z: -2 }, bandwidth: 1000, latency: 15, cpu: 70, memory: 75, activeConnections: 4, packetLoss: 2 },
      { id: 'server-3', name: 'Server S3', type: 'server', ip: '10.0.0.22', status: 'online', position: { x: 18, y: 0, z: 8 }, bandwidth: 1000, latency: 16, cpu: 72, memory: 78, activeConnections: 4, packetLoss: 2 },
    ];

    this.links = [
      { id: 'link-c1-r1', source: 'client-1', target: 'router-1', bandwidth: 120, latency: 12, capacity: 80, packetLoss: 1, status: 'active' },
      { id: 'link-c1-r2-backup', source: 'client-1', target: 'router-2', bandwidth: 100, latency: 25, capacity: 80, packetLoss: 2, status: 'active' },
      { id: 'link-c2-r1', source: 'client-2', target: 'router-1', bandwidth: 120, latency: 12, capacity: 80, packetLoss: 1, status: 'active' },
      { id: 'link-c2-r2-backup', source: 'client-2', target: 'router-2', bandwidth: 100, latency: 25, capacity: 80, packetLoss: 2, status: 'active' },
      { id: 'link-c3-r2', source: 'client-3', target: 'router-2', bandwidth: 120, latency: 12, capacity: 80, packetLoss: 1, status: 'active' },
      { id: 'link-c3-r1-backup', source: 'client-3', target: 'router-1', bandwidth: 100, latency: 25, capacity: 80, packetLoss: 2, status: 'active' },
      { id: 'link-c4-r2', source: 'client-4', target: 'router-2', bandwidth: 120, latency: 12, capacity: 80, packetLoss: 1, status: 'active' },
      { id: 'link-c4-r1-backup', source: 'client-4', target: 'router-1', bandwidth: 100, latency: 25, capacity: 80, packetLoss: 2, status: 'active' },
      { id: 'link-r1-r2', source: 'router-1', target: 'router-2', bandwidth: 500, latency: 18, capacity: 150, packetLoss: 1, status: 'active' },
      { id: 'link-r1-core', source: 'router-1', target: 'core-switch', bandwidth: 900, latency: 7, capacity: 100, packetLoss: 1, status: 'active' },
      { id: 'link-r2-core', source: 'router-2', target: 'core-switch', bandwidth: 900, latency: 7, capacity: 100, packetLoss: 1, status: 'active' },
      { id: 'link-core-firewall', source: 'core-switch', target: 'firewall-1', bandwidth: 1200, latency: 6, capacity: 100, packetLoss: 0, status: 'active' },
      { id: 'link-firewall-lb', source: 'firewall-1', target: 'load-balancer', bandwidth: 1000, latency: 6, capacity: 100, packetLoss: 0, status: 'active' },
      { id: 'link-r2-lb-backup', source: 'router-2', target: 'load-balancer', bandwidth: 500, latency: 35, capacity: 80, packetLoss: 2, status: 'active' },
      { id: 'link-lb-s1', source: 'load-balancer', target: 'server-1', bandwidth: 500, latency: 10, capacity: 150, packetLoss: 2, status: 'active' },
      { id: 'link-lb-s2', source: 'load-balancer', target: 'server-2', bandwidth: 500, latency: 10, capacity: 150, packetLoss: 2, status: 'active' },
      { id: 'link-lb-s3', source: 'load-balancer', target: 'server-3', bandwidth: 500, latency: 10, capacity: 150, packetLoss: 2, status: 'active' },
      { id: 'link-r2-dns', source: 'router-2', target: 'dns-1', bandwidth: 300, latency: 8, capacity: 120, packetLoss: 1, status: 'active' },
    ];

    this.dnsRecords = [
      { id: 'dns-a', domain: 'www.example.com', ip: '10.0.0.20', type: 'A', ttl: 60 },
      { id: 'dns-b', domain: 'api.minicloudnet.local', ip: '10.0.0.21', type: 'A', ttl: 90 },
      { id: 'dns-c', domain: 'db.minicloudnet.local', ip: '10.0.0.22', type: 'A', ttl: 120 },
    ];

    this.packets = [];
    this.events = [];
    this.lastAlert = null;
  }

  start() {
    this.status = 'running';
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
    }
    this.tickTimer = setInterval(() => this.tickSimulation(100 * this.speed), 100);
  }

  pause() {
    this.status = 'paused';
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    this.addEvent({
      id: createId('evt'),
      timestamp: Date.now(),
      type: 'simulation.pause',
      source: 'controller',
      destination: 'network',
      description: 'Simulation paused by operator.',
      severity: 'info',
    });
  }

  stop() {
    this.status = 'idle';
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    this.addEvent({
      id: createId('evt'),
      timestamp: Date.now(),
      type: 'simulation.stop',
      source: 'controller',
      destination: 'network',
      description: 'Simulation stopped and metrics retained.',
      severity: 'warning',
    });
  }

  reset() {
    this.stop();
    this.bootstrapDefaultTopology();
    this.refreshMetrics();
    this.addEvent({
      id: createId('evt'),
      timestamp: Date.now(),
      type: 'simulation.reset',
      source: 'controller',
      destination: 'network',
      description: 'Topology reset to default cloud network template.',
      severity: 'info',
    });
  }

  setSpeed(speed: number) {
    this.speed = speed;
    if (this.status === 'running') {
      this.start();
    }
  }

  setLoadBalancerPolicy(policy: LoadBalancerPolicy) {
    this.loadBalancerPolicy = policy;
    this.addEvent({
      id: createId('evt'),
      timestamp: Date.now(),
      type: 'load-balancer.policy',
      source: 'controller',
      destination: 'load-balancer',
      description: `Load balancing policy switched to ${policy}.`,
      severity: 'info',
    });
  }

  getSnapshot(): SimulationSnapshot {
    return {
      status: this.status,
      speed: this.speed,
      loadBalancerPolicy: this.loadBalancerPolicy,
      nodes: this.nodes,
      links: this.links,
      dnsRecords: this.dnsRecords,
      routes: this.calculateAllRoutes(),
      packets: this.packets.slice(-12),
      events: this.events.slice(0, 25),
      alert: this.lastAlert,
      metrics: this.metrics,
    };
  }

  triggerFault(type: FaultType, targetId: string) {
    if (type === 'server-failure') {
      const node = this.nodes.find((n) => n.id === targetId);
      if (node) {
        node.status = 'offline';
      }
      this.links.forEach((link) => {
        if (link.source === targetId || link.target === targetId) {
          link.status = 'down';
        }
      });
      this.addEvent({
        id: createId('evt'),
        timestamp: Date.now(),
        type: 'fault.server',
        source: targetId,
        destination: 'load-balancer',
        description: `${node?.name ?? targetId} failed and is no longer accepting traffic.`,
        severity: 'critical',
      });
    }

    if (type === 'router-failure') {
      const node = this.nodes.find((n) => n.id === targetId);
      if (node) {
        node.status = 'offline';
      }
      this.links.forEach((link) => {
        if (link.source === targetId || link.target === targetId) {
          link.status = 'down';
        }
      });
      this.addEvent({
        id: createId('evt'),
        timestamp: Date.now(),
        type: 'fault.router',
        source: targetId,
        destination: 'network',
        description: `${node?.name ?? targetId} lost connectivity and routing recalculated.`,
        severity: 'critical',
      });
    }

    if (type === 'link-failure') {
      const link = this.links.find((l) => l.id === targetId);
      if (link) {
        link.status = 'down';
        this.linkRecoveryAt.set(link.id, this.simulationTimeMs + 10_000);
      }
      this.addEvent({
        id: createId('evt'),
        timestamp: Date.now(),
        type: 'fault.link',
        source: targetId,
        destination: 'network',
        description: `Link ${targetId} is unavailable; rerouting is active and it will recover after 10 simulated seconds.`,
        severity: 'warning',
      });
    }

    if (type === 'congestion') {
      let affectedLinks = 0;
      this.links.forEach((link) => {
        if (link.source === targetId || link.target === targetId) {
          link.capacity = Math.max(1, Math.min(link.capacity, 1));
          affectedLinks += 1;
        }
      });
      this.addEvent({
        id: createId('evt'),
        timestamp: Date.now(),
        type: 'fault.congestion',
        source: targetId,
        destination: 'network',
        description: `Congestion injected at ${targetId}: capacity reduced on ${affectedLinks} adjacent links; queued packets and delay are now measured.`,
        severity: 'warning',
      });
    }

    if (type === 'packet-loss') {
      this.links.forEach((link) => {
        if (link.target === targetId || link.source === targetId) {
          link.packetLoss = Math.min(30, link.packetLoss + 8);
        }
      });
      this.addEvent({
        id: createId('evt'),
        timestamp: Date.now(),
        type: 'fault.packet-loss',
        source: targetId,
        destination: 'network',
        description: 'Packet loss probability was increased on the affected route.',
        severity: 'warning',
      });
    }

    if (type === 'latency') {
      this.links.forEach((link) => {
        if (link.target === targetId || link.source === targetId) {
          link.latency = link.latency + 25;
        }
      });
      this.addEvent({
        id: createId('evt'),
        timestamp: Date.now(),
        type: 'fault.latency',
        source: targetId,
        destination: 'network',
        description: 'Latency spike detected on the affected network segment.',
        severity: 'warning',
      });
    }

    this.reconcilePacketsAfterTopologyChange();
    this.refreshMetrics();
  }

  resolveDns(domain: string) {
    const record = this.dnsRecords.find((entry) => entry.domain === domain);
    if (!record) {
      return { status: 'not-found', ip: null };
    }

    this.addEvent({
      id: createId('evt'),
      timestamp: Date.now(),
      type: 'dns.resolution',
      source: 'client-1',
      destination: record.ip,
      description: `DNS lookup for ${domain} resolved to ${record.ip}.`,
      severity: 'info',
    });

    return { status: 'resolved', ip: record.ip };
  }

  getRandomAvailableServer() {
    const servers = this.nodes.filter((node) => node.type === 'server' && node.status === 'online');
    return servers[Math.floor(Math.random() * servers.length)] ?? null;
  }

  getNextServerForLoadBalancer() {
    const activeServers = this.nodes.filter((node) =>
      node.type === 'server' &&
      node.status === 'online' &&
      this.calculateRoute('load-balancer', node.id) !== null
    );
    if (!activeServers.length) return null;

    if (this.loadBalancerPolicy === 'round-robin') {
      const chosen = activeServers[this.roundRobinIndex % activeServers.length];
      this.roundRobinIndex += 1;
      return chosen;
    }

    if (this.loadBalancerPolicy === 'least-connections') {
      return [...activeServers].sort((a, b) => a.activeConnections - b.activeConnections)[0];
    }

    return activeServers[Math.floor(Math.random() * activeServers.length)];
  }

  private tickSimulation(simulatedDeltaMs: number) {
    if (this.status !== 'running') {
      return;
    }

    this.tickCounter += 1;
    this.simulationTimeMs += simulatedDeltaMs;
    this.recoverFailedLinks();
    this.advancePackets(simulatedDeltaMs);

    const ticksPerPacket = Math.max(1, Math.round(300 / (100 * this.speed)));
    if (this.tickCounter % ticksPerPacket === 0) {
      this.createPacket();
    }

    this.refreshMetrics();
  }

  private recoverFailedLinks() {
    for (const [linkId, recoveryTime] of this.linkRecoveryAt) {
      if (this.simulationTimeMs < recoveryTime) continue;

      this.linkRecoveryAt.delete(linkId);
      const link = this.links.find((entry) => entry.id === linkId);
      if (!link || link.status !== 'down') continue;

      const endpoints = [link.source, link.target].map((nodeId) => this.nodes.find((node) => node.id === nodeId));
      if (endpoints.some((node) => !node || node.status !== 'online')) {
        this.addEvent({
          id: createId('evt'),
          timestamp: Date.now(),
          type: 'fault.link-recovery-blocked',
          source: linkId,
          destination: 'network',
          description: `Link ${linkId} could not recover because one of its endpoint nodes is offline.`,
          severity: 'warning',
        });
        continue;
      }

      link.status = 'active';
      this.addEvent({
        id: createId('evt'),
        timestamp: Date.now(),
        type: 'link.restored',
        source: linkId,
        destination: 'network',
        description: `Link ${linkId} automatically recovered after 10 simulated seconds.`,
        severity: 'info',
      });
    }
  }

  private createPacket() {
    const clients = this.nodes.filter((node) => node.type === 'client' && node.status === 'online');
    const ticksPerPacket = Math.max(1, Math.round(300 / (100 * this.speed)));
    const clientIndex = Math.floor(this.tickCounter / ticksPerPacket) % clients.length;
    const client = clients[clientIndex];
    const targetServer = this.getNextServerForLoadBalancer();
    if (!client || !targetServer) return;

    const route = this.calculateRoute(client.id, targetServer.id);
    const packet: Packet = {
      id: `pkt-${Date.now()}-${this.tickCounter}`,
      source: client.ip,
      destination: targetServer.ip,
      protocol: this.tickCounter % 2 === 0 ? 'UDP' : 'TCP',
      size: 128 + (this.tickCounter % 80),
      currentNode: client.id,
      nextHop: route?.path[1] ?? null,
      route: route?.path ?? [client.id, targetServer.id],
      status: route ? 'in-transit' : 'dropped',
      createdAt: Date.now(),
      transmissionTime: 0,
      currentHopIndex: 0,
      segmentProgress: 0,
      activeLinkId: route ? this.getLinkBetween(client.id, route.path[1])?.id ?? null : null,
      completedAt: route ? null : Date.now(),
      attempt: 1,
      retryOf: null,
    };

    this.packets.push(packet);
    this.metrics.packetsTransmitted += 1;
    if (!route) {
      this.metrics.packetsDropped += 1;
      this.addEvent({
        id: createId('evt'),
        timestamp: Date.now(),
        type: 'packet.drop',
        source: client.id,
        destination: targetServer.id,
        description: 'Route unavailable; packet dropped before transmission.',
        severity: 'warning',
      });
      return;
    }

    this.addEvent({
      id: createId('evt'),
      timestamp: Date.now(),
      type: 'packet.created',
      source: client.id,
      destination: targetServer.id,
      description: `${packet.protocol} packet ${packet.id} started transmission on route: ${route.path.join(' → ')}.`,
      severity: 'info',
    });
  }

  private advancePackets(simulatedDeltaMs: number) {
    const inFlightByLink = new Map<string, number>();
    for (const packet of this.packets) {
      if (packet.status !== 'in-transit' && packet.status !== 'queued') continue;

      const fromId = packet.route[packet.currentHopIndex];
      const toId = packet.route[packet.currentHopIndex + 1];
      if (!fromId || !toId) {
        this.completePacket(packet);
        continue;
      }

      const link = this.getLinkBetween(fromId, toId);
      if (!link || link.status === 'down') {
        this.dropPacket(packet, `Packet ${packet.id} was dropped when link ${fromId} → ${toId} failed during transmission.`);
        continue;
      }

      packet.activeLinkId = link.id;
      packet.currentNode = fromId;
      packet.nextHop = toId;
      const inFlight = inFlightByLink.get(link.id) ?? 0;
      if (inFlight >= link.capacity) {
        packet.status = 'queued';
        continue;
      }
      packet.status = 'in-transit';
      inFlightByLink.set(link.id, (inFlightByLink.get(link.id) ?? 0) + 1);
      if (packet.status !== 'in-transit') continue;

      const queuedOnLink = this.packets.filter(
        (queuedPacket) => queuedPacket.activeLinkId === link.id && queuedPacket.status === 'queued',
      ).length;
      const transmissionDelay = Math.max(350, link.latency * 80) * (1 + queuedOnLink * 0.25);
      packet.segmentProgress += simulatedDeltaMs / transmissionDelay;
      packet.transmissionTime += simulatedDeltaMs;

      if (packet.segmentProgress >= 1) {
        packet.currentNode = toId;
        packet.currentHopIndex += 1;
        packet.segmentProgress = 0;
        const nextId = packet.route[packet.currentHopIndex + 1];
        packet.nextHop = nextId ?? null;
        packet.activeLinkId = nextId ? this.getLinkBetween(toId, nextId)?.id ?? null : null;

        if (!nextId) {
          this.completePacket(packet);
        } else {
          this.addEvent({
            id: createId('evt'),
            timestamp: Date.now(),
            type: 'packet.hop',
            source: toId,
            destination: packet.destination,
            description: `${packet.id} reached ${toId}; forwarding to ${nextId}.`,
            severity: 'info',
          });
        }
      }
    }

    const maxRetained = 30;
    if (this.packets.length > maxRetained) {
      this.packets = this.packets.slice(-maxRetained);
    }
    this.metrics.packetsPerSecond = Math.max(0, Math.min(120, this.metrics.packetsTransmitted / Math.max(1, this.tickCounter / 10)));
  }

  private completePacket(packet: Packet) {
    packet.status = 'received';
    packet.currentNode = packet.route[packet.route.length - 1] ?? packet.currentNode;
    packet.nextHop = null;
    packet.activeLinkId = null;
    packet.segmentProgress = 1;
    packet.completedAt = Date.now();
    this.metrics.packetsReceived += 1;
    this.addEvent({
      id: createId('evt'),
      timestamp: Date.now(),
      type: packet.protocol === 'TCP' ? 'tcp.received' : 'udp.received',
      source: packet.source,
      destination: packet.currentNode,
      description: `${packet.protocol} packet ${packet.id} was delivered after ${packet.route.length - 1} hops.`,
      severity: 'info',
    });
  }

  private dropPacket(packet: Packet, description: string) {
    if (packet.status === 'dropped') return;
    packet.status = 'dropped';
    packet.completedAt = Date.now();
    this.metrics.packetsDropped += 1;
    this.addEvent({
      id: createId('evt'),
      timestamp: Date.now(),
      type: 'packet.drop',
      source: packet.currentNode,
      destination: packet.destination,
      description,
      severity: 'critical',
    });
  }

  private reconcilePacketsAfterTopologyChange() {
    for (const packet of this.packets) {
      if (packet.status !== 'in-transit' && packet.status !== 'queued') continue;
      const fromId = packet.route[packet.currentHopIndex];
      const toId = packet.route[packet.currentHopIndex + 1];
      if (!fromId || !toId) continue;

      const currentLink = this.getLinkBetween(fromId, toId);
      if (!currentLink || currentLink.status === 'down') {
        this.dropPacket(packet, `${packet.id} was interrupted mid-flight when link ${fromId} → ${toId} failed.`);
        this.retransmitPacket(packet);
        continue;
      }

      const destination = this.nodes.find((node) => node.ip === packet.destination);
      if (!destination) {
        this.dropPacket(packet, `${packet.id} could not find its destination after the topology changed.`);
        continue;
      }

      const downstreamRoute = this.calculateRoute(toId, destination.id);
      const remainingLinksAvailable = packet.route
        .slice(packet.currentHopIndex + 1)
        .every((nodeId, index, remainingRoute) => {
          const nextId = remainingRoute[index + 1];
          if (!nextId) return true;
          const link = this.getLinkBetween(nodeId, nextId);
          return link?.status === 'active';
        });
      if (remainingLinksAvailable && destination.status === 'online') continue;

      const nextRoute = downstreamRoute;
      if (!nextRoute) {
        this.dropPacket(packet, `${packet.id} was dropped: no alternate route remained after the failure.`);
        this.retransmitPacket(packet);
        continue;
      }

      const oldRoute = packet.route.join(' → ');
      packet.route = packet.route.slice(0, packet.currentHopIndex + 2).concat(nextRoute.path.slice(1));
      packet.nextHop = packet.route[packet.currentHopIndex + 1] ?? null;
      packet.activeLinkId = this.getLinkBetween(fromId, toId)?.id ?? null;
      this.addEvent({
        id: createId('evt'),
        timestamp: Date.now(),
        type: 'route.recalculated',
        source: fromId,
        destination: destination.id,
        description: `${packet.id} rerouted from ${oldRoute} to ${packet.route.join(' → ')}.`,
        severity: 'warning',
      });
    }
  }

  private retransmitPacket(original: Packet) {
    if (original.attempt >= 3) {
      this.addEvent({
        id: createId('evt'),
        timestamp: Date.now(),
        type: 'packet.retry-exhausted',
        source: original.source,
        destination: original.destination,
        description: `${original.id} reached the retry limit; no more retransmissions will be attempted.`,
        severity: 'critical',
      });
      return;
    }

    const source = this.nodes.find((node) => node.ip === original.source && node.status === 'online');
    let destination = this.nodes.find((node) => node.ip === original.destination && node.status === 'online');
    let route = source && destination ? this.calculateRoute(source.id, destination.id) : null;

    if ((!destination || !route) && source) {
      const alternateServer = this.getNextServerForLoadBalancer();
      if (alternateServer) {
        destination = alternateServer;
        route = this.calculateRoute(source.id, alternateServer.id);
      }
    }

    if (!source || !destination || !route || route.path.length < 2) {
      this.addEvent({
        id: createId('evt'),
        timestamp: Date.now(),
        type: 'packet.retry-failed',
        source: original.source,
        destination: original.destination,
        description: `${original.id} could not be retransmitted because no alternate path or healthy destination was available.`,
        severity: 'critical',
      });
      return;
    }

    const retry: Packet = {
      ...original,
      id: `${original.id}-retry-${original.attempt + 1}`,
      destination: destination.ip,
      currentNode: source.id,
      nextHop: route.path[1],
      route: route.path,
      status: 'queued',
      createdAt: Date.now(),
      transmissionTime: 0,
      currentHopIndex: 0,
      segmentProgress: 0,
      activeLinkId: this.getLinkBetween(source.id, route.path[1])?.id ?? null,
      completedAt: null,
      attempt: original.attempt + 1,
      retryOf: original.id,
    };

    this.packets.push(retry);
    this.metrics.packetsTransmitted += 1;
    this.addEvent({
      id: createId('evt'),
      timestamp: Date.now(),
      type: 'packet.retransmit',
      source: source.id,
      destination: destination.id,
      description: `${original.id} failed; retransmitting as ${retry.id} over alternate route ${route.path.join(' → ')}.`,
      severity: 'warning',
    });
  }

  private getLinkBetween(fromId: string | undefined, toId: string | undefined) {
    if (!fromId || !toId) return undefined;
    return this.links.find((link) =>
      (link.source === fromId && link.target === toId) ||
      (link.source === toId && link.target === fromId)
    );
  }

  private refreshMetrics() {
    this.refreshLinkLoads();
    const activeServers = this.nodes.filter((node) => node.type === 'server' && node.status === 'online').length;
    const activeRouters = this.nodes.filter((node) => node.type === 'router' && node.status === 'online').length;
    const totalClients = this.nodes.filter((node) => node.type === 'client').length;
    const activeLinks = this.links.filter((link) => link.status === 'active').length;
    const avgLatency = this.links.filter((link) => link.status === 'active').reduce((total, link) => total + link.latency, 0) / Math.max(1, this.links.length);
    const activeUtilization = this.links.filter((link) => link.status === 'active');
    const avgUtilization = activeUtilization.reduce((total, link) => total + (link.utilization ?? 0), 0) / Math.max(1, activeUtilization.length);

    this.metrics = {
      totalClients,
      activeServers,
      activeRouters,
      packetsTransmitted: this.metrics.packetsTransmitted,
      packetsReceived: this.metrics.packetsReceived,
      packetsDropped: this.metrics.packetsDropped,
      networkLatency: Math.round(avgLatency),
      packetDeliveryRatio: this.metrics.packetsTransmitted > 0 ? Math.round((this.metrics.packetsReceived / this.metrics.packetsTransmitted) * 100) : 100,
      networkThroughput: Math.round((this.metrics.packetsReceived * 120) / Math.max(1, this.tickCounter + 1)),
      serverUtilization: Math.round((activeServers / Math.max(1, this.nodes.filter((n) => n.type === 'server').length)) * 100),
      bandwidthUtilization: Math.round(avgUtilization),
      activeConnections: this.packets.filter((packet) => packet.status === 'in-transit' || packet.status === 'queued').length,
      packetsPerSecond: this.metrics.packetsPerSecond,
      congestedLinks: this.links.filter((link) => link.congestionLevel === 'warning' || link.congestionLevel === 'critical').length,
    };
  }

  private refreshLinkLoads() {
    this.links.forEach((link) => {
      if (link.status === 'down') {
        link.utilization = 0;
        link.queueLength = 0;
        link.congestionLevel = 'normal';
        return;
      }

      const onLink = this.packets.filter(
        (packet) => packet.activeLinkId === link.id && (packet.status === 'in-transit' || packet.status === 'queued'),
      );
      const inFlight = onLink.filter((packet) => packet.status === 'in-transit').length;
      const queued = onLink.filter((packet) => packet.status === 'queued').length;
      const occupancy = inFlight + queued;
      link.queueLength = queued;
      link.utilization = Math.min(100, Math.round((occupancy / Math.max(1, link.capacity)) * 100));
      link.congestionLevel = queued > 0 || link.utilization >= 90
        ? 'critical'
        : link.utilization >= 60
          ? 'warning'
          : 'normal';
    });
  }

  calculateRoute(sourceId: string, targetId: string): RouteInfo | null {
    const adjacency = new Map<string, Array<{ destination: string; weight: number }>>();
    this.links.forEach((link) => {
      if (link.status === 'down') {
        return;
      }
      const source = link.source;
      const destination = link.target;
      const current = adjacency.get(source) ?? [];
      current.push({ destination, weight: link.latency + link.packetLoss });
      adjacency.set(source, current);
      const reverse = adjacency.get(destination) ?? [];
      reverse.push({ destination: source, weight: link.latency + link.packetLoss });
      adjacency.set(destination, reverse);
    });

    const distances = new Map<string, number>();
    const previous = new Map<string, string | null>();
    const visited = new Set<string>();
    const queue: Array<{ id: string; cost: number }> = [{ id: sourceId, cost: 0 }];

    distances.set(sourceId, 0);
    previous.set(sourceId, null);

    while (queue.length > 0) {
      queue.sort((a, b) => a.cost - b.cost);
      const current = queue.shift();
      if (!current) break;
      if (visited.has(current.id)) continue;
      visited.add(current.id);
      if (current.id === targetId) break;
      const neighbors = adjacency.get(current.id) ?? [];
      neighbors.forEach((neighbor) => {
        const nextCost = current.cost + neighbor.weight;
        const bestKnown = distances.get(neighbor.destination) ?? Number.POSITIVE_INFINITY;
        if (nextCost < bestKnown) {
          distances.set(neighbor.destination, nextCost);
          previous.set(neighbor.destination, current.id);
          queue.push({ id: neighbor.destination, cost: nextCost });
        }
      });
    }

    if (!distances.has(targetId)) {
      return null;
    }

    const path: string[] = [];
    let cursor: string | null = targetId;
    while (cursor) {
      path.unshift(cursor);
      cursor = previous.get(cursor) ?? null;
    }

    return {
      source: sourceId,
      target: targetId,
      path,
      cost: distances.get(targetId) ?? 0,
      hops: path.length - 1,
    };
  }

  private calculateAllRoutes(): RouteInfo[] {
    const routes: RouteInfo[] = [];
    const clients = this.nodes.filter((node) => node.type === 'client');
    const servers = this.nodes.filter((node) => node.type === 'server' && node.status === 'online');
    clients.forEach((client) => {
      servers.forEach((server) => {
        const route = this.calculateRoute(client.id, server.id);
        if (route) {
          routes.push(route);
        }
      });
    });
    return routes.slice(0, 12);
  }

  private addEvent(event: EventLog) {
    this.events.unshift(event);
    this.events = this.events.slice(0, 40);
    if (
      event.type.startsWith('fault.') ||
      event.type === 'packet.drop' ||
      event.type === 'packet.retransmit' ||
      event.type === 'packet.retry-failed' ||
      event.type === 'packet.retry-exhausted' ||
      event.type === 'route.recalculated' ||
      event.type === 'link.restored' ||
      event.type === 'fault.link-recovery-blocked'
    ) {
      this.lastAlert = event;
    }
  }
}
