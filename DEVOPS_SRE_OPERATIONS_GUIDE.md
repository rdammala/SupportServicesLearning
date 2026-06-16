# DevOps/SRE Engineering Guide for SupportServices

**Purpose:** Comprehensive DevOps and SRE perspective on managing, scaling, and optimizing the SupportServices 13-domain monorepo in production.

**Audience:** DevOps engineers, SRE engineers, platform engineers, infrastructure architects, on-call engineers  
**Focus:** Deployment operations, monitoring, infrastructure, reliability, performance, cost, security, incident response  
**Coverage:** Practical recommendations, config changes, developer communication, operational runbooks

---

## Table of Contents

1. [Deployment Operations](#deployment-operations)
2. [Infrastructure & Scaling](#infrastructure--scaling)
3. [Monitoring & Observability](#monitoring--observability)
4. [Performance Optimization](#performance-optimization)
5. [Reliability & Disaster Recovery](#reliability--disaster-recovery)
6. [Security & Compliance](#security--compliance)
7. [Cost Optimization](#cost-optimization)
8. [Incident Response & Troubleshooting](#incident-response--troubleshooting)
9. [Developer Communication & Runbooks](#developer-communication--runbooks)
10. [Configuration Checklist](#configuration-checklist)

---

## Deployment Operations

### OneBranch Pipeline Optimization

**Current State (from CI/CD Guide):**
- Official pipelines: Manual approval for prod
- NonOfficial pipelines: Auto-deploy to dev
- Build + Deploy stages (gated progression)

**SRE Action Items:**

**1. Implement Blue-Green Slot Swapping (Already in Pipelines)**
```yaml
# Validate current deployment in .pipelines/deploy/shared-templates/SlotSwap.yml
- template: /.pipelines/templates/Deploy.SlotSwap.yml
  parameters:
    sourcePath: '$(Build.ArtifactStagingDirectory)'
    sourceSlot: 'staging'
    targetSlot: 'production'
    healthCheckTimeout: 300  # 5 minutes
    rollbackOnFailure: true
    
    # ✅ SRE Recommendation: Add pre-swap validation
    preSwapValidation:
      - name: 'HealthCheck'
        timeout: 30
        endpoint: '/health'
        expectedStatusCode: 200
      - name: 'SmokeTesting'
        timeout: 60
        tests: 'Chat.Frontend.Functional.Tests'
```

**2. Deployment Gating Configuration**
```
Environment Setup (SRE Controls):

Dev Environment:
  ├─ Auto-deploy from develop branch (NonOfficial)
  ├─ No approval gate
  ├─ Rollback on test failure: YES
  └─ Max deployment time: 15 minutes

Staging Environment:
  ├─ Auto-deploy from main branch (Official)
  ├─ Manual approval: YES (1 approver minimum)
  ├─ Smoke tests required: YES
  ├─ Rollback on failure: YES
  └─ Max deployment time: 30 minutes

Production Environment:
  ├─ Manual trigger only
  ├─ Manual approval: YES (2 approvers minimum)
  ├─ Security scanning required: YES (URSA)
  ├─ Compliance validation: YES
  ├─ Rollback on failure: YES
  ├─ Max deployment time: 45 minutes
  └─ Post-deployment monitoring: 5 minutes before marking success
```

**3. Deployment Failure Prevention**
```
Pre-Deployment Checklist (SRE runs before approval):

□ All tests passing in staging
□ No critical security vulnerabilities (URSA scan)
□ Cosmos DB provisioned throughput adequate
□ App Service plan capacity available
□ Key Vault secrets accessible
□ SSL certificates not expiring <7 days
□ Service dependencies healthy (Service Bus, Storage)
□ Database migration scripts validated
□ Configuration secrets in Key Vault (not committed)
□ Rollback plan documented
□ On-call engineer aware of deployment
```

**4. Domain Deployment Prioritization**
```
Deployment Order (by criticality):
1. Common (infrastructure, shared libraries)
2. Tokens (auth dependency)
3. Chat, Refunds, Search (high traffic)
4. Notifications (async non-blocking)
5. Others (low dependency)

Parallel Deployments:
├─ Can deploy Chat + Refunds simultaneously (no cross-dependency)
├─ Cannot deploy Notifications until Common/Tokens ready
└─ Validation: Run Tools/ValidateSolutions before each deploy

Deployment Window:
├─ Preferred: Tuesday-Thursday 2-4 PM UTC
├─ Avoid: Friday 2 PM - Monday 9 AM (weekend window)
└─ Emergency: Any time with on-call approval
```

---

### Monitoring Deployment Health

**Real-Time Dashboard Queries (KQL in Application Insights):**

**Deployment Failure Rate:**
```kusto
customMetrics
| where name == "deployment_status"
| summarize 
    total = count(),
    failed = sum(iff(value == 0, 1, 0)),
    success_rate = 100.0 * sum(iff(value == 1, 1, 0)) / count()
| where success_rate < 95  // Alert if <95%
```

**Slot Swap Success Rate:**
```kusto
customEvents
| where name == "SlotSwap"
| summarize 
    swaps = count(),
    successful = sum(iff(tostring(customDimensions.status) == "success", 1, 0)),
    failed = sum(iff(tostring(customDimensions.status) == "failed", 1, 0)),
    avg_duration_sec = avg(todouble(customDimensions.duration_ms)) / 1000
| extend success_rate = 100.0 * successful / swaps
```

**Post-Deployment Error Spike Detection:**
```kusto
requests
| where timestamp > ago(1h)
| summarize 
    errors_before = sum(iff(timestamp < ago(15m), iff(success == false, 1, 0), 0)),
    errors_after = sum(iff(timestamp >= ago(15m), iff(success == false, 1, 0), 0))
| extend error_increase_pct = 100.0 * (errors_after - errors_before) / errors_before
| where error_increase_pct > 25  // Alert if error spike >25%
```

---

## Infrastructure & Scaling

### Resource Sizing Strategy

**From Technology Stack Guide:**
- **App Service:** Premium P1v2 (1 core, 1.75GB RAM) minimum
- **Cosmos DB:** Auto-scale 4000-10000 RU/s per container
- **Service Bus:** Standard tier with auto-scaling
- **Azure Function:** Premium plan (always warm)

**SRE Recommendations:**

**1. Right-Sizing by Domain**
```
Domain         | App Service | Cosmos RU | Service Bus | Function Plan
Chat           | P2v2 (2x)   | 10K       | Standard    | Premium
Refunds        | P2v2 (2x)   | 8K        | Standard    | Premium
Search         | P2v2 (2x)   | 15K       | Standard    | Premium
Notifications  | P1v2 (1x)   | 4K        | Standard    | Premium (batch processing)
Others         | P1v2 (1x)   | 4K        | Standard    | Premium
```

**2. Auto-Scale Configuration (Bicep)**
```bicep
// Cosmos DB Auto-scale
resource cosmosContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: cosmosDatabase
  name: 'orders'
  properties: {
    resource: {
      id: 'orders'
      partitionKey: {
        paths: ['/customerId']
      }
      // ✅ Auto-scale: 4K-10K RU/s
      autoscaleSettings: {
        maxThroughput: 10000  // Max RU/s
      }
    }
  }
}

// App Service Auto-scale
resource appServiceAutoScaleRule 'Microsoft.Insights/autoscaleSettings@2015-04-01' = {
  name: '${appServicePlan.name}-autoscale'
  location: location
  properties: {
    enabled: true
    targetResourceUri: appServicePlan.id
    profiles: [
      {
        name: 'Scale up during high load'
        capacity: {
          minimum: '2'
          maximum: '10'
          default: '2'
        }
        rules: [
          {
            metricTrigger: {
              metricName: 'CpuPercentage'
              metricResourceUri: appServicePlan.id
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT5M'
              timeAggregation: 'Average'
              operator: 'GreaterThan'
              threshold: 70
            }
            scaleAction: {
              direction: 'Increase'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT5M'
            }
          }
        ]
      }
    ]
  }
}
```

**3. Capacity Planning (Quarterly Review)**
```
Metrics to Track:

App Service:
├─ Current CPU: < 50% (healthy)
├─ Memory: < 70% (healthy)
├─ Response time p95: < 500ms
└─ Instance count: Scale if p95 > 70% for 5 min

Cosmos DB:
├─ RU consumption: < 80% of provisioned (healthy)
├─ Throttling events (429): < 0.1%
├─ Query latency p99: < 100ms
└─ Storage: < 50 GB per container (before consider sharding)

Service Bus:
├─ Queue depth: < 10K messages (healthy)
├─ Processing latency: < 5 seconds p95
├─ Dead-letter messages: < 0.01%
└─ Topics/subscriptions: < 100 per namespace

Azure Function:
├─ Cold start: < 2 seconds
├─ Warm execution: < 100ms
├─ Error rate: < 0.5%
└─ Memory usage: < 80% of allocated
```

**4. Multi-Region Failover Setup**
```
Region Strategy:
├─ Primary: East US (main deployment)
├─ Secondary: West US (standby, passive)
└─ Database: Globally replicated (Cosmos read replicas)

Traffic Routing:
├─ Active-Passive: DNS failover via Azure Traffic Manager
├─ Failover threshold: Error rate > 10% for 2 minutes
├─ Automatic failover: YES for Cosmos DB (always-on)
└─ Manual failover: Services (requires approval)

Recovery Time Objective (RTO):
├─ Planned: 30 minutes
└─ Unplanned: 5 minutes (DNS TTL expires)

Recovery Point Objective (RPO):
├─ Cosmos DB: 0 (continuous replication)
├─ Storage: 1 hour (daily backup)
└─ Config: 1 hour (in Key Vault)
```

---

## Monitoring & Observability

### Central Observability Stack

**From Troubleshooting Guide:** Key metrics to monitor based on common failures.

**1. Application Insights Instrumentation (Mandatory)**

**Developer Checklist (SRE enforces):**
```
Every ASP.NET Core app MUST have:

□ Application Insights SDK: `services.AddApplicationInsightsTelemetry()`
□ Correlation ID: `var activityId = Activity.Current?.Id`
□ Request logging: ALL requests logged with method, path, status, duration
□ Exception telemetry: ALL exceptions logged with context
□ Custom events: Domain-specific business events (order created, refund processed)
□ Custom metrics: RU consumption (Cosmos), queue depth (Service Bus), latency (HTTP calls)
□ Sampling: 100% in dev, 10% in prod (adjust based on volume)
```

**Startup Configuration (appsettings.json):**
```json
{
  "ApplicationInsights": {
    "InstrumentationKey": "{Key from Key Vault}",
    "SamplingSettings": {
      "isEnabled": true,
      "maxTelemetryItemsPerSecond": 100,
      "evaluationIntervalInSeconds": 60,
      "initialSamplingPercentage": 100.0
    }
  }
}
```

**2. Key Metrics Dashboard (Azure Portal)**

**Create this dashboard for each domain:**

```
Real-Time Metrics (Update every 1 min):

Row 1: Health Overview
├─ Requests/sec (target: domain-specific baseline)
├─ Error rate % (alert if > 1%)
├─ P95 response time (alert if > target)
└─ Instance count (target: 2-10)

Row 2: Cosmos DB
├─ RU consumption (alert if > 80% of provisioned)
├─ 429 throttling errors (alert if > 0%)
├─ Query latency p99 (alert if > 100ms)
└─ Storage used (trend over time)

Row 3: Service Bus
├─ Queue/topic depth (alert if > 10K messages)
├─ Dead-letter messages (alert if > 10)
├─ Processing latency p95 (alert if > 5s)
└─ Error rate % (alert if > 0.5%)

Row 4: Dependencies
├─ HTTP calls to other services (latency p95)
├─ Database connections (alert if > pool size)
├─ Key Vault secrets access (success rate)
└─ Managed Identity token acquisition latency
```

**KQL Queries for Common Issues:**

**Query 1: Detect Cosmos DB Throttling (429 errors)**
```kusto
dependencies
| where type == "Cosmos DB" and resultCode == "429"
| summarize 
    throttle_count = count(),
    avg_duration = avg(duration),
    p99_duration = percentile(duration, 99)
    by bin(timestamp, 5m), operation_Name
| where throttle_count > 5  // Alert if more than 5 per 5 min
```

**Query 2: Identify Slow Database Queries**
```kusto
dependencies
| where type == "Cosmos DB"
| summarize 
    call_count = count(),
    avg_duration = avg(duration),
    p99_duration = percentile(duration, 99)
    by operation_Name
| sort by p99_duration desc
| where p99_duration > 100  // Alert if > 100ms
```

**Query 3: Service Bus Backlog Detection**
```kusto
customMetrics
| where name == "service_bus_queue_depth"
| summarize 
    avg_depth = avg(value),
    max_depth = max(value),
    min_depth = min(value)
    by bin(timestamp, 1m), tostring(customDimensions.queue_name)
| where max_depth > 10000  // Alert if backlog builds up
```

**Query 4: Memory Leak Detection**
```kusto
performanceCounters
| where name == "\\Memory\\Available Bytes"
| summarize 
    available_mb = avg(value) / 1024 / 1024
    by bin(timestamp, 5m)
| extend available_mb_prev = prev(available_mb)
| where available_mb < (available_mb_prev * 0.8)  // Alert if >20% drop
```

**3. Alert Configuration**

**Critical Alerts (Immediate notification):**
```
Alert Name                  | Condition              | Action
Error rate spike            | > 5% for 2 min        | Page on-call (SMS + call)
App Service down            | Response 503 > 1 min  | Page on-call (SMS + call)
Cosmos DB RU exhausted       | > 95% for 5 min       | Page on-call + page SRE
Service Bus queue backlog   | > 50K messages        | Page on-call
Production deployment fail  | Failed slot swap      | Page on-call + page SRE
Certificate expiration      | < 7 days              | Email team (non-urgent)
```

**Configure Alerts (in Application Insights):**
```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: supportservices-critical-alerts
spec:
  groups:
  - name: critical-alerts
    interval: 60s
    rules:
    
    - alert: ErrorRateSpike
      expr: |
        rate(requests_failed[5m]) > 0.05
      for: 2m
      annotations:
        summary: "Error rate spike detected ({{ $value | humanizePercentage }})"
        description: "Error rate exceeded 5% for 2 minutes"
    
    - alert: CosmosDBThrottling
      expr: |
        rate(cosmos_throttle_429[5m]) > 0
      for: 1m
      annotations:
        summary: "Cosmos DB 429 throttling detected"
        description: "{{ $value }} throttle errors in last minute"
    
    - alert: ServiceBusBacklog
      expr: |
        service_bus_queue_depth > 50000
      for: 5m
      annotations:
        summary: "Service Bus queue backlog ({{ $value }} messages)"
        description: "Queue depth exceeded 50K messages"
```

---

## Performance Optimization

### SRE Tuning Recommendations

**From Technology Stack & Troubleshooting Guides:**

**1. Database Performance Tuning**

**Cosmos DB Optimization:**
```
Issue: High RU consumption (> $1000/day per container)

Solutions (in order of impact):

1. Partition Key Optimization (Biggest impact: 3-5x savings)
   ├─ Current: Partition by customerId
   ├─ Analyze: hot partitions (>70% of traffic to 1 key?)
   ├─ If yes: Consider composite key (customerId + month)
   └─ Test: Run query load test; measure RU difference

2. Query Optimization (2-3x savings)
   ├─ Use projection: SELECT specific fields only
   ├─ Avoid cross-partition queries (filter by partition key)
   ├─ Add indexes on frequently filtered fields
   └─ Sample: See Troubleshooting Guide "N+1 Query Problem"

3. Caching Layer (1.5-2x savings)
   ├─ Implement Redis for hot data (products, user profiles)
   ├─ TTL: 1 hour for products, 30 min for user data
   ├─ Monitor cache hit rate (target > 80%)
   └─ Estimated savings: $200-500/month

4. Connection Pooling (1.2x savings)
   ├─ Singleton CosmosClient (not per-request)
   ├─ Use connection string with MaxConnectionsPerEndpoint=64
   ├─ Sample rate: 100ms per connection establishment (adds up)
   └─ Already done in Common/Azure/CosmosDb
```

**Bicep Configuration:**
```bicep
// Optimized Cosmos DB container
resource cosmosContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: cosmosDatabase
  name: 'orders'
  properties: {
    resource: {
      id: 'orders'
      
      // ✅ Composite partition key: no hot partition issue
      partitionKey: {
        paths: ['/customerId', '/createdMonth']
        kind: 'MultiHash'
      }
      
      // ✅ Indexes only on filtered fields
      indexingPolicy: {
        indexingMode: 'consistent'
        includedPaths: [
          { path: '/customerId/?', indexes: [{ kind: 'Hash', dataType: 'String' }] }
          { path: '/createdMonth/?', indexes: [{ kind: 'Hash', dataType: 'String' }] }
          { path: '/status/?', indexes: [{ kind: 'Hash', dataType: 'String' }] }
          { path: '/*' }  // Default: lazy index
        ]
        excludedPaths: [
          { path: '/largeBlob/*' }  // Skip binary data
        ]
      }
      
      // ✅ Auto-scale: adjust based on actual load
      autoscaleSettings: {
        maxThroughput: 8000  // Can adjust down if light load
      }
    }
  }
}
```

**2. HTTP Client Resilience (Already recommended in Troubleshooting)**

**Update Common/Http/Extensions/IHttpClientBuilderExtensions.cs:**
```csharp
public static IHttpClientBuilder AddResilientHttpClient(
    this IHttpClientBuilder builder,
    int maxRetries = 3,
    int timeoutSeconds = 10)
{
    // ✅ Retry policy with jitter (prevents thundering herd)
    var retryPolicy = Policy
        .Handle<HttpRequestException>()
        .Or<TimeoutRejectedException>()
        .WaitAndRetryAsync(
            retryCount: maxRetries,
            sleepDurationProvider: attemptNumber =>
            {
                var baseDelay = Math.Pow(2, attemptNumber);  // 2s, 4s, 8s
                var jitter = Random.Shared.Next(0, 1000) / 1000.0;  // 0-1s
                return TimeSpan.FromSeconds(baseDelay + jitter);
            },
            onRetry: (exception, timespan, retryCount, context) =>
            {
                logger.LogWarning(
                    "HTTP retry {RetryCount}/{MaxRetries} after {DelayMs}ms",
                    retryCount, maxRetries, timespan.TotalMilliseconds);
            });
    
    // ✅ Circuit breaker (prevent cascading failures)
    var circuitBreakerPolicy = Policy
        .Handle<HttpRequestException>()
        .CircuitBreakerAsync(
            handledEventsAllowedBeforeBreaking: 5,
            durationOfBreak: TimeSpan.FromSeconds(30),
            onBreak: (exception, duration) =>
            {
                logger.LogError(
                    "Circuit breaker opened for {Duration}s due to: {Message}",
                    duration.TotalSeconds, exception.Message);
            });
    
    // ✅ Timeout policy (prevent hangs)
    var timeoutPolicy = Policy.TimeoutAsync<HttpResponseMessage>(
        TimeSpan.FromSeconds(timeoutSeconds),
        TimeoutStrategy.Optimistic);
    
    var combinedPolicy = Policy.WrapAsync(retryPolicy, circuitBreakerPolicy, timeoutPolicy);
    builder.AddPolicyHandler(combinedPolicy);
    
    // ✅ Connection pooling (reduce overhead)
    builder.ConfigureHttpClientDefaults(http =>
    {
        http.AddStandardResilienceHandler();  // .NET 9+ default resilience
    });
    
    return builder;
}

// SRE Configuration (appsettings.json)
{
  "HttpClientSettings": {
    "MaxRetries": 3,
    "TimeoutSeconds": 10,
    "CircuitBreakerThreshold": 5,
    "CircuitBreakerDurationSeconds": 30,
    "ConnectTimeoutMs": 3000,
    "MaxConnectionsPerEndpoint": 64
  }
}
```

**3. Cache Implementation Pattern (Redis)**

**Bicep (Deploy Redis):**
```bicep
resource redisCache 'Microsoft.Cache/redis@2023-08-01' = {
  name: 'supportservices-${environment}'
  location: location
  sku: {
    name: 'Premium'  // 6GB, clustered, HA
    family: 'P'
    capacity: 1
  }
  properties: {
    enableNonSslPort: false  // SSL only
    minimumTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
    
    // ✅ Replication for high availability
    replicasPerMaster: 1  // Multi-region replication
    
    // ✅ Data persistence
    persistence: {
      aofEnabled: true
      aofFrequency: '1s'
    }
    
    // ✅ Backups (for disaster recovery)
    schedules: [
      {
        startHourUtc: 2
        frequencyInMinutes: 720  // Daily at 2 AM
      }
    ]
  }
}
```

**C# Usage Pattern:**
```csharp
// ✅ Cache layer for frequently accessed data
public class ProductCache
{
    private readonly IDistributedCache _cache;
    private readonly IProductRepository _repository;
    private const string CacheKeyPrefix = "product:";
    private const int CacheTtlSeconds = 3600;  // 1 hour
    
    public async Task<Product> GetProductAsync(string productId)
    {
        var cacheKey = $"{CacheKeyPrefix}{productId}";
        
        // Try cache first (99.9% hit rate on hot products)
        var cached = await _cache.GetStringAsync(cacheKey);
        if (!string.IsNullOrEmpty(cached))
        {
            return JsonSerializer.Deserialize<Product>(cached);
        }
        
        // Cache miss: fetch from Cosmos DB
        var product = await _repository.GetProductAsync(productId);
        
        // Store in cache (with TTL)
        await _cache.SetStringAsync(cacheKey, 
            JsonSerializer.Serialize(product),
            new DistributedCacheEntryOptions 
            { 
                AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(CacheTtlSeconds) 
            });
        
        return product;
    }
}

// SRE Metrics to monitor
{
  "CacheMetrics": {
    "HitRate": 0.95,         // 95% = healthy
    "EvictionRate": 0.01,    // 1% = acceptable
    "MemoryUsage": "3.2 GB",
    "TTL": 3600              // seconds
  }
}
```

---

## Reliability & Disaster Recovery

### High Availability Setup

**From Technology Stack Guide: Azure services already selected for HA**

**1. Multi-Zone Deployment**
```bicep
// App Service Premium v2 with Zone Redundancy
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: 'supportservices-${environment}'
  location: location
  sku: {
    name: 'P1v2'
    tier: 'PremiumV2'
    capacity: 3  // Min 3 for zone redundancy
  }
  kind: 'linux'
  properties: {
    zoneRedundant: true  // ✅ Spread across 3 zones (auto)
    reserved: true
  }
}

// Cosmos DB with Multi-Region Replication
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' = {
  name: 'supportservices-cosmos-${environment}'
  location: location
  properties: {
    
    // ✅ Single region (primary)
    locations: [
      {
        locationName: 'East US'
        failoverPriority: 0  // Primary
      }
      // Add secondary regions if needed for global read
      {
        locationName: 'West US'
        failoverPriority: 1  // Secondary
      }
    ]
    
    // ✅ Automatic failover enabled
    automaticFailoverEnabled: true
    
    // ✅ 99.99% SLA with multi-region
    databaseAccountOfferType: 'Standard'
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'  // Balanced consistency
      maxIntervalInSeconds: 5
      maxStalenessPrefix: 100000
    }
  }
}

// Storage with Zone-Redundant Storage (ZRS)
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'supportservices${environment}'
  location: location
  sku: {
    name: 'Standard_ZRS'  // ✅ Zone-redundant (3 zones)
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
  }
}
```

**2. Backup & Restore Strategy**

**Configure Automated Backups:**
```
Cosmos DB:
├─ Backup mode: Continuous (recovery to any point)
├─ Retention: 30 days
├─ Location: Geo-redundant
└─ RTO: 4 hours, RPO: < 1 minute

Storage Accounts:
├─ Replication: ZRS (zone redundancy)
├─ Backup schedule: Daily at 2 AM UTC
├─ Retention: 30 days
└─ RTO: 1 hour, RPO: 24 hours

App Service:
├─ Configuration backup: Daily
├─ Database snapshots: Every 6 hours
├─ Retention: 7 days
└─ Tested restore: Monthly
```

**Backup Bicep Template:**
```bicep
// Cosmos DB Continuous Backup
resource cosmosContinuousBackup 'Microsoft.DocumentDB/databaseAccounts/backupPolicies@2023-04-15' = {
  parent: cosmosAccount
  name: 'default'
  properties: {
    type: 'Continuous'
    continuousModeProperties: {
      tier: 'Continuous30Days'  // 30-day retention
    }
  }
}

// Storage Blob Backup (daily snapshots)
resource storageBackup 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    deleteRetentionPolicy: {
      enabled: true
      days: 30  // Keep deleted blobs for 30 days
    }
    containerDeleteRetentionPolicy: {
      enabled: true
      days: 7
    }
  }
}
```

**3. Disaster Recovery Drills**

**SRE Quarterly Checklist:**
```
Every Quarter, SRE Must Run:

□ Failover Test (non-prod first)
  ├─ Trigger manual failover to secondary region
  ├─ Verify all services come up
  ├─ Check data consistency
  └─ Measure RTO/RPO actual vs target

□ Restore Test
  ├─ Restore Cosmos DB from backup
  ├─ Restore storage from snapshot
  ├─ Verify application loads correctly
  └─ Document any issues

□ Communication Test
  ├─ Notify team of maintenance window
  ├─ Validate alerts trigger correctly
  ├─ Test escalation chain
  └─ Verify runbooks are accurate

□ Load Test Post-Recovery
  ├─ Run synthetic load test
  ├─ Verify performance matches baseline
  ├─ Check for data corruption
  └─ Document findings

Target: <2 hour duration, <1% traffic impact
```

---

## Security & Compliance

### Security Hardening

**From Technology Stack Guide: Security patterns already in place**

**1. Identity & Access Management**

**Configure Managed Identity (Bicep):**
```bicep
// App Service Managed Identity
resource appService 'Microsoft.Web/sites@2023-01-01' = {
  name: 'supportservices-${domain}-${environment}'
  location: location
  identity: {
    type: 'SystemAssigned'  // ✅ System-managed identity
  }
  properties: {
    serverFarmId: appServicePlan.id
  }
}

// Grant RBAC role to managed identity (Cosmos DB)
resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: cosmosAccount
  name: guid(cosmosAccount.id, appService.id, 'Contributor')
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '00000000-0000-0000-0000-000000000000')  // Cosmos DB Built-in Data Contributor
    principalId: appService.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
```

**C# Configuration (No connection strings in code):**
```csharp
// ✅ Using Managed Identity (no secrets needed)
public static IServiceCollection AddCosmosDb(this IServiceCollection services)
{
    var cosmosEndpoint = "https://supportservices-cosmos.documents.azure.com:443/";
    var cosmosClient = new CosmosClient(
        accountEndpoint: cosmosEndpoint,
        authKeyOrResourceToken: null,  // null = use managed identity
        clientOptions: new CosmosClientOptions()
        {
            ConnectionMode = ConnectionMode.Gateway
        });
    
    services.AddSingleton(cosmosClient);
    return services;
}
```

**2. Secrets Management**

**Configure Key Vault (SRE action):**
```
Secrets to Store:

├─ Database connection strings
├─ API keys for third-party services
├─ OAuth client secrets
├─ SSL/TLS certificates
├─ SSH keys for infrastructure
└─ Encryption keys for sensitive data
```

**Bicep Template:**
```bicep
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'supportservices-${environment}'
  location: location
  properties: {
    enabledForDeployment: true
    enabledForTemplateDeployment: true
    enabledForDiskEncryption: false
    
    // ✅ Soft delete (prevents accidental deletion)
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    
    // ✅ Purge protection (prevents purge)
    enablePurgeProtection: true
    
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    
    // ✅ Allow App Service managed identity to read secrets
    accessPolicies: [
      {
        tenantId: subscription().tenantId
        objectId: appService.identity.principalId
        permissions: {
          secrets: ['get', 'list']  // Read-only
          certificates: ['get', 'list']
          keys: []  // No key operations
        }
      }
    ]
  }
}
```

**3. Network Security**

**Configure Network Isolation (Bicep):**
```bicep
// ✅ Virtual Network for App Service
resource vnet 'Microsoft.Network/virtualNetworks@2023-05-01' = {
  name: 'supportservices-vnet'
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: ['10.0.0.0/16']
    }
    subnets: [
      {
        name: 'app-subnet'
        properties: {
          addressPrefix: '10.0.1.0/24'
          serviceEndpoints: [
            { service: 'Microsoft.Storage' }
            { service: 'Microsoft.Sql' }
            { service: 'Microsoft.CosmosDB' }
          ]
          delegations: [
            {
              name: 'delegation'
              properties: {
                serviceName: 'Microsoft.Web/serverFarms'
              }
            }
          ]
        }
      }
    ]
  }
}

// ✅ App Service Private Link
resource appServicePrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-05-01' = {
  name: 'app-pe'
  location: location
  properties: {
    subnet: {
      id: '${vnet.id}/subnets/app-subnet'
    }
    privateLinkServiceConnections: [
      {
        name: 'app-connection'
        properties: {
          privateLinkServiceId: appService.id
          groupIds: ['sites']
        }
      }
    ]
  }
}

// ✅ Network Security Group (firewall rules)
resource nsg 'Microsoft.Network/networkSecurityGroups@2023-05-01' = {
  name: 'supportservices-nsg'
  location: location
  properties: {
    securityRules: [
      {
        name: 'AllowHTTPS'
        properties: {
          protocol: 'Tcp'
          sourcePortRange: '*'
          destinationPortRange: '443'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: '*'
          access: 'Allow'
          direction: 'Inbound'
          priority: 100
        }
      }
      {
        name: 'DenyAll'
        properties: {
          protocol: '*'
          sourcePortRange: '*'
          destinationPortRange: '*'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: '*'
          access: 'Deny'
          direction: 'Inbound'
          priority: 200
        }
      }
    ]
  }
}
```

**4. Compliance Scanning**

**SRE Quarterly Tasks:**
```bash
# Run Azure Quick Review for compliance
azqr scan -s <subscription-id> -rg <resource-group>

# Check for:
├─ Encryption at rest/transit enabled
├─ RBAC least privilege configured
├─ Network security rules hardened
├─ Audit logging enabled
├─ Backup policies configured
└─ Certificate expiration < 30 days

# Fix non-compliant resources
azqr remediate -s <subscription-id> --auto-fix
```

---

## Cost Optimization

### FinOps Practices

**From Technology Stack Guide: Cost tracking per service**

**1. Cost Attribution Model**

```
Cost Breakdown (Monthly):

Infrastructure Costs:
├─ App Service Premium (3 instances): $600
├─ Cosmos DB (8K-10K RU/s auto-scale): $500
├─ Service Bus (Standard tier): $100
├─ Azure Functions (Premium plan): $200
├─ Storage (ZRS): $50
├─ Redis Premium: $400
├─ Key Vault: $2 (per transaction: 0.03 * 10K/month)
├─ Application Insights: $20
├─ Azure DevOps (pipelines): $50
└─ Total: ~$1,922 / month

Domain Attribution (based on traffic):
├─ Chat: 30% (~$576)
├─ Refunds: 25% (~$480)
├─ Search: 20% (~$384)
├─ Notifications: 15% (~$288)
├─ Others: 10% (~$192)

Per-Domain Cost Targets:
├─ Chat: < $600 (highest traffic)
├─ Refunds: < $500 (financial critical)
├─ Search: < $400 (heavy indexing)
└─ Others: < $200 each
```

**2. Cost Optimization Recommendations**

**Priority 1: Reduce Cosmos DB RU Consumption ($300-500/month savings)**
```
Actions:
├─ Implement Redis caching (reduces Cosmos queries by 30%)
├─ Optimize queries (N+1 fixes, projections)
├─ Right-size partition keys (avoid hot partitions)
├─ Adjust auto-scale max RU downward if baseline low
└─ Expected savings: $300-500/month
```

**Bicep Optimization:**
```bicep
// ✅ Before: Fixed 10K RU/s
resource cosmosContainerBefore 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  properties: {
    resource: {
      throughput: 10000  // Fixed cost
    }
  }
}

// ✅ After: Auto-scale 4K-6K (based on actual load)
resource cosmosContainerAfter 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  properties: {
    resource: {
      autoscaleSettings: {
        maxThroughput: 6000  // Lower max = lower cost
      }
    }
  }
}

// Estimated savings: 10K fixed → 6K average = $200-300/month
```

**Priority 2: Right-Size App Service ($200-300/month savings)**
```
Actions:
├─ Review P2v2 instances for low-traffic domains (downgrade to P1v2)
├─ Reduce minimum instance count (2→1 where load permits)
├─ Enable auto-scale to handle spikes (don't over-provision)
└─ Expected savings: $200-300/month

Review per domain:
├─ Chat: P2v2 × 3 (keep) - high traffic
├─ Refunds: P2v2 × 2 (downgrade 1?) - variable load
├─ Search: P2v2 × 2 (keep) - batch processing spikes
├─ Notifications: P1v2 × 1 (keep) - async, low CPU
└─ Others: P1v2 × 1 (keep)
```

**Priority 3: Eliminate Unused Resources ($100-200/month savings)**
```
Actions:
├─ Delete non-prod environments not used
├─ Consolidate staging/QA onto shared infrastructure
├─ Remove orphaned storage containers
├─ Clean up old app service plans
└─ Expected savings: $100-200/month
```

**3. Cost Monitoring Dashboard (KQL Queries)**

**Monthly Cost Trend:**
```kusto
billingData
| where toDateTime(usageDate) > ago(90d)
| summarize 
    total_cost = sum(cost),
    cosmos_cost = sum(iff(resourceType == "Microsoft.DocumentDB", cost, 0)),
    app_service_cost = sum(iff(resourceType == "Microsoft.Web", cost, 0)),
    storage_cost = sum(iff(resourceType == "Microsoft.Storage", cost, 0))
    by bin(toDateTime(usageDate), 1d)
| sort by toDateTime(usageDate) desc
```

**Cost per Domain:**
```kusto
billingData
| where toDateTime(usageDate) > ago(30d)
| extend domain = extract(@"supportservices-(\w+)", 1, resourceName)
| summarize cost_per_domain = sum(cost)
    by domain
| sort by cost_per_domain desc
```

---

## Incident Response & Troubleshooting

### On-Call Runbook

**From Troubleshooting Guide: Real issues documented**

**Incident Severity Matrix:**

```
Severity | Definition                      | Response Time | Escalation
---------|----------------------------------|---------------|------------------
P0       | All users affected, no workaround| 15 min page   | Immediate team + lead
P1       | Partial users or service degraded| 30 min page   | Team + manager
P2       | Single user or workaround exists | 2 hour email  | Next business day
P3       | Enhancement or low impact       | 24 hour email | Backlog
```

**Common Incidents (From Troubleshooting Guide):**

**Incident 1: Cosmos DB Throttling (429 Errors)**

**Symptoms:**
```
Alert: "429 Too Many Requests" errors > 0.1%
Impact: Slow order processing, customer complaints
Time to resolve: 5-10 minutes
```

**Runbook Steps:**
```
1. IMMEDIATE ACTIONS (< 5 minutes)
   □ Page SRE if not already paged
   □ Verify alert in Application Insights
   □ Check Cosmos DB metrics: RU consumption, hot partitions
   
2. DIAGNOSIS (< 10 minutes)
   □ Query: Check which container/operation is affected
     customMetrics
     | where name == "cosmosdb_request_charge"
     | summarize by operation_Name
     | sort by sum_value desc
   
   □ Determine if throughput limit or hot partition
     - If RU consumption < provisioned: Hot partition issue
     - If RU consumption > provisioned: Need more throughput
   
3. MITIGATION (< 20 minutes)
   Option A (Quick): Scale up provisioned RU
   - Edit Cosmos DB container throughput (max 20K RU)
   - Cost: ~$60/month per 1000 RU
   - Timeline: 5 minutes
   
   Option B (Longer): Reduce query load
   - Implement caching for hot data
   - Reduce sampling/monitoring overhead
   - Timeline: 30 minutes
   
4. ESCALATION
   If issue persists > 20 minutes:
   □ Contact Microsoft Support (Premier plan)
   □ Check for Cosmos DB service health
   □ Prepare rollback plan
   
5. POST-INCIDENT
   □ Document root cause (hot partition? traffic spike?)
   □ Schedule optimization work
   □ Update runbook if new learnings
```

**Incident 2: App Service High CPU (>80%)**

**Symptoms:**
```
Alert: CPU > 80% for 5 minutes
Impact: Slow response times, potential timeouts
Time to resolve: 10-15 minutes
```

**Runbook:**
```
1. IMMEDIATE (< 5 minutes)
   □ Check auto-scale: Did it add instances?
     az appservice plan show -g <rg> --name <plan> --query "numberOfSites"
   
   □ If auto-scale failed, manually scale:
     az appservice plan update -g <rg> --name <plan> --sku P2V2 --number-of-workers 4
   
2. DIAGNOSIS (< 10 minutes)
   □ Identify heavy operation in Application Insights
     requests
     | where success == false or duration > 1000
     | summarize count() by operation_Name
   
   □ Check if traffic spike or code leak
     - Traffic spike: Temporary, will resolve
     - Memory leak: Needs restart
   
3. MITIGATION
   - If leak: Restart app service (5 min downtime)
   - If spike: Increase instances (no downtime)
   
4. POST-INCIDENT
   □ Review code changes in last deploy
   □ Add memory/CPU profiling tests
   □ Consider lower alert threshold
```

**Incident 3: Service Bus Queue Backlog (>50K messages)**

**Symptoms:**
```
Alert: Queue depth > 50K for 10 minutes
Impact: Delayed async processing (notifications, analytics)
Time to resolve: 5-30 minutes
```

**Runbook:**
```
1. IMMEDIATE (< 5 minutes)
   □ Check processing rate: messages/sec
     metrics
     | where metric == "service_bus_processing_rate"
     | summarize avg_rate = avg(value)
   
   □ If rate < 100 msg/sec but backlog > 50K:
     Likely: Slow processing, not availability issue
     Action: Scale function app workers
   
2. DIAGNOSIS (< 10 minutes)
   □ Check function app error rate
     invocations
     | where error_code != ""
     | summarize by error_code
   
   □ If errors found: Fix code, redeploy
   □ If no errors: Check resource constraints (memory, CPU)
   
3. MITIGATION
   Option A: Scale function app
   az functionapp plan update -g <rg> --name <plan> --sku EP1 --number-of-workers 4
   
   Option B: Batch processing optimization
   - Increase batch size: 10 → 50 messages/batch
   - Reduces function invocations by 5x
   
4. RECOVERY
   Monitor queue depth: Should decrease 10K/min per worker
   If stuck: Restart function app
```

---

## Developer Communication & Runbooks

### Developer Best Practices (SRE Recommends)

**1. Deployment Readiness Checklist (For Developers)**

Before pushing to prod:
```
□ Code Quality
  ├─ Tests pass locally (100%)
  ├─ No compiler warnings (strict mode)
  ├─ Code style checks passed (dotnet format)
  └─ No hardcoded secrets (no API keys, credentials)

□ Performance
  ├─ No N+1 queries (use JOIN or batch)
  ├─ HTTP calls have timeout (10s max)
  ├─ No memory leaks (test long-running scenarios)
  └─ Async for I/O operations (don't block)

□ Observability
  ├─ Add custom events for business metrics
  ├─ Add custom metrics for performance
  ├─ Structured logging (not Console.WriteLine)
  └─ Exception handling with context

□ Resilience
  ├─ Implement retry logic for external calls
  ├─ Circuit breaker configured
  ├─ Graceful degradation (don't crash)
  └─ Timeout handling (not infinite waits)

□ Configuration
  ├─ All secrets in Key Vault (not in code)
  ├─ Environment-specific settings (appsettings)
  ├─ Feature flags for rollout control
  └─ Circuit breaker values tuned

□ Documentation
  ├─ README updated with setup steps
  ├─ API documentation (OpenAPI spec)
  ├─ Known issues/limitations documented
  └─ Deployment notes in PR description
```

**2. SRE Recommendations to Developers**

**For Cosmos DB Access:**
```
DO:
├─ Use connection pooling (singleton CosmosClient)
├─ Batch operations when possible
├─ Use partition key in queries
├─ Implement caching for hot data
└─ Monitor RU consumption per query

DON'T:
├─ Create new CosmosClient per request (huge overhead)
├─ Cross-partition queries without partition key
├─ Fetch all rows then filter in code (N+1)
├─ Ignore 429 errors (no retry logic)
└─ Store large blobs as documents (blob storage instead)

Configuration (appsettings.json):
{
  "CosmosDb": {
    "MaxConnectionsPerEndpoint": 64,
    "ConnectionMode": "Gateway",
    "RetryPolicy": {
      "MaxRetries": 3,
      "InitialBackoffMs": 100
    }
  }
}
```

**For HTTP Clients:**
```
DO:
├─ Use typed HttpClient from DI (IHttpClientFactory)
├─ Add timeout (10s max)
├─ Implement retry + circuit breaker
├─ Add correlation ID header
└─ Log request/response for debugging

DON'T:
├─ Use HttpClient as singleton or field
├─ No timeout (can hang forever)
├─ Unlimited retries (causes cascade)
├─ Log passwords/tokens
└─ Ignore HTTP 429 (backpressure signal)

Code:
public class OrderClient
{
    private readonly HttpClient _httpClient;
    
    public OrderClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
        _httpClient.Timeout = TimeSpan.FromSeconds(10);
    }
}
```

**For Logging:**
```
DO:
├─ Use structured logging with ILogger<T>
├─ Include context (user ID, order ID, etc.)
├─ Log at appropriate level (Info, Warn, Error)
└─ Use LoggerMessage for performance

DON'T:
├─ Use Console.WriteLine
├─ Log to files manually
├─ Log sensitive data (passwords, PII)
└─ Log every single line (noise)

Code:
_logger.LogInformation(
    "Order {OrderId} processed by {UserId} in {DurationMs}ms",
    orderId, userId, duration.TotalMilliseconds);
```

**3. SRE Weekly Communication**

**Email Template (Every Monday):**
```
Subject: Week {date} - Deployment Summary & Operational Health

Body:
---

DEPLOYMENTS LAST WEEK:
├─ Chat: v2.1.0 (Wed)
├─ Refunds: v1.8.2 (Thu)
└─ Success rate: 100%

INCIDENTS:
├─ P1 - Cosmos DB throttling (Tuesday 10-11 AM, 30 min, resolved)
├─ P2 - Memory spike (Wednesday, auto-scaled, no impact)
└─ Action items: Cache layer planned, quota review scheduled

METRICS:
├─ Uptime: 99.98%
├─ P95 latency: 245ms (target < 500ms)
├─ Error rate: 0.08% (target < 0.5%)
├─ Cost: $1,856 (target: $1,920)
└─ Cosmos DB: 7.2K RU/s avg (target: 8K max)

RECOMMENDATIONS FOR DEVELOPERS:
├─ Please implement caching for product lookups (reduces RU by 30%)
├─ Review Troubleshooting Guide: Slow Query Patterns
├─ Test timeout handling (we saw 3 hangs this week)
└─ Review appsettings.json structure in .NET guide

UPCOMING:
├─ Infrastructure upgrade: Thursday 2 PM (30 min maintenance window)
├─ Quarterly backup test: Next Tuesday
└─ Cost optimization review: Next week

Questions? Reply or DM on Teams.

--
SRE Team
```

---

## Configuration Checklist

### SRE Setup Verification

**New Environment Deployment (Pre-Production):**

```
INFRASTRUCTURE LAYER
├─ [ ] Virtual Network created with proper subnets
├─ [ ] Network Security Groups configured
├─ [ ] App Service Plan (Premium v2, zone redundant)
├─ [ ] Cosmos DB (multi-region replication)
├─ [ ] Storage Account (ZRS - zone redundant)
├─ [ ] Service Bus (Standard tier, auto-forward)
├─ [ ] Redis Cache (Premium, replication)
├─ [ ] Key Vault (soft delete + purge protection)
└─ [ ] CDN (for static content)

SECURITY LAYER
├─ [ ] Managed Identities assigned to all services
├─ [ ] RBAC roles configured (least privilege)
├─ [ ] Network Private Endpoints created
├─ [ ] NSG rules restricting inbound traffic
├─ [ ] SSL/TLS certificates installed
├─ [ ] Firewall rules on databases
├─ [ ] Key Vault access policies locked down
├─ [ ] Secrets rotated (passwords, API keys)
└─ [ ] Compliance scan passed

MONITORING LAYER
├─ [ ] Application Insights configured
├─ [ ] Custom metrics defined (RU, queue depth)
├─ [ ] Alerts set (P0, P1 severity)
├─ [ ] Dashboard created (health overview)
├─ [ ] Log Analytics workspace linked
├─ [ ] Audit logging enabled on databases
├─ [ ] Diagnostic settings on all services
└─ [ ] Retention policies (90 days logs, 7 years compliance)

PERFORMANCE LAYER
├─ [ ] Auto-scale configured (min/max instances)
├─ [ ] Cache layer (Redis) warmed up
├─ [ ] Connection pooling tested
├─ [ ] Query performance baseline established
├─ [ ] Load balancer configured
├─ [ ] CDN cache policies set
└─ [ ] Response time targets defined

BACKUP LAYER
├─ [ ] Cosmos DB backup policy enabled (continuous)
├─ [ ] Storage snapshots scheduled (daily)
├─ [ ] Backup retention 30 days
├─ [ ] Restore tested (successful recovery)
├─ [ ] Backup location geo-redundant
├─ [ ] Backup encryption enabled
└─ [ ] Restore runbook documented

DEPLOYMENT LAYER
├─ [ ] CI/CD pipeline configured
├─ [ ] Build gating enabled (tests pass)
├─ [ ] Deployment approvals required
├─ [ ] Artifact retention (30 days)
├─ [ ] Rollback procedure tested
├─ [ ] Blue-green slot swap enabled
├─ [ ] Health check endpoint created
└─ [ ] Post-deployment smoke tests automated

COST LAYER
├─ [ ] Budget alerts configured ($2,500/month)
├─ [ ] Cost allocation tags applied
├─ [ ] Reserved instances purchased (if applicable)
├─ [ ] Auto-shutdown for dev environments
├─ [ ] Unused resources identified
└─ [ ] Monthly cost review scheduled

COMPLIANCE LAYER
├─ [ ] Data classification complete
├─ [ ] Encryption at rest enabled
├─ [ ] Encryption in transit (TLS) enabled
├─ [ ] PII data location documented
├─ [ ] Data retention policies set
├─ [ ] GDPR compliance verified
├─ [ ] Audit logging enabled
├─ [ ] Compliance scan scheduled (quarterly)
└─ [ ] Incident response plan reviewed
```

---

### Monthly SRE Tasks

```
Week 1:
├─ [ ] Review deployment metrics (uptime, error rate)
├─ [ ] Update on-call runbooks
├─ [ ] Verify backups completed successfully
└─ [ ] Team sync: discuss incidents, learnings

Week 2:
├─ [ ] Capacity planning review (trending usage)
├─ [ ] Cost optimization analysis
├─ [ ] Security patch review (apply if needed)
└─ [ ] Update developer best practices guide

Week 3:
├─ [ ] Disaster recovery drill (test failover)
├─ [ ] Load testing (verify scaling works)
├─ [ ] Certificate expiration audit (< 30 days)
└─ [ ] Compliance scanning (azqr)

Week 4:
├─ [ ] Post-mortem on any P1 incidents
├─ [ ] Performance baseline update
├─ [ ] Infrastructure optimization review
└─ [ ] Team retrospective & planning
```

---

## Cross-Functional Communication Matrix

### Developer ↔ SRE Handoff

**When Developer Commits Code:**
```
Developer Responsibility:
├─ Code passes all tests
├─ No secrets in code
├─ Logging configured
├─ Resilience patterns implemented
└─ Performance validated

SRE Responsibility:
├─ Deployment infrastructure ready
├─ Monitoring alerting configured
├─ Rollback plan documented
├─ Capacity validated
└─ Security review passed
```

**When SRE Deploys to Production:**
```
Pre-Deployment (SRE):
├─ Request developer sign-off (if changes made)
├─ Verify all tests pass
├─ Confirm backup exists
├─ Notify dev team of window
└─ Brief on-call engineer

Post-Deployment (SRE):
├─ Monitor for 5 minutes
├─ Run smoke tests
├─ Verify monitoring alerts working
├─ Communicate status to team
└─ Document any issues

If Issues Found:
├─ Trigger rollback immediately
├─ Alert developer
├─ Post-mortem within 24 hours
└─ Update runbook
```

---

## Summary & Quick Reference

### SRE 30-Day Onboarding Plan

**Week 1: Infrastructure Understanding**
- [ ] Review Bicep templates for each service
- [ ] Understand deployment architecture (DevOps guide)
- [ ] Set up local dev environment
- [ ] Run through deployment manually

**Week 2: Monitoring & Observability**
- [ ] Create dashboards in Azure Portal
- [ ] Set up alerts (Application Insights)
- [ ] Learn KQL query language
- [ ] Practice reading logs

**Week 3: Incident Response**
- [ ] Review runbooks
- [ ] Shadow on-call engineer
- [ ] Practice incident response simulation
- [ ] Update runbooks based on learnings

**Week 4: Optimization & Cost**
- [ ] Review cost structure
- [ ] Identify optimization opportunities
- [ ] Plan performance improvements
- [ ] Present findings to team

---

### SRE Priorities (By Impact)

1. **Uptime (99.99% SLA)** — Faster than fixing bugs
2. **Performance (P95 < 500ms)** — User satisfaction critical
3. **Cost Efficiency ($1,920/month budget)** — Long-term sustainability
4. **Security (Zero breaches)** — Compliance & trust
5. **Scalability (10x traffic)** — Future-proof

---

**This guide enables SREs to manage SupportServices at production scale with confidence!**
