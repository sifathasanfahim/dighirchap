// Lightweight Web Audio synthesized UI sounds.
// No asset files; tones are generated on the fly.

let ctx: AudioContext | null = null;
let muted = typeof window !== "undefined" && localStorage.getItem("ui-sounds-muted") === "1";

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (muted) return null;
  if (!ctx) {
    const AC = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function setSoundsMuted(m: boolean) {
  muted = m;
  if (typeof window !== "undefined") {
    localStorage.setItem("ui-sounds-muted", m ? "1" : "0");
  }
}

export function isSoundsMuted() {
  return muted;
}

type Tone = { freq: number; dur: number; type?: OscillatorType; vol?: number; delay?: number };

function play(tones: Tone[]) {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  tones.forEach((t) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = t.type ?? "sine";
    osc.frequency.setValueAtTime(t.freq, now + (t.delay ?? 0));
    const vol = t.vol ?? 0.08;
    gain.gain.setValueAtTime(0, now + (t.delay ?? 0));
    gain.gain.linearRampToValueAtTime(vol, now + (t.delay ?? 0) + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (t.delay ?? 0) + t.dur);
    osc.connect(gain).connect(c.destination);
    osc.start(now + (t.delay ?? 0));
    osc.stop(now + (t.delay ?? 0) + t.dur + 0.02);
  });
}

export const sfx = {
  click: () => play([{ freq: 660, dur: 0.05, type: "triangle", vol: 0.05 }]),
  tap:   () => play([{ freq: 480, dur: 0.04, type: "sine", vol: 0.04 }]),
  success: () =>
    play([
      { freq: 660, dur: 0.12, type: "triangle", vol: 0.07 },
      { freq: 880, dur: 0.18, type: "triangle", vol: 0.07, delay: 0.08 },
    ]),
  notify: () =>
    play([
      { freq: 1320, dur: 0.18, type: "sine", vol: 0.08 },
      { freq: 990, dur: 0.22, type: "sine", vol: 0.06, delay: 0.10 },
    ]),
  newOrder: () =>
    play([
      { freq: 880, dur: 0.18, type: "square", vol: 0.5 },
      { freq: 1175, dur: 0.18, type: "square", vol: 0.5, delay: 0.14 },
      { freq: 1760, dur: 0.3, type: "square", vol: 0.5, delay: 0.28 },
    ]),
  error: () => play([{ freq: 220, dur: 0.25, type: "sawtooth", vol: 0.06 }]),
};
