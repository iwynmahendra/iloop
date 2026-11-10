// GENERATED from the data model. Do not edit by hand.
export type FieldType = 'uuid'|'string'|'char'|'int'|'bigint'|'decimal'|'bool'|'date'|'datetime'|'json'|'time'|'array'|'enum';
export interface FieldDef { n: string; t: FieldType; opt: boolean; hasDefault: boolean; values?: string[]; max?: number; label: string; codeRef?: 'countries'|'currencies'; ref?: { group: string; path: string; display: string|null; resource: string } }
export interface SetDef { path: 'images'|'amenities'; kind: 'image'|'join'; delegate?: string; refDelegate?: string; parentField: string; childField: string; relation: string }
export interface ChildDef { path: string; group: string; field: string; label: string; name: string }
export interface ResourceDef { name: string; label: string; plural: string; group: 'shared'|'hotel'|'trips'|'transport'|'club'; path: string; tenant: boolean; sharedRead: boolean; display: string|null; columns: string[]; search: string[]; fields: FieldDef[]; sets: SetDef[]; children: ChildDef[] }
export const resources: ResourceDef[] = [
 {
  "name": "Country",
  "label": "Country",
  "plural": "Countries",
  "group": "shared",
  "path": "countries",
  "tenant": false,
  "sharedRead": false,
  "display": "name",
  "columns": [
   "code",
   "name"
  ],
  "search": [
   "code",
   "name"
  ],
  "fields": [
   {
    "n": "code",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 2,
    "label": "Code"
   },
   {
    "n": "iso3",
    "t": "char",
    "opt": true,
    "hasDefault": false,
    "max": 3,
    "label": "Iso3"
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 120,
    "label": "Name"
   },
   {
    "n": "phoneCode",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 8,
    "label": "Phone Code"
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ],
    "label": "Status"
   }
  ],
  "sets": [],
  "children": []
 },
 {
  "name": "Currency",
  "label": "Currency",
  "plural": "Currencies",
  "group": "shared",
  "path": "currencies",
  "tenant": false,
  "sharedRead": false,
  "display": "name",
  "columns": [
   "code",
   "name",
   "decimals"
  ],
  "search": [
   "code",
   "name"
  ],
  "fields": [
   {
    "n": "code",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 3,
    "label": "Code"
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 80,
    "label": "Name"
   },
   {
    "n": "symbol",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 8,
    "label": "Symbol"
   },
   {
    "n": "decimals",
    "t": "int",
    "opt": false,
    "hasDefault": true,
    "label": "Decimals"
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ],
    "label": "Status"
   }
  ],
  "sets": [],
  "children": []
 },
 {
  "name": "City",
  "label": "City",
  "plural": "Cities",
  "group": "shared",
  "path": "cities",
  "tenant": true,
  "sharedRead": true,
  "display": "name",
  "columns": [
   "code",
   "name",
   "kind"
  ],
  "search": [
   "code",
   "name"
  ],
  "fields": [
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 60,
    "label": "Code"
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 150,
    "label": "Name"
   },
   {
    "n": "kind",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "CITY",
     "AREA"
    ],
    "label": "Kind"
   },
   {
    "n": "countryCode",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 2,
    "label": "Country",
    "codeRef": "countries"
   },
   {
    "n": "parentId",
    "t": "uuid",
    "opt": true,
    "hasDefault": false,
    "label": "Parent",
    "ref": {
     "group": "shared",
     "path": "cities",
     "display": "name",
     "resource": "City"
    }
   },
   {
    "n": "latitude",
    "t": "decimal",
    "opt": true,
    "hasDefault": false,
    "label": "Latitude"
   },
   {
    "n": "longitude",
    "t": "decimal",
    "opt": true,
    "hasDefault": false,
    "label": "Longitude"
   },
   {
    "n": "timezone",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 60,
    "label": "Timezone"
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ],
    "label": "Status"
   }
  ],
  "sets": [],
  "children": []
 },
 {
  "name": "Amenity",
  "label": "Amenity",
  "plural": "Amenities",
  "group": "shared",
  "path": "amenities",
  "tenant": true,
  "sharedRead": true,
  "display": "name",
  "columns": [
   "code",
   "name",
   "scope",
   "sortOrder"
  ],
  "search": [
   "code",
   "name"
  ],
  "fields": [
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 60,
    "label": "Code"
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 120,
    "label": "Name"
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
    ],
    "label": "Scope"
   },
   {
    "n": "icon",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 60,
    "label": "Icon"
   },
   {
    "n": "sortOrder",
    "t": "int",
    "opt": false,
    "hasDefault": true,
    "label": "Sort Order"
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ],
    "label": "Status"
   }
  ],
  "sets": [],
  "children": []
 },
 {
  "name": "Category",
  "label": "Category",
  "plural": "Categories",
  "group": "shared",
  "path": "categories",
  "tenant": true,
  "sharedRead": true,
  "display": "name",
  "columns": [
   "code",
   "name",
   "type",
   "sortOrder"
  ],
  "search": [
   "code",
   "name"
  ],
  "fields": [
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 60,
    "label": "Code"
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 120,
    "label": "Name"
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
    ],
    "label": "Type"
   },
   {
    "n": "parentId",
    "t": "uuid",
    "opt": true,
    "hasDefault": false,
    "label": "Parent",
    "ref": {
     "group": "shared",
     "path": "categories",
     "display": "name",
     "resource": "Category"
    }
   },
   {
    "n": "description",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "label": "Description"
   },
   {
    "n": "sortOrder",
    "t": "int",
    "opt": false,
    "hasDefault": true,
    "label": "Sort Order"
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ],
    "label": "Status"
   }
  ],
  "sets": [],
  "children": []
 },
 {
  "name": "TaxCharge",
  "label": "Tax Charge",
  "plural": "Tax charges",
  "group": "shared",
  "path": "tax-charges",
  "tenant": true,
  "sharedRead": false,
  "display": "name",
  "columns": [
   "code",
   "name",
   "type",
   "appliesTo",
   "ratePct"
  ],
  "search": [
   "code",
   "name"
  ],
  "fields": [
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40,
    "label": "Code"
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 120,
    "label": "Name"
   },
   {
    "n": "type",
    "t": "enum",
    "opt": false,
    "hasDefault": false,
    "values": [
     "TAX",
     "SERVICE_CHARGE"
    ],
    "label": "Type"
   },
   {
    "n": "ratePct",
    "t": "decimal",
    "opt": false,
    "hasDefault": false,
    "label": "Rate Pct"
   },
   {
    "n": "isInclusive",
    "t": "bool",
    "opt": false,
    "hasDefault": true,
    "label": "Is Inclusive"
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
    ],
    "label": "Applies To"
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ],
    "label": "Status"
   }
  ],
  "sets": [],
  "children": []
 },
 {
  "name": "CancellationPolicy",
  "label": "Cancellation Policy",
  "plural": "Cancellation policies",
  "group": "shared",
  "path": "cancellation-policies",
  "tenant": true,
  "sharedRead": false,
  "display": "name",
  "columns": [
   "code",
   "name"
  ],
  "search": [
   "code",
   "name"
  ],
  "fields": [
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40,
    "label": "Code"
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 150,
    "label": "Name"
   },
   {
    "n": "description",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "label": "Description"
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ],
    "label": "Status"
   }
  ],
  "sets": [],
  "children": [
   {
    "path": "cancellation-policy-rules",
    "group": "shared",
    "field": "policyId",
    "label": "Cancellation policy rules",
    "name": "CancellationPolicyRule"
   }
  ]
 },
 {
  "name": "CancellationPolicyRule",
  "label": "Cancellation Policy Rule",
  "plural": "Cancellation policy rules",
  "group": "shared",
  "path": "cancellation-policy-rules",
  "tenant": true,
  "sharedRead": false,
  "display": null,
  "columns": [
   "policyId",
   "refundPercent",
   "hoursBeforeStart"
  ],
  "search": [],
  "fields": [
   {
    "n": "policyId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false,
    "label": "Policy",
    "ref": {
     "group": "shared",
     "path": "cancellation-policies",
     "display": "name",
     "resource": "CancellationPolicy"
    }
   },
   {
    "n": "hoursBeforeStart",
    "t": "int",
    "opt": false,
    "hasDefault": false,
    "label": "Hours Before Start"
   },
   {
    "n": "refundPercent",
    "t": "decimal",
    "opt": false,
    "hasDefault": false,
    "label": "Refund Percent"
   },
   {
    "n": "sortOrder",
    "t": "int",
    "opt": false,
    "hasDefault": true,
    "label": "Sort Order"
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ],
    "label": "Status"
   }
  ],
  "sets": [],
  "children": []
 },
 {
  "name": "MediaAsset",
  "label": "Media Asset",
  "plural": "Media assets",
  "group": "shared",
  "path": "media-assets",
  "tenant": true,
  "sharedRead": false,
  "display": null,
  "columns": [
   "storageKey"
  ],
  "search": [],
  "fields": [
   {
    "n": "storageKey",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 300,
    "label": "Storage Key"
   },
   {
    "n": "url",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "label": "Url"
   },
   {
    "n": "originalName",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 255,
    "label": "Original Name"
   },
   {
    "n": "mimeType",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 100,
    "label": "Mime Type"
   },
   {
    "n": "sizeBytes",
    "t": "bigint",
    "opt": false,
    "hasDefault": false,
    "label": "Size Bytes"
   },
   {
    "n": "width",
    "t": "int",
    "opt": true,
    "hasDefault": false,
    "label": "Width"
   },
   {
    "n": "height",
    "t": "int",
    "opt": true,
    "hasDefault": false,
    "label": "Height"
   },
   {
    "n": "altText",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 255,
    "label": "Alt Text"
   },
   {
    "n": "folder",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 120,
    "label": "Folder"
   },
   {
    "n": "checksum",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 64,
    "label": "Checksum"
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ],
    "label": "Status"
   }
  ],
  "sets": [],
  "children": []
 },
 {
  "name": "Hotel",
  "label": "Hotel",
  "plural": "Hotels",
  "group": "hotel",
  "path": "hotels",
  "tenant": true,
  "sharedRead": false,
  "display": "name",
  "columns": [
   "code",
   "name",
   "cityId",
   "checkInTime"
  ],
  "search": [
   "code",
   "name",
   "address"
  ],
  "fields": [
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40,
    "label": "Code"
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 200,
    "label": "Name"
   },
   {
    "n": "starRating",
    "t": "int",
    "opt": true,
    "hasDefault": false,
    "label": "Star Rating"
   },
   {
    "n": "description",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "label": "Description"
   },
   {
    "n": "address",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "label": "Address"
   },
   {
    "n": "postalCode",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 20,
    "label": "Postal Code"
   },
   {
    "n": "cityId",
    "t": "uuid",
    "opt": true,
    "hasDefault": false,
    "label": "City",
    "ref": {
     "group": "shared",
     "path": "cities",
     "display": "name",
     "resource": "City"
    }
   },
   {
    "n": "countryCode",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 2,
    "label": "Country",
    "codeRef": "countries"
   },
   {
    "n": "latitude",
    "t": "decimal",
    "opt": true,
    "hasDefault": false,
    "label": "Latitude"
   },
   {
    "n": "longitude",
    "t": "decimal",
    "opt": true,
    "hasDefault": false,
    "label": "Longitude"
   },
   {
    "n": "checkInTime",
    "t": "time",
    "opt": false,
    "hasDefault": true,
    "label": "Check In Time"
   },
   {
    "n": "checkOutTime",
    "t": "time",
    "opt": false,
    "hasDefault": true,
    "label": "Check Out Time"
   },
   {
    "n": "contactName",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 120,
    "label": "Contact Name"
   },
   {
    "n": "contactEmail",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 254,
    "label": "Contact Email"
   },
   {
    "n": "contactPhone",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 40,
    "label": "Contact Phone"
   },
   {
    "n": "website",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "label": "Website"
   },
   {
    "n": "policies",
    "t": "json",
    "opt": false,
    "hasDefault": true,
    "label": "Policies"
   },
   {
    "n": "currencyCode",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 3,
    "label": "Currency",
    "codeRef": "currencies"
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ],
    "label": "Status"
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
  "children": [
   {
    "path": "room-types",
    "group": "hotel",
    "field": "hotelId",
    "label": "Room types",
    "name": "RoomType"
   }
  ]
 },
 {
  "name": "RoomType",
  "label": "Room Type",
  "plural": "Room types",
  "group": "hotel",
  "path": "room-types",
  "tenant": true,
  "sharedRead": false,
  "display": "name",
  "columns": [
   "code",
   "name",
   "hotelId",
   "basePrice",
   "maxAdults"
  ],
  "search": [
   "code",
   "name"
  ],
  "fields": [
   {
    "n": "hotelId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false,
    "label": "Hotel",
    "ref": {
     "group": "hotel",
     "path": "hotels",
     "display": "name",
     "resource": "Hotel"
    }
   },
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40,
    "label": "Code"
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 150,
    "label": "Name"
   },
   {
    "n": "bedType",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 60,
    "label": "Bed Type"
   },
   {
    "n": "maxAdults",
    "t": "int",
    "opt": false,
    "hasDefault": true,
    "label": "Max Adults"
   },
   {
    "n": "maxChildren",
    "t": "int",
    "opt": false,
    "hasDefault": true,
    "label": "Max Children"
   },
   {
    "n": "sizeM2",
    "t": "decimal",
    "opt": true,
    "hasDefault": false,
    "label": "Size m\u00b2"
   },
   {
    "n": "description",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "label": "Description"
   },
   {
    "n": "basePrice",
    "t": "decimal",
    "opt": false,
    "hasDefault": false,
    "label": "Base Price"
   },
   {
    "n": "currencyCode",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 3,
    "label": "Currency",
    "codeRef": "currencies"
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ],
    "label": "Status"
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
  "children": [
   {
    "path": "rate-plans",
    "group": "hotel",
    "field": "roomTypeId",
    "label": "Rate plans",
    "name": "RatePlan"
   },
   {
    "path": "room-inventory",
    "group": "hotel",
    "field": "roomTypeId",
    "label": "Room inventory",
    "name": "RoomInventory"
   }
  ]
 },
 {
  "name": "RatePlan",
  "label": "Rate Plan",
  "plural": "Rate plans",
  "group": "hotel",
  "path": "rate-plans",
  "tenant": true,
  "sharedRead": false,
  "display": "name",
  "columns": [
   "code",
   "name",
   "mealPlan",
   "roomTypeId",
   "cancellationPolicyId",
   "price",
   "dateFrom"
  ],
  "search": [
   "code",
   "name"
  ],
  "fields": [
   {
    "n": "roomTypeId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false,
    "label": "Room Type",
    "ref": {
     "group": "hotel",
     "path": "room-types",
     "display": "name",
     "resource": "RoomType"
    }
   },
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40,
    "label": "Code"
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 150,
    "label": "Name"
   },
   {
    "n": "dateFrom",
    "t": "date",
    "opt": false,
    "hasDefault": false,
    "label": "Date From"
   },
   {
    "n": "dateTo",
    "t": "date",
    "opt": false,
    "hasDefault": false,
    "label": "Date To"
   },
   {
    "n": "price",
    "t": "decimal",
    "opt": false,
    "hasDefault": false,
    "label": "Price"
   },
   {
    "n": "currencyCode",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 3,
    "label": "Currency",
    "codeRef": "currencies"
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
    ],
    "label": "Meal Plan"
   },
   {
    "n": "cancellationPolicyId",
    "t": "uuid",
    "opt": true,
    "hasDefault": false,
    "label": "Cancellation Policy",
    "ref": {
     "group": "shared",
     "path": "cancellation-policies",
     "display": "name",
     "resource": "CancellationPolicy"
    }
   },
   {
    "n": "minStay",
    "t": "int",
    "opt": false,
    "hasDefault": true,
    "label": "Min Stay"
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ],
    "label": "Status"
   }
  ],
  "sets": [],
  "children": []
 },
 {
  "name": "RoomInventory",
  "label": "Room Inventory",
  "plural": "Room inventory",
  "group": "hotel",
  "path": "room-inventory",
  "tenant": true,
  "sharedRead": false,
  "display": "date",
  "columns": [
   "roomTypeId",
   "date",
   "totalUnits"
  ],
  "search": [],
  "fields": [
   {
    "n": "roomTypeId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false,
    "label": "Room Type",
    "ref": {
     "group": "hotel",
     "path": "room-types",
     "display": "name",
     "resource": "RoomType"
    }
   },
   {
    "n": "date",
    "t": "date",
    "opt": false,
    "hasDefault": false,
    "label": "Date"
   },
   {
    "n": "totalUnits",
    "t": "int",
    "opt": false,
    "hasDefault": false,
    "label": "Total Units"
   },
   {
    "n": "availableUnits",
    "t": "int",
    "opt": false,
    "hasDefault": false,
    "label": "Available Units"
   },
   {
    "n": "stopSell",
    "t": "bool",
    "opt": false,
    "hasDefault": true,
    "label": "Stop Sell"
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ],
    "label": "Status"
   }
  ],
  "sets": [],
  "children": []
 },
 {
  "name": "Trip",
  "label": "Trip",
  "plural": "Trips",
  "group": "trips",
  "path": "trips",
  "tenant": true,
  "sharedRead": false,
  "display": "title",
  "columns": [
   "code",
   "title",
   "difficulty",
   "categoryId",
   "cityId",
   "cancellationPolicyId",
   "durationMinutes"
  ],
  "search": [
   "code",
   "title",
   "location"
  ],
  "fields": [
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40,
    "label": "Code"
   },
   {
    "n": "title",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 200,
    "label": "Title"
   },
   {
    "n": "categoryId",
    "t": "uuid",
    "opt": true,
    "hasDefault": false,
    "label": "Category",
    "ref": {
     "group": "shared",
     "path": "categories",
     "display": "name",
     "resource": "Category"
    }
   },
   {
    "n": "description",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "label": "Description"
   },
   {
    "n": "durationMinutes",
    "t": "int",
    "opt": false,
    "hasDefault": false,
    "label": "Duration Minutes"
   },
   {
    "n": "meetingPoint",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 255,
    "label": "Meeting Point"
   },
   {
    "n": "meetingLatitude",
    "t": "decimal",
    "opt": true,
    "hasDefault": false,
    "label": "Meeting Latitude"
   },
   {
    "n": "meetingLongitude",
    "t": "decimal",
    "opt": true,
    "hasDefault": false,
    "label": "Meeting Longitude"
   },
   {
    "n": "location",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 255,
    "label": "Location"
   },
   {
    "n": "cityId",
    "t": "uuid",
    "opt": true,
    "hasDefault": false,
    "label": "City",
    "ref": {
     "group": "shared",
     "path": "cities",
     "display": "name",
     "resource": "City"
    }
   },
   {
    "n": "countryCode",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 2,
    "label": "Country",
    "codeRef": "countries"
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
    ],
    "label": "Difficulty"
   },
   {
    "n": "minParticipants",
    "t": "int",
    "opt": false,
    "hasDefault": true,
    "label": "Min Participants"
   },
   {
    "n": "maxParticipants",
    "t": "int",
    "opt": true,
    "hasDefault": false,
    "label": "Max Participants"
   },
   {
    "n": "inclusions",
    "t": "array",
    "opt": false,
    "hasDefault": true,
    "label": "Inclusions"
   },
   {
    "n": "exclusions",
    "t": "array",
    "opt": false,
    "hasDefault": true,
    "label": "Exclusions"
   },
   {
    "n": "cancellationPolicyId",
    "t": "uuid",
    "opt": true,
    "hasDefault": false,
    "label": "Cancellation Policy",
    "ref": {
     "group": "shared",
     "path": "cancellation-policies",
     "display": "name",
     "resource": "CancellationPolicy"
    }
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ],
    "label": "Status"
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
  "children": [
   {
    "path": "trip-itinerary-days",
    "group": "trips",
    "field": "tripId",
    "label": "Trip itinerary days",
    "name": "TripItineraryDay"
   },
   {
    "path": "trip-variants",
    "group": "trips",
    "field": "tripId",
    "label": "Trip variants",
    "name": "TripVariant"
   },
   {
    "path": "trip-schedules",
    "group": "trips",
    "field": "tripId",
    "label": "Trip schedules",
    "name": "TripSchedule"
   },
   {
    "path": "trip-addons",
    "group": "trips",
    "field": "tripId",
    "label": "Trip addons",
    "name": "TripAddon"
   }
  ]
 },
 {
  "name": "TripItineraryDay",
  "label": "Trip Itinerary Day",
  "plural": "Trip itinerary days",
  "group": "trips",
  "path": "trip-itinerary-days",
  "tenant": true,
  "sharedRead": false,
  "display": "title",
  "columns": [
   "title",
   "tripId",
   "dayNumber"
  ],
  "search": [
   "title"
  ],
  "fields": [
   {
    "n": "tripId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false,
    "label": "Trip",
    "ref": {
     "group": "trips",
     "path": "trips",
     "display": "title",
     "resource": "Trip"
    }
   },
   {
    "n": "dayNumber",
    "t": "int",
    "opt": false,
    "hasDefault": false,
    "label": "Day Number"
   },
   {
    "n": "title",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 200,
    "label": "Title"
   },
   {
    "n": "description",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "label": "Description"
   },
   {
    "n": "items",
    "t": "json",
    "opt": false,
    "hasDefault": true,
    "label": "Items"
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ],
    "label": "Status"
   }
  ],
  "sets": [],
  "children": []
 },
 {
  "name": "TripVariant",
  "label": "Trip Variant",
  "plural": "Trip variants",
  "group": "trips",
  "path": "trip-variants",
  "tenant": true,
  "sharedRead": false,
  "display": "name",
  "columns": [
   "code",
   "name",
   "tripId",
   "adultPrice",
   "minPax"
  ],
  "search": [
   "code",
   "name"
  ],
  "fields": [
   {
    "n": "tripId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false,
    "label": "Trip",
    "ref": {
     "group": "trips",
     "path": "trips",
     "display": "title",
     "resource": "Trip"
    }
   },
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40,
    "label": "Code"
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 150,
    "label": "Name"
   },
   {
    "n": "description",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "label": "Description"
   },
   {
    "n": "adultPrice",
    "t": "decimal",
    "opt": false,
    "hasDefault": false,
    "label": "Adult Price"
   },
   {
    "n": "childPrice",
    "t": "decimal",
    "opt": true,
    "hasDefault": false,
    "label": "Child Price"
   },
   {
    "n": "currencyCode",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 3,
    "label": "Currency",
    "codeRef": "currencies"
   },
   {
    "n": "minPax",
    "t": "int",
    "opt": false,
    "hasDefault": true,
    "label": "Min Pax"
   },
   {
    "n": "maxPax",
    "t": "int",
    "opt": true,
    "hasDefault": false,
    "label": "Max Pax"
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ],
    "label": "Status"
   }
  ],
  "sets": [],
  "children": []
 },
 {
  "name": "TripSchedule",
  "label": "Trip Schedule",
  "plural": "Trip schedules",
  "group": "trips",
  "path": "trip-schedules",
  "tenant": true,
  "sharedRead": false,
  "display": "date",
  "columns": [
   "tripId",
   "date",
   "startTime",
   "quota"
  ],
  "search": [],
  "fields": [
   {
    "n": "tripId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false,
    "label": "Trip",
    "ref": {
     "group": "trips",
     "path": "trips",
     "display": "title",
     "resource": "Trip"
    }
   },
   {
    "n": "date",
    "t": "date",
    "opt": false,
    "hasDefault": false,
    "label": "Date"
   },
   {
    "n": "startTime",
    "t": "time",
    "opt": false,
    "hasDefault": false,
    "label": "Start Time"
   },
   {
    "n": "endTime",
    "t": "time",
    "opt": true,
    "hasDefault": false,
    "label": "End Time"
   },
   {
    "n": "quota",
    "t": "int",
    "opt": false,
    "hasDefault": false,
    "label": "Quota"
   },
   {
    "n": "remainingQuota",
    "t": "int",
    "opt": false,
    "hasDefault": false,
    "label": "Remaining Quota"
   },
   {
    "n": "cutoffHours",
    "t": "int",
    "opt": false,
    "hasDefault": true,
    "label": "Cutoff Hours"
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ],
    "label": "Status"
   }
  ],
  "sets": [],
  "children": []
 },
 {
  "name": "TripAddon",
  "label": "Trip Addon",
  "plural": "Trip addons",
  "group": "trips",
  "path": "trip-addons",
  "tenant": true,
  "sharedRead": false,
  "display": "name",
  "columns": [
   "code",
   "name",
   "tripId",
   "price"
  ],
  "search": [
   "code",
   "name"
  ],
  "fields": [
   {
    "n": "tripId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false,
    "label": "Trip",
    "ref": {
     "group": "trips",
     "path": "trips",
     "display": "title",
     "resource": "Trip"
    }
   },
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40,
    "label": "Code"
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 150,
    "label": "Name"
   },
   {
    "n": "price",
    "t": "decimal",
    "opt": false,
    "hasDefault": false,
    "label": "Price"
   },
   {
    "n": "currencyCode",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 3,
    "label": "Currency",
    "codeRef": "currencies"
   },
   {
    "n": "perPerson",
    "t": "bool",
    "opt": false,
    "hasDefault": true,
    "label": "Per Person"
   },
   {
    "n": "maxQuantity",
    "t": "int",
    "opt": true,
    "hasDefault": false,
    "label": "Max Quantity"
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ],
    "label": "Status"
   }
  ],
  "sets": [],
  "children": []
 },
 {
  "name": "VehicleType",
  "label": "Vehicle Type",
  "plural": "Vehicle types",
  "group": "transport",
  "path": "vehicle-types",
  "tenant": true,
  "sharedRead": false,
  "display": "name",
  "columns": [
   "code",
   "name",
   "kind",
   "passengerCapacity"
  ],
  "search": [
   "code",
   "name"
  ],
  "fields": [
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40,
    "label": "Code"
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 120,
    "label": "Name"
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
    ],
    "label": "Kind"
   },
   {
    "n": "passengerCapacity",
    "t": "int",
    "opt": false,
    "hasDefault": false,
    "label": "Passenger Capacity"
   },
   {
    "n": "luggageCapacity",
    "t": "int",
    "opt": false,
    "hasDefault": true,
    "label": "Luggage Capacity"
   },
   {
    "n": "description",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "label": "Description"
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ],
    "label": "Status"
   }
  ],
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
  "children": [
   {
    "path": "transport-services",
    "group": "transport",
    "field": "vehicleTypeId",
    "label": "Transport services",
    "name": "TransportService"
   },
   {
    "path": "zone-route-prices",
    "group": "transport",
    "field": "vehicleTypeId",
    "label": "Zone route prices",
    "name": "ZoneRoutePrice"
   },
   {
    "path": "vehicles",
    "group": "transport",
    "field": "vehicleTypeId",
    "label": "Vehicles",
    "name": "Vehicle"
   }
  ]
 },
 {
  "name": "TransportZone",
  "label": "Transport Zone",
  "plural": "Transport zones",
  "group": "transport",
  "path": "transport-zones",
  "tenant": true,
  "sharedRead": false,
  "display": "name",
  "columns": [
   "code",
   "name",
   "cityId"
  ],
  "search": [
   "code",
   "name"
  ],
  "fields": [
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40,
    "label": "Code"
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 150,
    "label": "Name"
   },
   {
    "n": "cityId",
    "t": "uuid",
    "opt": true,
    "hasDefault": false,
    "label": "City",
    "ref": {
     "group": "shared",
     "path": "cities",
     "display": "name",
     "resource": "City"
    }
   },
   {
    "n": "countryCode",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 2,
    "label": "Country",
    "codeRef": "countries"
   },
   {
    "n": "description",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "label": "Description"
   },
   {
    "n": "latitude",
    "t": "decimal",
    "opt": true,
    "hasDefault": false,
    "label": "Latitude"
   },
   {
    "n": "longitude",
    "t": "decimal",
    "opt": true,
    "hasDefault": false,
    "label": "Longitude"
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ],
    "label": "Status"
   }
  ],
  "sets": [],
  "children": [
   {
    "path": "transport-services",
    "group": "transport",
    "field": "originZoneId",
    "label": "Transport services",
    "name": "TransportService"
   },
   {
    "path": "transport-services",
    "group": "transport",
    "field": "destinationZoneId",
    "label": "Transport services",
    "name": "TransportService"
   },
   {
    "path": "zone-route-prices",
    "group": "transport",
    "field": "fromZoneId",
    "label": "Zone route prices",
    "name": "ZoneRoutePrice"
   },
   {
    "path": "zone-route-prices",
    "group": "transport",
    "field": "toZoneId",
    "label": "Zone route prices",
    "name": "ZoneRoutePrice"
   }
  ]
 },
 {
  "name": "TransportService",
  "label": "Transport Service",
  "plural": "Transport services",
  "group": "transport",
  "path": "transport-services",
  "tenant": true,
  "sharedRead": false,
  "display": "name",
  "columns": [
   "code",
   "name",
   "serviceType",
   "originZoneId",
   "destinationZoneId",
   "vehicleTypeId",
   "price"
  ],
  "search": [
   "code",
   "name",
   "originLabel",
   "destinationLabel"
  ],
  "fields": [
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40,
    "label": "Code"
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 200,
    "label": "Name"
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
    ],
    "label": "Service Type"
   },
   {
    "n": "originZoneId",
    "t": "uuid",
    "opt": true,
    "hasDefault": false,
    "label": "Origin Zone",
    "ref": {
     "group": "transport",
     "path": "transport-zones",
     "display": "name",
     "resource": "TransportZone"
    }
   },
   {
    "n": "destinationZoneId",
    "t": "uuid",
    "opt": true,
    "hasDefault": false,
    "label": "Destination Zone",
    "ref": {
     "group": "transport",
     "path": "transport-zones",
     "display": "name",
     "resource": "TransportZone"
    }
   },
   {
    "n": "originLabel",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 200,
    "label": "Origin Label"
   },
   {
    "n": "destinationLabel",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 200,
    "label": "Destination Label"
   },
   {
    "n": "vehicleTypeId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false,
    "label": "Vehicle Type",
    "ref": {
     "group": "transport",
     "path": "vehicle-types",
     "display": "name",
     "resource": "VehicleType"
    }
   },
   {
    "n": "price",
    "t": "decimal",
    "opt": false,
    "hasDefault": false,
    "label": "Price"
   },
   {
    "n": "currencyCode",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 3,
    "label": "Currency",
    "codeRef": "currencies"
   },
   {
    "n": "durationMinutes",
    "t": "int",
    "opt": true,
    "hasDefault": false,
    "label": "Duration Minutes"
   },
   {
    "n": "driverIncluded",
    "t": "bool",
    "opt": false,
    "hasDefault": true,
    "label": "Driver Included"
   },
   {
    "n": "description",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "label": "Description"
   },
   {
    "n": "cancellationPolicyId",
    "t": "uuid",
    "opt": true,
    "hasDefault": false,
    "label": "Cancellation Policy",
    "ref": {
     "group": "shared",
     "path": "cancellation-policies",
     "display": "name",
     "resource": "CancellationPolicy"
    }
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ],
    "label": "Status"
   }
  ],
  "sets": [],
  "children": []
 },
 {
  "name": "ZoneRoutePrice",
  "label": "Zone Route Price",
  "plural": "Zone route prices",
  "group": "transport",
  "path": "zone-route-prices",
  "tenant": true,
  "sharedRead": false,
  "display": null,
  "columns": [
   "fromZoneId",
   "toZoneId",
   "vehicleTypeId",
   "price"
  ],
  "search": [],
  "fields": [
   {
    "n": "fromZoneId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false,
    "label": "From Zone",
    "ref": {
     "group": "transport",
     "path": "transport-zones",
     "display": "name",
     "resource": "TransportZone"
    }
   },
   {
    "n": "toZoneId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false,
    "label": "To Zone",
    "ref": {
     "group": "transport",
     "path": "transport-zones",
     "display": "name",
     "resource": "TransportZone"
    }
   },
   {
    "n": "vehicleTypeId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false,
    "label": "Vehicle Type",
    "ref": {
     "group": "transport",
     "path": "vehicle-types",
     "display": "name",
     "resource": "VehicleType"
    }
   },
   {
    "n": "price",
    "t": "decimal",
    "opt": false,
    "hasDefault": false,
    "label": "Price"
   },
   {
    "n": "currencyCode",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 3,
    "label": "Currency",
    "codeRef": "currencies"
   },
   {
    "n": "durationMinutes",
    "t": "int",
    "opt": true,
    "hasDefault": false,
    "label": "Duration Minutes"
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ],
    "label": "Status"
   }
  ],
  "sets": [],
  "children": []
 },
 {
  "name": "Driver",
  "label": "Driver",
  "plural": "Drivers",
  "group": "transport",
  "path": "drivers",
  "tenant": true,
  "sharedRead": false,
  "display": "name",
  "columns": [
   "code",
   "name"
  ],
  "search": [
   "code",
   "name",
   "licenseNumber",
   "email",
   "phone"
  ],
  "fields": [
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40,
    "label": "Code"
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 150,
    "label": "Name"
   },
   {
    "n": "phone",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40,
    "label": "Phone"
   },
   {
    "n": "email",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 254,
    "label": "Email"
   },
   {
    "n": "licenseNumber",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 60,
    "label": "License Number"
   },
   {
    "n": "licenseExpiry",
    "t": "date",
    "opt": true,
    "hasDefault": false,
    "label": "License Expiry"
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ],
    "label": "Status"
   }
  ],
  "sets": [],
  "children": [
   {
    "path": "vehicles",
    "group": "transport",
    "field": "driverId",
    "label": "Vehicles",
    "name": "Vehicle"
   }
  ]
 },
 {
  "name": "Vehicle",
  "label": "Vehicle",
  "plural": "Vehicles",
  "group": "transport",
  "path": "vehicles",
  "tenant": true,
  "sharedRead": false,
  "display": "plateNumber",
  "columns": [
   "plateNumber",
   "vehicleTypeId",
   "driverId"
  ],
  "search": [
   "plateNumber"
  ],
  "fields": [
   {
    "n": "vehicleTypeId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false,
    "label": "Vehicle Type",
    "ref": {
     "group": "transport",
     "path": "vehicle-types",
     "display": "name",
     "resource": "VehicleType"
    }
   },
   {
    "n": "plateNumber",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 20,
    "label": "Plate Number"
   },
   {
    "n": "make",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 60,
    "label": "Make"
   },
   {
    "n": "model",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 60,
    "label": "Model"
   },
   {
    "n": "year",
    "t": "int",
    "opt": true,
    "hasDefault": false,
    "label": "Year"
   },
   {
    "n": "color",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 40,
    "label": "Color"
   },
   {
    "n": "driverId",
    "t": "uuid",
    "opt": true,
    "hasDefault": false,
    "label": "Driver",
    "ref": {
     "group": "transport",
     "path": "drivers",
     "display": "name",
     "resource": "Driver"
    }
   },
   {
    "n": "insuranceExpiry",
    "t": "date",
    "opt": true,
    "hasDefault": false,
    "label": "Insurance Expiry"
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ],
    "label": "Status"
   }
  ],
  "sets": [],
  "children": []
 },
 {
  "name": "Club",
  "label": "Club",
  "plural": "Clubs",
  "group": "club",
  "path": "clubs",
  "tenant": true,
  "sharedRead": false,
  "display": "name",
  "columns": [
   "code",
   "name",
   "venueKind",
   "categoryId",
   "cityId",
   "minimumAge"
  ],
  "search": [
   "code",
   "name",
   "email",
   "phone",
   "address"
  ],
  "fields": [
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40,
    "label": "Code"
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 200,
    "label": "Name"
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
    ],
    "label": "Venue Kind"
   },
   {
    "n": "categoryId",
    "t": "uuid",
    "opt": true,
    "hasDefault": false,
    "label": "Category",
    "ref": {
     "group": "shared",
     "path": "categories",
     "display": "name",
     "resource": "Category"
    }
   },
   {
    "n": "description",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "label": "Description"
   },
   {
    "n": "address",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "label": "Address"
   },
   {
    "n": "cityId",
    "t": "uuid",
    "opt": true,
    "hasDefault": false,
    "label": "City",
    "ref": {
     "group": "shared",
     "path": "cities",
     "display": "name",
     "resource": "City"
    }
   },
   {
    "n": "countryCode",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 2,
    "label": "Country",
    "codeRef": "countries"
   },
   {
    "n": "latitude",
    "t": "decimal",
    "opt": true,
    "hasDefault": false,
    "label": "Latitude"
   },
   {
    "n": "longitude",
    "t": "decimal",
    "opt": true,
    "hasDefault": false,
    "label": "Longitude"
   },
   {
    "n": "phone",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 40,
    "label": "Phone"
   },
   {
    "n": "email",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 254,
    "label": "Email"
   },
   {
    "n": "dressCode",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "max": 255,
    "label": "Dress Code"
   },
   {
    "n": "minimumAge",
    "t": "int",
    "opt": false,
    "hasDefault": true,
    "label": "Minimum Age"
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ],
    "label": "Status"
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
  "children": [
   {
    "path": "club-opening-hours",
    "group": "club",
    "field": "clubId",
    "label": "Club opening hours",
    "name": "ClubOpeningHour"
   },
   {
    "path": "club-ticket-types",
    "group": "club",
    "field": "clubId",
    "label": "Club ticket types",
    "name": "ClubTicketType"
   },
   {
    "path": "club-table-packages",
    "group": "club",
    "field": "clubId",
    "label": "Club table packages",
    "name": "ClubTablePackage"
   },
   {
    "path": "club-events",
    "group": "club",
    "field": "clubId",
    "label": "Club events",
    "name": "ClubEvent"
   }
  ]
 },
 {
  "name": "ClubOpeningHour",
  "label": "Club Opening Hour",
  "plural": "Club opening hours",
  "group": "club",
  "path": "club-opening-hours",
  "tenant": true,
  "sharedRead": false,
  "display": null,
  "columns": [
   "clubId",
   "weekday"
  ],
  "search": [],
  "fields": [
   {
    "n": "clubId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false,
    "label": "Club",
    "ref": {
     "group": "club",
     "path": "clubs",
     "display": "name",
     "resource": "Club"
    }
   },
   {
    "n": "weekday",
    "t": "int",
    "opt": false,
    "hasDefault": false,
    "label": "Weekday"
   },
   {
    "n": "opensAt",
    "t": "time",
    "opt": true,
    "hasDefault": false,
    "label": "Opens At"
   },
   {
    "n": "closesAt",
    "t": "time",
    "opt": true,
    "hasDefault": false,
    "label": "Closes At"
   },
   {
    "n": "isClosed",
    "t": "bool",
    "opt": false,
    "hasDefault": true,
    "label": "Is Closed"
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ],
    "label": "Status"
   }
  ],
  "sets": [],
  "children": []
 },
 {
  "name": "ClubTicketType",
  "label": "Club Ticket Type",
  "plural": "Club ticket types",
  "group": "club",
  "path": "club-ticket-types",
  "tenant": true,
  "sharedRead": false,
  "display": "name",
  "columns": [
   "code",
   "name",
   "clubId",
   "price"
  ],
  "search": [
   "code",
   "name"
  ],
  "fields": [
   {
    "n": "clubId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false,
    "label": "Club",
    "ref": {
     "group": "club",
     "path": "clubs",
     "display": "name",
     "resource": "Club"
    }
   },
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40,
    "label": "Code"
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 150,
    "label": "Name"
   },
   {
    "n": "description",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "label": "Description"
   },
   {
    "n": "price",
    "t": "decimal",
    "opt": false,
    "hasDefault": false,
    "label": "Price"
   },
   {
    "n": "currencyCode",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 3,
    "label": "Currency",
    "codeRef": "currencies"
   },
   {
    "n": "inclusions",
    "t": "array",
    "opt": false,
    "hasDefault": true,
    "label": "Inclusions"
   },
   {
    "n": "quota",
    "t": "int",
    "opt": true,
    "hasDefault": false,
    "label": "Quota"
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ],
    "label": "Status"
   }
  ],
  "sets": [],
  "children": []
 },
 {
  "name": "ClubTablePackage",
  "label": "Club Table Package",
  "plural": "Club table packages",
  "group": "club",
  "path": "club-table-packages",
  "tenant": true,
  "sharedRead": false,
  "display": "name",
  "columns": [
   "code",
   "name",
   "clubId",
   "minimumSpend",
   "capacity"
  ],
  "search": [
   "code",
   "name"
  ],
  "fields": [
   {
    "n": "clubId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false,
    "label": "Club",
    "ref": {
     "group": "club",
     "path": "clubs",
     "display": "name",
     "resource": "Club"
    }
   },
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40,
    "label": "Code"
   },
   {
    "n": "name",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 150,
    "label": "Name"
   },
   {
    "n": "capacity",
    "t": "int",
    "opt": false,
    "hasDefault": false,
    "label": "Capacity"
   },
   {
    "n": "minimumSpend",
    "t": "decimal",
    "opt": false,
    "hasDefault": false,
    "label": "Minimum Spend"
   },
   {
    "n": "price",
    "t": "decimal",
    "opt": false,
    "hasDefault": false,
    "label": "Price"
   },
   {
    "n": "currencyCode",
    "t": "char",
    "opt": false,
    "hasDefault": false,
    "max": 3,
    "label": "Currency",
    "codeRef": "currencies"
   },
   {
    "n": "inclusions",
    "t": "array",
    "opt": false,
    "hasDefault": true,
    "label": "Inclusions"
   },
   {
    "n": "quota",
    "t": "int",
    "opt": true,
    "hasDefault": false,
    "label": "Quota"
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ],
    "label": "Status"
   }
  ],
  "sets": [],
  "children": []
 },
 {
  "name": "ClubEvent",
  "label": "Club Event",
  "plural": "Club events",
  "group": "club",
  "path": "club-events",
  "tenant": true,
  "sharedRead": false,
  "display": "title",
  "columns": [
   "code",
   "title",
   "clubId",
   "eventDate"
  ],
  "search": [
   "code",
   "title"
  ],
  "fields": [
   {
    "n": "clubId",
    "t": "uuid",
    "opt": false,
    "hasDefault": false,
    "label": "Club",
    "ref": {
     "group": "club",
     "path": "clubs",
     "display": "name",
     "resource": "Club"
    }
   },
   {
    "n": "code",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 40,
    "label": "Code"
   },
   {
    "n": "title",
    "t": "string",
    "opt": false,
    "hasDefault": false,
    "max": 200,
    "label": "Title"
   },
   {
    "n": "eventDate",
    "t": "date",
    "opt": false,
    "hasDefault": false,
    "label": "Event Date"
   },
   {
    "n": "startTime",
    "t": "time",
    "opt": true,
    "hasDefault": false,
    "label": "Start Time"
   },
   {
    "n": "endTime",
    "t": "time",
    "opt": true,
    "hasDefault": false,
    "label": "End Time"
   },
   {
    "n": "lineup",
    "t": "array",
    "opt": false,
    "hasDefault": true,
    "label": "Lineup"
   },
   {
    "n": "description",
    "t": "string",
    "opt": true,
    "hasDefault": false,
    "label": "Description"
   },
   {
    "n": "specialPrice",
    "t": "decimal",
    "opt": true,
    "hasDefault": false,
    "label": "Special Price"
   },
   {
    "n": "currencyCode",
    "t": "char",
    "opt": true,
    "hasDefault": false,
    "max": 3,
    "label": "Currency",
    "codeRef": "currencies"
   },
   {
    "n": "quota",
    "t": "int",
    "opt": true,
    "hasDefault": false,
    "label": "Quota"
   },
   {
    "n": "status",
    "t": "enum",
    "opt": false,
    "hasDefault": true,
    "values": [
     "ACTIVE",
     "INACTIVE"
    ],
    "label": "Status"
   }
  ],
  "sets": [],
  "children": []
 }
];
