import { ArrowLeft, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { IsometricBackdrop } from "@/components/IsometricBackdrop";
import { SiteHeader } from "@/components/SiteHeader";

export default function NotFound() {
  return <IsometricBackdrop><SiteHeader /><main className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6"><Sparkles className="mx-auto h-10 w-10 text-teal-600" /><h1 className="display-font mt-5 text-5xl font-extrabold tracking-tight">This route has no prompt.</h1><p className="mx-auto mt-4 max-w-lg text-lg leading-7 text-slate-600">The page you requested is not available, but the prompt library and composer are ready for your next idea.</p><Link href="/" className="verbix-button mt-7"><ArrowLeft className="h-4 w-4" /> Back to Verbix</Link></main></IsometricBackdrop>;
}
