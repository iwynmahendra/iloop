// GENERATED from the data model. Do not edit by hand.
import type { ResourceDef } from './types.js';
export const resources: ResourceDef[] = [
 {
  "name": "Country",
  "delegate": "country",
  "table": "countries",
  "group": "shared",
  "path": "countries",
  "tenant": false,
  "fields": [
   {
    "n": "code",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 2
   },
   {
    "n": "iso3",
    "t": "char",
    "opt": true,
    "hasDefault": false,
    "max": 3
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 120
   },
   {
    "n": "phoneCode",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 8
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ]
   }
  ],
  "search": [
   "code",
   "name"
  ],
  "refs": [],
  "sets": [],
  "sharedRead": false,
  "keyField": "code"
 },
 {
  "name": "Currency",
  "delegate": "currency",
  "table": "currencies",
  "group": "shared",
  "path": "currencies",
  "tenant": false,
  "fields": [
   {
    "n": "code",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 3
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 80
   },
   {
    "n": "symbol",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 8
   },
   {
    "n": "decimals",
    "t": "int",
    "opt": false,
    "hasDefault": true
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ]
   }
  ],
  "search": [
   "code",
   "name"
  ],
  "refs": [],
  "sets": [],
  "sharedRead": false,
  "keyField": "code"
 },
 {
  "name": "City",
  "delegate": "city",
  "table": "cities",
  "group": "shared",
  "path": "cities",
  "tenant": true,
  "fields": [
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 60
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 150
   },
   {
    "n": "kind",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "CITY",
     "AREA"
    ]
   },
   {
    "n": "countryCode",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 2
   },
   {
    "n": "parentId",
    "t": "uuid",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "latitude",
    "t": "decimal",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "longitude",
    "t": "decimal",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "timezone",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 60
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ]
   }
  ],
  "search": [
   "code",
   "name"
  ],
  "refs": [
   {
    "field": "parentId",
    "delegate": "city"
   }
  ],
  "sets": [],
  "sharedRead": true,
  "keyField": "code"
 },
 {
  "name": "Amenity",
  "delegate": "amenity",
  "table": "amenities",
  "group": "shared",
  "path": "amenities",
  "tenant": true,
  "fields": [
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 60
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 120
   },
   {
    "n": "scope",
    "t": "enum",
    "opt": false,
    "hasDefault": false,
    "values": [
     "HOTEL",
     "ROOM",
     "CLUB",
     "VEHICLE",
     "TRIP"
    ]
   },
   {
    "n": "icon",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 60
   },
   {
    "n": "sortOrder",
    "t": "int",
    "opt": false,
    "hasDefault": true
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ]
   }
  ],
  "search": [
   "code",
   "name"
  ],
  "refs": [],
  "sets": [],
  "sharedRead": true,
  "keyField": "code"
 },
 {
  "name": "Category",
  "delegate": "category",
  "table": "categories",
  "group": "shared",
  "path": "categories",
  "tenant": true,
  "fields": [
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 60
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 120
   },
   {
    "n": "type",
    "t": "enum",
    "opt": false,
    "hasDefault": false,
    "values": [
     "HOTEL",
     "TRIP",
     "TRANSPORT",
     "CLUB"
    ]
   },
   {
    "n": "parentId",
    "t": "uuid",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "description",
    "t": "string",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "sortOrder",
    "t": "int",
    "opt": false,
    "hasDefault": true
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ]
   }
  ],
  "search": [
   "code",
   "name"
  ],
  "refs": [
   {
    "field": "parentId",
    "delegate": "category"
   }
  ],
  "sets": [],
  "sharedRead": true,
  "keyField": "code"
 },
 {
  "name": "TaxCharge",
  "delegate": "taxCharge",
  "table": "tax_charges",
  "group": "shared",
  "path": "tax-charges",
  "tenant": true,
  "fields": [
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 120
   },
   {
    "n": "type",
    "t": "enum",
    "opt": false,
    "hasDefault": false,
    "values": [
     "TAX",
     "SERVICE_CHARGE"
    ]
   },
   {
    "n": "ratePct",
    "t": "decimal",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "isInclusive",
    "t": "bool",
    "opt": false,
    "hasDefault": true
   },
   {
    "n": "appliesTo",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ALL",
     "HOTEL",
     "TRIP",
     "TRANSPORT",
     "CLUB"
    ]
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ]
   }
  ],
  "search": [
   "code",
   "name"
  ],
  "refs": [],
  "sets": [],
  "sharedRead": false,
  "keyField": "code"
 },
 {
  "name": "CancellationPolicy",
  "delegate": "cancellationPolicy",
  "table": "cancellation_policies",
  "group": "shared",
  "path": "cancellation-policies",
  "tenant": true,
  "fields": [
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 150
   },
   {
    "n": "description",
    "t": "string",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ]
   }
  ],
  "search": [
   "code",
   "name"
  ],
  "refs": [],
  "sets": [],
  "sharedRead": false,
  "keyField": "code"
 },
 {
  "name": "CancellationPolicyRule",
  "delegate": "cancellationPolicyRule",
  "table": "cancellation_policy_rules",
  "group": "shared",
  "path": "cancellation-policy-rules",
  "tenant": true,
  "fields": [
   {
    "n": "policyId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "hoursBeforeStart",
    "t": "int",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "refundPercent",
    "t": "decimal",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "sortOrder",
    "t": "int",
    "opt": false,
    "hasDefault": true
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ]
   }
  ],
  "search": [],
  "refs": [
   {
    "field": "policyId",
    "delegate": "cancellationPolicy"
   }
  ],
  "sets": [],
  "sharedRead": false,
  "keyField": null
 },
 {
  "name": "MediaAsset",
  "delegate": "mediaAsset",
  "table": "media_assets",
  "group": "shared",
  "path": "media-assets",
  "tenant": true,
  "fields": [
   {
    "n": "storageKey",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 300
   },
   {
    "n": "url",
    "t": "string",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "originalName",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 255
   },
   {
    "n": "mimeType",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 100
   },
   {
    "n": "sizeBytes",
    "t": "bigint",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "width",
    "t": "int",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "height",
    "t": "int",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "altText",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 255
   },
   {
    "n": "folder",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 120
   },
   {
    "n": "checksum",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 64
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ]
   }
  ],
  "search": [],
  "refs": [],
  "sets": [],
  "sharedRead": false,
  "keyField": null
 },
 {
  "name": "Hotel",
  "delegate": "hotel",
  "table": "hotels",
  "group": "hotel",
  "path": "hotels",
  "tenant": true,
  "fields": [
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 200
   },
   {
    "n": "starRating",
    "t": "int",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "description",
    "t": "string",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "address",
    "t": "string",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "postalCode",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 20
   },
   {
    "n": "cityId",
    "t": "uuid",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "countryCode",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 2
   },
   {
    "n": "latitude",
    "t": "decimal",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "longitude",
    "t": "decimal",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "checkInTime",
    "t": "time",
    "opt": false,
    "hasDefault": true
   },
   {
    "n": "checkOutTime",
    "t": "time",
    "opt": false,
    "hasDefault": true
   },
   {
    "n": "contactName",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 120
   },
   {
    "n": "contactEmail",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 254
   },
   {
    "n": "contactPhone",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 40
   },
   {
    "n": "website",
    "t": "string",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "policies",
    "t": "json",
    "opt": false,
    "hasDefault": true
   },
   {
    "n": "currencyCode",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 3
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ]
   }
  ],
  "search": [
   "code",
   "name",
   "address"
  ],
  "refs": [
   {
    "field": "cityId",
    "delegate": "city"
   }
  ],
  "sets": [
   {
    "path": "amenities",
    "kind": "join",
    "delegate": "hotelAmenity",
    "parentField": "hotelId",
    "childField": "amenityId",
    "relation": "amenity",
    "refDelegate": "amenity"
   },
   {
    "path": "images",
    "kind": "image",
    "delegate": "hotelImage",
    "parentField": "hotelId",
    "childField": "mediaId",
    "relation": "media",
    "refDelegate": "mediaAsset"
   }
  ],
  "sharedRead": false,
  "keyField": "code"
 },
 {
  "name": "RoomType",
  "delegate": "roomType",
  "table": "room_types",
  "group": "hotel",
  "path": "room-types",
  "tenant": true,
  "fields": [
   {
    "n": "hotelId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 150
   },
   {
    "n": "bedType",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 60
   },
   {
    "n": "maxAdults",
    "t": "int",
    "opt": false,
    "hasDefault": true
   },
   {
    "n": "maxChildren",
    "t": "int",
    "opt": false,
    "hasDefault": true
   },
   {
    "n": "sizeM2",
    "t": "decimal",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "description",
    "t": "string",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "basePrice",
    "t": "decimal",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "currencyCode",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 3
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ]
   }
  ],
  "search": [
   "code",
   "name"
  ],
  "refs": [
   {
    "field": "hotelId",
    "delegate": "hotel"
   }
  ],
  "sets": [
   {
    "path": "amenities",
    "kind": "join",
    "delegate": "roomTypeAmenity",
    "parentField": "roomTypeId",
    "childField": "amenityId",
    "relation": "amenity",
    "refDelegate": "amenity"
   },
   {
    "path": "images",
    "kind": "image",
    "delegate": "roomTypeImage",
    "parentField": "roomTypeId",
    "childField": "mediaId",
    "relation": "media",
    "refDelegate": "mediaAsset"
   }
  ],
  "sharedRead": false,
  "keyField": "code"
 },
 {
  "name": "RatePlan",
  "delegate": "ratePlan",
  "table": "rate_plans",
  "group": "hotel",
  "path": "rate-plans",
  "tenant": true,
  "fields": [
   {
    "n": "roomTypeId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 150
   },
   {
    "n": "dateFrom",
    "t": "date",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "dateTo",
    "t": "date",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "price",
    "t": "decimal",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "currencyCode",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 3
   },
   {
    "n": "mealPlan",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ROOM_ONLY",
     "BREAKFAST",
     "HALF_BOARD",
     "FULL_BOARD",
     "ALL_INCLUSIVE"
    ]
   },
   {
    "n": "cancellationPolicyId",
    "t": "uuid",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "minStay",
    "t": "int",
    "opt": false,
    "hasDefault": true
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ]
   }
  ],
  "search": [
   "code",
   "name"
  ],
  "refs": [
   {
    "field": "roomTypeId",
    "delegate": "roomType"
   },
   {
    "field": "cancellationPolicyId",
    "delegate": "cancellationPolicy"
   }
  ],
  "sets": [],
  "sharedRead": false,
  "keyField": "code"
 },
 {
  "name": "RoomInventory",
  "delegate": "roomInventory",
  "table": "room_inventory",
  "group": "hotel",
  "path": "room-inventory",
  "tenant": true,
  "fields": [
   {
    "n": "roomTypeId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "date",
    "t": "date",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "totalUnits",
    "t": "int",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "availableUnits",
    "t": "int",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "stopSell",
    "t": "bool",
    "opt": false,
    "hasDefault": true
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ]
   }
  ],
  "search": [],
  "refs": [
   {
    "field": "roomTypeId",
    "delegate": "roomType"
   }
  ],
  "sets": [],
  "sharedRead": false,
  "keyField": null
 },
 {
  "name": "Trip",
  "delegate": "trip",
  "table": "trips",
  "group": "trips",
  "path": "trips",
  "tenant": true,
  "fields": [
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40
   },
   {
    "n": "title",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 200
   },
   {
    "n": "categoryId",
    "t": "uuid",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "description",
    "t": "string",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "durationMinutes",
    "t": "int",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "meetingPoint",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 255
   },
   {
    "n": "meetingLatitude",
    "t": "decimal",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "meetingLongitude",
    "t": "decimal",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "location",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 255
   },
   {
    "n": "cityId",
    "t": "uuid",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "countryCode",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 2
   },
   {
    "n": "difficulty",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "EASY",
     "MODERATE",
     "CHALLENGING",
     "EXTREME"
    ]
   },
   {
    "n": "minParticipants",
    "t": "int",
    "opt": false,
    "hasDefault": true
   },
   {
    "n": "maxParticipants",
    "t": "int",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "inclusions",
    "t": "array",
    "opt": false,
    "hasDefault": true
   },
   {
    "n": "exclusions",
    "t": "array",
    "opt": false,
    "hasDefault": true
   },
   {
    "n": "cancellationPolicyId",
    "t": "uuid",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ]
   }
  ],
  "search": [
   "code",
   "title",
   "location"
  ],
  "refs": [
   {
    "field": "categoryId",
    "delegate": "category"
   },
   {
    "field": "cityId",
    "delegate": "city"
   },
   {
    "field": "cancellationPolicyId",
    "delegate": "cancellationPolicy"
   }
  ],
  "sets": [
   {
    "path": "images",
    "kind": "image",
    "delegate": "tripImage",
    "parentField": "tripId",
    "childField": "mediaId",
    "relation": "media",
    "refDelegate": "mediaAsset"
   }
  ],
  "sharedRead": false,
  "keyField": "code"
 },
 {
  "name": "TripItineraryDay",
  "delegate": "tripItineraryDay",
  "table": "trip_itinerary_days",
  "group": "trips",
  "path": "trip-itinerary-days",
  "tenant": true,
  "fields": [
   {
    "n": "tripId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "dayNumber",
    "t": "int",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "title",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 200
   },
   {
    "n": "description",
    "t": "string",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "items",
    "t": "json",
    "opt": false,
    "hasDefault": true
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ]
   }
  ],
  "search": [
   "title"
  ],
  "refs": [
   {
    "field": "tripId",
    "delegate": "trip"
   }
  ],
  "sets": [],
  "sharedRead": false,
  "keyField": null
 },
 {
  "name": "TripVariant",
  "delegate": "tripVariant",
  "table": "trip_variants",
  "group": "trips",
  "path": "trip-variants",
  "tenant": true,
  "fields": [
   {
    "n": "tripId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 150
   },
   {
    "n": "description",
    "t": "string",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "adultPrice",
    "t": "decimal",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "childPrice",
    "t": "decimal",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "currencyCode",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 3
   },
   {
    "n": "minPax",
    "t": "int",
    "opt": false,
    "hasDefault": true
   },
   {
    "n": "maxPax",
    "t": "int",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ]
   }
  ],
  "search": [
   "code",
   "name"
  ],
  "refs": [
   {
    "field": "tripId",
    "delegate": "trip"
   }
  ],
  "sets": [],
  "sharedRead": false,
  "keyField": "code"
 },
 {
  "name": "TripSchedule",
  "delegate": "tripSchedule",
  "table": "trip_schedules",
  "group": "trips",
  "path": "trip-schedules",
  "tenant": true,
  "fields": [
   {
    "n": "tripId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "date",
    "t": "date",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "startTime",
    "t": "time",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "endTime",
    "t": "time",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "quota",
    "t": "int",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "remainingQuota",
    "t": "int",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "cutoffHours",
    "t": "int",
    "opt": false,
    "hasDefault": true
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ]
   }
  ],
  "search": [],
  "refs": [
   {
    "field": "tripId",
    "delegate": "trip"
   }
  ],
  "sets": [],
  "sharedRead": false,
  "keyField": null
 },
 {
  "name": "TripAddon",
  "delegate": "tripAddon",
  "table": "trip_addons",
  "group": "trips",
  "path": "trip-addons",
  "tenant": true,
  "fields": [
   {
    "n": "tripId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 150
   },
   {
    "n": "price",
    "t": "decimal",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "currencyCode",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 3
   },
   {
    "n": "perPerson",
    "t": "bool",
    "opt": false,
    "hasDefault": true
   },
   {
    "n": "maxQuantity",
    "t": "int",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ]
   }
  ],
  "search": [
   "code",
   "name"
  ],
  "refs": [
   {
    "field": "tripId",
    "delegate": "trip"
   }
  ],
  "sets": [],
  "sharedRead": false,
  "keyField": "code"
 },
 {
  "name": "VehicleType",
  "delegate": "vehicleType",
  "table": "vehicle_types",
  "group": "transport",
  "path": "vehicle-types",
  "tenant": true,
  "fields": [
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 120
   },
   {
    "n": "kind",
    "t": "enum",
    "opt": false,
    "hasDefault": false,
    "values": [
     "CAR",
     "VAN",
     "BUS",
     "BOAT",
     "SCOOTER",
     "OTHER"
    ]
   },
   {
    "n": "passengerCapacity",
    "t": "int",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "luggageCapacity",
    "t": "int",
    "opt": false,
    "hasDefault": true
   },
   {
    "n": "description",
    "t": "string",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ]
   }
  ],
  "search": [
   "code",
   "name"
  ],
  "refs": [],
  "sets": [
   {
    "path": "amenities",
    "kind": "join",
    "delegate": "vehicleTypeAmenity",
    "parentField": "vehicleTypeId",
    "childField": "amenityId",
    "relation": "amenity",
    "refDelegate": "amenity"
   },
   {
    "path": "images",
    "kind": "image",
    "delegate": "vehicleTypeImage",
    "parentField": "vehicleTypeId",
    "childField": "mediaId",
    "relation": "media",
    "refDelegate": "mediaAsset"
   }
  ],
  "sharedRead": false,
  "keyField": "code"
 },
 {
  "name": "TransportZone",
  "delegate": "transportZone",
  "table": "transport_zones",
  "group": "transport",
  "path": "transport-zones",
  "tenant": true,
  "fields": [
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 150
   },
   {
    "n": "cityId",
    "t": "uuid",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "countryCode",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 2
   },
   {
    "n": "description",
    "t": "string",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "latitude",
    "t": "decimal",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "longitude",
    "t": "decimal",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ]
   }
  ],
  "search": [
   "code",
   "name"
  ],
  "refs": [
   {
    "field": "cityId",
    "delegate": "city"
   }
  ],
  "sets": [],
  "sharedRead": false,
  "keyField": "code"
 },
 {
  "name": "TransportService",
  "delegate": "transportService",
  "table": "transport_services",
  "group": "transport",
  "path": "transport-services",
  "tenant": true,
  "fields": [
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 200
   },
   {
    "n": "serviceType",
    "t": "enum",
    "opt": false,
    "hasDefault": false,
    "values": [
     "AIRPORT_TRANSFER",
     "CHARTER",
     "SHUTTLE",
     "FERRY"
    ]
   },
   {
    "n": "originZoneId",
    "t": "uuid",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "destinationZoneId",
    "t": "uuid",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "originLabel",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 200
   },
   {
    "n": "destinationLabel",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 200
   },
   {
    "n": "vehicleTypeId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "price",
    "t": "decimal",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "currencyCode",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 3
   },
   {
    "n": "durationMinutes",
    "t": "int",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "driverIncluded",
    "t": "bool",
    "opt": false,
    "hasDefault": true
   },
   {
    "n": "description",
    "t": "string",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "cancellationPolicyId",
    "t": "uuid",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ]
   }
  ],
  "search": [
   "code",
   "name",
   "originLabel",
   "destinationLabel"
  ],
  "refs": [
   {
    "field": "originZoneId",
    "delegate": "transportZone"
   },
   {
    "field": "destinationZoneId",
    "delegate": "transportZone"
   },
   {
    "field": "vehicleTypeId",
    "delegate": "vehicleType"
   },
   {
    "field": "cancellationPolicyId",
    "delegate": "cancellationPolicy"
   }
  ],
  "sets": [],
  "sharedRead": false,
  "keyField": "code"
 },
 {
  "name": "ZoneRoutePrice",
  "delegate": "zoneRoutePrice",
  "table": "zone_route_prices",
  "group": "transport",
  "path": "zone-route-prices",
  "tenant": true,
  "fields": [
   {
    "n": "fromZoneId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "toZoneId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "vehicleTypeId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "price",
    "t": "decimal",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "currencyCode",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 3
   },
   {
    "n": "durationMinutes",
    "t": "int",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ]
   }
  ],
  "search": [],
  "refs": [
   {
    "field": "fromZoneId",
    "delegate": "transportZone"
   },
   {
    "field": "toZoneId",
    "delegate": "transportZone"
   },
   {
    "field": "vehicleTypeId",
    "delegate": "vehicleType"
   }
  ],
  "sets": [],
  "sharedRead": false,
  "keyField": null
 },
 {
  "name": "Driver",
  "delegate": "driver",
  "table": "drivers",
  "group": "transport",
  "path": "drivers",
  "tenant": true,
  "fields": [
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 150
   },
   {
    "n": "phone",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40
   },
   {
    "n": "email",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 254
   },
   {
    "n": "licenseNumber",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 60
   },
   {
    "n": "licenseExpiry",
    "t": "date",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ]
   }
  ],
  "search": [
   "code",
   "name",
   "licenseNumber",
   "email",
   "phone"
  ],
  "refs": [],
  "sets": [],
  "sharedRead": false,
  "keyField": "code"
 },
 {
  "name": "Vehicle",
  "delegate": "vehicle",
  "table": "vehicles",
  "group": "transport",
  "path": "vehicles",
  "tenant": true,
  "fields": [
   {
    "n": "vehicleTypeId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "plateNumber",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 20
   },
   {
    "n": "make",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 60
   },
   {
    "n": "model",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 60
   },
   {
    "n": "year",
    "t": "int",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "color",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 40
   },
   {
    "n": "driverId",
    "t": "uuid",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "insuranceExpiry",
    "t": "date",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ]
   }
  ],
  "search": [
   "plateNumber"
  ],
  "refs": [
   {
    "field": "vehicleTypeId",
    "delegate": "vehicleType"
   },
   {
    "field": "driverId",
    "delegate": "driver"
   }
  ],
  "sets": [],
  "sharedRead": false,
  "keyField": null
 },
 {
  "name": "Club",
  "delegate": "club",
  "table": "clubs",
  "group": "club",
  "path": "clubs",
  "tenant": true,
  "fields": [
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 200
   },
   {
    "n": "venueKind",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "BEACH_CLUB",
     "NIGHTCLUB",
     "LOUNGE",
     "OTHER"
    ]
   },
   {
    "n": "categoryId",
    "t": "uuid",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "description",
    "t": "string",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "address",
    "t": "string",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "cityId",
    "t": "uuid",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "countryCode",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 2
   },
   {
    "n": "latitude",
    "t": "decimal",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "longitude",
    "t": "decimal",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "phone",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 40
   },
   {
    "n": "email",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 254
   },
   {
    "n": "dressCode",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 255
   },
   {
    "n": "minimumAge",
    "t": "int",
    "opt": false,
    "hasDefault": true
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ]
   }
  ],
  "search": [
   "code",
   "name",
   "email",
   "phone",
   "address"
  ],
  "refs": [
   {
    "field": "categoryId",
    "delegate": "category"
   },
   {
    "field": "cityId",
    "delegate": "city"
   }
  ],
  "sets": [
   {
    "path": "amenities",
    "kind": "join",
    "delegate": "clubAmenity",
    "parentField": "clubId",
    "childField": "amenityId",
    "relation": "amenity",
    "refDelegate": "amenity"
   },
   {
    "path": "images",
    "kind": "image",
    "delegate": "clubImage",
    "parentField": "clubId",
    "childField": "mediaId",
    "relation": "media",
    "refDelegate": "mediaAsset"
   }
  ],
  "sharedRead": false,
  "keyField": "code"
 },
 {
  "name": "ClubOpeningHour",
  "delegate": "clubOpeningHour",
  "table": "club_opening_hours",
  "group": "club",
  "path": "club-opening-hours",
  "tenant": true,
  "fields": [
   {
    "n": "clubId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "weekday",
    "t": "int",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "opensAt",
    "t": "time",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "closesAt",
    "t": "time",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "isClosed",
    "t": "bool",
    "opt": false,
    "hasDefault": true
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ]
   }
  ],
  "search": [],
  "refs": [
   {
    "field": "clubId",
    "delegate": "club"
   }
  ],
  "sets": [],
  "sharedRead": false,
  "keyField": null
 },
 {
  "name": "ClubTicketType",
  "delegate": "clubTicketType",
  "table": "club_ticket_types",
  "group": "club",
  "path": "club-ticket-types",
  "tenant": true,
  "fields": [
   {
    "n": "clubId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 150
   },
   {
    "n": "description",
    "t": "string",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "price",
    "t": "decimal",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "currencyCode",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 3
   },
   {
    "n": "inclusions",
    "t": "array",
    "opt": false,
    "hasDefault": true
   },
   {
    "n": "quota",
    "t": "int",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ]
   }
  ],
  "search": [
   "code",
   "name"
  ],
  "refs": [
   {
    "field": "clubId",
    "delegate": "club"
   }
  ],
  "sets": [],
  "sharedRead": false,
  "keyField": "code"
 },
 {
  "name": "ClubTablePackage",
  "delegate": "clubTablePackage",
  "table": "club_table_packages",
  "group": "club",
  "path": "club-table-packages",
  "tenant": true,
  "fields": [
   {
    "n": "clubId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 150
   },
   {
    "n": "capacity",
    "t": "int",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "minimumSpend",
    "t": "decimal",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "price",
    "t": "decimal",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "currencyCode",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 3
   },
   {
    "n": "inclusions",
    "t": "array",
    "opt": false,
    "hasDefault": true
   },
   {
    "n": "quota",
    "t": "int",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ]
   }
  ],
  "search": [
   "code",
   "name"
  ],
  "refs": [
   {
    "field": "clubId",
    "delegate": "club"
   }
  ],
  "sets": [],
  "sharedRead": false,
  "keyField": "code"
 },
 {
  "name": "ClubEvent",
  "delegate": "clubEvent",
  "table": "club_events",
  "group": "club",
  "path": "club-events",
  "tenant": true,
  "fields": [
   {
    "n": "clubId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40
   },
   {
    "n": "title",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 200
   },
   {
    "n": "eventDate",
    "t": "date",
    "opt": false,
    "hasDefault": false
   },
   {
    "n": "startTime",
    "t": "time",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "endTime",
    "t": "time",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "lineup",
    "t": "array",
    "opt": false,
    "hasDefault": true
   },
   {
    "n": "description",
    "t": "string",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "specialPrice",
    "t": "decimal",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "currencyCode",
    "t": "char",
    "opt": true,
    "hasDefault": false,
    "max": 3
   },
   {
    "n": "quota",
    "t": "int",
    "opt": true,
    "hasDefault": false
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ]
   }
  ],
  "search": [
   "code",
   "title"
  ],
  "refs": [
   {
    "field": "clubId",
    "delegate": "club"
   }
  ],
  "sets": [],
  "sharedRead": false,
  "keyField": "code"
 }
];
