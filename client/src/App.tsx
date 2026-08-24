import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Admin from "./pages/Admin";
import Agents from "./pages/Agents";
import Compose from "./pages/Compose";
import CreatorProfile from "./pages/CreatorProfile";
import Discover from "./pages/Discover";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import PromptDetail from "./pages/PromptDetail";
import PublicAgent from "./pages/PublicAgent";
import Workspace from "./pages/Workspace";
import WorkspaceEditor from "./pages/WorkspaceEditor";

function Router() {
  return <Switch>
    <Route path="/" component={Home} />
    <Route path="/discover" component={Discover} />
    <Route path="/compose" component={Compose} />
    <Route path="/workspace/:id" component={WorkspaceEditor} />
    <Route path="/workspace" component={Workspace} />
    <Route path="/admin" component={Admin} />
    <Route path="/agents/:slug" component={PublicAgent} />
    <Route path="/agents" component={Agents} />
    <Route path="/creators/:id" component={CreatorProfile} />
    <Route path="/prompts/:slug" component={PromptDetail} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
