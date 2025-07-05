import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface AnswerSectionProps {
  initialAnswer: string;
  onAnswerChange: (answer: string) => void;
  onSubmit: (answer: string) => void;
  isSubmitted: boolean;
}

export default function AnswerSection({ 
  initialAnswer, 
  onAnswerChange, 
  onSubmit, 
  isSubmitted 
}: AnswerSectionProps) {
  const [answer, setAnswer] = useState(initialAnswer);
  const { toast } = useToast();

  useEffect(() => {
    setAnswer(initialAnswer);
  }, [initialAnswer]);

  const handleAnswerChange = (value: string) => {
    setAnswer(value);
    onAnswerChange(value);
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
          disabled={isSubmitted}
        />
        
        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-slate-500">
            <span className={isOverLimit ? 'text-academic-red' : ''}>
              {wordCount}
            </span> / 250 words
          </div>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitted}
            className="bg-academic-blue text-white hover:bg-blue-700"
          >
            {isSubmitted ? "Submitted" : "Submit Answer"}
          </Button>
        </div>
      </div>
    </div>
  );
}
