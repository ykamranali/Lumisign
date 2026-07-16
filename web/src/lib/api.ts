'use client';

// Empty value means "same origin" — used when the dashboard is served by the API server itself.
export const API_URL = process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim()
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')
  : '';
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL && process.env.NEXT_PUBLIC_SOCKET_URL.trim()
  ? process.env.NEXT_PUBLIC_SOCKET_URL.replace(/\/$/, '')
  : '';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('lumisign_token');
}

export function setToken(token: string) {
  localStorage.setItem('lumisign_token', token);
}

export function clearToken() {
  localStorage.removeItem('lumisign_token');
}

export function getUser(): any | null {
  if (typeof window === 'undefined') return null;
  const u = localStorage.getItem('lumisign_user');
  return u ? JSON.parse(u) : null;
}

export function setUser(u: any) {
  localStorage.setItem('lumisign_user', JSON.stringify(u));
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: any = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const url = (API_URL || '') + path;
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      msg = j.error || msg;
    } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as any;
  return res.json();
}
