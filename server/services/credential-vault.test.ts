import { describe, expect, it } from "vitest";
import { credentialHint, decryptCredential, encryptCredential } from "./credential-vault";

describe("credential vault", () => {
  it("encrypts credentials at rest and restores plaintext only inside server code", () => {
    const original = "provider-secret-1234";
    const encrypted = encryptCredential(original);
    expect(encrypted).not.toContain(original);
    expect(decryptCredential(encrypted)).toBe(original);
    expect(credentialHint(original)).toBe("••••1234");
  });
});

