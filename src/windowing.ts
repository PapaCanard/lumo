// La fenêtre est une barre collée en haut de l'écran, sur toute la largeur.
// Deux états : « bar » (la barre seule) et « console » (la barre + une console qui descend).
import { appbar, dock, inTauri } from "./bridge";

export const BAR_H = 52;
export type Mode = "bar" | "console";

let current: Mode = "bar";
export const currentMode = () => current;

/** Hauteur de la console qui descend sous la barre. */
export const consoleHeight = () => Math.min(Math.round(window.screen.height * 0.6), 600);

export async function setMode(mode: Mode): Promise<void> {
  current = mode;
  document.documentElement.dataset.mode = mode;
  await dock(mode === "console" ? BAR_H + consoleHeight() : BAR_H);
}

export async function place(reserve: boolean): Promise<void> {
  document.documentElement.dataset.mode = "bar";
  await dock(BAR_H);
  await setReserve(reserve);
}

export async function setReserve(on: boolean): Promise<void> {
  try { await appbar(on, BAR_H); } catch { /* non supporté : la barre reste simplement au premier plan */ }
}

export async function setAlwaysOnTop(on: boolean): Promise<void> {
  if (!inTauri) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().setAlwaysOnTop(on);
}

/** Suit le curseur (même hors de la fenêtre) pour que Lumo le regarde. `center` donne le centre du robot, en px CSS dans la fenêtre. */
export function trackCursor(center: () => { x: number; y: number }, cb: (nx: number, ny: number) => void): void {
  if (!inTauri) {
    window.addEventListener("pointermove", (e) => { const c = center(); cb((e.clientX - c.x) / 300, (e.clientY - c.y) / 220); });
    return;
  }
  let busy = false;
  window.setInterval(async () => {
    if (busy || document.hidden) return;
    busy = true;
    try {
      const { cursorPosition, getCurrentWindow } = await import("@tauri-apps/api/window");
      const wnd = getCurrentWindow();
      const [cur, pos, sf] = await Promise.all([cursorPosition(), wnd.outerPosition(), wnd.scaleFactor()]);
      const c = center();
      cb((((cur.x - pos.x) / sf) - c.x) / 300, (((cur.y - pos.y) / sf) - c.y) / 220);
    } catch { /* fenêtre en cours de fermeture */ } finally { busy = false; }
  }, 90);
}
