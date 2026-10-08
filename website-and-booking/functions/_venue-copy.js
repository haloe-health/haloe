// The Milton Hall arrival wording for the Functions — the single source is ../venue-copy.js (a classic script that defines
// VENUE_COPY on the global object; booking-confirmed.html loads the very same file). Change the words there. The `_`
// prefix keeps this file from becoming a route.
import '../venue-copy.js';
export const VENUE_COPY = globalThis.VENUE_COPY;
