'use client';
// ============================================================
// useRealtimeOrders — Supabase Realtime channel subscription
// Replaces setInterval polling in KDS and AdminOrdersBoard.
// Listens for INSERT/UPDATE on the orders table for a given
// tenant, then calls the provided callback to refresh data.
//
// Falls back to polling gracefully if Realtime is unavailable.
// ============================================================

import { useEffect, useRef, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface Options {
  tenantId: string;
  onOrderChange: () => void;
  /** Fallback poll interval in ms if Realtime fails. Default: 15_000 */
  fallbackPollMs?: number;
  /** Also subscribe to order_items changes (useful for KDS) */
  includeItems?: boolean;
}

export function useRealtimeOrders({
  tenantId,
  onOrderChange,
  fallbackPollMs = 15_000,
  includeItems = false,
}: Options) {
  const channelRef    = useRef<RealtimeChannel | null>(null);
  const fallbackRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectedRef  = useRef(false);
  const callbackRef   = useRef(onOrderChange);
  callbackRef.current = onOrderChange;

  const triggerChange = useCallback(() => {
    callbackRef.current();
  }, []);

  useEffect(() => {
    if (!tenantId) return;

    const supabase = createBrowserClient();

    // ── Subscribe to Realtime ──────────────────────────────
    const channelName = `orders:${tenantId}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onChange = (_payload: RealtimePostgresChangesPayload<any>) => triggerChange();

    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on('postgres_changes', {
          event:  '*',
          schema: 'public',
          table:  'orders',
          filter: `tenant_id=eq.${tenantId}`,
        }, onChange);

    if (includeItems) {
      channel.on('postgres_changes', {
          event:  '*',
          schema: 'public',
          table:  'order_items',
          filter: `tenant_id=eq.${tenantId}`,
        }, onChange);
    }

    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        connectedRef.current = true;
        // Clear any fallback poll once Realtime is live
        if (fallbackRef.current) {
          clearInterval(fallbackRef.current);
          fallbackRef.current = null;
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        connectedRef.current = false;
        // Start fallback polling
        if (!fallbackRef.current) {
          fallbackRef.current = setInterval(triggerChange, fallbackPollMs);
        }
      }
    });

    channelRef.current = channel;

    // Start fallback poll immediately — Realtime will cancel it once connected
    fallbackRef.current = setInterval(triggerChange, fallbackPollMs);

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (fallbackRef.current) {
        clearInterval(fallbackRef.current);
        fallbackRef.current = null;
      }
      connectedRef.current = false;
    };
  }, [tenantId, fallbackPollMs, includeItems, triggerChange]);

  return { isConnected: connectedRef };
}
