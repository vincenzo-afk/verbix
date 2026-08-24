import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("admin moderation authorization", () => {
  it("rejects a signed-in non-administrator before the moderation queue can be read", async () => {
    const ctx: TrpcContext = {
      user: {
        id: 42,
        openId: "regular-user",
        name: "Regular User",
        email: "user@example.com",
        loginMethod: "manus",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };

    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.queue()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
