import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createImportJob,
  createImportSource,
  getImportSourceByHash,
  getImportSourceForUser,
  getImportDomainPolicy,
  listImportCandidatesForUser,
  listImportReviewQueue,
  listImportSourcesForUser,
  markImportFailed,
  promoteImportCandidate,
  reviewImportCandidate,
  reviewImportOutput,
  storeImportExtraction,
  updateImportJob,
  updateImportSource,
  upsertImportDomainPolicy,
} from "../db";
import { ImportBlockedError, inspectApprovedSource, normalizeSourcePrompts, sourceDomain, sourceUrlHash } from "../services/source-importer";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";

const urlSchema = z.string().url().max(2_000);

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 112) || "imported-prompt";
}

export const importerRouter = router({
  mine: protectedProcedure.query(async ({ ctx }) => {
    const [sources, candidates] = await Promise.all([
      listImportSourcesForUser(ctx.user.id),
      listImportCandidatesForUser(ctx.user.id),
    ]);
    return { sources, candidates };
  }),

  submitSource: protectedProcedure.input(z.object({ url: urlSchema })).mutation(async ({ ctx, input }) => {
    let hash: string;
    let domain: string;
    try {
      hash = sourceUrlHash(input.url);
      domain = sourceDomain(input.url);
    } catch {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Submit a valid public HTTP(S) URL without embedded credentials." });
    }
    const existing = await getImportSourceByHash(hash);
    if (existing) {
      if (existing.submittedById !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "This source has already been submitted by another reviewer." });
      }
      return { sourceId: existing.id, duplicate: true };
    }
    const sourceId = await createImportSource({ submittedById: ctx.user.id, submittedUrl: input.url, urlHash: hash, domain });
    return { sourceId, duplicate: false };
  }),

  ingest: protectedProcedure.input(z.object({ sourceId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const source = await getImportSourceForUser(input.sourceId, ctx.user.id, ctx.user.role === "admin");
    if (!source) throw new TRPCError({ code: "FORBIDDEN", message: "You can only import a source you submitted." });
    const jobId = await createImportJob({ sourceId: source.id, requestedById: ctx.user.id });
    const domainPolicy = await getImportDomainPolicy(source.domain);
    if (domainPolicy?.status !== "approved") {
      const reason = domainPolicy?.status === "blocked"
        ? "An administrator has blocked this domain for import."
        : "This domain needs administrator approval of its terms and reuse policy before it can be fetched.";
      await markImportFailed({ sourceId: source.id, jobId, status: "blocked", reason });
      throw new TRPCError({ code: "FORBIDDEN", message: reason });
    }
    await Promise.all([
      updateImportSource(source.id, { status: "fetching", failureReason: null }),
      updateImportJob(jobId, { status: "fetching", startedAt: new Date(), errorMessage: null }),
    ]);
    try {
      const inspected = await inspectApprovedSource(source.submittedUrl);
      await updateImportJob(jobId, { status: "extracting" });
      const candidates = await normalizeSourcePrompts({ promptBlocks: inspected.promptBlocks, identity: `import:${source.id}:${ctx.user.id}` });
      if (!candidates.length) {
        await markImportFailed({ sourceId: source.id, jobId, status: "failed", reason: "No recognizable prompt text was found on the approved source page." });
        return { jobId, candidatesCreated: 0, outputsFound: 0, status: "failed" as const };
      }
      const stored = await storeImportExtraction({
        sourceId: source.id,
        submittedById: source.submittedById,
        jobId,
        source: {
          canonicalUrl: inspected.canonicalUrl,
          pageTitle: inspected.pageTitle,
          displayedAuthor: inspected.displayedAuthor,
          licenseNotice: inspected.licenseNotice,
          robotsState: inspected.robotsState,
          httpStatus: inspected.httpStatus,
          contentHash: inspected.contentHash,
          excerpt: inspected.excerpt,
        },
        candidates,
        exampleOutputs: inspected.exampleOutputs,
      });
      return { jobId, candidatesCreated: stored.candidateIds.length, outputsFound: stored.outputsFound, status: "completed" as const };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to import this source.";
      const blocked = error instanceof ImportBlockedError;
      await markImportFailed({ sourceId: source.id, jobId, status: blocked ? "blocked" : "failed", reason: message, ...(blocked ? { robotsState: error.robotsState } : {}) });
      throw new TRPCError({ code: blocked ? "FORBIDDEN" : "BAD_REQUEST", message });
    }
  }),

  reviewQueue: adminProcedure.query(() => listImportReviewQueue()),
  reviewCandidate: adminProcedure.input(z.object({ candidateId: z.number().int().positive(), action: z.enum(["approve", "reject"]), note: z.string().max(2_000).optional() })).mutation(async ({ ctx, input }) => {
    await reviewImportCandidate({ candidateId: input.candidateId, reviewerId: ctx.user.id, action: input.action, note: input.note });
    return { success: true };
  }),
  reviewOutput: adminProcedure.input(z.object({ outputId: z.number().int().positive(), action: z.enum(["approve", "reject"]) })).mutation(async ({ ctx, input }) => {
    await reviewImportOutput({ outputId: input.outputId, reviewerId: ctx.user.id, action: input.action });
    return { success: true };
  }),
  setDomainPolicy: adminProcedure.input(z.object({ domain: z.string().min(1).max(255).regex(/^[a-z0-9.-]+$/i), status: z.enum(["approved", "blocked", "review_required"]), termsUrl: z.string().url().max(2_000).optional(), reuseNotes: z.string().max(2_000).optional() }).superRefine((value, issue) => {
    if (value.status === "approved" && !value.termsUrl) issue.addIssue({ code: "custom", path: ["termsUrl"], message: "Provide the public terms or reuse-policy URL before approving a source domain." });
  })).mutation(async ({ ctx, input }) => {
    await upsertImportDomainPolicy({ domain: input.domain.toLowerCase(), status: input.status, reviewerId: ctx.user.id, termsUrl: input.termsUrl, reuseNotes: input.reuseNotes });
    return { success: true };
  }),
  promoteCandidate: adminProcedure.input(z.object({ candidateId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const promptId = await promoteImportCandidate({ candidateId: input.candidateId, reviewerId: ctx.user.id, slug: `${slugify(`import-${input.candidateId}`)}-${input.candidateId}` });
    return { promptId };
  }),
});
