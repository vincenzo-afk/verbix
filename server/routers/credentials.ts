import { z } from "zod";
import { listProviderCredentialHints, removeProviderCredential, upsertProviderCredential } from "../db";
import { credentialHint, encryptCredential } from "../services/credential-vault";
import { protectedProcedure, router } from "../_core/trpc";

export const credentialsRouter = router({
  list: protectedProcedure.query(({ ctx }) => listProviderCredentialHints(ctx.user.id)),
  set: protectedProcedure.input(z.object({ provider: z.string().min(2).max(80), secret: z.string().min(6).max(4000) })).mutation(async ({ ctx, input }) => {
    await upsertProviderCredential({
      userId: ctx.user.id,
      provider: input.provider,
      encryptedSecret: encryptCredential(input.secret),
      secretHint: credentialHint(input.secret),
    });
    return { success: true };
  }),
  remove: protectedProcedure.input(z.object({ provider: z.string().min(2).max(80) })).mutation(async ({ ctx, input }) => {
    await removeProviderCredential(ctx.user.id, input.provider);
    return { success: true };
  }),
});
