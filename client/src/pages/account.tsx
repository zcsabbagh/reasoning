import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Trophy, Clock, BookOpen, User, LogOut, BarChart3, Target, ClipboardCheck, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import VersionSelectionModal from "@/components/version-selection-modal";

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  linkedinId: string;
  profilePictureUrl?: string;
  totalScore: number;
}

interface TestSession {
  id: number;
  taskQuestion: string;
  finalAnswer: string | null;
  timeRemaining: number;
  questionsAsked: number;
  isSubmitted: boolean;
  baseScore: number;
  questionPenalty: number;
  infoGainBonus: number;
  finalScore: number | null; // Actual score from AI grading
  currentQuestionIndex: number;
  allQuestions: string[];
  allAnswers: string[];
  createdAt: string;
}

export default function Account() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showVersionModal, setShowVersionModal] = useState(false);
  
  // Results modal state
  const [showResults, setShowResults] = useState(false);
  const [selectedSession, setSelectedSession] = useState<TestSession | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [grades, setGrades] = useState<number[]>([]);
  const [detailedGrades, setDetailedGrades] = useState<any[]>([]);

  // Get current user
  const { data: user, isLoading: userLoading, error: userError } = useQuery<User>({
    queryKey: ["/auth/user"],
    retry: false
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!userLoading && (userError || !user)) {
      setLocation("/login");
    }
  }, [userLoading, userError, user, setLocation]);

  // Get user's test sessions/exam history
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<TestSession[]>({
    queryKey: ["/api/user/sessions"],
    enabled: !!user
  });

  // Create new exam session mutation
  const createExamMutation = useMutation({
    mutationFn: async () => {
      console.log('=== MUTATION START: Creating new exam session ===');
      try {
        // Get a random question first
        console.log('Step 1: Fetching random question...');
        console.log('About to make API request to /api/questions/random');
        console.log('Current location:', window.location.href);
        const questionResponse = await apiRequest("GET", "/api/questions/random");
        console.log('Step 1 Response received:', questionResponse);
        console.log('Step 1 Response status:', questionResponse.status, questionResponse.ok);
        if (!questionResponse.ok) {
          const errorText = await questionResponse.text();
          console.error('Step 1 FAILED - Question fetch error:', questionResponse.status, errorText);
          throw new Error(`Failed to fetch question: ${questionResponse.status} - ${errorText}`);
        }
        const randomQuestion = await questionResponse.json();
        console.log('Step 1 SUCCESS - Random question received:', randomQuestion);
        
        // Create new session
        console.log('Creating test session...');
        const sessionData = {
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
        };
        console.log('Session data to send:', sessionData);
        
        const response = await apiRequest("POST", "/api/test-sessions", sessionData);
        console.log('Step 2 Response status:', response.status, response.ok);
        
        if (!response.ok) {
          let errorText;
          try {
            errorText = await response.text();
          } catch (e) {
            errorText = 'Unable to read error response';
          }
          console.error('Step 2 FAILED - Session creation failed:', response.status, errorText);
          console.error('Request headers:', Object.fromEntries(response.headers.entries()));
          console.error('Session data sent:', sessionData);
          throw new Error(`Failed to create session: ${response.status} - ${errorText}`);
        }
        
        const session = await response.json();
        console.log('Step 2 SUCCESS - Test session created:', session);
        console.log('=== MUTATION SUCCESS: Returning session ===');
        return session;
      } catch (error) {
        console.error('Error creating exam session:', error);
        console.error('Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : 'No stack trace',
          type: typeof error,
          error: error
        });
        throw error;
      }
    },
    onSuccess: (session) => {
      console.log('=== MUTATION SUCCESS HANDLER START ===');
      console.log('Session created successfully:', session);
      console.log('Session ID:', session.id);
      console.log('About to navigate to exam prep...');
      try {
        setShowVersionModal(false); // Close the version selection modal
        setLocation(`/exam-prep/${session.id}`);
        console.log('Navigation successful');
      } catch (navError) {
        console.error('Navigation error:', navError);
        throw navError;
      }
      console.log('=== MUTATION SUCCESS HANDLER END ===');
    },
    onError: (error) => {
      console.error('=== MUTATION ERROR HANDLER START ===');
      console.error('Mutation error details:', error);
      console.error('Error type:', typeof error);
      console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
      toast({
        title: "Error",
        description: "Failed to create exam session. Please try again.",
        variant: "destructive",
      });
      console.error('=== MUTATION ERROR HANDLER END ===');
    }
  });

  const handleLogout = () => {
    window.location.href = "/auth/logout";
  };

  const handleStartExam = () => {
    console.log('=== START EXAM BUTTON CLICKED ===');
    // Show version selection modal instead of directly creating exam
    setShowVersionModal(true);
  };

  const handleVersionSelection = async (version: string) => {
    console.log('=== VERSION SELECTED ===', version);
    
    if (version === "v0") {
      // V0 - Current exam system
      console.log('User:', user);
      console.log('Mutation state:', {
        isPending: createExamMutation.isPending,
        isError: createExamMutation.isError,
        isSuccess: createExamMutation.isSuccess,
        error: createExamMutation.error
      });
      console.log('About to call mutate...');
      try {
        createExamMutation.mutate();
        console.log('Mutate called successfully');
      } catch (error) {
        console.error('Error calling mutate:', error);
      }
    } else if (version === "v1") {
      // V1 - Enhanced exam system
      console.log('Starting V1 exam session...');
      setShowVersionModal(false);
      
      // Start a V1 exam session
      try {
        const response = await apiRequest("POST", "/api/v1/sessions/start", {});
        if (response.ok) {
          const session = await response.json();
          console.log('V1 session created:', session);
          setLocation(`/exam-v1/${session.id}`);
        } else {
          console.error('Failed to start V1 session:', response.status);
          toast({
            title: "Error",
            description: "Failed to start V1 exam session. Please try again.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error starting V1 session:', error);
        toast({
          title: "Error",
          description: "Failed to start V1 exam session. Please try again.",
          variant: "destructive",
        });
      }
    } else {
      // V2 is not yet implemented
      toast({
        title: "Version Not Available",
        description: `${version.toUpperCase()} is coming soon. Please select V0 or V1 for now.`,
        variant: "destructive",
      });
    }
  };

  const getSessionStatus = (session: TestSession) => {
    if (session.isSubmitted) {
      // Use the actual final score from grading if available, otherwise fall back to calculated score
      const totalScore = session.finalScore || (session.baseScore - session.questionPenalty + session.infoGainBonus);
      return { status: "completed", score: totalScore };
    }
    return { status: "incomplete", score: null };
  };

  const isSessionTimeElapsed = (session: TestSession) => {
    // Calculate time elapsed since session was created
    const sessionCreatedAt = new Date(session.createdAt);
    const now = new Date();
    const timeElapsed = now.getTime() - sessionCreatedAt.getTime();
    
    // Each exam has 30 minutes total (3 questions x 10 minutes each)
    const totalTimeAllowed = 30 * 60 * 1000; // 30 minutes in milliseconds
    
    return timeElapsed > totalTimeAllowed;
  };

  const handleContinueSession = async (session: TestSession) => {
    if (isSessionTimeElapsed(session)) {
      // Time has elapsed - show results modal
      setSelectedSession(session);
      setIsGrading(true);
      setShowResults(true);
      
      try {
        // Grade the session
        const response = await apiRequest("POST", `/api/test-sessions/${session.id}/grade`);
        const result = await response.json();
        
        setGrades(result.grades);
        setDetailedGrades(result.detailedGrades || []);
        setIsGrading(false);
      } catch (error) {
        console.error("Error grading session:", error);
        setIsGrading(false);
        toast({
          title: "Grading Error",
          description: "Failed to grade your session. Please try again.",
          variant: "destructive",
        });
      }
    } else {
      // Time hasn't elapsed - continue to test platform
      // Store session ID in localStorage for test platform to pick up
      localStorage.setItem('currentExamSessionId', session.id.toString());
      setLocation('/test');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Redirect to login if not authenticated
  if (!userLoading && !user) {
    setLocation("/login");
    return null;
  }

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading your account...</p>
        </div>
      </div>
    );
  }

  const completedSessions = sessions.filter(s => s.isSubmitted);
  const incompleteSessions = sessions.filter(s => !s.isSubmitted);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-slate-800">Hinton</h1>

          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              {user?.profilePictureUrl && (
                <img
                  src={user.profilePictureUrl}
                  alt={`${user.firstName} ${user.lastName}`}
                  className="w-8 h-8 rounded-full"
                />
              )}
              <div className="text-right">
                <p className="text-sm font-medium text-slate-800">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-slate-600">{user?.email}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="text-slate-600 hover:text-slate-800"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* User Stats */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Your Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <Trophy className="w-6 h-6 text-yellow-500" />
                    <span className="text-2xl font-bold text-slate-800">{user?.totalScore}</span>
                  </div>
                  <p className="text-sm text-slate-600">Total Score</p>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Exams Completed</span>
                    <Badge variant="secondary">{completedSessions.length}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">In Progress</span>
                    <Badge variant="outline">{incompleteSessions.length}</Badge>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Button
                    onClick={handleStartExam}
                    disabled={createExamMutation.isPending}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    size="lg"
                  >
                    {createExamMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Preparing Exam...
                      </>
                    ) : (
                      <>
                        <BookOpen className="w-4 h-4 mr-2" />
                        Start New Exam
                      </>
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => setLocation("/rankings")}
                    className="w-full border-purple-200 text-purple-700 hover:bg-purple-50"
                    size="lg"
                  >
                    <Trophy className="w-4 h-4 mr-2" />
                    View Global Rankings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Exam History */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2" />
                  Exam History
                </CardTitle>
                <CardDescription>
                  Your previous exam attempts and scores
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sessionsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-slate-600">Loading exam history...</p>
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="text-center py-12">
                    <Target className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-600 mb-2">No exams taken yet</p>
                    <p className="text-sm text-slate-500">Click "Start New Exam" to begin your first assessment</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sessions.map((session) => {
                      const { status, score } = getSessionStatus(session);
                      return (
                        <div
                          key={session.id}
                          className="border rounded-lg p-4 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <Badge 
                                  variant={status === "completed" ? "default" : "secondary"}
                                  className={status === "completed" ? "bg-green-100 text-green-800" : ""}
                                >
                                  {status === "completed" ? "Completed" : "In Progress"}
                                </Badge>
                                {status === "completed" && score !== null && (
                                  <Badge variant="outline" className="text-blue-600 border-blue-600">
                                    Score: {score}/25
                                  </Badge>
                                )}
                              </div>
                              
                              <p className="text-sm text-slate-800 mb-2 line-clamp-2">
                                {session.taskQuestion}
                              </p>
                              
                              <div className="flex items-center space-x-4 text-xs text-slate-500">
                                <span className="flex items-center">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {formatDate(session.createdAt)}
                                </span>
                                <span>Questions Asked: {session.questionsAsked}</span>
                              </div>
                            </div>
                            
                            {status === "incomplete" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleContinueSession(session)}
                              >
                                {isSessionTimeElapsed(session) ? "View Results" : "Continue"}
                              </Button>
                            ) : (
                              <div className="text-right">
                                <div className="text-xs text-slate-500 mb-1">Score Breakdown</div>
                                <div className="space-y-1 text-xs">
                                  <div className="flex justify-between">
                                    <span>Base Score:</span>
                                    <span>+{session.baseScore}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Question Penalty:</span>
                                    <span>-{session.questionPenalty}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Info Bonus:</span>
                                    <span>+{session.infoGainBonus}</span>
                                  </div>
                                  <div className="flex justify-between font-semibold border-t pt-1">
                                    <span>Total:</span>
                                    <span>{score}/25</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        
        <div className="mt-8">
          <Alert>
            <BarChart3 className="h-4 w-4" />
            <AlertDescription>
              <strong>How scoring works:</strong> Each exam starts with 25 points. You lose 1 point for each clarifying question asked (max 3), 
              but gain bonus points for information that improves your answer quality. Check the{" "}
              <button 
                onClick={() => setLocation("/rankings")} 
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Rankings page
              </button>{" "}
              to see how you compare with other users.
            </AlertDescription>
          </Alert>
        </div>
      </div>

      {/* Results Modal */}
      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                  <ClipboardCheck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Exam Results</h3>
                  <p className="text-sm text-slate-600">Your performance and detailed feedback</p>
                </div>
              </div>
              <Button 
                onClick={() => {
                  setShowResults(false);
                  setSelectedSession(null);
                }}
                variant="outline"
                className="text-blue-600 border-blue-600 hover:bg-blue-600 hover:text-white"
              >
                Close
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          {isGrading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
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
                    <div className="text-4xl font-bold text-blue-600">
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
                          {selectedSession?.allQuestions[index]}
                        </p>
                      </div>
                      <div className="ml-4 text-right">
                        <div className="text-3xl font-bold text-blue-600">{detailedGrade.score}</div>
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
                    setSelectedSession(null);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2"
                >
                  Close Results
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Version Selection Modal */}
      <VersionSelectionModal
        isOpen={showVersionModal}
        onClose={() => setShowVersionModal(false)}
        onSelectVersion={handleVersionSelection}
        isLoading={createExamMutation.isPending}
      />
    </div>
  );
}