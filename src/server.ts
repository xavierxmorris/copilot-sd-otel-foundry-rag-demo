import "dotenv/config";
import "./telemetry.js";

import express, { type ErrorRequestHandler } from "express";

import { getCopilotTelemetryConfig, isCopilotSdkEnabled } from "./copilotClient.js";
import { chatRouter } from "./routes/chat.js";

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

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

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`FSI RAG demo API listening on port ${port}`);
});

export { app };

