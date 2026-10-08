// The aftercare wording for the Functions — the single source is ../aftercare-copy.js (a classic script that defines
// AFTERCARE_COPY on the global object; the client app loads the very same file). Change the words there. The `_` prefix
// keeps this file from becoming a route.
import '../aftercare-copy.js';
export const AFTERCARE_COPY = globalThis.AFTERCARE_COPY;
