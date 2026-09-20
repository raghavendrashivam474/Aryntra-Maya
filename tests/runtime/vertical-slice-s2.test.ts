import { describe, it, expect, beforeEach } from "vitest";
import { indexedDB as fakeIDB, IDBKeyRange as fakeIDBKeyRange } from "fake-indexeddb";
import { randomUUID } from "node:crypto";
import { WorldRuntime } from "../../src/runtime/world-runtime.js";
import { IndexedDBWorldStore } from "../../src/persistence/indexeddb/indexeddb-world-store.js";
import type { World } from "../../src/schemas/world.schema.js";
import type { Entity } from "../../src/schemas/entity.schema.js";
import type { Relationship } from "../../src/schemas/relationship.schema.js";

describe("Sprint S2 Vertical Slice: World Persistence & Continuity", () => {
  let dbName: string;
  let dbCounter = 0;

  beforeEach(() => {
    dbCounter++;
    dbName = `s2_vertical_slice_db_${dbCounter}`;
  });

  it("should survive world state and continuity across multiple distinct WorldRuntime instances (A -> B -> C)", async () => {
    const worldId = "maya-demo";
    const miraId = "mira-id";
    const arinId = "arin-id";
    const relId = "mira-knows-arin";

    // ==========================================
    // GENERATION A: Creating the World and State
    // ==========================================
    WriteStderr("--- Starting Generation A ---\n");
    const storeA = new IndexedDBWorldStore({
      dbName,
      indexedDB: fakeIDB,
      IDBKeyRange: fakeIDBKeyRange,
    });
    await storeA.init();

    const runtimeA = new WorldRuntime(storeA);

    // 1. Create World
    const resWorld = await runtimeA.execute<World>({
      type: "CREATE_WORLD",
      payload: {
        worldId,
        name: "Maya Demo World",
        description: "A world built to test survivability",
      },
    });
    expect(resWorld.success).toBe(true);

    // 2. Create Mira
    const resMira = await runtimeA.execute<Entity>({
      type: "CREATE_ENTITY",
      payload: {
        worldId,
        entity: {
          id: miraId,
          type: "agent",
          properties: { name: "Mira", status: "inactive" },
        },
      },
    });
    expect(resMira.success).toBe(true);

    // 3. Create Arin
    const resArin = await runtimeA.execute<Entity>({
      type: "CREATE_ENTITY",
      payload: {
        worldId,
        entity: {
          id: arinId,
          type: "agent",
          properties: { name: "Arin" },
        },
      },
    });
    expect(resArin.success).toBe(true);

    // 4. Create Mira knows Arin relationship
    const resRel = await runtimeA.execute<Relationship>({
      type: "CREATE_RELATIONSHIP",
      payload: {
        worldId,
        relationship: {
          id: relId,
          sourceEntityId: miraId,
          targetEntityId: arinId,
          type: "knows",
          properties: { strength: 1.0 },
        },
      },
    });
    expect(resRel.success).toBe(true);

    // 5. Update Mira status to 'active'
    const resUpdate = await runtimeA.execute<Entity>({
      type: "UPDATE_ENTITY",
      payload: {
        worldId,
        entityId: miraId,
        properties: { status: "active" },
      },
    });
    expect(resUpdate.success).toBe(true);

    // Verify Generation A state in Runtime A before destruction
    const worldPreClose = await runtimeA.query<World>({
      type: "GET_WORLD",
      payload: { worldId },
    });
    expect(worldPreClose).not.toBeNull();
    expect(worldPreClose!.state.entities[miraId]?.properties.status).toBe("active");

    // Close and destroy Generation A
    await storeA.close();
    // Genuinely destroy any references to Runtime A
    let runtimeARef: WorldRuntime | null = runtimeA;
    runtimeARef = null;
    expect(runtimeARef).toBeNull();

    // ==========================================
    // GENERATION B: Recover and Mutate
    // ==========================================
    WriteStderr("--- Starting Generation B ---\n");
    const storeB = new IndexedDBWorldStore({
      dbName,
      indexedDB: fakeIDB,
      IDBKeyRange: fakeIDBKeyRange,
    });
    await storeB.init();

    const runtimeB = new WorldRuntime(storeB);

    // Query World status immediately from runtime B
    const loadedWorldB = await runtimeB.query<World>({
      type: "GET_WORLD",
      payload: { worldId },
    });
    expect(loadedWorldB).not.toBeNull();
    expect(loadedWorldB!.metadata.name).toBe("Maya Demo World");
    expect(loadedWorldB!.state.entities[miraId]?.properties.name).toBe("Mira");
    expect(loadedWorldB!.state.entities[miraId]?.properties.status).toBe("active");
    expect(loadedWorldB!.state.entities[arinId]?.properties.name).toBe("Arin");
    expect(loadedWorldB!.state.relationships?.[relId]).toBeDefined();
    expect(loadedWorldB!.state.relationships?.[relId]?.type).toBe("knows");
    expect(loadedWorldB!.state.relationships?.[relId]?.properties.strength).toBe(1.0);

    // Verify chronological event log survived and was loaded correctly
    const eventsB = await runtimeB.getEvents(worldId);
    expect(eventsB.length).toBe(5);
    expect(eventsB[0]?.type).toBe("WORLD_CREATED");
    expect(eventsB[1]?.type).toBe("ENTITY_CREATED"); // Mira
    expect(eventsB[2]?.type).toBe("ENTITY_CREATED"); // Arin
    expect(eventsB[3]?.type).toBe("RELATIONSHIP_CREATED");
    expect(eventsB[4]?.type).toBe("ENTITY_UPDATED"); // Mira status active

    // Mutate state in Generation B
    const resUpdateB = await runtimeB.execute<Entity>({
      type: "UPDATE_ENTITY",
      payload: {
        worldId,
        entityId: miraId,
        properties: { status: "ascended" },
      },
    });
    expect(resUpdateB.success).toBe(true);

    // Close and destroy Generation B
    await storeB.close();
    let runtimeBRef: WorldRuntime | null = runtimeB;
    runtimeBRef = null;
    expect(runtimeBRef).toBeNull();

    // ==========================================
    // GENERATION C: Recover and Final Verification
    // ==========================================
    WriteStderr("--- Starting Generation C ---\n");
    const storeC = new IndexedDBWorldStore({
      dbName,
      indexedDB: fakeIDB,
      IDBKeyRange: fakeIDBKeyRange,
    });
    await storeC.init();

    const runtimeC = new WorldRuntime(storeC);

    const loadedWorldC = await runtimeC.query<World>({
      type: "GET_WORLD",
      payload: { worldId },
    });
    expect(loadedWorldC).not.toBeNull();
    expect(loadedWorldC!.state.entities[miraId]?.properties.status).toBe("ascended");

    const eventsC = await runtimeC.getEvents(worldId);
    expect(eventsC.length).toBe(6);
    expect(eventsC[5]?.type).toBe("ENTITY_UPDATED");
    expect((eventsC[5]?.payload as any).properties.status).toBe("ascended");

    await storeC.close();
  });

  it("should guarantee complete data isolation between multiple worlds", async () => {
    const store = new IndexedDBWorldStore({
      dbName,
      indexedDB: fakeIDB,
      IDBKeyRange: fakeIDBKeyRange,
    });
    await store.init();

    const runtime = new WorldRuntime(store);

    // Create World Alpha
    await runtime.execute({
      type: "CREATE_WORLD",
      payload: { worldId: "world-alpha", name: "Alpha", description: "" },
    });
    await runtime.execute({
      type: "CREATE_ENTITY",
      payload: {
        worldId: "world-alpha",
        entity: { id: "mira", type: "agent", properties: { role: "scout" } },
      },
    });

    // Create World Beta
    await runtime.execute({
      type: "CREATE_WORLD",
      payload: { worldId: "world-beta", name: "Beta", description: "" },
    });
    await runtime.execute({
      type: "CREATE_ENTITY",
      payload: {
        worldId: "world-beta",
        entity: { id: "arin", type: "agent", properties: { role: "mage" } },
      },
    });

    // Assert absolute state isolation
    const alpha = await runtime.query<World>({
      type: "GET_WORLD",
      payload: { worldId: "world-alpha" },
    });
    const beta = await runtime.query<World>({
      type: "GET_WORLD",
      payload: { worldId: "world-beta" },
    });

    expect(alpha?.state.entities["mira"]).toBeDefined();
    expect(alpha?.state.entities["arin"]).toBeUndefined();

    expect(beta?.state.entities["arin"]).toBeDefined();
    expect(beta?.state.entities["mira"]).toBeUndefined();

    const eventsAlpha = await runtime.getEvents("world-alpha");
    const eventsBeta = await runtime.getEvents("world-beta");

    expect(eventsAlpha.every((e) => e.worldId === "world-alpha")).toBe(true);
    expect(eventsBeta.every((e) => e.worldId === "world-beta")).toBe(true);

    await store.close();
  });
});

function WriteStderr(text: string) {
  process.stderr.write(text);
}
