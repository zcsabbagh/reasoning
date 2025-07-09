import { useState, useEffect } from 'react';
import { Camera, Monitor, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useProctoring } from '@/hooks/use-proctoring';

interface ProctoringSetupProps {
  onReady: (isReady: boolean) => void;
  onViolation?: (type: string, severity: string) => void;
}

export default function ProctoringSetup({ onReady, onViolation }: ProctoringSetupProps) {
  const [setupStep, setSetupStep] = useState<'camera' | 'fullscreen' | 'ready'>('camera');
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(false);
  const [fullscreenEnabled, setFullscreenEnabled] = useState(false);
  const [isTestingCamera, setIsTestingCamera] = useState(false);
  const [isTestingFullscreen, setIsTestingFullscreen] = useState(false);

  const {
    state,
    videoRef,
    requestCameraAccess,
    requestFullscreen
  } = useProctoring({
    onViolation: onViolation
  });

  // Test camera access
  const handleCameraTest = async () => {
    setIsTestingCamera(true);
    try {
      const success = await requestCameraAccess();
      setCameraPermissionGranted(success);
      if (success) {
        setSetupStep('fullscreen');
      }
    } catch (error) {
      console.error('Camera test failed:', error);
    } finally {
      setIsTestingCamera(false);
    }
  };

  // Test fullscreen mode
  const handleFullscreenTest = async () => {
    setIsTestingFullscreen(true);
    try {
      const success = await requestFullscreen();
      setFullscreenEnabled(success);
      if (success) {
        setSetupStep('ready');
      }
    } catch (error) {
      console.error('Fullscreen test failed:', error);
    } finally {
      setIsTestingFullscreen(false);
    }
  };

  // Check if both requirements are met
  useEffect(() => {
    const isReady = cameraPermissionGranted && fullscreenEnabled && state.cameraEnabled && state.fullscreenActive;
    onReady(isReady);
  }, [cameraPermissionGranted, fullscreenEnabled, state.cameraEnabled, state.fullscreenActive, onReady]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreen = Boolean(document.fullscreenElement);
      setFullscreenEnabled(isFullscreen);
      if (!isFullscreen && setupStep === 'ready') {
        setSetupStep('fullscreen');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [setupStep]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            Proctoring Setup Required
          </CardTitle>
          <CardDescription>
            To maintain exam integrity, we need to verify your camera and require fullscreen mode.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Camera Setup */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${
                cameraPermissionGranted && state.cameraEnabled 
                  ? 'bg-green-100 text-green-600' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                <Camera className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium">Camera Access</h3>
                <p className="text-sm text-gray-600">
                  We need access to your camera to monitor the exam environment.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {cameraPermissionGranted && state.cameraEnabled ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                <Button
                  onClick={handleCameraTest}
                  disabled={isTestingCamera || (cameraPermissionGranted && state.cameraEnabled)}
                  size="sm"
                  variant={cameraPermissionGranted && state.cameraEnabled ? "outline" : "default"}
                >
                  {isTestingCamera ? 'Testing...' : 
                   cameraPermissionGranted && state.cameraEnabled ? 'Granted' : 'Grant Access'}
                </Button>
              </div>
            </div>

            {/* Camera preview */}
            {state.cameraEnabled && (
              <div className="bg-gray-100 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">Camera Preview:</p>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  className="w-full max-w-md h-48 bg-black rounded-lg mx-auto"
                />
              </div>
            )}
          </div>

          {/* Fullscreen Setup */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${
                fullscreenEnabled && state.fullscreenActive 
                  ? 'bg-green-100 text-green-600' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                <Monitor className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium">Fullscreen Mode</h3>
                <p className="text-sm text-gray-600">
                  The exam must be taken in fullscreen mode to prevent cheating.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {fullscreenEnabled && state.fullscreenActive ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                <Button
                  onClick={handleFullscreenTest}
                  disabled={isTestingFullscreen || !cameraPermissionGranted || (fullscreenEnabled && state.fullscreenActive)}
                  size="sm"
                  variant={fullscreenEnabled && state.fullscreenActive ? "outline" : "default"}
                >
                  {isTestingFullscreen ? 'Enabling...' : 
                   fullscreenEnabled && state.fullscreenActive ? 'Active' : 'Enable Fullscreen'}
                </Button>
              </div>
            </div>
          </div>

          {/* Error messages */}
          {state.error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          {/* Success message */}
          {cameraPermissionGranted && state.cameraEnabled && fullscreenEnabled && state.fullscreenActive && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Proctoring setup complete! You can now proceed with the exam.
              </AlertDescription>
            </Alert>
          )}

          {/* Important notes */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-2">Important Notes:</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Your camera will monitor the exam environment throughout the test</li>
              <li>• Exiting fullscreen mode will result in immediate exam nullification</li>
              <li>• Turning off your camera will result in immediate exam nullification</li>
              <li>• Switching tabs or applications will be recorded as violations</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}