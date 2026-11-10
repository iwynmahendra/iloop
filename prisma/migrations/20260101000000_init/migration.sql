-- Init: enums, sequence, tables, indexes, foreign keys, check constraints, triggers.
-- Generated together with prisma/schema.prisma.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

CREATE SEQUENCE supplier_code_seq START 1;

CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'SUPPLIER_ADMIN', 'SUPPLIER_STAFF');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'ACTIVATE', 'DEACTIVATE', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_RESET', 'IMPORT', 'EXPORT');
CREATE TYPE "AmenityScope" AS ENUM ('HOTEL', 'ROOM', 'CLUB', 'VEHICLE', 'TRIP');
CREATE TYPE "CategoryType" AS ENUM ('HOTEL', 'TRIP', 'TRANSPORT', 'CLUB');
CREATE TYPE "CityKind" AS ENUM ('CITY', 'AREA');
CREATE TYPE "ChargeType" AS ENUM ('TAX', 'SERVICE_CHARGE');
CREATE TYPE "ChargeAppliesTo" AS ENUM ('ALL', 'HOTEL', 'TRIP', 'TRANSPORT', 'CLUB');
CREATE TYPE "MealPlan" AS ENUM ('ROOM_ONLY', 'BREAKFAST', 'HALF_BOARD', 'FULL_BOARD', 'ALL_INCLUSIVE');
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MODERATE', 'CHALLENGING', 'EXTREME');
CREATE TYPE "VehicleKind" AS ENUM ('CAR', 'VAN', 'BUS', 'BOAT', 'SCOOTER', 'OTHER');
CREATE TYPE "TransportServiceType" AS ENUM ('AIRPORT_TRANSFER', 'CHARTER', 'SHUTTLE', 'FERRY');
CREATE TYPE "VenueKind" AS ENUM ('BEACH_CLUB', 'NIGHTCLUB', 'LOUNGE', 'OTHER');

-- CreateTable suppliers
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(20) NOT NULL DEFAULT ('SUP-' || lpad(nextval('supplier_code_seq')::text, 4, '0')),
    "name" VARCHAR(200) NOT NULL,
    "legal_name" VARCHAR(200),
    "email" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(40),
    "address" TEXT,
    "country_code" CHAR(2),
    "tax_id" VARCHAR(60),
    "commission_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
    "logo_url" TEXT,
    "is_platform" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable users
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "password_changed_at" TIMESTAMPTZ(6),
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable refresh_tokens
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "replaced_by_id" UUID,
    "user_agent" TEXT,
    "ip" VARCHAR(45),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable password_reset_tokens
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable login_attempts
CREATE TABLE "login_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(254) NOT NULL,
    "user_id" UUID,
    "ip" VARCHAR(45),
    "success" BOOLEAN NOT NULL,
    "reason" VARCHAR(60),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable audit_logs
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID,
    "user_id" UUID,
    "user_email" VARCHAR(254),
    "action" "AuditAction" NOT NULL,
    "entity_type" VARCHAR(60) NOT NULL,
    "entity_id" UUID,
    "before" JSONB,
    "after" JSONB,
    "ip" VARCHAR(45),
    "user_agent" TEXT,
    "request_id" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable countries
CREATE TABLE "countries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" CHAR(2) NOT NULL,
    "iso3" CHAR(3),
    "name" VARCHAR(120) NOT NULL,
    "phone_code" VARCHAR(8),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable currencies
CREATE TABLE "currencies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" CHAR(3) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "symbol" VARCHAR(8) NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 2,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable cities
CREATE TABLE "cities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "kind" "CityKind" NOT NULL DEFAULT 'CITY',
    "country_code" CHAR(2) NOT NULL,
    "parent_id" UUID,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "timezone" VARCHAR(60),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable amenities
CREATE TABLE "amenities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "scope" "AmenityScope" NOT NULL,
    "icon" VARCHAR(60),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable categories
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" "CategoryType" NOT NULL,
    "parent_id" UUID,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable tax_charges
CREATE TABLE "tax_charges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" "ChargeType" NOT NULL,
    "rate_pct" DECIMAL(5,2) NOT NULL,
    "is_inclusive" BOOLEAN NOT NULL DEFAULT false,
    "applies_to" "ChargeAppliesTo" NOT NULL DEFAULT 'ALL',
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "tax_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable cancellation_policies
CREATE TABLE "cancellation_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "cancellation_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable cancellation_policy_rules
CREATE TABLE "cancellation_policy_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "hours_before_start" INTEGER NOT NULL,
    "refund_percent" DECIMAL(5,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "cancellation_policy_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable media_assets
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "storage_key" VARCHAR(300) NOT NULL,
    "url" TEXT NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "alt_text" VARCHAR(255),
    "folder" VARCHAR(120),
    "checksum" VARCHAR(64),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable hotels
CREATE TABLE "hotels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "star_rating" INTEGER,
    "description" TEXT,
    "address" TEXT,
    "postal_code" VARCHAR(20),
    "city_id" UUID,
    "country_code" CHAR(2) NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "check_in_time" VARCHAR(5) NOT NULL DEFAULT '14:00',
    "check_out_time" VARCHAR(5) NOT NULL DEFAULT '12:00',
    "contact_name" VARCHAR(120),
    "contact_email" VARCHAR(254),
    "contact_phone" VARCHAR(40),
    "website" TEXT,
    "policies" JSONB NOT NULL DEFAULT '{}',
    "currency_code" CHAR(3) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "hotels_pkey" PRIMARY KEY ("id")
);

-- CreateTable hotel_amenities
CREATE TABLE "hotel_amenities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "amenity_id" UUID NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "hotel_amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable hotel_images
CREATE TABLE "hotel_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "caption" VARCHAR(255),
    "is_cover" BOOLEAN NOT NULL DEFAULT false,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "hotel_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable room_types
CREATE TABLE "room_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "bed_type" VARCHAR(60),
    "max_adults" INTEGER NOT NULL DEFAULT 2,
    "max_children" INTEGER NOT NULL DEFAULT 0,
    "size_m2" DECIMAL(6,2),
    "description" TEXT,
    "base_price" DECIMAL(12,2) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "room_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable room_type_amenities
CREATE TABLE "room_type_amenities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "room_type_id" UUID NOT NULL,
    "amenity_id" UUID NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "room_type_amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable room_type_images
CREATE TABLE "room_type_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "room_type_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "caption" VARCHAR(255),
    "is_cover" BOOLEAN NOT NULL DEFAULT false,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "room_type_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable rate_plans
CREATE TABLE "rate_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "room_type_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "date_from" DATE NOT NULL,
    "date_to" DATE NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "meal_plan" "MealPlan" NOT NULL DEFAULT 'ROOM_ONLY',
    "cancellation_policy_id" UUID,
    "min_stay" INTEGER NOT NULL DEFAULT 1,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "rate_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable room_inventory
CREATE TABLE "room_inventory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "room_type_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "total_units" INTEGER NOT NULL,
    "available_units" INTEGER NOT NULL,
    "stop_sell" BOOLEAN NOT NULL DEFAULT false,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "room_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable trips
CREATE TABLE "trips" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "category_id" UUID,
    "description" TEXT,
    "duration_minutes" INTEGER NOT NULL,
    "meeting_point" VARCHAR(255),
    "meeting_latitude" DECIMAL(9,6),
    "meeting_longitude" DECIMAL(9,6),
    "location" VARCHAR(255),
    "city_id" UUID,
    "country_code" CHAR(2) NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'EASY',
    "min_participants" INTEGER NOT NULL DEFAULT 1,
    "max_participants" INTEGER,
    "inclusions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "exclusions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "cancellation_policy_id" UUID,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable trip_images
CREATE TABLE "trip_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "caption" VARCHAR(255),
    "is_cover" BOOLEAN NOT NULL DEFAULT false,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "trip_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable trip_itinerary_days
CREATE TABLE "trip_itinerary_days" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "day_number" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "items" JSONB NOT NULL DEFAULT '[]',
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "trip_itinerary_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable trip_variants
CREATE TABLE "trip_variants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "adult_price" DECIMAL(12,2) NOT NULL,
    "child_price" DECIMAL(12,2),
    "currency_code" CHAR(3) NOT NULL,
    "min_pax" INTEGER NOT NULL DEFAULT 1,
    "max_pax" INTEGER,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "trip_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable trip_schedules
CREATE TABLE "trip_schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5),
    "quota" INTEGER NOT NULL,
    "remaining_quota" INTEGER NOT NULL,
    "cutoff_hours" INTEGER NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "trip_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable trip_addons
CREATE TABLE "trip_addons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "per_person" BOOLEAN NOT NULL DEFAULT true,
    "max_quantity" INTEGER,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "trip_addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable vehicle_types
CREATE TABLE "vehicle_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "kind" "VehicleKind" NOT NULL,
    "passenger_capacity" INTEGER NOT NULL,
    "luggage_capacity" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "vehicle_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable vehicle_type_amenities
CREATE TABLE "vehicle_type_amenities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "vehicle_type_id" UUID NOT NULL,
    "amenity_id" UUID NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "vehicle_type_amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable vehicle_type_images
CREATE TABLE "vehicle_type_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "vehicle_type_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "caption" VARCHAR(255),
    "is_cover" BOOLEAN NOT NULL DEFAULT false,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "vehicle_type_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable transport_zones
CREATE TABLE "transport_zones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "city_id" UUID,
    "country_code" CHAR(2) NOT NULL,
    "description" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "transport_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable transport_services
CREATE TABLE "transport_services" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "service_type" "TransportServiceType" NOT NULL,
    "origin_zone_id" UUID,
    "destination_zone_id" UUID,
    "origin_label" VARCHAR(200),
    "destination_label" VARCHAR(200),
    "vehicle_type_id" UUID NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "duration_minutes" INTEGER,
    "driver_included" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "cancellation_policy_id" UUID,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "transport_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable zone_route_prices
CREATE TABLE "zone_route_prices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "from_zone_id" UUID NOT NULL,
    "to_zone_id" UUID NOT NULL,
    "vehicle_type_id" UUID NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "duration_minutes" INTEGER,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "zone_route_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable drivers
CREATE TABLE "drivers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(40) NOT NULL,
    "email" VARCHAR(254),
    "license_number" VARCHAR(60) NOT NULL,
    "license_expiry" DATE,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable vehicles
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "vehicle_type_id" UUID NOT NULL,
    "plate_number" VARCHAR(20) NOT NULL,
    "make" VARCHAR(60),
    "model" VARCHAR(60),
    "year" INTEGER,
    "color" VARCHAR(40),
    "driver_id" UUID,
    "insurance_expiry" DATE,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable clubs
CREATE TABLE "clubs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "venue_kind" "VenueKind" NOT NULL DEFAULT 'NIGHTCLUB',
    "category_id" UUID,
    "description" TEXT,
    "address" TEXT,
    "city_id" UUID,
    "country_code" CHAR(2) NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "phone" VARCHAR(40),
    "email" VARCHAR(254),
    "dress_code" VARCHAR(255),
    "minimum_age" INTEGER NOT NULL DEFAULT 18,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "clubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable club_opening_hours
CREATE TABLE "club_opening_hours" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "opens_at" VARCHAR(5),
    "closes_at" VARCHAR(5),
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "club_opening_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable club_amenities
CREATE TABLE "club_amenities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "amenity_id" UUID NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "club_amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable club_images
CREATE TABLE "club_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "caption" VARCHAR(255),
    "is_cover" BOOLEAN NOT NULL DEFAULT false,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "club_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable club_ticket_types
CREATE TABLE "club_ticket_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "inclusions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "quota" INTEGER,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "club_ticket_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable club_table_packages
CREATE TABLE "club_table_packages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "minimum_spend" DECIMAL(12,2) NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "inclusions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "quota" INTEGER,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "club_table_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable club_events
CREATE TABLE "club_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "event_date" DATE NOT NULL,
    "start_time" VARCHAR(5),
    "end_time" VARCHAR(5),
    "lineup" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "special_price" DECIMAL(12,2),
    "currency_code" CHAR(3),
    "quota" INTEGER,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "club_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");
CREATE INDEX "suppliers_status_idx" ON "suppliers"("status");
CREATE INDEX "suppliers_country_code_idx" ON "suppliers"("country_code");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_supplier_id_status_idx" ON "users"("supplier_id", "status");
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");
CREATE INDEX "login_attempts_email_created_at_idx" ON "login_attempts"("email", "created_at");
CREATE INDEX "login_attempts_ip_created_at_idx" ON "login_attempts"("ip", "created_at");
CREATE INDEX "audit_logs_supplier_id_created_at_idx" ON "audit_logs"("supplier_id", "created_at");
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");
CREATE UNIQUE INDEX "countries_code_key" ON "countries"("code");
CREATE UNIQUE INDEX "currencies_code_key" ON "currencies"("code");
CREATE UNIQUE INDEX "cities_supplier_id_code_key" ON "cities"("supplier_id", "code");
CREATE UNIQUE INDEX "cities_supplier_id_id_key" ON "cities"("supplier_id", "id");
CREATE INDEX "cities_supplier_id_status_idx" ON "cities"("supplier_id", "status");
CREATE INDEX "cities_supplier_id_country_code_idx" ON "cities"("supplier_id", "country_code");
CREATE INDEX "cities_country_code_idx" ON "cities"("country_code");
CREATE INDEX "cities_supplier_id_parent_id_idx" ON "cities"("supplier_id", "parent_id");
CREATE UNIQUE INDEX "amenities_supplier_id_code_key" ON "amenities"("supplier_id", "code");
CREATE INDEX "amenities_supplier_id_status_idx" ON "amenities"("supplier_id", "status");
CREATE INDEX "amenities_supplier_id_scope_idx" ON "amenities"("supplier_id", "scope");
CREATE UNIQUE INDEX "categories_supplier_id_code_key" ON "categories"("supplier_id", "code");
CREATE UNIQUE INDEX "categories_supplier_id_id_key" ON "categories"("supplier_id", "id");
CREATE INDEX "categories_supplier_id_status_idx" ON "categories"("supplier_id", "status");
CREATE INDEX "categories_supplier_id_type_idx" ON "categories"("supplier_id", "type");
CREATE INDEX "categories_supplier_id_parent_id_idx" ON "categories"("supplier_id", "parent_id");
CREATE UNIQUE INDEX "tax_charges_supplier_id_code_key" ON "tax_charges"("supplier_id", "code");
CREATE INDEX "tax_charges_supplier_id_status_idx" ON "tax_charges"("supplier_id", "status");
CREATE UNIQUE INDEX "cancellation_policies_supplier_id_code_key" ON "cancellation_policies"("supplier_id", "code");
CREATE UNIQUE INDEX "cancellation_policies_supplier_id_id_key" ON "cancellation_policies"("supplier_id", "id");
CREATE INDEX "cancellation_policies_supplier_id_status_idx" ON "cancellation_policies"("supplier_id", "status");
CREATE UNIQUE INDEX "cancellation_policy_rules_supplier_id_policy_id_hours__126c3e23" ON "cancellation_policy_rules"("supplier_id", "policy_id", "hours_before_start");
CREATE INDEX "cancellation_policy_rules_supplier_id_status_idx" ON "cancellation_policy_rules"("supplier_id", "status");
CREATE UNIQUE INDEX "media_assets_supplier_id_storage_key_key" ON "media_assets"("supplier_id", "storage_key");
CREATE UNIQUE INDEX "media_assets_supplier_id_id_key" ON "media_assets"("supplier_id", "id");
CREATE INDEX "media_assets_supplier_id_status_idx" ON "media_assets"("supplier_id", "status");
CREATE INDEX "media_assets_supplier_id_folder_idx" ON "media_assets"("supplier_id", "folder");
CREATE UNIQUE INDEX "hotels_supplier_id_code_key" ON "hotels"("supplier_id", "code");
CREATE UNIQUE INDEX "hotels_supplier_id_id_key" ON "hotels"("supplier_id", "id");
CREATE INDEX "hotels_supplier_id_status_idx" ON "hotels"("supplier_id", "status");
CREATE INDEX "hotels_city_id_idx" ON "hotels"("city_id");
CREATE INDEX "hotels_country_code_idx" ON "hotels"("country_code");
CREATE INDEX "hotels_currency_code_idx" ON "hotels"("currency_code");
CREATE UNIQUE INDEX "hotel_amenities_hotel_id_amenity_id_key" ON "hotel_amenities"("hotel_id", "amenity_id");
CREATE INDEX "hotel_amenities_supplier_id_status_idx" ON "hotel_amenities"("supplier_id", "status");
CREATE INDEX "hotel_amenities_supplier_id_hotel_id_idx" ON "hotel_amenities"("supplier_id", "hotel_id");
CREATE INDEX "hotel_amenities_amenity_id_idx" ON "hotel_amenities"("amenity_id");
CREATE UNIQUE INDEX "hotel_images_hotel_id_media_id_key" ON "hotel_images"("hotel_id", "media_id");
CREATE INDEX "hotel_images_supplier_id_status_idx" ON "hotel_images"("supplier_id", "status");
CREATE INDEX "hotel_images_hotel_id_sort_order_idx" ON "hotel_images"("hotel_id", "sort_order");
CREATE INDEX "hotel_images_supplier_id_hotel_id_idx" ON "hotel_images"("supplier_id", "hotel_id");
CREATE INDEX "hotel_images_supplier_id_media_id_idx" ON "hotel_images"("supplier_id", "media_id");
CREATE UNIQUE INDEX "room_types_supplier_id_hotel_id_code_key" ON "room_types"("supplier_id", "hotel_id", "code");
CREATE UNIQUE INDEX "room_types_supplier_id_id_key" ON "room_types"("supplier_id", "id");
CREATE INDEX "room_types_supplier_id_status_idx" ON "room_types"("supplier_id", "status");
CREATE INDEX "room_types_currency_code_idx" ON "room_types"("currency_code");
CREATE UNIQUE INDEX "room_type_amenities_room_type_id_amenity_id_key" ON "room_type_amenities"("room_type_id", "amenity_id");
CREATE INDEX "room_type_amenities_supplier_id_status_idx" ON "room_type_amenities"("supplier_id", "status");
CREATE INDEX "room_type_amenities_supplier_id_room_type_id_idx" ON "room_type_amenities"("supplier_id", "room_type_id");
CREATE INDEX "room_type_amenities_amenity_id_idx" ON "room_type_amenities"("amenity_id");
CREATE UNIQUE INDEX "room_type_images_room_type_id_media_id_key" ON "room_type_images"("room_type_id", "media_id");
CREATE INDEX "room_type_images_supplier_id_status_idx" ON "room_type_images"("supplier_id", "status");
CREATE INDEX "room_type_images_room_type_id_sort_order_idx" ON "room_type_images"("room_type_id", "sort_order");
CREATE INDEX "room_type_images_supplier_id_room_type_id_idx" ON "room_type_images"("supplier_id", "room_type_id");
CREATE INDEX "room_type_images_supplier_id_media_id_idx" ON "room_type_images"("supplier_id", "media_id");
CREATE UNIQUE INDEX "rate_plans_supplier_id_room_type_id_code_key" ON "rate_plans"("supplier_id", "room_type_id", "code");
CREATE INDEX "rate_plans_supplier_id_status_idx" ON "rate_plans"("supplier_id", "status");
CREATE INDEX "rate_plans_room_type_id_date_from_date_to_idx" ON "rate_plans"("room_type_id", "date_from", "date_to");
CREATE INDEX "rate_plans_currency_code_idx" ON "rate_plans"("currency_code");
CREATE INDEX "rate_plans_supplier_id_cancellation_policy_id_idx" ON "rate_plans"("supplier_id", "cancellation_policy_id");
CREATE UNIQUE INDEX "room_inventory_supplier_id_room_type_id_date_key" ON "room_inventory"("supplier_id", "room_type_id", "date");
CREATE INDEX "room_inventory_supplier_id_status_idx" ON "room_inventory"("supplier_id", "status");
CREATE UNIQUE INDEX "trips_supplier_id_code_key" ON "trips"("supplier_id", "code");
CREATE UNIQUE INDEX "trips_supplier_id_id_key" ON "trips"("supplier_id", "id");
CREATE INDEX "trips_supplier_id_status_idx" ON "trips"("supplier_id", "status");
CREATE INDEX "trips_supplier_id_category_id_idx" ON "trips"("supplier_id", "category_id");
CREATE INDEX "trips_category_id_idx" ON "trips"("category_id");
CREATE INDEX "trips_city_id_idx" ON "trips"("city_id");
CREATE INDEX "trips_country_code_idx" ON "trips"("country_code");
CREATE INDEX "trips_supplier_id_cancellation_policy_id_idx" ON "trips"("supplier_id", "cancellation_policy_id");
CREATE UNIQUE INDEX "trip_images_trip_id_media_id_key" ON "trip_images"("trip_id", "media_id");
CREATE INDEX "trip_images_supplier_id_status_idx" ON "trip_images"("supplier_id", "status");
CREATE INDEX "trip_images_trip_id_sort_order_idx" ON "trip_images"("trip_id", "sort_order");
CREATE INDEX "trip_images_supplier_id_trip_id_idx" ON "trip_images"("supplier_id", "trip_id");
CREATE INDEX "trip_images_supplier_id_media_id_idx" ON "trip_images"("supplier_id", "media_id");
CREATE UNIQUE INDEX "trip_itinerary_days_supplier_id_trip_id_day_number_key" ON "trip_itinerary_days"("supplier_id", "trip_id", "day_number");
CREATE INDEX "trip_itinerary_days_supplier_id_status_idx" ON "trip_itinerary_days"("supplier_id", "status");
CREATE UNIQUE INDEX "trip_variants_supplier_id_trip_id_code_key" ON "trip_variants"("supplier_id", "trip_id", "code");
CREATE INDEX "trip_variants_supplier_id_status_idx" ON "trip_variants"("supplier_id", "status");
CREATE INDEX "trip_variants_currency_code_idx" ON "trip_variants"("currency_code");
CREATE UNIQUE INDEX "trip_schedules_supplier_id_trip_id_date_start_time_key" ON "trip_schedules"("supplier_id", "trip_id", "date", "start_time");
CREATE INDEX "trip_schedules_supplier_id_status_idx" ON "trip_schedules"("supplier_id", "status");
CREATE INDEX "trip_schedules_supplier_id_date_idx" ON "trip_schedules"("supplier_id", "date");
CREATE UNIQUE INDEX "trip_addons_supplier_id_trip_id_code_key" ON "trip_addons"("supplier_id", "trip_id", "code");
CREATE INDEX "trip_addons_supplier_id_status_idx" ON "trip_addons"("supplier_id", "status");
CREATE INDEX "trip_addons_currency_code_idx" ON "trip_addons"("currency_code");
CREATE UNIQUE INDEX "vehicle_types_supplier_id_code_key" ON "vehicle_types"("supplier_id", "code");
CREATE UNIQUE INDEX "vehicle_types_supplier_id_id_key" ON "vehicle_types"("supplier_id", "id");
CREATE INDEX "vehicle_types_supplier_id_status_idx" ON "vehicle_types"("supplier_id", "status");
CREATE UNIQUE INDEX "vehicle_type_amenities_vehicle_type_id_amenity_id_key" ON "vehicle_type_amenities"("vehicle_type_id", "amenity_id");
CREATE INDEX "vehicle_type_amenities_supplier_id_status_idx" ON "vehicle_type_amenities"("supplier_id", "status");
CREATE INDEX "vehicle_type_amenities_supplier_id_vehicle_type_id_idx" ON "vehicle_type_amenities"("supplier_id", "vehicle_type_id");
CREATE INDEX "vehicle_type_amenities_amenity_id_idx" ON "vehicle_type_amenities"("amenity_id");
CREATE UNIQUE INDEX "vehicle_type_images_vehicle_type_id_media_id_key" ON "vehicle_type_images"("vehicle_type_id", "media_id");
CREATE INDEX "vehicle_type_images_supplier_id_status_idx" ON "vehicle_type_images"("supplier_id", "status");
CREATE INDEX "vehicle_type_images_vehicle_type_id_sort_order_idx" ON "vehicle_type_images"("vehicle_type_id", "sort_order");
CREATE INDEX "vehicle_type_images_supplier_id_vehicle_type_id_idx" ON "vehicle_type_images"("supplier_id", "vehicle_type_id");
CREATE INDEX "vehicle_type_images_supplier_id_media_id_idx" ON "vehicle_type_images"("supplier_id", "media_id");
CREATE UNIQUE INDEX "transport_zones_supplier_id_code_key" ON "transport_zones"("supplier_id", "code");
CREATE UNIQUE INDEX "transport_zones_supplier_id_id_key" ON "transport_zones"("supplier_id", "id");
CREATE INDEX "transport_zones_supplier_id_status_idx" ON "transport_zones"("supplier_id", "status");
CREATE INDEX "transport_zones_city_id_idx" ON "transport_zones"("city_id");
CREATE INDEX "transport_zones_country_code_idx" ON "transport_zones"("country_code");
CREATE UNIQUE INDEX "transport_services_supplier_id_code_key" ON "transport_services"("supplier_id", "code");
CREATE INDEX "transport_services_supplier_id_status_idx" ON "transport_services"("supplier_id", "status");
CREATE INDEX "transport_services_supplier_id_service_type_idx" ON "transport_services"("supplier_id", "service_type");
CREATE INDEX "transport_services_supplier_id_origin_zone_id_idx" ON "transport_services"("supplier_id", "origin_zone_id");
CREATE INDEX "transport_services_supplier_id_destination_zone_id_idx" ON "transport_services"("supplier_id", "destination_zone_id");
CREATE INDEX "transport_services_supplier_id_vehicle_type_id_idx" ON "transport_services"("supplier_id", "vehicle_type_id");
CREATE INDEX "transport_services_currency_code_idx" ON "transport_services"("currency_code");
CREATE INDEX "transport_services_supplier_id_cancellation_policy_id_idx" ON "transport_services"("supplier_id", "cancellation_policy_id");
CREATE UNIQUE INDEX "zone_route_prices_supplier_id_from_zone_id_to_zone_id__04777248" ON "zone_route_prices"("supplier_id", "from_zone_id", "to_zone_id", "vehicle_type_id");
CREATE INDEX "zone_route_prices_supplier_id_status_idx" ON "zone_route_prices"("supplier_id", "status");
CREATE INDEX "zone_route_prices_supplier_id_to_zone_id_idx" ON "zone_route_prices"("supplier_id", "to_zone_id");
CREATE INDEX "zone_route_prices_supplier_id_vehicle_type_id_idx" ON "zone_route_prices"("supplier_id", "vehicle_type_id");
CREATE INDEX "zone_route_prices_currency_code_idx" ON "zone_route_prices"("currency_code");
CREATE UNIQUE INDEX "drivers_supplier_id_code_key" ON "drivers"("supplier_id", "code");
CREATE UNIQUE INDEX "drivers_supplier_id_id_key" ON "drivers"("supplier_id", "id");
CREATE INDEX "drivers_supplier_id_status_idx" ON "drivers"("supplier_id", "status");
CREATE UNIQUE INDEX "vehicles_supplier_id_plate_number_key" ON "vehicles"("supplier_id", "plate_number");
CREATE INDEX "vehicles_supplier_id_status_idx" ON "vehicles"("supplier_id", "status");
CREATE INDEX "vehicles_supplier_id_vehicle_type_id_idx" ON "vehicles"("supplier_id", "vehicle_type_id");
CREATE INDEX "vehicles_supplier_id_driver_id_idx" ON "vehicles"("supplier_id", "driver_id");
CREATE UNIQUE INDEX "clubs_supplier_id_code_key" ON "clubs"("supplier_id", "code");
CREATE UNIQUE INDEX "clubs_supplier_id_id_key" ON "clubs"("supplier_id", "id");
CREATE INDEX "clubs_supplier_id_status_idx" ON "clubs"("supplier_id", "status");
CREATE INDEX "clubs_category_id_idx" ON "clubs"("category_id");
CREATE INDEX "clubs_city_id_idx" ON "clubs"("city_id");
CREATE INDEX "clubs_country_code_idx" ON "clubs"("country_code");
CREATE UNIQUE INDEX "club_opening_hours_supplier_id_club_id_weekday_key" ON "club_opening_hours"("supplier_id", "club_id", "weekday");
CREATE INDEX "club_opening_hours_supplier_id_status_idx" ON "club_opening_hours"("supplier_id", "status");
CREATE UNIQUE INDEX "club_amenities_club_id_amenity_id_key" ON "club_amenities"("club_id", "amenity_id");
CREATE INDEX "club_amenities_supplier_id_status_idx" ON "club_amenities"("supplier_id", "status");
CREATE INDEX "club_amenities_supplier_id_club_id_idx" ON "club_amenities"("supplier_id", "club_id");
CREATE INDEX "club_amenities_amenity_id_idx" ON "club_amenities"("amenity_id");
CREATE UNIQUE INDEX "club_images_club_id_media_id_key" ON "club_images"("club_id", "media_id");
CREATE INDEX "club_images_supplier_id_status_idx" ON "club_images"("supplier_id", "status");
CREATE INDEX "club_images_club_id_sort_order_idx" ON "club_images"("club_id", "sort_order");
CREATE INDEX "club_images_supplier_id_club_id_idx" ON "club_images"("supplier_id", "club_id");
CREATE INDEX "club_images_supplier_id_media_id_idx" ON "club_images"("supplier_id", "media_id");
CREATE UNIQUE INDEX "club_ticket_types_supplier_id_club_id_code_key" ON "club_ticket_types"("supplier_id", "club_id", "code");
CREATE INDEX "club_ticket_types_supplier_id_status_idx" ON "club_ticket_types"("supplier_id", "status");
CREATE INDEX "club_ticket_types_currency_code_idx" ON "club_ticket_types"("currency_code");
CREATE UNIQUE INDEX "club_table_packages_supplier_id_club_id_code_key" ON "club_table_packages"("supplier_id", "club_id", "code");
CREATE INDEX "club_table_packages_supplier_id_status_idx" ON "club_table_packages"("supplier_id", "status");
CREATE INDEX "club_table_packages_currency_code_idx" ON "club_table_packages"("currency_code");
CREATE UNIQUE INDEX "club_events_supplier_id_club_id_code_key" ON "club_events"("supplier_id", "club_id", "code");
CREATE INDEX "club_events_supplier_id_status_idx" ON "club_events"("supplier_id", "status");
CREATE INDEX "club_events_supplier_id_club_id_event_date_idx" ON "club_events"("supplier_id", "club_id", "event_date");
CREATE INDEX "club_events_currency_code_idx" ON "club_events"("currency_code");

ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cities" ADD CONSTRAINT "cities_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cities" ADD CONSTRAINT "cities_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cities" ADD CONSTRAINT "cities_supplier_id_parent_id_fkey" FOREIGN KEY ("supplier_id", "parent_id") REFERENCES "cities"("supplier_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "amenities" ADD CONSTRAINT "amenities_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_supplier_id_parent_id_fkey" FOREIGN KEY ("supplier_id", "parent_id") REFERENCES "categories"("supplier_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tax_charges" ADD CONSTRAINT "tax_charges_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cancellation_policies" ADD CONSTRAINT "cancellation_policies_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cancellation_policy_rules" ADD CONSTRAINT "cancellation_policy_rules_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cancellation_policy_rules" ADD CONSTRAINT "cancellation_policy_rules_supplier_id_policy_id_fkey" FOREIGN KEY ("supplier_id", "policy_id") REFERENCES "cancellation_policies"("supplier_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hotel_amenities" ADD CONSTRAINT "hotel_amenities_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hotel_amenities" ADD CONSTRAINT "hotel_amenities_supplier_id_hotel_id_fkey" FOREIGN KEY ("supplier_id", "hotel_id") REFERENCES "hotels"("supplier_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hotel_amenities" ADD CONSTRAINT "hotel_amenities_amenity_id_fkey" FOREIGN KEY ("amenity_id") REFERENCES "amenities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hotel_images" ADD CONSTRAINT "hotel_images_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hotel_images" ADD CONSTRAINT "hotel_images_supplier_id_hotel_id_fkey" FOREIGN KEY ("supplier_id", "hotel_id") REFERENCES "hotels"("supplier_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hotel_images" ADD CONSTRAINT "hotel_images_supplier_id_media_id_fkey" FOREIGN KEY ("supplier_id", "media_id") REFERENCES "media_assets"("supplier_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_supplier_id_hotel_id_fkey" FOREIGN KEY ("supplier_id", "hotel_id") REFERENCES "hotels"("supplier_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "room_type_amenities" ADD CONSTRAINT "room_type_amenities_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "room_type_amenities" ADD CONSTRAINT "room_type_amenities_supplier_id_room_type_id_fkey" FOREIGN KEY ("supplier_id", "room_type_id") REFERENCES "room_types"("supplier_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "room_type_amenities" ADD CONSTRAINT "room_type_amenities_amenity_id_fkey" FOREIGN KEY ("amenity_id") REFERENCES "amenities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "room_type_images" ADD CONSTRAINT "room_type_images_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "room_type_images" ADD CONSTRAINT "room_type_images_supplier_id_room_type_id_fkey" FOREIGN KEY ("supplier_id", "room_type_id") REFERENCES "room_types"("supplier_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "room_type_images" ADD CONSTRAINT "room_type_images_supplier_id_media_id_fkey" FOREIGN KEY ("supplier_id", "media_id") REFERENCES "media_assets"("supplier_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_supplier_id_room_type_id_fkey" FOREIGN KEY ("supplier_id", "room_type_id") REFERENCES "room_types"("supplier_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_supplier_id_cancellation_policy_id_fkey" FOREIGN KEY ("supplier_id", "cancellation_policy_id") REFERENCES "cancellation_policies"("supplier_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "room_inventory" ADD CONSTRAINT "room_inventory_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "room_inventory" ADD CONSTRAINT "room_inventory_supplier_id_room_type_id_fkey" FOREIGN KEY ("supplier_id", "room_type_id") REFERENCES "room_types"("supplier_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trips" ADD CONSTRAINT "trips_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trips" ADD CONSTRAINT "trips_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trips" ADD CONSTRAINT "trips_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trips" ADD CONSTRAINT "trips_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trips" ADD CONSTRAINT "trips_supplier_id_cancellation_policy_id_fkey" FOREIGN KEY ("supplier_id", "cancellation_policy_id") REFERENCES "cancellation_policies"("supplier_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trip_images" ADD CONSTRAINT "trip_images_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trip_images" ADD CONSTRAINT "trip_images_supplier_id_trip_id_fkey" FOREIGN KEY ("supplier_id", "trip_id") REFERENCES "trips"("supplier_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trip_images" ADD CONSTRAINT "trip_images_supplier_id_media_id_fkey" FOREIGN KEY ("supplier_id", "media_id") REFERENCES "media_assets"("supplier_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trip_itinerary_days" ADD CONSTRAINT "trip_itinerary_days_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trip_itinerary_days" ADD CONSTRAINT "trip_itinerary_days_supplier_id_trip_id_fkey" FOREIGN KEY ("supplier_id", "trip_id") REFERENCES "trips"("supplier_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trip_variants" ADD CONSTRAINT "trip_variants_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trip_variants" ADD CONSTRAINT "trip_variants_supplier_id_trip_id_fkey" FOREIGN KEY ("supplier_id", "trip_id") REFERENCES "trips"("supplier_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trip_variants" ADD CONSTRAINT "trip_variants_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trip_schedules" ADD CONSTRAINT "trip_schedules_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trip_schedules" ADD CONSTRAINT "trip_schedules_supplier_id_trip_id_fkey" FOREIGN KEY ("supplier_id", "trip_id") REFERENCES "trips"("supplier_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trip_addons" ADD CONSTRAINT "trip_addons_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trip_addons" ADD CONSTRAINT "trip_addons_supplier_id_trip_id_fkey" FOREIGN KEY ("supplier_id", "trip_id") REFERENCES "trips"("supplier_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trip_addons" ADD CONSTRAINT "trip_addons_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_types" ADD CONSTRAINT "vehicle_types_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_type_amenities" ADD CONSTRAINT "vehicle_type_amenities_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_type_amenities" ADD CONSTRAINT "vehicle_type_amenities_supplier_id_vehicle_type_id_fkey" FOREIGN KEY ("supplier_id", "vehicle_type_id") REFERENCES "vehicle_types"("supplier_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vehicle_type_amenities" ADD CONSTRAINT "vehicle_type_amenities_amenity_id_fkey" FOREIGN KEY ("amenity_id") REFERENCES "amenities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_type_images" ADD CONSTRAINT "vehicle_type_images_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_type_images" ADD CONSTRAINT "vehicle_type_images_supplier_id_vehicle_type_id_fkey" FOREIGN KEY ("supplier_id", "vehicle_type_id") REFERENCES "vehicle_types"("supplier_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vehicle_type_images" ADD CONSTRAINT "vehicle_type_images_supplier_id_media_id_fkey" FOREIGN KEY ("supplier_id", "media_id") REFERENCES "media_assets"("supplier_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transport_zones" ADD CONSTRAINT "transport_zones_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transport_zones" ADD CONSTRAINT "transport_zones_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transport_zones" ADD CONSTRAINT "transport_zones_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transport_services" ADD CONSTRAINT "transport_services_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transport_services" ADD CONSTRAINT "transport_services_supplier_id_origin_zone_id_fkey" FOREIGN KEY ("supplier_id", "origin_zone_id") REFERENCES "transport_zones"("supplier_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transport_services" ADD CONSTRAINT "transport_services_supplier_id_destination_zone_id_fkey" FOREIGN KEY ("supplier_id", "destination_zone_id") REFERENCES "transport_zones"("supplier_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transport_services" ADD CONSTRAINT "transport_services_supplier_id_vehicle_type_id_fkey" FOREIGN KEY ("supplier_id", "vehicle_type_id") REFERENCES "vehicle_types"("supplier_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transport_services" ADD CONSTRAINT "transport_services_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transport_services" ADD CONSTRAINT "transport_services_supplier_id_cancellation_policy_id_fkey" FOREIGN KEY ("supplier_id", "cancellation_policy_id") REFERENCES "cancellation_policies"("supplier_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "zone_route_prices" ADD CONSTRAINT "zone_route_prices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "zone_route_prices" ADD CONSTRAINT "zone_route_prices_supplier_id_from_zone_id_fkey" FOREIGN KEY ("supplier_id", "from_zone_id") REFERENCES "transport_zones"("supplier_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "zone_route_prices" ADD CONSTRAINT "zone_route_prices_supplier_id_to_zone_id_fkey" FOREIGN KEY ("supplier_id", "to_zone_id") REFERENCES "transport_zones"("supplier_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "zone_route_prices" ADD CONSTRAINT "zone_route_prices_supplier_id_vehicle_type_id_fkey" FOREIGN KEY ("supplier_id", "vehicle_type_id") REFERENCES "vehicle_types"("supplier_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "zone_route_prices" ADD CONSTRAINT "zone_route_prices_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_supplier_id_vehicle_type_id_fkey" FOREIGN KEY ("supplier_id", "vehicle_type_id") REFERENCES "vehicle_types"("supplier_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_supplier_id_driver_id_fkey" FOREIGN KEY ("supplier_id", "driver_id") REFERENCES "drivers"("supplier_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "club_opening_hours" ADD CONSTRAINT "club_opening_hours_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "club_opening_hours" ADD CONSTRAINT "club_opening_hours_supplier_id_club_id_fkey" FOREIGN KEY ("supplier_id", "club_id") REFERENCES "clubs"("supplier_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "club_amenities" ADD CONSTRAINT "club_amenities_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "club_amenities" ADD CONSTRAINT "club_amenities_supplier_id_club_id_fkey" FOREIGN KEY ("supplier_id", "club_id") REFERENCES "clubs"("supplier_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "club_amenities" ADD CONSTRAINT "club_amenities_amenity_id_fkey" FOREIGN KEY ("amenity_id") REFERENCES "amenities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "club_images" ADD CONSTRAINT "club_images_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "club_images" ADD CONSTRAINT "club_images_supplier_id_club_id_fkey" FOREIGN KEY ("supplier_id", "club_id") REFERENCES "clubs"("supplier_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "club_images" ADD CONSTRAINT "club_images_supplier_id_media_id_fkey" FOREIGN KEY ("supplier_id", "media_id") REFERENCES "media_assets"("supplier_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "club_ticket_types" ADD CONSTRAINT "club_ticket_types_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "club_ticket_types" ADD CONSTRAINT "club_ticket_types_supplier_id_club_id_fkey" FOREIGN KEY ("supplier_id", "club_id") REFERENCES "clubs"("supplier_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "club_ticket_types" ADD CONSTRAINT "club_ticket_types_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "club_table_packages" ADD CONSTRAINT "club_table_packages_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "club_table_packages" ADD CONSTRAINT "club_table_packages_supplier_id_club_id_fkey" FOREIGN KEY ("supplier_id", "club_id") REFERENCES "clubs"("supplier_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "club_table_packages" ADD CONSTRAINT "club_table_packages_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "club_events" ADD CONSTRAINT "club_events_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "club_events" ADD CONSTRAINT "club_events_supplier_id_club_id_fkey" FOREIGN KEY ("supplier_id", "club_id") REFERENCES "clubs"("supplier_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "club_events" ADD CONSTRAINT "club_events_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Check constraints (not expressible in Prisma, ignored by the client)
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_commission_range_check" CHECK (commission_pct BETWEEN 0 AND 100);
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_platform_code_check" CHECK (NOT is_platform OR code = 'SUP-0000');
ALTER TABLE "users" ADD CONSTRAINT "users_role_supplier_check" CHECK ((role = 'SUPER_ADMIN') = (supplier_id IS NULL));
ALTER TABLE "users" ADD CONSTRAINT "users_email_lower_check" CHECK (email = lower(email));
ALTER TABLE "cities" ADD CONSTRAINT "cities_lat_lng_check" CHECK ((latitude IS NULL OR latitude BETWEEN -90 AND 90) AND (longitude IS NULL OR longitude BETWEEN -180 AND 180));
ALTER TABLE "tax_charges" ADD CONSTRAINT "tax_charges_rate_range_check" CHECK (rate_pct BETWEEN 0 AND 100);
ALTER TABLE "cancellation_policy_rules" ADD CONSTRAINT "cancellation_policy_rules_rule_values_check" CHECK (hours_before_start >= 0 AND refund_percent BETWEEN 0 AND 100);
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_size_positive_check" CHECK (size_bytes > 0);
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_star_range_check" CHECK (star_rating IS NULL OR star_rating BETWEEN 1 AND 5);
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_times_check" CHECK (check_in_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND check_out_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_lat_lng_check" CHECK ((latitude IS NULL OR latitude BETWEEN -90 AND 90) AND (longitude IS NULL OR longitude BETWEEN -180 AND 180));
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_capacity_check" CHECK (max_adults >= 1 AND max_children >= 0);
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_price_positive_check" CHECK (base_price >= 0);
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_dates_check" CHECK (date_to >= date_from);
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_price_positive_check" CHECK (price >= 0 AND min_stay >= 1);
ALTER TABLE "room_inventory" ADD CONSTRAINT "room_inventory_units_check" CHECK (total_units >= 0 AND available_units >= 0 AND available_units <= total_units);
ALTER TABLE "trips" ADD CONSTRAINT "trips_participants_check" CHECK (min_participants >= 1 AND (max_participants IS NULL OR max_participants >= min_participants));
ALTER TABLE "trips" ADD CONSTRAINT "trips_duration_check" CHECK (duration_minutes > 0);
ALTER TABLE "trip_itinerary_days" ADD CONSTRAINT "trip_itinerary_days_day_positive_check" CHECK (day_number >= 1);
ALTER TABLE "trip_variants" ADD CONSTRAINT "trip_variants_prices_check" CHECK (adult_price >= 0 AND (child_price IS NULL OR child_price >= 0));
ALTER TABLE "trip_variants" ADD CONSTRAINT "trip_variants_pax_check" CHECK (min_pax >= 1 AND (max_pax IS NULL OR max_pax >= min_pax));
ALTER TABLE "trip_schedules" ADD CONSTRAINT "trip_schedules_quota_check" CHECK (quota >= 0 AND remaining_quota >= 0 AND remaining_quota <= quota);
ALTER TABLE "trip_schedules" ADD CONSTRAINT "trip_schedules_times_check" CHECK (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND (end_time IS NULL OR end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'));
ALTER TABLE "trip_addons" ADD CONSTRAINT "trip_addons_price_positive_check" CHECK (price >= 0);
ALTER TABLE "vehicle_types" ADD CONSTRAINT "vehicle_types_capacity_check" CHECK (passenger_capacity >= 1 AND luggage_capacity >= 0);
ALTER TABLE "transport_services" ADD CONSTRAINT "transport_services_price_positive_check" CHECK (price >= 0);
ALTER TABLE "zone_route_prices" ADD CONSTRAINT "zone_route_prices_different_zones_check" CHECK (from_zone_id <> to_zone_id);
ALTER TABLE "zone_route_prices" ADD CONSTRAINT "zone_route_prices_price_positive_check" CHECK (price >= 0);
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_age_check" CHECK (minimum_age >= 0);
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_lat_lng_check" CHECK ((latitude IS NULL OR latitude BETWEEN -90 AND 90) AND (longitude IS NULL OR longitude BETWEEN -180 AND 180));
ALTER TABLE "club_opening_hours" ADD CONSTRAINT "club_opening_hours_weekday_range_check" CHECK (weekday BETWEEN 0 AND 6);
ALTER TABLE "club_opening_hours" ADD CONSTRAINT "club_opening_hours_times_check" CHECK ((opens_at IS NULL OR opens_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') AND (closes_at IS NULL OR closes_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'));
ALTER TABLE "club_ticket_types" ADD CONSTRAINT "club_ticket_types_price_positive_check" CHECK (price >= 0);
ALTER TABLE "club_table_packages" ADD CONSTRAINT "club_table_packages_values_check" CHECK (capacity >= 1 AND minimum_spend >= 0 AND price >= 0);
ALTER TABLE "club_events" ADD CONSTRAINT "club_events_price_check" CHECK (special_price IS NULL OR (special_price >= 0 AND currency_code IS NOT NULL));

-- A rate plan may not overlap another live plan of the same room type and meal plan
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_no_overlap" EXCLUDE USING gist ("supplier_id" WITH =, "room_type_id" WITH =, "meal_plan" WITH =, daterange("date_from", "date_to", '[]') WITH &&) WHERE ("deleted_at" IS NULL);

-- audit_logs is append-only
CREATE FUNCTION audit_logs_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit_logs is append-only'; END $$;
CREATE TRIGGER audit_logs_no_change BEFORE UPDATE OR DELETE ON "audit_logs" FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();
