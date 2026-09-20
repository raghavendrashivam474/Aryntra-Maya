import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryWorldStore } from "../../src/persistence/memory/in-memory-world-store.js";
import { defineWorldStoreContractTests } from "./world-store.contract.js";

// Run standard contract tests
defineWorldStoreContractTests("InMemoryWorldStore", () => new InMemoryWorldStore());

// Additional In-Memory specific unit tests
describe("InMemoryWorldStore (Implementation specifics)", () => {
  let store: InMemoryWorldStore;

  beforeEach(() => {
    store = new InMemoryWorldStore();
  });

  it("should clear all data when clear() is called", async () => {
    await store.saveWorld({
      id: "w1",
      schemaVersion: 1,
      metadata: { name: "W1", description: "" },
      state: { entities: {}, relationships: {} },
      createdAt: 100,
      updatedAt: 100,
    });

    await store.appendEvent({
      eventId: "e1",
      worldId: "w1",
      type: "WORLD_CREATED",
      timestamp: 100,
      schemaVersion: 1,
      payload: { worldId: "w1", name: "W1", description: "" },
    });

    expect(await store.hasWorld("w1")).toBe(true);
    expect((await store.getEvents("w1")).length).toBe(1);

    store.clear();

    expect(await store.hasWorld("w1")).toBe(false);
    expect(await store.getWorld("w1")).toBeNull();
    expect((await store.getEvents("w1")).length).toBe(0);
  });
});
