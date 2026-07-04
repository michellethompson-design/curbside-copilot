// Single source of truth for the public-facing product name.
// Codename during development was "ABCD". The public name lives here so it can
// be changed in exactly one place without touching the rest of the codebase.
export const BRAND = {
  name: 'Fresh Eyes',
  tagline: 'A cold, outside-eye QA pass for your design assets.',
  // The three detection categories, in the clinical framing from the taxonomy.
  categories: ['phallic', 'vulvar', 'breast'],
};

export default BRAND;
