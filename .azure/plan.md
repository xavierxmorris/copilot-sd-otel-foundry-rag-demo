# Azure Deployment Preparation Plan

Status: Deployed

## Summary

Prepare a greenfield TypeScript/Express financial-services RAG-style Q&A demo for Azure using AZD and Bicep. The app demonstrates GitHub Copilot SDK-style tool orchestration telemetry, Azure Monitor Application Insights OpenTelemetry ingestion, an OTLP collector bridge, and Microsoft Foundry trace/evaluation workflows.

## Azure context

- Subscription: `51eb709f-8958-49c4-a547-ebdbd4bf66dc`
- Region: `eastus2`
- Environment: `dev`
- Deployment recipe: AZD + Bicep
- Repository: `xavierxmorris/copilot-sd-otel-foundry-rag-demo`

## Workspace analysis

- Mode: NEW application in an existing GitHub repository.
- Existing content: initial `README.md` only.
- Specialized technology: GitHub Copilot SDK on Azure, Azure Monitor OpenTelemetry, and Microsoft Foundry tracing/evaluation.
- Data classification: synthetic demo-only FSI content. No real customers, accounts, transactions, balances, policies, secrets, or production data.

## Architecture

- Node.js/TypeScript Express API exposes `GET /health` and `POST /chat`.
- Local deterministic keyword-overlap retrieval over 10-15 synthetic FSI Q&A entries.
- Demo tools:
  - `retrieve_qa_context({ query, topK })`
  - `get_case_status({ caseId })`
- App telemetry:
  - Initialize `@azure/monitor-opentelemetry` as early as possible with `APPLICATIONINSIGHTS_CONNECTION_STRING`.
  - Emit custom app/tool spans and metrics through OpenTelemetry APIs.
  - Forward Copilot SDK/CLI OTLP HTTP traces to a local collector endpoint.
- Container Apps deployment:
  - API container plus OpenTelemetry Collector sidecar/companion.
  - Collector receives OTLP HTTP on `4318` and exports to Azure Monitor.

## Azure resources

- Resource group tagged with `azd-env-name`.
- Log Analytics workspace.
- Workspace-based Application Insights.
- Azure Container Registry.
- Azure Container Apps managed environment.
- Azure Container App for API and collector containers.
- Key Vault for secret storage/documented GitHub token flow.
- User-assigned managed identity for the app.

## Generated artifacts

- Application: `package.json`, `tsconfig.json`, `Dockerfile`, `.env.example`, `src/**`.
- Azure: `azure.yaml`, `infra/main.bicep`, `infra/main.parameters.json`, `infra/resources.bicep`.
- OTel collector: `otel/collector.yaml`.
- Docs: `README.md`, `docs/architecture.md`, `docs/demo-script.md`, `docs/kql-queries.md`, `docs/foundry-evaluation.md`.

## Security and cost decisions

- Keep retrieval local and deterministic; do not provision Azure AI Search in v1.
- Do not provision Foundry resources directly unless supported by current guidance; document linking a Foundry project to the Application Insights resource.
- Do not commit secrets. Use `APPLICATIONINSIGHTS_CONNECTION_STRING` from provisioned resources and document GitHub token injection via AZD environment/Key Vault flow.
- Default `CAPTURE_TRACE_CONTENT=false`; content capture is opt-in.
- Use low CPU/memory Container Apps settings and consumption-friendly monitoring resources.

## Validation plan

- Install dependencies.
- Run TypeScript build/typecheck.
- Run local API smoke checks for health and chat routes.
- Run demo traffic script.
- Validate Bicep/AZD structure as far as possible without deployment.
- Update this plan status to `Ready for Validation` before invoking azure-validate.

## All validation checks pass

- [x] 1. AZD Installation
- [x] 2. Schema Validation through AZD preview/package commands
- [x] 3. Environment Setup
- [x] 4. Authentication Check
- [x] 5. Subscription/Location Check
- [x] 6. Aspire Pre-Provisioning Checks skipped because this is not a .NET Aspire project
- [x] 7. Provision Preview
- [x] 8. Build Verification
- [x] 9. Package Validation
- [x] 10. Azure Policy Validation scope check
- [x] 11. Aspire Post-Provisioning Checks skipped because this is not a .NET Aspire project

## Execution checklist

- [x] Analyze workspace and requirements.
- [x] Select AZD + Bicep recipe.
- [x] Create Azure preparation plan.
- [x] Generate application source and telemetry implementation.
- [x] Generate AZD/Bicep infrastructure.
- [x] Generate OTel collector configuration.
- [x] Generate documentation and demo guidance.
- [x] Run local validation.
- [x] Update status to `Ready for Validation`.
- [x] Invoke azure-validate.

## Section 7: Validation Proof

- `npm install` completed and produced `package-lock.json`.
- `npm run build` passed.
- `npm audit --omit=dev` passed with 0 vulnerabilities after pinning the Azure Monitor distro line and adding a targeted protobuf override for the vulnerable OTLP transformer transitive dependency.
- `az bicep build --file infra\main.bicep` passed.
- `docker info` confirmed Docker is available, and `docker build -t copilot-sd-otel-foundry-rag-demo:local .` passed.
- `azd auth login --check-status` passed for `xaviermorris@MngEnvMCAP200728.onmicrosoft.com`.
- `az account show` confirmed subscription `51eb709f-8958-49c4-a547-ebdbd4bf66dc`.
- `azd env new dev --subscription 51eb709f-8958-49c4-a547-ebdbd4bf66dc --location eastus2 --no-prompt` created the requested `dev` environment.
- `azd env get-values` confirmed `AZURE_ENV_NAME=dev`, `AZURE_SUBSCRIPTION_ID=51eb709f-8958-49c4-a547-ebdbd4bf66dc`, and `AZURE_LOCATION=eastus2`.
- `azd provision --preview --no-prompt` passed and generated a no-deploy preview for the resource group, Container App, Container Apps Environment, ACR, Application Insights, Key Vault, and Log Analytics workspace.
- `azd package --no-prompt` passed and produced the `api` service container image package.
- `az account list-locations` confirmed `eastus2` is available in the active Azure account.
- `az policy assignment list --scope /subscriptions/51eb709f-8958-49c4-a547-ebdbd4bf66dc` returned 3 policy assignments for the target subscription scope; no policy deployment was attempted during validation.
- Local API smoke checks passed:
  - `GET /health`
  - `npm run seed:demo`, including expected `SLOW-500` HTTP 500 demo error path.

## Deployment proof

- `azd up --no-prompt` initially failed because the Key Vault template explicitly set `enablePurgeProtection: false`, which the target Azure environment rejected.
- Updated `infra/resources.bicep` to omit the explicit false purge-protection setting and reran validation/deployment.
- `az bicep build --file infra\main.bicep` passed after the Key Vault fix.
- A subsequent `azd up --no-prompt` attempt hit `DeploymentActive` while the previous ARM deployment was still running. I waited for `resources-dev-fsirag` to finish, and it reached `Succeeded`.
- `azd deploy --no-prompt` then deployed the API container image successfully in subscription `51eb709f-8958-49c4-a547-ebdbd4bf66dc`, region `eastus2`, environment `dev`.
- Resource group: `rg-dev-fsirag`.
- Container App endpoint: `https://ca-fsirag-gjbwsv.whitecoast-575f31b7.eastus2.azurecontainerapps.io`.
- `azd show` listed the deployed `api` service endpoint.
- `GET /health` returned HTTP 200 with telemetry configuration.
- `POST /chat` with "What should I do if my card is lost?" returned a grounded synthetic FSI answer with source snippets.
