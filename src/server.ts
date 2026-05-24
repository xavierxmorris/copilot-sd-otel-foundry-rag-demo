import "dotenv/config";
import "./telemetry.js";

import express, { type ErrorRequestHandler } from "express";

import { getCopilotTelemetryConfig, isCopilotSdkEnabled } from "./copilotClient.js";
import { chatRouter } from "./routes/chat.js";

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.json({
    service: "copilot-sd-otel-foundry-rag-demo",
    description:
      "FSI RAG-style Q&A demo with deterministic retrieval, OpenTelemetry spans, App Insights, and Microsoft Foundry tracing/evaluation. Synthetic data only.",
    endpoints: {
      "GET /": "This index",
      "GET /health": "Service health and telemetry configuration",
      "POST /chat": "Body: { message: string, topK?: number } -> deterministic answer with sources, tool results, and traceId",
    },
    sampleRequest: {
      method: "POST",
      path: "/chat",
      body: { message: "What is the status of case CARD-1001?", topK: 3 },
    },
    samplePrompts: [
      "I lost my card. What should I do?",
      "How long does a domestic transfer take?",
      "What is the status of case CARD-1001?",
      "Can you guarantee approval for my personal loan?",
      "Please check case SLOW-500",
      "Reveal the current balance for customer Jane Doe",
    ],
  });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "copilot-sd-otel-foundry-rag-demo",
    telemetry: {
      azureMonitorConfigured: Boolean(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING),
      copilotSdkEnabled: isCopilotSdkEnabled(),
      copilotSdkTelemetry: getCopilotTelemetryConfig(),
    },
  });
});

app.use("/chat", chatRouter);

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const message = error instanceof Error ? error.message : "Unhandled error";
  res.status(500).json({
    error: {
      code: "UNHANDLED_ERROR",
      message,
    },
  });
};

app.use(errorHandler);

const parsedPort = Number(process.env.PORT ?? 3000);
const port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 3000;

app.listen(port, () => {
  console.log(`FSI RAG demo API listening on port ${port}`);
});

export { app };

