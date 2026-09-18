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
    { day: 'monday', label: 'Monday', value: '6:00 AM–11:00 PM', open: '06:00', close: '23:00', closed: false },
    { day: 'tuesday', label: 'Tuesday', value: '6:00 AM–11:00 PM', open: '06:00', close: '23:00', closed: false },
    { day: 'wednesday', label: 'Wednesday', value: '6:00 AM–11:00 PM', open: '06:00', close: '23:00', closed: false },
    { day: 'thursday', label: 'Thursday', value: '6:00 AM–11:00 PM', open: '06:00', close: '23:00', closed: false },
    { day: 'friday', label: 'Friday', value: '7:00 AM–9:00 PM', open: '07:00', close: '21:00', closed: false },
    { day: 'saturday', label: 'Saturday', value: '6:00 AM–10:00 PM', open: '06:00', close: '22:00', closed: false },
    { day: 'sunday', label: 'Sunday', value: 'Closed', open: null, close: null, closed: true },
  ],
};

/**
 * PLANS and CLUB are seed-matching fallbacks. The live values come from the
 * `plans` and `club_config` tables via `usePlans()` and `useClub()`.
 */
