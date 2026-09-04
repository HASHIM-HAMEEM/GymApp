import type { Plan, Club } from './types';

export const PLANS: Plan[] = [
  {
    id: 'premium-monthly',
    name: 'Premium Monthly',
    duration: 1,
    priceEGP: 1500,
    blurb: 'Full floor, studio & recovery access',
  },
  {
    id: 'three-month',
    name: '3-Month Plan',
    duration: 3,
    priceEGP: 4050,
    blurb: 'Same access · saves EGP 450',
  },
  {
    id: 'premium-quarterly',
    name: 'Premium Quarterly',
    duration: 3,
    priceEGP: 4050,
    blurb: 'Same access · saves EGP 450',
  },
  {
    id: 'annual',
    name: 'Annual Membership',
    duration: 12,
    priceEGP: 15000,
    blurb: 'Same access · two months free',
  },
];

export function planById(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id || p.name === id);
}

export function planByName(name: string): Plan | undefined {
  return PLANS.find((p) => p.name === name);
}

export const CLUB: Club = {
  name: 'Meridian Athletic Club',
  address: '14 El-Nakhil St., Nasser City',
  city: 'Cairo',
  phone: '+20 2 2619 4400',
  hours: [
    { label: 'Mon–Thu', value: '6 AM–11 PM' },
    { label: 'Fri', value: '7 AM–9 PM' },
    { label: 'Sat', value: '6 AM–10 PM' },
  ],
};

/**
 * PLANS and CLUB are seed-matching fallbacks. The live values come from the
 * `plans` and `club_config` tables via `usePlans()` and `useClub()`.
 */
