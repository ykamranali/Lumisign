/* LumiSign TV Player — lightweight web player (also models Android TV / Windows players) */
(function () {
  'use strict';

  const SERVER = new URLSearchParams(location.search).get('server') || window.location.origin;
  const API = SERVER + '/api';

  function uuid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  let deviceId = localStorage.getItem('ls_device_id') || uuid();
  localStorage.setItem('ls_device_id', deviceId);
  let token = localStorage.getItem('ls_token') || null;

  const stage = document.getElementById('media-container');
  const boot = document.getElementById('boot-screen');
  const connDot = document.getElementById('conn-dot');
  const connText = document.getElementById('conn-text');
  const devName = document.getElementById('dev-name');
  const clockEl = document.getElementById('clock');

  let playlists = [];
  let currentPlaylist = null;
  let resolvedItems = [];
  let index = 0;
  let playing = false;
  let itemTimer = null;
  let positionTimer = null;
  let position = 0;
  let volume = 80;
  let brightness = 100;
  let orientation = 0;
  const startTime = Date.now();

  // ---------- Registration ----------
  async function register() {
    try {
      const res = await fetch(API + '/api/devices/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          name: 'Web Player ' + deviceId.slice(0, 6),
          deviceType: 'web',
          os: navigator.userAgent,
          vendor: 'LumiSign',
          playerVersion: '1.0.0-web',
          ip: location.hostname,
        }),
      });
      const data = await res.json();
      token = data.authToken;
      localStorage.setItem('ls_token', token);
      // Send LAN beacon so the dashboard can discover it
      fetch(API + '/api/devices/discovery/beacon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId, name: 'Web Player ' + deviceId.slice(0, 6),
          mac: 'web-' + deviceId.slice(0, 8), ip: location.hostname,
          vendor: 'LumiSign', deviceType: 'web', os: navigator.userAgent, playerVersion: '1.0.0-web',
        }),
      }).catch(() => {});
    } catch (e) {
      console.warn('register failed', e);
    }
  }

  // ---------- Socket ----------
  let socket;
  function connect() {
    if (!token) { setTimeout(connect, 2000); return; }
    socket = io(SERVER, { auth: { token, type: 'player' }, transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      setConn(true);
      boot.classList.add('hidden');
      sendRegister();
    });
    socket.on('disconnect', () => setConn(false));
    socket.on('connect_error', () => setConn(false));

    socket.on('assignment', (data) => { applyAssignment(data); });
    socket.on('assignment:refresh', () => { /* re-pull handled by server via assignment on next heartbeat */ });
    socket.on('command', (cmd) => handleCommand(cmd));
    socket.on('config:push', (cfg) => applyConfig(cfg));

    setInterval(heartbeat, 5000);
  }

  function setConn(on) {
    connDot.className = on ? 'on' : 'off';
    connText.textContent = on ? 'online' : 'offline';
  }

  function sendRegister() {
    socket.emit('player:register', telemetry());
  }

  function telemetry() {
    return {
      cpu: +(20 + Math.random() * 30).toFixed(1),
      ram: +(30 + Math.random() * 30).toFixed(1),
      storage: +(10 + Math.random() * 20).toFixed(1),
      temperature: +(40 + Math.random() * 10).toFixed(1),
      networkSpeed: +(50 + Math.random() * 100).toFixed(1),
      volume, brightness, orientation: orientation === 0 ? 'landscape' : 'portrait',
      currentMedia: resolvedItems[index] ? resolvedItems[index].name : null,
      playbackPosition: position,
      status: playing ? 'playing' : 'idle',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      ip: location.hostname,
    };
  }

  function heartbeat() {
    if (socket && socket.connected) socket.emit('player:heartbeat', telemetry());
  }

  // ---------- Assignment / Playback ----------
  async function applyAssignment(data) {
    playlists = (data.playlists || []).filter((p) => p.playlist && p.playlist.items && p.playlist.items.length);
    if (playlists.length === 0) { currentPlaylist = null; renderIdle(); return; }
    // highest priority first (already sorted by server)
    currentPlaylist = playlists[0].playlist;
    resolvedItems = [];
    for (const it of currentPlaylist.items) {
      try {
        const r = await fetch(`${API}/media/${it.mediaId}?token=${token}`);
        if (r.ok) {
          const m = await r.json();
          resolvedItems.push({ ...m.media, duration: it.duration, transition: it.transition });
        }
      } catch (e) { /* skip unavailable */ }
    }
    if (currentPlaylist.shuffle) shuffle(resolvedItems);
    index = 0;
    play();
  }

  function fileUrl(media) {
    if (media.path) return `${SERVER}/api/media/${media.id}/file?token=${token}`;
    if (media.url) return media.url;
    return '';
  }

  function play() {
    if (!resolvedItems.length) { renderIdle(); return; }
    playing = true;
    renderItem(resolvedItems[index]);
    scheduleNext();
  }

  function scheduleNext() {
    clearTimeout(itemTimer);
    const dur = (resolvedItems[index]?.duration || 10) * 1000;
    itemTimer = setTimeout(() => next(), dur);
  }

  function next() {
    if (!resolvedItems.length) return;
    index = (index + 1) % resolvedItems.length;
    play();
  }
  function prev() {
    if (!resolvedItems.length) return;
    index = (index - 1 + resolvedItems.length) % resolvedItems.length;
    play();
  }

  function pause() {
    playing = false;
    clearTimeout(itemTimer);
    const v = stage.querySelector('video');
    if (v) v.pause();
  }
  function resume() {
    if (!playing) { playing = true; scheduleNext(); const v = stage.querySelector('video'); if (v) v.play(); }
  }
  function stop() {
    playing = false; clearTimeout(itemTimer); stage.innerHTML = ''; currentPlaylist = null; renderIdle();
  }

  // ---------- Rendering ----------
  function renderItem(media) {
    stage.innerHTML = '';
    position = 0;
    const type = media.type;
    if (type === 'image') {
      const img = document.createElement('img');
      img.src = fileUrl(media);
      stage.appendChild(img);
    } else if (type === 'video') {
      const v = document.createElement('video');
      v.src = fileUrl(media); v.autoplay = true; v.muted = volume === 0; v.loop = false;
      v.volume = volume / 100;
      stage.appendChild(v);
      startPositionTracker((v.duration || media.duration || 10));
    } else if (type === 'audio') {
      const a = document.createElement('audio');
      a.src = fileUrl(media); a.autoplay = true; a.volume = volume / 100;
      stage.appendChild(a);
      const note = document.createElement('div'); note.className = 'clock-card'; note.textContent = '♪ ' + media.name; stage.appendChild(note);
    } else if (type === 'pdf' || type === 'pptx') {
      const f = document.createElement('iframe');
      f.src = fileUrl(media);
      stage.appendChild(f);
    } else if (type === 'youtube') {
      const f = document.createElement('iframe');
      f.src = youtubeEmbed(media.url); f.allowFullscreen = true;
      stage.appendChild(f);
    } else if (type === 'webpage' || type === 'html' || type === 'iptv') {
      const f = document.createElement('iframe');
      f.src = media.url; f.allowFullscreen = true;
      stage.appendChild(f);
    } else if (type === 'weather') {
      const c = document.createElement('div'); c.className = 'weather-card';
      c.innerHTML = `<div class="weather-temp">${currentTemp()}°C</div><div>Humidity ${(40 + Math.random() * 30).toFixed(0)}%</div>`;
      stage.appendChild(c);
    } else if (type === 'clock') {
      const c = document.createElement('div'); c.className = 'clock-card';
      c.style.fontSize = '8vw'; c.style.fontWeight = '800';
      c.textContent = new Date().toLocaleTimeString();
      stage.appendChild(c);
      setInterval(() => { c.textContent = new Date().toLocaleTimeString(); }, 1000);
    } else if (type === 'rss') {
      renderRss(media.url);
    } else {
      const d = document.createElement('div'); d.className = 'clock-card'; d.textContent = media.name; stage.appendChild(d);
    }
  }

  function renderIdle() {
    stage.innerHTML = '<div class="clock-card" style="opacity:.5">No content assigned</div>';
  }

  function startPositionTracker(total) {
    clearInterval(positionTimer);
    positionTimer = setInterval(() => {
      position += 1;
      if (total && position >= total) position = 0;
    }, 1000);
  }

  async function renderRss(url) {
    const c = document.createElement('div'); c.className = 'rss-card';
    c.innerHTML = '<div>Loading feed…</div>';
    stage.appendChild(c);
    try {
      const r = await fetch(url);
      const text = await r.text();
      const items = [...text.matchAll(/<item>[\s\S]*?<title>(.*?)<\/title>/g)].slice(0, 8).map((m) => m[1]);
      c.innerHTML = items.map((t) => `<div class="rss-item">• ${t}</div>`).join('');
    } catch {
      c.innerHTML = '<div>Feed unavailable</div>';
    }
  }

  function youtubeEmbed(url) {
    const id = (url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/) || [])[1];
    return id ? `https://www.youtube.com/embed/${id}?autoplay=1&mute=${volume === 0 ? 1 : 0}` : url;
  }
  function currentTemp() { return (15 + Math.random() * 15).toFixed(0); }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } }

  // ---------- Commands ----------
  function handleCommand(cmd) {
    console.log('command', cmd.type);
    switch (cmd.type) {
      case 'play': resume(); break;
      case 'pause': pause(); break;
      case 'stop': stop(); break;
      case 'next': next(); break;
      case 'previous': prev(); break;
      case 'restart_playback': index = 0; play(); break;
      case 'restart_player':
      case 'reboot': location.reload(); break;
      case 'shutdown': playing = false; clearTimeout(itemTimer); stage.innerHTML = ''; document.body.style.background = '#000'; break;
      case 'take_screenshot': takeScreenshot(); break;
      case 'adjust_volume': if (cmd.payload && cmd.payload.volume != null) applyConfig({ volume: cmd.payload.volume }); break;
      case 'adjust_brightness': if (cmd.payload && cmd.payload.brightness != null) applyConfig({ brightness: cmd.payload.brightness }); break;
      case 'rotate_screen': orientation = (orientation + 90) % 360; applyConfig({ orientation }); break;
      case 'sync_time': break;
      case 'clear_cache': try { localStorage.removeItem('ls_token'); } catch {} break;
      case 'update_player': socket.emit('player:log', { level: 'info', message: 'Update requested' }); break;
      default: break;
    }
    socket.emit('player:command:ack', { commandId: cmd.commandId, status: 'done' });
  }

  function applyConfig(cfg) {
    if (cfg.volume != null) {
      volume = cfg.volume;
      const v = stage.querySelector('video, audio');
      if (v) v.volume = volume / 100;
    }
    if (cfg.brightness != null) {
      brightness = cfg.brightness;
      stage.style.filter = `brightness(${brightness / 100})`;
    }
    if (cfg.orientation != null && typeof cfg.orientation === 'string') {
      orientation = cfg.orientation === 'portrait' ? 90 : 0;
    }
    if (typeof cfg.orientation === 'number') {
      orientation = cfg.orientation;
    }
    document.getElementById('stage').style.transform = `rotate(${orientation}deg)`;
  }

  function takeScreenshot() {
    try {
      const c = document.createElement('canvas');
      c.width = window.innerWidth; c.height = window.innerHeight;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, c.width, c.height);
      const el = stage.querySelector('img, video');
      if (el && el.tagName === 'IMG') ctx.drawImage(el, 0, 0, c.width, c.height);
      const url = c.toDataURL('image/png');
      socket.emit('player:screenshot', { url });
    } catch (e) {
      socket.emit('player:log', { level: 'warn', message: 'screenshot failed: ' + e.message });
    }
  }

  // ---------- Clock ----------
  setInterval(() => { clockEl.textContent = new Date().toLocaleTimeString(); }, 1000);

  // ---------- Boot ----------
  (async function init() {
    devName.textContent = 'Web Player ' + deviceId.slice(0, 6);
    await register();
    connect();
  })();
})();
