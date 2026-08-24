import { ArrowRight, Compass, Layers3, Search, Sparkles, Workflow } from "lucide-react";
import { Link, useLocation } from "wouter";
import { IsometricBackdrop } from "@/components/IsometricBackdrop";
import { PromptCard } from "@/components/PromptCard";
import { SiteHeader } from "@/components/SiteHeader";
import { trpc } from "@/lib/trpc";
import { useState, type ComponentProps } from "react";

type PublicPrompt = ComponentProps<typeof PromptCard>["prompt"];

export default function Home() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const featured = trpc.discovery.list.useQuery({ sort: "featured", limit: 3 });
  const trending = trpc.discovery.list.useQuery({ sort: "trending", limit: 3 });
  const recent = trpc.discovery.list.useQuery({ sort: "recent", limit: 3 });
  const categories = trpc.discovery.categories.useQuery();

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setLocation(`/discover${query.trim() ? `?query=${encodeURIComponent(query.trim())}` : ""}`);
  };

  return <IsometricBackdrop>
    <SiteHeader />
    <main>
      <section className="mx-auto grid max-w-7xl gap-10 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:pt-24">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50/80 px-3 py-1.5 text-xs font-bold tracking-wide text-cyan-900"><Sparkles className="h-3.5 w-3.5" /> THE INTELLIGENT PROMPT UNIVERSE</div>
          <h1 className="display-font mt-6 max-w-3xl text-5xl font-extrabold leading-[0.96] tracking-[-0.055em] text-slate-950 sm:text-6xl lg:text-7xl">Better prompts.<br /><span className="text-teal-600">Clearer work.</span></h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">Discover prompts with real structure, translate rough ideas into agent-ready instructions, and keep every improvement versioned and reusable.</p>
          <form onSubmit={submitSearch} className="glass-panel mt-8 flex max-w-2xl items-center gap-3 rounded-2xl p-2">
            <Search className="ml-2 h-5 w-5 shrink-0 text-slate-400" />
            <label className="sr-only" htmlFor="hero-search">Search the prompt library</label>
            <input id="hero-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search prompts, use cases, models..." className="min-w-0 flex-1 bg-transparent px-1 py-3 text-sm font-medium outline-none placeholder:text-slate-400" />
            <button className="verbix-button px-4 py-2.5" type="submit">Search <ArrowRight className="h-4 w-4" /></button>
          </form>
          <div className="mt-7 flex flex-wrap items-center gap-3"><Link href="/compose" className="verbix-button">Create a prompt <Sparkles className="h-4 w-4 text-cyan-200" /></Link><Link href="/discover" className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-white/70">Browse the library <ArrowRight className="h-4 w-4" /></Link></div>
        </div>
        <div className="relative mx-auto flex min-h-[400px] w-full max-w-xl items-center justify-center lg:min-h-[500px]" aria-label="Prompt improvement visual">
          <div className="absolute h-[19rem] w-[19rem] rotate-[30deg] rounded-[3rem] border border-cyan-200 bg-cyan-200/35 shadow-[24px_25px_0_rgba(15,23,42,0.06),0_38px_70px_rgba(8,145,178,0.2)] backdrop-blur-sm" />
          <div className="absolute h-[15rem] w-[15rem] -translate-x-20 translate-y-14 -rotate-[23deg] rounded-[2.5rem] border border-rose-200 bg-rose-200/40 shadow-[20px_20px_0_rgba(251,113,133,0.13)]" />
          <div className="glass-panel relative w-[80%] rounded-[2rem] p-6 shadow-[0_30px_90px_rgba(15,23,42,0.16)]">
            <div className="flex items-center justify-between"><span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-bold text-white">PROMPT MAP</span><Workflow className="h-5 w-5 text-teal-600" /></div>
            <div className="mt-6 space-y-3"><div className="h-3 w-3/4 rounded-full bg-slate-900" /><div className="h-3 w-full rounded-full bg-slate-200" /><div className="h-3 w-5/6 rounded-full bg-cyan-200" /></div>
            <div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-xl bg-teal-50 p-3 text-xs font-bold text-teal-800">Intent<br /><span className="font-medium text-teal-600">made explicit</span></div><div className="rounded-xl bg-blue-50 p-3 text-xs font-bold text-blue-800">Constraints<br /><span className="font-medium text-blue-600">kept intact</span></div></div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Discover by discipline</p><h2 className="display-font mt-2 text-3xl font-bold tracking-tight">Structured prompts for real work.</h2></div><Link href="/discover" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-white">View all <ArrowRight className="h-4 w-4" /></Link></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(categories.data ?? []).slice(0, 4).map(category => <Link key={category.id} href={`/discover?category=${category.slug}`} className="glass-panel group rounded-2xl p-5 transition hover:-translate-y-1"><Layers3 className="h-6 w-6 text-teal-600" /><h3 className="mt-5 font-bold text-slate-950">{category.name}</h3><p className="mt-1 text-sm leading-5 text-slate-600">{category.description || "Browse focused prompt patterns."}</p><span className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-teal-700">Explore <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" /></span></Link>)}
          {!categories.isLoading && categories.data?.length === 0 && <div className="glass-panel col-span-full rounded-2xl p-6 text-sm text-slate-600">Categories will appear as approved prompts are published. Start the collection from your workspace.</div>}
        </div>
      </section>

      <section className="border-y border-slate-200/70 bg-white/60 py-16"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Featured prompts</p><h2 className="display-font mt-2 text-3xl font-bold tracking-tight">Start with a strong foundation.</h2></div><Link href="/discover" className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">Explore discovery <Compass className="h-4 w-4" /></Link></div><div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{featured.data?.map(prompt => <PromptCard key={prompt.id} prompt={prompt} />)}{!featured.isLoading && featured.data?.length === 0 && <div className="glass-panel col-span-full rounded-3xl p-8 text-center"><Sparkles className="mx-auto h-8 w-8 text-teal-500" /><h3 className="display-font mt-4 text-xl font-bold">The public library starts here.</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">Create a prompt, submit it for review, and it will appear in public discovery once approved.</p><Link href="/compose" className="verbix-button mt-5">Compose a prompt</Link></div>}</div></div></section>
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"><div className="grid gap-10 xl:grid-cols-2"><PromptShelf eyebrow="Trending now" heading="Prompts people are putting to work." prompts={trending.data} loading={trending.isLoading} sort="trending" /><PromptShelf eyebrow="Just published" heading="The newest approved building blocks." prompts={recent.data} loading={recent.isLoading} sort="recent" /></div></section>
    </main>
  </IsometricBackdrop>;
}

function PromptShelf({ eyebrow, heading, prompts, loading, sort }: { eyebrow: string; heading: string; prompts: PublicPrompt[] | undefined; loading: boolean; sort: "trending" | "recent" }) {
  return <section><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">{eyebrow}</p><h2 className="display-font mt-2 text-2xl font-bold tracking-tight">{heading}</h2></div><Link href={`/discover?sort=${sort}`} className="shrink-0 text-sm font-bold text-slate-700">View all</Link></div><div className="mt-6 grid gap-5">{prompts?.map(prompt => <PromptCard key={prompt.id} prompt={prompt} />)}{!loading && prompts?.length === 0 && <div className="glass-panel rounded-2xl p-5 text-sm text-slate-600">Newly approved prompts will appear here as the public library grows.</div>}</div></section>;
}
