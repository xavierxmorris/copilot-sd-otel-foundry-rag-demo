import { context as otelContext, propagation, SpanKind, SpanStatusCode, trace as otelTrace } from "@opentelemetry/api";
import { z } from "zod";

import { tracer, toolDurationHistogram, shouldCaptureContent } from "../telemetry.js";
import { retrieveContext, type CaseStatusResult, type RetrievedSource } from "./retriever.js";

export type ToolInvocation = {
  traceparent?: string;
  tracestate?: string;
};

const retrieveArgsSchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().min(1).max(5).optional(),
});

const caseStatusArgsSchema = z.object({
  caseId: z.string().min(1),
});

function invocationContext(invocation?: ToolInvocation) {
  const activeContext = otelContext.active();
  if (otelTrace.getSpan(activeContext)) {
    return activeContext;
  }

  const carrier: Record<string, string> = {};
  if (invocation?.traceparent) {
    carrier.traceparent = invocation.traceparent;
  }
  if (invocation?.tracestate) {
    carrier.tracestate = invocation.tracestate;
  }

  return Object.keys(carrier).length > 0 ? propagation.extract(activeContext, carrier) : activeContext;
}

async function withToolSpan<T>(
  toolName: string,
  args: Record<string, unknown>,
  invocation: ToolInvocation | undefined,
  handler: () => Promise<T>,
): Promise<T> {
  const parentContext = invocationContext(invocation);
  const start = performance.now();

  return otelContext.with(parentContext, () =>
    tracer.startActiveSpan(
      `tool.${toolName}`,
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          "gen_ai.operation.name": "execute_tool",
          "gen_ai.tool.name": toolName,
          "gen_ai.tool.type": "function",
          "fsi.demo.tool.name": toolName,
          ...(shouldCaptureContent() ? { "gen_ai.tool.call.arguments": JSON.stringify(args) } : {}),
        },
      },
      async (span) => {
        try {
          const result = await handler();
          if (shouldCaptureContent()) {
            span.setAttribute("gen_ai.tool.call.result", JSON.stringify(result));
          }
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          span.recordException(error instanceof Error ? error : new Error(message));
          span.setStatus({ code: SpanStatusCode.ERROR, message });
          throw error;
        } finally {
          const duration = performance.now() - start;
          span.setAttribute("fsi.demo.tool.duration_ms", Math.round(duration));
          toolDurationHistogram.record(duration, { "fsi.demo.tool.name": toolName });
          span.end();
        }
      },
    ),
  );
}

export async function retrieveQaContext(
  args: z.input<typeof retrieveArgsSchema>,
  invocation?: ToolInvocation,
): Promise<{ sources: RetrievedSource[] }> {
  const parsed = retrieveArgsSchema.parse(args);

  return withToolSpan("retrieve_qa_context", parsed, invocation, async () => ({
    sources: retrieveContext(parsed.query, parsed.topK ?? 3),
  }));
}

const syntheticCases: Record<string, CaseStatusResult> = {
  "CARD-1001": {
    caseId: "CARD-1001",
    status: "open",
    summary: "Case CARD-1001 is open. A synthetic replacement card request has been accepted and is awaiting dispatch confirmation.",
    updatedAt: "2026-05-22T00:00:00.000Z",
  },
  "LOAN-2002": {
    caseId: "LOAN-2002",
    status: "in_review",
    summary: "Case LOAN-2002 is in review. Synthetic income verification is pending, and no approval guarantee can be provided.",
    updatedAt: "2026-05-22T00:00:00.000Z",
  },
};

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export async function getCaseStatus(
  args: z.input<typeof caseStatusArgsSchema>,
  invocation?: ToolInvocation,
): Promise<CaseStatusResult> {
  const parsed = caseStatusArgsSchema.parse(args);
  const caseId = parsed.caseId.toUpperCase();

  return withToolSpan("get_case_status", { caseId }, invocation, async () => {
    if (caseId === "SLOW-500") {
      await delay(1200);
      throw new Error("Synthetic downstream case-status timeout for SLOW-500.");
    }

    const status = syntheticCases[caseId];
    if (!status) {
      return {
        caseId,
        status: "waiting",
        summary: `No synthetic status record exists for ${caseId}.`,
        updatedAt: new Date(0).toISOString(),
      };
    }

    return status;
  });
}

