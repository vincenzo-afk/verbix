import { ArrowLeft, Bookmark, Eye, Play, Sparkles } from "lucide-react";
import { Link, useRoute } from "wouter";
import { IsometricBackdrop } from "@/components/IsometricBackdrop";
import { PromptCard } from "@/components/PromptCard";
import { SiteHeader } from "@/components/SiteHeader";
import { trpc } from "@/lib/trpc";

export default function CreatorProfile() {
  const [, params] = useRoute("/creators/:id");
  const userId = Number(params?.id);
  const profile = trpc.discovery.creator.useQuery({ userId }, { enabled: Number.isInteger(userId) && userId > 0 });
  if (profile.isLoading) return <IsometricBackdrop><SiteHeader /><main className="mx-auto max-w-7xl px-4 py-20 sm:px-6"><div className="glass-panel animate-pulse rounded-3xl p-10"><div className="h-9 w-64 rounded bg-slate-200" /><div className="mt-6 h-32 rounded bg-slate-100" /></div></main></IsometricBackdrop>;
  if (!profile.data) return <IsometricBackdrop><SiteHeader /><main className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6"><h1 className="display-font text-4xl font-bold">Creator profile not found.</h1><p className="mt-3 text-slate-600">This profile may be unavailable or have no public presence.</p><Link href="/discover" className="verbix-button mt-6"><ArrowLeft className="h-4 w-4" /> Discover prompts</Link></main></IsometricBackdrop>;
  const { creator, prompts, metrics } = profile.data;
  const initial = creator.name?.slice(0, 1).toUpperCase() || "V";
  return <IsometricBackdrop><SiteHeader /><main className="mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-8"><Link href="/discover" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-950"><ArrowLeft className="h-4 w-4" /> Public library</Link><section className="glass-panel mt-6 overflow-hidden rounded-[2rem] p-6 sm:p-10"><div className="flex flex-col gap-6 sm:flex-row sm:items-center"><div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-3xl bg-slate-950 text-3xl font-extrabold text-cyan-200">{creator.avatarUrl ? <img src={creator.avatarUrl} alt="" className="h-full w-full object-cover" /> : initial}</div><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Verbix creator</p><h1 className="display-font mt-2 text-4xl font-extrabold tracking-tight">{creator.name || "Verbix creator"}</h1><p className="mt-3 max-w-2xl text-slate-600">{creator.bio || "Sharing structured, reusable prompts for clearer work."}</p></div></div><div className="mt-8 grid gap-4 sm:grid-cols-3"><Metric icon={<Eye className="h-4 w-4" />} label="Public views" value={metrics.views} /><Metric icon={<Play className="h-4 w-4" />} label="Prompt runs" value={metrics.runs} /><Metric icon={<Bookmark className="h-4 w-4" />} label="Saves" value={metrics.saves} /></div></section><section className="mt-12"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Published collection</p><h2 className="display-font mt-2 text-3xl font-bold">Prompts by {creator.name || "this creator"}</h2></div><div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{prompts.map(prompt => <PromptCard key={prompt.id} prompt={prompt} />)}{prompts.length === 0 && <div className="glass-panel col-span-full rounded-3xl p-10 text-center"><Sparkles className="mx-auto h-8 w-8 text-teal-500" /><h3 className="display-font mt-4 text-xl font-bold">No public prompts yet.</h3><p className="mt-2 text-sm text-slate-600">Published prompts will appear here after moderation.</p></div>}</div></section></main></IsometricBackdrop>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="rounded-2xl bg-white/70 p-4"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{icon}{label}</p><p className="display-font mt-2 text-3xl font-bold text-slate-950">{value.toLocaleString()}</p></div>;
}
