import { describe, test, expect, beforeEach } from "vitest";
import { indexedDB as fakeIDB, IDBKeyRange as fakeIDBKeyRange } from "fake-indexeddb";
import { WorldRuntime } from "../../src/runtime/world-runtime.js";
import { IndexedDBWorldStore } from "../../src/persistence/indexeddb/indexeddb-world-store.js";
import type { Entity } from "../../src/schemas/entity.schema.js";

describe("S3 Vertical Slice: World Semantics, Query Inspection & Continuity", () => {
  const dbName = "maya-s3-vertical-slice";
  const worldId = "world-s3-continuity";

  test("proves complete semantic inspection lifecycle across durable persistence reload", async () => {
    // -------------------------------------------------------------
    // PHASE 1: Build the semantic world in Runtime Instance A
    // -------------------------------------------------------------
    const storeA = new IndexedDBWorldStore({
      dbName,
      indexedDB: fakeIDB,
      IDBKeyRange: fakeIDBKeyRange,
    });
    await storeA.init();

    const runtimeA = new WorldRuntime(storeA);

    await runtimeA.execute({
      type: "CREATE_WORLD",
      payload: { worldId, name: "S3 Continuity World", description: "Semantic Slice" },
    });

    // Create entities: Mira, Arin, Company, Book
    await runtimeA.execute({
      type: "CREATE_ENTITY",
      payload: {
        worldId,
        entity: { id: "mira", type: "person", properties: { name: "Mira", role: "Architect" } },
      },
    });

    await runtimeA.execute({
      type: "CREATE_ENTITY",
      payload: {
        worldId,
        entity: { id: "arin", type: "person", properties: { name: "Arin", role: "Explorer" } },
      },
    });

    await runtimeA.execute({
      type: "CREATE_ENTITY",
      payload: {
        worldId,
        entity: { id: "company", type: "organization", properties: { name: "Anti-grav" } },
      },
    });

    await runtimeA.execute({
      type: "CREATE_ENTITY",
      payload: {
        worldId,
        entity: { id: "book", type: "artifact", properties: { title: "Grimoire" } },
      },
    });

    // Create relationships
    await runtimeA.execute({
      type: "CREATE_RELATIONSHIP",
      payload: {
        worldId,
        relationship: { id: "rel-1-knows", sourceEntityId: "mira", targetEntityId: "arin", type: "knows" },
      },
    });

    await runtimeA.execute({
      type: "CREATE_RELATIONSHIP",
      payload: {
        worldId,
        relationship: { id: "rel-2-works", sourceEntityId: "arin", targetEntityId: "company", type: "works_at" },
      },
    });

    await runtimeA.execute({
      type: "CREATE_RELATIONSHIP",
      payload: {
        worldId,
        relationship: { id: "rel-3-owns", sourceEntityId: "mira", targetEntityId: "book", type: "owns" },
      },
    });

    // -------------------------------------------------------------
    // PHASE 2: Execute S3 Semantic Queries in Runtime Instance A
    // -------------------------------------------------------------
    const peopleA = await runtimeA.query<Entity[]>({
      type: "FIND_ENTITIES",
      payload: { worldId, type: "person" },
    });
    expect(peopleA?.map((e) => e.id)).toEqual(["arin", "mira"]); // Deterministic sort by ID

    const architectsA = await runtimeA.query<Entity[]>({
      type: "FIND_ENTITIES",
      payload: { worldId, propertyKey: "role", propertyValue: "Architect" },
    });
    expect(architectsA?.map((e) => e.id)).toEqual(["mira"]);

    const miraNeighborsA = await runtimeA.query<Entity[]>({
      type: "GET_NEIGHBORS",
      payload: { worldId, entityId: "mira", direction: "outgoing" },
    });
    expect(miraNeighborsA?.map((e) => e.id)).toEqual(["arin", "book"]);

    const pathA = await runtimeA.query<string[]>({
      type: "FIND_PATH",
      payload: { worldId, sourceEntityId: "mira", targetEntityId: "company", maxDepth: 4 },
    });
    expect(pathA).toEqual(["mira", "arin", "company"]);

    // Close Store A
    await storeA.close();

    // -------------------------------------------------------------
    // PHASE 3: Simulate Runtime Shutdown and Restart (Runtime B)
    // -------------------------------------------------------------
    const storeB = new IndexedDBWorldStore({
      dbName,
      indexedDB: fakeIDB,
      IDBKeyRange: fakeIDBKeyRange,
    });
    await storeB.init();

    const runtimeB = new WorldRuntime(storeB);

    // -------------------------------------------------------------
    // PHASE 4: Run Identical Queries in Runtime Instance B
    // -------------------------------------------------------------
    const peopleB = await runtimeB.query<Entity[]>({
      type: "FIND_ENTITIES",
      payload: { worldId, type: "person" },
    });
    expect(peopleB).toEqual(peopleA);

    const architectsB = await runtimeB.query<Entity[]>({
      type: "FIND_ENTITIES",
      payload: { worldId, propertyKey: "role", propertyValue: "Architect" },
    });
    expect(architectsB).toEqual(architectsA);

    const miraNeighborsB = await runtimeB.query<Entity[]>({
      type: "GET_NEIGHBORS",
      payload: { worldId, entityId: "mira", direction: "outgoing" },
    });
    expect(miraNeighborsB).toEqual(miraNeighborsA);

    const pathB = await runtimeB.query<string[]>({
      type: "FIND_PATH",
      payload: { worldId, sourceEntityId: "mira", targetEntityId: "company", maxDepth: 4 },
    });
    expect(pathB).toEqual(pathA);

    // -------------------------------------------------------------
    // PHASE 5: Verify Query Mutation Isolation on Re-loaded World
    // -------------------------------------------------------------
    const worldBefore = await storeB.getWorld(worldId);
    const eventsBefore = await storeB.getEvents(worldId);

    // Run multiple deep queries on Runtime B
    await runtimeB.query({ type: "FIND_PATH", payload: { worldId, sourceEntityId: "mira", targetEntityId: "company" } });
    await runtimeB.query({ type: "GET_NEIGHBORS", payload: { worldId, entityId: "arin" } });
    await runtimeB.query({ type: "FIND_ENTITIES", payload: { worldId, propertyKey: "role" } });

    const worldAfter = await storeB.getWorld(worldId);
    const eventsAfter = await storeB.getEvents(worldId);

    expect(worldBefore).toEqual(worldAfter);
    expect(eventsBefore).toEqual(eventsAfter);

    await storeB.close();
  });
});
