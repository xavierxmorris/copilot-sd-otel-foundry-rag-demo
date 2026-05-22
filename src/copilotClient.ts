import { CopilotClient, approveAll } from "@github/copilot-sdk";
import { context, propagation } from "@opentelemetry/api";

import { serviceName, shouldCaptureContent } from "./telemetry.js";

let client: CopilotClient | undefined;

export function getCopilotTelemetryConfig() {
  return {
    exporterType: "otlp-http" as const,
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318",
    sourceName: serviceName,
    captureContent: shouldCaptureContent(),
  };
}

export function getCopilotClient(): CopilotClient {
  if (!client) {
    client = new CopilotClient({
      telemetry: getCopilotTelemetryConfig(),
      onGetTraceContext: () => {
        const carrier: Record<string, string> = {};
        propagation.inject(context.active(), carrier);
        return carrier;
      },
    });
  }

  return client;
}

export function isCopilotSdkEnabled(): boolean {
  return process.env.USE_COPILOT_SDK?.toLowerCase() === "true" && Boolean(process.env.GITHUB_TOKEN);
}

export async function runCopilotTraceProbe(message: string): Promise<void> {
  if (!isCopilotSdkEnabled()) {
    return;
  }

  const session = await getCopilotClient().createSession({
    onPermissionRequest: approveAll,
  });

  await session.sendAndWait({
    prompt: [
      "You are participating in a synthetic FSI RAG telemetry demo.",
      "A deterministic local tool pipeline will answer the user.",
      "Reply with one short sentence confirming the request category only.",
      `User request: ${message}`,
    ].join("\n"),
  });
}

