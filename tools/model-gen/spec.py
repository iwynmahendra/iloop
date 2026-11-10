import re, hashlib, json
ENUMS = {
 'RecordStatus':['ACTIVE','INACTIVE'], 'SupplierStatus':['ACTIVE','INACTIVE','SUSPENDED'],
 'UserRole':['SUPER_ADMIN','SUPPLIER_ADMIN','SUPPLIER_STAFF'], 'UserStatus':['ACTIVE','DISABLED'],
 'AuditAction':['CREATE','UPDATE','DELETE','RESTORE','ACTIVATE','DEACTIVATE','LOGIN','LOGIN_FAILED','LOGOUT','PASSWORD_RESET','IMPORT','EXPORT'],
 'AmenityScope':['HOTEL','ROOM','CLUB','VEHICLE','TRIP'], 'CategoryType':['HOTEL','TRIP','TRANSPORT','CLUB'],
 'CityKind':['CITY','AREA'], 'ChargeType':['TAX','SERVICE_CHARGE'], 'ChargeAppliesTo':['ALL','HOTEL','TRIP','TRANSPORT','CLUB'],
 'MealPlan':['ROOM_ONLY','BREAKFAST','HALF_BOARD','FULL_BOARD','ALL_INCLUSIVE'], 'Difficulty':['EASY','MODERATE','CHALLENGING','EXTREME'],
 'VehicleKind':['CAR','VAN','BUS','BOAT','SCOOTER','OTHER'], 'TransportServiceType':['AIRPORT_TRANSFER','CHARTER','SHUTTLE','FERRY'],
 'VenueKind':['BEACH_CLUB','NIGHTCLUB','LOUNGE','OTHER'],
}
M = {}; ORDER = []
GROUPS = {'core':[], 'shared':[], 'hotel':[], 'trips':[], 'transport':[], 'club':[]}
def model(group, name, table, kind, fields, rel=(), uq=(), ix=(), chk=(), note=''):
    M[name] = dict(name=name, table=table, kind=kind, group=group, fields=fields, rel=list(rel), uq=[list(u) for u in uq], ix=[list(i) for i in ix], chk=list(chk), note=note)
    ORDER.append(name); GROUPS[group].append(name)
def R(f, to, comp=True, od='Restrict', name=None, back=None, ref='id'):
    return dict(f=f, to=to, comp=comp, od=od, name=name, back=back, ref=ref)
def snake(n): return re.sub(r'([a-z0-9])([A-Z])', r'\1_\2', n).lower()
def lower_first(s): return s[0].lower()+s[1:]
def plural(s): return s[:-1]+'ies' if s.endswith('y') else s+'s'
TIMEOK = "~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'"
LATLNG = '(latitude IS NULL OR latitude BETWEEN -90 AND 90) AND (longitude IS NULL OR longitude BETWEEN -180 AND 180)'
CUR = lambda: R('currencyCode','Currency',comp=False,ref='code')
CTRY = lambda: R('countryCode','Country',comp=False,ref='code')
CITY = lambda: R('cityId','City',comp=False)
IMG = lambda g,parent,pt,tbl,pk: model(g,pt,tbl,'tenant',[pk+' u','mediaId u','sortOrder i=0','caption s(255)?','isCover b=false'],
 rel=[R(pk,parent,od='Cascade'),R('mediaId','MediaAsset')], uq=[[pk,'mediaId']], ix=[[pk,'sortOrder']])

model('core','Supplier','suppliers','raw',[
 'id u','code s(20)','name s(200)','legalName s(200)?','email s(254)','phone s(40)?','address s?','countryCode ch(2)?','taxId s(60)?',
 'commissionPct d(5,2)=0','status e:SupplierStatus=ACTIVE','logoUrl s?','isPlatform b=false',
 'createdBy u?','updatedBy u?','createdAt dt=now','updatedAt dt=now','deletedAt dt?'],
 rel=[R('countryCode','Country',comp=False,ref='code')], uq=[['code']], ix=[['status']],
 chk=[('commission_range','commission_pct BETWEEN 0 AND 100'),('platform_code',"NOT is_platform OR code = 'SUP-0000'")],
 note='Tenant root. SUP-0000 is the platform pseudo-supplier that owns shared master data.')
model('core','User','users','raw',[
 'id u','supplierId u?','email s(254)','passwordHash s','name s(120)','role e:UserRole','status e:UserStatus=ACTIVE',
 'failedLoginCount i=0','lockedUntil dt?','lastLoginAt dt?','passwordChangedAt dt?','mustChangePassword b=false',
 'createdBy u?','updatedBy u?','createdAt dt=now','updatedAt dt=now','deletedAt dt?'],
 rel=[R('supplierId','Supplier',comp=False,back='users')], uq=[['email']], ix=[['supplierId','status']],
 chk=[('role_supplier',"(role = 'SUPER_ADMIN') = (supplier_id IS NULL)"),('email_lower','email = lower(email)')])
model('core','RefreshToken','refresh_tokens','raw',['id u','userId u','familyId u','tokenHash s(64)','expiresAt dt','revokedAt dt?','replacedById u?','userAgent s?','ip s(45)?','createdAt dt=now'],
 rel=[R('userId','User',comp=False,od='Cascade')], uq=[['tokenHash']], ix=[['familyId']])
model('core','PasswordResetToken','password_reset_tokens','raw',['id u','userId u','tokenHash s(64)','expiresAt dt','usedAt dt?','createdAt dt=now'],
 rel=[R('userId','User',comp=False,od='Cascade')], uq=[['tokenHash']])
model('core','LoginAttempt','login_attempts','raw',['id u','email s(254)','userId u?','ip s(45)?','success b','reason s(60)?','createdAt dt=now'], ix=[['email','createdAt'],['ip','createdAt']])
model('core','AuditLog','audit_logs','raw',['id u','supplierId u?','userId u?','userEmail s(254)?','action e:AuditAction','entityType s(60)','entityId u?','before j?','after j?','ip s(45)?','userAgent s?','requestId s(64)?','createdAt dt=now'],
 ix=[['supplierId','createdAt'],['entityType','entityId'],['userId','createdAt']], note='Append-only. A trigger blocks UPDATE and DELETE. No FKs so history survives purges.')

model('shared','Country','countries','global',['code ch(2)','iso3 ch(3)?','name s(120)','phoneCode s(8)?'], uq=[['code']], note='Global ISO reference data (no supplier_id).')
model('shared','Currency','currencies','global',['code ch(3)','name s(80)','symbol s(8)','decimals i=2'], uq=[['code']], note='Global ISO 4217 reference data (no supplier_id).')
model('shared','City','cities','tenant',['code s(60)','name s(150)','kind e:CityKind=CITY','countryCode ch(2)','parentId u?','latitude d(9,6)?','longitude d(9,6)?','timezone s(60)?'],
 rel=[CTRY(),R('parentId','City',name='City_parent',back='children')], uq=[['supplierId','code']], ix=[['supplierId','countryCode']], chk=[('lat_lng',LATLNG)])
model('shared','Amenity','amenities','tenant',['code s(60)','name s(120)','scope e:AmenityScope','icon s(60)?','sortOrder i=0'], uq=[['supplierId','code']], ix=[['supplierId','scope']])
model('shared','Category','categories','tenant',['code s(60)','name s(120)','type e:CategoryType','parentId u?','description s?','sortOrder i=0'],
 rel=[R('parentId','Category',name='Category_parent',back='children')], uq=[['supplierId','code']], ix=[['supplierId','type']])
model('shared','TaxCharge','tax_charges','tenant',['code s(40)','name s(120)','type e:ChargeType','ratePct d(5,2)','isInclusive b=false','appliesTo e:ChargeAppliesTo=ALL'], uq=[['supplierId','code']], chk=[('rate_range','rate_pct BETWEEN 0 AND 100')])
model('shared','CancellationPolicy','cancellation_policies','tenant',['code s(40)','name s(150)','description s?'], uq=[['supplierId','code']])
model('shared','CancellationPolicyRule','cancellation_policy_rules','tenant',['policyId u','hoursBeforeStart i','refundPercent d(5,2)','sortOrder i=0'],
 rel=[R('policyId','CancellationPolicy',od='Cascade',back='rules')], uq=[['supplierId','policyId','hoursBeforeStart']], chk=[('rule_values','hours_before_start >= 0 AND refund_percent BETWEEN 0 AND 100')])
model('shared','MediaAsset','media_assets','tenant',['storageKey s(300)','url s','originalName s(255)','mimeType s(100)','sizeBytes bi','width i?','height i?','altText s(255)?','folder s(120)?','checksum s(64)?'],
 uq=[['supplierId','storageKey']], ix=[['supplierId','folder']], chk=[('size_positive','size_bytes > 0')])

model('hotel','Hotel','hotels','tenant',['code s(40)','name s(200)','starRating i?','description s?','address s?','postalCode s(20)?','cityId u?','countryCode ch(2)','latitude d(9,6)?','longitude d(9,6)?',
 "checkInTime t='14:00'","checkOutTime t='12:00'",'contactName s(120)?','contactEmail s(254)?','contactPhone s(40)?','website s?','policies j={}','currencyCode ch(3)'],
 rel=[CITY(),CTRY(),CUR()], uq=[['supplierId','code']],
 chk=[('star_range','star_rating IS NULL OR star_rating BETWEEN 1 AND 5'),('times',"check_in_time %s AND check_out_time %s"%(TIMEOK,TIMEOK)),('lat_lng',LATLNG)])
model('hotel','HotelAmenity','hotel_amenities','tenant',['hotelId u','amenityId u'], rel=[R('hotelId','Hotel',od='Cascade'),R('amenityId','Amenity',comp=False)], uq=[['hotelId','amenityId']], note='Join row. Replaced (hard delete) on edit.')
IMG('hotel','Hotel','HotelImage','hotel_images','hotelId')
model('hotel','RoomType','room_types','tenant',['hotelId u','code s(40)','name s(150)','bedType s(60)?','maxAdults i=2','maxChildren i=0','sizeM2 d(6,2)?','description s?','basePrice d(12,2)','currencyCode ch(3)'],
 rel=[R('hotelId','Hotel',od='Cascade'),CUR()], uq=[['supplierId','hotelId','code']], chk=[('capacity','max_adults >= 1 AND max_children >= 0'),('price_positive','base_price >= 0')])
model('hotel','RoomTypeAmenity','room_type_amenities','tenant',['roomTypeId u','amenityId u'], rel=[R('roomTypeId','RoomType',od='Cascade'),R('amenityId','Amenity',comp=False)], uq=[['roomTypeId','amenityId']])
IMG('hotel','RoomType','RoomTypeImage','room_type_images','roomTypeId')
model('hotel','RatePlan','rate_plans','tenant',['roomTypeId u','code s(40)','name s(150)','dateFrom dd','dateTo dd','price d(12,2)','currencyCode ch(3)','mealPlan e:MealPlan=ROOM_ONLY','cancellationPolicyId u?','minStay i=1'],
 rel=[R('roomTypeId','RoomType',od='Cascade'),CUR(),R('cancellationPolicyId','CancellationPolicy')], uq=[['supplierId','roomTypeId','code']], ix=[['roomTypeId','dateFrom','dateTo']],
 chk=[('dates','date_to >= date_from'),('price_positive','price >= 0 AND min_stay >= 1')])
model('hotel','RoomInventory','room_inventory','tenant',['roomTypeId u','date dd','totalUnits i','availableUnits i','stopSell b=false'],
 rel=[R('roomTypeId','RoomType',od='Cascade',back='inventory')], uq=[['supplierId','roomTypeId','date']], chk=[('units','total_units >= 0 AND available_units >= 0 AND available_units <= total_units')])

model('trips','Trip','trips','tenant',['code s(40)','title s(200)','categoryId u?','description s?','durationMinutes i','meetingPoint s(255)?','meetingLatitude d(9,6)?','meetingLongitude d(9,6)?','location s(255)?','cityId u?','countryCode ch(2)','difficulty e:Difficulty=EASY','minParticipants i=1','maxParticipants i?','inclusions a=[]','exclusions a=[]','cancellationPolicyId u?'],
 rel=[R('categoryId','Category',comp=False),CITY(),CTRY(),R('cancellationPolicyId','CancellationPolicy')], uq=[['supplierId','code']], ix=[['supplierId','categoryId']],
 chk=[('participants','min_participants >= 1 AND (max_participants IS NULL OR max_participants >= min_participants)'),('duration','duration_minutes > 0')])
IMG('trips','Trip','TripImage','trip_images','tripId')
model('trips','TripItineraryDay','trip_itinerary_days','tenant',['tripId u','dayNumber i','title s(200)','description s?','items j=[]'],
 rel=[R('tripId','Trip',od='Cascade',back='itinerary')], uq=[['supplierId','tripId','dayNumber']], chk=[('day_positive','day_number >= 1')], note='items = [{"time":"09:00","title":"...","description":"..."}]')
model('trips','TripVariant','trip_variants','tenant',['tripId u','code s(40)','name s(150)','description s?','adultPrice d(12,2)','childPrice d(12,2)?','currencyCode ch(3)','minPax i=1','maxPax i?'],
 rel=[R('tripId','Trip',od='Cascade',back='variants'),CUR()], uq=[['supplierId','tripId','code']],
 chk=[('prices','adult_price >= 0 AND (child_price IS NULL OR child_price >= 0)'),('pax','min_pax >= 1 AND (max_pax IS NULL OR max_pax >= min_pax)')])
model('trips','TripSchedule','trip_schedules','tenant',['tripId u','date dd','startTime t','endTime t?','quota i','remainingQuota i','cutoffHours i=0'],
 rel=[R('tripId','Trip',od='Cascade',back='schedules')], uq=[['supplierId','tripId','date','startTime']], ix=[['supplierId','date']],
 chk=[('quota','quota >= 0 AND remaining_quota >= 0 AND remaining_quota <= quota'),('times',"start_time %s AND (end_time IS NULL OR end_time %s)"%(TIMEOK,TIMEOK))])
model('trips','TripAddon','trip_addons','tenant',['tripId u','code s(40)','name s(150)','price d(12,2)','currencyCode ch(3)','perPerson b=true','maxQuantity i?'],
 rel=[R('tripId','Trip',od='Cascade',back='addons'),CUR()], uq=[['supplierId','tripId','code']], chk=[('price_positive','price >= 0')])

model('transport','VehicleType','vehicle_types','tenant',['code s(40)','name s(120)','kind e:VehicleKind','passengerCapacity i','luggageCapacity i=0','description s?'], uq=[['supplierId','code']], chk=[('capacity','passenger_capacity >= 1 AND luggage_capacity >= 0')])
model('transport','VehicleTypeAmenity','vehicle_type_amenities','tenant',['vehicleTypeId u','amenityId u'], rel=[R('vehicleTypeId','VehicleType',od='Cascade'),R('amenityId','Amenity',comp=False)], uq=[['vehicleTypeId','amenityId']], note='Vehicle features.')
IMG('transport','VehicleType','VehicleTypeImage','vehicle_type_images','vehicleTypeId')
model('transport','TransportZone','transport_zones','tenant',['code s(40)','name s(150)','cityId u?','countryCode ch(2)','description s?','latitude d(9,6)?','longitude d(9,6)?'], rel=[CITY(),CTRY()], uq=[['supplierId','code']])
model('transport','TransportService','transport_services','tenant',['code s(40)','name s(200)','serviceType e:TransportServiceType','originZoneId u?','destinationZoneId u?','originLabel s(200)?','destinationLabel s(200)?','vehicleTypeId u','price d(12,2)','currencyCode ch(3)','durationMinutes i?','driverIncluded b=true','description s?','cancellationPolicyId u?'],
 rel=[R('originZoneId','TransportZone',name='TransportService_origin',back='originServices'),R('destinationZoneId','TransportZone',name='TransportService_destination',back='destinationServices'),R('vehicleTypeId','VehicleType'),CUR(),R('cancellationPolicyId','CancellationPolicy')],
 uq=[['supplierId','code']], ix=[['supplierId','serviceType']], chk=[('price_positive','price >= 0')])
model('transport','ZoneRoutePrice','zone_route_prices','tenant',['fromZoneId u','toZoneId u','vehicleTypeId u','price d(12,2)','currencyCode ch(3)','durationMinutes i?'],
 rel=[R('fromZoneId','TransportZone',od='Cascade',name='ZoneRoutePrice_from',back='routesFrom'),R('toZoneId','TransportZone',od='Cascade',name='ZoneRoutePrice_to',back='routesTo'),R('vehicleTypeId','VehicleType'),CUR()],
 uq=[['supplierId','fromZoneId','toZoneId','vehicleTypeId']], chk=[('different_zones','from_zone_id <> to_zone_id'),('price_positive','price >= 0')])
model('transport','Driver','drivers','tenant',['code s(40)','name s(150)','phone s(40)','email s(254)?','licenseNumber s(60)','licenseExpiry dd?'], uq=[['supplierId','code']])
model('transport','Vehicle','vehicles','tenant',['vehicleTypeId u','plateNumber s(20)','make s(60)?','model s(60)?','year i?','color s(40)?','driverId u?','insuranceExpiry dd?'],
 rel=[R('vehicleTypeId','VehicleType'),R('driverId','Driver')], uq=[['supplierId','plateNumber']])

model('club','Club','clubs','tenant',['code s(40)','name s(200)','venueKind e:VenueKind=NIGHTCLUB','categoryId u?','description s?','address s?','cityId u?','countryCode ch(2)','latitude d(9,6)?','longitude d(9,6)?','phone s(40)?','email s(254)?','dressCode s(255)?','minimumAge i=18'],
 rel=[R('categoryId','Category',comp=False),CITY(),CTRY()], uq=[['supplierId','code']], chk=[('age','minimum_age >= 0'),('lat_lng',LATLNG)])
model('club','ClubOpeningHour','club_opening_hours','tenant',['clubId u','weekday i','opensAt t?','closesAt t?','isClosed b=false'],
 rel=[R('clubId','Club',od='Cascade',back='openingHours')], uq=[['supplierId','clubId','weekday']],
 chk=[('weekday_range','weekday BETWEEN 0 AND 6'),('times',"(opens_at IS NULL OR opens_at %s) AND (closes_at IS NULL OR closes_at %s)"%(TIMEOK,TIMEOK))],
 note='weekday: 0 = Sunday ... 6 = Saturday. A closing time earlier than the opening time means it closes after midnight.')
model('club','ClubAmenity','club_amenities','tenant',['clubId u','amenityId u'], rel=[R('clubId','Club',od='Cascade'),R('amenityId','Amenity',comp=False)], uq=[['clubId','amenityId']])
IMG('club','Club','ClubImage','club_images','clubId')
model('club','ClubTicketType','club_ticket_types','tenant',['clubId u','code s(40)','name s(150)','description s?','price d(12,2)','currencyCode ch(3)','inclusions a=[]','quota i?'],
 rel=[R('clubId','Club',od='Cascade',back='ticketTypes'),CUR()], uq=[['supplierId','clubId','code']], chk=[('price_positive','price >= 0')])
model('club','ClubTablePackage','club_table_packages','tenant',['clubId u','code s(40)','name s(150)','capacity i','minimumSpend d(12,2)','price d(12,2)','currencyCode ch(3)','inclusions a=[]','quota i?'],
 rel=[R('clubId','Club',od='Cascade',back='tablePackages'),CUR()], uq=[['supplierId','clubId','code']], chk=[('values','capacity >= 1 AND minimum_spend >= 0 AND price >= 0')])
model('club','ClubEvent','club_events','tenant',['clubId u','code s(40)','title s(200)','eventDate dd','startTime t?','endTime t?','lineup a=[]','description s?','specialPrice d(12,2)?','currencyCode ch(3)?','quota i?'],
 rel=[R('clubId','Club',od='Cascade',back='events'),CUR()], uq=[['supplierId','clubId','code']], ix=[['supplierId','clubId','eventDate']],
 chk=[('price','special_price IS NULL OR (special_price >= 0 AND currency_code IS NOT NULL)')])
