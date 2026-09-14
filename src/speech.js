// Voice command: shout "WAITER" and chhotu comes running.
// Uses the browser's Web Speech API (best in Chrome / Edge).
const WAKE =
  /(waiter|waitor|weiter|vetar|veter|wetter|water|bhaiya|bhaiyya|bhaiyaa|chhotu|chotu|chootu|oye|one more|वेटर|भैया|छोटू|ओए)/i;

export class VoiceCommand {
  constructor({ onWaiter, onHeard, canTrigger }) {
    this.onWaiter = onWaiter;
    this.onHeard = onHeard;
    this.canTrigger = canTrigger;
    this.state = 'off'; // off | listening | denied | unsupported
    this.last = 0;
  }

  get supported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  start() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      this.state = 'unsupported';
      return;
    }
    if (this.rec) return;
    const r = (this.rec = new SR());
    r.lang = 'en-IN';
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 3;
    r.onstart = () => (this.state = 'listening');
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        this.onHeard?.(res[0].transcript, res.isFinal);
        for (let k = 0; k < res.length; k++) {
          if (WAKE.test(res[k].transcript)) {
            this.fire();
            break;
          }
        }
      }
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.state = 'denied';
        this.active = false;
      }
    };
    r.onend = () => {
      if (this.active) {
        setTimeout(() => {
          try {
            r.start();
          } catch {
            /* already started */
          }
        }, 250);
      } else if (this.state !== 'denied') this.state = 'off';
    };
    this.active = true;
    try {
      r.start();
    } catch {
      /* already started */
    }
  }

  fire() {
    const now = performance.now();
    if (now - this.last < 2500) return;
    if (this.canTrigger && !this.canTrigger()) return;
    this.last = now;
    this.onWaiter();
  }
}
