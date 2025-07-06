import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import TestPlatform from "@/pages/test-platform";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Rankings from "@/pages/rankings";
import Account from "@/pages/account";
import ExamPrep from "@/pages/exam-prep";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/login" component={Login} />
      <Route path="/account" component={Account} />
      <Route path="/exam-prep/:sessionId" component={ExamPrep} />
      <Route path="/test/:sessionId" component={TestPlatform} />
      <Route path="/rankings" component={Rankings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
