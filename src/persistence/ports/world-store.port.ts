import type { World } from "../../schemas/world.schema.js";
import type { MayaEvent } from "../../schemas/event.schema.js";

export interface WorldStore {
  /**
   * Saves or updates a World aggregate state.
   */
  saveWorld(world: World): Promise<void>;

  /**
   * Retrieves a World aggregate by its unique ID.
   * Returns null if not found.
   */
  getWorld(worldId: string): Promise<World | null>;

  /**
   * Checks if a World exists.
   */
  hasWorld(worldId: string): Promise<boolean>;

  /**
   * Appends an event to the persistent event log for a World.
   */
  appendEvent(event: MayaEvent): Promise<void>;

  /**
   * Retrieves all recorded events for a World, in chronological order.
   */
  getEvents(worldId: string): Promise<MayaEvent[]>;
}