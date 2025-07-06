import { useState, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mic, MicOff, Clock, Shield, AlertTriangle, CheckCircle, Play } from 'lucide-react';

export default function ExamPrep() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute('/exam-prep/:sessionId');
  const [micPermission, setMicPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [canStartExam, setCanStartExam] = useState(false);

  const sessionId = params?.sessionId;

  useEffect(() => {
    if (!sessionId) {
      setLocation('/account');
      return;
    }
  }, [sessionId, setLocation]);

  const requestMicrophoneAccess = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermission('granted');
      setStream(mediaStream);
      setCanStartExam(true);
      
      // Set up audio level monitoring
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(mediaStream);
      
      microphone.connect(analyser);
      analyser.fftSize = 256;
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const updateAudioLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const average = sum / bufferLength;
        setAudioLevel(average);
        
        if (isTestingMic) {
          requestAnimationFrame(updateAudioLevel);
        }
      };
      
      updateAudioLevel();
    } catch (error) {
      console.error('Microphone access denied:', error);
      setMicPermission('denied');
    }
  };

  const testMicrophone = async () => {
    if (!stream) return;
    
    setIsTestingMic(true);
    setTimeout(() => {
      setIsTestingMic(false);
    }, 5000);
  };

  const stopMicTest = () => {
    setIsTestingMic(false);
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
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
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-sm font-medium">Audio Level:</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-500 h-2 rounded-full transition-all duration-100"
                              style={{ width: `${Math.min(audioLevel * 2, 100)}%` }}
                            />
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">
                          Speak into your microphone. You should see the audio level bar move.
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
                  <Shield className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">AI Monitoring</h4>
                    <p className="text-sm text-gray-600">
                      All responses will be analyzed by AI detection systems including Cluely to ensure academic integrity and prevent cheating.
                    </p>
                  </div>
                </div>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Academic Integrity:</strong> Any form of cheating, plagiarism, or unauthorized assistance will result in exam disqualification.
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