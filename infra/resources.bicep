targetScope = 'resourceGroup'

@minLength(1)
param name string

@minLength(1)
param environmentName string

param location string = resourceGroup().location
param tags object = {}

@secure()
param githubToken string = ''

param apiImageName string = ''

var suffix = take(uniqueString(subscription().id, resourceGroup().id, environmentName), 6)
var effectiveApiImageName = empty(apiImageName) ? 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest' : apiImageName
var safeName = toLower(replace(name, '-', ''))
var acrName = take('cr${safeName}${suffix}', 50)
var logAnalyticsName = 'log-${name}-${suffix}'
var appInsightsName = 'appi-${name}-${suffix}'
var managedEnvironmentName = 'cae-${name}-${suffix}'
var containerAppName = take('ca-${name}-${suffix}', 32)
var keyVaultName = take('kv-${name}-${suffix}', 24)
var identityName = 'id-${name}-${suffix}'
var appTags = union(tags, {
  'azd-service-name': 'api'
})
var acrPullRoleDefinitionId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
var keyVaultSecretsUserRoleDefinitionId = '4633458b-17de-408a-b874-0445c86b69e6'
var collectorConfig = '''
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318
processors:
  batch: {}
exporters:
  azuremonitor:
    connection_string: $${env:APPLICATIONINSIGHTS_CONNECTION_STRING}
service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [azuremonitor]
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [azuremonitor]
'''

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  tags: tags
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    tenantId: tenant().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    publicNetworkAccess: 'Enabled'
  }
}

resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: identityName
  location: location
  tags: tags
}

resource acrPullAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, managedIdentity.id, acrPullRoleDefinitionId)
  scope: acr
  properties: {
    principalId: managedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleDefinitionId)
  }
}

resource keyVaultSecretsAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, managedIdentity.id, keyVaultSecretsUserRoleDefinitionId)
  scope: keyVault
  properties: {
    principalId: managedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleDefinitionId)
  }
}

resource githubTokenSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'github-token'
  properties: {
    value: empty(githubToken) ? 'not-configured' : githubToken
  }
}

resource managedEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: managedEnvironmentName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppName
  location: location
  tags: appTags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentity.id}': {}
    }
  }
  properties: {
    environmentId: managedEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: acr.properties.loginServer
          identity: managedIdentity.id
        }
      ]
      secrets: [
        {
          name: 'applicationinsights-connection-string'
          value: appInsights.properties.ConnectionString
        }
        {
          name: 'github-token'
          keyVaultUrl: githubTokenSecret.properties.secretUri
          identity: managedIdentity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: effectiveApiImageName
          env: [
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              secretRef: 'applicationinsights-connection-string'
            }
            {
              name: 'OTEL_EXPORTER_OTLP_ENDPOINT'
              value: 'http://localhost:4318'
            }
            {
              name: 'CAPTURE_TRACE_CONTENT'
              value: 'false'
            }
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'PORT'
              value: '3000'
            }
            {
              name: 'GITHUB_TOKEN'
              secretRef: 'github-token'
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 3000
              }
              initialDelaySeconds: 30
              periodSeconds: 30
            }
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
        {
          name: 'otel-collector'
          image: 'otel/opentelemetry-collector-contrib:0.114.0'
          args: [
            '--config=env:OTEL_CONFIG'
          ]
          env: [
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              secretRef: 'applicationinsights-connection-string'
            }
            {
              name: 'OTEL_CONFIG'
              value: collectorConfig
            }
          ]
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 2
        rules: [
          {
            name: 'http-scale'
            http: {
              metadata: {
                concurrentRequests: '20'
              }
            }
          }
        ]
      }
    }
  }
  dependsOn: [
    acrPullAssignment
    keyVaultSecretsAssignment
  ]
}

output apiUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output applicationInsightsConnectionString string = appInsights.properties.ConnectionString
output applicationInsightsResourceId string = appInsights.id
output acrLoginServer string = acr.properties.loginServer
output keyVaultName string = keyVault.name
output logAnalyticsWorkspaceId string = logAnalytics.id
output managedIdentityClientId string = managedIdentity.properties.clientId

