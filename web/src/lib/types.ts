export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: Record<string, any>;
  active: boolean;
}

export interface Device {
  id: string;
  deviceId: string;
  name: string;
  mac?: string;
  ip?: string;
  hostname?: string;
  os?: string;
  playerVersion?: string;
  firmwareVersion?: string;
  resolution?: string;
  vendor?: string;
  deviceType?: string;
  groupId?: string;
  status: string;
  connectionStatus: string;
  cpu?: number;
  ram?: number;
  storage?: number;
  temperature?: number;
  networkSpeed?: number;
  volume?: number;
  brightness?: number;
  orientation?: string;
  currentPlaylist?: string;
  currentMedia?: string;
  playbackPosition?: number;
  lastScreenshot?: string;
  updateStatus?: string;
  errorLogs?: any[];
  location?: string;
  lastHeartbeat?: string;
  lastRestart?: string;
  uptime?: number;
  approved: boolean;
  online?: boolean;
}

export interface Media {
  id: string;
  name: string;
  type: string;
  mime?: string;
  path?: string;
  url?: string;
  thumbnail?: string;
  size?: number;
  duration?: number;
  metadata?: any;
  createdAt?: string;
}

export interface PlaylistItem {
  mediaId: string;
  duration: number;
  transition: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  items: PlaylistItem[];
  loop: boolean;
  shuffle: boolean;
  priority: number;
  emergency: boolean;
  conditional: boolean;
  interactive: boolean;
}

export interface Schedule {
  id: string;
  name: string;
  playlistId: string;
  deviceIds: string[];
  groupIds: string[];
  type: string;
  startTime?: string;
  endTime?: string;
  days?: number[];
  specificDates?: string[];
  timezone: string;
  priority: number;
  expiresAt?: string;
  active: boolean;
}

export interface Notification {
  id: string;
  type: string;
  severity: string;
  title: string;
  message?: string;
  deviceId?: string;
  read: boolean;
  createdAt: string;
}

export interface DashboardStats {
  totalTvs: number;
  onlineTvs: number;
  offlineTvs: number;
  downloading: number;
  playing: number;
  idle: number;
  storageUsedBytes: number;
  bandwidthUsageMbps: number;
  cpuUsage: number;
  memoryUsage: number;
  serverHealth: number;
  networkHealth: number;
  activeUsers: number;
  todaysUploads: number;
  todaysPlaylists: number;
  unreadNotifications: number;
  mediaCount: number;
  playlistCount: number;
}
