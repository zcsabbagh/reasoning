import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Mic, Square, Loader2, Save, Clock } from "lucide-react";
import { useAutoSave } from "@/hooks/use-auto-save";
import { useDatabaseTimer } from "@/hooks/use-database-timer";

interface AnswerSectionProps {
  initialAnswer: string;
  onAnswerChange: (answer: string) => void;
  onSubmit: (answer: string) => void;
  isSubmitted: boolean;
  sessionId?: number;
}

export default function AnswerSection({ 
  initialAnswer, 
  onAnswerChange, 
  onSubmit, 
  isSubmitted,
  sessionId 
}: AnswerSectionProps) {
  const [answer, setAnswer] = useState(initialAnswer);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [lastTypingTime, setLastTypingTime] = useState<number>(0);
  const { toast } = useToast();

  // Auto-save functionality
  useAutoSave({
    sessionId: sessionId || 0,
    text: answer,
    enabled: !isSubmitted && !!sessionId,
    onSave: (success) => {
      if (success) {
        setLastSaved(new Date());
      }
    }
  });

  // Database timer for persistent timing
  const { timingInfo } = useDatabaseTimer({
    sessionId: sessionId || 0,
    enabled: !isSubmitted && !!sessionId,
    onTimeUp: () => {
      toast({
        title: "Time's Up!",
        description: "The time limit for this question has expired.",
        variant: "destructive",
      });
    },
    onAutoSubmit: () => {
      toast({
        title: "Auto-submitted",
        description: "Your answer was automatically submitted when time expired.",
      });
    }
  });

  useEffect(() => {
    // Only update answer from initialAnswer when the component first loads
    // or when the sessionId changes (new question), not for auto-save updates
    if (initialAnswer && !answer) {
      setAnswer(initialAnswer);
    }
  }, [sessionId]); // Only depend on sessionId, not initialAnswer

  // Separate effect for loading saved draft when component mounts
  useEffect(() => {
    if (initialAnswer && initialAnswer !== answer && !lastTypingTime) {
      setAnswer(initialAnswer);
    }
  }, [initialAnswer]);

  const handleAnswerChange = (value: string) => {
    setAnswer(value);
    setIsUserTyping(true);
    setLastTypingTime(Date.now());
    onAnswerChange(value);
    
    // Reset typing state after a short delay
    setTimeout(() => {
      setIsUserTyping(false);
    }, 1000);
  };

  const getWordCount = (text: string) => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const wordCount = getWordCount(answer);
  const isOverLimit = wordCount > 250;

  const handleSubmit = () => {
    if (!answer.trim()) {
      toast({
        title: "Answer Required",
        description: "Please provide an answer before submitting.",
        variant: "destructive",
      });
      return;
    }

    if (isOverLimit) {
      toast({
        title: "Word Limit Exceeded",
        description: "Please reduce your answer to 250 words or fewer.",
        variant: "destructive",
      });
      return;
    }

    onSubmit(answer);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(chunks, { type: mimeType });
        await transcribeAudio(audioBlob);
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };
      
      setMediaRecorder(recorder);
      setIsRecording(true);
      recorder.start();
      
      toast({
        title: "Recording Started",
        description: "Speak your answer. Click the stop button to finish recording.",
      });
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        title: "Microphone Access Denied",
        description: "Please allow microphone access to use voice recording.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      setIsRecording(false);
      setIsTranscribing(true);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      const filename = audioBlob.type.includes('webm') ? 'recording.webm' : 'recording.mp4';
      formData.append('audio', audioBlob, filename);
      
      // Use fetch directly for file upload
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const { text } = await response.json();
      
      // Append transcribed text to current answer
      const newAnswer = answer ? answer + " " + text : text;
      setAnswer(newAnswer);
      handleAnswerChange(newAnswer);
      
      toast({
        title: "Transcription Complete",
        description: "Your voice has been added to your answer.",
      });
    } catch (error) {
      console.error("Error transcribing audio:", error);
      toast({
        title: "Transcription Failed",
        description: "Failed to transcribe audio. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800">Your Final Answer</h3>
        <p className="text-sm text-slate-500 mt-1">Word limit: 250 words</p>
      </div>
      
      <div className="px-6 py-6">
        <Textarea
          value={answer}
          onChange={(e) => handleAnswerChange(e.target.value)}
          placeholder="Type your final answer here..."
          className="w-full h-64 p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-academic-blue focus:border-academic-blue resize-none"
          disabled={isSubmitted || isRecording}
        />
        
        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-slate-500">
            <span className={isOverLimit ? 'text-academic-red' : ''}>
              {wordCount}
            </span> / 250 words
            {isRecording && <span className="ml-2 text-academic-red">• Recording...</span>}
            {isTranscribing && <span className="ml-2 text-academic-blue">• Transcribing...</span>}
            {lastSaved && !isSubmitted && (
              <span className="ml-2 text-green-600 flex items-center">
                <Save className="w-3 h-3 mr-1" />
                Auto-saved {new Date(lastSaved).toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              onClick={toggleRecording}
              disabled={isSubmitted || isTranscribing}
              className={`${isRecording ? 'bg-academic-red hover:bg-red-700' : 'bg-slate-500 hover:bg-slate-600'}`}
              size="sm"
            >
              {isTranscribing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isRecording ? (
                <Square className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitted || isRecording || isTranscribing}
              className="bg-academic-blue text-white hover:bg-blue-700"
            >
              {isSubmitted ? "Submitted" : "Submit Answer"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
