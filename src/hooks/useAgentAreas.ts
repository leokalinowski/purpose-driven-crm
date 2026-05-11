/**
 * useAgentAreas — distinct cities + states the agent has contacts in,
 * sorted by contact density. Powers the "What area do you want to talk
 * about?" picker in the AI newsletter dialog.
 *
 * Returns top 30 cities and all states (states are usually <20 anyway).
 * The shape matches what the picker UI needs:
 *   - cities: { city, state, contactCount }[]    (proper-cased city)
 *   - states: { state, contactCount }[]          (uppercase 2-letter)
 *
 * Caches in-component since the dialog opens infrequently and the data is
 * small. No TanStack — same pattern as the brand summary fetch.
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AreaCity {
  city: string;          // proper-cased for display, e.g. "Alexandria"
  cityNorm: string;      // lowercased trimmed — pass this as area.value
  state: string;         // uppercase 2-letter, may be ''
  contactCount: number;
}

export interface AreaState {
  state: string;         // uppercase 2-letter
  contactCount: number;
}

export interface AgentAreasResult {
  cities: AreaCity[];
  states: AreaState[];
  loading: boolean;
  error: string | null;
}

export function useAgentAreas(agentId: string | undefined, open: boolean): AgentAreasResult {
  const [cities, setCities] = useState<AreaCity[]>([]);
  const [states, setStates] = useState<AreaState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agentId || !open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // Pull all contacts that have at least a city OR a state. We aggregate
        // on the client so we don't need a custom RPC.
        const { data, error: queryError } = await supabase
          .from('contacts')
          .select('city, state')
          .eq('agent_id', agentId);

        if (queryError) throw queryError;
        if (cancelled) return;

        const cityMap = new Map<string, AreaCity>();   // key: cityNorm + '|' + state
        const stateMap = new Map<string, AreaState>(); // key: state code

        for (const row of (data ?? []) as Array<{ city: string | null; state: string | null }>) {
          const cityRaw = (row.city ?? '').trim();
          const stateRaw = (row.state ?? '').trim().toUpperCase();

          if (cityRaw) {
            const cityNorm = cityRaw.toLowerCase();
            const cityProper = cityRaw
              .split(/\s+/)
              .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
              .join(' ');
            const key = `${cityNorm}|${stateRaw}`;
            const existing = cityMap.get(key);
            if (existing) {
              existing.contactCount += 1;
            } else {
              cityMap.set(key, {
                city: cityProper,
                cityNorm,
                state: stateRaw,
                contactCount: 1,
              });
            }
          }

          if (stateRaw && /^[A-Z]{2}$/.test(stateRaw)) {
            const existing = stateMap.get(stateRaw);
            if (existing) {
              existing.contactCount += 1;
            } else {
              stateMap.set(stateRaw, { state: stateRaw, contactCount: 1 });
            }
          }
        }

        // Sort cities by contact count desc, then city name. Cap at 30 — the
        // long tail isn't useful in a picker.
        const cityList = [...cityMap.values()]
          .sort((a, b) => b.contactCount - a.contactCount || a.city.localeCompare(b.city))
          .slice(0, 30);

        const stateList = [...stateMap.values()]
          .sort((a, b) => b.contactCount - a.contactCount || a.state.localeCompare(b.state));

        if (!cancelled) {
          setCities(cityList);
          setStates(stateList);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load areas');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [agentId, open]);

  return { cities, states, loading, error };
}
