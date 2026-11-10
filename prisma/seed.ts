/**
 * Seed: 1 SUPER_ADMIN, a platform pseudo-supplier (SUP-0000, owns shared master data),
 * and 2 demo suppliers (SUP-0001, SUP-0002), each with a hotel, trip, transport and club.
 * Safe to re-run: it stops if the super admin already exists (use `prisma migrate reset` to start over).
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }) });
const PASSWORD = process.env.SEED_PASSWORD ?? 'ChangeMe!2026';
const SUPER_EMAIL = (process.env.SEED_SUPER_ADMIN_EMAIL ?? 'superadmin@example.com').toLowerCase();
const day = (n: number) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + n); return d; };

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 12);
  await prisma.$transaction(async (tx) => {
    // The seed acts as SUPER_ADMIN so row level security lets it write everywhere.
    await tx.$executeRaw`SELECT set_config('app.role', 'SUPER_ADMIN', true), set_config('app.supplier_id', '', true)`;
    if (await tx.user.findUnique({ where: { email: SUPER_EMAIL } })) { console.log('Already seeded, nothing to do.'); return; }

    const superAdmin = await tx.user.create({ data: { email: SUPER_EMAIL, name: 'Super Admin', role: 'SUPER_ADMIN', passwordHash: hash, mustChangePassword: true } });
    const by = superAdmin.id;

    await tx.country.createMany({ data: [['ID','IDN','Indonesia','+62'],['US','USA','United States','+1'],['GB','GBR','United Kingdom','+44'],['AU','AUS','Australia','+61'],['SG','SGP','Singapore','+65'],['JP','JPN','Japan','+81'],['DE','DEU','Germany','+49'],['FR','FRA','France','+33'],['NL','NLD','Netherlands','+31'],['TH','THA','Thailand','+66']].map(([code, iso3, name, phoneCode]) => ({ code, iso3, name, phoneCode, createdBy: by })) });
    await tx.currency.createMany({ data: [['IDR','Indonesian Rupiah','Rp',0],['USD','US Dollar','$',2],['EUR','Euro','€',2],['GBP','Pound Sterling','£',2],['AUD','Australian Dollar','A$',2],['SGD','Singapore Dollar','S$',2],['JPY','Japanese Yen','¥',0]].map(([code, name, symbol, decimals]) => ({ code: code as string, name: name as string, symbol: symbol as string, decimals: decimals as number, createdBy: by })) });

    // Platform pseudo-supplier: owns shared reference data readable by every supplier.
    const platform = await tx.supplier.create({ data: { code: 'SUP-0000', name: 'Platform', email: 'platform@example.com', isPlatform: true, countryCode: 'ID', createdBy: by } });
    const P = { supplierId: platform.id, createdBy: by };
    const cities: Record<string, string> = {};
    for (const [code, name, lat, lng] of [['denpasar','Denpasar',-8.6705,115.2126],['ubud','Ubud',-8.5069,115.2625],['seminyak','Seminyak',-8.6913,115.1683],['uluwatu','Uluwatu',-8.8291,115.0849],['nusa-dua','Nusa Dua',-8.8008,115.2330],['kuta','Kuta',-8.7184,115.1686]] as const)
      cities[code] = (await tx.city.create({ data: { ...P, code, name, kind: 'CITY', countryCode: 'ID', latitude: lat, longitude: lng, timezone: 'Asia/Makassar' } })).id;
    const amen: Record<string, string> = {};
    for (const [code, name, scope] of [['wifi','Free Wi-Fi','HOTEL'],['pool','Swimming pool','HOTEL'],['spa','Spa','HOTEL'],['gym','Fitness centre','HOTEL'],['restaurant','Restaurant','HOTEL'],['parking','Free parking','HOTEL'],['kids-club','Kids club','HOTEL'],
      ['ac','Air conditioning','ROOM'],['balcony','Balcony','ROOM'],['private-pool','Private pool','ROOM'],['minibar','Minibar','ROOM'],['aircon-v','Air conditioning','VEHICLE'],['usb','USB charging','VEHICLE'],['water','Bottled water','VEHICLE'],
      ['vip-area','VIP area','CLUB'],['dj','Live DJ','CLUB'],['beach','Beachfront','CLUB']] as const)
      amen[code] = (await tx.amenity.create({ data: { ...P, code, name, scope } })).id;
    const cat: Record<string, string> = {};
    for (const [code, name, type] of [['resort','Resort','HOTEL'],['villa','Villa','HOTEL'],['culture','Culture','TRIP'],['adventure','Adventure','TRIP'],['transfers','Transfers','TRANSPORT'],['beach-club','Beach club','CLUB'],['nightlife','Nightlife','CLUB']] as const)
      cat[code] = (await tx.category.create({ data: { ...P, code, name, type } })).id;

    const demo = [
      { name: 'Ubud Heritage Co.', legal: 'PT Ubud Heritage Wisata', email: 'hello@ubud-heritage.example', phone: '+62 361 000 111', taxId: '01.234.567.8-901.000', commission: 12.5, city: 'ubud', slug: 'ubud',
        hotel: 'Ubud Rice Terrace Villa', stars: 5, trip: 'Ubud culture day tour', club: 'Terrace Lounge Ubud', veh: 'Toyota Hiace' },
      { name: 'Seminyak Coast Group', legal: 'PT Seminyak Pesisir Mandiri', email: 'hello@seminyak-coast.example', phone: '+62 361 000 222', taxId: '02.345.678.9-012.000', commission: 10, city: 'seminyak', slug: 'semi',
        hotel: 'Seminyak Beachfront Suites', stars: 4, trip: 'Nusa Penida day trip', club: 'Sunset Beach Club', veh: 'Mercedes V-Class' },
    ];
    for (const d of demo) {
      const sup = await tx.supplier.create({ data: { name: d.name, legalName: d.legal, email: d.email, phone: d.phone, taxId: d.taxId, commissionPct: d.commission, countryCode: 'ID', address: 'Bali, Indonesia', createdBy: by } });
      const S = { supplierId: sup.id, createdBy: by };
      await tx.user.createMany({ data: [
        { supplierId: sup.id, email: `admin@${d.slug}.example`, name: `${d.name} Admin`, role: 'SUPPLIER_ADMIN', passwordHash: hash, mustChangePassword: true },
        { supplierId: sup.id, email: `staff@${d.slug}.example`, name: `${d.name} Staff`, role: 'SUPPLIER_STAFF', passwordHash: hash, mustChangePassword: true }] });

      const tax = await tx.taxCharge.createMany({ data: [{ ...S, code: 'VAT', name: 'VAT 11%', type: 'TAX', ratePct: 11, appliesTo: 'ALL' }, { ...S, code: 'SVC', name: 'Service charge 10%', type: 'SERVICE_CHARGE', ratePct: 10, appliesTo: 'HOTEL' }] });
      const flex = await tx.cancellationPolicy.create({ data: { ...S, code: 'FLEX', name: 'Flexible', description: 'Free cancellation up to 48 hours before.' } });
      await tx.cancellationPolicyRule.createMany({ data: [{ ...S, policyId: flex.id, hoursBeforeStart: 48, refundPercent: 100, sortOrder: 1 }, { ...S, policyId: flex.id, hoursBeforeStart: 24, refundPercent: 50, sortOrder: 2 }, { ...S, policyId: flex.id, hoursBeforeStart: 0, refundPercent: 0, sortOrder: 3 }] });

      // Hotel
      const hotel = await tx.hotel.create({ data: { ...S, code: 'H-001', name: d.hotel, starRating: d.stars, description: `${d.hotel} is a demo property used for development.`, address: 'Jl. Contoh No. 1', cityId: cities[d.city], countryCode: 'ID', latitude: -8.5, longitude: 115.26, contactName: 'Front Desk', contactEmail: d.email, contactPhone: d.phone, currencyCode: 'IDR', policies: { children: 'Children of all ages welcome.', pets: 'Pets are not allowed.', cancellation: 'See rate plan.' } } });
      await tx.hotelAmenity.createMany({ data: ['wifi','pool','spa','restaurant','parking'].map((a) => ({ ...S, hotelId: hotel.id, amenityId: amen[a] })) });
      for (const [code, name, bed, adults, kids, size, price, extra] of [['DLX','Deluxe Room','1 king bed',2,1,38,1850000,['ac','balcony']],['VIL','Pool Villa','1 king bed',2,2,85,3100000,['ac','private-pool','minibar']]] as const) {
        const rt = await tx.roomType.create({ data: { ...S, hotelId: hotel.id, code, name, bedType: bed, maxAdults: adults, maxChildren: kids, sizeM2: size, basePrice: price, currencyCode: 'IDR' } });
        await tx.roomTypeAmenity.createMany({ data: extra.map((a) => ({ ...S, roomTypeId: rt.id, amenityId: amen[a] })) });
        await tx.ratePlan.createMany({ data: [
          { ...S, roomTypeId: rt.id, code: 'LOW', name: 'Low season', dateFrom: day(0), dateTo: day(89), price, currencyCode: 'IDR', mealPlan: 'BREAKFAST', cancellationPolicyId: flex.id },
          { ...S, roomTypeId: rt.id, code: 'HIGH', name: 'High season', dateFrom: day(90), dateTo: day(180), price: Math.round(price * 1.3), currencyCode: 'IDR', mealPlan: 'BREAKFAST', cancellationPolicyId: flex.id, minStay: 2 }] });
        await tx.roomInventory.createMany({ data: Array.from({ length: 30 }, (_, i) => ({ ...S, roomTypeId: rt.id, date: day(i), totalUnits: 8, availableUnits: 8 - (i % 4) })) });
      }

      // Trip
      const trip = await tx.trip.create({ data: { ...S, code: 'T-001', title: d.trip, categoryId: cat.culture, description: 'Full-day guided tour with lunch and hotel pickup.', durationMinutes: 540, meetingPoint: 'Hotel lobby', location: 'Bali', cityId: cities[d.city], countryCode: 'ID', difficulty: 'EASY', minParticipants: 2, maxParticipants: 12, inclusions: ['Hotel pickup','Guide','Lunch','Entrance fees'], exclusions: ['Tips','Personal expenses'], cancellationPolicyId: flex.id } });
      await tx.tripItineraryDay.create({ data: { ...S, tripId: trip.id, dayNumber: 1, title: 'Full day', items: [{ time: '08:00', title: 'Hotel pickup' }, { time: '10:00', title: 'First stop' }, { time: '13:00', title: 'Lunch' }, { time: '17:00', title: 'Return to hotel' }] } });
      await tx.tripVariant.createMany({ data: [{ ...S, tripId: trip.id, code: 'SHARED', name: 'Shared tour', adultPrice: 750000, childPrice: 450000, currencyCode: 'IDR', minPax: 1 }, { ...S, tripId: trip.id, code: 'PRIVATE', name: 'Private tour', adultPrice: 1400000, childPrice: 900000, currencyCode: 'IDR', minPax: 2 }] });
      await tx.tripSchedule.createMany({ data: Array.from({ length: 14 }, (_, i) => ({ ...S, tripId: trip.id, date: day(i + 1), startTime: '08:00', endTime: '17:00', quota: 12, remainingQuota: 12 - (i % 5), cutoffHours: 12 })) });
      await tx.tripAddon.createMany({ data: [{ ...S, tripId: trip.id, code: 'PHOTO', name: 'Photo package', price: 150000, currencyCode: 'IDR', perPerson: false }, { ...S, tripId: trip.id, code: 'LUNCH-UP', name: 'Premium lunch', price: 120000, currencyCode: 'IDR', perPerson: true, maxQuantity: 12 }] });

      // Transport
      const vt = await tx.vehicleType.create({ data: { ...S, code: 'VAN', name: d.veh, kind: 'VAN', passengerCapacity: 7, luggageCapacity: 5 } });
      await tx.vehicleTypeAmenity.createMany({ data: ['aircon-v','usb','water'].map((a) => ({ ...S, vehicleTypeId: vt.id, amenityId: amen[a] })) });
      const zAirport = await tx.transportZone.create({ data: { ...S, code: 'AIRPORT', name: 'Ngurah Rai Airport', cityId: cities.kuta, countryCode: 'ID' } });
      const zTown = await tx.transportZone.create({ data: { ...S, code: d.slug.toUpperCase(), name: d.city === 'ubud' ? 'Ubud' : 'Seminyak', cityId: cities[d.city], countryCode: 'ID' } });
      await tx.transportService.create({ data: { ...S, code: 'AIRPORT-TRANSFER', name: 'Airport transfer', serviceType: 'AIRPORT_TRANSFER', originZoneId: zAirport.id, destinationZoneId: zTown.id, vehicleTypeId: vt.id, price: 350000, currencyCode: 'IDR', durationMinutes: 60, driverIncluded: true, cancellationPolicyId: flex.id } });
      await tx.zoneRoutePrice.createMany({ data: [{ ...S, fromZoneId: zAirport.id, toZoneId: zTown.id, vehicleTypeId: vt.id, price: 350000, currencyCode: 'IDR', durationMinutes: 60 }, { ...S, fromZoneId: zTown.id, toZoneId: zAirport.id, vehicleTypeId: vt.id, price: 350000, currencyCode: 'IDR', durationMinutes: 60 }] });
      const drv = await tx.driver.create({ data: { ...S, code: 'D-001', name: 'Made Wirawan', phone: '+62 812 0000 0001', licenseNumber: 'SIM-B1-0001', licenseExpiry: day(500) } });
      await tx.vehicle.create({ data: { ...S, vehicleTypeId: vt.id, plateNumber: `DK ${1000 + d.slug.length} AB`, make: d.veh.split(' ')[0], model: d.veh.split(' ').slice(1).join(' '), year: 2023, color: 'White', driverId: drv.id, insuranceExpiry: day(300) } });

      // Club
      const club = await tx.club.create({ data: { ...S, code: 'C-001', name: d.club, venueKind: 'BEACH_CLUB', categoryId: cat['beach-club'], description: 'Beachfront club with sunset sessions and live DJs.', address: 'Beachfront, Bali', cityId: cities[d.city], countryCode: 'ID', latitude: -8.69, longitude: 115.16, phone: d.phone, email: d.email, dressCode: 'Beach smart', minimumAge: 18 } });
      await tx.clubAmenity.createMany({ data: ['vip-area','dj','beach'].map((a) => ({ ...S, clubId: club.id, amenityId: amen[a] })) });
      await tx.clubOpeningHour.createMany({ data: Array.from({ length: 7 }, (_, w) => ({ ...S, clubId: club.id, weekday: w, opensAt: w === 1 ? null : '16:00', closesAt: w === 1 ? null : (w === 5 || w === 6 ? '02:00' : '23:00'), isClosed: w === 1 })) });
      await tx.clubTicketType.createMany({ data: [{ ...S, clubId: club.id, code: 'GA', name: 'General entry', price: 150000, currencyCode: 'IDR', inclusions: ['Welcome drink'], quota: 300 }, { ...S, clubId: club.id, code: 'VIP', name: 'Sunset VIP', price: 450000, currencyCode: 'IDR', inclusions: ['Reserved lounger', 'Two drinks'], quota: 40 }] });
      await tx.clubTablePackage.createMany({ data: [{ ...S, clubId: club.id, code: 'T4', name: 'Table for 4', capacity: 4, minimumSpend: 1500000, price: 1800000, currencyCode: 'IDR', inclusions: ['Reserved table', 'Bottle service'], quota: 10 }] });
      await tx.clubEvent.createMany({ data: [{ ...S, clubId: club.id, code: 'EV-SUNSET', title: 'Sunset Sessions with live DJ', eventDate: day(2), startTime: '16:30', endTime: '22:00', lineup: ['Guest DJ', 'Resident DJ'], specialPrice: 200000, currencyCode: 'IDR', quota: 300 }, { ...S, clubId: club.id, code: 'EV-JAZZ', title: 'Balinese Jazz Night', eventDate: day(5), startTime: '19:00', endTime: '23:00', lineup: ['Jazz quartet'], quota: 200 }] });
    }
    console.log(`Seeded. Super admin: ${SUPER_EMAIL}. Demo logins: admin@ubud.example, staff@ubud.example, admin@semi.example, staff@semi.example. Password: ${PASSWORD} (change on first login).`);
  }, { timeout: 120000, maxWait: 20000 });
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
