const MIN_DISPLAY_MS = 1000;

let count = 0;
let displayUntil = 0;
let timeoutId: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((cb) => cb());
}

function scheduleHide() {
  if (timeoutId) clearTimeout(timeoutId);
  const delay = Math.max(0, displayUntil - Date.now());
  if (delay > 0) {
    timeoutId = setTimeout(() => {
      timeoutId = null;
      displayUntil = 0;
      notify();
    }, delay);
  } else {
    displayUntil = 0;
    notify();
  }
}

export function startSaving(): void {
  count++;
  notify();
}

export function endSaving(): void {
  count = Math.max(0, count - 1);
  if (count === 0) {
    displayUntil = Date.now() + MIN_DISPLAY_MS;
    scheduleHide();
    notify();
  } else {
    notify();
  }
}

export function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function getSnapshot(): boolean {
  return count > 0 || Date.now() < displayUntil;
}
