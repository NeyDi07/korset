# 2026-05-03 — V1 unknown EAN request flow

## Summary

Implemented the first V1 slice of the unknown EAN flow without touching the central i18n migration files.

## Decisions preserved

- No 100-point product score in V1.
- No public ratings or general feedback system in V1.
- ProductScreen stays focused on scan outcome and Fit-Check, not trust-score/source-badge UI.
- Unknown EAN is handled as a product coverage request, not as an AI guess.
- Alcohol and tobacco are mentioned only in the general unsupported/not-found state. The app must not claim an unknown barcode is alcohol unless the category is known.

## Implementation

- Added `src/domain/product/unknownEanRequest.js`.
- Added `tests/unit/unknownEanRequest.test.mjs`.
- Updated ProductScreen not-found state:
  - shows a clear not-found message;
  - mentions alcohol/tobacco are unsupported;
  - shows scanned EAN;
  - offers "Request product check" when EAN and store id are valid;
  - calls existing Supabase RPC `increment_missing_scan_count`.

## Notes

- Existing resolver already logs missing scans through `missing_products`; the explicit request button adds an intentional user signal using the same RPC.
- Central language files were not edited because a separate i18n migration is in progress.
- For later cleanup, move the temporary local copy from `unknownEanRequest.js` into the new i18n structure after that migration lands.

## Verification

- `node --test tests/unit/unknownEanRequest.test.mjs` — passed.
- `npm run build` — passed.
- `npm run lint` — failed due existing/parallel i18n work outside this slice: `src/main.jsx`, `src/screens/CatalogScreen.jsx`, `src/screens/CompareScreen.jsx`, plus existing warnings.
