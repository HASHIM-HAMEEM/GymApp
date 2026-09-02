import type { Member, Notice, Visit, ActivityEntry } from './types';

/** Build a visit list — n visits in the current month, descending. */
function visits(rows: [number, string, 'A' | 'B'][]): Visit[] {
  return rows.map(([day, time, reception], i) => ({
    id: `v-${i}`,
    date: `2026-09-${String(day).padStart(2, '0')}`,
    time,
    reception,
  }));
}

const laylaVisits = visits([
  [20, '7:32 PM', 'A'],
  [18, '8:05 AM', 'A'],
  [15, '7:14 PM', 'B'],
  [12, '6:48 PM', 'A'],
  [9, '9:02 AM', 'A'],
  [6, '7:37 PM', 'B'],
  [4, '8:11 AM', 'A'],
  [1, '6:55 PM', 'A'],
]);

const nasserVisits = visits([
  [18, '6:41 PM', 'A'],
  [15, '7:02 PM', 'A'],
  [13, '9:15 AM', 'B'],
  [10, '6:58 PM', 'A'],
  [7, '8:03 PM', 'A'],
  [5, '10:22 AM', 'B'],
  [2, '7:44 PM', 'A'],
]);

export const MEMBERS: Member[] = [
  {
    id: 'MRD-2481',
    firstName: 'Layla',
    lastName: 'Hassan',
    phone: '+20 10 2748 8531',
    email: 'layla.hassan@gmail.com',
    dateOfBirth: '15 Mar 1998',
    emergencyName: 'Marwa Hassan',
    emergencyPhone: '+20 12 735 4402',
    aadharNumber: '2748 8531 1234',
    address: '12 El-Nasr St., Maadi, Cairo',
    memberSince: 'Mar 2024',
    membership: {
      planId: 'premium-monthly',
      planName: 'Premium Monthly',
      startDate: '2026-08-25',
      expiryDate: '2026-10-24',
      status: 'active',
      payment: { method: 'InstaPay', state: 'Paid', date: '2026-08-25', amountEGP: 1500 },
      consecutiveYears: 3,
    },
    visits: laylaVisits,
    activity: [
      {
        id: 'a1',
        kind: 'checkin',
        text: 'Checked in at Reception A',
        at: '2026-09-20T19:32',
      },
      {
        id: 'a2',
        kind: 'membership',
        text: 'Membership renewed on Premium Monthly · payment recorded via InstaPay',
        at: '2026-08-25T10:14',
        author: 'Sarah Kamal',
      },
      {
        id: 'a3',
        kind: 'create',
        text: 'Member created at reception. Welcome message sent by SMS',
        at: '2024-03-12T11:02',
        author: 'Sarah Kamal',
      },
    ],
  },
  {
    id: 'MRD-2503',
    firstName: 'Nasser',
    lastName: 'Aziz',
    phone: '+20 10 5521 3307',
    email: 'nasser.aziz@outlook.com',
    emergencyName: 'Aziza Nasser',
    emergencyPhone: '+20 12 0074 5521',
    aadharNumber: '5521 3307 5678',
    address: 'Building 5, Zamalek, Cairo',
    memberSince: 'Jan 2026',
    membership: {
      planId: 'premium-monthly',
      planName: 'Premium Monthly',
      startDate: '2026-08-24',
      expiryDate: '2026-09-23',
      status: 'expiring',
      payment: { method: 'Cash', state: 'Paid', date: '2026-08-24', amountEGP: 1500 },
    },
    visits: nasserVisits,
    activity: [
      {
        id: 'n1',
        kind: 'checkin',
        text: 'Checked in at Reception A',
        at: '2026-09-18T18:41',
      },
      {
        id: 'n2',
        kind: 'membership',
        text: 'Membership started on Premium Monthly · payment recorded as cash',
        at: '2026-08-24T09:30',
        author: 'Sarah Kamal',
      },
      {
        id: 'n3',
        kind: 'create',
        text: 'Member created at reception. Welcome message sent by SMS',
        at: '2026-08-22T15:10',
        author: 'Sarah Kamal',
      },
    ],
  },
  {
    id: 'MRD-2467',
    firstName: 'Salma',
    lastName: 'Ihab',
    phone: '+20 11 4038 2215',
    aadharNumber: '4038 2215 9012',
    address: 'Nasser City, Cairo',
    memberSince: 'Jan 2025',
    membership: {
      planId: 'three-month',
      planName: '3-Month Plan',
      startDate: '2026-06-25',
      expiryDate: '2026-09-22',
      status: 'expiring',
      payment: { method: 'Cash', state: 'Paid', date: '2026-06-25', amountEGP: 4050 },
    },
    visits: visits([[20, '6:54 PM', 'B']]),
    activity: [
      { id: 's1', kind: 'checkin', text: 'Checked in at Reception B', at: '2026-09-20T18:54' },
    ],
  },
  {
    id: 'MRD-2519',
    firstName: 'Mariam',
    lastName: 'Ashraf',
    phone: '+20 12 8307 1149',
    aadharNumber: '8307 1149 3456',
    address: '22 El-Gezira St., Zamalek, Cairo',
    memberSince: '2025',
    membership: {
      planId: 'premium-monthly',
      planName: 'Premium Monthly',
      startDate: '2026-08-25',
      expiryDate: '2026-09-24',
      status: 'expiring',
      payment: { method: 'InstaPay', state: 'Paid', date: '2026-08-25', amountEGP: 1500 },
    },
    visits: visits([[14, '5:20 PM', 'A']]),
    activity: [{ id: 'm1', kind: 'checkin', text: 'Checked in at Reception A', at: '2026-09-14T17:20' }],
  },
  {
    id: 'MRD-2490',
    firstName: 'Youssef',
    lastName: 'Amin',
    phone: '+20 10 7761 9083',
    aadharNumber: '7761 9083 7890',
    address: 'Heliopolis, Cairo',
    memberSince: '2025',
    membership: {
      planId: 'annual',
      planName: 'Annual Membership',
      startDate: '2025-09-27',
      expiryDate: '2026-09-27',
      status: 'expiring',
      payment: { method: 'Card', state: 'Paid', date: '2025-09-27', amountEGP: 15000 },
    },
    visits: visits([[19, '7:10 PM', 'A']]),
    activity: [{ id: 'y1', kind: 'checkin', text: 'Checked in at Reception A', at: '2026-09-19T19:10' }],
  },
  {
    id: 'MRD-2388',
    firstName: 'Tarek',
    lastName: 'Mansour',
    phone: '+20 10 9954 0028',
    aadharNumber: '9954 0028 2468',
    address: 'Mohandessin, Giza',
    memberSince: 'Feb 2025',
    membership: {
      planId: 'annual',
      planName: 'Annual Membership',
      startDate: '2025-08-01',
      expiryDate: '2026-07-31',
      status: 'expired',
      payment: { method: 'Card', state: 'Paid', date: '2025-08-01', amountEGP: 15000 },
    },
    visits: visits([[28, '6:30 PM', 'A']]),
    activity: [{ id: 't1', kind: 'checkin', text: 'Checked in at Reception A', at: '2026-07-28T18:30' }],
  },
  {
    id: 'MRD-2530',
    firstName: 'Nadine',
    lastName: 'Fahmy',
    phone: '+20 11 6284 7719',
    aadharNumber: '6284 7719 1357',
    address: 'Maadi, Cairo',
    memberSince: 'Sep 2024',
    membership: {
      planId: 'premium-quarterly',
      planName: 'Premium Quarterly',
      startDate: '2026-06-13',
      expiryDate: '2027-02-02',
      status: 'paused',
      payment: { method: 'Card', state: 'Paid', date: '2026-06-13', amountEGP: 4050 },
      pauseEnds: '2026-10-15',
    },
    visits: visits([[12, '5:00 PM', 'A']]),
    activity: [{ id: 'nf1', kind: 'checkin', text: 'Checked in at Reception A', at: '2026-08-12T17:00' }],
  },
  {
    id: 'MRD-2476',
    firstName: 'Hana',
    lastName: 'Mostafa',
    phone: '+20 10 3371 5562',
    aadharNumber: '3371 5562 9753',
    address: 'New Cairo, Cairo',
    memberSince: 'Nov 2025',
    membership: {
      planId: 'premium-monthly',
      planName: 'Premium Monthly',
      startDate: '2026-08-25',
      expiryDate: '2026-10-24',
      status: 'due',
      payment: { method: 'InstaPay', state: 'Payment due', date: '2026-08-25', amountEGP: 1500 },
      amountDue: 1500,
      graceUntil: '2026-10-24',
    },
    visits: visits([[20, '6:02 PM', 'A']]),
    activity: [{ id: 'h1', kind: 'checkin', text: 'Checked in at Reception A', at: '2026-09-20T18:02' }],
  },
  {
    id: 'MRD-2442',
    firstName: 'Omar Farouk',
    lastName: 'El-Sayed',
    phone: '+20 12 1190 4471',
    aadharNumber: '1190 4471 6420',
    address: 'Dokki, Giza',
    memberSince: '2025',
    membership: {
      planId: 'premium-monthly',
      planName: 'Premium Monthly',
      startDate: '2026-09-12',
      expiryDate: '2026-11-12',
      status: 'active',
      payment: { method: 'Cash', state: 'Paid', date: '2026-09-12', amountEGP: 1500 },
    },
    visits: visits([[20, '6:31 PM', 'A']]),
    activity: [{ id: 'o1', kind: 'checkin', text: 'Checked in at Reception A', at: '2026-09-20T18:31' }],
  },
  {
    id: 'MRD-2511',
    firstName: 'Daniel',
    lastName: 'Kim',
    phone: '+20 12 4409 8835',
    aadharNumber: '4409 8835 1593',
    address: '6th of October, Giza',
    memberSince: '2025',
    membership: {
      planId: 'annual',
      planName: 'Annual Membership',
      startDate: '2026-03-14',
      expiryDate: '2027-03-14',
      status: 'active',
      payment: { method: 'Card', state: 'Paid', date: '2026-03-14', amountEGP: 15000 },
    },
    visits: visits([[20, '7:18 PM', 'A']]),
    activity: [{ id: 'd1', kind: 'checkin', text: 'Checked in at Reception A', at: '2026-09-20T19:18' }],
  },
];

export const NOTICES: Notice[] = [
  {
    id: 'n1',
    category: 'Urgent',
    title: 'Water system maintenance: closed Saturday 26 Sep',
    body: "The club is closed this Saturday for planned maintenance of the water system. We reopen Sunday morning at the usual time.",
    date: '2026-09-19',
    author: 'Meridian front desk',
    audience: 'All members',
    delivered: 342,
    urgent: true,
    read: false,
  },
  {
    id: 'n2',
    category: 'Schedule',
    title: 'Autumn studio schedule starts 1 Oct',
    body: "New timetable for strength, mobility and recovery sessions from the first of October. Evening slots are unchanged.",
    date: '2026-09-18',
    author: 'Meridian front desk',
    audience: 'All members',
    delivered: 342,
    urgent: false,
    read: false,
  },
  {
    id: 'n3',
    category: 'Hours',
    title: 'Friday reception now opens 7 AM',
    body: 'Friday opening moves one hour earlier. Weekday hours are unchanged.',
    date: '2026-09-14',
    author: 'Meridian front desk',
    audience: 'All members',
    delivered: 341,
    urgent: false,
    read: true,
  },
  {
    id: 'n4',
    category: 'Facilities',
    title: 'Cold-plunge tubs open in the recovery room',
    body: 'Two new cold-plunge tubs are ready beside the sauna. Towels are available at reception as usual.',
    date: '2026-09-10',
    author: 'Meridian front desk',
    audience: 'All members',
    delivered: 340,
    urgent: false,
    read: true,
  },
  {
    id: 'n5',
    category: 'Renewal',
    title: 'A reminder for members expiring this week',
    body: 'If your membership ends this week, renew at reception to keep uninterrupted access.',
    date: '2026-09-12',
    author: 'Meridian front desk',
    audience: 'Expiring soon',
    delivered: 14,
    urgent: false,
    read: true,
  },
];

export function memberById(id: string): Member | undefined {
  return MEMBERS.find((m) => m.id === id);
}

export function noticeById(id: string): Notice | undefined {
  return NOTICES.find((n) => n.id === id);
}

export function searchMembers(q: string): Member[] {
  const query = q.trim().toLowerCase();
  if (!query) return MEMBERS;
  return MEMBERS.filter((m) => {
    const name = `${m.firstName} ${m.lastName}`.toLowerCase();
    return (
      name.includes(query) ||
      m.id.toLowerCase().includes(query) ||
      m.phone.replace(/\s/g, '').includes(query.replace(/\s/g, '')) ||
      m.aadharNumber.replace(/\s/g, '').includes(query.replace(/\s/g, '')) ||
      m.address.toLowerCase().includes(query)
    );
  });
}

export function membersByStatus(status: Member['membership'] extends null ? never : NonNullable<Member['membership']>['status'] | 'all'): Member[] {
  if (status === 'all') return MEMBERS;
  return MEMBERS.filter((m) => m.membership?.status === status);
}

export function expiringSoon(days = 7): Member[] {
  return MEMBERS.filter((m) => m.membership?.status === 'expiring');
}

export function expiredMembers(): Member[] {
  return MEMBERS.filter((m) => m.membership?.status === 'expired');
}

export function activeMembers(): Member[] {
  return MEMBERS.filter((m) => m.membership?.status === 'active' || m.membership?.status === 'due');
}

export function recentCheckIns(limit = 5): { member: Member; visit: Visit }[] {
  const all: { member: Member; visit: Visit }[] = [];
  for (const m of MEMBERS) {
    for (const v of m.visits) {
      all.push({ member: m, visit: v });
    }
  }
  all.sort((a, b) => (a.visit.date + a.visit.time < b.visit.date + b.visit.time ? 1 : -1));
  return all.slice(0, limit);
}
