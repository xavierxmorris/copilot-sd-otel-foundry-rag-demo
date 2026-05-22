# KQL Queries

Run these in the Application Insights Logs blade.

## GenAI span overview

```kql
dependencies
| where timestamp > ago(24h)
| where isnotempty(customDimensions["gen_ai.operation.name"])
| summarize
    spanCount = count(),
    errorCount = countif(success == false),
    avgDuration = avg(duration)
  by operation = tostring(customDimensions["gen_ai.operation.name"]), bin(timestamp, 1h)
| order by timestamp desc
```

## Tool execution details for one trace

```kql
dependencies
| where timestamp > ago(24h)
| where operation_Id == "<trace_id>"
| where customDimensions["gen_ai.operation.name"] == "execute_tool"
| project
    timestamp,
    duration,
    success,
    toolName = tostring(customDimensions["gen_ai.tool.name"]),
    toolType = tostring(customDimensions["gen_ai.tool.type"]),
    args = tostring(customDimensions["gen_ai.tool.call.arguments"]),
    result = tostring(customDimensions["gen_ai.tool.call.result"]),
    operation_Id,
    id,
    operation_ParentId
| order by timestamp asc
```

## `retrieve_qa_context` traces

```kql
dependencies
| where timestamp > ago(24h)
| where tostring(customDimensions["gen_ai.tool.name"]) == "retrieve_qa_context"
| project
    timestamp,
    duration,
    success,
    sourceService = cloud_RoleName,
    arguments = tostring(customDimensions["gen_ai.tool.call.arguments"]),
    result = tostring(customDimensions["gen_ai.tool.call.result"]),
    operation_Id
| order by timestamp desc
```

## Error rate by GenAI operation

```kql
dependencies
| where timestamp > ago(24h)
| where isnotempty(customDimensions["gen_ai.operation.name"])
| summarize
    total = count(),
    errors = countif(success == false),
    errorRate = round(100.0 * countif(success == false) / count(), 1)
  by operation = tostring(customDimensions["gen_ai.operation.name"])
| order by errorRate desc
```

## Slow `SLOW-500` path

```kql
dependencies
| where timestamp > ago(24h)
| where tostring(customDimensions["gen_ai.tool.name"]) == "get_case_status"
| where tostring(customDimensions["gen_ai.tool.call.arguments"]) has "SLOW-500"
   or tostring(customDimensions["fsi.demo.tool.name"]) == "get_case_status"
| project timestamp, duration, success, resultCode, operation_Id, customDimensions
| order by timestamp desc
```

## Token usage from Copilot SDK spans

```kql
dependencies
| where timestamp > ago(24h)
| where customDimensions["gen_ai.operation.name"] == "chat"
| summarize
    calls = count(),
    totalInputTokens = sum(toint(customDimensions["gen_ai.usage.input_tokens"])),
    totalOutputTokens = sum(toint(customDimensions["gen_ai.usage.output_tokens"]))
  by model = tostring(customDimensions["gen_ai.request.model"])
| order by calls desc
```

## Evaluation custom events

```kql
customEvents
| where timestamp > ago(7d)
| where name == "gen_ai.evaluation.result"
| extend
    evalName = tostring(customDimensions["gen_ai.evaluation.name"]),
    score = todouble(customDimensions["gen_ai.evaluation.score.value"]),
    label = tostring(customDimensions["gen_ai.evaluation.score.label"]),
    conversationId = tostring(customDimensions["gen_ai.conversation.id"]),
    responseId = tostring(customDimensions["gen_ai.response.id"])
| project timestamp, evalName, score, label, conversationId, responseId, operation_Id
| order by timestamp desc
```

## Evaluation-to-trace correlation

```kql
let evals =
customEvents
| where timestamp > ago(7d)
| where name == "gen_ai.evaluation.result"
| extend
    responseId = tostring(customDimensions["gen_ai.response.id"]),
    conversationId = tostring(customDimensions["gen_ai.conversation.id"]),
    evalName = tostring(customDimensions["gen_ai.evaluation.name"]),
    score = todouble(customDimensions["gen_ai.evaluation.score.value"]),
    label = tostring(customDimensions["gen_ai.evaluation.score.label"])
| project evalTimestamp = timestamp, responseId, conversationId, evalName, score, label;
dependencies
| where timestamp > ago(7d)
| where isnotempty(customDimensions["gen_ai.operation.name"])
| extend
    responseId = tostring(customDimensions["gen_ai.response.id"]),
    conversationId = tostring(customDimensions["gen_ai.conversation.id"]),
    operation = tostring(customDimensions["gen_ai.operation.name"])
| join kind=leftouter evals on responseId
| project timestamp, operation, duration, success, responseId, conversationId, evalName, score, label, operation_Id
| order by timestamp desc
```

