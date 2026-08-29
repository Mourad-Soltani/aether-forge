import { z } from "zod";

export const ToolCallSchema = z.object({
  toolName: z.string(),
  args: z.record(z.any()),
});

export const AuditEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  agentId: z.string().optional(),
  type: z.enum(["thought", "tool_call", "tool_result", "decision", "error", "human_input"]),
  content: z.any(),
});

export type ToolCall = z.infer<typeof ToolCallSchema>;
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export interface Tool {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  execute: (args: any) => Promise<any>;
}

export interface Agent {
  id: string;
  name: string;
  goal: string;
  tools: Tool[];
  systemPrompt?: string;
}
