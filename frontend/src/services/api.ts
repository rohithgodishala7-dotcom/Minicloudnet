import type { SimulationSnapshot } from '../types';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchSimulationState(): Promise<SimulationSnapshot> {
  return request<SimulationSnapshot>('/state');
}

export async function setSimulationAction(action: 'start' | 'pause' | 'stop' | 'reset', value?: number) {
  const body = value !== undefined ? { speed: value } : {};
  return request<SimulationSnapshot>(`/${action}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function setSimulationSpeed(speed: number) {
  return request<SimulationSnapshot>('/speed', {
    method: 'POST',
    body: JSON.stringify({ speed }),
  });
}

export async function triggerFault(type: string, target: string) {
  return request<SimulationSnapshot>('/fault', {
    method: 'POST',
    body: JSON.stringify({ type, target }),
  });
}
