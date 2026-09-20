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

export const QuerySchema = z.discriminatedUnion("type", [
  GetWorldQuerySchema,
  GetEntityQuerySchema,
  ListEntitiesQuerySchema,
]);

export type Query = z.infer<typeof QuerySchema>;