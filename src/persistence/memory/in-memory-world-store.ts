import type { WorldStore } from "../ports/world-store.port.js";
import type { World } from "../../schemas/world.schema.js";
import type { MayaEvent } from "../../schemas/event.schema.js";

export class InMemoryWorldStore implements WorldStore {
  private worlds: Map<string, World> = new Map();
  private events: Map<string, MayaEvent[]> = new Map();

  async saveWorld(world: World): Promise<void> {
    // Clone to prevent direct external mutation of internal store state
    this.worlds.set(world.id, structuredClone(world));
  }

  async getWorld(worldId: string): Promise<World | null> {
    const world = this.worlds.get(worldId);
    if (!world) {
      return null;
    }
    return structuredClone(world);
  }

  async hasWorld(worldId: string): Promise<boolean> {
    return this.worlds.has(worldId);
  }

  async appendEvent(event: MayaEvent): Promise<void> {
    const list = this.events.get(event.worldId) ?? [];
    list.push(structuredClone(event));
    this.events.set(event.worldId, list);
  }

  async getEvents(worldId: string): Promise<MayaEvent[]> {
    const list = this.events.get(worldId) ?? [];
    return structuredClone(list);
  }

  /**
   * Helper for tests to clear state.
   */
  clear(): void {
    this.worlds.clear();
    this.events.clear();
  }
}