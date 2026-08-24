import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { ExternalLink, FileSearch, Link2, Loader2, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { IsometricBackdrop } from "@/components/IsometricBackdrop";
import { SiteHeader } from "@/components/SiteHeader";
import { trpc } from "@/lib/trpc";

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export default function Imports() {
  const { isAuthenticated } = useAuth();
  const [url, setUrl] = useState("");
  const imports = trpc.importer.mine.useQuery(undefined, { enabled: isAuthenticated });
  const utils = trpc.useUtils();
  const ingest = trpc.importer.ingest.useMutation({
    onSuccess: result => {
      if (result.status === "completed") toast.success(`${result.candidatesCreated} structured candidate${result.candidatesCreated === 1 ? "" : "s"} queued for review.`);
      else toast.message("The source was checked, but no recognizable prompt text was found.");
      utils.importer.mine.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const submit = trpc.importer.submitSource.useMutation({
    onSuccess: result => {
      setUrl("");
      if (result.duplicate) {
        toast.message("That approved source is already in your import workspace.");
        utils.importer.mine.invalidate();
        return;
      }
      ingest.mutate({ sourceId: result.sourceId });
    },
    onError: error => toast.error(error.message),
  });

  const submitUrl = (event: React.FormEvent) => {
    event.preventDefault();
    if (!url.trim()) return toast.error("Enter a public source URL to continue.");
    submit.mutate({ url: url.trim() });
  };

  if (!isAuthenticated) {
    return <IsometricBackdrop><SiteHeader /><main className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6"><div className="glass-panel rounded-3xl p-10"><FileSearch className="mx-auto h-10 w-10 text-teal-600" /><p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Review-first importer</p><h1 className="display-font mt-3 text-4xl font-extrabold">Bring approved sources into focus.</h1><p className="mx-auto mt-4 max-w-xl leading-7 text-slate-600">Sign in to submit public URLs you are allowed to review. Verbix extracts eligible prompt text, creates attributable candidates, and never publishes them without moderation.</p><button type="button" onClick={() => startLogin()} className="verbix-button mt-7">Sign in to submit a source</button></div></main></IsometricBackdrop>;
  }

  const busy = submit.isPending || ingest.isPending;
  return <IsometricBackdrop><SiteHeader /><main className="mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-8"><div className="max-w-3xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Review-first importer</p><h1 className="display-font mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">Turn approved links into structured prompt candidates.</h1><p className="mt-4 text-lg leading-8 text-slate-600">Submit a public page you are authorized to review. The importer respects source access boundaries, preserves attribution, identifies image/video/code/audio/3D prompts, and stores external example references only for moderation.</p></div>

    <form onSubmit={submitUrl} className="glass-panel mt-8 rounded-3xl p-5 sm:p-6"><label className="text-sm font-bold text-slate-800" htmlFor="source-url">Approved public source URL</label><div className="mt-3 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Link2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-600" /><input id="source-url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://example.com/prompt-article" inputMode="url" aria-describedby="import-policy" className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100" /></div><button type="submit" disabled={busy} className="verbix-button shrink-0">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{submit.isPending ? "Checking source" : ingest.isPending ? "Structuring prompt" : "Import for review"}</button></div><p id="import-policy" className="mt-3 text-xs leading-5 text-slate-500">Manual, on-demand processing only. Protected pages, credentialed URLs, disallowed paths, non-HTML pages, and oversized pages are excluded. Candidates remain private until an administrator approves them.</p></form>

    <section className="mt-12"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Source ledger</p><h2 className="display-font mt-2 text-3xl font-bold">Your approved-source submissions</h2></div><Link href="/workspace" className="text-sm font-bold text-slate-600 hover:text-slate-950">Back to workspace</Link></div><div className="mt-5 grid gap-4 lg:grid-cols-2">{imports.isLoading && [0, 1].map(item => <div key={item} className="glass-panel h-40 animate-pulse rounded-3xl" />)}{imports.data?.sources.map(source => <article key={source.id} className="glass-panel rounded-3xl p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-slate-950">{source.pageTitle || source.domain}</p><p className="mt-1 break-all text-xs text-slate-500">{source.canonicalUrl || source.submittedUrl}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${source.status === "extracted" ? "bg-teal-100 text-teal-800" : source.status === "blocked" || source.status === "failed" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>{statusLabel(source.status)}</span></div><div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500"><span>Robots: {source.robotsState}</span>{source.displayedAuthor && <span>Attribution: {source.displayedAuthor}</span>}{source.canonicalUrl && <a href={source.canonicalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-teal-700 hover:underline">View source <ExternalLink className="h-3.5 w-3.5" /></a>}</div>{source.failureReason && <p role="alert" className="mt-4 rounded-2xl bg-rose-50 p-3 text-sm leading-6 text-rose-800">{source.failureReason}</p>}{(source.status === "failed" || source.status === "blocked") && <button type="button" onClick={() => ingest.mutate({ sourceId: source.id })} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white"><RefreshCw className="h-3.5 w-3.5" /> Retry import</button>}</article>)}{!imports.isLoading && !imports.data?.sources.length && <div className="glass-panel col-span-full rounded-3xl p-8 text-center"><ShieldCheck className="mx-auto h-8 w-8 text-teal-600" /><p className="mt-3 font-bold text-slate-900">No sources submitted yet.</p><p className="mt-2 text-sm leading-6 text-slate-600">Start with one public source you are authorized to review. Verbix will preserve its link and produce moderation-ready candidates rather than publishing automatically.</p></div>}</div></section>

    <section className="mt-12"><p className="text-xs font-bold uppercase tracking-[0.18em] text-coral-700">Candidate ledger</p><h2 className="display-font mt-2 text-3xl font-bold">AI-structured prompt candidates</h2><div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{imports.data?.candidates.map(({ candidate, source }) => <article key={candidate.id} className="glass-panel rounded-3xl p-5"><div className="flex items-start justify-between gap-3"><span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-bold uppercase text-cyan-200">{candidate.modality.replace("_", " ")}</span><span className="text-xs font-bold text-slate-500">{candidate.confidence}% confidence</span></div><h3 className="display-font mt-4 text-xl font-bold text-slate-950">{candidate.title}</h3><p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{candidate.description}</p><div className="mt-4 rounded-2xl bg-slate-950 p-3 font-mono text-xs leading-5 text-cyan-50"><p className="line-clamp-5">{candidate.structuredPrompt}</p></div><div className="mt-4 flex items-center justify-between gap-3"><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{statusLabel(candidate.status)}</span><a href={source.canonicalUrl || source.submittedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:underline">Source <ExternalLink className="h-3.5 w-3.5" /></a></div></article>)}{!imports.isLoading && !imports.data?.candidates.length && <div className="glass-panel col-span-full rounded-3xl p-8 text-center text-sm leading-6 text-slate-600">Structured candidates appear here after a source is successfully processed. They stay private until an administrator reviews and promotes them.</div>}</div></section>
  </main></IsometricBackdrop>;
}
