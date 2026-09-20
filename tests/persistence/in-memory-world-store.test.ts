import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryWorldStore } from "../../src/persistence/memory/in-memory-world-store.js";
import type { World } from "../../src/schemas/world.schema.js";
import type { WorldCreatedEvent } from "../../src/schemas/event.schema.js";

describe("InMemoryWorldStore", () => {
  let store: InMemoryWorldStore;

  beforeEach(() => {
    store = new InMemoryWorldStore();
  });

  it("should return null for non-existent world", async () => {
    const world = await store.getWorld("unknown");
    expect(world).toBeNull();
  });

  it("should save and retrieve a world", async () => {
    const world: World = {
      id: "world-1",
      schemaVersion: 1,
      metadata: { name: "Test World", description: "Desc" },
      state: { entities: {} },
      createdAt: 1000,
      updatedAt: 1000,
    };

    await store.saveWorld(world);
    const has = await store.hasWorld("world-1");
    expect(has).toBe(true);

    const retrieved = await store.getWorld("world-1");
    expect(retrieved).toEqual(world);
  });

  it("should prevent external mutations to internal store state", async () => {
    const world: World = {
      id: "world-1",
      schemaVersion: 1,
      metadata: { name: "Test World", description: "" },
      state: { entities: {} },
      createdAt: 1000,
      updatedAt: 1000,
    };

    await store.saveWorld(world);

    // Mutate original object
    world.metadata.name = "Mutated Name";

    const retrieved = await store.getWorld("world-1");
    expect(retrieved?.metadata.name).toBe("Test World");
  });

  it("should append and retrieve events chronologically", async () => {
    const event: WorldCreatedEvent = {
      eventId: "e1",
      worldId: "world-1",
      type: "WORLD_CREATED",
      timestamp: 1000,
      schemaVersion: 1,
      payload: {
        worldId: "world-1",
        name: "Test",
        description: "",
      },
    };

    await store.appendEvent(event);
    const events = await store.getEvents("world-1");
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(event);
  });
});