import { useState, useEffect, useCallback, useRef } from "react";
import { ClipboardCheck, Info, AlertTriangle, Loader2, LogOut, User } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import TestTimer from "@/components/test-timer";
import ChatInterface from "@/components/chat-interface";
import AnswerSection from "@/components/answer-section";
import type { TestSession } from "@shared/schema";

export default function TestPlatform() {
  const [session, setSession] = useState<TestSession | null>(null);
  const [showTimeWarning, setShowTimeWarning] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Check authentication
  const { data: user, isLoading: userLoading, error: userError } = useQuery<{
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    linkedinId: string;
    profilePictureUrl?: string;
  }>({
    queryKey: ["/auth/user"],
    retry: false
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!userLoading && (userError || !user)) {
      setLocation("/login");
    }
  }, [user, userLoading, userError, setLocation]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isGrading, setIsGrading] = useState(false);
  const [grades, setGrades] = useState<number[]>([]);
  const [detailedGrades, setDetailedGrades] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const loadExistingSession = async (sessionId: number) => {
    try {
      console.log(`Attempting to load session with ID: ${sessionId}`);
      const response = await apiRequest("GET", `/api/test-sessions/${sessionId}`);
      console.log('Session load response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Failed to load session: ${response.status}`);
      }
      
      const existingSession = await response.json();
      console.log('Loaded session successfully:', existingSession);
      setSession(existingSession);
    } catch (error) {
      console.error("Failed to load existing session:", error);
      toast({
        title: "Error",
        description: "Failed to initialize test session. Please refresh the page.",
        variant: "destructive",
      });
      // Don't fall back to creating a new session - redirect to account
      setLocation('/account');
      return;
    } finally {
      setIsLoading(false);
    }
  };

  const initializeSession = async () => {
    try {
      // First, get a random question from the database
      const questionResponse = await apiRequest("GET", "/api/questions/random", {});
      const randomQuestion = await questionResponse.json();
      
      // Create session with the random question
      const response = await apiRequest("POST", "/api/test-sessions", {
        taskQuestion: randomQuestion.questionText,
        finalAnswer: "",
        timeRemaining: 600,
        questionsAsked: 0,
        isSubmitted: false,
        baseScore: 25,
        questionPenalty: 0,
        infoGainBonus: 0,
        currentQuestionIndex: 0,
        allQuestions: [randomQuestion.questionText],
        allAnswers: ["", "", ""]
      });
      
      const newSession = await response.json();
      setSession(newSession);
    } catch (error) {
      console.error("Failed to initialize session:", error);
      toast({
        title: "Error",
        description: "Failed to initialize test session. Please refresh the page.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user || userLoading) return; // Wait for authentication
    
    // Check if there's a session ID in localStorage
    const sessionId = localStorage.getItem('currentExamSessionId');
    console.log('Retrieved session ID from localStorage:', sessionId);
    
    if (sessionId) {
      console.log('Loading existing session with ID:', sessionId);
      loadExistingSession(parseInt(sessionId));
    } else {
      console.log('No session ID found, redirecting to account');
      // Redirect to account if no session ID
      setLocation('/account');
    }
  }, [setLocation, user, userLoading]);

  const updateSession = async (updates: Partial<TestSession>) => {
    if (!session) return;
    
    try {
      const response = await apiRequest("PATCH", `/api/test-sessions/${session.id}`, updates);
      const updatedSession = await response.json();
      setSession(updatedSession);
    } catch (error) {
      console.error("Failed to update session:", error);
    }
  };

  const gradeTest = async (sessionId: number) => {
    try {
      setIsGrading(true);
      setShowResults(true);
      
      const response = await apiRequest("POST", `/api/test-sessions/${sessionId}/grade`);
      const result = await response.json();
      
      setGrades(result.grades);
      setDetailedGrades(result.detailedGrades || []);
      setIsGrading(false);
    } catch (error) {
      console.error("Error grading test:", error);
      setIsGrading(false);
      toast({
        title: "Grading Error",
        description: "Failed to grade your test. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAnswerChange = useCallback((answer: string) => {
    if (!session) return;
    
    // Update local state immediately for smooth typing
    setSession(prev => prev ? { ...prev, finalAnswer: answer } : null);
    
    // Clear previous timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // Debounce the API call to reduce server requests
    debounceRef.current = setTimeout(() => {
      updateSession({ finalAnswer: answer });
    }, 500);
  }, [session?.id]);

  const handleSubmitAnswer = async (answer: string) => {
    if (!session) return;

    // Update the current answer in the allAnswers array
    const newAnswers = [...session.allAnswers];
    newAnswers[session.currentQuestionIndex] = answer;
    
    await updateSession({ 
      finalAnswer: answer,
      allAnswers: newAnswers,
      isSubmitted: session.currentQuestionIndex === 2 // Only mark as submitted on the last question
    });
    
    // If this isn't the last question, progress to next question
    if (session.currentQuestionIndex < 2) {
      try {
        const response = await apiRequest("POST", `/api/test-sessions/${session.id}/next-question`, {});
        const updatedSession = await response.json();
        setSession(updatedSession);
        
        toast({
          title: "Answer Saved",
          description: `Moving to question ${updatedSession.currentQuestionIndex + 1} of 3.`,
        });
      } catch (error) {
        console.error("Failed to progress to next question:", error);
        toast({
          title: "Error",
          description: "Failed to progress to next question.",
          variant: "destructive",
        });
      }
    } else {
      // Test completed - start grading
      gradeTest(session.id);
      toast({
        title: "Test Complete",
        description: "All questions have been answered. Grading your responses...",
      });
    }
  };

  const handleTimeUp = () => {
    if (session && !session.isSubmitted) {
      handleSubmitAnswer(session.finalAnswer || "");
      toast({
        title: "Time Up",
        description: "Time has expired. Your answer has been auto-submitted.",
        variant: "destructive",
      });
    }
  };

  const handleTimeWarning = () => {
    setShowTimeWarning(true);
  };

  const handleQuestionAsked = () => {
    // This will be handled by the ChatInterface component
  };

  const handleSessionUpdate = (updatedSession: TestSession) => {
    setSession(updatedSession);
  };


  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-academic-blue border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading test session...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-academic-red mx-auto mb-4" />
          <p className="text-slate-600">Failed to load test session. Please refresh the page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <ClipboardCheck className="w-5 h-5 text-academic-blue" />
                <h1 className="text-xl font-semibold text-slate-800">Hinton</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2 bg-slate-100 px-3 py-2 rounded-lg">
                <Info className="w-4 h-4 text-academic-blue" />
                <span className="text-sm font-medium text-slate-700">Questions Asked:</span>
                <span className="text-sm font-bold text-academic-blue">{session.questionsAsked}</span>
                <span className="text-sm text-slate-500">/ 3</span>
              </div>
              
              <TestTimer
                key={session.currentQuestionIndex}
                sessionId={session.id}
                onTimeUp={handleTimeUp}
                onTimeWarning={handleTimeWarning}
              />
              
              {/* User Info and Logout */}
              {user && (
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-700">
                      {user.firstName} {user.lastName}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.href = '/auth/logout'}
                    className="text-slate-600 hover:text-slate-800"
                  >
                    <LogOut className="w-4 h-4 mr-1" />
                    Logout
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          
          {/* Test Question and Answer */}
          <div className="lg:col-span-2 space-y-6">
            {/* Test Instructions */}
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="w-4 h-4 text-academic-blue" />
              <AlertDescription className="text-blue-800">
                <strong>Test Instructions:</strong> You have 10 minutes per question and may ask up to 3 clarifying questions to the AI assistant for each question.
              </AlertDescription>
            </Alert>

            {/* Current Question */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 bg-slate-100 px-2 py-1 rounded">
                    Question {session.currentQuestionIndex + 1} of 3
                  </span>
                </div>
              </div>
              
              <div className="px-6 py-6">
                <div className="prose max-w-none">
                  <p className="text-slate-700 leading-relaxed text-base">
                    <strong>Task:</strong> {session.taskQuestion}
                  </p>
                </div>
              </div>
            </div>

            {/* Answer Section */}
            <AnswerSection
              initialAnswer={session.currentAnswerDraft || session.finalAnswer || ""}
              onAnswerChange={handleAnswerChange}
              onSubmit={handleSubmitAnswer}
              isSubmitted={session.isSubmitted}
              sessionId={session.id}
            />
          </div>

          {/* Chat Interface */}
          <div className="lg:col-span-3">
            <ChatInterface
              sessionId={session.id}
              questionsAsked={session.questionsAsked}
              onQuestionAsked={handleQuestionAsked}
              onSessionUpdate={handleSessionUpdate}
            />
          </div>
        </div>
      </main>

      {/* Time Warning Modal */}
      <Dialog open={showTimeWarning} onOpenChange={setShowTimeWarning}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-academic-amber rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Time Warning</h3>
                <p className="text-sm text-slate-600">Only 5 minutes remaining!</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          <DialogDescription className="text-sm text-slate-600 mb-4">
            Please review your answer and submit before time runs out.
          </DialogDescription>
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowTimeWarning(false)}
            >
              Continue Working
            </Button>
            <Button
              onClick={() => {
                setShowTimeWarning(false);
                document.querySelector('textarea')?.focus();
              }}
              className="bg-academic-blue hover:bg-blue-700"
            >
              Review Answer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Results Modal */}
      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-academic-blue rounded-full flex items-center justify-center">
                  <ClipboardCheck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Test Results</h3>
                  <p className="text-sm text-slate-600">Your performance and detailed feedback</p>
                </div>
              </div>
              <Button 
                onClick={() => {
                  setShowResults(false);
                  setLocation('/account');
                }}
                variant="outline"
                className="text-academic-blue border-academic-blue hover:bg-academic-blue hover:text-white"
              >
                Back to Account
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          {isGrading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-academic-blue mb-4" />
              <p className="text-slate-600">Grading your answers...</p>
              <p className="text-sm text-slate-500">This may take a few moments</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Overall Score Summary */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">Overall Score</h3>
                    <p className="text-slate-600">Combined performance across all questions</p>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-bold text-academic-blue">
                      {grades.reduce((sum, grade) => sum + grade, 0)}
                    </div>
                    <div className="text-lg text-slate-500">out of {grades.length * 25}</div>
                  </div>
                </div>
              </div>

              {/* Detailed Question Breakdown */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-slate-800">Question-by-Question Breakdown</h3>
                {detailedGrades.map((detailedGrade, index) => (
                  <div key={index} className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
                    {/* Question Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-800 mb-2">Question {index + 1}</h4>
                        <p className="text-sm text-slate-600 leading-relaxed">
                          {session?.allQuestions[index]}
                        </p>
                      </div>
                      <div className="ml-4 text-right">
                        <div className="text-3xl font-bold text-academic-blue">{detailedGrade.score}</div>
                        <div className="text-sm text-slate-500">out of 25</div>
                      </div>
                    </div>

                    {/* AI Feedback */}
                    <div className="space-y-3">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <h5 className="font-medium text-blue-900 mb-2">AI Feedback</h5>
                        <p className="text-blue-800 text-sm leading-relaxed">{detailedGrade.feedback}</p>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        {/* Strengths */}
                        {detailedGrade.strengths && detailedGrade.strengths.length > 0 && (
                          <div className="bg-green-50 p-4 rounded-lg">
                            <h5 className="font-medium text-green-900 mb-2">Strengths</h5>
                            <ul className="space-y-1">
                              {detailedGrade.strengths.map((strength: string, idx: number) => (
                                <li key={idx} className="text-green-800 text-sm flex items-start">
                                  <span className="text-green-600 mr-2">•</span>
                                  {strength}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Areas for Improvement */}
                        {detailedGrade.improvements && detailedGrade.improvements.length > 0 && (
                          <div className="bg-orange-50 p-4 rounded-lg">
                            <h5 className="font-medium text-orange-900 mb-2">Areas for Improvement</h5>
                            <ul className="space-y-1">
                              {detailedGrade.improvements.map((improvement: string, idx: number) => (
                                <li key={idx} className="text-orange-800 text-sm flex items-start">
                                  <span className="text-orange-600 mr-2">•</span>
                                  {improvement}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center pt-4">
                <Button 
                  onClick={() => {
                    setShowResults(false);
                    setLocation('/account');
                  }}
                  className="bg-academic-blue hover:bg-blue-700 text-white px-8 py-2"
                >
                  Return to Account Dashboard
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
