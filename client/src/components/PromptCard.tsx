import { ArrowUpRight, Boxes, Copy, Star, Tags } from "lucide-react";
import { Link } from "wouter";

export type PromptCardData = {
  id: number;
  slug: string;
  title: string;
  description: string;
  promptType: string;
  modelCompatibility: string[];
  averageRating: number;
  ratingCount: number;
  savesCount: number;
  runsCount: number;
  categoryName: string | null;
  authorName: string | null;
  tags: string[];
};

export function PromptCard({ prompt }: { prompt: PromptCardData }) {
  return (
    <article className="glass-panel group relative overflow-hidden rounded-[1.5rem] p-5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_26px_80px_rgba(15,23,42,0.13)]">
      <div className="absolute -right-7 -top-8 h-24 w-24 rotate-45 rounded-2xl border border-cyan-200 bg-cyan-200/35 transition duration-300 group-hover:rotate-[58deg]" aria-hidden="true" />
      <div className="relative flex h-full flex-col">
        <div className="mb-4 flex items-start justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-3 py-1.5 text-xs font-bold text-white"><Boxes className="h-3.5 w-3.5 text-cyan-200" /> {prompt.categoryName || prompt.promptType}</span>
          <Link href={`/prompts/${prompt.slug}`} aria-label={`Open ${prompt.title}`} className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-900 transition hover:bg-cyan-100"><ArrowUpRight className="h-4 w-4" /></Link>
        </div>
        <h3 className="display-font text-xl font-bold tracking-tight text-slate-950">{prompt.title}</h3>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{prompt.description}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {prompt.tags.slice(0, 3).map(tag => <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"><Tags className="h-3 w-3" /> {tag}</span>)}
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
          <span>{prompt.authorName || "Verbix creator"}</span>
          <span className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1"><Copy className="h-3.5 w-3.5" /> {prompt.savesCount}</span>
            {prompt.ratingCount > 0 ? <span className="inline-flex items-center gap-1 font-semibold text-amber-600"><Star className="h-3.5 w-3.5 fill-current" /> {prompt.averageRating}/5</span> : <span>Unrated</span>}
          </span>
        </div>
      </div>
    </article>
  );
}
