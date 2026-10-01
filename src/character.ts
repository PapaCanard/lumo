// Lumo v1.1 : juste deux yeux lumineux, façon petit robot de bureau.
// Tout est dessiné en code (Canvas 2D) : aucune image, aucun asset externe.
// Les yeux changent de forme selon l'émotion (arcs joyeux, paupières fâchées ou tristes,
// cœurs, étoiles, spirales…), suivent le curseur, clignent, et affichent de petites icônes.


export type EmoteId =
  | "wave" | "love" | "party" | "code" | "idea" | "curious" | "sad" | "rush" | "sleepy"
  | "music" | "coins" | "sun" | "rain" | "search" | "shield" | "clock" | "yum" | "laugh"
  | "steam" | "reading" | "nod" | "proud" | "sheepish" | "dizzy" | "key" | "hot" | "offline"
  | "camera" | "chart" | "box" | "ooh" | "yawn" | "giggle" | "switch" | "lookaround"
  | "surprised" | "stretch" | "listen";

type Expr = "neutral" | "wide" | "happy" | "closed" | "flat" | "squint" | "tall" | "sparkle" | "heart" | "star" | "spiral" | "x";
type Glyph = "none" | "heart" | "star" | "spiral" | "x";
type Motion = "none" | "hop" | "sway" | "nod" | "shake" | "spin" | "tilt" | "shiver" | "float" | "laugh";
type Prop = "bulb" | "qmark" | "exclaim" | "key" | "magnifier" | "wifi" | "clock" | "doc" | "code" | "cloud" | "sun" | "umbrella" | "shield" | "cup" | "camera" | "chart" | "box";
type Shape = "spark" | "heart" | "confetti" | "star" | "drop" | "note" | "z" | "char" | "puff" | "coin";

interface Fx { shape: Shape; rate?: number; burst?: number; color?: string; chars?: string[] }

interface Emote {
  dur: number;
  eyes: Expr | [Expr, Expr];
  /** > 0 : paupières fâchées (coin intérieur baissé) ; < 0 : tristes (coin extérieur baissé). */
  slant?: number;
  look?: [number, number] | "scan" | "up";
  motion?: Motion;
  prop?: Prop;
  fx?: Fx[];
  sfx?: string;
  sweat?: boolean;
  loop?: boolean;
  lock?: boolean;
}

export const EMOTES: Record<EmoteId, Emote> = {
  wave: { dur: 2.2, eyes: "happy", motion: "hop", fx: [{ shape: "spark", burst: 6 }], sfx: "hello" },
  love: { dur: 2.8, eyes: "heart", motion: "sway", fx: [{ shape: "heart", rate: 3 }], sfx: "love" },
  party: { dur: 2.6, eyes: "star", motion: "hop", fx: [{ shape: "confetti", burst: 30 }], sfx: "party" },
  code: { dur: 3.4, eyes: "flat", motion: "nod", prop: "code", look: "scan", fx: [{ shape: "char", rate: 6, color: "#46d27a", chars: ["0", "1", "{", "}", "<", "/", ";"] }] },
  idea: { dur: 2.6, eyes: "sparkle", motion: "hop", prop: "bulb", look: "up", sfx: "idea" },
  curious: { dur: 2.6, eyes: ["neutral", "wide"], motion: "tilt", prop: "qmark", look: [0.5, -0.4] },
  sad: { dur: 3.2, eyes: "neutral", slant: -1, motion: "float", prop: "cloud", look: [0, 0.6], fx: [{ shape: "drop", rate: 5, color: "#7fb4ff" }], sfx: "sad" },
  rush: { dur: 2.4, eyes: "wide", motion: "shiver", prop: "exclaim", sweat: true },
  sleepy: { dur: 4, eyes: "closed", motion: "float", loop: true, fx: [{ shape: "z", rate: 0.7 }], sfx: "sleep" },
  music: { dur: 3, eyes: "happy", motion: "sway", fx: [{ shape: "note", rate: 3 }] },
  coins: { dur: 2.8, eyes: "sparkle", motion: "hop", fx: [{ shape: "coin", rate: 6 }], sfx: "coin" },
  sun: { dur: 2.8, eyes: "happy", motion: "sway", prop: "sun" },
  rain: { dur: 2.8, eyes: "neutral", slant: -0.5, motion: "shiver", prop: "umbrella", fx: [{ shape: "drop", rate: 8, color: "#7fb4ff" }] },
  search: { dur: 3, eyes: "neutral", look: "scan", prop: "magnifier" },
  shield: { dur: 3, eyes: "flat", slant: 0.6, prop: "shield", sfx: "shield" },
  clock: { dur: 2.8, eyes: "wide", prop: "clock", look: "up", motion: "tilt" },
  yum: { dur: 3, eyes: "happy", motion: "sway", prop: "cup" },
  laugh: { dur: 2.8, eyes: "happy", motion: "laugh", fx: [{ shape: "drop", rate: 4, color: "#9fd0ff" }], sfx: "laugh" },
  steam: { dur: 2.6, eyes: "flat", slant: 1, motion: "shake", fx: [{ shape: "puff", rate: 7, color: "#8d8898" }], sfx: "grr" },
  reading: { dur: 3.4, eyes: "flat", look: "scan", prop: "doc" },
  nod: { dur: 1.6, eyes: "happy", motion: "nod", fx: [{ shape: "spark", burst: 4 }], sfx: "ding" },
  proud: { dur: 2.4, eyes: "happy", motion: "hop", fx: [{ shape: "star", burst: 7 }], sfx: "ding" },
  sheepish: { dur: 2.6, eyes: ["squint", "neutral"], slant: -0.4, sweat: true, motion: "tilt", look: [-0.6, 0.3] },
  dizzy: { dur: 3.4, eyes: "spiral", motion: "sway", fx: [{ shape: "star", rate: 4, color: "#ffd166" }], sfx: "dizzy" },
  key: { dur: 3.2, eyes: "neutral", slant: -0.4, look: [0.7, -0.2], prop: "key", motion: "tilt", sweat: true, sfx: "error" },
  hot: { dur: 3, eyes: "flat", slant: -0.3, sweat: true, motion: "shiver", fx: [{ shape: "puff", rate: 3, color: "#ffb36b" }], sfx: "error" },
  offline: { dur: 3.2, eyes: "x", prop: "wifi", motion: "float", sfx: "error" },
  camera: { dur: 2.6, eyes: "sparkle", prop: "camera", motion: "hop", fx: [{ shape: "spark", burst: 10 }], sfx: "shutter" },
  chart: { dur: 3, eyes: "neutral", prop: "chart", look: "up", motion: "nod" },
  box: { dur: 2.6, eyes: "wide", prop: "box", motion: "tilt", look: "up" },
  ooh: { dur: 99, eyes: "wide", motion: "hop", loop: true, sfx: "pop" },
  yawn: { dur: 2.6, eyes: "squint", slant: -0.3, motion: "float", sfx: "yawn" },
  giggle: { dur: 1.1, eyes: "happy", motion: "laugh", sfx: "pop" },
  switch: { dur: 1.2, eyes: "neutral", motion: "spin", fx: [{ shape: "spark", burst: 14 }], sfx: "switch" },
  lookaround: { dur: 3, eyes: "neutral", look: "scan" },
  surprised: { dur: 1.2, eyes: "wide", motion: "hop", sfx: "pop" },
  stretch: { dur: 2.2, eyes: "tall", motion: "float" },
  listen: { dur: 99, eyes: "neutral", look: [0.9, 0.25], loop: true },
};

/** Couleur des yeux quand aucune IA n'est configurée. */
const IDLE_EYE = "#9fb4c8";

// ─── outils ─────────────────────────────────────────────────────────────────────
const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgb = (c: number[], a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const approach = (cur: number, tgt: number, k: number) => cur + (tgt - cur) * clamp(k, 0, 1);

/** Repère logique : 140 × 80 ; les deux yeux sont centrés sur y = 40. */
const LW = 140, LH = 80, EY = 40;
const EX = [47, 93];
const ICON_X = 119;

interface EyeShape { w: number; h: number; r: number; top: number; bottom: number }
const SHAPES: Record<Expr, EyeShape & { glyph: Glyph; shine?: boolean }> = {
  neutral: { w: 27, h: 33, r: 8, top: 0, bottom: 0, glyph: "none" },
  wide: { w: 31, h: 39, r: 10, top: 0, bottom: 0, glyph: "none" },
  happy: { w: 30, h: 30, r: 11, top: 0, bottom: 0.62, glyph: "none" },
  closed: { w: 30, h: 4, r: 2, top: 0, bottom: 0, glyph: "none" },
  flat: { w: 30, h: 32, r: 8, top: 0.46, bottom: 0, glyph: "none" },
  squint: { w: 30, h: 13, r: 6, top: 0, bottom: 0, glyph: "none" },
  tall: { w: 22, h: 44, r: 9, top: 0, bottom: 0, glyph: "none" },
  sparkle: { w: 31, h: 38, r: 10, top: 0, bottom: 0, glyph: "none", shine: true },
  heart: { w: 30, h: 30, r: 8, top: 0, bottom: 0, glyph: "heart" },
  star: { w: 30, h: 30, r: 8, top: 0, bottom: 0, glyph: "star" },
  spiral: { w: 30, h: 30, r: 8, top: 0, bottom: 0, glyph: "spiral" },
  x: { w: 26, h: 26, r: 8, top: 0, bottom: 0, glyph: "x" },
};

interface EyeState extends EyeShape { slant: number; glyph: Glyph; glyphTarget: Glyph; gAmt: number; shine: number }
interface Particle { x: number; y: number; vx: number; vy: number; g: number; life: number; ttl: number; size: number; rot: number; vr: number; shape: Shape; color: string; text?: string }

export class Lumo {
  private ctx: CanvasRenderingContext2D;
  private layer: HTMLCanvasElement;
  private lctx: CanvasRenderingContext2D;
  private k = 1; // pixels réels par unité logique
  private tintKey = "";
  private tint: number[] = hex(IDLE_EYE);
  private color: number[] = hex(IDLE_EYE);
  private t = 0;
  private last = 0;
  private raf = 0;
  private running = false;

  private eyes: [EyeState, EyeState] = [this.freshEye(), this.freshEye()];
  private look = { x: 0, y: 0 };
  private face = { dx: 0, scale: 1 };
  private emote: { id: EmoteId; def: Emote; t0: number; emitAcc: number[] } | null = null;
  private lockedUntil = 0;
  private thinking = false;
  private listening = false;
  private mouseLook: [number, number] = [0, 0];
  private lastMouse: [number, number] = [0, 0];
  private lastMouseMove = 0;
  private saccade: [number, number] = [0, 0];
  private nextSaccade = 1.5;
  private sleeping = false;
  private lastActivity = 0;
  private nextIdle = 18;
  private blinkAt = 2;
  private blinkUntil = 0;
  private kick = 0;
  private propAmt = 0;
  private propShown: Prop | null = null;
  private particles: Particle[] = [];
  private eating: { t0: number; kind: string } | null = null;
  private flash = 0;
  private pokes: number[] = [];
  onSfx: (id: string) => void = () => {};
  onEmote: (id: EmoteId) => void = () => {};

  /** `px` : hauteur affichée en pixels CSS (la largeur suit, en 7:4). */
  constructor(private canvas: HTMLCanvasElement, px = 56) {
    this.ctx = canvas.getContext("2d")!;
    this.layer = document.createElement("canvas");
    this.lctx = this.layer.getContext("2d")!;
    this.setDisplaySize(px);
  }

  private freshEye(): EyeState {
    const s = SHAPES.neutral;
    return { w: s.w, h: s.h, r: s.r, top: 0, bottom: 0, slant: 0, glyph: "none", glyphTarget: "none", gAmt: 1, shine: 0 };
  }

  // ─── API ─────────────────────────────────────────────────────────────────────
  setDisplaySize(px: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.round((px * LW) / LH);
    this.k = (dpr * px) / LH;
    for (const c of [this.canvas, this.layer]) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(px * dpr);
    }
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${px}px`;
    this.ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
    this.lctx.setTransform(this.k, 0, 0, this.k, 0, 0);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      const busy = this.emote || this.thinking || this.listening || this.particles.length || this.eating || this.flash > 0;
      if (!busy && now - this.last < 33) return; // repos : ~30 i/s
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.t += dt;
      this.update(dt);
      this.draw();
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }

  /** Change la couleur des yeux (une par IA). `key` identifie l'IA : même clé = pas d'animation. */
  setTint(key: string, color: string, animate = true) {
    const changed = key !== this.tintKey;
    this.tintKey = key;
    this.tint = hex(/^#[0-9a-f]{6}$/i.test(color) ? color : IDLE_EYE);
    if (changed && animate) this.play("switch");
  }

  /** Regarde vers un point normalisé (-1..1), relatif au centre des yeux. */
  lookAt(nx: number, ny: number) {
    const v: [number, number] = [clamp(nx, -1, 1), clamp(ny, -1, 1)];
    if (Math.abs(v[0] - this.lastMouse[0]) + Math.abs(v[1] - this.lastMouse[1]) > 0.02) { this.lastMouseMove = this.t; this.lastMouse = v; }
    this.mouseLook = v;
  }

  setListening(on: boolean) { this.listening = on; if (on) this.wake(); }
  setThinking(on: boolean) {
    this.thinking = on;
    if (on) { this.wake(); this.emote = null; this.sfx("think"); }
  }
  /** Chaque frappe fait « sautiller » les yeux. */
  typingPulse() { this.kick = Math.min(1, this.kick + 0.5); this.wake(); }

  play(id: EmoteId) {
    const def = EMOTES[id];
    if (!def) return;
    const now = this.t;
    if (now < this.lockedUntil && id !== "dizzy") return;
    this.wake(false);
    this.emote = { id, def, t0: now, emitAcc: (def.fx ?? []).map(() => 0) };
    for (const f of def.fx ?? []) if (f.burst) for (let i = 0; i < f.burst; i++) this.spawn(f);
    if (def.sfx) this.sfx(def.sfx);
    this.onEmote(id);
    if (def.lock) this.lockedUntil = now + def.dur;
  }
  stopEmote(id?: EmoteId) { if (!id || this.emote?.id === id) this.emote = null; }
  get currentEmote(): EmoteId | null { return this.emote?.id ?? null; }

  /** Un fichier arrive par la droite et se fait « croquer » ; `then` est joué ensuite. */
  eat(kind: string, then: EmoteId) {
    this.wake(false);
    this.emote = null;
    this.eating = { t0: this.t, kind };
    this.sfx("gulp");
    window.setTimeout(() => { this.eating = null; this.play(then); }, 1000);
  }

  poke() {
    const now = performance.now();
    this.pokes = this.pokes.filter((x) => now - x < 2500);
    this.pokes.push(now);
    if (this.pokes.length >= 4) { this.pokes = []; this.play("dizzy"); } else this.play("giggle");
  }

  wake(greet = true) {
    this.lastActivity = this.t;
    this.nextIdle = this.t + 18 + Math.random() * 20;
    if (this.sleeping) {
      this.sleeping = false;
      if (this.emote?.id === "sleepy") this.emote = null;
      if (greet) this.play("surprised");
    }
  }

  get size() { return LH; }

  private sfx(id: string) { this.onSfx(id); }

  // ─── particules ──────────────────────────────────────────────────────────────
  private spawn(f: Fx) {
    if (this.particles.length > 120) return;
    const rnd = (x: number) => (Math.random() - 0.5) * x;
    const eyeCol = rgb(this.color);
    const p: Particle = { x: 70 + rnd(70), y: 16 + rnd(8), vx: rnd(30), vy: -14 - Math.random() * 16, g: 0, life: 0, ttl: 1.3, size: 4, rot: 0, vr: rnd(4), shape: f.shape, color: f.color ?? eyeCol };
    switch (f.shape) {
      case "heart": Object.assign(p, { vy: -20 - Math.random() * 10, ttl: 1.6, size: 4 + Math.random() * 3, color: "#ff6b8b", vr: 0 }); break;
      case "confetti": {
        const cols = ["#ff6b8b", "#ffd166", "#06d6a0", "#4dabf7", "#b197fc", "#ff922b"];
        Object.assign(p, { x: 70 + rnd(40), y: 30, vx: rnd(160), vy: -60 - Math.random() * 60, g: 200, ttl: 1.8, size: 2.5 + Math.random() * 2, color: cols[(Math.random() * cols.length) | 0], vr: rnd(14) });
        break;
      }
      case "star": Object.assign(p, { vx: rnd(50), ttl: 1.2, size: 3 + Math.random() * 2, color: f.color ?? "#ffd166" }); break;
      case "spark": Object.assign(p, { x: 70 + rnd(90), y: 40 + rnd(40), vx: rnd(60), vy: rnd(60), ttl: 0.8, size: 2 + Math.random() * 2 }); break;
      case "drop": Object.assign(p, { y: 8, vx: rnd(10), vy: 10, g: 120, ttl: 1, size: 1.8 + Math.random() }); break;
      case "note": Object.assign(p, { x: 120 + rnd(10), y: 60, vx: 6 + Math.random() * 8, vy: -24 - Math.random() * 10, ttl: 2, size: 11 + Math.random() * 3 }); break;
      case "z": Object.assign(p, { x: 112, y: 30, vx: 8, vy: -12, ttl: 2.4, size: 9 + Math.random() * 4, color: "rgba(150,170,220,1)", text: "z" }); break;
      case "char": Object.assign(p, { x: 70 + rnd(120), y: -4, vx: 0, vy: 22 + Math.random() * 16, ttl: 3.8, size: 8, text: (f.chars ?? ["0", "1"])[(Math.random() * (f.chars?.length ?? 2)) | 0] }); break;
      case "puff": Object.assign(p, { x: EX[Math.random() < 0.5 ? 0 : 1] + rnd(14), y: 18, vx: rnd(40), vy: -24 - Math.random() * 10, ttl: 0.9, size: 3.5 }); break;
      case "coin": Object.assign(p, { x: 70 + rnd(50), y: 72, vx: rnd(70), vy: -80 - Math.random() * 30, g: 220, ttl: 1.5, size: 4, color: "#ffd166" }); break;
    }
    if (p.text !== undefined || p.shape === "note") p.vr = 0;
    this.particles.push(p);
  }

  // ─── mise à jour ─────────────────────────────────────────────────────────────
  private update(dt: number) {
    this.color = this.color.map((v, i) => approach(v, this.tint[i], dt * 7));

    if (this.emote && !this.emote.def.loop && this.t - this.emote.t0 > this.emote.def.dur) this.emote = null;

    // sommeil / animations d'attente
    if (!this.emote && !this.thinking && !this.listening && !this.eating) {
      if (!this.sleeping && this.t - this.lastActivity > 120) { this.sleeping = true; this.play("sleepy"); }
      else if (!this.sleeping && this.t > this.nextIdle) {
        this.nextIdle = this.t + 18 + Math.random() * 22;
        const pick: EmoteId[] = ["lookaround", "yawn", "stretch", "lookaround", "giggle"];
        this.play(pick[(Math.random() * pick.length) | 0]);
      }
    }
    if (this.sleeping && !this.emote) this.play("sleepy");

    // clignements (parfois doubles)
    if (this.t > this.blinkAt) {
      this.blinkUntil = this.t + 0.12;
      this.blinkAt = this.t + (Math.random() < 0.2 ? 0.25 : 2 + Math.random() * 3.5);
    }
    // micro-saccades quand la souris ne bouge pas : le regard « vit »
    if (this.t > this.nextSaccade) {
      this.nextSaccade = this.t + 0.8 + Math.random() * 2.6;
      this.saccade = this.t - this.lastMouseMove > 2.5 ? [(Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.5] : [0, 0];
    }

    const e = this.emote?.def;
    const et = this.emote ? this.t - this.emote.t0 : 0;

    // regard
    let lx = this.mouseLook[0] * 0.9 + this.saccade[0], ly = this.mouseLook[1] * 0.7 + this.saccade[1];
    if (this.thinking) { lx = 0.55 + Math.sin(this.t * 1.3) * 0.35; ly = -0.7; }
    else if (e?.look === "scan") { lx = Math.sin(et * 3) > 0 ? 0.85 : -0.85; ly = 0.05; }
    else if (e?.look === "up") { lx = 0.2; ly = -0.8; }
    else if (Array.isArray(e?.look)) { lx = e!.look[0]; ly = e!.look[1]; }
    else if (this.listening && !e) { lx = 0.9; ly = 0.25; } // la saisie est à droite des yeux
    if (this.eating) { const u = (this.t - this.eating.t0) / 1; lx = u < 0.45 ? 1 - u * 2 : 0; ly = 0.1; }
    // mouvements d'yeux rapides et secs, comme un vrai robot
    this.look.x = approach(this.look.x, clamp(lx, -1, 1), dt * 16);
    this.look.y = approach(this.look.y, clamp(ly, -1, 1), dt * 16);

    // forme des yeux
    const exprs: [Expr, Expr] = e ? (Array.isArray(e.eyes) ? e.eyes : [e.eyes, e.eyes])
      : this.thinking ? ["flat", "flat"]
      : this.listening ? ["neutral", "neutral"]
      : ["neutral", "neutral"];
    const slant = e?.slant ?? 0;
    this.eyes.forEach((s, i) => {
      const tg = SHAPES[exprs[i]];
      const k = dt * 14;
      s.w = approach(s.w, tg.w, k); s.h = approach(s.h, tg.h, k); s.r = approach(s.r, tg.r, k);
      s.top = approach(s.top, this.thinking && !e ? 0.22 : tg.top, k);
      s.bottom = approach(s.bottom, tg.bottom, k);
      s.slant = approach(s.slant, slant, k);
      s.shine = approach(s.shine, tg.shine ? 1 : 0, k);
      s.glyphTarget = tg.glyph;
      if (s.glyph !== s.glyphTarget) { s.gAmt -= dt * 9; if (s.gAmt <= 0) { s.glyph = s.glyphTarget; s.gAmt = 0; } }
      else s.gAmt = Math.min(1, s.gAmt + dt * 7);
    });

    // icône à droite : les yeux se décalent pour lui faire de la place
    const prop = e?.prop;
    if (prop) { this.propShown = prop; this.propAmt = approach(this.propAmt, 1, dt * 10); }
    else { this.propAmt = approach(this.propAmt, 0, dt * 10); if (this.propAmt < 0.02) this.propShown = null; }
    this.face.dx = -15 * this.propAmt;
    this.face.scale = 1 - 0.18 * this.propAmt;

    this.kick = approach(this.kick, 0, dt * 8);

    // émetteurs
    if (this.emote) {
      (this.emote.def.fx ?? []).forEach((f, i) => {
        if (!f.rate) return;
        this.emote!.emitAcc[i] += dt * f.rate;
        while (this.emote!.emitAcc[i] >= 1) { this.emote!.emitAcc[i]--; this.spawn(f); }
      });
    }

    if (this.emote?.id === "camera" && et > 0.35 && et < 0.4) this.flash = 1;
    this.flash = Math.max(0, this.flash - dt * 3);

    for (const q of this.particles) {
      q.life += dt;
      q.vy += q.g * dt;
      if (q.shape === "heart" || q.shape === "note" || q.shape === "z") q.x += Math.sin(q.life * 4 + q.rot) * 10 * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
      if (q.shape === "coin" && q.y > 74 && q.vy > 0) q.vy *= -0.5;
    }
    this.particles = this.particles.filter((q) => q.life < q.ttl && q.y < LH + 10 && q.y > -20);
  }

  // ─── dessin ──────────────────────────────────────────────────────────────────
  private motion(m: Motion, et: number) {
    let dx = 0, dy = 0, rot = 0, sx = 1, sy = 1;
    switch (m) {
      case "hop": { const h = Math.abs(Math.sin(Math.PI * ((et * 2.4) % 1))); dy = -h * 7; sy = 1 + h * 0.08; sx = 1 / sy; break; }
      case "laugh": { const h = Math.abs(Math.sin(et * 14)); dy = -h * 3; break; }
      case "sway": dx = Math.sin(et * 2.6) * 5; rot = Math.sin(et * 2.6) * 0.06; break;
      case "nod": { const n = Math.max(0, Math.sin(et * 5)); dy = n * 4; break; }
      case "shake": dx = Math.sin(et * 38) * 3; break;
      case "shiver": dx = Math.sin(et * 50) * 1.2; break;
      case "spin": { const u = clamp(et / 0.6, 0, 1); sx = Math.abs(Math.cos(u * Math.PI)); break; }
      case "tilt": rot = -0.16 * clamp(et * 5, 0, 1); break;
      case "float": dy = Math.sin(et * 2) * 2; break;
    }
    return { dx, dy, rot, sx, sy };
  }

  private draw() {
    const g = this.ctx, L = this.lctx;
    g.clearRect(0, 0, LW, LH);
    L.clearRect(0, 0, LW, LH);
    const e = this.emote?.def;
    const et = this.emote ? this.t - this.emote.t0 : 0;
    const col = rgb(this.color);
    const m = this.motion(e?.motion ?? (this.sleeping ? "float" : "none"), et);

    // clignement, frappe, repas, respiration
    let hMul = 1, wMul = 1;
    if (this.t < this.blinkUntil && !this.sleeping) hMul *= 0.08;
    hMul *= 1 - this.kick * 0.18; wMul *= 1 + this.kick * 0.08;
    if (this.eating) {
      const u = (this.t - this.eating.t0) / 1;
      if (u < 0.45) { hMul *= 1.15; wMul *= 1.08; }
      else { const c = Math.abs(Math.cos(((u - 0.45) / 0.55) * Math.PI * 2)); hMul *= 0.15 + 0.85 * c; }
    }
    if (this.sleeping) hMul *= 1 + Math.sin(this.t * 1.4) * 0.3;

    // calque des yeux (formes pleines, puis découpes des paupières)
    L.save();
    L.translate(70 + this.face.dx + m.dx, EY + m.dy + (this.sleeping ? 5 : 0));
    L.rotate(m.rot);
    L.scale(this.face.scale * m.sx, this.face.scale * m.sy);
    L.translate(-70, -EY);
    this.eyes.forEach((s, i) => this.drawEye(L, s, i, hMul, wMul, col));
    L.restore();

    if (this.propShown && this.propAmt > 0.02) this.drawIcon(L, this.propShown, et, col);
    if (this.eating) this.drawEaten(L, col);
    if (this.thinking) this.drawLoader(L, col);
    if (e?.sweat) this.drawSweat(L, et);

    // lueur « écran » autour de ce qui est allumé
    g.save();
    g.shadowColor = rgb(this.color, 0.85);
    g.shadowBlur = 5 * this.k;
    g.drawImage(this.layer, 0, 0, LW, LH);
    g.restore();

    this.drawParticles(g);
    if (this.flash > 0) { g.fillStyle = `rgba(255,255,255,${this.flash * 0.7})`; g.fillRect(0, 0, LW, LH); }
  }

  private drawEye(L: CanvasRenderingContext2D, s: EyeState, i: number, hMul: number, wMul: number, col: string) {
    const side = i === 0 ? -1 : 1; // -1 : œil gauche
    const cx = EX[i] + this.look.x * 10, cy = EY + this.look.y * 7;
    // l'œil du côté où l'on regarde grandit un peu (effet de perspective)
    const persp = 1 + side * this.look.x * 0.08;
    const w = s.w * wMul * persp, h = Math.max(1.5, s.h * hMul * persp);
    const x0 = cx - w / 2, y0 = cy - h / 2;
    const glyph = s.glyph;
    const a = glyph === "none" ? 1 : s.gAmt;

    L.fillStyle = col;
    if (glyph === "none") {
      L.beginPath(); L.roundRect(x0, y0, w, h, Math.min(s.r, w / 2, h / 2)); L.fill();
    } else {
      const size = 30 * (0.4 + 0.6 * s.gAmt) * (hMul < 0.3 ? hMul * 3 : 1);
      this.glyph(L, glyph, cx, cy, size, col, side);
    }
    if (a < 0.01 || glyph !== "none") return;

    // découpes : paupière haute (fâchée / triste), bas en arc (joie), reflet
    L.save();
    L.globalCompositeOperation = "destination-out";
    const inner = side === -1 ? x0 + w : x0; // coin du côté du nez
    const outer = side === -1 ? x0 : x0 + w;
    const dIn = h * (s.top + Math.max(0, s.slant) * 0.55);
    const dOut = h * (s.top + Math.max(0, -s.slant) * 0.55);
    if (dIn > 0.3 || dOut > 0.3) {
      L.beginPath();
      L.moveTo(outer, y0 - 3); L.lineTo(inner, y0 - 3);
      L.lineTo(inner + (inner - outer) * 0.05, y0 + dIn);
      L.lineTo(outer - (inner - outer) * 0.05, y0 + dOut);
      L.closePath(); L.fill();
    }
    if (s.bottom > 0.02) {
      L.beginPath();
      L.ellipse(cx, y0 + h * 1.08, w * 0.72, h * s.bottom * 1.02 + h * 0.08, 0, 0, Math.PI * 2);
      L.fill();
    }
    if (s.shine > 0.05) {
      const sx = cx + w * 0.18, sy = cy - h * 0.18, r = 4.2 * s.shine;
      L.beginPath();
      L.moveTo(sx, sy - r); L.lineTo(sx + r * 0.35, sy - r * 0.35); L.lineTo(sx + r, sy); L.lineTo(sx + r * 0.35, sy + r * 0.35);
      L.lineTo(sx, sy + r); L.lineTo(sx - r * 0.35, sy + r * 0.35); L.lineTo(sx - r, sy); L.lineTo(sx - r * 0.35, sy - r * 0.35);
      L.closePath(); L.fill();
      L.beginPath(); L.arc(sx - 6, sy + 7, 1.6 * s.shine, 0, Math.PI * 2); L.fill();
    }
    L.restore();
  }

  private glyph(L: CanvasRenderingContext2D, kind: Glyph, cx: number, cy: number, size: number, col: string, side: number) {
    L.save();
    L.translate(cx, cy);
    switch (kind) {
      case "heart": {
        const s = size / 30, beat = 1 + Math.max(0, Math.sin(this.t * 9)) * 0.08;
        L.scale(s * beat, s * beat);
        L.fillStyle = "#ff6b8b";
        L.beginPath();
        L.moveTo(0, 12);
        L.bezierCurveTo(-18, 0, -14, -15, 0, -6);
        L.bezierCurveTo(14, -15, 18, 0, 0, 12);
        L.fill();
        break;
      }
      case "star": {
        L.rotate(this.t * 1.5 * side);
        L.fillStyle = "#ffd166";
        this.starPath(L, 0, 0, size * 0.55, size * 0.24, 5);
        L.fill();
        break;
      }
      case "spiral": {
        L.rotate(this.t * 6 * side);
        L.strokeStyle = col; L.lineWidth = 3; L.lineCap = "round";
        L.beginPath();
        for (let a = 0; a < Math.PI * 5; a += 0.2) { const r = (a / (Math.PI * 5)) * size * 0.5; L.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        L.stroke();
        break;
      }
      case "x": {
        const r = size * 0.36;
        L.strokeStyle = col; L.lineWidth = 5; L.lineCap = "round";
        L.beginPath(); L.moveTo(-r, -r); L.lineTo(r, r); L.moveTo(r, -r); L.lineTo(-r, r); L.stroke();
        break;
      }
      default: break;
    }
    L.restore();
  }

  private starPath(L: CanvasRenderingContext2D, x: number, y: number, R: number, r: number, n: number) {
    L.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = (i * Math.PI) / n - Math.PI / 2, rad = i % 2 ? r : R;
      L.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    L.closePath();
  }

  /** Petites icônes au trait, dans la couleur des yeux (comme sur un écran monochrome). */
  private drawIcon(L: CanvasRenderingContext2D, p: Prop, et: number, col: string) {
    const a = this.propAmt;
    L.save();
    L.globalAlpha = a;
    L.translate(ICON_X + (1 - a) * 14, 38 + Math.sin(et * 3) * 1.5);
    L.strokeStyle = col; L.fillStyle = col; L.lineWidth = 2.4; L.lineCap = "round"; L.lineJoin = "round";
    const line = (pts: number[][]) => { L.beginPath(); pts.forEach(([x, y], i) => (i ? L.lineTo(x, y) : L.moveTo(x, y))); L.stroke(); };
    const text = (s: string, sz: number) => { L.font = `700 ${sz}px "Cascadia Mono", Consolas, monospace`; L.textAlign = "center"; L.textBaseline = "middle"; L.fillText(s, 0, 1); };
    switch (p) {
      case "bulb":
        L.beginPath(); L.arc(0, -4, 9, Math.PI * 0.8, Math.PI * 2.2); L.stroke();
        line([[-4, 5], [-4, 9], [4, 9], [4, 5]]); line([[-3, 12.5], [3, 12.5]]);
        if (Math.sin(et * 8) > -0.3) for (let i = 0; i < 5; i++) { const an = -Math.PI / 2 + (i - 2) * 0.55; line([[Math.cos(an) * 13, -4 + Math.sin(an) * 13], [Math.cos(an) * 17, -4 + Math.sin(an) * 17]]); }
        break;
      case "qmark": text("?", 30); break;
      case "exclaim": text("!", 30); break;
      case "key":
        L.beginPath(); L.arc(-7, 0, 6, 0, Math.PI * 2); L.stroke();
        line([[-1, 0], [13, 0]]); line([[9, 0], [9, 5]]); line([[13, 0], [13, 4]]);
        break;
      case "magnifier": {
        const sx = Math.sin(et * 3) * 3;
        L.beginPath(); L.arc(-3 + sx, -3, 8, 0, Math.PI * 2); L.stroke();
        L.lineWidth = 3.4; line([[3 + sx, 3], [11 + sx, 11]]);
        break;
      }
      case "wifi":
        for (let i = 1; i <= 3; i++) { L.beginPath(); L.arc(0, 8, i * 5.5, Math.PI * 1.25, Math.PI * 1.75); L.stroke(); }
        L.beginPath(); L.arc(0, 8, 1.8, 0, Math.PI * 2); L.fill();
        L.strokeStyle = "#f14c4c"; line([[-12, -12], [12, 12]]);
        break;
      case "clock": {
        L.beginPath(); L.arc(0, 0, 11, 0, Math.PI * 2); L.stroke();
        const an = et * 4;
        line([[0, 0], [0, -7]]); line([[0, 0], [Math.cos(an) * 8, Math.sin(an) * 8]]);
        break;
      }
      case "doc":
        line([[-8, -12], [4, -12], [9, -7], [9, 12], [-8, 12], [-8, -12]]);
        L.lineWidth = 1.8; for (let i = 0; i < 3; i++) line([[-4, -3 + i * 5], [5, -3 + i * 5]]);
        break;
      case "code": text("</>", 13); break;
      case "cloud":
        L.beginPath(); L.arc(-6, 0, 6, Math.PI * 0.5, Math.PI * 1.5); L.arc(0, -4, 7, Math.PI, Math.PI * 2); L.arc(7, 0, 6, Math.PI * 1.5, Math.PI * 0.5); L.closePath(); L.stroke();
        break;
      case "sun":
        L.rotate(et * 1.2);
        L.beginPath(); L.arc(0, 0, 6, 0, Math.PI * 2); L.stroke();
        for (let i = 0; i < 8; i++) { const an = (i * Math.PI) / 4; line([[Math.cos(an) * 10, Math.sin(an) * 10], [Math.cos(an) * 14, Math.sin(an) * 14]]); }
        break;
      case "umbrella":
        L.beginPath(); L.arc(0, -2, 12, Math.PI, Math.PI * 2); L.closePath(); L.stroke();
        line([[0, -2], [0, 11]]); L.beginPath(); L.arc(-3, 11, 3, 0, Math.PI); L.stroke();
        break;
      case "shield":
        line([[0, -13], [11, -8], [10, 3], [0, 13], [-10, 3], [-11, -8], [0, -13]]);
        line([[-4, 0], [-1, 4], [5, -4]]);
        break;
      case "cup":
        line([[-9, -4], [-7, 11], [5, 11], [7, -4], [-9, -4]]);
        L.beginPath(); L.arc(9, 3, 4, -Math.PI / 2, Math.PI / 2); L.stroke();
        L.lineWidth = 1.6; for (let i = 0; i < 2; i++) { const o = Math.sin(et * 4 + i) * 1.5; line([[-4 + i * 6 + o, -8], [-4 + i * 6 - o, -14]]); }
        break;
      case "camera":
        L.beginPath(); L.roundRect(-12, -7, 24, 17, 3); L.stroke();
        L.beginPath(); L.arc(0, 1.5, 5, 0, Math.PI * 2); L.stroke();
        line([[-5, -7], [-3, -11], [3, -11], [5, -7]]);
        break;
      case "chart": {
        line([[-12, 12], [12, 12]]);
        const hs = [7, 12, 18].map((v, i) => v * clamp(et * 2 - i * 0.2, 0, 1));
        L.lineWidth = 4.5; hs.forEach((v, i) => line([[-7 + i * 7, 10], [-7 + i * 7, 10 - v]]));
        break;
      }
      case "box":
        line([[-11, -4], [11, -4], [11, 11], [-11, 11], [-11, -4]]);
        line([[-11, -4], [-6, -11], [16 - 10, -11], [11, -4]]); line([[0, -4], [0, 11]]);
        break;
    }
    L.restore();
  }

  /** Le fichier glisse depuis la droite (côté saisie) jusqu'entre les yeux, puis disparaît. */
  private drawEaten(L: CanvasRenderingContext2D, col: string) {
    const u = (this.t - this.eating!.t0) / 1;
    if (u > 0.5) return;
    const p = u / 0.5, s = 1 - p * 0.7;
    L.save();
    L.translate(150 - p * 80, 40);
    L.scale(s, s);
    L.fillStyle = col;
    L.beginPath(); L.moveTo(-7, -9); L.lineTo(3, -9); L.lineTo(7, -5); L.lineTo(7, 9); L.lineTo(-7, 9); L.closePath(); L.fill();
    L.restore();
  }

  /** Pendant que l'IA réfléchit : une petite barre de chargement sous les yeux. */
  private drawLoader(L: CanvasRenderingContext2D, col: string) {
    L.save();
    L.fillStyle = col;
    for (let i = 0; i < 3; i++) {
      const on = (Math.sin(this.t * 7 - i * 0.9) + 1) / 2;
      L.globalAlpha = 0.25 + on * 0.75;
      L.beginPath(); L.roundRect(60 + i * 8 - 2.5, 68 - on * 2, 5, 5, 1.5); L.fill();
    }
    L.restore();
  }

  private drawSweat(L: CanvasRenderingContext2D, et: number) {
    const y = 14 + ((et * 12) % 16);
    L.save();
    L.fillStyle = "#9fd0ff";
    L.globalAlpha = 1 - ((et * 12) % 16) / 18;
    L.beginPath(); L.moveTo(EX[1] + 16, y - 5); L.quadraticCurveTo(EX[1] + 20, y + 1, EX[1] + 16, y + 2); L.quadraticCurveTo(EX[1] + 12, y + 1, EX[1] + 16, y - 5); L.fill();
    L.restore();
  }

  private drawParticles(g: CanvasRenderingContext2D) {
    for (const q of this.particles) {
      const a = 1 - q.life / q.ttl;
      g.save();
      g.globalAlpha = Math.min(1, a * 1.4);
      g.translate(q.x, q.y);
      g.rotate(q.rot);
      g.fillStyle = q.color;
      switch (q.shape) {
        case "heart": {
          const s = q.size / 10;
          g.scale(s, s);
          g.beginPath(); g.moveTo(0, 5); g.bezierCurveTo(-8, 0, -6, -7, 0, -3); g.bezierCurveTo(6, -7, 8, 0, 0, 5); g.fill();
          break;
        }
        case "confetti": g.fillRect(-q.size / 2, -q.size / 4, q.size, q.size / 2); break;
        case "star": this.starPath(g, 0, 0, q.size, q.size * 0.45, 5); g.fill(); break;
        case "spark": {
          const r = q.size;
          g.beginPath(); g.moveTo(0, -r); g.lineTo(r * 0.3, 0); g.lineTo(0, r); g.lineTo(-r * 0.3, 0); g.closePath(); g.fill();
          g.beginPath(); g.moveTo(-r, 0); g.lineTo(0, r * 0.3); g.lineTo(r, 0); g.lineTo(0, -r * 0.3); g.closePath(); g.fill();
          break;
        }
        case "drop": g.beginPath(); g.ellipse(0, 0, q.size * 0.7, q.size, 0, 0, Math.PI * 2); g.fill(); break;
        case "puff": g.globalAlpha *= 0.7; g.beginPath(); g.arc(0, 0, q.size * (1 + q.life), 0, Math.PI * 2); g.fill(); break;
        case "coin": g.beginPath(); g.ellipse(0, 0, q.size * Math.abs(Math.cos(q.life * 8)) + 0.8, q.size, 0, 0, Math.PI * 2); g.fill(); break;
        case "note": case "z": case "char": {
          g.font = `700 ${q.size}px "Cascadia Mono", Consolas, monospace`;
          g.textAlign = "center"; g.textBaseline = "middle";
          g.fillText(q.shape === "note" ? "♪" : q.text ?? "", 0, 0);
          break;
        }
      }
      g.restore();
    }
  }
}
