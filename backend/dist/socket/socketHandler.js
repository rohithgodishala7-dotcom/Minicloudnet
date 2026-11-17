export function registerSocketEvents(io, engine) {
    io.on('connection', (socket) => {
        socket.emit('simulation:update', engine.getSnapshot());
        socket.on('simulation:request', () => {
            socket.emit('simulation:update', engine.getSnapshot());
        });
        socket.on('simulation:status', (message) => {
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
