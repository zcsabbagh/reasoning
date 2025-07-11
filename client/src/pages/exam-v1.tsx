import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mic, MicOff, Send, Loader2, MessageSquare, Clock, Target } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ExamSession {
  id: number;
  userId: number;
  examId: number;
  currentStage: number;
  questionsAsked: number;
  userPath: string | null;
  startedAt: string;
  completedAt: string | null;
  exam: {
    id: number;
    title: string;
    description: string;
    totalStages: number;
  };
}

interface DialogueMessage {
  id: number;
  sessionId: number;
  stageNumber: number;
  responseText: string;
  pathType: string | null;
  timestamp: string;
  isUser: boolean;
}

interface StageData {
  stageNumber: number;
  promptText: string;
  stageType: string;
}

export default function ExamV1() {
  const params = useParams();
  const sessionId = parseInt(params.sessionId || "0");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [currentInput, setCurrentInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogueMessages, setDialogueMessages] = useState<DialogueMessage[]>([]);
  const [wordCount, setWordCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch exam session
  const { data: session, isLoading: sessionLoading } = useQuery<ExamSession>({
    queryKey: ['/api/v1/sessions', sessionId],
    queryFn: () => fetch(`/api/v1/sessions/${sessionId}`).then(res => res.json()),
    enabled: sessionId > 0,
  });

  // Fetch current stage data
  const { data: stageData, isLoading: stageLoading } = useQuery<StageData>({
    queryKey: ['/api/v1/stages', sessionId, session?.currentStage],
    queryFn: () => fetch(`/api/v1/stages/${sessionId}/${session?.currentStage}`).then(res => res.json()),
    enabled: !!session && session.currentStage > 0,
  });

  // Fetch dialogue messages
  const { data: messages, isLoading: messagesLoading } = useQuery<DialogueMessage[]>({
    queryKey: ['/api/v1/messages', sessionId],
    queryFn: () => fetch(`/api/v1/messages/${sessionId}`).then(res => res.json()),
    enabled: sessionId > 0,
    refetchInterval: 2000, // Refresh every 2 seconds for real-time updates
  });

  // Update local messages when data changes
  useEffect(() => {
    if (messages) {
      setDialogueMessages(messages);
    }
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dialogueMessages]);

  // Update word count
  useEffect(() => {
    const words = currentInput.trim().split(/\s+/).filter(word => word.length > 0);
    setWordCount(words.length);
  }, [currentInput]);

  // Submit response mutation
  const submitResponseMutation = useMutation({
    mutationFn: async (data: { responseText: string; responseType: string }) => {
      return await apiRequest(`/api/v1/responses/submit`, {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          stageNumber: session?.currentStage || 1,
          responseText: data.responseText,
          responseType: data.responseType,
        }),
      });
    },
    onSuccess: () => {
      setCurrentInput("");
      setIsSubmitting(false);
      // Refresh all related queries
      queryClient.invalidateQueries({ queryKey: ['/api/v1/sessions', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/messages', sessionId] });
      toast({
        title: "Response submitted",
        description: "Your response has been submitted and is being processed.",
      });
    },
    onError: (error) => {
      console.error('Error submitting response:', error);
      setIsSubmitting(false);
      toast({
        title: "Submission failed",
        description: "There was an error submitting your response. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmitResponse = () => {
    if (!currentInput.trim() || !session || !stageData) return;

    setIsSubmitting(true);
    submitResponseMutation.mutate({
      responseText: currentInput.trim(),
      responseType: stageData.stageType,
    });
  };

  // Voice recording functionality (reusing existing components)
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/wav' });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Stop recording after 30 seconds max
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
          setIsRecording(false);
        }
      }, 30000);

    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Recording failed",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    // Recording will be stopped by the mediaRecorder.stop() call
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      
      if (data.transcription) {
        setCurrentInput(prev => prev + (prev ? ' ' : '') + data.transcription);
        textareaRef.current?.focus();
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
      toast({
        title: "Transcription failed",
        description: "Could not transcribe audio. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getStageTypeDisplay = (stageType: string) => {
    switch (stageType) {
      case 'assumption':
        return 'Assumption Identification';
      case 'questioning':
        return 'Strategic Questioning';
      case 'synthesis':
        return 'Synthesis';
      default:
        return stageType;
    }
  };

  const getPathBadge = (userPath: string | null) => {
    if (!userPath) return null;
    
    const pathColors = {
      'PATH_A': 'bg-blue-100 text-blue-800',
      'PATH_B': 'bg-green-100 text-green-800',
      'PATH_C': 'bg-purple-100 text-purple-800',
    };
    
    const pathLabels = {
      'PATH_A': 'Surface Analysis',
      'PATH_B': 'Systemic Thinking',
      'PATH_C': 'Epistemological Inquiry',
    };
    
    return (
      <Badge className={pathColors[userPath as keyof typeof pathColors]}>
        {pathLabels[userPath as keyof typeof pathLabels] || userPath}
      </Badge>
    );
  };

  const getQualityHint = (stageType: string) => {
    switch (stageType) {
      case 'assumption':
        return "Focus on identifying underlying assumptions rather than obvious facts. Consider what must be true for your analysis to hold.";
      case 'questioning':
        return "Ask strategic questions that reveal deeper patterns or challenge fundamental premises, not just surface-level details.";
      case 'synthesis':
        return "Integrate your insights to form a comprehensive understanding. Show how different elements connect and influence each other.";
      default:
        return "Provide thoughtful, well-reasoned responses that demonstrate critical thinking.";
    }
  };

  if (sessionLoading || stageLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Alert>
          <AlertDescription>
            Exam session not found. Please check the URL or start a new exam.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Fixed Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-semibold text-gray-800">
            {session.exam.title}
          </h1>
          {session.userPath && getPathBadge(session.userPath)}
        </div>
        
        <div className="flex items-center space-x-4">
          <Badge variant="outline" className="flex items-center space-x-1">
            <MessageSquare className="w-3 h-3" />
            <span>Stage {session.currentStage}</span>
          </Badge>
          
          <Badge variant="outline" className="flex items-center space-x-1">
            <Target className="w-3 h-3" />
            <span>Questions: {session.questionsAsked}/3</span>
          </Badge>
          
          {stageData && (
            <Badge className="bg-blue-100 text-blue-800">
              {getStageTypeDisplay(stageData.stageType)}
            </Badge>
          )}
        </div>
      </header>

      {/* Scrollable Dialogue Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* Current Stage Prompt */}
        {stageData && (
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-blue-900">
                {getStageTypeDisplay(stageData.stageType)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-blue-800 leading-relaxed">
                {stageData.promptText}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Dialogue Messages */}
        {dialogueMessages.length > 0 && (
          <div className="space-y-3">
            {dialogueMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-2xl px-4 py-3 rounded-lg ${
                    message.isUser
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-200'
                  }`}
                >
                  <div className="text-sm leading-relaxed">
                    {message.responseText}
                  </div>
                  <div className={`text-xs mt-2 ${
                    message.isUser ? 'text-blue-200' : 'text-gray-500'
                  }`}>
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Loading indicator for AI response */}
        {isSubmitting && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span className="text-gray-600">Processing your response...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Fixed Input Area */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          {/* Input Field with Microphone */}
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              placeholder="Type your response here..."
              className="min-h-[100px] pr-12 resize-none"
              disabled={isSubmitting}
            />
            
            {/* Microphone Button */}
            <Button
              type="button"
              size="sm"
              variant={isRecording ? "destructive" : "outline"}
              className="absolute bottom-2 right-2 w-8 h-8 rounded-full p-0"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isSubmitting}
            >
              {isRecording ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Controls and Stats */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Words: {wordCount}
              </span>
              {wordCount < 50 && (
                <span className="text-xs text-amber-600">
                  Consider adding more detail (aim for 50+ words)
                </span>
              )}
            </div>
            
            <Button
              onClick={handleSubmitResponse}
              disabled={!currentInput.trim() || isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Response
                </>
              )}
            </Button>
          </div>

          {/* Quality Hint */}
          {stageData && (
            <div className="mt-3 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg">
              <strong>Tip:</strong> {getQualityHint(stageData.stageType)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}