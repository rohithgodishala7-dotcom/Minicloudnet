import type { Server as SocketIOServer } from 'socket.io';
import type { NetworkEngine } from '../simulation/NetworkEngine.js';

export function registerSocketEvents(io: SocketIOServer, engine: NetworkEngine) {
  io.on('connection', (socket) => {
    socket.emit('simulation:update', engine.getSnapshot());

    socket.on('simulation:request', () => {
      socket.emit('simulation:update', engine.getSnapshot());
    });

    socket.on('simulation:status', (message: { action: 'start' | 'pause' | 'stop' | 'reset' | 'speed'; value?: number }) => {
      if (message.action === 'start') {
        engine.start();
      }
      if (message.action === 'pause') {
        engine.pause();
      }
      if (message.action === 'stop') {
        engine.stop();
      }
      if (message.action === 'reset') {
        engine.reset();
      }
      if (message.action === 'speed' && typeof message.value === 'number') {
        engine.setSpeed(message.value);
      }
      io.emit('simulation:update', engine.getSnapshot());
    });
  });
}
