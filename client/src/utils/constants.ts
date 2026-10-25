/** Gig categories offered in forms (filters read live categories from the API). */
export const GIG_CATEGORIES = [
  'Web Development',
  'Mobile Development',
  'UI/UX Design',
  'Data Science & AI',
  'DevOps & Cloud',
  'Cyber Security',
  'Blockchain & Web3',
  'Digital Marketing',
  'Writing & Translation',
  'Video & Animation',
  'Customer Support',
] as const;

/** Major Indian cities with coordinates ([lng, lat]) so location works without a paid geocoder. */
export const CITIES: { name: string; state: string; coordinates: [number, number] }[] = [
  { name: 'Bengaluru', state: 'Karnataka', coordinates: [77.5946, 12.9716] },
  { name: 'Mumbai', state: 'Maharashtra', coordinates: [72.8777, 19.076] },
  { name: 'Delhi', state: 'Delhi', coordinates: [77.209, 28.6139] },
  { name: 'Hyderabad', state: 'Telangana', coordinates: [78.4867, 17.385] },
  { name: 'Chennai', state: 'Tamil Nadu', coordinates: [80.2707, 13.0827] },
  { name: 'Pune', state: 'Maharashtra', coordinates: [73.8567, 18.5204] },
  { name: 'Kolkata', state: 'West Bengal', coordinates: [88.3639, 22.5726] },
  { name: 'Ahmedabad', state: 'Gujarat', coordinates: [72.5714, 23.0225] },
  { name: 'Jaipur', state: 'Rajasthan', coordinates: [75.7873, 26.9124] },
  { name: 'Kochi', state: 'Kerala', coordinates: [76.2673, 9.9312] },
  { name: 'Chandigarh', state: 'Chandigarh', coordinates: [76.7794, 30.7333] },
  { name: 'Indore', state: 'Madhya Pradesh', coordinates: [75.8577, 22.7196] },
];

/** Nearest listed city to a coordinate (used to label browser geolocation). */
export const nearestCity = ([lng, lat]: [number, number]) =>
  CITIES.reduce((best, city) => {
    const d = (c: (typeof CITIES)[number]) => (c.coordinates[0] - lng) ** 2 + (c.coordinates[1] - lat) ** 2;
    return d(city) < d(best) ? city : best;
  });
