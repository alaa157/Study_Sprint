import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiError, api, errorMessage } from "./api";
import { NETWORK_ERROR } from "./messages";
import { installStorageStub, type StorageStub } from "../test/stubs";

let stub: StorageStub;
const realFetch = globalThis.fetch;

function respond(status: number, body: unknown): void {
  globalThis.fetch = async () => new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  stub = installStorageStub();
});

afterEach(() => {
  stub.restore();
  globalThis.fetch = realFetch;
});

describe("errorMessage", () => {
  it("turns a 422 validation payload into one line of human copy", async () => {
    respond(422, {
      detail: [{ type: "int_parsing", loc: ["path", "gid"], msg: "Input should be a valid integer" }],
    });
    const error: unknown = await api.scoreboard(Number("x")).catch((e: unknown) => e);
    expect(typeof errorMessage(error)).toBe("string");
    expect(errorMessage(error)).toBe("Please check that form and try again.");
  });

  it("maps domain codes to actionable copy", async () => {
    respond(409, { detail: "GroupFull" });
    const error: unknown = await api.joinGroup(99).catch((e: unknown) => e);
    expect(errorMessage(error)).toBe("That group just filled up. Try finding another group.");
  });

  it("keeps the normalized code and status on ApiError", async () => {
    respond(409, { detail: "AlreadyPromised" });
    const error = (await api.promise("text", "2026-09-20").catch((e: unknown) => e)) as ApiError;
    expect(error.detail).toBe("AlreadyPromised");
    expect(error.status).toBe(409);
    expect(error).toBeInstanceOf(ApiError);
  });

  it("explains an unreachable server", () => {
    expect(errorMessage(new TypeError("Failed to fetch"))).toBe(NETWORK_ERROR);
  });
});
