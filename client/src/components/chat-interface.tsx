import { useState, useEffect, useRef } from "react";
import { Send, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ChatMessage } from "@shared/schema";

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
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadChatHistory();
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

    try {
      const response = await apiRequest("POST", `/api/chat/${sessionId}`, {
        question,
      });
      
      const { userMessage, aiMessage, session } = await response.json();
      
      setMessages(prev => [...prev, userMessage, aiMessage]);
      onQuestionAsked();
      onSessionUpdate(session);
      
      toast({
        title: "Question Sent",
        description: "AI has responded to your question.",
      });
    } catch (error) {
      console.error("Failed to send question:", error);
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
                <div className={`max-w-xs px-4 py-2 rounded-lg ${
                  message.isUser 
                    ? 'bg-academic-blue text-white' 
                    : 'bg-slate-100 text-slate-800'
                }`}>
                  <p className="text-sm">{message.content}</p>
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
        <div className="flex space-x-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a clarifying question..."
            disabled={isLoading || questionsAsked >= 3}
            className="flex-1"
          />
          <Button 
            onClick={sendQuestion}
            disabled={isLoading || questionsAsked >= 3 || !inputValue.trim()}
            className="bg-academic-blue hover:bg-blue-700"
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
