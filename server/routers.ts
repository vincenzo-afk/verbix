import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { adminRouter } from "./routers/admin";
import { agentsRouter } from "./routers/agents";
import { credentialsRouter } from "./routers/credentials";
import { discoveryRouter } from "./routers/discovery";
import { executionRouter } from "./routers/execution";
import { improvementRouter } from "./routers/improvement";
import { importerRouter } from "./routers/importer";
import { workspaceRouter } from "./routers/workspace";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  discovery: discoveryRouter,
  workspace: workspaceRouter,
  improvement: improvementRouter,
  execution: executionRouter,
  admin: adminRouter,
  agents: agentsRouter,
  credentials: credentialsRouter,
  importer: importerRouter,
});

export type AppRouter = typeof appRouter;
