let cleanupFn: (() => void) | null = null;

export function stopIdleTimer() {
  if (cleanupFn) {
    cleanupFn();
    cleanupFn = null;
  }
}

export function startIdleTimer(timeoutMins: number, onTimeout: () => void) {
  // Always clean up the previous timer first
  stopIdleTimer();

  if (timeoutMins <= 0) return; // 0 or negative means "Never"

  const timeoutMs = timeoutMins * 60 * 1000;
  let timerId = setTimeout(onTimeout, timeoutMs);

  const resetTimer = () => {
    if (timerId) clearTimeout(timerId);
    timerId = setTimeout(onTimeout, timeoutMs);
  };

  const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'click', 'touchstart'];

  events.forEach((evt) => {
    window.addEventListener(evt, resetTimer, { passive: true });
  });

  cleanupFn = () => {
    if (timerId) clearTimeout(timerId);
    events.forEach((evt) => {
      window.removeEventListener(evt, resetTimer);
    });
  };
}
