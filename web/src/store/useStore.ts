'use client';
import { create } from 'zustand';
import { Device, Notification, DashboardStats } from '../lib/types';

interface StoreState {
  devices: Record<string, Device>;
  stats: DashboardStats | null;
  notifications: Notification[];
  connected: boolean;
  setDevices: (devices: Device[]) => void;
  upsertDevice: (d: Partial<Device> & { id: string }) => void;
  setStats: (s: DashboardStats) => void;
  setNotifications: (n: Notification[]) => void;
  addNotification: (n: Notification) => void;
  setConnected: (c: boolean) => void;
}

export const useStore = create<StoreState>((set) => ({
  devices: {},
  stats: null,
  notifications: [],
  connected: false,
  setDevices: (devices) =>
    set({ devices: Object.fromEntries(devices.map((d) => [d.id, { ...d, online: d.status === 'online' }])) }),
  upsertDevice: (d) =>
    set((state) => ({
      devices: { ...state.devices, [d.id]: { ...state.devices[d.id], ...d, online: d.status === 'online' || d.online } },
    })),
  setStats: (s) => set({ stats: s }),
  setNotifications: (n) => set({ notifications: n }),
  addNotification: (n) => set((state) => ({ notifications: [n, ...state.notifications].slice(0, 100) })),
  setConnected: (c) => set({ connected: c }),
}));
