-- Guest concierge bookings: a new source, a room-charge payment method and the guest's room number.
ALTER TYPE "BookingSource" ADD VALUE IF NOT EXISTS 'CONCIERGE';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'ROOM_CHARGE';
ALTER TABLE "bookings" ADD COLUMN "room_number" VARCHAR(20);
