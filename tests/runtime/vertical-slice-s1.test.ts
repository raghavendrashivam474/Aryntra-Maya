import { describe, it, expect } from "vitest";
import { InMemoryWorldStore } from "../../src/persistence/memory/in-memory-world-store.js";
import { WorldRuntime } from "../../src/runtime/world-runtime.js";
import type { World } from "../../src/schemas/world.schema.js";
import type { Entity } from "../../src/schemas/entity.schema.js";
import type { Relationship } from "../../src/schemas/relationship.schema.js";

describe("Sprint S1 — World Vertical Slice Acceptance Test", () => {
  it("proves the full lifecycle: World evolution state changes, relationship creation, entity update, store persistence, runtime reconstruction, and complete recovery", async () => {
    // 1. Setup Store and first Runtime instance
    const store = new InMemoryWorldStore();
    const runtime1 = new WorldRuntime(store);
    const worldId = "maya-demo";

    // 2. Create World
    const createWorldResult = await runtime1.execute<World>({
      type: "CREATE_WORLD",
      payload: {
        worldId,
        name: "Maya Demo World",
        description: "A rich evolving world",
      },
    });
    expect(createWorldResult.success).toBe(true);

    // 3. Create Entities: Mira and Arin
    const createMiraResult = await runtime1.execute<Entity>({
      type: "CREATE_ENTITY",
      payload: {
        worldId,
        entity: { id: "mira", type: "character", properties: { status: "idle" } },
      },
    });
    expect(createMiraResult.success).toBe(true);

    const createArinResult = await runtime1.execute<Entity>({
      type: "CREATE_ENTITY",
      payload: {
        worldId,
        entity: { id: "arin", type: "character", properties: { status: "idle" } },
      },
    });
    expect(createArinResult.success).toBe(true);

    // 4. Create Relationship: Mira --knows--> Arin
    const createRelResult = await runtime1.execute<Relationship>({
      type: "CREATE_RELATIONSHIP",
      payload: {
        worldId,
        relationship: {
          id: "mira-arin-knows",
          sourceEntityId: "mira",
          targetEntityId: "arin",
          type: "knows",
          properties: { level: 1 },
        },
      },
    });
    expect(createRelResult.success).toBe(true);

    // 5. Update Entity: Mira's status = "active"
    const updateMiraResult = await runtime1.execute<Entity>({
      type: "UPDATE_ENTITY",
      payload: {
        worldId,
        entityId: "mira",
        properties: { status: "active" },
      },
    });
    expect(updateMiraResult.success).toBe(true);

    // 6. Destroy runtime 1 completely (simulate by creating new runtime with the same store)
    const runtime2 = new WorldRuntime(store);

    // 7. Reload and Verify complete state in Runtime 2
    const reloadedWorld = await runtime2.query<World>({
      type: "GET_WORLD",
      payload: { worldId },
    });

    expect(reloadedWorld).not.toBeNull();
    expect(reloadedWorld?.id).toBe(worldId);
    expect(reloadedWorld?.metadata.name).toBe("Maya Demo World");

    // Verify Mira is present, recovered, and has active status
    const reloadedMira = await runtime2.query<Entity>({
      type: "GET_ENTITY",
      payload: { worldId, entityId: "mira" },
    });
    expect(reloadedMira).not.toBeNull();
    expect(reloadedMira?.properties.status).toBe("active");

    // Verify Arin is recovered
    const reloadedArin = await runtime2.query<Entity>({
      type: "GET_ENTITY",
      payload: { worldId, entityId: "arin" },
    });
    expect(reloadedArin).not.toBeNull();

    // Verify Relationship is recovered completely with all source/target mapping metadata
    const reloadedRel = await runtime2.query<Relationship>({
      type: "GET_RELATIONSHIP",
      payload: { worldId, relationshipId: "mira-arin-knows" },
    });
    expect(reloadedRel).not.toBeNull();
    expect(reloadedRel?.sourceEntityId).toBe("mira");
    expect(reloadedRel?.targetEntityId).toBe("arin");
    expect(reloadedRel?.type).toBe("knows");
    expect(reloadedRel?.properties).toEqual({ level: 1 });

    // Verify event logs are safely stored and chronologically reloaded
    const events = await runtime2.getEvents(worldId);
    expect(events.length).toBeGreaterThanOrEqual(5);
    expect(events[0].type).toBe("WORLD_CREATED");
    expect(events[events.length - 1].type).toBe("ENTITY_UPDATED");
  });
});