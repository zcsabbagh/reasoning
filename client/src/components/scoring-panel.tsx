import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface ScoringPanelProps {
  baseScore: number;
  questionPenalty: number;
  infoGainBonus: number;
}

export default function ScoringPanel({ 
  baseScore, 
  questionPenalty, 
  infoGainBonus 
}: ScoringPanelProps) {
  const totalScore = baseScore - questionPenalty + infoGainBonus;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-lg">Current Score</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-600">Base Score</span>
          <span className="text-sm font-medium text-slate-800">{baseScore} pts</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-600">Question Penalty</span>
          <span className="text-sm font-medium text-academic-red">
            {questionPenalty > 0 ? `-${questionPenalty}` : '0'} pt{questionPenalty !== 1 ? 's' : ''}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-600">Info-Gain Bonus</span>
          <span className="text-sm font-medium text-academic-emerald">
            {infoGainBonus > 0 ? `+${infoGainBonus}` : '0'} pt{infoGainBonus !== 1 ? 's' : ''}
          </span>
        </div>
        
        <Separator />
        
        <div className="flex justify-between items-center">
          <span className="text-base font-semibold text-slate-800">Total Score</span>
          <span className="text-base font-bold text-academic-blue">{totalScore} pts</span>
        </div>
      </CardContent>
    </Card>
  );
}
