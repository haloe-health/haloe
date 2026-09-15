// Weekly Clinic Day config — the single source of truth for the Functions.
// book.html and index.html duplicate these same values (browser JS can't
// import this module), so keep them in step by hand.
export const CLINIC_VENUE_NAME = 'Milton Hall, Deansgate';
export const CLINIC_VENUE_ADDRESS = 'Milton Hall, 3rd Floor, 244 Deansgate, Manchester M3 4BQ';
export const CLINIC_WEEKDAY = 2; // 0=Sunday ... 6=Saturday. 2 = Tuesday.
export const CLINIC_SLOT_TEMPLATE = ['09:30', '11:15', '13:00', '14:45', '16:30', '18:15'];
// First bookable clinic day, confirmed by Halima after her venue viewing.
export const CLINIC_START_DATE = '2026-09-29';
