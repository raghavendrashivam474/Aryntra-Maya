import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { indexedDB as fakeIDB, IDBKeyRange as fakeIDBKeyRange } from "fake-indexeddb";
import { IndexedDBWorldStore } from "../../src/persistence/indexeddb/indexeddb-world-store.js";
import { defineWorldStoreContractTests } from "./world-store.contract.js";
import {
  InitializationError,
  PersistenceValidationError,
  UnsupportedSchemaVersionError,
} from "../../src/persistence/errors/persistence.error.js";

// 1. Run standard contract tests against IndexedDBWorldStore
let testDbCounter = 0;

defineWorldStoreContractTests(
  "IndexedDBWorldStore",
  async () => {
    testDbCounter++;
    const store = new IndexedDBWorldStore({
      dbName: `contract_test_db_${testDbCounter}`,
      indexedDB: fakeIDB,
      IDBKeyRange: fakeIDBKeyRange,
    });
    await store.init();
    return store;
  }
);

// 2. Implementation-specific unit tests
describe("IndexedDBWorldStore (Implementation specifics)", () => {
  let dbName: string;

  beforeEach(() => {
    testDbCounter++;
    dbName = `spec_test_db_${testDbCounter}`;
  });

  it("should throw InitializationError when calling methods before init()", async () => {
    const store = new IndexedDBWorldStore({
      dbName,
      indexedDB: fakeIDB,
      IDBKeyRange: fakeIDBKeyRange,
    });

    await expect(store.hasWorld("w1")).rejects.toThrow(InitializationError);
    await expect(store.getWorld("w1")).rejects.toThrow(InitializationError);
    await expect(
      store.saveWorld({
        id: "w1",
        schemaVersion: 1,
        metadata: { name: "W1", description: "" },
        state: { entities: {}, relationships: {} },
        createdAt: 100,
        updatedAt: 100,
      })
    ).rejects.toThrow(InitializationError);
    await expect(store.getEvents("w1")).rejects.toThrow(InitializationError);
  });

  it("should throw InitializationError if indexedDB is unavailable", () => {
    expect(() => {
      new IndexedDBWorldStore({
        dbName: "unsupported",
        indexedDB: undefined,
      });
    }).toThrow(InitializationError);
  });

  it("should allow closing and reopening the database across distinct store instances", async () => {
    // Instance 1 writes data
    const store1 = new IndexedDBWorldStore({
      dbName,
      indexedDB: fakeIDB,
      IDBKeyRange: fakeIDBKeyRange,
    });
    await store1.init();

    await store1.saveWorld({
      id: "persisted-world",
      schemaVersion: 1,
      metadata: { name: "Persistent", description: "Across instances" },
      state: { entities: {}, relationships: {} },
      createdAt: 500,
      updatedAt: 500,
    });

    await store1.close();

    // Instance 2 reads the data from the same DB name
    const store2 = new IndexedDBWorldStore({
      dbName,
      indexedDB: fakeIDB,
      IDBKeyRange: fakeIDBKeyRange,
    });
    await store2.init();

    const loaded = await store2.getWorld("persisted-world");
    expect(loaded).not.toBeNull();
    expect(loaded?.metadata.name).toBe("Persistent");

    await store2.close();
  });

  it("should throw PersistenceValidationError when loading corrupted world data", async () => {
    const store = new IndexedDBWorldStore({
      dbName,
      indexedDB: fakeIDB,
      IDBKeyRange: fakeIDBKeyRange,
    });
    await store.init();

    // Inject corrupted record directly bypassing type check via raw IDB
    await new Promise<void>((resolve, reject) => {
      const request = fakeIDB.open(dbName, 1);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("worlds", "readwrite");
        const objStore = tx.objectStore("worlds");
        objStore.put({
          id: "corrupted-world",
          schemaVersion: 1,
          // Missing required metadata and state
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    });

    // Loading should reject with controlled PersistenceValidationError
    await expect(store.getWorld("corrupted-world")).rejects.toThrow(PersistenceValidationError);
  });

  it("should throw UnsupportedSchemaVersionError when world record has unsupported schemaVersion", async () => {
    const store = new IndexedDBWorldStore({
      dbName,
      indexedDB: fakeIDB,
      IDBKeyRange: fakeIDBKeyRange,
    });
    await store.init();

    // Inject future schemaVersion record
    await new Promise<void>((resolve, reject) => {
      const request = fakeIDB.open(dbName, 1);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("worlds", "readwrite");
        const objStore = tx.objectStore("worlds");
        objStore.put({
          id: "future-world",
          schemaVersion: 99,
          metadata: { name: "Future World", description: "" },
          state: { entities: {}, relationships: {} },
          createdAt: 100,
          updatedAt: 100,
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    });

    await expect(store.getWorld("future-world")).rejects.toThrow(UnsupportedSchemaVersionError);
  });

  it("should throw UnsupportedSchemaVersionError when event record has unsupported schemaVersion", async () => {
    const store = new IndexedDBWorldStore({
      dbName,
      indexedDB: fakeIDB,
      IDBKeyRange: fakeIDBKeyRange,
    });
    await store.init();

    // Inject future schemaVersion event
    await new Promise<void>((resolve, reject) => {
      const request = fakeIDB.open(dbName, 1);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("events", "readwrite");
        const objStore = tx.objectStore("events");
        objStore.put({
          eventId: "00000000-0000-0000-0000-000000000001",
          worldId: "w-events",
          type: "WORLD_CREATED",
          timestamp: 100,
          schemaVersion: 99,
          payload: { worldId: "w-events", name: "W", description: "" },
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    });

    await expect(store.getEvents("w-events")).rejects.toThrow(UnsupportedSchemaVersionError);
  });
});
