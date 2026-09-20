import { z } from "zod";

export const GetWorldQuerySchema = z.object({
  type: z.literal("GET_WORLD"),
  payload: z.object({
    worldId: z.string().min(1, "World id must not be empty"),
  }),
});

export type GetWorldQuery = z.infer<typeof GetWorldQuerySchema>;

export const GetEntityQuerySchema = z.object({
  type: z.literal("GET_ENTITY"),
  payload: z.object({
    worldId: z.string().min(1, "World id must not be empty"),
    entityId: z.string().min(1, "Entity id must not be empty"),
  }),
});

export type GetEntityQuery = z.infer<typeof GetEntityQuerySchema>;

export const ListEntitiesQuerySchema = z.object({
  type: z.literal("LIST_ENTITIES"),
  payload: z.object({
    worldId: z.string().min(1, "World id must not be empty"),
    type: z.string().optional(),
  }),
});

export type ListEntitiesQuery = z.infer<typeof ListEntitiesQuerySchema>;

export const FindEntitiesQuerySchema = z.object({
  type: z.literal("FIND_ENTITIES"),
  payload: z.object({
    worldId: z.string().min(1, "World id must not be empty"),
    type: z.string().optional(),
    propertyKey: z.string().min(1).optional(),
    propertyValue: z.unknown().optional(),
  }),
});

export type FindEntitiesQuery = z.infer<typeof FindEntitiesQuerySchema>;

export const GetRelationshipQuerySchema = z.object({
  type: z.literal("GET_RELATIONSHIP"),
  payload: z.object({
    worldId: z.string().min(1, "World id must not be empty"),
    relationshipId: z.string().min(1, "Relationship id must not be empty"),
  }),
});

export type GetRelationshipQuery = z.infer<typeof GetRelationshipQuerySchema>;

export const ListRelationshipsQuerySchema = z.object({
  type: z.literal("LIST_RELATIONSHIPS"),
  payload: z.object({
    worldId: z.string().min(1, "World id must not be empty"),
    sourceEntityId: z.string().optional(),
    targetEntityId: z.string().optional(),
    type: z.string().optional(),
  }),
});

export type ListRelationshipsQuery = z.infer<typeof ListRelationshipsQuerySchema>;

export const GetNeighborsQuerySchema = z.object({
  type: z.literal("GET_NEIGHBORS"),
  payload: z.object({
    worldId: z.string().min(1, "World id must not be empty"),
    entityId: z.string().min(1, "Entity id must not be empty"),
    relationshipType: z.string().optional(),
    direction: z.enum(["outgoing", "incoming", "both"]).default("both"),
  }),
});

export type GetNeighborsQuery = z.infer<typeof GetNeighborsQuerySchema>;

export const FindPathQuerySchema = z.object({
  type: z.literal("FIND_PATH"),
  payload: z.object({
    worldId: z.string().min(1, "World id must not be empty"),
    sourceEntityId: z.string().min(1, "Source entity id must not be empty"),
    targetEntityId: z.string().min(1, "Target entity id must not be empty"),
    maxDepth: z.number().int().positive().default(5),
    relationshipType: z.string().optional(),
  }),
});

export type FindPathQuery = z.infer<typeof FindPathQuerySchema>;

export const QuerySchema = z.discriminatedUnion("type", [
  GetWorldQuerySchema,
  GetEntityQuerySchema,
  ListEntitiesQuerySchema,
  FindEntitiesQuerySchema,
  GetRelationshipQuerySchema,
  ListRelationshipsQuerySchema,
  GetNeighborsQuerySchema,
  FindPathQuerySchema,
]);

export type Query = z.infer<typeof QuerySchema>;
