import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, Line as DreiLine, OrbitControls } from '@react-three/drei';
import { motion } from 'framer-motion';
import type { Mesh } from 'three';
import {
  Activity,
  ArrowRight,
  Cloud,
  Cpu,
  Gauge,
  Globe,
  Network,
  RefreshCcw,
  Server,
  ShieldAlert,
  Signal,
  Wifi,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line as RechartsLine,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { io } from 'socket.io-client';
import type { NetworkLink, NetworkNode, Packet, SimulationSnapshot } from './types';
import { fetchSimulationState, setSimulationAction, setSimulationSpeed, triggerFault } from './services/api';

const navItems = [
  'Overview',
  '3D Network Topology',
  'Network Simulation',
  'Routing Management',
  'TCP/UDP Communication',
  'DNS Management',
  'Load Balancer',
  'Fault Simulation',
  'Performance Monitoring',
  'Simulation History',
  'Settings',
];

const defaultSnapshot: SimulationSnapshot = {
  status: 'running',
  speed: 1,
  loadBalancerPolicy: 'round-robin',
  nodes: [],
  links: [],
  dnsRecords: [],
  routes: [],
  packets: [],
  events: [],
  alert: null,
  metrics: {
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
  },
};

function formatTimestamp(value: number) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getNodeColor(node: NetworkNode) {
  if (node.status === 'offline') return '#ef4444';
  if (node.type === 'client') return '#60a5fa';
  if (node.type === 'router') return '#22c55e';
  if (node.type === 'switch') return '#38bdf8';
  if (node.type === 'firewall') return '#fb923c';
  if (node.type === 'dns') return '#a78bfa';
  if (node.type === 'load-balancer') return '#facc15';
  return '#2dd4bf';
}

function NetworkScene({ nodes, links, packets, selectedId, onSelect, highlightRoute, speed, onPacketSelect }: {
  nodes: NetworkNode[];
  links: NetworkLink[];
  packets: Packet[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  highlightRoute: string[];
  speed: number;
  onPacketSelect: (id: string) => void;
}) {
  return (
    <Canvas camera={{ position: [0, 23, 38], fov: 48 }}>
      <ambientLight intensity={1.2} />
      <directionalLight position={[10, 20, 10]} intensity={1.5} color="#8be9fd" />
      <pointLight position={[0, 0, 0]} intensity={2} color="#60a5fa" />
      <OrbitControls enablePan enableZoom enableRotate />

      {highlightRoute.length > 1 && (
        <DreiLine
          points={highlightRoute.map((nodeId) => {
            const node = nodes.find((item) => item.id === nodeId);
            return node ? [node.position.x, node.position.y, node.position.z] : [0, 0, 0];
          })}
          color="#34d399"
          lineWidth={4}
          transparent
          opacity={0.9}
        />
      )}

      {links.map((link) => {
        const sourceNode = nodes.find((node) => node.id === link.source);
        const targetNode = nodes.find((node) => node.id === link.target);
        if (!sourceNode || !targetNode) return null;
        const isOnPath = highlightRoute.some((nodeId, index) =>
          (nodeId === link.source && highlightRoute[index + 1] === link.target) ||
          (nodeId === link.target && highlightRoute[index + 1] === link.source)
        );
        const start = [sourceNode.position.x, sourceNode.position.y, sourceNode.position.z] as [number, number, number];
        const end = [targetNode.position.x, targetNode.position.y, targetNode.position.z] as [number, number, number];
        const midpoint = [
          (start[0] + end[0]) / 2,
          (start[1] + end[1]) / 2,
          (start[2] + end[2]) / 2,
        ] as [number, number, number];
        const gapStart = start.map((value, index) => value + (midpoint[index] - value) * 0.78) as [number, number, number];
        const gapEnd = end.map((value, index) => value + (midpoint[index] - value) * 0.78) as [number, number, number];
        return (
          <group key={link.id}>
            {link.status === 'down' ? (
              <>
                <DreiLine points={[start, gapStart]} color="#ef4444" lineWidth={3.5} transparent opacity={1} />
                <DreiLine points={[gapEnd, end]} color="#ef4444" lineWidth={3.5} transparent opacity={1} />
                <DreiLine
                  points={[
                    [midpoint[0] - 0.35, midpoint[1] - 0.35, midpoint[2]],
                    [midpoint[0] + 0.35, midpoint[1] + 0.35, midpoint[2]],
                  ]}
                  color="#fca5a5"
                  lineWidth={4}
                />
                <DreiLine
                  points={[
                    [midpoint[0] - 0.35, midpoint[1] + 0.35, midpoint[2]],
                    [midpoint[0] + 0.35, midpoint[1] - 0.35, midpoint[2]],
                  ]}
                  color="#fca5a5"
                  lineWidth={4}
                />
              </>
            ) : (
              <>
                <DreiLine
                  points={[start, end]}
                  color={link.congestionLevel === 'critical'
                    ? '#fb923c'
                    : link.congestionLevel === 'warning'
                      ? '#facc15'
                      : isOnPath
                        ? '#34d399'
                        : link.packetLoss > 15 ? '#fbbf24' : '#38bdf8'}
                  lineWidth={(link.utilization ?? 0) >= 60 ? 4 : isOnPath ? 3.5 : 2.2}
                  transparent
                  opacity={0.9}
                />
              </>
            )}
            <FailureFlash position={midpoint} visible={link.status === 'down'} />
            <CongestionPulse
              position={midpoint}
              level={link.congestionLevel ?? 'warning'}
              visible={link.status === 'active' && ((link.utilization ?? 0) >= 60 || (link.queueLength ?? 0) > 0)}
            />
            <Html
              position={[midpoint[0], midpoint[1] + (link.status === 'down' ? 1.15 : 0.9), midpoint[2]]}
              center
            >
              <div
                className={`rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${
                  link.status === 'down'
                    ? 'border-red-400/80 bg-red-950/95 text-red-100 shadow-[0_0_22px_rgba(239,68,68,0.8)]'
                    : link.congestionLevel === 'critical'
                      ? 'border-orange-400/60 bg-orange-950/90 text-orange-200'
                      : 'border-yellow-400/50 bg-yellow-950/90 text-yellow-100'
                }`}
                style={{
                  opacity: link.status === 'down' || (link.status === 'active' && ((link.utilization ?? 0) >= 60 || (link.queueLength ?? 0) > 0)) ? 1 : 0,
                  pointerEvents: 'none',
                  transition: 'opacity 100ms linear',
                }}
              >
                {link.status === 'down' ? 'LINK FAILED' : `${link.queueLength ? `QUEUE ${link.queueLength} · ` : ''}${Math.round(link.utilization ?? 0)}% LOAD`}
              </div>
            </Html>
          </group>
        );
      })}

      {packets.map((packet, index) => {
        const routeNodes = packet.route
          .map((id) => nodes.find((node) => node.id === id))
          .filter((node): node is NetworkNode => Boolean(node));
        if (routeNodes.length < 2) return null;

        const packetColor = packet.protocol === 'TCP' ? '#22d3ee' : '#a78bfa';

        return (
          <PacketOrbiter
            key={`${packet.id}-${index}`}
            packet={packet}
            routeNodes={routeNodes}
            color={packetColor}
            speed={speed}
            linkLatency={links.find((link) => link.id === packet.activeLinkId)?.latency ?? 12}
            onSelect={() => onPacketSelect(packet.id)}
          />
        );
      })}

      {nodes.map((node) => {
        const isSelected = selectedId === node.id;
        const color = getNodeColor(node);
        const size = node.type === 'client' ? 0.9 : node.type === 'router' ? 1.2 : node.type === 'server' ? 1.5 : 1.25;

        return (
          <group key={node.id} position={[node.position.x, node.position.y, node.position.z]}>
            <mesh
              scale={isSelected ? size + 0.3 : size}
              onClick={() => onSelect(node.id)}
              onPointerOver={(event) => {
                event.stopPropagation();
              }}
            >
              {node.type === 'client' && <boxGeometry args={[1.25, 0.8, 0.45]} />}
              {node.type === 'router' && <cylinderGeometry args={[1, 1, 0.45, 8]} />}
              {node.type === 'switch' && <boxGeometry args={[1.3, 0.6, 1.1]} />}
              {node.type === 'firewall' && <boxGeometry args={[1.2, 1.4, 0.7]} />}
              {node.type === 'server' && <boxGeometry args={[1.15, 1.8, 0.85]} />}
              {node.type === 'dns' && <dodecahedronGeometry args={[1.1, 0]} />}
              {node.type === 'load-balancer' && <octahedronGeometry args={[1.1, 0]} />}
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={isSelected ? 2.1 : 1.2}
                metalness={0.25}
                roughness={0.4}
              />
            </mesh>
            {node.type === 'client' && (
              <mesh position={[0, 0, 0.24]}>
                <boxGeometry args={[0.84, 0.47, 0.035]} />
                <meshBasicMaterial color="#bfdbfe" />
              </mesh>
            )}
            {node.type === 'server' && [-0.48, 0, 0.48].map((slot) => (
              <group key={slot} position={[0, slot, 0.66]}>
                <mesh>
                  <boxGeometry args={[0.82, 0.19, 0.04]} />
                  <meshStandardMaterial color="#0f172a" />
                </mesh>
                <mesh position={[0.31, 0, 0.04]}>
                  <sphereGeometry args={[0.055, 8, 8]} />
                  <meshStandardMaterial
                    color={node.status === 'offline' ? '#ef4444' : '#4ade80'}
                    emissive={node.status === 'offline' ? '#ef4444' : '#4ade80'}
                    emissiveIntensity={2}
                  />
                </mesh>
              </group>
            ))}
            {node.type === 'router' && [-0.45, -0.15, 0.15, 0.45].map((port) => (
              <mesh key={port} position={[port, -0.05, 1.2]}>
                <boxGeometry args={[0.12, 0.18, 0.08]} />
                <meshStandardMaterial color="#86efac" emissive="#4ade80" emissiveIntensity={1.5} />
              </mesh>
            ))}
            {node.type === 'switch' && [-0.4, -0.15, 0.15, 0.4].map((port) => (
              <mesh key={port} position={[port, -0.38, 0.58]}>
                <boxGeometry args={[0.1, 0.08, 0.05]} />
                <meshBasicMaterial color="#a5f3fc" />
              </mesh>
            ))}
            <Html position={[0, 2.2, 0]} center>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: '#e2e8f0',
                  background: 'rgba(15, 23, 42, 0.84)',
                  border: '1px solid rgba(74, 222, 128, 0.35)',
                  borderRadius: '999px',
                  padding: '4px 8px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 0 16px rgba(34, 211, 238, 0.3)',
                }}
              >
                {node.name}
              </div>
            </Html>
          </group>
        );
      })}
    </Canvas>
  );
}

function PacketOrbiter({ packet, routeNodes, color, speed, linkLatency, onSelect }: {
  packet: Packet;
  routeNodes: NetworkNode[];
  color: string;
  speed: number;
  linkLatency: number;
  onSelect: () => void;
}) {
  const ref = useRef<Mesh>(null);
  const progress = useRef(packet.segmentProgress);

  useEffect(() => {
    progress.current = packet.segmentProgress;
  }, [packet.segmentProgress]);

  useFrame((_, delta) => {
    if (!ref.current || routeNodes.length < 2) return;
    const segmentIndex = Math.min(routeNodes.length - 2, Math.max(0, packet.currentHopIndex));
    const fromNode = routeNodes[segmentIndex];
    const toNode = routeNodes[segmentIndex + 1];
    if (packet.status === 'in-transit') {
      progress.current = Math.min(1, progress.current + (delta * 1000 * speed) / Math.max(350, linkLatency * 80));
    } else {
      progress.current = packet.segmentProgress;
    }
    const queuedOffset = 0.07 + (packet.id.charCodeAt(packet.id.length - 1) % 4) * 0.06;
    const eased = packet.status === 'queued' ? queuedOffset : progress.current;
    const x = fromNode.position.x + (toNode.position.x - fromNode.position.x) * eased;
    const y = 0.8 + Math.sin(eased * Math.PI) * 1.1;
    const z = fromNode.position.z + (toNode.position.z - fromNode.position.z) * eased;
    ref.current.position.set(x, y, z);
  });

  return (
    <mesh ref={ref} onClick={(event) => {
      event.stopPropagation();
      onSelect();
    }}>
      <sphereGeometry args={[packet.status === 'in-transit' ? 0.22 : 0.28, 16, 16]} />
      <meshStandardMaterial
        color={packet.status === 'dropped' ? '#ef4444' : packet.status === 'received' ? '#34d399' : color}
        emissive={packet.status === 'dropped' ? '#ef4444' : packet.status === 'received' ? '#34d399' : color}
        emissiveIntensity={2.8}
      />
    </mesh>
  );
}

function FailureFlash({ position, visible }: { position: [number, number, number]; visible: boolean }) {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const pulse = 0.55 + Math.abs(Math.sin(clock.elapsedTime * 7)) * 0.35;
    ref.current.scale.setScalar(pulse);
  });

  return (
    <mesh ref={ref} visible={visible} position={[position[0], position[1] + 0.2, position[2]]}>
      <octahedronGeometry args={[0.45, 0]} />
      <meshBasicMaterial color="#fb7185" wireframe />
    </mesh>
  );
}

function CongestionPulse({ position, level, visible }: { position: [number, number, number]; level: 'normal' | 'warning' | 'critical'; visible: boolean }) {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const pulse = 0.75 + Math.abs(Math.sin(clock.elapsedTime * 5)) * 0.5;
    ref.current.scale.setScalar(pulse);
  });

  const color = level === 'critical' ? '#fb923c' : '#facc15';
  return (
    <mesh ref={ref} visible={visible} position={[position[0], position[1] + 0.25, position[2]]}>
      <sphereGeometry args={[0.22, 12, 12]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

function App() {
  const [snapshot, setSnapshot] = useState<SimulationSnapshot>(defaultSnapshot);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedPacketId, setSelectedPacketId] = useState<string | null>(null);
  const [selectedRouteKey, setSelectedRouteKey] = useState<string | null>(null);
  const topologyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadState = async () => {
      try {
        const next = await fetchSimulationState();
        setSnapshot(next);
        if (next.nodes[0]) {
          setSelectedNode(next.nodes[0].id);
        }
      } catch {
        setSnapshot(defaultSnapshot);
      }
    };

    void loadState();

    const socket = io('http://localhost:4000', { transports: ['websocket'] });
    socket.on('simulation:update', (next: SimulationSnapshot) => {
      setSnapshot(next);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const chartData = useMemo(() => {
    const packets = snapshot.metrics.packetsReceived || 1;
    return [
      { name: '01m', throughput: Math.max(25, snapshot.metrics.networkThroughput * 0.7), latency: Math.max(10, snapshot.metrics.networkLatency), loss: 2 },
      { name: '05m', throughput: Math.max(30, snapshot.metrics.networkThroughput), latency: Math.max(12, snapshot.metrics.networkLatency + 5), loss: 3 },
      { name: '10m', throughput: Math.max(36, snapshot.metrics.networkThroughput * 1.2), latency: Math.max(14, snapshot.metrics.networkLatency + 8), loss: 4 },
      { name: '15m', throughput: Math.max(42, snapshot.metrics.networkThroughput * 1.4), latency: Math.max(16, snapshot.metrics.networkLatency + 10), loss: 4 },
      { name: 'now', throughput: Math.max(50, snapshot.metrics.networkThroughput * 1.7), latency: Math.max(18, snapshot.metrics.networkLatency + 12), loss: Math.max(2, Math.round((packetLossFactor(snapshot.metrics.packetsDropped, packets) * 10) / 10)) },
    ];
  }, [snapshot]);

  const protocolData = useMemo(() => [
    { name: 'TCP', value: Math.max(38, Math.round(snapshot.metrics.packetsReceived * 0.65)) },
    { name: 'UDP', value: Math.max(24, Math.round(snapshot.metrics.packetsReceived * 0.35)) },
  ], [snapshot]);

  const selectedNodeData = snapshot.nodes.find((node) => node.id === selectedNode) ?? snapshot.nodes[0];
  const visualizedPacket = snapshot.packets.find((packet) => packet.id === selectedPacketId)
    ?? [...snapshot.packets].reverse().find((packet) => packet.status === 'in-transit')
    ?? snapshot.packets[snapshot.packets.length - 1];
  const routeRows = useMemo(() => {
    const clients = snapshot.nodes.filter((node) => node.type === 'client');
    const servers = snapshot.nodes.filter((node) => node.type === 'server');
    return clients.flatMap((client) => servers.map((server) => ({
      source: client,
      destination: server,
      route: snapshot.routes.find((route) => route.source === client.id && route.target === server.id) ?? null,
    })));
  }, [snapshot.nodes, snapshot.routes]);
  const selectedRouteRow = routeRows.find((row) => `${row.source.id}|${row.destination.id}` === selectedRouteKey);
  const highlightedRoute = useMemo(() => {
    if (selectedRouteKey) return selectedRouteRow?.route?.path ?? [];
    if (visualizedPacket) return visualizedPacket.route;
    if (!selectedNodeData) return [];
    const target = snapshot.nodes.find((node) => node.type === 'server' && node.status === 'online');
    if (!target) return [];
    const matched = snapshot.routes.find((route) => route.source === selectedNodeData.id && route.target === target.id);
    return matched?.path ?? [];
  }, [selectedNodeData, snapshot.nodes, snapshot.routes, visualizedPacket, selectedRouteKey, selectedRouteRow]);
  const routeSummary = selectedRouteKey
    ? selectedRouteRow?.route ?? null
    : highlightedRoute.length > 1
      ? snapshot.routes.find((route) => route.path.join('-') === highlightedRoute.join('-')) ?? null
      : snapshot.routes[0];
  const activePacketLinkId = visualizedPacket?.activeLinkId
    ?? snapshot.links.find((link) =>
      highlightedRoute.length > 1 &&
      ((link.source === highlightedRoute[0] && link.target === highlightedRoute[1]) ||
        (link.target === highlightedRoute[0] && link.source === highlightedRoute[1]))
    )?.id
    ?? 'link-c1-r1';
  const networkAlert = snapshot.alert ?? snapshot.events.find((event) =>
    ['fault.link', 'fault.router', 'fault.server', 'fault.congestion', 'packet.drop', 'packet.retransmit', 'packet.retry-failed', 'route.recalculated', 'link.restored', 'fault.link-recovery-blocked'].includes(event.type)
  );

  const handleAction = async (action: 'start' | 'pause' | 'stop' | 'reset') => {
    const next = await setSimulationAction(action);
    setSnapshot(next);
  };

  const handleSpeed = async (speed: number) => {
    const next = await setSimulationSpeed(speed);
    setSnapshot(next);
  };

  const handleFault = async (type: string, target: string) => {
    const next = await triggerFault(type, target);
    setSnapshot(next);
    if (type === 'link-failure') {
      const interruptedPacket = [...next.packets].reverse().find(
        (packet) => packet.status === 'dropped' && packet.activeLinkId === target,
      );
      if (interruptedPacket) {
        const retry = next.packets.find((packet) => packet.retryOf === interruptedPacket.id);
        setSelectedPacketId(retry?.id ?? interruptedPacket.id);
        setSelectedRouteKey(null);
      }
    }
  };

  const handleNodeSelect = (nodeId: string) => {
    setSelectedNode(nodeId);
    const node = snapshot.nodes.find((entry) => entry.id === nodeId);
    const route = node?.type === 'client'
      ? snapshot.routes.find((entry) => entry.source === nodeId)
      : node?.type === 'server'
        ? snapshot.routes.find((entry) => entry.target === nodeId)
        : snapshot.routes.find((entry) => entry.path.includes(nodeId));
    setSelectedRouteKey(route ? `${route.source}|${route.target}` : null);
  };

  const handleTraceRoute = (sourceId: string, destinationId: string) => {
    setSelectedRouteKey(`${sourceId}|${destinationId}`);
    setSelectedNode(sourceId);
    setSelectedPacketId(null);
    topologyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 flex-col border-r border-slate-800 bg-slate-950/80 p-5 lg:flex">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400 shadow-[0_0_32px_rgba(6,182,212,0.5)]">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-50">MiniCloudNet</h1>
              <p className="text-xs text-slate-400">Network simulator</p>
            </div>
          </div>

          <nav className="space-y-2">
            {navItems.map((item, index) => (
              <button
                key={item}
                type="button"
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition ${index === 0 ? 'bg-cyan-500/10 text-cyan-300' : 'text-slate-300 hover:bg-slate-900'}`}
              >
                <span>{item}</span>
                {index === 0 && <ArrowRight className="h-4 w-4" />}
              </button>
            ))}
          </nav>

          <div className="mt-auto rounded-2xl border border-cyan-400/30 bg-cyan-500/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em] text-cyan-300">System</span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-300">Live</span>
            </div>
            <p className="text-sm text-slate-300">Fault-tolerant cloud topology is active and routing tables are being refreshed in real time.</p>
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-6 xl:p-7">
          <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-4 backdrop-blur md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">Cloud command center</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">3D Cloud Network Simulation</h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-300">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                System status: {snapshot.status}
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-300">
                <Signal className="h-4 w-4 text-cyan-300" />
                Sim time: {formatTimestamp(Date.now())}
              </div>
              <button type="button" onClick={() => handleAction('start')} className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400">Start</button>
              <button type="button" onClick={() => handleAction('pause')} className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-100 hover:border-slate-500">Pause</button>
              <button type="button" onClick={() => handleAction('reset')} className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-100 hover:border-slate-500">Reset</button>
            </div>
          </header>

          {networkAlert && (
            <div role="status" className={`mb-6 flex items-start gap-3 rounded-2xl border p-4 ${
              networkAlert.severity === 'critical'
                ? 'border-red-400/40 bg-red-500/10 text-red-100'
                : networkAlert.severity === 'warning'
                  ? 'border-orange-400/40 bg-orange-500/10 text-orange-100'
                  : 'border-cyan-400/30 bg-cyan-500/5 text-cyan-100'
            }`}>
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.2em]">
                  {networkAlert.type === 'packet.retransmit' ? 'Packet retransmission' : networkAlert.type === 'route.recalculated' ? 'Route recovered' : networkAlert.type === 'link.restored' ? 'Link restored' : networkAlert.type === 'fault.congestion' ? 'Traffic congestion detected' : 'Network failure detected'}
                  <span className="ml-2 font-normal normal-case tracking-normal opacity-70">{formatTimestamp(networkAlert.timestamp)}</span>
                </p>
                <p className="mt-1 text-sm">{networkAlert.description}</p>
              </div>
              <span className="shrink-0 rounded-full border border-current/20 px-2 py-1 text-[10px] uppercase">{networkAlert.severity}</span>
            </div>
          )}

          <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            {[
              { label: 'Total Clients', value: snapshot.metrics.totalClients, icon: <Wifi className="h-4 w-4 text-cyan-300" /> },
              { label: 'Active Servers', value: snapshot.metrics.activeServers, icon: <Server className="h-4 w-4 text-emerald-300" /> },
              { label: 'Active Routers', value: snapshot.metrics.activeRouters, icon: <Network className="h-4 w-4 text-violet-300" /> },
              { label: 'Packets Transmitted', value: snapshot.metrics.packetsTransmitted, icon: <Activity className="h-4 w-4 text-sky-300" /> },
              { label: 'Packet Delivery', value: `${snapshot.metrics.packetDeliveryRatio}%`, icon: <Gauge className="h-4 w-4 text-amber-300" /> },
              { label: 'Congested Links', value: snapshot.metrics.congestedLinks, icon: <Activity className="h-4 w-4 text-orange-300" /> },
            ].map((card) => (
              <motion.div key={card.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-[0_0_30px_rgba(14,116,144,0.15)]">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{card.label}</span>
                  {card.icon}
                </div>
                <div className="text-3xl font-semibold text-white">{card.value}</div>
              </motion.div>
            ))}
          </section>

          <section className="mb-6 grid gap-6 xl:grid-cols-[1.8fr_1fr]">
            <div ref={topologyRef} className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Topology</p>
                  <h3 className="mt-1 text-xl font-semibold text-white">3D Cloud Infrastructure</h3>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
                  <RefreshCcw className="h-4 w-4 text-cyan-300" />
                  Route health: {snapshot.metrics.packetDeliveryRatio}%
                </div>
                <div className={`rounded-xl border px-3 py-2 text-xs ${snapshot.metrics.congestedLinks > 0 ? 'border-orange-400/40 bg-orange-500/10 text-orange-200' : 'border-slate-700 bg-slate-950/70 text-slate-300'}`}>
                  Congested links: {snapshot.metrics.congestedLinks}
                </div>
              </div>
              {selectedRouteKey && selectedRouteRow?.route && (
                <div role="status" className="mb-3 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200">
                    Tracing route: {selectedRouteRow.source.name} → {selectedRouteRow.destination.name}
                  </p>
                  <p className="mt-1 text-xs text-emerald-100">
                    {selectedRouteRow.route.path.map((nodeId) => snapshot.nodes.find((node) => node.id === nodeId)?.name ?? nodeId).join(' → ')}
                  </p>
                  <p className="mt-1 text-[11px] text-emerald-300">
                    {selectedRouteRow.route.hops} hops · cost {selectedRouteRow.route.cost}
                  </p>
                </div>
              )}
              <div className="h-[420px] overflow-hidden rounded-2xl border border-slate-800 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.15),_transparent_40%),linear-gradient(160deg,_#020817,_#0b1220)]">
                <NetworkScene
                  nodes={snapshot.nodes}
                  links={snapshot.links}
                  packets={snapshot.packets}
                  selectedId={selectedNode}
                  onSelect={handleNodeSelect}
                  highlightRoute={highlightedRoute}
                  speed={snapshot.speed}
                  onPacketSelect={setSelectedPacketId}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 px-1 text-[11px] uppercase tracking-wider text-slate-400">
                <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-cyan-300" />Live packet</span>
                <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-emerald-400" />Active route</span>
                <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-red-400" />Failed link</span>
                <span>Click a packet to inspect it · drag to orbit · scroll to zoom</span>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Selected node</p>
                {selectedNodeData ? (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{selectedNodeData.name}</h3>
                        <p className="text-sm text-slate-400">{selectedNodeData.type}</p>
                      </div>
                      <span className="rounded-full px-2 py-1 text-xs font-medium text-slate-950" style={{ backgroundColor: getNodeColor(selectedNodeData) }}>
                        {selectedNodeData.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
                      <div><span className="text-slate-500">IP</span><div>{selectedNodeData.ip}</div></div>
                      <div><span className="text-slate-500">Latency</span><div>{selectedNodeData.latency} ms</div></div>
                      <div><span className="text-slate-500">CPU</span><div>{selectedNodeData.cpu}%</div></div>
                      <div><span className="text-slate-500">Memory</span><div>{selectedNodeData.memory}%</div></div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-slate-400">No node selected.</p>
                )}
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Packet inspection</p>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  {visualizedPacket ? (
                    <>
                      <div className="flex items-center justify-between"><span>Packet ID</span><strong>{visualizedPacket.id}</strong></div>
                      <div className="flex items-center justify-between"><span>Protocol</span><strong>{visualizedPacket.protocol}</strong></div>
                      <div className="flex items-center justify-between"><span>Current node</span><strong>{snapshot.nodes.find((node) => node.id === visualizedPacket.currentNode)?.name ?? visualizedPacket.currentNode}</strong></div>
                      <div className="flex items-center justify-between"><span>Next hop</span><strong>{visualizedPacket.nextHop ? snapshot.nodes.find((node) => node.id === visualizedPacket.nextHop)?.name ?? visualizedPacket.nextHop : 'Complete'}</strong></div>
                      <div className="flex items-center justify-between"><span>Status</span><strong className={visualizedPacket.status === 'dropped' ? 'text-red-300' : visualizedPacket.status === 'in-transit' ? 'text-cyan-300' : 'text-emerald-300'}>{visualizedPacket.status}</strong></div>
                      <div className="flex items-center justify-between"><span>Transmission attempt</span><strong>{visualizedPacket.attempt}{visualizedPacket.retryOf ? ` · retry of ${visualizedPacket.retryOf}` : ''}</strong></div>
                      <div className="mt-2">
                        <div className="mb-1 flex justify-between text-xs text-slate-500">
                          <span>Current-link transmission</span>
                          <span>{Math.round(visualizedPacket.segmentProgress * 100)}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className={`h-full rounded-full transition-[width] duration-100 ${visualizedPacket.status === 'dropped' ? 'bg-red-400' : 'bg-cyan-300'}`}
                            style={{ width: `${Math.min(100, Math.round(visualizedPacket.segmentProgress * 100))}%` }}
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-1">
                        {visualizedPacket.route.map((nodeId, index) => {
                          const reached = index < visualizedPacket.currentHopIndex ||
                            (visualizedPacket.status === 'received' && index === visualizedPacket.route.length - 1);
                          const current = index === visualizedPacket.currentHopIndex && visualizedPacket.status === 'in-transit';
                          return (
                            <span key={`${visualizedPacket.id}-${nodeId}`} className="flex items-center gap-1">
                              <span className={`rounded-md border px-1.5 py-1 text-[10px] ${reached ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : current ? 'border-cyan-400/50 bg-cyan-500/10 text-cyan-100' : 'border-slate-700 text-slate-500'}`}>
                                {snapshot.nodes.find((node) => node.id === nodeId)?.name ?? nodeId}
                              </span>
                              {index < visualizedPacket.route.length - 1 && <span className="text-slate-600">→</span>}
                            </span>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="text-slate-400">Start the simulation to watch packets travel node by node.</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="mb-6 grid gap-6 xl:grid-cols-3">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Traffic overview</p>
                <Cpu className="h-4 w-4 text-cyan-300" />
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="trafficFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="throughput" stroke="#67e8f9" fill="url(#trafficFill)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Latency</p>
                <Signal className="h-4 w-4 text-violet-300" />
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                    <Tooltip />
                    <RechartsLine type="monotone" dataKey="latency" stroke="#c084fc" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Protocol mix</p>
                <Globe className="h-4 w-4 text-emerald-300" />
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={protocolData}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                      {protocolData.map((entry) => (
                        <Cell key={entry.name} fill={entry.name === 'TCP' ? '#22d3ee' : '#c084fc'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="mb-6 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Routing management</p>
                <h3 className="mt-1 text-lg font-semibold text-white">Client-to-server route summary</h3>
              </div>
              <p className="text-xs text-slate-400">Select a route to trace its current path on the 3D topology. Routes refresh after failures.</p>
            </div>
            <div className="max-h-96 overflow-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Source node</th>
                    <th className="px-4 py-3 font-medium">Destination</th>
                    <th className="px-4 py-3 font-medium">Current path</th>
                    <th className="px-4 py-3 font-medium">Hops</th>
                    <th className="px-4 py-3 font-medium">Cost</th>
                    <th className="px-4 py-3 font-medium">Route status</th>
                    <th className="px-4 py-3 font-medium">Trace</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {routeRows.map(({ source, destination, route }) => {
                    const key = `${source.id}|${destination.id}`;
                    const isSelected = selectedRouteKey === key;
                    return (
                      <tr key={key} className={isSelected ? 'bg-cyan-500/10' : 'hover:bg-slate-800/40'}>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-200">{source.name}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-200">{destination.name}</td>
                        <td className="px-4 py-3 text-xs text-slate-300">
                          {route
                            ? route.path.map((nodeId) => snapshot.nodes.find((node) => node.id === nodeId)?.name ?? nodeId).join(' → ')
                            : 'No available path'}
                        </td>
                        <td className="px-4 py-3 text-slate-300">{route?.hops ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-300">{route?.cost ?? '—'}</td>
                        <td className={`whitespace-nowrap px-4 py-3 ${route ? 'text-emerald-300' : 'text-red-300'}`}>
                          {route ? 'Available' : destination.status === 'offline' ? 'Server offline' : 'Unreachable'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            disabled={!route}
                            onClick={() => handleTraceRoute(source.id, destination.id)}
                            className="rounded-lg border border-cyan-400/40 px-2.5 py-1 text-xs text-cyan-200 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {isSelected ? 'Selected' : 'Trace route'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">TCP / UDP / DNS / Fault controls</p>
                <ShieldAlert className="h-4 w-4 text-amber-300" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="mb-3 text-sm font-medium text-slate-200">Simulation controls</p>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 5, 10].map((speed) => (
                      <button key={speed} type="button" onClick={() => handleSpeed(speed)} className={`rounded-lg border px-3 py-1.5 text-sm ${snapshot.speed === speed ? 'border-cyan-400 bg-cyan-500/10 text-cyan-200' : 'border-slate-700 text-slate-300'}`}>
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="mb-3 text-sm font-medium text-slate-200">DNS resolution</p>
                  <div className="space-y-2 text-sm text-slate-300">
                    {snapshot.dnsRecords.map((record) => (
                      <div key={record.id} className="flex justify-between rounded-lg border border-slate-700 bg-slate-900 px-2 py-2">
                        <span>{record.domain}</span>
                        <span className="text-cyan-300">{record.ip}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="mb-3 text-sm font-medium text-slate-200">Fault actions</p>
                  <div className="space-y-2">
                    <button type="button" onClick={() => handleFault('server-failure', 'server-1')} className="w-full rounded-lg bg-red-500/15 px-3 py-2 text-left text-sm text-red-200">Server failure</button>
                    <button type="button" onClick={() => handleFault('router-failure', 'router-1')} className="w-full rounded-lg bg-orange-500/15 px-3 py-2 text-left text-sm text-orange-200">Router failure</button>
                    <button type="button" onClick={() => handleFault('link-failure', activePacketLinkId)} className="w-full rounded-lg bg-yellow-500/15 px-3 py-2 text-left text-sm text-yellow-200">Fail active link (recovers after 10s)</button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="mb-3 text-sm font-medium text-slate-200">Traffic congestion</p>
                  <button type="button" onClick={() => handleFault('congestion', 'core-switch')} className="mb-3 w-full rounded-lg bg-orange-500/15 px-3 py-2 text-left text-sm text-orange-200">Load the core switch link</button>
                  <p className="mb-2 text-xs text-slate-500">Live packets / link capacity</p>
                  <div className="space-y-2">
                    {[...snapshot.links]
                      .filter((link) => (link.utilization ?? 0) > 0 || (link.queueLength ?? 0) > 0)
                      .sort((left, right) => (right.utilization ?? 0) - (left.utilization ?? 0))
                      .slice(0, 4)
                      .map((link) => {
                        const sourceName = snapshot.nodes.find((node) => node.id === link.source)?.name ?? link.source;
                        const targetName = snapshot.nodes.find((node) => node.id === link.target)?.name ?? link.target;
                        const barColor = link.congestionLevel === 'critical' ? 'bg-orange-400' : link.congestionLevel === 'warning' ? 'bg-yellow-300' : 'bg-cyan-300';
                        return (
                          <div key={link.id}>
                            <div className="mb-1 flex justify-between gap-2 text-[11px] text-slate-400">
                              <span className="truncate">{sourceName} → {targetName}</span>
                              <span>{link.queueLength ?? 0} queued · {link.utilization ?? 0}%</span>
                            </div>
                            <div className="h-1 overflow-hidden rounded-full bg-slate-800">
                              <div className={`h-full ${barColor}`} style={{ width: `${link.utilization ?? 0}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    {snapshot.links.every((link) => (link.utilization ?? 0) === 0 && (link.queueLength ?? 0) === 0) && (
                      <p className="text-xs text-slate-500">Waiting for active packet traffic.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="mb-3 text-sm font-medium text-slate-200">Selected route summary</p>
                  {routeSummary ? (
                    <div className="space-y-2 text-sm text-slate-300">
                        <div className="flex justify-between"><span>Path</span><span>{routeSummary.path.map((nodeId) => snapshot.nodes.find((node) => node.id === nodeId)?.name ?? nodeId).join(' → ')}</span></div>
                      <div className="flex justify-between"><span>Hops</span><span>{routeSummary.hops}</span></div>
                      <div className="flex justify-between"><span>Cost</span><span>{routeSummary.cost}</span></div>
                    </div>
                  ) : (
                    <p className="text-slate-400">No route available.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Event log</p>
              <div className="mt-4 space-y-3">
                {snapshot.events.slice(0, 8).map((event) => (
                  <div key={event.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                      <span>{formatTimestamp(event.timestamp)}</span>
                      <span className={`rounded-full px-2 py-0.5 ${event.severity === 'critical' ? 'bg-red-500/15 text-red-200' : event.severity === 'warning' ? 'bg-orange-500/15 text-orange-200' : 'bg-emerald-500/15 text-emerald-200'}`}>
                        {event.severity}
                      </span>
                    </div>
                    <div className="text-sm text-slate-200">{event.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function packetLossFactor(dropped: number, received: number) {
  if (received === 0) return 0;
  return dropped / received;
}

export default App;
