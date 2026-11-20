/* A small, consistent icon set (24×24, round strokes). */
const s = (body: string, extra = '') =>
  `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

export const ICONS = {
  map: s('<path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5V4l-6 2.5L9 4Z"/><path d="M9 4v13M15 6.5v13"/>'),
  soundOn: s('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  soundOff: s('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>'),
  expand: s('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  close: s('<path d="M6 6l12 12M18 6 6 18"/>'),
  pause: s('<path d="M8 5v14M16 5v14"/>'),
  play: s('<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>'),
  arrow: s('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  back: s('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  heart: s('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" fill="currentColor" stroke="none"/>'),
  sparkle: s('<path d="M12 3c.6 3.7 1.6 4.8 5 5.4-3.4.6-4.4 1.7-5 5.4-.6-3.7-1.6-4.8-5-5.4 3.4-.6 4.4-1.7 5-5.4ZM18.5 14c.3 1.8.8 2.3 2.5 2.6-1.7.3-2.2.8-2.5 2.6-.3-1.8-.8-2.3-2.5-2.6 1.7-.3 2.2-.8 2.5-2.6Z" fill="currentColor" stroke="none"/>'),
  link: s('<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>'),
  external: s('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  lock: s('<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
  check: s('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  shuffle: s('<path d="M4 7h3.5c4 0 5 10 9 10H20M4 17h3.5c1.4 0 2.4-1.2 3.2-2.8M14.3 9.8C15 8.2 16 7 17.5 7H20M17 4l3 3-3 3M17 14l3 3-3 3"/>'),
  keyboard: s('<rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>'),
  download: s('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  user: s('<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>'),
  refresh: s('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>'),
};
