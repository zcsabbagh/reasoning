import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();

  // Check if user is already authenticated
  const { data: user } = useQuery({
    queryKey: ["/auth/user"],
    retry: false
  });

  // Check for error in URL params
  const urlParams = new URLSearchParams(window.location.search);
  const error = urlParams.get('error');

  useEffect(() => {
    if (user) {
      setLocation("/account");
    }
  }, [user, setLocation]);

  const handleLinkedInLogin = () => {
    window.location.href = "/auth/linkedin";
  };

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case 'oauth_failed':
        return 'LinkedIn authentication failed. Please try again.';
      case 'no_user':
        return 'Could not retrieve user information from LinkedIn.';
      case 'login_failed':
        return 'Login process failed. Please try again.';
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-slate-800">
            Welcome to Hinton
          </CardTitle>
          <CardDescription className="text-slate-600">
            The exam that will define the AI era.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {getErrorMessage(error)}
              </AlertDescription>
            </Alert>
          )}
          
          <div className="text-center space-y-4">
            <div className="text-sm text-slate-600">
              <p>s</p>
             
            </div>
            
            <Button
              onClick={handleLinkedInLogin}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              size="lg"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              Continue with LinkedIn
            </Button>
            
            <div className="text-xs text-slate-500 text-center">
              By signing in, you agree to our terms of service and privacy policy
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}