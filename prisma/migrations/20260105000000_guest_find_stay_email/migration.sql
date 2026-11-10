-- Booking numbers are unique per supplier only, so two hotels can hold the same number. Sign-in now returns up to two matches,
-- so the API can refuse an ambiguous sign-in, and takes an optional email to tell them apart.
DROP FUNCTION IF EXISTS guest_find_stay(text, text);
CREATE FUNCTION guest_find_stay(p_booking_no text, p_last_name text, p_email text DEFAULT NULL)
RETURNS TABLE (booking_id uuid, supplier_id uuid, guest_name text, room_number text, hotel_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id, b.supplier_id, b.guest_name::text, COALESCE(i.room_number, b.room_number)::text, i.hotel_id
  FROM bookings b JOIN hotel_booking_items i ON i.booking_id = b.id AND i.supplier_id = b.supplier_id
  WHERE b.product = 'HOTEL' AND b.deleted_at IS NULL AND b.status = 'CONFIRMED'
    AND upper(b.booking_no) = upper(trim(p_booking_no)) AND length(trim(p_last_name)) >= 2
    AND position(lower(trim(p_last_name)) in lower(b.guest_name)) > 0
    AND (p_email IS NULL OR lower(b.guest_email) = lower(trim(p_email)))
    AND i.check_out >= CURRENT_DATE AND i.check_in <= CURRENT_DATE + 1
  ORDER BY i.check_in LIMIT 2
$$;
REVOKE ALL ON FUNCTION guest_find_stay(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION guest_find_stay(text, text, text) TO app_runtime;
