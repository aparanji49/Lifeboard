import { z } from "zod";

export const AgentIntentSchema = z.enum(["CREATE_TASK", "QUERY_AVAILABILITY"]);
export type AgentIntent = z.infer<typeof AgentIntentSchema>;

export const IsoDateTimeSchema = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid ISO datetime");

export const TimeWindowSchema = z.object({
  start: IsoDateTimeSchema,
  end: IsoDateTimeSchema,
});
export type TimeWindow = z.infer<typeof TimeWindowSchema>;

export const TaskDraftSchema = z.object({
  title: z.string().min(1),
  rawText: z.string().min(1),
  description: z.string().optional(),
  start: IsoDateTimeSchema,
  end: IsoDateTimeSchema,
});
export type TaskDraft = z.infer<typeof TaskDraftSchema>;

export const AvailabilitySlotSchema = z.object({
  start: IsoDateTimeSchema,
  end: IsoDateTimeSchema,
});
export type AvailabilitySlot = z.infer<typeof AvailabilitySlotSchema>;

export const AgentResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("success"),
    intent: z.literal("CREATE_TASK"),
    message: z.string(),
    task: TaskDraftSchema,
    calendarEventId: z.string().optional(),
    calendarEventLink: z.string().optional(),
  }),
  z.object({
    status: z.literal("conflict"),
    intent: z.literal("CREATE_TASK"),
    message: z.string(),
    task: TaskDraftSchema,
    suggestions: z.array(AvailabilitySlotSchema),
  }),
  z.object({
    status: z.literal("success"),
    intent: z.literal("QUERY_AVAILABILITY"),
    message: z.string(),
    window: TimeWindowSchema,
    availability: z.array(AvailabilitySlotSchema),
  }),
  z.object({
    status: z.literal("error"),
    intent: AgentIntentSchema.optional(),
    message: z.string(),
  }),
]);
export type AgentResult = z.infer<typeof AgentResultSchema>;

