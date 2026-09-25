'use client';

import { apiClient, ApiTransportError } from '@packages/client';
import { useEffect, useState } from 'react';

type HealthState =
  { state: 'loading' } | { state: 'ok'; text: string } | { state: 'error'; text: string };

export function HealthStatus() {
  const [status, setStatus] = useState<HealthState>({ state: 'loading' });

  useEffect(() => {
    let active = true;

    apiClient
      .getHealth()
      .then((health) => {
        if (active) setStatus({ state: 'ok', text: `${health.service} · ${health.status}` });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setStatus({
          state: 'error',
          text: error instanceof ApiTransportError ? 'api tidak terjangkau' : 'respons tidak valid',
        });
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <p className="text-xs text-muted-foreground">
      API via @packages/client: {status.state === 'loading' ? 'memuat…' : status.text}
    </p>
  );
}
