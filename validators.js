// Client-side validation. Firestore rules repeat the critical checks server-side.
export const V = {
  required: v => (v === undefined || v === null || String(v).trim() === '') ? 'This field is required.' : null,
  email: v => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? null : 'Enter a valid email address.',
  // International format: +263 77 123 4567 (7–15 digits)
  phone: v => !v || /^\+?[0-9 ()-]{7,20}$/.test(v) && v.replace(/\D/g, '').length >= 7 && v.replace(/\D/g, '').length <= 15 ? null : 'Enter a valid phone number, e.g. +263 77 123 4567.',
  registration: v => !v || /^[A-Z0-9][A-Z0-9 -]{2,13}$/i.test(v.trim()) ? null : 'Use letters, numbers, spaces or hyphens (3–15 characters).',
  year: v => { if (v === '' || v == null) return null; const n = Number(v); return Number.isInteger(n) && n >= 1980 && n <= new Date().getFullYear() + 1 ? null : 'Enter a valid year.'; },
  nonNegative: v => v === '' || v == null || (Number(v) >= 0 && Number.isFinite(Number(v))) ? null : 'Enter a number of 0 or more.',
  date: v => !v || !isNaN(Date.parse(v)) ? null : 'Enter a valid date.',
  id: v => !v || /^[A-Za-z0-9-]{2,20}$/.test(v) ? null : 'Use 2–20 letters, numbers or hyphens.'
};
