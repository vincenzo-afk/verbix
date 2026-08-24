import { useMemo, useState } from "react";
import { AlertTriangle, Check, Clipboard, FileDown, Loader2, Play, RefreshCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { compilePrompt, parsePromptVariables, validateVariableValues } from "@shared/prompt-engine";

type VariableDefinition = {
  name: string;
  label: string;
  isRequired: boolean;
  variableType: "text" | "number" | "select";
  options?: string[] | null;
};

type PromptWorkbenchProps = {
  initialPrompt: string;
  title?: string;
  promptId?: number;
  variableDefinitions?: VariableDefinition[];
  onOriginalChange?: (body: string) => void;
  onAcceptImprovement?: (improvementId: number, body: string) => void;
};

export function PromptWorkbench({ initialPrompt, title = "Untitled prompt", promptId, variableDefinitions, onOriginalChange, onAcceptImprovement }: PromptWorkbenchProps) {
  const [originalPrompt, setOriginalPrompt] = useState(initialPrompt);
  const [values, setValues] = useState<Record<string, string>>({});
  const [variableErrors, setVariableErrors] = useState<Record<string, string>>({});
  const [improvement, setImprovement] = useState<ReturnType<typeof trpc.improvement.enhance.useMutation>["data"]>();
  const [execution, setExecution] = useState<ReturnType<typeof trpc.execution.run.useMutation>["data"]>();
  const { isAuthenticated } = useAuth();
  const variables = useMemo(() => parsePromptVariables(originalPrompt), [originalPrompt]);
  const inputVariables = useMemo(() => variables.map(variable => {
    const definition = variableDefinitions?.find(item => item.name === variable.name);
    return { ...variable, isRequired: definition?.isRequired ?? false, variableType: definition?.variableType ?? "text", options: definition?.options ?? [] };
  }), [variables, variableDefinitions]);
  const compiledPrompt = useMemo(() => compilePrompt(originalPrompt, values), [originalPrompt, values]);
  const enhance = trpc.improvement.enhance.useMutation({
    onSuccess: result => setImprovement(result),
    onError: error => toast.error(error.message),
  });
  const runPrompt = trpc.execution.run.useMutation({
    onSuccess: result => { setExecution(result); toast.success(`Completed with ${result.provider}`); },
    onError: error => toast.error(error.message),
  });

  const copy = async (content: string) => {
    await navigator.clipboard.writeText(content);
    toast.success("Copied to clipboard");
  };

  const exportText = () => {
    const blob = new Blob([compiledPrompt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "verbix-prompt"}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ title, prompt: compiledPrompt, variables: values }, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "verbix-prompt"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const runCompiledPrompt = () => {
    if (!isAuthenticated) return startLogin();
    const errors = validateVariableValues(inputVariables, values);
    setVariableErrors(errors);
    if (Object.keys(errors).length) {
      toast.error("Complete the highlighted variable fields before running.");
      return;
    }
    runPrompt.mutate({ prompt: compiledPrompt, variables: values });
  };

  const updateValue = (name: string, value: string) => {
    setValues(current => ({ ...current, [name]: value }));
    setVariableErrors(current => {
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(330px,0.92fr)]">
      <div className="glass-panel rounded-[1.75rem] p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Original prompt</p>
            <h2 className="display-font mt-1 text-2xl font-bold">Build with precision</h2>
          </div>
          <button type="button" onClick={() => copy(compiledPrompt)} className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"><Clipboard className="mr-1.5 inline h-4 w-4" /> Copy</button>
        </div>
        <label className="mt-5 block text-sm font-bold text-slate-800" htmlFor="prompt-body">Prompt body</label>
        <textarea id="prompt-body" value={originalPrompt} onChange={event => { setOriginalPrompt(event.target.value); onOriginalChange?.(event.target.value); }} className="mt-2 min-h-64 w-full resize-y rounded-2xl border border-slate-200 bg-white/80 p-4 font-mono text-sm leading-6 text-slate-800 shadow-inner shadow-slate-100 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100" aria-describedby="prompt-body-help" />
        <p id="prompt-body-help" className="mt-2 text-xs text-slate-500">Use <code className="rounded bg-slate-100 px-1.5 py-0.5">{"{{variable}}"}</code> tokens to generate editable input fields.</p>

        {inputVariables.length > 0 && <div className="mt-5 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4">
          <p className="mb-3 text-sm font-bold text-cyan-950">Customize variables</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {inputVariables.map(variable => <label key={variable.name} className="block text-sm font-semibold text-slate-700">{variable.label}{variable.isRequired && <span className="ml-1 text-rose-700" aria-label="required">*</span>}{variable.variableType === "select" ? <select value={values[variable.name] ?? ""} onChange={event => updateValue(variable.name, event.target.value)} aria-invalid={Boolean(variableErrors[variable.name])} aria-describedby={variableErrors[variable.name] ? `${variable.name}-error` : undefined} className={`mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100 ${variableErrors[variable.name] ? "border-rose-400" : "border-cyan-100"}`}><option value="">Select {variable.label}</option>{variable.options?.map(option => <option key={option} value={option}>{option}</option>)}</select> : <input type={variable.variableType === "number" ? "number" : "text"} value={values[variable.name] ?? ""} onChange={event => updateValue(variable.name, event.target.value)} placeholder={`Enter ${variable.label.toLowerCase()}`} aria-invalid={Boolean(variableErrors[variable.name])} aria-describedby={variableErrors[variable.name] ? `${variable.name}-error` : undefined} className={`mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100 ${variableErrors[variable.name] ? "border-rose-400" : "border-cyan-100"}`} />}{variableErrors[variable.name] && <span id={`${variable.name}-error`} role="alert" className="mt-1 block text-xs font-medium text-rose-700">{variableErrors[variable.name]}</span>}</label>)}
          </div>
          <button type="button" onClick={() => { setValues({}); setVariableErrors({}); }} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-cyan-800 hover:text-cyan-950"><RefreshCcw className="h-3.5 w-3.5" /> Reset values</button>
        </div>}

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="verbix-button" disabled={enhance.isPending || !originalPrompt.trim()} onClick={() => enhance.mutate({ prompt: originalPrompt, promptId, target: "a downstream AI agent", tone: "clear and professional", outputStrictness: "balanced" })}>
            {enhance.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-cyan-200" />} Improve with AI
          </button>
          <button type="button" onClick={runCompiledPrompt} disabled={runPrompt.isPending || !compiledPrompt.trim()} className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-bold text-blue-900 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50">
            {runPrompt.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {isAuthenticated ? "Run prompt" : "Sign in to run"}
          </button>
          <button type="button" onClick={exportText} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"><FileDown className="h-4 w-4" /> Export .txt</button>
          <button type="button" onClick={exportJson} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"><FileDown className="h-4 w-4" /> Export .json</button>
        </div>
      </div>

      <aside className="glass-panel rounded-[1.75rem] p-5 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Live compiled preview</p>
        <pre className="mt-4 max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 font-mono text-sm leading-6 text-cyan-50">{compiledPrompt}</pre>
        {execution && <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Run complete · {execution.provider} / {execution.model}</p><pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-3 font-mono text-xs leading-5 text-blue-50">{execution.output}</pre></div>}
        {improvement && <div className="mt-5 rounded-2xl border border-teal-100 bg-teal-50/70 p-4">
          <div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-teal-600 text-white"><Sparkles className="h-4 w-4" /></span><div><p className="font-bold text-teal-950">Agent-ready improvement</p><p className="mt-1 text-sm leading-5 text-teal-900">{improvement.intentSummary}</p></div></div>
          {improvement.isFallback && <p className="mt-3 flex gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {improvement.warnings[0]}</p>}
          <textarea value={improvement.improvedPrompt} onChange={event => setImprovement(current => current ? { ...current, improvedPrompt: event.target.value } : current)} className="mt-4 min-h-44 w-full rounded-xl border border-teal-100 bg-white p-3 font-mono text-xs leading-5 text-slate-800 outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100" aria-label="Editable AI improvement" />
          <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
            <InfoList title="Assumptions" items={improvement.assumptions} /><InfoList title="Missing info" items={improvement.missingInformation} /><InfoList title="Constraints" items={improvement.constraints} /><InfoList title="Acceptance criteria" items={improvement.acceptanceCriteria} />
          </div>
          <p className="mt-3 rounded-xl bg-white/80 p-3 text-xs text-slate-700"><b>Output format:</b> {improvement.outputFormat}</p>
          <p className="mt-2 rounded-xl bg-white/80 p-3 text-xs text-slate-700"><b>Agent notes:</b> {improvement.agentNotes}</p>
          <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => copy(improvement.improvedPrompt)} className="rounded-full bg-teal-700 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-teal-800"><Clipboard className="mr-1 inline h-3.5 w-3.5" /> Copy improvement</button>{onAcceptImprovement && <button type="button" onClick={() => { setOriginalPrompt(improvement.improvedPrompt); onOriginalChange?.(improvement.improvedPrompt); onAcceptImprovement(improvement.improvementId, improvement.improvedPrompt); }} className="rounded-full border border-teal-200 bg-white px-3.5 py-2 text-xs font-bold text-teal-900 transition hover:bg-teal-50"><Check className="mr-1 inline h-3.5 w-3.5" /> Use as draft</button>}</div>
        </div>}
      </aside>
    </section>
  );
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return <div className="rounded-xl bg-white/80 p-3"><p className="font-bold text-slate-800">{title}</p>{items.length ? <ul className="mt-1.5 space-y-1 text-slate-600">{items.map(item => <li key={item}>• {item}</li>)}</ul> : <p className="mt-1 text-slate-500">None identified.</p>}</div>;
}
