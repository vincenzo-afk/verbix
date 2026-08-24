import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("prompt execution authorization", () => {
  it("rejects execution before a provider call when no authenticated user is present", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };

    const caller = appRouter.createCaller(ctx);
    await expect(caller.execution.run({ prompt: "Return a concise status update.", variables: {} })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
