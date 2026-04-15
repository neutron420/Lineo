'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

interface SocketContextType {
  isConnected: boolean;
  subscribe: (orgId: number, callback: (data: unknown) => void) => void;
  unsubscribe: (orgId: number) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [isConnected, setIsConnected] = useState(false);
  const sockets = useRef<Map<number, WebSocket>>(new Map());
  const callbacks = useRef<Map<number, Set<(data: unknown) => void>>>(new Map());

  const subscribe = (orgId: number, callback: (data: unknown) => void) => {
    if (!callbacks.current.has(orgId)) {
      callbacks.current.set(orgId, new Set());
    }
    callbacks.current.get(orgId)?.add(callback);

    if (!sockets.current.has(orgId)) {
      const wsUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1').replace('http', 'ws').replace('/api/v1', '') + `/ws?org_id=${orgId}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        console.log(`WebSocket connected for Org: ${orgId}`);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          callbacks.current.get(orgId)?.forEach((cb) => cb(data));
        } catch (err) {
          console.error("WS parse error", err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        console.log(`WebSocket disconnected for Org: ${orgId}`);
        sockets.current.delete(orgId);
        // Retry logic could be added here
      };

      sockets.current.set(orgId, ws);
    }
  };

  const unsubscribe = (orgId: number) => {
    // For now, we just keep the socket open if there are other listeners or for simplicity
    // we could close it if listeners reach 0
    console.log(`Unsubscribe requested for Org: ${orgId}`);
  };

  useEffect(() => {
    const currentSockets = sockets.current;
    return () => {
      currentSockets.forEach((ws) => ws.close());
    };
  }, []);

  return (
    <SocketContext.Provider value={{ isConnected, subscribe, unsubscribe }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error("useSocket must be used within SocketProvider");
  return context;
};
