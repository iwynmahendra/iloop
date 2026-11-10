const { chromium } = require('playwright');
const B = 'http://127.0.0.1:4000'; const probs = [];
const log = (ok, n, x = '') => console.log(`${ok ? 'OK  ' : 'FAIL'} ${n} ${x}`);
async function step(n, f) { try { const r = await f(); log(true, n, r ?? ''); } catch (e) { log(false, n, String(e.message).split('\n')[0]); } }
(async () => {
  const br = await chromium.launch();
  const watch = (p, tag) => { p.on('console', (m) => { if (m.type() === 'error') probs.push(`${tag} console: ${m.text().slice(0, 160)}`); }); p.on('pageerror', (e) => probs.push(`${tag} pageerror: ${e.message.slice(0, 160)}`)); p.setDefaultTimeout(8000); };
  // staff
  const sc = await br.newContext({ viewport: { width: 1280, height: 800 } }); const s = await sc.newPage(); watch(s, 'staff');
  await step('ops login + overview', async () => { await s.goto(B + '/ops/'); await s.fill('input[type=email]', 'admin@ubud.example'); await s.fill('input[type=password]', 'ChangeMe!2026'); await s.click('button[type=submit]'); await s.waitForSelector('text=What needs attention'); return (await s.locator('text=Alerts').first().textContent()); });
  await step('ops: create task', async () => { await s.goto(B + '/ops/tasks'); await s.click('text=New task'); await s.fill('#nt input >> nth=0', 'E2E fix mini-bar light'); await s.click('button:has-text("Create")'); await s.waitForSelector('text=E2E fix mini-bar light'); });
  await step('ops: start task', async () => { const c = s.locator('div:has(> button:text("E2E fix mini-bar light"))').first(); await c.locator('button:has-text("Start")').click(); await s.waitForSelector('text=In progress'); await s.waitForTimeout(500); });
  await step('ops: rooms board', async () => { await s.goto(B + '/ops/rooms'); await s.waitForSelector('text=Floor'); const b = s.locator('button[aria-label^="Room 305"]'); await b.click(); await s.waitForTimeout(600); return await s.locator('button[aria-label^="Room 305"]').getAttribute('aria-label'); });
  await step('ops: dining, kb, team pages', async () => { await s.goto(B + '/ops/dining'); await s.click('text=Menu'); await s.waitForSelector('text=Mains, text=Breakfast').catch(() => {}); await s.goto(B + '/ops/knowledge'); await s.waitForSelector('h2'); const n = await s.locator('h2').count(); await s.goto(B + '/ops/team'); await s.waitForSelector('text=Shift handover'); return `kb docs ${n}`; });
  // guest (phone)
  const gc = await br.newContext({ viewport: { width: 390, height: 800 }, isMobile: true }); const g = await gc.newPage(); watch(g, 'guest');
  await step('guest: bad sign-in rejected', async () => { await g.goto(B + '/guest/'); await g.fill('input >> nth=0', 'HTL-2610-0003'); await g.fill('input >> nth=1', 'Nobody'); await g.click('button.primary'); await g.waitForSelector('[role=alert]'); });
  await step('guest: sign in', async () => { await g.fill('input >> nth=1', 'Rossi'); await g.click('button.primary'); await g.waitForSelector('text=Hello, Sofia'); return await g.locator('.hero').innerText().then((t) => t.replace(/\n/g, ' | ')); });
  await step('guest: request towels', async () => { await g.click('nav >> text=Services'); await g.click('button.tile:has-text("Extra towels")'); await g.click('button:has-text("Send request")'); await g.waitForSelector('[role=status]'); await g.waitForSelector('.req .steps'); });
  await step('guest: no horizontal scroll', async () => { const w = await g.evaluate(() => document.documentElement.scrollWidth); if (w > 392) throw new Error('scrollWidth ' + w); return w; });
  await step('ops sees request, starts it', async () => { await s.goto(B + '/ops/requests'); await s.waitForSelector('text=Extra towels'); const c = s.locator('div:has(> button:text-matches("Extra towels"))').first(); await c.locator('button:has-text("Start")').click(); await s.waitForTimeout(700); });
  await step('guest sees progress', async () => { await g.reload(); await g.click('nav >> text=Services'); await g.waitForSelector('.steps li.now:has-text("In progress")'); });
  await step('guest: room dining order', async () => { await g.click('nav >> text=Dining'); await g.waitForSelector('.item'); await g.locator('.qty button[aria-label^="Add one"]').first().click(); await g.click('button.primary:has-text("Order")'); await g.waitForSelector('[role=status]'); });
  await step('ops sees order, advances', async () => { await s.goto(B + '/ops/dining'); await s.waitForSelector('text=Start preparing'); await s.click('button:has-text("Start preparing")'); await s.waitForTimeout(500); });
  await step('guest: DND on', async () => { await g.click('nav >> text=Home'); await g.locator('input[role=switch]').check({ force: true }); await g.waitForTimeout(500); });
  await step('ops rooms shows DND', async () => { await s.goto(B + '/ops/rooms'); await s.waitForSelector('text=Floor'); const t = await s.locator('text=/Do not disturb: \\d+/').first().textContent(); if (/: 0/.test(t)) throw new Error(t); return t; });
  await step('guest: assistant answers', async () => { await g.click('nav >> text=Assistant'); await g.fill('input[aria-label="Your question"]', 'What time is breakfast?'); await g.click('button:has-text("Send")'); await g.waitForSelector('.bubble.assistant >> nth=1', { timeout: 10000 }); return (await g.locator('.bubble.assistant').nth(1).innerText()).slice(0, 80); });
  await step('guest: sign out', async () => { await g.click('nav >> text=My stay'); await g.click('button:has-text("Sign out")'); await g.waitForSelector('text=Welcome'); });
  await g.screenshot({ path: (process.env.SHOTS || '/tmp') + '/guest.png' }); await s.screenshot({ path: (process.env.SHOTS || '/tmp') + '/ops.png' });
  console.log('problems:', probs); await br.close();
})();
