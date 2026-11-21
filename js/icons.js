// Minimal 24px line icons (stroke = currentColor), drawn for this app.
const P = {
  overview: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  alerts: '<path d="M12 3 2.5 20h19L12 3z"/><path d="M12 10v4"/><path d="M12 17.5v.01"/>',
  followups: '<path d="M9 11l2.5 2.5L16 9"/><rect x="3.5" y="3.5" width="17" height="17" rx="3"/>',
  stores: '<path d="M3 9.5 4.5 4h15L21 9.5"/><path d="M3 9.5h18v1a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 13.5V20h14v-6.5"/><path d="M10 20v-4h4v4"/>',
  coach: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  visits: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  reports: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
  data: '<ellipse cx="12" cy="5.5" rx="8" ry="2.5"/><path d="M4 5.5v6c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-6"/><path d="M4 11.5v6c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-6"/>',
  todo: '<path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="m3.5 6 1.5 1.5L7.5 5"/><path d="m3.5 12 1.5 1.5L7.5 11"/><path d="m3.5 18 1.5 1.5L7.5 17"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9v12h14V9"/><path d="M10 21v-6h4v6"/>',
  team: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.6 0 4.5 1.9 4.5 4.5"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M7 10h6"/><path d="M7 14h10"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  menu: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4.5h6V7"/><path d="M6.5 7l1 13h9l1-13"/>',
  download: '<path d="M12 4v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M4 20h16"/>',
  print: '<path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14h10v6.5H7z"/>',
  switch: '<path d="M4 8h13"/><path d="m14 4.5 3.5 3.5L14 11.5"/><path d="M20 16H7"/><path d="m10 12.5-3.5 3.5 3.5 3.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5v.01"/>',
  inbox: '<path d="M3.5 13.5 6 5h12l2.5 8.5"/><path d="M3.5 13.5V19h17v-5.5h-5a3.5 3.5 0 0 1-7 0z"/>',
  bulb: '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
};
export const icon = (name, size = 18) =>
  `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;
