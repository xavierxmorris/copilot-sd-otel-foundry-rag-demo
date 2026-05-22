import { SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { Router, type Request, type Response } from "express";
import { z } from "zod";

import { getCopilotTelemetryConfig, isCopilotSdkEnabled, runCopilotTraceProbe } from "../copilotClient.js";
import { chatRequestsCounter, shouldCaptureContent, tracer } from "../telemetry.js";
import { answerFromSources } from "../rag/retriever.js";
import { getCaseStatus, retrieveQaContext, type ToolInvocation } from "../rag/tools.js";

const chatRequestSchema = z.object({
  message: z.string().min(1),
  topK: z.number().int().min(1).max(5).optional(),
});

const caseIdPattern = /\b(?:CARD-\d{4}|LOAN-\d{4}|SLOW-\d{3})\b/i;
const invalidTraceIdPattern = /^0+$/;

export const chatRouter = Router();

chatRouter.post("/", async (req: Request, res: Response) => {
  const parsed = chatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "INVALID_REQUEST",
        message: parsed.error.issues.map((issue) => issue.message).join("; "),
      },
    });
    return;
  }

  const invocation: ToolInvocation = {
    traceparent: req.header("traceparent") ?? undefined,
    tracestate: req.header("tracestate") ?? undefined,
  };

  await tracer.startActiveSpan(
    "chat.request",
    {
      kind: SpanKind.SERVER,
      attributes: {
        "gen_ai.operation.name": "invoke_agent",
        "gen_ai.agent.name": "fsi-rag-demo",
        "fsi.demo.route": "/chat",
        "fsi.demo.capture_content": shouldCaptureContent(),
        ...(shouldCaptureContent() ? { "gen_ai.input.messages": JSON.stringify([{ role: "user", content: parsed.data.message }]) } : {}),
      },
    },
    async (span) => {
      chatRequestsCounter.add(1, { "fsi.demo.route": "/chat" });
      const activeTraceId = span.spanContext().traceId;
      const traceId = invalidTraceIdPattern.test(activeTraceId) ? undefined : activeTraceId;

      try {
        await runCopilotTraceProbe(parsed.data.message);

        const retrieval = await retrieveQaContext(
          {
            query: parsed.data.message,
            topK: parsed.data.topK,
          },
          invocation,
        );

        const caseId = parsed.data.message.match(caseIdPattern)?.[0]?.toUpperCase();
        const caseStatus = caseId ? await getCaseStatus({ caseId }, invocation) : undefined;
        const answer = answerFromSources(parsed.data.message, retrieval.sources, caseStatus);

        if (shouldCaptureContent()) {
          span.setAttribute("gen_ai.output.messages", JSON.stringify([{ role: "assistant", content: answer }]));
        }

        span.setAttributes({
          "fsi.demo.source_count": retrieval.sources.length,
          "fsi.demo.case_id": caseId ?? "",
          "fsi.demo.copilot_sdk_enabled": isCopilotSdkEnabled(),
        });
        span.setStatus({ code: SpanStatusCode.OK });

        res.json({
          answer,
          sources: retrieval.sources,
          tools: {
            retrieve_qa_context: {
              topK: parsed.data.topK ?? 3,
              returned: retrieval.sources.length,
            },
            ...(caseStatus ? { get_case_status: caseStatus } : {}),
          },
          telemetry: {
            traceId,
            copilotSdkEnabled: isCopilotSdkEnabled(),
            copilotSdkTelemetry: getCopilotTelemetryConfig(),
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        span.recordException(error instanceof Error ? error : new Error(message));
        span.setStatus({ code: SpanStatusCode.ERROR, message });

        res.status(500).json({
          error: {
            code: "DEMO_TOOL_ERROR",
            message,
          },
          telemetry: {
            traceId,
            copilotSdkEnabled: isCopilotSdkEnabled(),
            copilotSdkTelemetry: getCopilotTelemetryConfig(),
          },
        });
      } finally {
        span.end();
      }
    },
  );
});

