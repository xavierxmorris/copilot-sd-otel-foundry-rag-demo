import { useAzureMonitor } from "@azure/monitor-opentelemetry";
import { metrics, trace } from "@opentelemetry/api";

export const serviceName = "copilot-sd-otel-foundry-rag-demo";

let initialized = false;

export function initializeTelemetry(): void {
  if (initialized) {
    return;
  }

  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (connectionString) {
    useAzureMonitor({
      azureMonitorExporterOptions: {
        connectionString,
      },
      instrumentationOptions: {
        http: { enabled: true },
      },
    });
  } else {
    console.warn("APPLICATIONINSIGHTS_CONNECTION_STRING is not set; Azure Monitor export is disabled.");
  }

  initialized = true;
}

initializeTelemetry();

export const tracer = trace.getTracer(serviceName, "0.1.0");
export const meter = metrics.getMeter(serviceName, "0.1.0");
export const chatRequestsCounter = meter.createCounter("fsi_demo_chat_requests_total", {
  description: "Synthetic FSI demo chat requests",
});
export const toolDurationHistogram = meter.createHistogram("fsi_demo_tool_duration_ms", {
  description: "Synthetic FSI demo tool duration in milliseconds",
  unit: "ms",
});

export function shouldCaptureContent(): boolean {
  return process.env.CAPTURE_TRACE_CONTENT?.toLowerCase() === "true";
}

