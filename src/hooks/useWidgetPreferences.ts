import { useEffect, useState } from 'react';

const PREF_KEY = 'dashboard.pinnedKpis';

type KpiKey =
  | 'totalContacts'
  | 'sphereSyncCompletionRate'
  | 'upcomingEvents'
  | 'newsletterOpenRate'
  | 'activeTransactions'
  | 'coachingSessions';

export function useWidgetPreferences() {
  const [pinned, setPinned] = useState<KpiKey[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREF_KEY);
      if (raw) setPinned(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(pinned));
    } catch {}
  }, [pinned]);

  const togglePinned = (key: KpiKey) => {
    setPinned((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const isPinned = (key: KpiKey) => pinned.includes(key);

  return { pinned, togglePinned, isPinned };
}
