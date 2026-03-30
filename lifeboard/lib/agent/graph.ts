import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

import {
  AgentIntentSchema,
  TaskDraftSchema,
  TimeWindowSchema,
  type AgentIntent,
  type AgentResult,
  type TaskDraft,
  type TimeWindow,
} from "./schemas";
import { computeAvailability } from "./availability";
import {
  createCalendarEvent,
  getBusyBlocks,
  getCalendarForRefreshToken,
} from "@/lib/googleCalendar";
import { prisma } from "@/lib/prisma";
import { timeDebug } from "@/lib/timeDebug";

const GraphStateAnnotation = Annotation.Root({
  userId: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  text: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  refreshToken: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  timeZone: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "UTC",
  }),
  userTimeContext: Annotation<{
    timestamp: string;
    timezone: string;
    localTime: string;
  } | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  intent: Annotation<AgentIntent>({
    reducer: (_prev, next) => next,
    default: () => "CREATE_TASK",
  }),
  window: Annotation<TimeWindow | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  draft: Annotation<TaskDraft | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  busy: Annotation<{ start: string; end: string }[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  availability: Annotation<{ start: string; end: string }[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  result: Annotation<AgentResult | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
});

type GraphState = typeof GraphStateAnnotation.State;

const model = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  model: "gpt-4o-mini",
  temperature: 0.2,
});

const RouterOutputSchema = z.object({ intent: AgentIntentSchema });
const CreateDraftOutputSchema = TaskDraftSchema;
const WindowOutputSchema = TimeWindowSchema;

function formatUserTimeContextBlock(state: GraphState): string {
  if (state.userTimeContext) {
    const { timestamp, timezone, localTime } = state.userTimeContext;
    return [
      "Use the following user context for any time-sensitive queries:",
      `Current UTC Time: ${timestamp}`,
      `User Timezone: ${timezone}`,
      `User Local Time: ${localTime}`,
    ].join("\n");
  }
  const timestamp = new Date().toISOString();
  return [
    "Use the following user context for any time-sensitive queries:",
    `Current UTC Time: ${timestamp}`,
    `User Timezone: ${state.timeZone}`,
    "User Local Time: (not provided)",
  ].join("\n");
}

async function routeIntent(state: GraphState): Promise<Partial<GraphState>> {
  const router = model.withStructuredOutput(RouterOutputSchema, {
    name: "route_intent",
  });
  const raw = await router.invoke([
    {
      role: "system",
      content:
        "You are an intent router for a calendar scheduling assistant. Return only the intent.",
    },
    { role: "user", content: state.text },
  ]);
  const out = RouterOutputSchema.parse(raw);
  return { intent: out.intent };
}

async function parseCreateDraft(state: GraphState): Promise<Partial<GraphState>> {
  const parser = model.withStructuredOutput(CreateDraftOutputSchema, {
    name: "create_task_draft",
  });

  const raw = await parser.invoke([
    {
      role: "system",
      content: [
        "Extract a task draft for scheduling.",
        formatUserTimeContextBlock(state),
        "Return ISO datetimes with timezone offset.",
        "Include rawText exactly as provided.",
        "If the user did not give a time, choose a reasonable 30–60 minute slot within the next 7 days.",
      ].join("\n"),
    },
    { role: "user", content: state.text },
  ]);
  const out = TaskDraftSchema.parse(raw);
  return { draft: out };
}

async function parseAvailabilityWindow(
  state: GraphState
): Promise<Partial<GraphState>> {
  const parser = model.withStructuredOutput(WindowOutputSchema, {
    name: "availability_window",
  });

  const raw = await parser.invoke([
    {
      role: "system",
      content: [
        "Extract a time window the user is asking about for availability.",
        formatUserTimeContextBlock(state),
        "Return ISO datetimes with timezone offset.",
        "If not specified, default to the next 24 hours.",
      ].join("\n"),
    },
    { role: "user", content: state.text },
  ]);
  const out = TimeWindowSchema.parse(raw);
  timeDebug("graph parseAvailabilityWindow result", { start: out.start, end: out.end, timeZone: state.timeZone });
  return { window: out };
}

async function fetchBusy(state: GraphState): Promise<Partial<GraphState>> {
  const calendar = getCalendarForRefreshToken(state.refreshToken);
  const window =
    state.intent === "CREATE_TASK"
      ? { start: state.draft!.start, end: state.draft!.end }
      : state.window!;

  const busy = await getBusyBlocks(calendar, window);
  return { busy };
}

async function computeAvail(state: GraphState): Promise<Partial<GraphState>> {
  const window =
    state.intent === "CREATE_TASK"
      ? { start: state.draft!.start, end: state.draft!.end }
      : state.window!;

  const availability = computeAvailability(window, state.busy ?? []);
  return { availability };
}

async function maybeCreateTask(state: GraphState): Promise<Partial<GraphState>> {
  // If the chosen window is busy, return conflict with suggestions
  if ((state.busy?.length ?? 0) > 0) {
    const result: AgentResult = {
      status: "conflict",
      intent: "CREATE_TASK",
      message:
        "That time looks busy. Here are a few open options you can pick instead.",
      task: state.draft!,
      suggestions: (state.availability ?? []).map((s) => ({
        start: s.start,
        end: s.end,
      })),
    };
    return { result };
  }

  const calendar = getCalendarForRefreshToken(state.refreshToken);
  timeDebug("graph maybeCreateTask createCalendarEvent input", {
    start: state.draft!.start,
    end: state.draft!.end,
    timeZone: state.timeZone,
  });
  const created = await createCalendarEvent(calendar, {
    title: state.draft!.title,
    description: state.draft!.description,
    start: state.draft!.start,
    end: state.draft!.end,
    timeZone: state.timeZone,
  });

  await prisma.task.create({
    data: {
      userId: state.userId,
      title: state.draft!.title,
      description: state.draft!.description ?? null,
      userInstruction: state.draft!.rawText,
      schedulingStatus: "SCHEDULED",
      isCompleted: false,
      startTime: new Date(state.draft!.start),
      endTime: new Date(state.draft!.end),
      googleEventId: created.id ?? null,
    },
  });

  const result: AgentResult = {
    status: "success",
    intent: "CREATE_TASK",
    message: "Scheduled it on your Google Calendar.",
    task: state.draft!,
    calendarEventId: created.id,
    calendarEventLink: created.htmlLink,
  };
  return { result };
}

async function finalize(state: GraphState): Promise<Partial<GraphState>> {
  if (state.intent === "QUERY_AVAILABILITY") {
    const result: AgentResult = {
      status: "success",
      intent: "QUERY_AVAILABILITY",
      message: "Here are some open times in that window.",
      window: state.window!,
      availability: (state.availability ?? []).map((s) => ({
        start: s.start,
        end: s.end,
      })),
    };
    return { result };
  }

  return {
    result: state.result ?? {
      status: "error",
      intent: state.intent,
      message: "Unexpected agent state.",
    },
  };
}

export const agentGraph = new StateGraph(GraphStateAnnotation)
  .addNode("routeIntent", routeIntent)
  .addNode("parseCreateDraft", parseCreateDraft)
  .addNode("parseAvailabilityWindow", parseAvailabilityWindow)
  .addNode("fetchBusy", fetchBusy)
  .addNode("computeAvail", computeAvail)
  .addNode("maybeCreateTask", maybeCreateTask)
  .addNode("finalize", finalize)
  .addEdge(START, "routeIntent")
  // Branch via condition after routeIntent:
  .addConditionalEdges("routeIntent", (s) => s.intent, {
    CREATE_TASK: "parseCreateDraft",
    QUERY_AVAILABILITY: "parseAvailabilityWindow",
  })
  .addEdge("parseCreateDraft", "fetchBusy")
  .addEdge("parseAvailabilityWindow", "fetchBusy")
  .addEdge("fetchBusy", "computeAvail")
  .addConditionalEdges("computeAvail", (s) => s.intent, {
    CREATE_TASK: "maybeCreateTask",
    QUERY_AVAILABILITY: "finalize",
  })
  .addEdge("maybeCreateTask", "finalize")
  .addEdge("finalize", END)
  .compile();

