import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface TimingInfo {
  sessionTimeElapsed: number;
  currentQuestionElapsed: number;
  currentQuestionExpired: boolean;
  autoSubmitted: boolean;
  timeRemaining: number;
}

interface UseDatabaseTimerProps {
  sessionId: number;
  enabled?: boolean;
  onTimeUp?: () => void;
  onAutoSubmit?: () => void;
  checkInterval?: number; // in milliseconds
}

export function useDatabaseTimer({ 
  sessionId, 
  enabled = true, 
  onTimeUp,
  onAutoSubmit,
  checkInterval = 1000 // 1 second
}: UseDatabaseTimerProps) {
  const [timingInfo, setTimingInfo] = useState<TimingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasTriggeredTimeUp = useRef(false);
  const hasTriggeredAutoSubmit = useRef(false);

  const checkTiming = async () => {
    if (!enabled || isLoading) return;

    try {
      setIsLoading(true);
      const response = await apiRequest('POST', `/api/test-sessions/${sessionId}/check-timing`, {});
      
      if (response.ok) {
        const data: TimingInfo = await response.json();
        setTimingInfo(data);

        // Trigger callbacks based on timing
        if (data.currentQuestionExpired && !hasTriggeredTimeUp.current) {
          hasTriggeredTimeUp.current = true;
          onTimeUp?.();
        }

        if (data.autoSubmitted && !hasTriggeredAutoSubmit.current) {
          hasTriggeredAutoSubmit.current = true;
          onAutoSubmit?.();
        }
      }
    } catch (error) {
      console.error('Error checking timing:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled) return;

    // Check timing immediately
    checkTiming();

    // Set up interval to check timing
    intervalRef.current = setInterval(checkTiming, checkInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [sessionId, enabled, checkInterval]);

  // Reset triggers when session changes
  useEffect(() => {
    hasTriggeredTimeUp.current = false;
    hasTriggeredAutoSubmit.current = false;
  }, [sessionId]);

  return {
    timingInfo,
    isLoading,
    checkTiming
  };
}