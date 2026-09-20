import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rememberedGroup, rememberGroup, resolveGroupId } from "./groupContext";
import { installStorageStub, type StorageStub } from "../test/stubs";

let stub: StorageStub;

beforeEach(() => {
  stub = installStorageStub();
});

afterEach(() => {
  stub.restore();
});

describe("groupContext", () => {
  it("returns null when nothing was remembered", () => {
    expect(rememberedGroup()).toBeNull();
    expect(resolveGroupId(undefined)).toBeNull();
  });

  it("remembers the group across a reload and prefers route state", () => {
    rememberGroup(7);
    expect(rememberedGroup()).toBe(7);
    expect(resolveGroupId(undefined)).toBe(7);
    expect(resolveGroupId(9)).toBe(9);
  });

  it("ignores a corrupt stored value", () => {
    sessionStorage.setItem("ss_group", "not-a-number");
    expect(rememberedGroup()).toBeNull();
    expect(resolveGroupId(undefined)).toBeNull();
  });
});
