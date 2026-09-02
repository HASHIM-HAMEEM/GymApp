import * as React from 'react';
import { MEMBERS, NOTICES } from './members';
import { CURRENT_MEMBER_ID, ADMIN_USER } from './plans';
import type { Member, Notice, Membership, Visit, ActivityEntry } from './types';
import { TODAY } from './format';

/**
 * In-memory app store. Mock data + simple mutations so the flows behave
 * realistically without a database. Later this swaps for a real backend.
 */

type Role = 'member' | 'admin' | 'unauth';

interface AppState {
  role: Role;
  currentMember: Member | null;
  members: Member[];
  notices: Notice[];
  adminName: string;
  adminInitials: string;
  darkMode: boolean;
}

interface AppActions {
  signIn: (memberId: string) => void;
  signInAsAdmin: () => void;
  signOut: () => void;
  renewMembership: (
    memberId: string,
    planName: string,
    startDate: string,
    endDate: string,
    paymentState: 'Paid' | 'Payment due' | 'Complimentary',
    amountEGP: number,
    method?: 'InstaPay' | 'Cash' | 'Card' | 'Complimentary',
  ) => void;
  checkIn: (memberId: string, reception: 'A' | 'B') => void;
  publishNotice: (n: Omit<Notice, 'id' | 'delivered'>) => void;
  updateProfile: (
    memberId: string,
    patch: Partial<Pick<Member, 'firstName' | 'lastName' | 'phone' | 'email' | 'emergencyName' | 'emergencyPhone' | 'aadharNumber' | 'address'>>,
  ) => void;
  getMember: (id: string) => Member | undefined;
  toggleDarkMode: () => void;
}

type Ctx = AppState & AppActions;

const AppCtx = React.createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [members, setMembers] = React.useState<Member[]>(() => MEMBERS.map((m) => ({ ...m, visits: [...m.visits], activity: [...m.activity] })));
  const [notices, setNotices] = React.useState<Notice[]>(() => NOTICES.map((n) => ({ ...n })));
  const [role, setRole] = React.useState<Role>('unauth');
  const [currentId, setCurrentId] = React.useState<string | null>(null);
  const [darkMode, setDarkMode] = React.useState(true);

  const currentMember = React.useMemo(
    () => (currentId ? members.find((m) => m.id === currentId) ?? null : null),
    [currentId, members],
  );

  const toggleDarkMode = React.useCallback(() => setDarkMode((v) => !v), []);

  const getMember = React.useCallback((id: string) => members.find((m) => m.id === id), [members]);

  const signIn = React.useCallback((memberId: string) => {
    setRole('member');
    setCurrentId(memberId);
  }, []);

  const signInAsAdmin = React.useCallback(() => {
    setRole('admin');
    setCurrentId(null);
  }, []);

  const signOut = React.useCallback(() => {
    setRole('unauth');
    setCurrentId(null);
  }, []);

  const renewMembership = React.useCallback<Ctx['renewMembership']>(
    (memberId, planName, startDate, endDate, paymentState, amountEGP, method = 'Cash') => {
      setMembers((prev) =>
        prev.map((m) => {
          if (m.id !== memberId) return m;
          const newMembership: Membership = {
            planId: planName.toLowerCase().replace(/\s+/g, '-'),
            planName,
            startDate,
            expiryDate: endDate,
            status: 'active',
            payment: { method, state: paymentState, date: startDate, amountEGP },
          };
          const entry: ActivityEntry = {
            id: `act-${Date.now()}`,
            kind: 'renew',
            text: `Membership renewed on ${planName} · payment recorded as ${method.toLowerCase()}`,
            at: new Date().toISOString().slice(0, 16),
            author: ADMIN_USER.name,
          };
          return { ...m, membership: newMembership, activity: [entry, ...m.activity] };
        }),
      );
    },
    [],
  );

  const checkIn = React.useCallback<Ctx['checkIn']>((memberId, reception) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id !== memberId) return m;
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const visit: Visit = {
          id: `v-${Date.now()}`,
          date: TODAY,
          time: `${hh}:${mm}`,
          reception,
        };
        const entry: ActivityEntry = {
          id: `act-${Date.now()}`,
          kind: 'checkin',
          text: `Checked in at Reception ${reception}`,
          at: `${TODAY}T${hh}:${mm}`,
        };
        return { ...m, visits: [visit, ...m.visits], activity: [entry, ...m.activity] };
      }),
    );
  }, []);

  const publishNotice = React.useCallback<Ctx['publishNotice']>((n) => {
    setNotices((prev) => [{ ...n, id: `n-${Date.now()}`, read: false, delivered: n.audience === 'All members' ? 342 : n.audience === 'Active only' ? 342 : 12 }, ...prev]);
  }, []);

  const updateProfile = React.useCallback<Ctx['updateProfile']>((memberId, patch) => {
    setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, ...patch } : m)));
  }, []);


  const value: Ctx = {
    role,
    currentMember,
    members,
    notices,
    adminName: ADMIN_USER.name,
    adminInitials: ADMIN_USER.initials,
    darkMode,
    signIn,
    signInAsAdmin,
    signOut,
    renewMembership,
    checkIn,
    publishNotice,
    updateProfile,
    getMember,
    toggleDarkMode,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const ctx = React.useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
