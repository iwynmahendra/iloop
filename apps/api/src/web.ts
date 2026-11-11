// The built web apps and the landing page that links them. No config import: the Vercel build script uses this without env vars.
export const WEB_APPS = ['hotel', 'trips', 'transport', 'club', 'operator', 'ops', 'guest'] as const;
const APP_LABEL: Record<string, string> = { hotel: 'Hotel admin', trips: 'Trips admin', transport: 'Transport admin', club: 'Club admin', operator: 'Operator console', ops: 'Ops board (staff)', guest: 'Guest concierge' };

export const landingHtml = (apps: readonly string[]) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Booking platform</title>
<style>body{font:16px system-ui;margin:0;display:grid;place-items:center;min-height:100vh;background:#f5f6f8;color:#1b2230}main{padding:2rem;max-width:30rem;width:100%}a{display:block;padding:.9rem 1rem;margin:.5rem 0;background:#fff;border:1px solid #d9dde5;border-radius:.6rem;color:inherit;text-decoration:none}a:hover{border-color:#2c4fd6}small{color:#667}</style>
<main><h1>Booking platform</h1>${apps.map((k) => `<a href="/${k}/">${APP_LABEL[k]}<br><small>/${k}/</small></a>`).join('')}<a href="/api/docs">API documentation<br><small>/api/docs</small></a></main>`;
