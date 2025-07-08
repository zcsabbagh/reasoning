import { useState, useEffect, useRef } from "react";
import { Send, MessageCircle, Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ChatMessage } from "@shared/schema";
import ReactMarkdown from "react-markdown";

interface ChatInterfaceProps {
  sessionId: number;
  questionsAsked: number;
  onQuestionAsked: () => void;
  onSessionUpdate: (session: any) => void;
}

export default function ChatInterface({ 
  sessionId, 
  questionsAsked, 
  onQuestionAsked, 
  onSessionUpdate 
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (sessionId) {
      loadChatHistory();
    }
  }, [sessionId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadChatHistory = async () => {
    try {
      const response = await apiRequest("GET", `/api/chat/${sessionId}`);
      const history = await response.json();
      setMessages(history);
    } catch (error) {
      console.error("Failed to load chat history:", error);
    }
  };

  const sendQuestion = async () => {
    if (!inputValue.trim()) return;
    
    if (questionsAsked >= 3) {
      toast({
        title: "Question Limit Reached",
        description: "You have already asked the maximum number of questions (3).",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    const question = inputValue.trim();
    setInputValue("");

    // Add user message immediately to UI
    const tempUserMessage: ChatMessage = {
      id: Date.now(), // temporary ID
      sessionId,
      content: question,
      isUser: true,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      const response = await apiRequest("POST", `/api/chat/${sessionId}`, {
        question,
      });
      
      const { userMessage, aiMessage, session } = await response.json();
      
      // Replace temp message with actual messages from server
      setMessages(prev => {
        const withoutTemp = prev.filter(msg => msg.id !== tempUserMessage.id);
        return [...withoutTemp, userMessage, aiMessage];
      });
      
      onQuestionAsked();
      onSessionUpdate(session);
      
      toast({
        title: "Question Sent",
        description: "AI has responded to your question.",
      });
    } catch (error) {
      console.error("Failed to send question:", error);
      // Remove temp message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempUserMessage.id));
      toast({
        title: "Error",
        description: "Failed to send question. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendQuestion();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    // Auto-expand textarea
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = '40px'; // Reset to minimum height
        const scrollHeight = textareaRef.current.scrollHeight;
        const maxHeight = 120;
        textareaRef.current.style.height = Math.min(scrollHeight, maxHeight) + 'px';
      }
    }, 0);
  };

  // Auto-expand textarea when input value changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px'; // Reset to minimum height
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 120;
      textareaRef.current.style.height = Math.min(scrollHeight, maxHeight) + 'px';
    }
  }, [inputValue]);

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
        description: "Speak your question now. Click the stop button to finish.",
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
      
      // Use fetch directly for file upload instead of apiRequest
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const { text } = await response.json();
      
      setInputValue(text);
      toast({
        title: "Transcription Complete",
        description: "Your voice has been converted to text.",
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

  const formatTime = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 h-fit sticky top-24">
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">AI Assistant</h3>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-academic-emerald rounded-full"></div>
            <span className="text-sm text-slate-500">Online</span>
          </div>
        </div>
        <p className="text-sm text-slate-500 mt-1">Ask clarifying questions to help with your answer</p>
      </div>
      
      <ScrollArea className="h-96 px-6 py-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <MessageCircle className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">Start a conversation with the AI assistant</p>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`${message.isUser ? 'max-w-xs' : 'w-full'} px-4 py-3 rounded-lg ${
                  message.isUser 
                    ? 'bg-academic-blue text-white' 
                    : 'bg-slate-100 text-slate-800'
                }`}>
                  <div className={message.isUser ? "text-sm" : "text-sm leading-relaxed"}>
                    {message.isUser ? (
                      <p>{message.content}</p>
                    ) : (
                      <ReactMarkdown 
                        components={{
                          p: ({ children }) => <p className="mb-3 last:mb-0 text-slate-800 leading-relaxed">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-5 mb-3 text-slate-800 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 text-slate-800 space-y-1">{children}</ol>,
                          li: ({ children }) => <li className="text-slate-800 leading-relaxed">{children}</li>,
                          strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                          em: ({ children }) => <em className="italic text-slate-700">{children}</em>,
                          code: ({ children }) => <code className="bg-slate-200 px-2 py-1 rounded text-xs text-slate-900">{children}</code>
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    )}
                  </div>
                  <div className={`text-xs mt-1 ${
                    message.isUser ? 'text-white/75' : 'text-slate-500'
                  }`}>
                    {formatTime(message.timestamp!)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      
      <div className="px-6 py-4 border-t border-slate-200">
        <div className="flex items-end space-x-2">
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            placeholder="Ask a clarifying question..."
            disabled={isLoading || questionsAsked >= 3 || isRecording}
            className="flex-1 min-h-[40px] max-h-[120px] resize-none overflow-y-auto"
            rows={1}
          />
          <Button 
            onClick={toggleRecording}
            disabled={questionsAsked >= 3 || isTranscribing}
            className={`${isRecording ? 'bg-academic-red hover:bg-red-700' : 'bg-slate-500 hover:bg-slate-600'} mb-0.5`}
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
            onClick={sendQuestion}
            disabled={isLoading || questionsAsked >= 3 || !inputValue.trim() || isRecording}
            className="bg-academic-blue hover:bg-blue-700 mb-0.5"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="mt-2 text-xs text-slate-500">
          <span className={questionsAsked >= 3 ? 'text-academic-red' : ''}>
            {Math.max(0, 3 - questionsAsked)} questions remaining
          </span>
        </div>
      </div>
    </div>
  );
}
