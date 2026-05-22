# Demo Script

## 1. Open with the architecture

Show `docs/architecture.md` and explain the split:

- App spans go directly to Application Insights through `@azure/monitor-opentelemetry`.
- Copilot SDK/CLI spans go to the local OTLP collector, which exports to the same Application Insights resource.
- Foundry reads traces/evaluation results from the linked Application Insights resource.

## 2. Start locally

```powershell
npm install
npm run build
npm run dev
```

Optional Copilot SDK trace probe:

```powershell
$env:GITHUB_TOKEN = gh auth token
$env:USE_COPILOT_SDK = "true"
$env:CAPTURE_TRACE_CONTENT = "true"
```

## 3. Health check

```powershell
Invoke-RestMethod http://localhost:3000/health
```

Expected observation: service status is `ok`, Azure Monitor is configured only when a connection string is present, and Copilot SDK telemetry points to `http://localhost:4318`.

## 4. Run scripted traffic

```powershell
npm run seed:demo
```

Expected observations:

- Lost card returns card-lock and replacement guidance grounded in `KB-CARD-LOST-001`.
- Domestic transfer returns timing guidance grounded in `KB-ACCOUNT-TRANSFER-003`.
- `CARD-1001` calls `get_case_status`.
- Personal-loan guarantee refuses to guarantee approval.
- `SLOW-500` returns an expected error and creates a slow-failing tool span.
- Balance request refuses to reveal or invent customer data.

## 5. Show App Insights traces

Open Application Insights Logs and run queries from `docs/kql-queries.md`:

- GenAI span overview.
- Tool execution details.
- `retrieve_qa_context` traces.
- Error rate by operation.

## 6. Show Foundry trace and evaluation path

In Microsoft Foundry:

1. Open the project.
2. Connect or confirm the Application Insights resource.
3. Open the Tracing tab.
4. Filter for the demo service or trace ID from `npm run seed:demo`.
5. Use trace-based evaluation if available, or export traces to a dataset and run the recommended evaluators from `docs/foundry-evaluation.md`.

## 7. Close

Emphasize that the demo is safe-by-default: synthetic-only data, local deterministic retrieval, no real balances, and content capture disabled unless explicitly enabled for a controlled evaluation demo.

