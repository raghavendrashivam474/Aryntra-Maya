import { describe, it, expect } from "vitest";
import { WorldRuntime } from "../../src/runtime/world-runtime.js";
import { InMemoryWorldStore } from "../../src/persistence/memory/in-memory-world-store.js";
import type { World } from "../../src/schemas/world.schema.js";
import type { Entity } from "../../src/schemas/entity.schema.js";

describe("Sprint S0 — World Vertical Slice Acceptance Test", () => {
  it("proves the full lifecycle: Create World -> Create Entity -> Command -> Runtime -> Event -> Persist -> Reload", async () => {
    // 1. Shared persistent storage medium
    const sharedStore = new InMemoryWorldStore();

    // 2. Initial Runtime Instance
    const runtime1 = new WorldRuntime(sharedStore);

    // 3. Step A: Create World
    const createWorldResult = await runtime1.execute<World>({
      type: "CREATE_WORLD",
      payload: {
        worldId: "maya-demo",
        name: "Maya Demonstration World",
        description: "Initial vertical slice proof",
      },
    });

    expect(createWorldResult.success).toBe(true);
    if (!createWorldResult.success) return;

    expect(createWorldResult.data.id).toBe("maya-demo");
    expect(createWorldResult.event.type).toBe("WORLD_CREATED");

    // 4. Step B: Create Entity (Mira) via Command
    const createEntityResult = await runtime1.execute<Entity>({
      type: "CREATE_ENTITY",
      payload: {
        worldId: "maya-demo",
        entity: {
          id: "ent-mira-001",
          type: "character",
          properties: {
            name: "Mira",
            status: "active",
          },
        },
      },
    });

    expect(createEntityResult.success).toBe(true);
    if (!createEntityResult.success) return;

    expect(createEntityResult.data.id).toBe("ent-mira-001");
    expect(createEntityResult.event.type).toBe("ENTITY_CREATED");

    // 5. Step C: Verify event history
    const events = await runtime1.getEvents("maya-demo");
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("WORLD_CREATED");
    expect(events[1].type).toBe("ENTITY_CREATED");

    // =========================================================================
    // 6. Step D: Simulate Runtime Restart / Reload from Persistence
    // =========================================================================
    // We instantiate a completely fresh runtime pointing to the same storage
    const runtime2 = new WorldRuntime(sharedStore);

    // Query World state from fresh runtime
    const reloadedWorld = await runtime2.query<World>({
      type: "GET_WORLD",
      payload: { worldId: "maya-demo" },
    });

    expect(reloadedWorld).not.toBeNull();
    expect(reloadedWorld?.id).toBe("maya-demo");
    expect(reloadedWorld?.metadata.name).toBe("Maya Demonstration World");

    // Query Mira from fresh runtime
    const reloadedMira = await runtime2.query<Entity>({
      type: "GET_ENTITY",
      payload: {
        worldId: "maya-demo",
        entityId: "ent-mira-001",
      },
    });

    expect(reloadedMira).not.toBeNull();
    expect(reloadedMira?.id).toBe("ent-mira-001");
    expect(reloadedMira?.type).toBe("character");
    expect(reloadedMira?.properties).toEqual({
      name: "Mira",
      status: "active",
    });

    // List all entities from fresh runtime
    const allEntities = await runtime2.query<Entity[]>({
      type: "LIST_ENTITIES",
      payload: { worldId: "maya-demo" },
    });

    expect(allEntities).toHaveLength(1);
    expect(allEntities?.[0].id).toBe("ent-mira-001");

    // Verify events are also preserved
    const reloadedEvents = await runtime2.getEvents("maya-demo");
    expect(reloadedEvents).toHaveLength(2);
  });
});