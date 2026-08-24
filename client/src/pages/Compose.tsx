import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { IsometricBackdrop } from "@/components/IsometricBackdrop";
import { PromptWorkbench } from "@/components/PromptWorkbench";
import { SiteHeader } from "@/components/SiteHeader";
import { trpc } from "@/lib/trpc";
import { parsePromptVariables } from "@shared/prompt-engine";
import { Check, Save, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

const starterPrompt = "Create a {{deliverable}} for {{audience}}.\n\nContext: {{context}}\n\nConstraints:\n- {{constraint}}\n\nReturn the response as {{output_format}}.";

export default function Compose() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const [title, setTitle] = useState("Untitled prompt");
  const [description, setDescription] = useState("A structured prompt designed for a specific outcome.");
  const [body, setBody] = useState(starterPrompt);
  const setVariables = trpc.workspace.variables.useMutation();
  const createPrompt = trpc.workspace.create.useMutation({ onSuccess: promptId => {
    const variables = parsePromptVariables(body).map(variable => ({ name: variable.name, label: variable.label, variableType: "text" as const, isRequired: false }));
    if (variables.length) setVariables.mutate({ promptId, variables });
    toast.success("Draft saved to your workspace");
    setLocation(`/workspace/${promptId}`);
  }, onError: error => toast.error(error.message) });

  const saveDraft = () => {
    if (!isAuthenticated) return startLogin();
    const slug = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `prompt-${Date.now()}`;
    createPrompt.mutate({ title, description, body, slug, promptType: "text", visibility: "private", modelCompatibility: ["General AI"] });
  };

  return <IsometricBackdrop><SiteHeader /><main className="mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Prompt composer</p><h1 className="display-font mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">Shape the intent before the model sees it.</h1><p className="mt-3 max-w-3xl text-lg leading-7 text-slate-600">Keep the original, test variables, and use the keyless enhancement layer to create a more explicit agent brief.</p></div><Link href="/workspace" className="rounded-full border border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-bold text-slate-700">Open workspace</Link></div>
    <section className="glass-panel mt-8 grid gap-4 rounded-3xl p-5 md:grid-cols-2"><label className="text-sm font-bold text-slate-800">Prompt title<input value={title} onChange={event => setTitle(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-medium outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100" /></label><label className="text-sm font-bold text-slate-800">Description<input value={description} onChange={event => setDescription(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-medium outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100" /></label></section>
    <div className="mt-5"><PromptWorkbench initialPrompt={body} title={title} onOriginalChange={setBody} onAcceptImprovement={(_improvementId, improvedBody) => setBody(improvedBody)} /></div>
    <div className="glass-panel mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4"><p className="text-sm text-slate-600">Your original text remains editable. Accepted improvements are only versioned after you save the prompt.</p><div className="flex gap-2"><button type="button" onClick={saveDraft} disabled={createPrompt.isPending} className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"><Save className="mr-1.5 inline h-4 w-4" /> Save draft</button><button type="button" onClick={saveDraft} disabled={createPrompt.isPending} className="verbix-button px-4 py-2.5"><Send className="h-4 w-4 text-cyan-200" /> {isAuthenticated ? "Save & submit later" : "Sign in to save"}</button></div></div>
  </main></IsometricBackdrop>;
}
