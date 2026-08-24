import { AlertTriangle, Bot, Loader2, Play, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { IsometricBackdrop } from "@/components/IsometricBackdrop";
import { SiteHeader } from "@/components/SiteHeader";
import { trpc } from "@/lib/trpc";
import { parsePromptVariables } from "@shared/prompt-engine";

export default function PublicAgent() {
  const [, params] = useRoute("/agents/:slug");
  const slug = params?.slug || "";
  const agent = trpc.agents.publicBySlug.useQuery({ slug });
  const [values, setValues] = useState<Record<string, string>>({});
  const invoke = trpc.agents.invoke.useMutation();
  const variables = useMemo(() => parsePromptVariables(agent.data?.prompt.body || ""), [agent.data?.prompt.body]);
  if (agent.isLoading) return <IsometricBackdrop><SiteHeader /><main className="mx-auto max-w-4xl px-4 py-24 sm:px-6"><div className="glass-panel animate-pulse rounded-3xl p-10"><div className="h-8 w-64 rounded bg-slate-200" /><div className="mt-6 h-64 rounded bg-slate-100" /></div></main></IsometricBackdrop>;
  if (!agent.data) return <IsometricBackdrop><SiteHeader /><main className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6"><Bot className="mx-auto h-10 w-10 text-slate-500" /><h1 className="display-font mt-5 text-4xl font-bold">This agent is unavailable.</h1><p className="mt-3 text-slate-600">It may be private, disabled, or no longer exist.</p><Link href="/" className="verbix-button mt-6">Explore Verbix</Link></main></IsometricBackdrop>;
  return <IsometricBackdrop><SiteHeader /><main className="mx-auto max-w-4xl px-4 pb-20 pt-14 sm:px-6"><section className="glass-panel rounded-[2rem] p-6 sm:p-10"><div className="flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-950 text-cyan-200"><Bot className="h-6 w-6" /></span><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Verbix deployed agent</p><h1 className="display-font mt-2 text-4xl font-extrabold tracking-tight">{agent.data.agent.name}</h1><p className="mt-3 text-slate-600">Provide the requested variables and execute the source prompt through the configured free-chatbot fallback chain.</p></div></div><div className="mt-8 grid gap-4 sm:grid-cols-2">{variables.map(variable => <label key={variable.name} className="text-sm font-bold text-slate-800">{variable.label}<input value={values[variable.name] ?? ""} onChange={event => setValues(current => ({ ...current, [variable.name]: event.target.value }))} placeholder={`Enter ${variable.label.toLowerCase()}`} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-normal outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100" /></label>)}</div><button type="button" onClick={() => invoke.mutate({ slug, variables: values })} disabled={invoke.isPending} className="verbix-button mt-7">{invoke.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 text-cyan-200" />} Run agent</button>{invoke.error && <p className="mt-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {invoke.error.message}</p>}{invoke.data && <div className="mt-7 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-5"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-cyan-800"><Sparkles className="h-4 w-4" /> {invoke.data.provider} · {invoke.data.model}</p><pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-4 font-mono text-sm leading-6 text-cyan-50">{invoke.data.output}</pre></div>}</section></main></IsometricBackdrop>;
}
