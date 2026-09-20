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
import {
  type Relationship,
  RelationshipSchema,
} from "../schemas/relationship.schema.js";
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
  events?: MayaEvent[];
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
      case "UPDATE_ENTITY":
        return this.handleUpdateEntity(command) as Promise<CommandResult<T>>;
      case "DELETE_ENTITY":
        return this.handleDeleteEntity(command) as Promise<CommandResult<T>>;
      case "CREATE_RELATIONSHIP":
        return this.handleCreateRelationship(command) as Promise<CommandResult<T>>;
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
      case "GET_RELATIONSHIP":
        return this.handleGetRelationship(query) as Promise<T | null>;
      case "LIST_RELATIONSHIPS":
        return this.handleListRelationships(query) as Promise<T | null>;
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
        relationships: {},
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

  private async handleUpdateEntity(
    cmd: Extract<Command, { type: "UPDATE_ENTITY" }>
  ): Promise<CommandResult<Entity>> {
    const { worldId, entityId, properties } = cmd.payload;

    const world = await this.store.getWorld(worldId);
    if (!world) {
      return {
        success: false,
        error: `World with id '${worldId}' does not exist`,
      };
    }

    const existingEntity = world.state.entities[entityId];
    if (!existingEntity) {
      return {
        success: false,
        error: `Entity with id '${entityId}' does not exist in world '${worldId}'`,
      };
    }

    const now = Date.now();
    const previousProperties = { ...existingEntity.properties };
    const updatedEntity: Entity = {
      ...existingEntity,
      properties: {
        ...existingEntity.properties,
        ...properties,
      },
      updatedAt: now,
    };

    world.state.entities[entityId] = updatedEntity;
    world.updatedAt = now;

    const event: MayaEvent = {
      eventId: randomUUID(),
      worldId,
      type: "ENTITY_UPDATED",
      timestamp: now,
      schemaVersion: 1,
      payload: {
        worldId,
        entityId,
        properties,
        previousProperties,
      },
    };

    await this.store.saveWorld(world);
    await this.store.appendEvent(event);

    return {
      success: true,
      data: updatedEntity,
      event,
    };
  }

  private async handleDeleteEntity(
    cmd: Extract<Command, { type: "DELETE_ENTITY" }>
  ): Promise<CommandResult<Entity>> {
    const { worldId, entityId } = cmd.payload;

    const world = await this.store.getWorld(worldId);
    if (!world) {
      return {
        success: false,
        error: `World with id '${worldId}' does not exist`,
      };
    }

    const entity = world.state.entities[entityId];
    if (!entity) {
      return {
        success: false,
        error: `Entity with id '${entityId}' does not exist in world '${worldId}'`,
      };
    }

    const now = Date.now();
    delete world.state.entities[entityId];

    // Cascade delete affected relationships per ADR-0002
    const deletedRelationshipEvents: MayaEvent[] = [];
    if (world.state.relationships) {
      for (const [relId, rel] of Object.entries(world.state.relationships)) {
        if (rel.sourceEntityId === entityId || rel.targetEntityId === entityId) {
          delete world.state.relationships[relId];
          deletedRelationshipEvents.push({
            eventId: randomUUID(),
            worldId,
            type: "RELATIONSHIP_DELETED",
            timestamp: now,
            schemaVersion: 1,
            payload: {
              worldId,
              relationshipId: relId,
            },
          });
        }
      }
    }

    const entityDeletedEvent: MayaEvent = {
      eventId: randomUUID(),
      worldId,
      type: "ENTITY_DELETED",
      timestamp: now,
      schemaVersion: 1,
      payload: {
        worldId,
        entityId,
      },
    };

    world.updatedAt = now;

    await this.store.saveWorld(world);
    await this.store.appendEvent(entityDeletedEvent);
    for (const relEvent of deletedRelationshipEvents) {
      await this.store.appendEvent(relEvent);
    }

    return {
      success: true,
      data: entity,
      event: entityDeletedEvent,
      events: [entityDeletedEvent, ...deletedRelationshipEvents],
    };
  }

  private async handleCreateRelationship(
    cmd: Extract<Command, { type: "CREATE_RELATIONSHIP" }>
  ): Promise<CommandResult<Relationship>> {
    const { worldId, relationship: relInput } = cmd.payload;

    const world = await this.store.getWorld(worldId);
    if (!world) {
      return {
        success: false,
        error: `World with id '${worldId}' does not exist`,
      };
    }

    if (!world.state.entities[relInput.sourceEntityId]) {
      return {
        success: false,
        error: `Source entity '${relInput.sourceEntityId}' does not exist in world '${worldId}'`,
      };
    }

    if (!world.state.entities[relInput.targetEntityId]) {
      return {
        success: false,
        error: `Target entity '${relInput.targetEntityId}' does not exist in world '${worldId}'`,
      };
    }

    if (!world.state.relationships) {
      world.state.relationships = {};
    }

    if (world.state.relationships[relInput.id]) {
      return {
        success: false,
        error: `Relationship with id '${relInput.id}' already exists in world '${worldId}'`,
      };
    }

    const now = Date.now();
    const rawRelationship: Relationship = {
      id: relInput.id,
      sourceEntityId: relInput.sourceEntityId,
      targetEntityId: relInput.targetEntityId,
      type: relInput.type,
      properties: relInput.properties ?? {},
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
    };

    const relationship = RelationshipSchema.parse(rawRelationship);

    world.state.relationships[relationship.id] = relationship;
    world.updatedAt = now;

    const event: MayaEvent = {
      eventId: randomUUID(),
      worldId,
      type: "RELATIONSHIP_CREATED",
      timestamp: now,
      schemaVersion: 1,
      payload: {
        worldId,
        relationship,
      },
    };

    await this.store.saveWorld(world);
    await this.store.appendEvent(event);

    return {
      success: true,
      data: relationship,
      event,
    };
  }

  // --- Query Handlers ---

  private async handleGetWorld(query: GetWorldQuery): Promise<World | null> {
    const world = await this.store.getWorld(query.payload.worldId);
    if (!world) return null;
    // Backfill empty relationships for raw backward-compatible store states
    if (!world.state.relationships) {
      world.state.relationships = {};
    }
    return world;
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

  private async handleGetRelationship(
    query: Extract<Query, { type: "GET_RELATIONSHIP" }>
  ): Promise<Relationship | null> {
    const world = await this.store.getWorld(query.payload.worldId);
    if (!world) return null;
    return world.state.relationships?.[query.payload.relationshipId] ?? null;
  }

  private async handleListRelationships(
    query: Extract<Query, { type: "LIST_RELATIONSHIPS" }>
  ): Promise<Relationship[]> {
    const world = await this.store.getWorld(query.payload.worldId);
    if (!world) return [];
    if (!world.state.relationships) return [];
    let list = Object.values(world.state.relationships);
    if (query.payload.sourceEntityId) {
      list = list.filter((r) => r.sourceEntityId === query.payload.sourceEntityId);
    }
    if (query.payload.targetEntityId) {
      list = list.filter((r) => r.targetEntityId === query.payload.targetEntityId);
    }
    if (query.payload.type) {
      list = list.filter((r) => r.type === query.payload.type);
    }
    return list;
  }
}