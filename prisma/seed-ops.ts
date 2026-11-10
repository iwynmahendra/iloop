/**
 * Demo data for the Ops Board and the guest app: staff, rooms, a room-dining menu, hotel documents and a few tasks,
 * for every non-platform supplier that has a hotel. Run AFTER prisma/seed.ts:  npm run db:seed:ops
 * Safe to re-run: a supplier that already has staff is skipped.
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }) });
const data = JSON.parse(readFileSync(new URL('./seed-ops.data.json', import.meta.url), 'utf8')) as { kb: any[]; menu: any[] };
const STAFF: [string, string][] = [['Made', 'Housekeeping'], ['Ketut', 'Housekeeping'], ['Wayan', 'Maintenance'], ['Putu', 'Front desk'], ['Komang', 'F&B'], ['Agus', 'F&B']];

async function main() {
  // also works when connected as the restricted runtime role: ask for the super admin context first
  const sups = await prisma.$transaction(async (tx) => { await tx.$executeRaw`SELECT set_config('app.role','SUPER_ADMIN',true), set_config('app.supplier_id','',true)`; return tx.supplier.findMany({ where: { isPlatform: false, deletedAt: null, hotels: { some: {} } } as any, select: { id: true, code: true } }); });
  for (const s of sups) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.role','SUPER_ADMIN',true), set_config('app.supplier_id','',true)`;
      if (await tx.opsStaff.count({ where: { supplierId: s.id } })) { console.log(`${s.code}: already has ops data, skipped`); return; }
      const staff = []; for (const [name, department] of STAFF) staff.push(await tx.opsStaff.create({ data: { supplierId: s.id, name, department } }));
      const rooms = []; for (const fl of [1, 2, 3]) for (let n = 1; n <= 8; n++) rooms.push({ supplierId: s.id, roomNumber: `${fl}${String(n).padStart(2, '0')}`, floor: String(fl), status: (['CLEAN', 'DIRTY', 'INSPECTED', 'CLEAN'] as const)[(fl + n) % 4] });
      await tx.opsRoom.createMany({ data: rooms });
      await tx.diningItem.createMany({ data: data.menu.map((m) => ({ supplierId: s.id, ...m })) });
      await tx.kbDoc.createMany({ data: data.kb.map((d) => ({ supplierId: s.id, ...d })) });
      const by = (n: string) => staff.find((x) => x.name === n)!.id;
      const mk = (title: string, department: string, priority: string, status: string, who: string | null, roomNumber?: string) => ({ supplierId: s.id, kind: 'TASK', title, department, priority, status, assigneeId: who ? by(who) : null, roomNumber: roomNumber ?? null, createdBy: 'seed', dueAt: new Date(Date.now() + 3 * 3600e3), log: [{ at: new Date().toISOString(), by: 'seed', message: 'Created' }] });
      await tx.opsTask.createMany({ data: [mk('Deep clean pool deck', 'Maintenance', 'NORMAL', 'TODO', 'Wayan'), mk('Restock minibar, floor 2', 'Housekeeping', 'NORMAL', 'IN_PROGRESS', 'Made', '205'), mk('Replace corridor light', 'Maintenance', 'URGENT', 'BLOCKED', 'Wayan', '301'), mk('Prepare VIP welcome fruit', 'F&B', 'NORMAL', 'TODO', 'Komang', '302'), mk('Print arrivals list', 'Front desk', 'NORMAL', 'DONE', 'Putu')] });
      await tx.shiftNote.create({ data: { supplierId: s.id, author: 'seed', body: 'Pool pump service Thursday 10:00. Please redirect guests to the beach loungers.' } });
      console.log(`${s.code}: seeded ${staff.length} staff, ${rooms.length} rooms, ${data.menu.length} menu items, ${data.kb.length} documents`);
    });
  }
}
main().finally(() => prisma.$disconnect());
