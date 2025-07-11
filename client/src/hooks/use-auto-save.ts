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
  interval = 8000, // Increased to 8 seconds for less aggressive saving
  onSave 
}: UseAutoSaveProps) {
  const lastSavedText = useRef(text);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSaving = useRef(false);
  const lastTextChange = useRef(Date.now());

  useEffect(() => {
    if (!enabled || isSaving.current) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Only auto-save if text has changed and there's meaningful content
    if (text !== lastSavedText.current && text.trim() !== '' && text.length > 5) {
      lastTextChange.current = Date.now();
      
      saveTimeoutRef.current = setTimeout(async () => {
        // Double-check the text hasn't changed recently (debouncing)
        const timeSinceLastChange = Date.now() - lastTextChange.current;
        if (timeSinceLastChange < interval - 1000) {
          return; // Skip save if text changed too recently
        }
        
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