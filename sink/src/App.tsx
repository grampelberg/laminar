import { Route, Switch } from "wouter";

import { Toaster } from "@/components/ui/sonner.tsx";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import { DevCommands } from "@/dev.tsx";
import { Native } from "@/native.tsx";
import { DesignPlayground } from "@/playground/design.tsx";

function App() {
  return (
    <TooltipProvider>
      <main className="flex h-screen flex-col">
        <Switch>
          <Route component={DesignPlayground} path="/design" />
          <Route component={Native} />
        </Switch>
        <DevCommands />
        <Toaster />
      </main>
    </TooltipProvider>
  );
}

export default App;
