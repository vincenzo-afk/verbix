import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { IsometricBackdrop } from "@/components/IsometricBackdrop";
import { SiteHeader } from "@/components/SiteHeader";
import { trpc } from "@/lib/trpc";
import { ArrowUpRight, FileText, PenLine, Plus, Send } from "lucide-react";
import { Link } from "wouter";

export default function Workspace() {
  const { isAuthenticated, user } = useAuth();
  const prompts = trpc.workspace.mine.useQuery(undefined, { enabled: isAuthenticated });
  const metrics = (prompts.data ?? []).reduce((total, prompt) => ({ views: total.views + prompt.viewsCount, runs: total.runs + prompt.runsCount, saves: total.saves + prompt.savesCount }), { views: 0, runs: 0, saves: 0 });
  if (!isAuthenticated) return <IsometricBackdrop><SiteHeader /><main className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6"><div className="glass-panel rounded-3xl p-10"><FileText className="mx-auto h-10 w-10 text-teal-600" /><h1 className="display-font mt-5 text-4xl font-bold">Your prompt workspace is waiting.</h1><p className="mx-auto mt-3 max-w-lg leading-7 text-slate-600">Sign in to create drafts, preserve improvements as versions, submit prompts for review, and track your work.</p><button type="button" onClick={() => startLogin()} className="verbix-button mt-6">Sign in to continue</button></div></main></IsometricBackdrop>;
  return <IsometricBackdrop><SiteHeader /><main className="mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Creator workspace</p><h1 className="display-font mt-3 text-4xl font-extrabold tracking-tight">Good to see you, {user?.name || "creator"}.</h1><p className="mt-3 text-slate-600">Draft, version, submit, and share prompts from one persistent workspace.</p></div><Link href="/compose" className="verbix-button"><Plus className="h-4 w-4 text-cyan-200" /> New prompt</Link></div>
    <div className="mt-8 grid gap-4 sm:grid-cols-3"><Metric label="Public views" value={metrics.views} /><Metric label="Prompt runs" value={metrics.runs} /><Metric label="Saved by others" value={metrics.saves} /></div>
    {prompts.error && <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">{prompts.error.message}</div>}
    <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{prompts.data?.map(prompt => <article key={prompt.id} className="glass-panel rounded-3xl p-6"><div className="flex items-start justify-between gap-3"><span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-bold text-white">{prompt.status}</span><span className="text-xs font-bold text-slate-500">Updated {prompt.updatedAt.toLocaleDateString()}</span></div><h2 className="display-font mt-5 text-2xl font-bold">{prompt.title}</h2><p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{prompt.description}</p><div className="mt-6 flex items-center justify-between"><span className="inline-flex items-center gap-1 text-xs font-bold text-teal-700"><PenLine className="h-3.5 w-3.5" /> {prompt.promptType}</span><Link href={`/workspace/${prompt.id}`} className="inline-flex items-center gap-1 text-sm font-bold text-slate-800">Edit <ArrowUpRight className="h-4 w-4" /></Link></div></article>)}{!prompts.isLoading && prompts.data?.length === 0 && <div className="glass-panel col-span-full rounded-3xl p-10 text-center"><Send className="mx-auto h-9 w-9 text-blue-600" /><h2 className="display-font mt-4 text-2xl font-bold">No saved prompts yet.</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">Create your first private draft. Improvements you accept can become tracked versions as your work evolves.</p><Link href="/compose" className="verbix-button mt-5">Compose a prompt</Link></div>}</div>
  </main></IsometricBackdrop>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="glass-panel rounded-2xl p-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p><p className="display-font mt-2 text-3xl font-bold text-slate-950">{value.toLocaleString()}</p></div>;
}
