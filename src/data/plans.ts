import type { Plan, Club } from './types';

export const PLANS: Plan[] = [
  {
    id: 'premium-monthly',
    name: 'Premium Monthly',
    duration: 1,
    price: 2499,
    currency: 'INR',
    blurb: 'Full floor, studio & recovery access',
  },
  {
    id: 'three-month',
    name: '3-Month Plan',
    duration: 3,
    price: 6999,
    currency: 'INR',
    blurb: 'Same access · saves ₹500',
  },
  {
    id: 'premium-quarterly',
    name: 'Premium Quarterly',
    duration: 3,
    price: 6999,
    currency: 'INR',
    blurb: 'Same access · saves ₹500',
  },
  {
    id: 'annual',
    name: 'Annual Membership',
    duration: 12,
    price: 23999,
    currency: 'INR',
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
  name: 'Apex Athletic Club',
  address: '',
  city: '',
  phone: '',
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
