import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface TimingInfo {
  sessionTimeElapsed: number;
  currentQuestionElapsed: number;
  currentQuestionExpired: boolean;
  autoSubmitted: boolean;
  timeRemaining: number;
  questionStartTime: string;
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
  const clientIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasTriggeredTimeUp = useRef(false);
  const hasTriggeredAutoSubmit = useRef(false);
  const questionStartTimeRef = useRef<string | null>(null);

  const checkTiming = async () => {
    if (!enabled || isLoading) return;

    try {
      setIsLoading(true);
      const response = await apiRequest('POST', `/api/test-sessions/${sessionId}/check-timing`, {});
      
      if (response.ok) {
        const data: TimingInfo = await response.json();
        
        // Store the question start time for client-side calculations
        if (data.questionStartTime) {
          questionStartTimeRef.current = data.questionStartTime;
        }
        
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

  // Update timing info on client side for smoother countdown
  const updateClientTiming = () => {
    if (!questionStartTimeRef.current || !timingInfo) return;

    const now = new Date();
    const questionStartTime = new Date(questionStartTimeRef.current);
    const currentQuestionElapsed = now.getTime() - questionStartTime.getTime();
    const currentQuestionTimeLimit = 10 * 60 * 1000; // 10 minutes
    const timeRemaining = Math.max(0, currentQuestionTimeLimit - currentQuestionElapsed);

    setTimingInfo(prev => prev ? {
      ...prev,
      currentQuestionElapsed,
      timeRemaining,
      currentQuestionExpired: currentQuestionElapsed > currentQuestionTimeLimit
    } : null);
  };

  useEffect(() => {
    if (!enabled) return;

    // Check timing immediately
    checkTiming();

    // Set up interval to check timing from database (less frequent)
    intervalRef.current = setInterval(checkTiming, 30000); // Check database every 30 seconds

    // Set up client-side timer for smooth countdown (more frequent)
    clientIntervalRef.current = setInterval(updateClientTiming, 1000); // Update every second

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (clientIntervalRef.current) {
        clearInterval(clientIntervalRef.current);
      }
    };
  }, [sessionId, enabled]);

  // Reset triggers when session changes
  useEffect(() => {
    hasTriggeredTimeUp.current = false;
    hasTriggeredAutoSubmit.current = false;
    questionStartTimeRef.current = null;
  }, [sessionId]);

  return {
    timingInfo,
    isLoading,
    checkTiming
  };
}