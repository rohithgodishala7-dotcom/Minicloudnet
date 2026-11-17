export type SimulationStatus = 'idle' | 'running' | 'paused';
export type LinkStatus = 'active' | 'down';
export type LoadBalancerPolicy = 'round-robin' | 'least-connections' | 'random';

export interface NodePosition {
  x: number;
  y: number;
  z: number;
}

export interface NetworkNode {
  id: string;
  name: string;
  type: 'client' | 'router' | 'switch' | 'firewall' | 'server' | 'dns' | 'load-balancer';
  ip: string;
  status: 'online' | 'offline';
  position: NodePosition;
  bandwidth: number;
  latency: number;
  cpu: number;
  memory: number;
  activeConnections: number;
  packetLoss: number;
}

export interface NetworkLink {
  id: string;
  source: string;
  target: string;
  bandwidth: number;
  latency: number;
  capacity: number;
  packetLoss: number;
  status: LinkStatus;
  utilization?: number;
  queueLength?: number;
  congestionLevel?: 'normal' | 'warning' | 'critical';
}

export interface DNSRecord {
  id: string;
  domain: string;
  ip: string;
  type: 'A';
  ttl: number;
}

export interface Packet {
  id: string;
  source: string;
  destination: string;
  protocol: 'TCP' | 'UDP';
  size: number;
  currentNode: string;
  nextHop: string | null;
  route: string[];
  status: 'queued' | 'in-transit' | 'received' | 'dropped';
  createdAt: number;
  transmissionTime: number;
  currentHopIndex: number;
  segmentProgress: number;
  activeLinkId: string | null;
  completedAt: number | null;
  attempt: number;
  retryOf: string | null;
}

export interface EventLog {
  id: string;
  timestamp: number;
  type: string;
  source: string;
  destination: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface RouteInfo {
  source: string;
  target: string;
  path: string[];
  cost: number;
  hops: number;
}

export interface SimulationMetrics {
  totalClients: number;
  activeServers: number;
  activeRouters: number;
  packetsTransmitted: number;
  packetsReceived: number;
  packetsDropped: number;
  networkLatency: number;
  packetDeliveryRatio: number;
  networkThroughput: number;
  serverUtilization: number;
  bandwidthUtilization: number;
  activeConnections: number;
  packetsPerSecond: number;
  congestedLinks: number;
}

export interface SimulationSnapshot {
  status: SimulationStatus;
  speed: number;
  loadBalancerPolicy: LoadBalancerPolicy;
  nodes: NetworkNode[];
  links: NetworkLink[];
  dnsRecords: DNSRecord[];
  routes: RouteInfo[];
  packets: Packet[];
  events: EventLog[];
  alert: EventLog | null;
  metrics: SimulationMetrics;
}
