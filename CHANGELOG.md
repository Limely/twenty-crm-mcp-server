# Changelog

## 0.2.1 (Unreleased)

### Fixed
- **BREAKING FIX**: Corrected field schemas for EMAILS, PHONES, and ADDRESS to match Twenty CRM's actual API structure
  - EMAILS now uses `primaryEmail` and `additionalEmails` structure instead of array
  - PHONES now uses `primaryPhoneNumber`, `primaryPhoneCallingCode`, `primaryPhoneCountryCode`, and `additionalPhones` structure instead of array
  - ADDRESS now uses Twenty's prefixed property names (`addressStreet1`, `addressCity`, `addressPostcode`, etc.) instead of standard names (`street1`, `city`, `postalCode`, etc.)
- Added automatic normalization for EMAILS, PHONES, ADDRESS, and LINKS fields so simple values (strings) are automatically converted to the correct structure
  - Email string → `{ primaryEmail: "...", additionalEmails: null }`
  - Phone string → `{ primaryPhoneNumber: "...", primaryPhoneCallingCode: "", primaryPhoneCountryCode: "", additionalPhones: null }`
  - Address string → `{ addressStreet1: "...", addressCity: "", ... }`
  - URL string → `{ primaryLinkUrl: "...", primaryLinkLabel: "", secondaryLinks: null }`
- Added support for converting standard address formats (street1, city, postalCode) to Twenty's format automatically

## 0.2.0
- Added automatic schema discovery (uses `./schema` export by default, still respects `SCHEMA_PATH`)
- Generate CRUD tools dynamically from exported metadata, including required fields and defaults
- Added helper tools for metadata inspection and GraphQL operation listings
- Improved payload sanitization and filtering for list operations
- Fallback registry keeps core CRUD tools available even without local schema files
- Schema changes auto-reload without restart and enrich complex field schemas (addresses, currency, full name, relations, etc.)
- Relation fields now map to convenient `*Id`/`*Ids` aliases so cross-object links (e.g., person → company) work seamlessly
- Added support for `noteTargets` objects, contextual error hints, schema reload notifications, and a lightweight `npm test` suite
- Better error reporting with HTTP details, pagination summaries on list responses, and weighted multi-object search support

## 0.1.0
- Initial release with manual tool definitions for core Twenty CRM objects
