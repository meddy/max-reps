import { describe, expect, it } from "vitest";
import type { User } from "firebase/auth";
import { evaluateUidAccess } from "./authPolicy";

function user(uid: string): User {
  return { uid } as User;
}

describe("evaluateUidAccess", () => {
  it("returns signed_out when user is null", () => {
    expect(evaluateUidAccess(null, undefined)).toEqual({
      outcome: "signed_out",
    });
    expect(evaluateUidAccess(null, "x")).toEqual({ outcome: "signed_out" });
  });

  it("allows any user when allowedUid is undefined", () => {
    const u = user("any");
    expect(evaluateUidAccess(u, undefined)).toEqual({
      outcome: "allowed",
      user: u,
    });
  });

  it("allows user when uid matches allowedUid", () => {
    const u = user("abc");
    expect(evaluateUidAccess(u, "abc")).toEqual({
      outcome: "allowed",
      user: u,
    });
  });

  it("denies when uid does not match allowedUid", () => {
    const u = user("wrong");
    expect(evaluateUidAccess(u, "expected")).toEqual({
      outcome: "denied",
      errorMessage: "Access denied",
    });
  });

  it("treats empty string allowedUid as falsy and allows", () => {
    const u = user("any");
    expect(evaluateUidAccess(u, "")).toEqual({ outcome: "allowed", user: u });
  });
});
