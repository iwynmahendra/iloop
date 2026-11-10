import { Router } from 'express';
import { withDb, type Tx } from '../db.js';
import { ok } from '../http.js';

export const dashboardRouter = Router();

dashboardRouter.get('/', async (req, res) => {
  const s = req.scope!;
  const sup = s.supplierId ? { supplierId: s.supplierId } : {}; // super admin without a chosen supplier = everything
  const live = { deletedAt: null, ...sup };
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const data = await withDb(s.db, async (tx: Tx) => {
    const [hotels, roomTypes, ratePlans, trips, variants, upcomingSchedules, services, vehicleTypes, drivers, vehicles, clubs, upcomingEvents, tickets, media, cities, amenities, inactive, recent] = await Promise.all([
      tx.hotel.count({ where: live }), tx.roomType.count({ where: live }), tx.ratePlan.count({ where: { ...live, dateTo: { gte: today } } }),
      tx.trip.count({ where: live }), tx.tripVariant.count({ where: live }), tx.tripSchedule.count({ where: { ...live, date: { gte: today } } }),
      tx.transportService.count({ where: live }), tx.vehicleType.count({ where: live }), tx.driver.count({ where: live }), tx.vehicle.count({ where: live }),
      tx.club.count({ where: live }), tx.clubEvent.count({ where: { ...live, eventDate: { gte: today } } }), tx.clubTicketType.count({ where: live }),
      tx.mediaAsset.count({ where: live }), tx.city.count({ where: live }), tx.amenity.count({ where: live }),
      Promise.all([tx.hotel.count({ where: { ...live, status: 'INACTIVE' } }), tx.trip.count({ where: { ...live, status: 'INACTIVE' } }), tx.transportService.count({ where: { ...live, status: 'INACTIVE' } }), tx.club.count({ where: { ...live, status: 'INACTIVE' } })]),
      tx.auditLog.findMany({ where: { ...sup, action: { in: ['CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'ACTIVATE', 'DEACTIVATE', 'IMPORT'] } }, orderBy: { createdAt: 'desc' }, take: 15,
        select: { id: true, action: true, entityType: true, entityId: true, userEmail: true, supplierId: true, createdAt: true } }),
    ]);
    const out: Record<string, unknown> = {
      counts: {
        hotel: { hotels, roomTypes, activeRatePlans: ratePlans }, trips: { trips, variants, upcomingSchedules },
        transport: { services, vehicleTypes, drivers, vehicles }, club: { clubs, upcomingEvents, ticketTypes: tickets },
        shared: { cities, amenities, media },
      },
      inactive: { hotels: inactive[0], trips: inactive[1], services: inactive[2], clubs: inactive[3] },
      recentChanges: recent,
    };
    if (s.role === 'SUPER_ADMIN' && !s.supplierId) {
      const [suppliers, by] = await Promise.all([
        tx.supplier.findMany({ where: { deletedAt: null, isPlatform: false }, orderBy: { code: 'asc' }, select: { id: true, code: true, name: true, status: true } }),
        Promise.all([tx.hotel.groupBy({ by: ['supplierId'], where: { deletedAt: null }, _count: true }), tx.trip.groupBy({ by: ['supplierId'], where: { deletedAt: null }, _count: true }),
          tx.transportService.groupBy({ by: ['supplierId'], where: { deletedAt: null }, _count: true }), tx.club.groupBy({ by: ['supplierId'], where: { deletedAt: null }, _count: true }),
          tx.user.groupBy({ by: ['supplierId'], where: { deletedAt: null, supplierId: { not: null } }, _count: true })]),
      ]);
      const n = (g: { supplierId: string | null; _count: number }[], id: string) => g.find((x) => x.supplierId === id)?._count ?? 0;
      out.suppliers = suppliers.map((x) => ({ ...x, hotels: n(by[0], x.id), trips: n(by[1], x.id), services: n(by[2], x.id), clubs: n(by[3], x.id), users: n(by[4], x.id) }));
      out.supplierTotals = { total: suppliers.length, active: suppliers.filter((x) => x.status === 'ACTIVE').length };
    }
    return out;
  });
  ok(res, data);
});
