import { useState, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mic, MicOff, Clock, Shield, AlertTriangle, CheckCircle, Play, Monitor } from 'lucide-react';
import ProctoringSetup from '@/components/proctoring-setup';

export default function ExamPrep() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute('/exam-prep/:sessionId');
  const [micPermission, setMicPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [smoothedAudioLevel, setSmoothedAudioLevel] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [canStartExam, setCanStartExam] = useState(false);
  const [proctoringReady, setProctoringReady] = useState(false);
  const [showProctoringViolation, setShowProctoringViolation] = useState(false);
  const [violationMessage, setViolationMessage] = useState('');

  const sessionId = params?.sessionId;

  useEffect(() => {
    if (!sessionId) {
      setLocation('/account');
      return;
    }
  }, [sessionId, setLocation]);

  const requestMicrophoneAccess = async () => {
    try {
      console.log('Requesting microphone access...');
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      console.log('Microphone access granted');
      setMicPermission('granted');
      setStream(mediaStream);
      // Only allow starting exam if both microphone and proctoring are ready
      setCanStartExam(proctoringReady);
    } catch (error) {
      console.error('Microphone access denied:', error);
      setMicPermission('denied');
    }
  };

  const testMicrophone = async () => {
    if (!stream) {
      console.error('No stream available for testing');
      return;
    }
    
    console.log('Starting microphone test...');
    setIsTestingMic(true);
    setAudioLevel(0);
    window.audioTestStart = Date.now();
    
    try {
      // Ensure the stream is active
      const tracks = stream.getAudioTracks();
      console.log('Audio tracks:', tracks.length, tracks.map(t => ({ enabled: t.enabled, readyState: t.readyState })));
      
      // Create a fresh audio context
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      console.log('Audio context state:', audioContext.state);
      
      // Resume context if suspended (required in some browsers)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
        console.log('Audio context resumed');
      }
      
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      microphone.connect(analyser);
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.3;
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      console.log('Audio analysis setup complete, buffer length:', bufferLength);
      
      let animationFrame: number;
      let frameCount = 0;
      let isRunning = true; // Local variable to control the loop
      
      const updateAudioLevel = () => {
        if (!isRunning) {
          console.log('Animation loop stopped');
          return;
        }
        
        frameCount++;
        analyser.getByteTimeDomainData(dataArray);
        
        // Calculate volume using time domain data
        let sum = 0;
        let max = 0;
        for (let i = 0; i < bufferLength; i++) {
          const sample = Math.abs(dataArray[i] - 128);
          sum += sample;
          max = Math.max(max, sample);
        }
        
        const average = sum / bufferLength;
        const volume = Math.min(average * 2, 100); // Scale for better visibility
        
        // Log every 30 frames for debugging (or first few frames)
        if (frameCount <= 5 || frameCount % 30 === 0) {
          console.log(`Frame ${frameCount}: Volume=${volume.toFixed(1)}%, Avg=${average.toFixed(1)}, Max=${max}, Sample=${dataArray[0]}`);
        }
        
        setAudioLevel(volume);
        
        // Apply smoothing to reduce flickering - exponential moving average
        setSmoothedAudioLevel(prev => {
          const smoothingFactor = 0.3; // Higher value = more responsive, lower = smoother
          return prev * (1 - smoothingFactor) + volume * smoothingFactor;
        });
        
        // Continue animation loop
        animationFrame = requestAnimationFrame(updateAudioLevel);
      };
      
      console.log('Starting animation loop...');
      updateAudioLevel();
      
      // Store the timer ID to track it
      const testTimer = setTimeout(() => {
        console.log('Microphone test complete - timer expired');
        isRunning = false;
        setIsTestingMic(false);
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
        }
        audioContext.close();
      }, 15000);
      
      console.log('Test timer set for 15 seconds');
      
    } catch (error) {
      console.error('Error setting up microphone test:', error);
      setIsTestingMic(false);
    }
  };

  const stopMicTest = () => {
    setIsTestingMic(false);
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleProctoringReady = (isReady: boolean) => {
    setProctoringReady(isReady);
    // Update exam start readiness based on both microphone and proctoring
    setCanStartExam(micPermission === 'granted' && isReady);
  };

  const handleProctoringViolation = (type: string, severity: string) => {
    setViolationMessage(`${type.replace('_', ' ')} detected (${severity})`);
    setShowProctoringViolation(true);
  };

  const startExam = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    // Store session ID in localStorage for the test page
    if (sessionId) {
      localStorage.setItem('currentExamSessionId', sessionId);
    }
    setLocation(`/test`);
  };

  const goBack = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setLocation('/account');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Exam Preparation</h1>
          <p className="text-gray-600">Please review the instructions and test your microphone before beginning</p>
        </div>

        {/* Proctoring Setup */}
        <div className="mb-8">
          <ProctoringSetup 
            onReady={handleProctoringReady}
            onViolation={handleProctoringViolation}
          />
        </div>

        {/* Proctoring Violation Alert */}
        {showProctoringViolation && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Proctoring Violation:</strong> {violationMessage}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Microphone Test */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Mic className="w-5 h-5 mr-2" />
                Microphone Test
              </CardTitle>
              <CardDescription>
                Test your microphone to ensure voice recording works properly during the exam
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {micPermission === 'pending' && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Click "Allow Microphone Access" to enable voice recording for this exam.
                  </AlertDescription>
                </Alert>
              )}

              {micPermission === 'denied' && (
                <Alert variant="destructive">
                  <MicOff className="h-4 w-4" />
                  <AlertDescription>
                    Microphone access was denied. Please enable microphone permissions in your browser settings and refresh the page.
                  </AlertDescription>
                </Alert>
              )}

              {micPermission === 'granted' && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Microphone access granted successfully!
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col space-y-3">
                {micPermission === 'pending' && (
                  <Button onClick={requestMicrophoneAccess} className="w-full">
                    <Mic className="w-4 h-4 mr-2" />
                    Allow Microphone Access
                  </Button>
                )}

                {micPermission === 'granted' && (
                  <>
                    <Button 
                      onClick={testMicrophone} 
                      disabled={isTestingMic}
                      variant="outline"
                      className="w-full"
                    >
                      {isTestingMic ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                          Testing... ({5 - Math.floor(Date.now() / 1000) % 5}s)
                        </>
                      ) : (
                        <>
                          <Mic className="w-4 h-4 mr-2" />
                          Test Microphone
                        </>
                      )}
                    </Button>

                    {isTestingMic && (
                      <div className="bg-gray-100 p-4 rounded-lg">
                        <div className="flex items-center space-x-3 mb-3">
                          <Mic className="w-5 h-5 text-gray-600" />
                          <span className="text-sm font-medium">Audio Level</span>
                          <div className="flex-1 flex items-end space-x-1 h-8">
                            {Array.from({ length: 10 }, (_, i) => {
                              const barLevel = (i + 1) * 1; // Each bar represents 1% increment for sensitive detection
                              const isActive = smoothedAudioLevel >= barLevel;
                              let barColor = 'bg-gray-300';
                              
                              if (isActive) {
                                if (i < 3) barColor = 'bg-green-500';      // First 3 bars: green (good detection)
                                else if (i < 6) barColor = 'bg-blue-500';  // Next 3 bars: blue (strong signal)
                                else barColor = 'bg-purple-500';          // Last 4 bars: purple (very strong)
                              }
                              
                              return (
                                <div
                                  key={i}
                                  className={`w-3 transition-all duration-75 ${barColor}`}
                                  style={{ 
                                    height: `${Math.min((i + 1) * 8, 32)}px`,
                                    opacity: isActive ? 1 : 0.3
                                  }}
                                />
                              );
                            })}
                          </div>
                          <span className="text-xs text-gray-500 w-12 text-right">
                            {Math.round(audioLevel)}%
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          Speak into your microphone. You should see green bars when your voice is detected.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Exam Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="w-5 h-5 mr-2" />
                Exam Instructions
              </CardTitle>
              <CardDescription>
                Important information about your upcoming exam
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">30 Minutes Total</h4>
                    <p className="text-sm text-gray-600">
                      You have 30 minutes to complete all questions. The exam will auto-submit when time expires.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">No Pausing</h4>
                    <p className="text-sm text-gray-600">
                      Once started, the exam cannot be paused. Ensure you have a quiet environment and stable internet connection.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Monitor className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Proctoring & AI Monitoring</h4>
                    <p className="text-sm text-gray-600">
                      Camera monitoring and fullscreen requirement ensure exam integrity. AI systems also analyze all responses for academic integrity.
                    </p>
                  </div>
                </div>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Academic Integrity:</strong> Any form of cheating, plagiarism, unauthorized assistance, or proctoring violations will result in immediate exam nullification.
                </AlertDescription>
              </Alert>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">What You Can Do:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Ask up to 3 clarifying questions per question</li>
                  <li>• Use voice recording to answer questions</li>
                  <li>• Take notes on paper (not digitally)</li>
                </ul>
              </div>

              <div className="bg-red-50 p-4 rounded-lg">
                <h4 className="font-medium text-red-900 mb-2">Proctoring Requirements:</h4>
                <ul className="text-sm text-red-800 space-y-1">
                  <li>• Camera must remain on throughout the exam</li>
                  <li>• Must stay in fullscreen mode</li>
                  <li>• Switching tabs or applications will be flagged</li>
                  <li>• Violations result in immediate exam nullification</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center mt-8">
          <Button variant="outline" onClick={goBack}>
            Back to Account
          </Button>
          
          <div className="flex items-center space-x-4">
            {canStartExam && (
              <Badge variant="default" className="bg-green-100 text-green-800">
                <CheckCircle className="w-3 h-3 mr-1" />
                Ready to Start
              </Badge>
            )}
            
            {!canStartExam && (
              <div className="flex items-center space-x-2 text-gray-600">
                <div className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${micPermission === 'granted' ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="text-sm">Microphone</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${proctoringReady ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="text-sm">Proctoring</span>
                </div>
              </div>
            )}
            
            <Button 
              onClick={startExam} 
              disabled={!canStartExam}
              className="bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Exam
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}