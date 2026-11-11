// After the API and web apps are built: put every app's dist under public/<app>/ (Vercel's static output) plus the landing page.
import fs from 'node:fs';
import { landingHtml, WEB_APPS } from '../apps/api/dist/web.js';

fs.rmSync('public', { recursive: true, force: true });
for (const app of WEB_APPS) {
  const dist = `apps/${app}/dist`;
  if (!fs.existsSync(`${dist}/index.html`)) throw new Error(`${dist}/index.html is missing: did build:web run?`);
  fs.cpSync(dist, `public/${app}`, { recursive: true });
}
fs.writeFileSync('public/index.html', landingHtml(WEB_APPS));
console.log(`public/: ${WEB_APPS.join(', ')} + index.html`);
