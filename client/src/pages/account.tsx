import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Trophy, Clock, BookOpen, User, LogOut, BarChart3, Target } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  currentQuestionIndex: number;
  allQuestions: string[];
  allAnswers: string[];
  createdAt: string;
}

export default function Account() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Get current user
  const { data: user, isLoading: userLoading, error: userError } = useQuery<User>({
    queryKey: ["/auth/user"],
    retry: false
  });

  // Redirect to login if not authenticated
  if (!userLoading && (userError || !user)) {
    setLocation("/login");
    return null;
  }

  // Get user's test sessions/exam history
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<TestSession[]>({
    queryKey: ["/api/user/sessions"],
    enabled: !!user
  });

  // Create new exam session mutation
  const createExamMutation = useMutation({
    mutationFn: async () => {
      console.log('Creating new exam session...');
      try {
        // Get a random question first
        console.log('Fetching random question...');
        const questionResponse = await apiRequest("GET", "/api/questions/random", {});
        if (!questionResponse.ok) {
          throw new Error(`Failed to fetch question: ${questionResponse.status}`);
        }
        const randomQuestion = await questionResponse.json();
        console.log('Random question received:', randomQuestion);
        
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
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Session creation failed:', response.status, errorText);
          throw new Error(`Failed to create session: ${response.status} - ${errorText}`);
        }
        
        const session = await response.json();
        console.log('Test session created:', session);
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
      console.log('Redirecting to exam prep with session:', session.id);
      setLocation(`/exam-prep/${session.id}`);
    },
    onError: (error) => {
      console.error('Mutation error:', error);
      toast({
        title: "Error",
        description: "Failed to create exam session. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleLogout = () => {
    window.location.href = "/auth/logout";
  };

  const handleStartExam = () => {
    console.log('Start New Exam button clicked');
    console.log('User:', user);
    console.log('Mutation pending:', createExamMutation.isPending);
    createExamMutation.mutate();
  };

  const getSessionStatus = (session: TestSession) => {
    if (session.isSubmitted) {
      const totalScore = session.baseScore - session.questionPenalty + session.infoGainBonus;
      return { status: "completed", score: totalScore };
    }
    return { status: "incomplete", score: null };
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
            <Badge variant="outline" className="text-blue-600 border-blue-600">
              Academic Testing Platform
            </Badge>
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
                                onClick={() => setLocation(`/test/${session.id}`)}
                              >
                                Continue
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
    </div>
  );
}