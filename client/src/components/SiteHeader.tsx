import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { Bot, Compass, LayoutDashboard, PenLine, ShieldCheck, Sparkles } from "lucide-react";

const navItems = [
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/compose", label: "Compose", icon: PenLine },
];

export function SiteHeader() {
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/75 backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-3 py-3" aria-label="Verbix home">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-slate-950 shadow-[5px_5px_0_rgba(45,212,191,0.45)] transition group-hover:-translate-y-0.5">
            <Sparkles className="h-5 w-5 text-cyan-200" strokeWidth={2.5} />
          </span>
          <span className="display-font text-xl font-extrabold tracking-tight">VERBIX</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = location.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${active ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}>
                <Icon className="h-4 w-4" /> {item.label}
              </Link>
            );
          })}
          {isAuthenticated && (
            <Link href="/workspace" className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${location.startsWith("/workspace") ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}>
              <LayoutDashboard className="h-4 w-4" /> Workspace
            </Link>
          )}
          {isAuthenticated && (
            <Link href="/agents" className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${location.startsWith("/agents") ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}>
              <Bot className="h-4 w-4" /> Agents
            </Link>
          )}
          {user?.role === "admin" && (
            <Link href="/admin" className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950">
              <ShieldCheck className="h-4 w-4" /> Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <Link href="/workspace" className="hidden max-w-32 truncate rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 sm:block">{user?.name || "Workspace"}</Link>
              <button type="button" className="rounded-full px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100" onClick={() => logout()}>Sign out</button>
            </>
          ) : (
            <button type="button" className="verbix-button px-4 py-2" onClick={() => startLogin()}>Sign in</button>
          )}
        </div>
      </div>
    </header>
  );
}
