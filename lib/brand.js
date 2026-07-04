// Single source of truth for the public-facing product name.
// Public name is the clinical acronym "ABCD" — deliberately never spelled out.
// The full codename expansion is kept out of this repo's git history.
// Change `name`/`tagline` here to rebrand; nothing else references them.
export const BRAND = {
  name: 'ABCD',
  tagline: 'A cold, outside-eye QA pass for your design assets.',
  // The three detection categories, in the clinical framing from the taxonomy.
  categories: ['phallic', 'vulvar', 'breast'],
};

export default BRAND;
