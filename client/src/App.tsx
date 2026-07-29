import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Settings from "@/pages/settings";
import { PlayerProvider, usePlayer } from "@/components/player/PlayerContext";
import { PlayerPanel } from "@/components/player/PlayerPanel";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Shifts the whole app to the left half when the player is docked on the right,
// so search field, results, and controls occupy the left column.
function PlayerLayout({ children }: { children: React.ReactNode }) {
  const { playing, mode } = usePlayer();
  const docked = playing && mode === "docked";
  return (
    <div
      className={docked ? "transition-[padding] duration-300 md:pr-[50vw]" : "transition-[padding] duration-300"}
      data-testid="app-shell"
    >
      {children}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PlayerProvider>
          <Toaster />
          <PlayerLayout>
            <Router hook={useHashLocation}>
              <AppRouter />
            </Router>
          </PlayerLayout>
          <PlayerPanel />
        </PlayerProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
