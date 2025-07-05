import { useState, useEffect } from "react";
import { ClipboardCheck, Info, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import TestTimer from "@/components/test-timer";
import ChatInterface from "@/components/chat-interface";
import AnswerSection from "@/components/answer-section";
import ScoringPanel from "@/components/scoring-panel";
import type { TestSession } from "@shared/schema";

export default function TestPlatform() {
  const [session, setSession] = useState<TestSession | null>(null);
  const [showTimeWarning, setShowTimeWarning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    initializeSession();
  }, []);

  const initializeSession = async () => {
    try {
      const response = await apiRequest("POST", "/api/test-sessions", {
        taskQuestion: "Assume the printing press never spread beyond Mainz after 1450. Pick one European region and outline two major political or cultural consequences by 1700 (≤250 words).",
        finalAnswer: "",
        timeRemaining: 1800,
        questionsAsked: 0,
        isSubmitted: false,
        baseScore: 25,
        questionPenalty: 0,
        infoGainBonus: 0,
        currentQuestionIndex: 0,
        allQuestions: ["Assume the printing press never spread beyond Mainz after 1450. Pick one European region and outline two major political or cultural consequences by 1700 (≤250 words)."],
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

  const handleAnswerChange = (answer: string) => {
    updateSession({ finalAnswer: answer });
  };

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
      toast({
        title: "Test Complete",
        description: "All questions have been answered successfully.",
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
                <h1 className="text-xl font-semibold text-slate-800">Academic Test Platform</h1>
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
                initialTime={session.timeRemaining}
                onTimeUp={handleTimeUp}
                onTimeWarning={handleTimeWarning}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Test Question and Answer */}
          <div className="lg:col-span-2 space-y-6">
            {/* Test Instructions */}
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="w-4 h-4 text-academic-blue" />
              <AlertDescription className="text-blue-800">
                <strong>Test Instructions:</strong> You have 30 minutes per task and may ask up to 3 clarifying questions to the AI. 
                Each question reduces your score by 1 point, but good questions that improve your answer quality can earn bonus points.
              </AlertDescription>
            </Alert>

            {/* Current Question */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-800">Current Task</h2>
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
              initialAnswer={session.finalAnswer || ""}
              onAnswerChange={handleAnswerChange}
              onSubmit={handleSubmitAnswer}
              isSubmitted={session.isSubmitted}
            />
          </div>

          {/* Chat Interface and Scoring */}
          <div className="lg:col-span-1">
            <ChatInterface
              sessionId={session.id}
              questionsAsked={session.questionsAsked}
              onQuestionAsked={handleQuestionAsked}
              onSessionUpdate={handleSessionUpdate}
            />
            
            <ScoringPanel
              baseScore={session.baseScore}
              questionPenalty={session.questionPenalty}
              infoGainBonus={session.infoGainBonus}
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
    </div>
  );
}
