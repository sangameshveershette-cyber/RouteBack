import React, { createContext, useContext, useEffect, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';

interface MapsContextValue {
  apiKey: string;
  hasKey: boolean;
  quotaExceeded: boolean;
  isLoadedKeyReady: boolean;
}

const MapsContext = createContext<MapsContextValue>({
  apiKey: '',
  hasKey: false,
  quotaExceeded: false,
  isLoadedKeyReady: false,
});

export function MapsProviderWrapper({
  children,
  quotaExceeded,
}: {
  children: React.ReactNode;
  quotaExceeded: boolean;
}) {
  const envKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || '';
  const cleanEnvKey = envKey && !envKey.includes('MY_') ? envKey : '';
  const [apiKey, setApiKey] = useState<string>(cleanEnvKey);
  const [checkedServer, setCheckedServer] = useState<boolean>(Boolean(cleanEnvKey));

  useEffect(() => {
    if (cleanEnvKey) return;
    fetch('/api/config/maps')
      .then((r) => r.json())
      .then((data: { hasKey?: boolean; apiKey?: string }) => {
        if (data.hasKey && data.apiKey) {
          setApiKey(data.apiKey);
        }
      })
      .catch(() => {
        // Fallback mode will handle missing key cleanly
      })
      .finally(() => setCheckedServer(true));
  }, [cleanEnvKey]);

  const hasKey = Boolean(apiKey) && !quotaExceeded;

  const content = (
    <MapsContext.Provider
      value={{
        apiKey,
        hasKey,
        quotaExceeded,
        isLoadedKeyReady: checkedServer,
      }}
    >
      {children}
    </MapsContext.Provider>
  );

  if (hasKey) {
    return (
      <APIProvider
        apiKey={apiKey}
        libraries={['places', 'routes', 'marker']}
        language="en"
        region="IN"
      >
        {content}
      </APIProvider>
    );
  }

  return content;
}

export function useMapsConfig() {
  return useContext(MapsContext);
}
