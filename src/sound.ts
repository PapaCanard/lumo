// Petits bruitages synthétisés (WebAudio) : aucun fichier audio, rien à licencier.
let ctx: AudioContext | null = null;
let enabled = true;
let last = 0;

export function setSoundEnabled(on: boolean) { enabled = on; }

type Note = [freq: number, dur: number, type?: OscillatorType, gain?: number, delay?: number, slideTo?: number];

const SOUNDS: Record<string, Note[]> = {
  hello: [[660, 0.09], [880, 0.12, "sine", 0.9, 0.09]],
  love: [[523, 0.1], [659, 0.1, "sine", 1, 0.1], [784, 0.18, "sine", 1, 0.2]],
  party: [[523, 0.08, "triangle"], [659, 0.08, "triangle", 1, 0.08], [784, 0.08, "triangle", 1, 0.16], [1047, 0.2, "triangle", 1, 0.24]],
  idea: [[440, 0.08, "sine", 1, 0, 880], [1175, 0.16, "sine", 0.8, 0.1]],
  sad: [[392, 0.18, "sine", 0.8, 0, 311], [330, 0.26, "sine", 0.7, 0.18, 262]],
  sleep: [[300, 0.4, "sine", 0.35, 0, 220]],
  coin: [[988, 0.06, "square", 0.4], [1319, 0.18, "square", 0.4, 0.06]],
  shield: [[220, 0.08, "square", 0.35], [330, 0.14, "square", 0.35, 0.08]],
  laugh: [[500, 0.05, "triangle"], [600, 0.05, "triangle", 1, 0.07], [500, 0.05, "triangle", 1, 0.14], [650, 0.08, "triangle", 1, 0.21]],
  grr: [[120, 0.3, "sawtooth", 0.35, 0, 90]],
  ding: [[880, 0.09, "sine", 0.9], [1320, 0.18, "sine", 0.7, 0.07]],
  dizzy: [[600, 0.4, "sine", 0.6, 0, 300], [300, 0.3, "sine", 0.5, 0.25, 500]],
  error: [[200, 0.14, "square", 0.3], [150, 0.22, "square", 0.3, 0.14]],
  shutter: [[2000, 0.03, "square", 0.25], [1200, 0.05, "square", 0.25, 0.05]],
  pop: [[500, 0.07, "sine", 1, 0, 900]],
  yawn: [[400, 0.5, "sine", 0.4, 0, 180]],
  switch: [[440, 0.07, "triangle", 1, 0, 880], [880, 0.12, "triangle", 0.8, 0.07, 1320]],
  gulp: [[300, 0.08, "sine", 1, 0, 160], [200, 0.1, "sine", 1, 0.09, 120]],
  think: [[520, 0.05, "sine", 0.6]],
  send: [[600, 0.06, "sine", 0.8, 0, 1000]],
  tick: [[1200, 0.02, "sine", 0.25]],
};

export function sfx(id: string) {
  if (!enabled) return;
  const notes = SOUNDS[id];
  if (!notes) return;
  const now = performance.now();
  if (now - last < 60) return; // pas de mitraillette
  last = now;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime;
    for (const [freq, dur, type = "sine", gain = 1, delay = 0, slideTo] of notes) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0 + delay);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + delay + dur);
      const peak = 0.06 * gain; // volume très doux
      g.gain.setValueAtTime(0.0001, t0 + delay);
      g.gain.exponentialRampToValueAtTime(peak, t0 + delay + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(t0 + delay);
      osc.stop(t0 + delay + dur + 0.02);
    }
  } catch { /* audio indisponible : on ne dit rien */ }
}
