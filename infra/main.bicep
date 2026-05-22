targetScope = 'subscription'

@minLength(1)
param environmentName string

param location string = 'eastus2'
param name string = 'fsirag'

@secure()
param githubToken string = ''

param apiImageName string = ''

param tags object = {}

var mergedTags = union(tags, {
  'azd-env-name': environmentName
  workload: 'copilot-sdk-otel-foundry-rag-demo'
})

resource resourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: 'rg-${environmentName}-${name}'
  location: location
  tags: mergedTags
}

module resources 'resources.bicep' = {
  name: 'resources-${environmentName}-${name}'
  scope: resourceGroup
  params: {
    name: name
    environmentName: environmentName
    location: location
    tags: mergedTags
    githubToken: githubToken
    apiImageName: apiImageName
  }
}

output AZURE_RESOURCE_GROUP string = resourceGroup.name
output API_URL string = resources.outputs.apiUrl
output APPLICATIONINSIGHTS_CONNECTION_STRING string = resources.outputs.applicationInsightsConnectionString
output APPLICATIONINSIGHTS_RESOURCE_ID string = resources.outputs.applicationInsightsResourceId
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = resources.outputs.acrLoginServer
output AZURE_KEY_VAULT_NAME string = resources.outputs.keyVaultName
output AZURE_LOG_ANALYTICS_WORKSPACE_ID string = resources.outputs.logAnalyticsWorkspaceId
output AZURE_MANAGED_IDENTITY_CLIENT_ID string = resources.outputs.managedIdentityClientId
output FOUNDRY_LINKAGE_NOTES string = 'Link an existing or new Microsoft Foundry project to APPLICATIONINSIGHTS_RESOURCE_ID for trace and evaluation workflows.'

