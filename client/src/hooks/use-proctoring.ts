import { useState, useEffect, useRef } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface ProctorState {
  cameraEnabled: boolean;
  fullscreenActive: boolean;
  violations: number;
  isNullified: boolean;
  error: string | null;
}

interface UseProctorProps {
  sessionId?: number;
  onViolation?: (type: string, severity: string) => void;
  onNullification?: () => void;
}

export function useProctoring({ sessionId, onViolation, onNullification }: UseProctorProps = {}) {
  const [state, setState] = useState<ProctorState>({
    cameraEnabled: false,
    fullscreenActive: false,
    violations: 0,
    isNullified: false,
    error: null
  });

  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Request camera access
  const requestCameraAccess = async (): Promise<boolean> => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false 
      });
      
      setStream(mediaStream);
      setState(prev => ({ ...prev, cameraEnabled: true, error: null }));
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      
      return true;
    } catch (error) {
      console.error('Camera access denied:', error);
      setState(prev => ({ 
        ...prev, 
        cameraEnabled: false,
        error: 'Camera access is required to proceed with the exam'
      }));
      return false;
    }
  };

  // Request fullscreen
  const requestFullscreen = async (): Promise<boolean> => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setState(prev => ({ ...prev, fullscreenActive: true, error: null }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Fullscreen request failed:', error);
      setState(prev => ({ 
        ...prev, 
        fullscreenActive: false,
        error: 'Fullscreen mode is required for the exam'
      }));
      return false;
    }
  };

  // Check camera status
  const checkCameraStatus = () => {
    if (!stream) return false;
    
    const videoTracks = stream.getVideoTracks();
    const isEnabled = videoTracks.length > 0 && videoTracks[0].enabled && videoTracks[0].readyState === 'live';
    
    if (!isEnabled && state.cameraEnabled) {
      recordViolation('camera_disabled', 'critical');
      setState(prev => ({ ...prev, cameraEnabled: false }));
    }
    
    return isEnabled;
  };

  // Check fullscreen status
  const checkFullscreenStatus = () => {
    const isFullscreen = Boolean(document.fullscreenElement);
    
    if (!isFullscreen && state.fullscreenActive) {
      recordViolation('fullscreen_exit', 'critical');
      setState(prev => ({ ...prev, fullscreenActive: false }));
    }
    
    return isFullscreen;
  };

  // Record violation
  const recordViolation = async (type: string, severity: 'warning' | 'critical') => {
    if (!sessionId) return;

    try {
      const response = await apiRequest('POST', `/api/proctoring/violations`, {
        sessionId,
        type,
        severity,
        description: `${type.replace('_', ' ')} detected during exam`
      });

      if (response.ok) {
        const result = await response.json();
        setState(prev => ({ 
          ...prev, 
          violations: prev.violations + 1,
          isNullified: result.nullified || false
        }));
        
        onViolation?.(type, severity);
        
        if (result.nullified) {
          onNullification?.();
        }
      }
    } catch (error) {
      console.error('Error recording violation:', error);
    }
  };

  // Initialize proctoring
  const initializeProctoring = async (testSessionId: number) => {
    if (!testSessionId) return false;

    try {
      const response = await apiRequest('POST', `/api/proctoring/initialize`, {
        sessionId: testSessionId
      });

      if (response.ok) {
        return true;
      }
    } catch (error) {
      console.error('Error initializing proctoring:', error);
    }
    return false;
  };

  // Setup monitoring
  useEffect(() => {
    if (!sessionId || !state.cameraEnabled || !state.fullscreenActive) return;

    // Start monitoring
    intervalRef.current = setInterval(() => {
      checkCameraStatus();
      checkFullscreenStatus();
    }, 5000); // Check every 5 seconds

    // Listen for fullscreen changes
    const handleFullscreenChange = () => {
      checkFullscreenStatus();
    };

    // Listen for visibility changes (tab switching)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordViolation('tab_switch', 'warning');
      }
    };

    // Listen for window blur (switching applications)
    const handleWindowBlur = () => {
      recordViolation('window_blur', 'warning');
    };

    // Prevent accidental navigation away from exam
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Are you sure you want to leave the exam? This will end your session.';
      return e.returnValue;
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [sessionId, state.cameraEnabled, state.fullscreenActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  return {
    state,
    videoRef,
    requestCameraAccess,
    requestFullscreen,
    initializeProctoring,
    recordViolation
  };
}