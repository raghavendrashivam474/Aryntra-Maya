import type { WorldStore } from "../ports/world-store.port.js";
import { WorldSchema, type World } from "../../schemas/world.schema.js";
import { EventSchema, type MayaEvent } from "../../schemas/event.schema.js";
import {
  InitializationError,
  ReadError,
  WriteError,
  PersistenceValidationError,
  UnsupportedSchemaVersionError,
} from "../errors/persistence.error.js";

export interface IndexedDBWorldStoreConfig {
  dbName?: string;
  dbVersion?: number;
  indexedDB?: IDBFactory;
  IDBKeyRange?: typeof IDBKeyRange;
}

export class IndexedDBWorldStore implements WorldStore {
  private readonly dbName: string;
  private readonly dbVersion: number;
  private readonly idbFactory: IDBFactory;
  private readonly keyRange: typeof IDBKeyRange | undefined;
  private db: IDBDatabase | null = null;

  constructor(config: IndexedDBWorldStoreConfig = {}) {
    this.dbName = config.dbName ?? "maya_db";
    this.dbVersion = config.dbVersion ?? 1;

    const resolvedFactory =
      config.indexedDB ??
      (typeof globalThis !== "undefined" && "indexedDB" in globalThis
        ? (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB
        : undefined);

    if (!resolvedFactory) {
      throw new InitializationError(
        "IndexedDB is not available in this environment. Provide an explicit implementation or run in a supported environment."
      );
    }
    this.idbFactory = resolvedFactory;

    this.keyRange =
      config.IDBKeyRange ??
      (typeof globalThis !== "undefined" && "IDBKeyRange" in globalThis
        ? (globalThis as unknown as { IDBKeyRange: typeof IDBKeyRange }).IDBKeyRange
        : undefined);
  }

  /**
   * Initializes the database connection and creates object stores.
   */
  async init(): Promise<void> {
    if (this.db) return;

    return new Promise<void>((resolve, reject) => {
      const request = this.idbFactory.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = () => {
        const db = request.result;

        // Create worlds store
        if (!db.objectStoreNames.contains("worlds")) {
          db.createObjectStore("worlds", { keyPath: "id" });
        }

        // Create events store with index on worldId
        if (!db.objectStoreNames.contains("events")) {
          const eventStore = db.createObjectStore("events", { keyPath: "eventId" });
          eventStore.createIndex("by_worldId", "worldId", { unique: false });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onerror = () => {
        reject(new InitializationError("Failed to open IndexedDB database", request.error));
      };
    });
  }

  /**
   * Closes the active database connection.
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private getDB(): IDBDatabase {
    if (!this.db) {
      throw new InitializationError("Database has not been initialized. Call init() first.");
    }
    return this.db;
  }

  async saveWorld(world: World): Promise<void> {
    const db = this.getDB();
    const parsed = this.validateAndVerifyWorldSchema(world);

    return new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction("worlds", "readwrite");
        const store = tx.objectStore("worlds");
        const request = store.put(parsed);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(new WriteError(`Failed to save world with id '${world.id}'`, request.error));
      } catch (err) {
        reject(new WriteError(`Transaction error while saving world with id '${world.id}'`, err));
      }
    });
  }

  async getWorld(worldId: string): Promise<World | null> {
    const db = this.getDB();

    return new Promise<World | null>((resolve, reject) => {
      try {
        const tx = db.transaction("worlds", "readonly");
        const store = tx.objectStore("worlds");
        const request = store.get(worldId);

        request.onsuccess = () => {
          const data = request.result;
          if (data === undefined) {
            resolve(null);
            return;
          }
          try {
            const validated = this.validateAndVerifyWorldSchema(data);
            resolve(validated);
          } catch (err) {
            reject(err);
          }
        };

        request.onerror = () => reject(new ReadError(`Failed to read world with id '${worldId}'`, request.error));
      } catch (err) {
        reject(new ReadError(`Transaction error while reading world with id '${worldId}'`, err));
      }
    });
  }

  async hasWorld(worldId: string): Promise<boolean> {
    const db = this.getDB();

    return new Promise<boolean>((resolve, reject) => {
      try {
        const tx = db.transaction("worlds", "readonly");
        const store = tx.objectStore("worlds");
        const request = store.getKey(worldId);

        request.onsuccess = () => {
          resolve(request.result !== undefined);
        };

        request.onerror = () => reject(new ReadError(`Failed to check existence of world with id '${worldId}'`, request.error));
      } catch (err) {
        reject(new ReadError(`Transaction error while checking existence of world with id '${worldId}'`, err));
      }
    });
  }

  async appendEvent(event: MayaEvent): Promise<void> {
    const db = this.getDB();
    const parsed = this.validateAndVerifyEventSchema(event);

    return new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction("events", "readwrite");
        const store = tx.objectStore("events");
        const request = store.put(parsed);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(new WriteError(`Failed to append event with id '${event.eventId}'`, request.error));
      } catch (err) {
        reject(new WriteError(`Transaction error while appending event with id '${event.eventId}'`, err));
      }
    });
  }

  async getEvents(worldId: string): Promise<MayaEvent[]> {
    const db = this.getDB();

    return new Promise<MayaEvent[]>((resolve, reject) => {
      try {
        const tx = db.transaction("events", "readonly");
        const store = tx.objectStore("events");
        const index = store.index("by_worldId");
        const queryRange = this.keyRange ? this.keyRange.only(worldId) : (typeof IDBKeyRange !== "undefined" ? IDBKeyRange.only(worldId) : worldId);
        const request = index.getAll(queryRange);

        request.onsuccess = () => {
          const results: unknown[] = request.result;
          try {
            const validatedEvents: MayaEvent[] = results.map((evt) => this.validateAndVerifyEventSchema(evt));
            validatedEvents.sort((a, b) => a.timestamp - b.timestamp);
            resolve(validatedEvents);
          } catch (err) {
            reject(err);
          }
        };

        request.onerror = () => reject(new ReadError(`Failed to retrieve events for world '${worldId}'`, request.error));
      } catch (err) {
        reject(new ReadError(`Transaction error while retrieving events for world '${worldId}'`, err));
      }
    });
  }

  // --- Validation Helpers ---

  private validateAndVerifyWorldSchema(data: unknown): World {
    const result = WorldSchema.safeParse(data);
    if (!result.success) {
      throw new PersistenceValidationError("World record schema validation failed", result.error);
    }

    const world = result.data;
    if (world.schemaVersion !== 1) {
      throw new UnsupportedSchemaVersionError(world.schemaVersion);
    }

    return world;
  }

  private validateAndVerifyEventSchema(data: unknown): MayaEvent {
    const result = EventSchema.safeParse(data);
    if (!result.success) {
      throw new PersistenceValidationError("Event record schema validation failed", result.error);
    }

    const event = result.data;
    if (event.schemaVersion !== 1) {
      throw new UnsupportedSchemaVersionError(event.schemaVersion);
    }

    return event;
  }
}
