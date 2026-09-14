// Thin wrapper around GA4. Never throws and never blocks the game:
// if gtag is missing (ad blocker, offline, self-hosted without the tag), this is a no-op.
export function track(event, params = {}) {
  try {
    window.gtag?.('event', event, params);
  } catch {
    /* analytics must never break gameplay */
  }
}
