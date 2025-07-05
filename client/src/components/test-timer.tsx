import { useState, useEffect } from "react";
import { Clock, Timer, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TestTimerProps {
  initialTime: number;
  onTimeUp: () => void;
  onTimeWarning: () => void;
}

export default function TestTimer({ initialTime, onTimeUp, onTimeWarning }: TestTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(initialTime);
  const [hasWarned, setHasWarned] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onTimeUp();
          return 0;
        }
        
        // Show warning based on question duration
        const warningTime = initialTime <= 600 ? 120 : 300; // 2 min for 10-min questions, 5 min for 30-min questions
        if (prev === warningTime && !hasWarned) {
          setHasWarned(true);
          onTimeWarning();
        }
        
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onTimeUp, onTimeWarning, hasWarned]);

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  const getTimerColor = () => {
    // For 10-minute questions (600 seconds), warn at 2 minutes
    // For 30-minute questions (1800 seconds), warn at 5 minutes
    const warningThreshold = initialTime <= 600 ? 120 : 300;
    const criticalThreshold = initialTime <= 600 ? 60 : 180;
    
    if (timeRemaining <= criticalThreshold) return "bg-academic-red";
    if (timeRemaining <= warningThreshold) return "bg-academic-amber";
    return "bg-academic-blue";
  };

  return (
    <div className={`flex items-center space-x-2 text-white px-4 py-2 rounded-lg ${getTimerColor()}`}>
      <Timer className="w-4 h-4" />
      <span className="text-sm font-medium">Time Remaining:</span>
      <span className="text-sm font-bold">
        {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  );
}
