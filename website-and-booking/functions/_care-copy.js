// The "Modesty and care" wording for the Functions — the single source is ../care-copy.js (a classic script that defines
// CARE_COPY on the global object; book.html and intake.html load the very same file). Change the words there. The `_`
// prefix keeps this file from becoming a route.
import '../care-copy.js';
export const CARE_COPY = globalThis.CARE_COPY;
