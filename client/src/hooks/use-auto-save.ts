import { useEffect, useRef } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface UseAutoSaveProps {
  sessionId: number;
  text: string;
  enabled?: boolean;
  interval?: number; // in milliseconds
  onSave?: (success: boolean) => void;
}

export function useAutoSave({ 
  sessionId, 
  text, 
  enabled = true, 
  interval = 5000, // 5 seconds
  onSave 
}: UseAutoSaveProps) {
  const lastSavedText = useRef(text);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSaving = useRef(false);

  useEffect(() => {
    if (!enabled || isSaving.current) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Only auto-save if text has changed
    if (text !== lastSavedText.current && text.trim() !== '') {
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          isSaving.current = true;
          
          const response = await apiRequest('POST', `/api/test-sessions/${sessionId}/autosave`, {
            answerDraft: text
          });
          
          if (response.ok) {
            lastSavedText.current = text;
            onSave?.(true);
          } else {
            onSave?.(false);
          }
        } catch (error) {
          console.error('Auto-save failed:', error);
          onSave?.(false);
        } finally {
          isSaving.current = false;
        }
      }, interval);
    }

    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [text, sessionId, enabled, interval, onSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);
}