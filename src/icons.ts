const svg = (d: string, extra = "") => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
export const ICON = {
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  chevron: svg('<path d="m6 9 6 6 6-6"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  clip: svg('<path d="m21.4 11-9.2 9.2a5.5 5.5 0 0 1-7.8-7.8l9.2-9.2a3.7 3.7 0 0 1 5.2 5.2l-9.2 9.2a1.8 1.8 0 0 1-2.6-2.6l8.5-8.5"/>'),
  send: svg('<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>'),
  back: svg('<path d="m15 18-6-6 6-6"/>'),
  x: svg('<path d="M18 6 6 18M6 6l12 12"/>', 'width="14" height="14"'),
  check: svg('<path d="M20 6 9 17l-5-5"/>'),
  globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
  brain: svg('<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3V4z"/><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3V4z"/><path d="M9 4c1 0 3 .5 3 2v14c0-1.5-2-2-3-2M15 4c-1 0-3 .5-3 2"/>', 'width="14" height="14"'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  capFiles: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="m10 13-2 2 2 2M14 13l2 2-2 2"/>'),
  capImages: svg('<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="m21 16-5-5-9 9"/>'),
  capPdf: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><text x="12" y="17.3" font-size="6.2" font-weight="800" text-anchor="middle" fill="currentColor" stroke="none" font-family="Segoe UI, sans-serif">PDF</text>'),
  capImageGen: svg('<path d="m4 20 10-10"/><path d="m13 7 1-3 1 3 3 1-3 1-1 3-1-3-3-1z" fill="currentColor"/><path d="M19 13.5 19.6 15l1.4.5-1.4.5-.6 1.5-.6-1.5L17 15.5l1.4-.5z" fill="currentColor"/><path d="M6.5 5 7 6.3l1.3.5L7 7.3 6.5 8.6 6 7.3l-1.3-.5L6 6.3z" fill="currentColor"/>'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', 'width="16" height="16"'),
};
