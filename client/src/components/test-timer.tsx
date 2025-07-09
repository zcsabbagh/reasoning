import { useState, useEffect } from "react";
import { Clock, Timer, AlertTriangle } from "lucide-react";
import { useDatabaseTimer } from "@/hooks/use-database-timer";

interface TestTimerProps {
  sessionId: number;
  onTimeUp: () => void;
  onTimeWarning: () => void;
}

export default function TestTimer({ sessionId, onTimeUp, onTimeWarning }: TestTimerProps) {
  const [hasWarned, setHasWarned] = useState(false);
  
  const { timingInfo } = useDatabaseTimer({
    sessionId,
    enabled: true,
    onTimeUp,
    onAutoSubmit: () => {
      // Handle auto-submit if needed
    }
  });

  // Show warning at 2 minutes for 10-minute questions
  useEffect(() => {
    if (timingInfo && timingInfo.timeRemaining <= 120000 && !hasWarned) { // 2 minutes in milliseconds
      setHasWarned(true);
      onTimeWarning();
    }
    
    // Reset warning when moving to a new question (time goes back up significantly)
    if (timingInfo && timingInfo.timeRemaining > 300000) { // 5 minutes
      setHasWarned(false);
    }
  }, [timingInfo, hasWarned, onTimeWarning]);

  const timeRemaining = timingInfo?.timeRemaining || 0;
  const timeRemainingSeconds = Math.floor(timeRemaining / 1000);
  const minutes = Math.floor(timeRemainingSeconds / 60);
  const seconds = timeRemainingSeconds % 60;

  const getTimerColor = () => {
    const warningThreshold = 120000; // 2 minutes
    const criticalThreshold = 60000; // 1 minute
    
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
