import { ArrowLeft, Bot, History, Save, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link, useRoute } from "wouter";
import { IsometricBackdrop } from "@/components/IsometricBackdrop";
import { PromptWorkbench } from "@/components/PromptWorkbench";
import { SiteHeader } from "@/components/SiteHeader";
import { trpc } from "@/lib/trpc";

export default function WorkspaceEditor() {
  const [, params] = useRoute("/workspace/:id");
  const promptId = Number(params?.id);
  const detail = trpc.workspace.byId.useQuery({ promptId }, { enabled: Number.isInteger(promptId) && promptId > 0 });
  const [title, setTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const saveVersion = trpc.workspace.saveVersion.useMutation({
    onSuccess: version => { toast.success(`Version ${version} saved`); detail.refetch(); },
    onError: error => toast.error(error.message),
  });
  const submitPrompt = trpc.workspace.submit.useMutation({ onSuccess: () => { toast.success("Prompt submitted for moderation"); detail.refetch(); }, onError: error => toast.error(error.message) });
  const acceptImprovement = trpc.improvement.accept.useMutation({ onSuccess: result => { toast.success(`AI improvement stored as version ${result.versionNumber}`); detail.refetch(); }, onError: error => toast.error(error.message) });
  const deployAgent = trpc.agents.create.useMutation({ onSuccess: result => { toast.success("Agent endpoint created"); navigator.clipboard.writeText(`${window.location.origin}/agents/${result.slug}`); toast.message("Shareable agent URL copied to your clipboard"); }, onError: error => toast.error(error.message) });

  useEffect(() => {
    if (detail.data) {
      setTitle(detail.data.prompt.title);
      setDraftBody(detail.data.prompt.body);
    }
  }, [detail.data?.prompt.id, detail.data?.prompt.updatedAt]);

  if (detail.isLoading) return <IsometricBackdrop><SiteHeader /><main className="mx-auto max-w-7xl px-4 py-20 sm:px-6"><div className="glass-panel animate-pulse rounded-3xl p-10"><div className="h-6 w-48 rounded bg-slate-200" /><div className="mt-5 h-72 rounded bg-slate-100" /></div></main></IsometricBackdrop>;
  if (!detail.data) return <IsometricBackdrop><SiteHeader /><main className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6"><h1 className="display-font text-4xl font-bold">Private prompt not found.</h1><p className="mt-3 text-slate-600">You can only edit prompts you own.</p><Link href="/workspace" className="verbix-button mt-6"><ArrowLeft className="h-4 w-4" /> Back to workspace</Link></main></IsometricBackdrop>;

  const prompt = detail.data.prompt;
  const saveManualVersion = () => saveVersion.mutate({ promptId: prompt.id, title, body: draftBody, changeNote: "Manual update" });
  const accept = (improvementId: number, improvedBody: string) => acceptImprovement.mutate({ improvementId, promptId: prompt.id, title, body: improvedBody });

  return <IsometricBackdrop><SiteHeader /><main className="mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-8"><Link href="/workspace" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-950"><ArrowLeft className="h-4 w-4" /> Workspace</Link><div className="mt-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Versioned prompt editor</p><input value={title} onChange={event => setTitle(event.target.value)} className="display-font mt-2 w-full max-w-3xl bg-transparent text-4xl font-extrabold tracking-tight outline-none placeholder:text-slate-400" aria-label="Prompt title" /></div><span className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-bold text-white">{prompt.status}</span></div><p className="mt-3 text-slate-600">Original text stays intact until you save a manual version or accept a specific improvement.</p>
    <div className="mt-8"><PromptWorkbench initialPrompt={draftBody || prompt.body} promptId={prompt.id} title={title} variableDefinitions={detail.data.variables} onOriginalChange={setDraftBody} onAcceptImprovement={accept} /></div>
    <section className="glass-panel mt-5 grid gap-4 rounded-2xl p-5 lg:grid-cols-[1fr_auto]"><div><p className="font-bold text-slate-900">Version history</p><div className="mt-3 flex flex-wrap gap-2">{detail.data.versions.map(version => <span key={version.id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"><History className="h-3.5 w-3.5" /> v{version.versionNumber} · {version.source.replace("_", " ")}</span>)}</div></div><div className="flex flex-wrap gap-2"><button type="button" onClick={saveManualVersion} disabled={saveVersion.isPending} className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700"><Save className="mr-1.5 inline h-4 w-4" /> Save version</button><button type="button" onClick={() => deployAgent.mutate({ promptId: prompt.id, name: title, isPublic: true })} disabled={deployAgent.isPending} className="rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-bold text-cyan-900"><Bot className="mr-1.5 inline h-4 w-4" /> Deploy as agent</button><button type="button" onClick={() => submitPrompt.mutate({ promptId: prompt.id })} disabled={submitPrompt.isPending || prompt.status === "submitted"} className="verbix-button px-4 py-2.5"><Send className="h-4 w-4 text-cyan-200" /> {prompt.status === "submitted" ? "Awaiting review" : "Submit for review"}</button></div></section>
  </main></IsometricBackdrop>;
}
