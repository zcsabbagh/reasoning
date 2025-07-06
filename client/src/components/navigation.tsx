import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Trophy, TestTube, LogOut } from "lucide-react";

export default function Navigation() {
  const [location] = useLocation();

  const handleLogout = () => {
    window.location.href = "/auth/logout";
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Citium
          </h1>
          
          <div className="flex space-x-4">            
            <Link href="/rankings">
              <Button 
                variant={location === "/rankings" ? "default" : "ghost"}
                className="flex items-center space-x-2"
              >
                <Trophy className="h-4 w-4" />
                <span>Rankings</span>
              </Button>
            </Link>
          </div>
        </div>

        <Button 
          variant="outline" 
          onClick={handleLogout}
          className="flex items-center space-x-2"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </Button>
      </div>
    </nav>
  );
}