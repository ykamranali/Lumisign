'use client';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL, getToken } from './api';
import { useStore } from '../store/useStore';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(): Socket {
  if (socket) return socket;
  const token = getToken();
  if (!token) return null as any;
  socket = io(SOCKET_URL, {
    auth: { token, type: 'dashboard' },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 2000,
  });

  const store = useStore.getState();

  socket.on('connect', () => store.setConnected(true));
  socket.on('disconnect', () => store.setConnected(false));

  socket.on('device:update', (d: any) => {
    useStore.getState().upsertDevice(d);
  });
  socket.on('device:online', (d: any) => {
    useStore.getState().upsertDevice({ id: d.id, status: 'online', online: true, name: d.name, deviceId: d.deviceId });
  });
  socket.on('device:offline', (d: any) => {
    useStore.getState().upsertDevice({ id: d.id, status: 'offline', online: false });
  });
  socket.on('notification', (n: any) => {
    useStore.getState().addNotification(n);
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
