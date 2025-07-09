import { AlertTriangle, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useState } from 'react';

interface ProctoringViolationModalProps {
  isOpen: boolean;
  violationType: string;
  onClose: () => void;
  onRequestFullscreen?: () => void;
}

export default function ProctoringViolationModal({ 
  isOpen, 
  violationType, 
  onClose,
  onRequestFullscreen
}: ProctoringViolationModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Monitor fullscreen status
  useEffect(() => {
    const checkFullscreen = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    
    checkFullscreen();
    document.addEventListener('fullscreenchange', checkFullscreen);
    
    return () => {
      document.removeEventListener('fullscreenchange', checkFullscreen);
    };
  }, []);
  
  if (!isOpen) return null;

  const getViolationDetails = (type: string) => {
    switch (type) {
      case 'camera_disabled':
        return {
          title: 'Camera Disabled',
          description: 'Your camera has been turned off during the exam.',
          consequence: 'Your exam attempt has been nullified and removed from the database.'
        };
      case 'fullscreen_exit':
        return {
          title: 'Fullscreen Required',
          description: 'You have exited fullscreen mode during the exam. Please return to fullscreen to continue.',
          consequence: 'You must return to fullscreen mode to resume the exam.'
        };
      case 'tab_switch':
        return {
          title: 'Tab Switch Detected',
          description: 'You have switched to another browser tab during the exam.',
          consequence: 'This violation has been recorded. Multiple violations may result in exam nullification.'
        };
      case 'window_blur':
        return {
          title: 'Window Focus Lost',
          description: 'You have switched to another application or window during the exam.',
          consequence: 'This violation has been recorded. Multiple violations may result in exam nullification.'
        };
      default:
        return {
          title: 'Proctoring Violation',
          description: 'A proctoring violation has been detected.',
          consequence: 'Your exam attempt has been nullified.'
        };
    }
  };

  const details = getViolationDetails(violationType);
  const isCritical = violationType === 'camera_disabled';
  const isFullscreenViolation = violationType === 'fullscreen_exit';
  const canDismiss = !isFullscreenViolation || isFullscreen;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="max-w-md mx-4 border-red-200">
        <CardHeader className="bg-red-50">
          <CardTitle className="flex items-center gap-2 text-red-800">
            {isCritical ? <XCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            {details.title}
          </CardTitle>
          <CardDescription className="text-red-700">
            {details.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <Alert variant={isCritical ? "destructive" : isFullscreenViolation ? "default" : "default"} className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Consequence:</strong> {details.consequence}
            </AlertDescription>
          </Alert>

          {isCritical && (
            <div className="bg-red-50 p-4 rounded-lg mb-4">
              <h4 className="font-medium text-red-900 mb-2">Your exam has been terminated due to:</h4>
              <ul className="text-sm text-red-800 space-y-1">
                <li>• Violation of proctoring requirements</li>
                <li>• Failure to maintain exam integrity standards</li>
                <li>• Automatic nullification of exam attempt</li>
              </ul>
            </div>
          )}

          {isFullscreenViolation && (
            <div className="bg-yellow-50 p-4 rounded-lg mb-4">
              <h4 className="font-medium text-yellow-900 mb-2">To continue the exam:</h4>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>• Click "Return to Fullscreen" below</li>
                <li>• Stay in fullscreen mode for the remainder of the exam</li>
                <li>• Additional fullscreen exits may result in nullification</li>
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2">
            {isFullscreenViolation && !isFullscreen && (
              <Button 
                onClick={onRequestFullscreen}
                variant="default"
              >
                Return to Fullscreen
              </Button>
            )}
            <Button 
              onClick={onClose}
              variant={isCritical ? "destructive" : "default"}
              disabled={!canDismiss}
            >
              {isCritical ? 'Return to Account' : isFullscreenViolation ? 'Continue Exam' : 'Continue Exam'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}