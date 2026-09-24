/**
 * Real time spent playing, so the ending can put "Dad was gone: 20 minutes"
 * next to how long CK was actually out. Counts only while the tab is visible.
 */
const KEY = 'unearth.playtime.v2';

let seconds = read();
let last = 0;
let timer: ReturnType<typeof setInterval> | null = null;

function read(): number {
  try {
    return Number(localStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
}

function write(): void {
  try {
    localStorage.setItem(KEY, String(Math.round(seconds)));
  } catch {
    // ignore
  }
}

export function startPlaytime(): void {
  if (timer) return;
  last = performance.now();
  timer = setInterval(() => {
    const now = performance.now();
    if (typeof document === 'undefined' || !document.hidden) seconds += Math.min(5, (now - last) / 1000);
    last = now;
    write();
  }, 1000);
}

export function playSeconds(): number {
  return seconds;
}

export function resetPlaytime(): void {
  seconds = 0;
  write();
}

export function formatDuration(total: number): string {
  const s = Math.round(total);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} hr ${m} min`;
  if (m > 0) return `${m} minute${m === 1 ? '' : 's'}`;
  return `${s} seconds`;
}
