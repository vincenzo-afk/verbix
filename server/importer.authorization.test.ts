import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(user: TrpcContext["user"]): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const regularUser = {
  id: 77,
  openId: "importer-regular-user",
  name: "Regular User",
  email: "regular@example.com",
  loginMethod: "test",
  role: "user" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

describe("review-first importer authorization", () => {
  it("rejects anonymous attempts to access creator import procedures", async () => {
    const caller = appRouter.createCaller(context(null));
    await expect(caller.importer.mine()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.importer.submitSource({ url: "https://example.com/prompts" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.importer.ingest({ sourceId: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects non-administrators before importer moderation or domain-policy actions run", async () => {
    const caller = appRouter.createCaller(context(regularUser));
    await expect(caller.importer.reviewQueue()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.importer.reviewCandidate({ candidateId: 1, action: "approve" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.importer.reviewOutput({ outputId: 1, action: "approve" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.importer.promoteCandidate({ candidateId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.importer.setDomainPolicy({ domain: "example.com", status: "blocked" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
