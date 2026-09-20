import { randomUUID } from "node:crypto";
import {
  CommandSchema,
  type Command,
  type CreateWorldCommand,
  type CreateEntityCommand,
} from "../schemas/command.schema.js";
import {
  QuerySchema,
  type Query,
  type GetWorldQuery,
  type GetEntityQuery,
  type ListEntitiesQuery,
} from "../schemas/query.schema.js";
import {
  WorldSchema,
  type World,
} from "../schemas/world.schema.js";
import {
  EntitySchema,
  type Entity,
} from "../schemas/entity.schema.js";
import type {
  WorldCreatedEvent,
  EntityCreatedEvent,
  MayaEvent,
} from "../schemas/event.schema.js";
import type { WorldStore } from "../persistence/ports/world-store.port.js";

export interface CommandSuccessResult<T = unknown> {
  success: true;
  data: T;
  event: MayaEvent;
}

export interface CommandFailureResult {
  success: false;
  error: string;
}

export type CommandResult<T = unknown> = CommandSuccessResult<T> | CommandFailureResult;

export class WorldRuntime {
  constructor(private readonly store: WorldStore) {}

  /**
   * Executes a Command against the World Runtime.
   */
  async execute<T = unknown>(rawCommand: Command): Promise<CommandResult<T>> {
    const parseResult = CommandSchema.safeParse(rawCommand);
    if (!parseResult.success) {
      return {
        success: false,
        error: `Invalid command: ${parseResult.error.message}`,
      };
    }

    const command = parseResult.data;

    switch (command.type) {
      case "CREATE_WORLD":
        return this.handleCreateWorld(command) as Promise<CommandResult<T>>;
      case "CREATE_ENTITY":
        return this.handleCreateEntity(command) as Promise<CommandResult<T>>;
      default: {
        const _exhaustive: never = command;
        return {
          success: false,
          error: `Unhandled command type: ${JSON.stringify(_exhaustive)}`,
        };
      }
    }
  }

  /**
   * Executes a Query against the current World state.
   */
  async query<T = unknown>(rawQuery: Query): Promise<T | null> {
    const parseResult = QuerySchema.safeParse(rawQuery);
    if (!parseResult.success) {
      throw new Error(`Invalid query: ${parseResult.error.message}`);
    }

    const query = parseResult.data;

    switch (query.type) {
      case "GET_WORLD":
        return this.handleGetWorld(query) as Promise<T | null>;
      case "GET_ENTITY":
        return this.handleGetEntity(query) as Promise<T | null>;
      case "LIST_ENTITIES":
        return this.handleListEntities(query) as Promise<T | null>;
      default: {
        const _exhaustive: never = query;
        throw new Error(`Unhandled query type: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }

  /**
   * Retrieve event log for a given world.
   */
  async getEvents(worldId: string): Promise<MayaEvent[]> {
    return this.store.getEvents(worldId);
  }

  // --- Command Handlers ---

  private async handleCreateWorld(
    cmd: CreateWorldCommand
  ): Promise<CommandResult<World>> {
    const { worldId, name, description } = cmd.payload;

    const exists = await this.store.hasWorld(worldId);
    if (exists) {
      return {
        success: false,
        error: `World with id '${worldId}' already exists`,
      };
    }

    const now = Date.now();
    const rawWorld: World = {
      id: worldId,
      schemaVersion: 1,
      metadata: {
        name,
        description: description ?? "",
      },
      state: {
        entities: {},
      },
      createdAt: now,
      updatedAt: now,
    };

    const world = WorldSchema.parse(rawWorld);

    const event: WorldCreatedEvent = {
      eventId: randomUUID(),
      worldId: world.id,
      type: "WORLD_CREATED",
      timestamp: now,
      schemaVersion: 1,
      payload: {
        worldId: world.id,
        name: world.metadata.name,
        description: world.metadata.description,
      },
    };

    await this.store.saveWorld(world);
    await this.store.appendEvent(event);

    return {
      success: true,
      data: world,
      event,
    };
  }

  private async handleCreateEntity(
    cmd: CreateEntityCommand
  ): Promise<CommandResult<Entity>> {
    const { worldId, entity: entityInput } = cmd.payload;

    const world = await this.store.getWorld(worldId);
    if (!world) {
      return {
        success: false,
        error: `World with id '${worldId}' does not exist`,
      };
    }

    if (world.state.entities[entityInput.id]) {
      return {
        success: false,
        error: `Entity with id '${entityInput.id}' already exists in world '${worldId}'`,
      };
    }

    const now = Date.now();
    const rawEntity: Entity = {
      id: entityInput.id,
      type: entityInput.type,
      properties: entityInput.properties ?? {},
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
    };

    const entity = EntitySchema.parse(rawEntity);

    // Update world state
    world.state.entities[entity.id] = entity;
    world.updatedAt = now;

    const event: EntityCreatedEvent = {
      eventId: randomUUID(),
      worldId,
      type: "ENTITY_CREATED",
      timestamp: now,
      schemaVersion: 1,
      payload: {
        worldId,
        entity,
      },
    };

    await this.store.saveWorld(world);
    await this.store.appendEvent(event);

    return {
      success: true,
      data: entity,
      event,
    };
  }

  // --- Query Handlers ---

  private async handleGetWorld(query: GetWorldQuery): Promise<World | null> {
    return this.store.getWorld(query.payload.worldId);
  }

  private async handleGetEntity(query: GetEntityQuery): Promise<Entity | null> {
    const world = await this.store.getWorld(query.payload.worldId);
    if (!world) return null;
    return world.state.entities[query.payload.entityId] ?? null;
  }

  private async handleListEntities(query: ListEntitiesQuery): Promise<Entity[]> {
    const world = await this.store.getWorld(query.payload.worldId);
    if (!world) return [];
    const allEntities = Object.values(world.state.entities);
    if (query.payload.type) {
      return allEntities.filter((e) => e.type === query.payload.type);
    }
    return allEntities;
  }
}