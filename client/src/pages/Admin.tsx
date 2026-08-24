import { useAuth } from "@/_core/hooks/useAuth";
import { IsometricBackdrop } from "@/components/IsometricBackdrop";
import { SiteHeader } from "@/components/SiteHeader";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Flag, ShieldCheck, Tags, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

export default function Admin() {
  const { user } = useAuth();
  const enabled = user?.role === "admin";
  const queue = trpc.admin.queue.useQuery(undefined, { enabled });
  const reports = trpc.admin.reports.useQuery(undefined, { enabled });
  const taxonomy = trpc.admin.taxonomy.useQuery(undefined, { enabled });
  const refresh = () => { queue.refetch(); reports.refetch(); taxonomy.refetch(); };
  const moderatePrompt = trpc.admin.moderatePrompt.useMutation({ onSuccess: () => { refresh(); toast.success("Prompt moderation action recorded"); }, onError: error => toast.error(error.message) });
  const moderateReview = trpc.admin.moderateReview.useMutation({ onSuccess: () => { refresh(); toast.success("Review moderation action recorded"); }, onError: error => toast.error(error.message) });
  const resolveReport = trpc.admin.resolveReport.useMutation({ onSuccess: () => { refresh(); toast.success("Report resolved"); }, onError: error => toast.error(error.message) });
  const setCategoryActive = trpc.admin.setCategoryActive.useMutation({ onSuccess: refresh, onError: error => toast.error(error.message) });
  const setTagActive = trpc.admin.setTagActive.useMutation({ onSuccess: refresh, onError: error => toast.error(error.message) });

  if (!enabled) return <IsometricBackdrop><SiteHeader /><main className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6"><div className="glass-panel rounded-3xl p-10"><ShieldCheck className="mx-auto h-10 w-10 text-slate-500" /><h1 className="display-font mt-5 text-4xl font-bold">Admin access required.</h1><p className="mt-3 text-slate-600">Moderation tools are guarded by server-side administrator procedures.</p></div></main></IsometricBackdrop>;

  return <IsometricBackdrop><SiteHeader /><main className="mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Operations</p><h1 className="display-font mt-3 text-4xl font-extrabold tracking-tight">Moderation console</h1><p className="mt-3 max-w-3xl text-slate-600">Every action is checked on the server and recorded against the administrator who completed it.</p>
    <div className="mt-8 grid gap-5 xl:grid-cols-2"><ModerationPanel title="Submitted prompts" icon={<TriangleAlert className="h-5 w-5 text-amber-600" />}>{queue.data?.prompts.map(prompt => <div key={prompt.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/70 p-4"><div><p className="font-bold text-slate-900">{prompt.title}</p><p className="mt-1 max-w-md text-sm text-slate-600">{prompt.description}</p></div><div className="flex gap-2"><ActionButton label="Approve" tone="positive" onClick={() => moderatePrompt.mutate({ promptId: prompt.id, action: "approve" })} /><ActionButton label="Reject" tone="negative" onClick={() => moderatePrompt.mutate({ promptId: prompt.id, action: "reject" })} /></div></div>)}{!queue.isLoading && queue.data?.prompts.length === 0 && <Empty label="No prompt submissions are waiting for review." />}</ModerationPanel>
      <ModerationPanel title="Flagged reviews" icon={<Flag className="h-5 w-5 text-rose-600" />}>{queue.data?.reviews.map(review => <div key={review.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/70 p-4"><div><p className="font-bold text-slate-900">{review.rating}/5 review</p><p className="mt-1 max-w-md text-sm text-slate-600">{review.comment}</p></div><div className="flex gap-2"><ActionButton label="Hide" tone="negative" onClick={() => moderateReview.mutate({ reviewId: review.id, action: "hide" })} /><ActionButton label="Restore" tone="neutral" onClick={() => moderateReview.mutate({ reviewId: review.id, action: "restore" })} /></div></div>)}{!queue.isLoading && queue.data?.reviews.length === 0 && <Empty label="No flagged reviews are waiting for review." />}</ModerationPanel>
      <ModerationPanel title="Prompt reports" icon={<Flag className="h-5 w-5 text-orange-600" />}>{reports.data?.map(report => <div key={report.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/70 p-4"><div><p className="font-bold text-slate-900">{report.reason}</p><p className="mt-1 text-xs text-slate-500">Prompt #{report.promptId} · submitted {report.createdAt.toLocaleDateString()}</p>{report.details && <p className="mt-2 text-sm text-slate-600">{report.details}</p>}</div><div className="flex gap-2"><ActionButton label="Dismiss" tone="neutral" onClick={() => resolveReport.mutate({ reportId: report.id, status: "dismissed" })} /><ActionButton label="Actioned" tone="positive" onClick={() => resolveReport.mutate({ reportId: report.id, status: "actioned" })} /></div></div>)}{!reports.isLoading && reports.data?.length === 0 && <Empty label="No open user reports." />}</ModerationPanel>
      <ModerationPanel title="Categories & tags" icon={<Tags className="h-5 w-5 text-teal-600" />}><div className="space-y-3">{taxonomy.data?.categories.map(category => <TaxonomyRow key={`category-${category.id}`} label={category.name} active={category.isActive} onToggle={() => setCategoryActive.mutate({ categoryId: category.id, isActive: !category.isActive })} />)}{taxonomy.data?.tags.map(tag => <TaxonomyRow key={`tag-${tag.id}`} label={`#${tag.name}`} active={tag.isActive} onToggle={() => setTagActive.mutate({ tagId: tag.id, isActive: !tag.isActive })} />)}{!taxonomy.isLoading && !taxonomy.data?.categories.length && !taxonomy.data?.tags.length && <Empty label="No category or tag records have been created yet." />}</div></ModerationPanel></div>
  </main></IsometricBackdrop>;
}

function ModerationPanel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="glass-panel rounded-3xl p-6"><div className="flex items-center gap-2">{icon}<h2 className="display-font text-2xl font-bold">{title}</h2></div><div className="mt-5 space-y-3">{children}</div></section>;
}

function ActionButton({ label, tone, onClick }: { label: string; tone: "positive" | "negative" | "neutral"; onClick: () => void }) {
  const classes = tone === "positive" ? "bg-teal-700 text-white" : tone === "negative" ? "border border-rose-200 bg-rose-50 text-rose-800" : "border border-slate-200 bg-white text-slate-700";
  return <button type="button" className={`rounded-full px-3 py-2 text-xs font-bold transition ${classes}`} onClick={onClick}>{label}</button>;
}

function TaxonomyRow({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return <div className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-4 py-3"><span className="text-sm font-semibold text-slate-800">{label}</span><button type="button" onClick={onToggle} className={`rounded-full px-2.5 py-1 text-xs font-bold ${active ? "bg-teal-100 text-teal-800" : "bg-slate-100 text-slate-600"}`}>{active ? "Active" : "Inactive"}</button></div>;
}

function Empty({ label }: { label: string }) {
  return <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-600"><CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-teal-600" />{label}</div>;
}
