import { AlertTriangle, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ProctoringViolationModalProps {
  isOpen: boolean;
  violationType: string;
  onClose: () => void;
}

export default function ProctoringViolationModal({ 
  isOpen, 
  violationType, 
  onClose 
}: ProctoringViolationModalProps) {
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
          title: 'Fullscreen Exited',
          description: 'You have exited fullscreen mode during the exam.',
          consequence: 'Your exam attempt has been nullified and removed from the database.'
        };
      case 'tab_switch':
        return {
          title: 'Tab Switch Detected',
          description: 'You have switched to another tab during the exam.',
          consequence: 'This violation has been recorded. Additional violations may result in nullification.'
        };
      case 'window_blur':
        return {
          title: 'Window Focus Lost',
          description: 'You have switched to another application during the exam.',
          consequence: 'This violation has been recorded. Additional violations may result in nullification.'
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
  const isCritical = violationType === 'camera_disabled' || violationType === 'fullscreen_exit';

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
          <Alert variant={isCritical ? "destructive" : "default"} className="mb-4">
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

          <div className="flex justify-end">
            <Button 
              onClick={onClose}
              variant={isCritical ? "destructive" : "default"}
            >
              {isCritical ? 'Return to Account' : 'Continue Exam'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}