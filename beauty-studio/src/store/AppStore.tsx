import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type {
  Service, Appointment, Customer, AvailabilityRule, BlockedTime,
  BusinessSettings, GalleryItem, AppNotification, AppointmentStatus
} from '../types';
import {
  seedServices, seedAppointments, seedCustomers, seedAvailability,
  seedBlocked, seedSettings, seedGallery, seedNotifications
} from '../data/mockData';

const LS_KEY = 'lumiere-studio-v1';

interface State {
  services: Service[];
  appointments: Appointment[];
  customers: Customer[];
  availability: AvailabilityRule[];
  blocked: BlockedTime[];
  settings: BusinessSettings;
  gallery: GalleryItem[];
  notifications: AppNotification[];
}

const initialState: State = {
  services: seedServices,
  appointments: seedAppointments,
  customers: seedCustomers,
  availability: seedAvailability,
  blocked: seedBlocked,
  settings: seedSettings,
  gallery: seedGallery,
  notifications: seedNotifications,
};

interface Actions {
  createAppointment: (a: Omit<Appointment, 'id' | 'createdAt' | 'status'> & { status?: AppointmentStatus }) => Appointment;
  updateAppointmentStatus: (id: string, status: AppointmentStatus) => void;
  updateAppointment: (id: string, patch: Partial<Appointment>) => void;
  deleteAppointment: (id: string) => void;
  upsertCustomer: (c: Partial<Customer> & { fullName: string; phone: string }) => Customer;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  upsertService: (s: Service) => void;
  deleteService: (id: string) => void;
  updateAvailability: (weekday: number, patch: Partial<AvailabilityRule>) => void;
  addBlocked: (b: Omit<BlockedTime, 'id'>) => void;
  removeBlocked: (id: string) => void;
  updateSettings: (patch: Partial<BusinessSettings>) => void;
  upsertGallery: (g: GalleryItem) => void;
  deleteGallery: (id: string) => void;
  markNotificationRead: (id: string) => void;
  pushNotification: (n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => void;
  resetAll: () => void;
}

type Ctx = State & Actions;
const AppStoreCtx = createContext<Ctx | null>(null);

function loadState(): State {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw);
    return { ...initialState, ...parsed };
  } catch { return initialState; }
}

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(() => loadState());

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);

  const pushNotification: Actions['pushNotification'] = useCallback((n) => {
    setState(s => ({
      ...s,
      notifications: [{ ...n, id: uid('n'), createdAt: new Date().toISOString(), read: false }, ...s.notifications].slice(0, 30),
    }));
  }, []);

  const createAppointment: Actions['createAppointment'] = useCallback((data) => {
    const apt: Appointment = {
      ...data,
      id: uid('apt'),
      status: data.status ?? (initialState.settings.requireApproval ? 'pending' : 'approved'),
      createdAt: new Date().toISOString(),
    };
    setState(s => ({ ...s, appointments: [...s.appointments, apt] }));
    return apt;
  }, []);

  const updateAppointmentStatus: Actions['updateAppointmentStatus'] = useCallback((id, status) => {
    setState(s => ({
      ...s,
      appointments: s.appointments.map(a => a.id === id ? { ...a, status } : a),
    }));
  }, []);

  const updateAppointment: Actions['updateAppointment'] = useCallback((id, patch) => {
    setState(s => ({
      ...s,
      appointments: s.appointments.map(a => a.id === id ? { ...a, ...patch } : a),
    }));
  }, []);

  const deleteAppointment: Actions['deleteAppointment'] = useCallback((id) => {
    setState(s => ({ ...s, appointments: s.appointments.filter(a => a.id !== id) }));
  }, []);

  const upsertCustomer: Actions['upsertCustomer'] = useCallback((c) => {
    let result!: Customer;
    setState(s => {
      const existing = s.customers.find(x => x.phone === c.phone);
      if (existing) {
        result = { ...existing, ...c };
        return { ...s, customers: s.customers.map(x => x.id === existing.id ? result : x) };
      }
      result = {
        id: uid('cst'),
        fullName: c.fullName,
        phone: c.phone,
        email: c.email,
        notes: c.notes,
        createdAt: new Date().toISOString(),
      };
      return { ...s, customers: [...s.customers, result] };
    });
    return result;
  }, []);

  const updateCustomer: Actions['updateCustomer'] = useCallback((id, patch) => {
    setState(s => ({ ...s, customers: s.customers.map(c => c.id === id ? { ...c, ...patch } : c) }));
  }, []);

  const upsertService: Actions['upsertService'] = useCallback((svc) => {
    setState(s => {
      const exists = s.services.some(x => x.id === svc.id);
      return { ...s, services: exists ? s.services.map(x => x.id === svc.id ? svc : x) : [...s.services, svc] };
    });
  }, []);
  const deleteService: Actions['deleteService'] = useCallback((id) => {
    setState(s => ({ ...s, services: s.services.filter(x => x.id !== id) }));
  }, []);

  const updateAvailability: Actions['updateAvailability'] = useCallback((wd, patch) => {
    setState(s => ({ ...s, availability: s.availability.map(a => a.weekday === wd ? { ...a, ...patch } : a) }));
  }, []);

  const addBlocked: Actions['addBlocked'] = useCallback((b) => {
    setState(s => ({ ...s, blocked: [...s.blocked, { ...b, id: uid('blk') }] }));
  }, []);
  const removeBlocked: Actions['removeBlocked'] = useCallback((id) => {
    setState(s => ({ ...s, blocked: s.blocked.filter(b => b.id !== id) }));
  }, []);

  const updateSettings: Actions['updateSettings'] = useCallback((patch) => {
    setState(s => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);

  const upsertGallery: Actions['upsertGallery'] = useCallback((g) => {
    setState(s => {
      const exists = s.gallery.some(x => x.id === g.id);
      return { ...s, gallery: exists ? s.gallery.map(x => x.id === g.id ? g : x) : [...s.gallery, g] };
    });
  }, []);
  const deleteGallery: Actions['deleteGallery'] = useCallback((id) => {
    setState(s => ({ ...s, gallery: s.gallery.filter(g => g.id !== id) }));
  }, []);

  const markNotificationRead: Actions['markNotificationRead'] = useCallback((id) => {
    setState(s => ({ ...s, notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n) }));
  }, []);

  const resetAll = useCallback(() => {
    localStorage.removeItem(LS_KEY);
    setState(initialState);
  }, []);

  const value = useMemo<Ctx>(() => ({
    ...state,
    createAppointment, updateAppointmentStatus, updateAppointment, deleteAppointment,
    upsertCustomer, updateCustomer,
    upsertService, deleteService,
    updateAvailability, addBlocked, removeBlocked,
    updateSettings, upsertGallery, deleteGallery,
    markNotificationRead, pushNotification, resetAll,
  }), [state, createAppointment, updateAppointmentStatus, updateAppointment, deleteAppointment, upsertCustomer, updateCustomer, upsertService, deleteService, updateAvailability, addBlocked, removeBlocked, updateSettings, upsertGallery, deleteGallery, markNotificationRead, pushNotification, resetAll]);

  return <AppStoreCtx.Provider value={value}>{children}</AppStoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(AppStoreCtx);
  if (!ctx) throw new Error('useStore outside provider');
  return ctx;
}
