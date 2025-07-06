import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award, User } from "lucide-react";
import Navigation from "@/components/navigation";

interface LeaderboardUser {
  id: number;
  firstName: string;
  lastName: string;
  profilePictureUrl: string | null;
  totalScore: number;
  email: string;
}

export default function RankLift() {
  const { data: leaderboard, isLoading, error } = useQuery<LeaderboardUser[]>({
    queryKey: ["/api/leaderboard"],
    queryFn: async () => {
      const response = await fetch("/api/leaderboard?limit=20");
      if (!response.ok) {
        throw new Error("Failed to fetch leaderboard");
      }
      return response.json();
    },
  });

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Award className="h-6 w-6 text-amber-600" />;
      default:
        return <span className="text-lg font-bold text-gray-500">#{rank}</span>;
    }
  };

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-r from-yellow-400 to-yellow-600 text-white";
      case 2:
        return "bg-gradient-to-r from-gray-300 to-gray-500 text-white";
      case 3:
        return "bg-gradient-to-r from-amber-400 to-amber-600 text-white";
      default:
        return "bg-gradient-to-r from-blue-500 to-blue-600 text-white";
    }
  };

  if (isLoading) {
    return (
      <>
        <Navigation />
        <div className="container mx-auto p-6 max-w-4xl">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            RankLift
          </h1>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center space-x-4 p-4 bg-gray-100 rounded-lg">
                  <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                  </div>
                  <div className="h-8 w-16 bg-gray-300 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navigation />
        <div className="container mx-auto p-6 max-w-4xl text-center">
          <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            RankLift
          </h1>
          <Card className="max-w-md mx-auto">
            <CardContent className="p-6">
              <p className="text-red-600">Failed to load leaderboard. Please try again later.</p>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Navigation />
      <div className="container mx-auto p-6 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          RankLift
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Discover the top performers in our academic testing platform. 
          View rankings based on exam scores and see how you stack up against other users.
        </p>
      </div>

      <div className="space-y-4">
        {leaderboard && leaderboard.length > 0 ? (
          leaderboard.map((user, index) => {
            const rank = index + 1;
            const fullName = `${user.firstName} ${user.lastName}`;
            const initials = `${user.firstName[0] || ''}${user.lastName[0] || ''}`.toUpperCase();

            return (
              <Card 
                key={user.id} 
                className={`transition-all duration-200 hover:shadow-lg ${
                  rank <= 3 ? 'border-2 border-opacity-50' : 'border'
                } ${
                  rank === 1 ? 'border-yellow-400 bg-gradient-to-r from-yellow-50 to-yellow-100' :
                  rank === 2 ? 'border-gray-400 bg-gradient-to-r from-gray-50 to-gray-100' :
                  rank === 3 ? 'border-amber-400 bg-gradient-to-r from-amber-50 to-amber-100' :
                  'border-gray-200 hover:border-blue-300'
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {/* Rank Icon */}
                      <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center">
                        {getRankIcon(rank)}
                      </div>
                      
                      {/* Profile Picture */}
                      <Avatar className="h-16 w-16">
                        <AvatarImage 
                          src={user.profilePictureUrl || undefined} 
                          alt={fullName}
                        />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                          {initials || <User className="h-6 w-6" />}
                        </AvatarFallback>
                      </Avatar>
                      
                      {/* User Info */}
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900">
                          {fullName}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {user.email}
                        </p>
                        {rank <= 3 && (
                          <Badge className={`mt-1 ${getRankBadgeColor(rank)}`}>
                            {rank === 1 ? '🏆 Champion' : 
                             rank === 2 ? '🥈 Runner-up' : 
                             '🥉 Third Place'}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Score */}
                    <div className="text-right">
                      <div className={`text-3xl font-bold ${
                        rank === 1 ? 'text-yellow-600' :
                        rank === 2 ? 'text-gray-600' :
                        rank === 3 ? 'text-amber-600' :
                        'text-blue-600'
                      }`}>
                        {user.totalScore}
                      </div>
                      <div className="text-sm text-gray-500">points</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8 text-center">
              <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Users Yet</h3>
              <p className="text-gray-500">
                Be the first to complete an exam and appear on the leaderboard!
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {leaderboard && leaderboard.length > 0 && (
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Showing top {leaderboard.length} users • Scores updated in real-time
          </p>
        </div>
      )}
      </div>
    </>
  );
}