import { useState, useEffect } from 'react';
import api from '@/lib/api';

export interface WaitPrediction {
  estimated_wait_minutes: number;
  confidence: "high" | "medium" | "low";
  message: string;
}

export function useWaitTimePrediction(queueKey: string, ticketId: string) {
  const [prediction, setPrediction] = useState<WaitPrediction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!queueKey || !ticketId) return;

    const fetchPrediction = async () => {
      try {
        const response = await api.get(`/queue/${queueKey}/wait-time?ticket_id=${ticketId}`);
        if (response.data?.data) {
          setPrediction(response.data.data);
        } else {
          setPrediction(response.data as unknown as WaitPrediction);
        }
      } catch (error) {
        console.error("Failed to fetch AI prediction:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPrediction();
    const interval = setInterval(fetchPrediction, 180000); // refresh 3 mins
    return () => clearInterval(interval);
  }, [queueKey, ticketId]);

  return { prediction, loading };
}
