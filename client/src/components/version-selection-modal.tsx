import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Check, Lock, PlayCircle, Clock, Users, Brain } from "lucide-react";

interface VersionSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVersion: (version: string) => void;
  isLoading?: boolean;
}

export default function VersionSelectionModal({ 
  isOpen, 
  onClose, 
  onSelectVersion, 
  isLoading = false 
}: VersionSelectionModalProps) {
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  const versions = [
    {
      id: "v0",
      name: "V0 - Current",
      description: "Standard academic assessment with AI-powered clarifications",
      features: [
        "3 questions, 10 minutes each",
        "AI chat support for clarifications",
        "Voice recording capabilities",
        "Real-time proctoring",
        "Instant grading with detailed feedback"
      ],
      status: "available",
      icon: <PlayCircle className="w-6 h-6" />,
      color: "bg-blue-600 hover:bg-blue-700",
      badgeColor: "bg-green-100 text-green-800"
    },
    {
      id: "v1",
      name: "V1 - Enhanced",
      description: "Advanced assessment with adaptive questioning",
      features: [
        "Adaptive question difficulty",
        "Extended time limits",
        "Advanced AI reasoning support",
        "Multi-modal input support",
        "Collaborative problem solving"
      ],
      status: "available",
      icon: <Brain className="w-6 h-6" />,
      color: "bg-purple-600 hover:bg-purple-700",
      badgeColor: "bg-green-100 text-green-800"
    },
    {
      id: "v2",
      name: "V2 - Team",
      description: "Team-based assessment with peer collaboration",
      features: [
        "Team-based problem solving",
        "Peer review and feedback",
        "Real-time collaboration tools",
        "Group performance analytics",
        "Synchronized assessment timing"
      ],
      status: "coming-soon",
      icon: <Users className="w-6 h-6" />,
      color: "bg-indigo-600 hover:bg-indigo-700",
      badgeColor: "bg-orange-100 text-orange-800"
    }
  ];

  const handleSelectVersion = (versionId: string) => {
    if (versionId === "v0" || versionId === "v1") {
      setSelectedVersion(versionId);
      onSelectVersion(versionId);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "available":
        return (
          <Badge className="bg-green-100 text-green-800">
            <Check className="w-3 h-3 mr-1" />
            Available
          </Badge>
        );
      case "coming-soon":
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Coming Soon
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Select Exam Version</DialogTitle>
          <DialogDescription>
            Choose the exam version that best fits your needs. Currently, only V0 is available.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 mt-6">
          {versions.map((version) => (
            <Card 
              key={version.id}
              className={`cursor-pointer transition-all duration-200 ${
                version.status === "available" 
                  ? "hover:shadow-lg hover:border-blue-300" 
                  : "opacity-60 cursor-not-allowed"
              } ${
                selectedVersion === version.id 
                  ? "ring-2 ring-blue-500 border-blue-500" 
                  : ""
              }`}
              onClick={() => handleSelectVersion(version.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${version.color.replace('hover:', '')} text-white`}>
                      {version.icon}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{version.name}</CardTitle>
                      <CardDescription className="text-sm">
                        {version.description}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(version.status)}
                    {version.status === "coming-soon" && (
                      <Lock className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-gray-700">Key Features:</h4>
                  <ul className="space-y-1">
                    {version.features.map((feature, index) => (
                      <li key={index} className="flex items-center space-x-2 text-sm text-gray-600">
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-between items-center mt-8 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          
          <Button 
            onClick={() => selectedVersion && onSelectVersion(selectedVersion)}
            disabled={!selectedVersion || isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Preparing Exam...
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4 mr-2" />
                Start {selectedVersion?.toUpperCase()} Exam
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}