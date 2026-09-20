import { describe, it, expect, beforeEach } from "vitest";
import type { WorldStore } from "../../src/persistence/ports/world-store.port.js";
import type { World } from "../../src/schemas/world.schema.js";
import type { MayaEvent } from "../../src/schemas/event.schema.js";

export function defineWorldStoreContractTests(
  name: string,
  storeFactory: () => Promise<WorldStore> | WorldStore,
  cleanup?: () => Promise<void> | void
) {
  describe(`WorldStore Contract: ${name}`, () => {
    let store: WorldStore;

    beforeEach(async () => {
      if (cleanup) {
        await cleanup();
      }
      store = await storeFactory();
    });

    const createTestWorld = (id: string, name: string): World => ({
      id,
      schemaVersion: 1,
      metadata: {
        name,
        description: `Description for ${name}`,
      },
      state: {
        entities: {
          "ent-1": {
            id: "ent-1",
            type: "agent",
            properties: { name: "Mira", role: "scout" },
            schemaVersion: 1,
            createdAt: 1000,
            updatedAt: 1000,
          },
        },
        relationships: {
          "rel-1": {
            id: "rel-1",
            sourceEntityId: "ent-1",
            targetEntityId: "ent-1",
            type: "self-referential",
            properties: {},
            schemaVersion: 1,
            createdAt: 1000,
            updatedAt: 1000,
          },
        },
      },
      createdAt: 1000,
      updatedAt: 1000,
    });

    const createTestEvent = (worldId: string, eventId: string, timestamp: number): MayaEvent => ({
      eventId,
      worldId,
      type: "WORLD_CREATED",
      timestamp,
      schemaVersion: 1,
      payload: {
        worldId,
        name: "Test World",
        description: "Test",
      },
    });

    it("should return null and false for a non-existent world", async () => {
      const exists = await store.hasWorld("non-existent");
      const world = await store.getWorld("non-existent");

      expect(exists).toBe(false);
      expect(world).toBeNull();
    });

    it("should save and load a world correctly", async () => {
      const testWorld = createTestWorld("world-1", "Maya Prime");

      await store.saveWorld(testWorld);

      const exists = await store.hasWorld("world-1");
      const loaded = await store.getWorld("world-1");

      expect(exists).toBe(true);
      expect(loaded).toEqual(testWorld);
    });

    it("should isolate modifications to loaded objects from the store state", async () => {
      const testWorld = createTestWorld("world-1", "Maya Prime");
      await store.saveWorld(testWorld);

      const loaded1 = await store.getWorld("world-1");
      expect(loaded1).not.toBeNull();
      // Mutate loaded object locally
      loaded1!.metadata.name = "Mutated Name";

      const loaded2 = await store.getWorld("world-1");
      expect(loaded2?.metadata.name).toBe("Maya Prime");
    });

    it("should overwrite an existing world when saved again", async () => {
      const testWorld = createTestWorld("world-1", "Maya Prime");
      await store.saveWorld(testWorld);

      const updatedWorld: World = {
        ...testWorld,
        metadata: {
          ...testWorld.metadata,
          name: "Maya Updated",
        },
        updatedAt: 2000,
      };
      await store.saveWorld(updatedWorld);

      const loaded = await store.getWorld("world-1");
      expect(loaded?.metadata.name).toBe("Maya Updated");
      expect(loaded?.updatedAt).toBe(2000);
    });

    it("should isolate multiple worlds", async () => {
      const worldA = createTestWorld("world-a", "World Alpha");
      const worldB = createTestWorld("world-b", "World Beta");

      await store.saveWorld(worldA);
      await store.saveWorld(worldB);

      const loadedA = await store.getWorld("world-a");
      const loadedB = await store.getWorld("world-b");

      expect(loadedA?.id).toBe("world-a");
      expect(loadedA?.metadata.name).toBe("World Alpha");
      expect(loadedB?.id).toBe("world-b");
      expect(loadedB?.metadata.name).toBe("World Beta");
    });

    it("should return empty events array for a world with no events", async () => {
      const events = await store.getEvents("empty-world");
      expect(events).toEqual([]);
    });

    it("should append and retrieve events in chronological order", async () => {
      const event1 = createTestEvent("world-1", "evt-1", 100);
      const event2 = createTestEvent("world-1", "evt-2", 200);

      await store.appendEvent(event1);
      await store.appendEvent(event2);

      const events = await store.getEvents("world-1");
      expect(events).toHaveLength(2);
      expect(events[0]).toEqual(event1);
      expect(events[1]).toEqual(event2);
    });

    it("should isolate events between different worlds", async () => {
      const eventA = createTestEvent("world-a", "evt-a1", 100);
      const eventB = createTestEvent("world-b", "evt-b1", 100);

      await store.appendEvent(eventA);
      await store.appendEvent(eventB);

      const eventsA = await store.getEvents("world-a");
      const eventsB = await store.getEvents("world-b");

      expect(eventsA).toHaveLength(1);
      expect(eventsA[0]?.eventId).toBe("evt-a1");

      expect(eventsB).toHaveLength(1);
      expect(eventsB[0]?.eventId).toBe("evt-b1");
    });
  });
}
