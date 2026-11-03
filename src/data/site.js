// All photography comes from Lorem Picsum (free Unsplash photos). Swap `id` for your own images later.
export const photo = (id, w = 1600, h = 1067) => `https://picsum.photos/id/${id}/${w}/${h}`;

export const STUDIO = {
  name: 'Lumen',
  tagline: 'Light, kept.',
  email: 'hello@lumen.studio',
  phone: '+351 21 000 0140',
  address: ['Rua da Luz 14', '1200-123 Lisbon, Portugal'],
  hours: 'Mon–Fri · 9am–6pm',
  timezone: 'Europe/Lisbon',
  city: 'Lisbon'
};

export const HERO = [
  { id: 177, title: 'Into the mist', place: 'Dolomites, Italy' },
  { id: 196, title: 'Dune line', place: 'Erg Chebbi, Morocco' },
  { id: 110, title: 'Last light', place: 'Val d’Orcia, Italy' }
];

// orientation: 'p' = portrait, 'l' = landscape
export const WORK = [
  { id: 64, title: 'Golden field', place: 'Provence', year: 2026, cat: 'Portrait', o: 'p' },
  { id: 43, title: 'After dark', place: 'Brooklyn', year: 2025, cat: 'City', o: 'l' },
  { id: 58, title: 'The keeper', place: 'Cornwall', year: 2025, cat: 'Landscape', o: 'p' },
  { id: 164, title: 'Canal houses', place: 'Bruges', year: 2026, cat: 'Travel', o: 'l' },
  { id: 133, title: 'Twins', place: 'Lisbon', year: 2024, cat: 'Editorial', o: 'p' },
  { id: 122, title: 'Blue hour', place: 'London', year: 2025, cat: 'City', o: 'l' },
  { id: 29, title: 'High passes', place: 'Patagonia', year: 2026, cat: 'Landscape', o: 'p' },
  { id: 129, title: 'Evening, together', place: 'Copenhagen', year: 2024, cat: 'Story', o: 'l' }
];

export const SERVICES = [
  { name: 'Portraits', id: 65, note: 'People, in their own light' },
  { name: 'Landscape', id: 16, note: 'Coastlines, ridges, weather' },
  { name: 'Architecture', id: 193, note: 'Buildings and the space between' },
  { name: 'Editorial', id: 21, note: 'Stories for print and screen' },
  { name: 'Travel', id: 49, note: 'Assignments, anywhere' }
];

export const STATS = [
  { n: 12, suffix: '', label: 'Years behind the lens' },
  { n: 38, suffix: '', label: 'Countries photographed' },
  { n: 240, suffix: '+', label: 'Commissions delivered' },
  { n: 1, suffix: '', label: 'Obsession: good light' }
];

export const CLIENTS = ['Northbound Magazine', 'Atelier Rue', 'Field & Form', 'Saltwater Hotels', 'Kestrel Press', 'Maison Oaky', 'The Slow Journal', 'Arbor Studio'];

export const TEAM = [
  { name: 'Elias Varga', role: 'Founder & photographer', id: 91 },
  { name: 'Noor Halim', role: 'Producer', id: 65 },
  { name: 'Theo Brandt', role: 'Retoucher & print', id: 203 }
];

export const PROCESS = [
  { n: '01', title: 'Scout', text: 'We walk the location before the light does, and know where it will fall.', id: 27 },
  { n: '02', title: 'Wait', text: 'Good light is mostly patience. We plan the day around twenty perfect minutes.', id: 172 },
  { n: '03', title: 'Frame', text: 'Fewer frames, chosen carefully. We would rather miss a shot than force one.', id: 47 },
  { n: '04', title: 'Develop', text: 'Every image is edited by hand, then proofed on paper before it reaches you.', id: 48 }
];

export const SOCIAL = [
  { name: 'Instagram', href: '#' },
  { name: 'Behance', href: '#' },
  { name: 'Vimeo', href: '#' }
];
