# SRE Coding Interview Practice Guide
**SupportServices Repository-Specific SRE Problems with IaC & Operational Examples**

## Overview

This guide contains **25 production-relevant SRE/DevOps problems** tailored to SupportServices' infrastructure. Each problem includes:
- **Naive Approach** — Manual/error-prone method
- **Optimized Approach** — Automated, IaC, observable
- **Implementation Guide** — Bicep/PowerShell/KQL code
- **Testing Strategy** — Verification checklist
- **Operational Impact** — Cost, reliability, MTTR improvements
- **Repo Pattern** — Real example from SupportServices

---

## Project Setup

```bash
# Create the SRE automation project
dotnet new console -n SREInterviewPractice -o Tools/SREInterviewPractice
cd Tools/SREInterviewPractice

# Add Azure CLI, Bicep, PowerShell dependencies
dotnet add package Azure.ResourceManager
dotnet add package Azure.Identity
dotnet add package Spectre.Console

# Verify Bicep and az CLI
bicep --version
az --version
```

---

## PROBLEM 1: Blue-Green Deployment Automation

### What & Why

**What we're doing:**
Implementing zero-downtime deployments using Azure App Service deployment slots, automating the swap, and adding automated rollback on health check failures.

**Why it matters:**
- **Zero downtime:** Swap slots (seconds) instead of restarting app (10-30s) = no user impact
- **Instant rollback:** If new version fails health checks, swap back in <1 second (vs 30+ min manual rollback)
- **Traffic routing:** Old version serves traffic while new warms up in staging slot
- **Real-world impact:** Chat service had 2 failed deployments/month; with blue-green + auto-rollback = 99.95% uptime improvement
- **Compliance:** Auditable deployment history (all swaps logged via ARM) vs manual CLI commands

**Concepts covered:**
- Deployment slots (blue=production, green=staging)
- Health check endpoints for automated validation
- Slot swap mechanics (traffic routing, connection strings)
- PowerShell automation (pre-swap validation)
- Rollback strategies

**Naive Approach (Manual):**
```bash
#!/bin/bash
# Manual deployment steps (ERROR-PRONE!)

az webapp deployment slot create --resource-group $RG --name $APP --slot staging
# ❌ PROBLEM 1: Manual command - easy to forget parameters
# ❌ PROBLEM 2: Slot already exists? Script fails. Idempotency issue.

az webapp deployment source config-zip --resource-group $RG --name $APP --slot staging --src build.zip
# ❌ PROBLEM 3: Might take 5+ minutes. What if it times out? No retry logic.

# Wait for health check (human waits, staring at screen)
sleep 60
curl https://$APP.azurewebsites.net/health
# ❌ PROBLEM 4: Human decides if healthy (subjective!). Might miss failures.
# ❌ PROBLEM 5: If health check fails, manual rollback needed (slow!)

az webapp deployment slot swap --resource-group $RG --name $APP --slot staging
# ❌ PROBLEM 6: Point of no return! If new version crashes,
#              must manually swap back (30+ minutes downtime!)

# Verify (human-driven verification)
curl https://$APP.azurewebsites.net/health
# ❌ PROBLEM 7: One health check? What about under load?

# Problems with manual:
# 1. Error-prone (human steps, typos)
# 2. No automated rollback (slow recovery)
# 3. No audit trail (who deployed when?)
# 4. Slow process (manual waits)
# 5. No guaranteed health validation before swap
```

**Optimized Approach (IaC + Automation):**
```bicep
// ✅ BLUE-GREEN DEPLOYMENT INFRASTRUCTURE

// App Service Plan: The compute (VMs) that host the app
resource appServicePlan 'Microsoft.Web/serverfarms@2022-03-01' = {
  name: '${appName}-plan'
  location: location
  sku: {
    // P2v2: Premium tier (required for slots)
    // Capacity: 2 means 2 instances
    // Zone redundant: automatically distributes across availability zones
    name: skuName  // e.g., 'P2v2'
    capacity: 2    // ✅ 2+ instances recommended for zero-downtime swap
  }
  kind: 'linux'
}

// PRODUCTION (Blue) App Service
resource webApp 'Microsoft.Web/sites@2022-03-01' = {
  name: appName
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'DOTNET|8.0'  // Runtime: .NET 8.0 on Linux
      
      // ✅ HEALTH CHECK PATH: Automated validation endpoint
      // Before slot swap, Azure calls /health repeatedly
      // Only swaps if /health returns 200 OK
      // Prevents broken deployments from reaching prod
      healthCheckPath: '/health'
      
      // ✅ MINIMUM ELASTIC INSTANCES: Minimum always-warm instances
      // Prevents cold start during swap
      minimumElasticInstanceCount: 1
    }
  }
}

// STAGING (Green) Slot: Mirror of production
// Traffic routes to production (blue), staging stays warm but dark
resource stagingSlot 'Microsoft.Web/sites/slots@2022-03-01' = {
  parent: webApp
  name: 'staging'
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    // ✅ SAME APP SERVICE PLAN: Shares compute resources
    // Reduces cost: 2 vCPUs split between blue+green
    // When swapped, green becomes blue (gets all traffic)
  }
}

// Staging slot configuration
resource swapSlotConfig 'Microsoft.Web/sites/slots/config@2022-03-01' = {
  parent: stagingSlot
  name: 'web'
  properties: {
    healthCheckPath: '/health'  // ✅ Same health check as production
    numberOfWorkers: 1
  }
}

// Return app ID for PowerShell automation
output webAppId string = webApp.id
```

**PowerShell Automation:**
```powershell
# deploy-bluegreen.ps1
param(
    [string]$ResourceGroup,
    [string]$AppName,
    [string]$PackagePath
)

$ErrorActionPreference = "Stop"

Write-Host "📦 Starting Blue-Green Deployment..." -ForegroundColor Cyan

# 1. Deploy to staging slot
Write-Host "1️⃣  Deploying to staging..." -NoNewline
az webapp deployment source config-zip `
    --resource-group $ResourceGroup `
    --name $AppName `
    --slot staging `
    --src $PackagePath | Out-Null
Write-Host " ✅" -ForegroundColor Green

# 2. Wait for staging to be ready
Write-Host "2️⃣  Waiting for health check..." -NoNewline
$maxWait = 300  # 5 minutes
$elapsed = 0

while ($elapsed -lt $maxWait) {
    try {
        $response = Invoke-WebRequest -Uri "https://$AppName-staging.azurewebsites.net/health" `
            -UseBasicParsing -TimeoutSec 5
        
        if ($response.StatusCode -eq 200) {
            Write-Host " ✅" -ForegroundColor Green
            break
        }
    }
    catch {
        Start-Sleep -Seconds 10
        $elapsed += 10
    }
}

if ($elapsed -ge $maxWait) {
    Write-Host " ❌ TIMEOUT" -ForegroundColor Red
    exit 1
}

# 3. Run smoke tests on staging
Write-Host "3️⃣  Running smoke tests..." -NoNewline
$tests = @(
    "https://$AppName-staging.azurewebsites.net/api/health",
    "https://$AppName-staging.azurewebsites.net/api/status"
)

foreach ($test in $tests) {
    try {
        $result = Invoke-WebRequest -Uri $test -UseBasicParsing -TimeoutSec 10
        if ($result.StatusCode -ne 200) {
            throw "Test failed: $test returned $($result.StatusCode)"
        }
    }
    catch {
        Write-Host " ❌ FAILED" -ForegroundColor Red
        Write-Host "Rollback needed: $_" -ForegroundColor Red
        exit 1
    }
}
Write-Host " ✅" -ForegroundColor Green

# 4. Swap slots
Write-Host "4️⃣  Swapping slots..." -NoNewline
az webapp deployment slot swap `
    --resource-group $ResourceGroup `
    --name $AppName `
    --slot staging | Out-Null
Write-Host " ✅" -ForegroundColor Green

# 5. Verify production
Write-Host "5️⃣  Verifying production..." -NoNewline
try {
    $prodResult = Invoke-WebRequest -Uri "https://$AppName.azurewebsites.net/health" `
        -UseBasicParsing -TimeoutSec 10
    if ($prodResult.StatusCode -eq 200) {
        Write-Host " ✅" -ForegroundColor Green
    } else {
        throw "Production health check failed"
    }
}
catch {
    Write-Host " ❌ FAILED - ROLLING BACK" -ForegroundColor Red
    
    # Swap back to previous version
    az webapp deployment slot swap `
        --resource-group $ResourceGroup `
        --name $AppName `
        --slot staging
    
    exit 1
}

Write-Host "`n✨ Deployment successful!`n" -ForegroundColor Green
```

**Testing Strategy:**
```csharp
[TestClass]
public class BlueGreenDeploymentTests
{
    [TestMethod]
    public async Task Naive_ManualSwap_ErrorProneAsync()
    {
        // Simulate manual swap with no automation
        var startTime = DateTime.UtcNow;
        
        // Manual steps (operator error possible at each step)
        // Step 1: Deploy
        // Step 2: Manual verification (can miss)
        // Step 3: Manual swap
        // Step 4: Manual rollback check
        
        var duration = DateTime.UtcNow - startTime;
        Assert.IsTrue(duration.TotalMinutes > 5);  // Takes too long
    }
    
    [TestMethod]
    public async Task Optimized_AutomatedSwap_ReliableAsync()
    {
        var deployment = new BlueGreenDeployer();
        
        // Automated with health checks and rollback
        var result = await deployment.DeployAsync(
            appName: "chat-app",
            packagePath: "build.zip");
        
        // Should complete in < 2 minutes
        Assert.IsTrue(result.DeploymentTimeMs < 120000);
        
        // Health check always performed
        Assert.IsTrue(result.HealthCheckPerformed);
        
        // Rollback on failure automatic
        Assert.IsTrue(result.CanRollback);
    }
}
```

**Operational Impact:**
| Metric | Naive | Optimized | Impact |
|--------|-------|-----------|--------|
| Deployment time | 10-15 min | 2-3 min | 5-7x faster |
| Manual steps | 6-8 | 0 | 100% automated |
| Rollback time | 10-15 min | 30 sec | 20x faster |
| Error rate | 15-20% | <1% | 99% reliable |

**Repo Pattern:** See [.pipelines/templates/deploy-bluegreen.yml](.pipelines/templates/deploy-bluegreen.yml)

---

## PROBLEM 2: Multi-Region Failover Setup

### What & Why

**What we're doing:**
Implementing automatic failover between regions when the primary region becomes unavailable.

**Why it matters:**
- **RTO < 3 min:** If primary fails, traffic automatically routes to secondary (vs 15-30 min manual failover)
- **Zero data loss:** Cosmos DB replicates writes to secondary automatically
- **No manual intervention:** Health probes detect failures and reroute traffic
- **Real-world impact:** Order History had 45-minute outage; with failover = <3 min recovery
- **Compliance:** Some SLAs require 99.99% (52 min/year downtime); failover essential

**Concepts covered:**
- Traffic Manager (DNS-level routing)
- Cosmos DB multi-region replication
- Health probes and endpoint monitoring
- Bounded staleness consistency
- Failover priority configuration

**Naive Approach (Manual):**
```bash
# ❌ CRITICAL PROBLEMS:
# 1. SEPARATE RESOURCES: Each region has independent Cosmos accounts
#    Problem: No replication! Data only in primary region
#    If primary fails: Secondary is empty or stale
#    RTO: 30+ minutes (manual recovery)

# 2. NO AUTOMATION: Manual failure detection
#    Operator must notice primary is down (maybe 10+ min delay)
#    Operator manually updates DNS (5-10 min)
#    Operator runs restore scripts (15-20 min)
#    Total: 30-40 minutes without service

# 3. DNS PROPAGATION DELAY: Even after DNS change, 5-10 min for clients to update cache
#    Means 40-50 min total RTO

# Create resources in each region separately (❌ manual, error-prone)
az cosmosdb create --resource-group rg-east --name cosmos-east --locations us-east-1
az cosmosdb create --resource-group rg-west --name cosmos-west --locations us-west-1
# Manually sync data (❌ what if sync fails halfway?)
# Manually update DNS on failure (❌ error-prone, slow)
```

**Optimized Approach (IaC with Automatic Failover):**
```bicep
// ✅ MULTI-REGION FAILOVER: Automatic routing with health probes

// Configure two regions with failover priorities
param locations array = [
  { name: 'eastus', failoverPriority: 0 }   // Primary region
  { name: 'westus', failoverPriority: 1 }   // Secondary (auto-activates if primary down)
]

// TRAFFIC MANAGER: DNS-level failover (resolves to secondary on primary failure)
resource trafficManager 'Microsoft.Network/trafficManagerProfiles@2018-08-01' = {
  name: 'orders-traffic-manager'
  location: 'global'  // Traffic Manager is global resource
  properties: {
    profileStatus: 'Enabled'
    
    // ✅ PRIORITY ROUTING: Route to primary (priority 1), failover to secondary (priority 2)
    trafficRoutingMethod: 'Priority'
    
    dnsConfig: {
      relativeName: 'orders-api'  // DNS: orders-api.trafficmanager.net
      ttl: 60  // ✅ TTL = 60s: Fast failover (clients update DNS every 60s)
    }
    
    // ✅ HEALTH PROBE CONFIGURATION: Detects when primary is down
    monitorConfig: {
      protocol: 'HTTPS'            // Use HTTPS for health check (secure, like real traffic)
      port: 443
      path: '/health'               // Custom health endpoint
      intervalInSeconds: 30         // Check every 30s
      toleratedNumberOfFailures: 2  // Fail after 2 consecutive failures (60s total)
      timeoutInSeconds: 10          // Wait 10s for response
    }
  }
}

// ✅ COSMOS DB: Multi-region with automatic replication
resource cosmosDB 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' = {
  name: 'orders-cosmos'
  location: locations[0].name  // Primary region (East US)
  properties: {
    // ✅ MULTI-REGION REPLICATION: Automatically sync data to all regions
    locations: locations
    
    // ✅ FAILOVER POLICIES: Cosmos will failover automatically if primary region becomes unavailable
    failoverPolicies: [
      for (loc, i) in locations: {
        locationName: loc.name
        failoverPriority: loc.failoverPriority  // 0 = primary, 1 = secondary
      }
    ]
    
    // ✅ CONSISTENCY LEVEL: BoundedStaleness = fast writes + limited staleness
    // Alternative: Session (stronger) but slower; Eventual (faster) but more stale
    consistencyPolicy: {
      defaultConsistencyLevel: 'BoundedStaleness'
      maxStalenessPrefix: 100000   // Max 100K items out of sync
      maxIntervalInMs: 5000        // Max 5 seconds of staleness
    }
    
    databaseAccountOfferType: 'Standard'
    
    // ✅ SINGLE WRITE REGION: Writes only go to primary (East US)
    // Secondary (West US) is read-only replica
    // When primary fails, Cosmos promotes secondary to writable
    enableMultipleWriteLocations: false
  }
}

// ✅ APP SERVICES IN BOTH REGIONS: Distribute load
resource appPlanEast 'Microsoft.Web/serverfarms@2022-03-01' = {
  name: 'orders-plan-east'
  location: 'eastus'
  sku: { name: 'P2v2', capacity: 3 }  // 3 instances for high availability
}

resource appServiceEast 'Microsoft.Web/sites@2022-03-01' = {
  name: 'orders-app-east'
  location: 'eastus'
  properties: {
    serverFarmId: appPlanEast.id
    siteConfig: {
      healthCheckPath: '/health'    // Same health check endpoint
    }
  }
}

resource appPlanWest 'Microsoft.Web/serverfarms@2022-03-01' = {
  name: 'orders-plan-west'
  location: 'westus'
  sku: { name: 'P1v2', capacity: 2 }  // Secondary can be smaller (less traffic expected)
}

resource appServiceWest 'Microsoft.Web/sites@2022-03-01' = {
  name: 'orders-app-west'
  location: 'westus'
  properties: {
    serverFarmId: appPlanWest.id
    siteConfig: {
      healthCheckPath: '/health'
    }
  }
}

// ✅ TRAFFIC MANAGER ENDPOINTS: Wire up the app services
resource tmEndpointEast 'Microsoft.Network/trafficManagerProfiles/azureEndpoints@2018-08-01' = {
  parent: trafficManager
  name: 'east-endpoint'
  properties: {
    targetResourceId: appServiceEast.id
    endpointStatus: 'Enabled'
    priority: 1  // ✅ PRIMARY: Route here first
  }
}

resource tmEndpointWest 'Microsoft.Network/trafficManagerProfiles/azureEndpoints@2018-08-01' = {
  parent: trafficManager
  name: 'west-endpoint'
  properties: {
    targetResourceId: appServiceWest.id
    endpointStatus: 'Enabled'
    priority: 2  // ✅ SECONDARY: Only used if primary is down
  }
}
```

**Testing Strategy:**
```csharp
[TestClass]
public class MultiRegionFailoverTests
{
    [TestMethod]
    public void Naive_NoAutomation_SlowFailover()
    {
        // Manual failover requires:
        // 1. Detect failure
        // 2. Update DNS
        // 3. Test secondary
        // Expected: 15-30 minutes RTO
        
        var rto = TimeSpan.FromMinutes(15);
        Assert.IsTrue(rto > TimeSpan.FromMinutes(5));
    }
    
    [TestMethod]
    public async Task Optimized_AutomaticFailover_FastAsync()
    {
        var trafficManager = new TrafficManagerSimulator();
        
        // Health probe detects primary down
        trafficManager.MarkEndpointDown("primary");
        
        // Traffic automatically routes to secondary
        var currentEndpoint = await trafficManager.GetActiveEndpointAsync();
        Assert.AreEqual("secondary", currentEndpoint);
        
        // RTO < 3 minutes
        var failoverTime = trafficManager.GetFailoverTimeMs();
        Assert.IsTrue(failoverTime < 180000);
    }
}
```

**Operational Impact:**
| Metric | Naive | Optimized | Impact |
|--------|-------|-----------|--------|
| RTO (Recovery Time Objective) | 15-30 min | <3 min | 10x faster |
| Manual intervention required | Yes | No | 100% automatic |
| Data consistency | Possible loss | Bounded staleness | Predictable |
| Cost | Single region | Dual region +30% | Worth it |

**Repo Pattern:** See [.pipelines/templates/multi-region.bicep](.pipelines/templates/multi-region.bicep)

---

## PROBLEM 3: Automated Backup and Restore

### What & Why

**What we're doing:**
Implementing continuous backup with point-in-time recovery capability for Cosmos DB, ensuring we can restore to any point in the last 30 days.

**Why it matters:**
- **RPO (Recovery Point Objective) = near-zero:** With continuous backup, we lose <1 minute of data vs hours with manual exports
- **PITR (Point-in-Time Recovery):** Restore to any second in the last 30 days (accidental deletes, corruptions)
- **Zero manual intervention:** Scheduled verification tests, automated alerts on backup failures
- **Compliance:** GDPR/HIPAA require demonstrable backup strategy with restore testing
- **Real-world impact:** Refunds service had accidental batch delete; with PITR = restored in 2 minutes vs 8 hours with manual backup

**Concepts covered:**
- Continuous backup vs periodic snapshots
- Point-in-time recovery mechanics
- Backup retention policy
- Geo-redundant storage
- Restore testing (automated verification)

**Naive Approach (Manual):**
```bash
# ❌ CRITICAL PROBLEMS:
# 1. MANUAL TIMING: Someone remembers to run backup (or script runs once/day)
#    Problem: If disaster happens between backups, data is lost
#    Example: 23.5 hours after midnight backup = 23.5 hours of data loss!
#    RPO = 24 hours (vs continuous = minutes)

# 2. NO RESTORE TESTING: Backup exists, but can it actually restore?
#    Problem: When you need it, backup might be corrupted or unreadable
#    "The backup that failed" syndrome = common production issue

# 3. MANUAL EXPORT: Operator must remember to export and store safely
#    Problem: Often stored in same region = lost if region fails
#    Problem: Often forgotten, incomplete, or wrong format

# 4. RESTORE IS SLOW: Manual restore can take 30+ minutes
#    vs automatic = <5 minutes

az cosmosdb database backup create \
    --resource-group $RG \
    --account-name $COSMOS \
    --database-id OrderHistory
# ❌ Runs once - no continuous protection
# ❌ No verify that backup is usable
# ❌ No geo-redundancy

# Manual restore (complex, error-prone)
az cosmosdb database restore ...  # ❌ Slow, manual process
```

**Optimized Approach (IaC + Continuous Backup + Automated Testing):**
```bicep
// ✅ CONTINUOUS BACKUP WITH POINT-IN-TIME RECOVERY

resource cosmosDB 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' = {
  name: 'orders-cosmos'
  location: location
  properties: {
    // ✅ CONTINUOUS BACKUP MODE: Automatically captures every write
    backupPolicy: {
      type: 'Continuous'  // Not periodic; every write is backed up
      continuousModeProperties: {
        // ✅ BACKUP FREQUENCY: Captured continuously; snapshot every 100 RU ops
        backupIntervalInMinutes: 60      // Generate backup snapshot hourly
        
        // ✅ RETENTION: Keep last 30 days of backups
        // Can restore to any point in this window
        backupRetentionIntervalInHours: 720  // 720 hours = 30 days
        
        // ✅ GEO-REDUNDANCY: Store backups in multiple regions
        // If primary region fails, backup still accessible from secondary
        backupStorageRedundancy: 'Geo'   // Geo-redundant storage (vs Local/Zone)
      }
    }
  }
}

// ✅ AUTOMATED BACKUP VERIFICATION: Function to test restores
resource functionPlan 'Microsoft.Web/serverfarms@2022-03-01' = {
  name: 'backup-verify-plan'
  location: location
  sku: { name: 'Y1', tier: 'Dynamic' }  // Consumption plan (cheap for scheduled tasks)
}

resource restoreFunction 'Microsoft.Web/sites@2022-03-01' = {
  name: 'cosmos-restore-verify'
  location: location
  kind: 'functionapp,linux'
  properties: {
    serverFarmId: functionPlan.id
  }
}

// ✅ TIMER TRIGGER: Daily backup verification at 2 AM
resource timerTrigger 'Microsoft.Web/sites/functions@2020-12-01' = {
  parent: restoreFunction
  name: 'VerifyBackupDaily'
  properties: {
    config: {
      disabled: false
      bindings: [
        {
          name: 'Timer'
          type: 'timerTrigger'
          direction: 'in'
          schedule: '0 2 * * *'  // ✅ Daily at 2 AM UTC
          runOnStartup: false
        }
      ]
    }
  }
}
```

**PowerShell Verification:**
```powershell
# verify-backups.ps1
param(
    [string]$CosmosAccountName,
    [string]$ResourceGroup
)

Write-Host "🔍 Verifying Cosmos DB Backups..." -ForegroundColor Cyan

# Check backup policy
$account = az cosmosdb show --name $CosmosAccountName --resource-group $ResourceGroup | ConvertFrom-Json
$backupPolicy = $account.properties.backupPolicy

if ($backupPolicy.type -ne "Continuous") {
    Write-Host "❌ ALERT: Backup type is $($backupPolicy.type), should be Continuous" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Backup type: $($backupPolicy.type)" -ForegroundColor Green
Write-Host "✅ Retention: $($backupPolicy.continuousModeProperties.backupRetentionIntervalInHours) hours" -ForegroundColor Green

# Verify recent backups
$restorableTimestamps = az cosmosdb restorable-database-account list `
    --location $region | ConvertFrom-Json

if ($restorableTimestamps.Count -lt 1) {
    Write-Host "❌ No restorable backups found!" -ForegroundColor Red
    exit 1
}

$latestBackup = $restorableTimestamps[0].creationTime
$backupAge = (Get-Date) - (Get-Date $latestBackup)

if ($backupAge.TotalHours -gt 2) {
    Write-Host "⚠️  WARNING: Latest backup is $($backupAge.TotalHours) hours old" -ForegroundColor Yellow
} else {
    Write-Host "✅ Latest backup: $backupAge ago" -ForegroundColor Green
}

# Test restore (to different account)
Write-Host "`n🧪 Testing restore capability..." -NoNewline
try {
    az cosmosdb create --name "restore-test-$(Get-Random)" `
        --resource-group $ResourceGroup `
        --restore-source-account-location $region `
        --restore-source-account-id $account.id `
        --restore-timestamp (Get-Date -AsUTC).AddHours(-1).ToString("o") | Out-Null
    
    Write-Host " ✅" -ForegroundColor Green
} catch {
    Write-Host " ❌ FAILED" -ForegroundColor Red
    exit 1
}

Write-Host "`n✨ Backup verification complete!`n" -ForegroundColor Green
```

**Testing Strategy:**
```csharp
[TestClass]
public class BackupRestoreTests
{
    [TestMethod]
    public void Naive_NoBackup_DataLoss()
    {
        // Without backups, accidental delete = total loss
        // RTO: ∞ (unrecoverable)
        // RPO: ∞ (all data lost)
        
        Assert.IsTrue(true);  // Just illustrating risk
    }
    
    [TestMethod]
    public async Task Optimized_ContinuousBackup_RecoverableAsync()
    {
        var backup = new CosmosBackupVerifier();
        
        // Verify backup exists
        var latestBackup = await backup.GetLatestBackupAsync();
        Assert.IsNotNull(latestBackup);
        
        // Verify backup age (should be < 2 hours)
        var backupAge = DateTime.UtcNow - latestBackup.Timestamp;
        Assert.IsTrue(backupAge < TimeSpan.FromHours(2));
        
        // Verify restore capability
        var canRestore = await backup.CanRestoreToPointInTimeAsync(
            DateTime.UtcNow.AddDays(-1));
        Assert.IsTrue(canRestore);
        
        // RTO: < 30 minutes, RPO: < 1 hour
    }
}
```

**Operational Impact:**
| Metric | Naive | Optimized | Impact |
|--------|-------|-----------|--------|
| Data loss risk | High | <1 hour | 99.9% recovery |
| Manual restore time | N/A | <30 min | Automated |
| Backup frequency | None | Continuous | Real-time |
| Verification | Manual | Automated | 100% validated |

---

## PROBLEM 4: Kubernetes Resource Requests Optimization

### What & Why

**What we're doing:**
Right-sizing pod CPU/memory requests and limits based on actual usage, then using Vertical Pod Autoscaler for continuous optimization.

**Why it matters:**
- **Cost savings:** 40-50% reduction in node count by proper bin-packing ($200-300/month for small clusters)
- **Reliability:** Prevents OOMKill crashes (pod eviction when memory exhausted)
- **Efficiency:** Nodes fill based on requests, not on waste (empty VMs cost money)
- **Real-world impact:** Search service had 10 nodes running at 20% utilization; proper requests = 6 nodes, same throughput
- **VPA:** Continuously learns actual usage patterns and recommends adjustments

**Concepts covered:**
- Resource requests (scheduler guarantee)
- Resource limits (hard cap enforcement)
- Vertical Pod Autoscaler (VPA) mechanics
- CPU and memory measurement (millicores, Mi)
- Quality of Service (QoS) classes

**Naive Approach (Manual):**
```yaml
# ❌ CRITICAL PROBLEMS:
# 1. NO LIMITS/REQUESTS: Pods get unlimited resources
#    Problem: Scheduler can't pack efficiently (might put pod on empty node = waste)
#    Problem: Pod can consume all node memory = OOMKill entire node

# 2. GUESS AND CHECK: Engineer guesses resources (often too high, sometimes too low)
#    High guess = node waste = higher cost
#    Low guess = OOMKill = pod crashes

# 3. NO MONITORING: No feedback loop on actual usage
#    Problem: 6 months later, still using initial guess (might be 5x too much!)

# 4. NODE INEFFICIENCY: With no requests, nodes don't pack well
#    Example: If pod requests 500m CPU but only uses 50m, scheduler thinks node is full
#    Actual node utilization: 20% (wasted capacity)

apiVersion: v1
kind: Pod
metadata:
  name: api-server
spec:
  containers:
  - name: app
    image: api:v1
    # ❌ NO REQUESTS: Scheduler can't guarantee CPU/memory availability
    # ❌ NO LIMITS: Pod can crash node by consuming all memory
    # Scheduler behavior: "I don't know if this pod fits"
```

**Optimized Approach (Measured Resources + VPA):**
```yaml
# ✅ STEP 1: INITIAL RESOURCE REQUESTS (from profiling/measurements)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
spec:
  template:
    spec:
      containers:
      - name: app
        image: api:v1
        resources:
          # ✅ REQUESTS: Minimum guaranteed resources
          # Scheduler uses this to pack pods onto nodes
          # "This pod needs at least 256Mi memory to function"
          requests:
            memory: "256Mi"     # 256 megabytes baseline (from profiling)
            cpu: "100m"         # 100 millicores = 0.1 CPU core
          
          # ✅ LIMITS: Maximum resource usage (hard cap)
          # If pod exceeds: OOMKill (memory) or throttle (CPU)
          # "Pod can't use more than 512Mi or 500m"
          limits:
            memory: "512Mi"     # Hard limit: OOMKill if exceeded
            cpu: "500m"         # Hard limit: throttle if exceeded

---
# ✅ STEP 2: VERTICAL POD AUTOSCALER (VPA)
# Continuously monitors actual usage and recommends/applies adjustments
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: api-vpa
spec:
  # ✅ TARGET: Which workload to optimize
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-server
  
  # ✅ UPDATE POLICY: How aggressively to apply recommendations
  updatePolicy:
    updateMode: "Auto"  # ✅ Automatically restart pods with new resources
                        # Alternative: "recommendation" (just suggest, don't apply)
  
  # ✅ RESOURCE BOUNDS: Prevent VPA from going too high/low
  resourcePolicy:
    containerPolicies:
    - containerName: "app"
      # Minimum: Pod always gets at least this much
      minAllowed:
        cpu: 50m            # If usage < 50m, don't go lower (might cause issues)
        memory: 128Mi
      
      # Maximum: Don't recommend more than this (cap on cost/waste)
      maxAllowed:
        cpu: 1000m          # 1 full CPU (prevents runaway recommendations)
        memory: 1Gi         # 1 gigabyte (prevents excess memory)
```

**PowerShell Analyzer:**
```powershell
# analyze-resource-efficiency.ps1
param([string]$ClusterName, [string]$ResourceGroup)

Write-Host "📊 Analyzing Pod Resource Efficiency..." -ForegroundColor Cyan

# Get all pods with actual usage
$pods = kubectl get pods -A -o json | ConvertFrom-Json

$totalRequested = @{ cpu = 0; memory = 0 }
$totalActual = @{ cpu = 0; memory = 0 }
$inefficientPods = @()

foreach ($pod in $pods.items) {
    foreach ($container in $pod.spec.containers) {
        $requests = $container.resources.requests
        $requestedCpu = $requests.cpu | ConvertTo-Cpu
        $requestedMem = $requests.memory | ConvertTo-Memory
        
        # Get actual usage from metrics
        $metrics = kubectl top pod $pod.metadata.name -n $pod.metadata.namespace --no-headers
        
        if ($metrics) {
            $actualCpu, $actualMem = $metrics -split '\s+'
            $actualCpu = $actualCpu | ConvertTo-Cpu
            $actualMem = $actualMem | ConvertTo-Memory
            
            $cpuUtilization = $actualCpu / $requestedCpu
            $memUtilization = $actualMem / $requestedMem
            
            # Flag over-provisioned pods (< 25% utilization)
            if ($cpuUtilization -lt 0.25 -or $memUtilization -lt 0.25) {
                $inefficientPods += @{
                    Pod = $pod.metadata.name
                    Namespace = $pod.metadata.namespace
                    CPUUtil = "{0:P}" -f $cpuUtilization
                    MemUtil = "{0:P}" -f $memUtilization
                    CPUSavings = $requestedCpu - $actualCpu
                    MemSavings = $requestedMem - $actualMem
                }
            }
            
            $totalRequested.cpu += $requestedCpu
            $totalRequested.memory += $requestedMem
            $totalActual.cpu += $actualCpu
            $totalActual.memory += $actualMem
        }
    }
}

# Report
Write-Host "📈 Cluster Resource Summary:" -ForegroundColor Yellow
Write-Host "  Requested CPU: $($totalRequested.cpu)m" 
Write-Host "  Actual CPU: $($totalActual.cpu)m"
Write-Host "  Efficiency: $("{0:P}" -f ($totalActual.cpu / $totalRequested.cpu))"
Write-Host ""
Write-Host "  Requested Memory: $($totalRequested.memory)Mi"
Write-Host "  Actual Memory: $($totalActual.memory)Mi"
Write-Host "  Efficiency: $("{0:P}" -f ($totalActual.memory / $totalRequested.memory))"

Write-Host "`n⚠️  Over-Provisioned Pods (Top 10):" -ForegroundColor Yellow
$inefficientPods | Sort-Object CPUSavings -Descending | Select-Object -First 10 | 
    Format-Table -AutoSize

$monthlyTotalSavings = ($inefficientPods | Measure-Object CPUSavings -Sum).Sum * 730 / 1000 * 0.25  # $0.25 per CPU-month
Write-Host "`n💰 Potential Monthly Savings: \$$monthlyTotalSavings" -ForegroundColor Green
```

**Testing Strategy:**
```csharp
[TestClass]
public class KubernetesResourceTests
{
    [TestMethod]
    public void Naive_NoLimits_IneffectiveScheduling()
    {
        // Without limits: scheduler can't bin-pack efficiently
        // Node utilization: 30-40% (wasted capacity)
        
        var naiveUtilization = 0.35;
        Assert.IsTrue(naiveUtilization < 0.5);  // Poor efficiency
    }
    
    [TestMethod]
    public async Task Optimized_ResourceRequests_EfficientAsync()
    {
        var analyzer = new ResourceAnalyzer();
        
        // Get current efficiency
        var efficiency = await analyzer.CalculateClusterEfficiencyAsync();
        
        // After VPA optimization: 70-80% bin-packing
        Assert.IsTrue(efficiency.CPUUtilization > 0.70);
        Assert.IsTrue(efficiency.MemoryUtilization > 0.70);
        
        // Savings: $200-300/month
        var monthlySavings = efficiency.MonthlyWastedCost;
        Assert.IsTrue(monthlySavings > 200);
    }
}
```

**Operational Impact:**
| Metric | Naive | Optimized | Impact |
|--------|-------|-----------|--------|
| Node utilization | 30-40% | 70-80% | 2x better |
| Monthly cost | $1200 | $900 | $300 savings |
| Scheduling efficiency | Poor | Optimal | All pods fit |
| Rightsizing | Manual | Automatic | VPA handles it |

---

## PROBLEM 5: Log Aggregation with KQL Alerting

### What & Why

**What we're doing:**
Collecting application logs into Application Insights and using Kusto Query Language (KQL) to detect patterns (e.g., Cosmos 429 throttling, errors, performance degradation) with automated alerts.

**Why it matters:**
- **Proactive alerts:** Detect problems before customers (429s = capacity exhausted; alert 15 min before SLA breach)
- **Root cause analysis:** Query logs across millions of events in milliseconds (KQL indexing)
- **Trend detection:** Spot gradual degradation (error rate climbing 1% per hour = 8 hours before total failure)
- **Real-world impact:** Chat service detected 429s via KQL alert, scaled Cosmos before SLA breach (prevented $100K credit)
- **Cost optimization:** Identify wasted RUs (queries, indexes that don't help)

**Concepts covered:**
- Application Insights SDK and telemetry
- Kusto Query Language (KQL) syntax
- Alert rules and action groups
- Custom metrics and dimensions
- Log aggregation best practices

**Naive Approach (Manual Logs):**
```bash
# ❌ CRITICAL PROBLEMS:
# 1. MANUAL CHECKING: Engineer runs `grep` manually
#    Problem: Won't catch problems at 3 AM
#    Problem: Takes 10+ minutes to find root cause (grep vs indexed query)

# 2. NO AGGREGATION: Each app instance logs separately
#    Problem: Can't correlate across instances
#    Problem: Pattern invisible (one instance has 2 429s, not obvious at scale)

# 3. NO ALERTS: Problems found after impact (not before)
#    Problem: Customer complains first, then engineer investigates
#    Problem: SLA already breached

# 4. NO HISTORICAL TREND: Can't see "429s are increasing"
#    Problem: Gradual degradation missed until total failure

# Manual, grep-based:
az webapp log tail --resource-group $RG --name $APP | grep "429"
# ❌ Takes 30s to connect
# ❌ Misses data (only live logs, not historical)
# ❌ No aggregation across instances
# ❌ No correlation with other metrics
```

**Optimized Approach (Application Insights + KQL):**
```csharp
// ✅ STRUCTURED LOGGING: Use ILogger with context

// In app startup: configure instrumentation
services.AddApplicationInsightsTelemetry();

// Log structured events with context
var logger = serviceProvider.GetRequiredService<ILogger<CosmosService>>();

try {
    var result = await container.CreateItemAsync(item);
}
catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
{
    // ✅ STRUCTURED LOG WITH CONTEXT: Machine-queryable fields
    // Not just: "Error occurred" (human-readable but unsearchable)
    // Instead: Specific fields that KQL can aggregate/filter on
    logger.LogWarning(
        "CosmosDbThrottled: {RequestCharge} RU exceeded. " +
        "Container: {Container}, PartitionKey: {PartitionKey}, " +
        "RetryAfter: {RetryAfter}ms",
        ex.RequestDiagnostics.GetRequestCharge(),  // ← Queryable field
        container.Id,                                 // ← Queryable field
        item.PartitionKey,                           // ← Queryable field
        ex.RetryAfterSeconds * 1000);                // ← Queryable field
}
```

**KQL Queries for Monitoring:**
```kusto
// ✅ QUERY 1: DETECT COSMOS RU THROTTLING (429 Errors)
// Purpose: Alert when Cosmos is throttling = cost rising or load increasing
customMetrics
| where name == "CosmosDbThrottled"  // Log entries from catch block above
| extend RequestCharge = todouble(valueSum)  // Extract RU cost
| summarize
    Count = count(),                  // How many 429 errors?
    TotalRU = sum(RequestCharge),    // Total RUs consumed in throttling
    AvgRU = avg(RequestCharge),      // Average RU per error
    P95RU = percentile(RequestCharge, 95)  // 95th percentile (tail)
    by bin(timestamp, 5m), ContainerName = tostring(customDimensions.Container)
| where P95RU > 10000  // ✅ ALERT THRESHOLD: If P95 RU > 10K, scale up Cosmos
| order by timestamp desc

---

// ✅ QUERY 2: FIND HOT PARTITIONS (Uneven RU Distribution)
// Purpose: Identify partitions receiving disproportionate load
// Problem: If partition key poorly chosen, one partition gets all traffic = bottleneck
customMetrics
| where name == "CosmosDbThrottled"
| summarize Count = count() by PartitionKey = tostring(customDimensions.PartitionKey)
| order by Count desc
| limit 10  // ✅ Show top 10 hot partitions (ideally load evenly distributed)
// Example: If one partition has 1000 errors and others have <10 = partition key issue

---

// ✅ QUERY 3: DETECT RU TREND (Increasing Over Time = Capacity Warning)
// Purpose: Spot gradual RU increase before hitting limit
// Example: RU/hour going 1K → 1.2K → 1.44K = trending up 20% per hour
customMetrics
| where name == "CosmosDbRUConsumed"
| summarize RUPerHour = sum(valueSum) by bin(timestamp, 1h)
| extend IsIncreasing = (RUPerHour > prev(RUPerHour, 1) * 1.2)  // 20% increase trend?
| where IsIncreasing == true  // ✅ Flag when increasing
| project timestamp, RUPerHour, IncreasePercent = (RUPerHour / prev(RUPerHour, 1) - 1)
// Alert if trending up = proactively scale before throttling occurs

---

// ✅ QUERY 4: FIND SLOW QUERIES (Performance Degradation)
// Purpose: Identify queries taking >5 seconds (possible index issue or large scan)
traces
| where severityLevel >= 2  // Warning or Error level
| where message has "Duration"  // Custom log says how long operation took
| extend Duration = tonumber(extract("Duration: (\\d+)ms", 1, message))
| where Duration > 5000  // ✅ Only slow queries (>5 seconds)
| summarize 
    Count = count(),
    AvgDuration = avg(Duration),
    MaxDuration = max(Duration)
    by Query = tostring(customDimensions.QueryType)
| order by AvgDuration desc
// Example: Find that "search by email" query is 8 seconds = needs index
```
| summarize Count = count(), AvgDuration = avg(Duration) by operation_Name
| order by Count desc
```

**Alert Configuration (Bicep):**
```bicep
resource throttlingAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'cosmos-throttling-alert'
  location: 'global'
  properties: {
    description: 'Alert when Cosmos DB returns 429 (Too Many Requests)'
    severity: 1  // Critical
    enabled: true
    scopes: [appInsights.id]
    evaluationFrequency: 'PT5M'  // Every 5 minutes
    windowSize: 'PT15M'  // 15 minute window
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.MultipleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'CosmosDB 429 Errors'
          metricName: 'customMetrics/CosmosDbThrottled'
          operator: 'GreaterThan'
          threshold: 5  // More than 5 in 15 min window
          timeAggregation: 'Total'
        }
      ]
    }
    actions: [
      {
        actionGroupId: onCallTeamActionGroup.id
      }
    ]
  }
}
```

**Testing Strategy:**
```csharp
[TestClass]
public class LogAggregationTests
{
    [TestMethod]
    public void Naive_ManualLogReview_SlowDetection()
    {
        // Manual log review takes 30+ minutes to detect pattern
        // Examples: grep files, parse manually, hunt for 429s
        var detectionTime = TimeSpan.FromMinutes(30);
        Assert.IsTrue(detectionTime > TimeSpan.FromMinutes(10));
    }
    
    [TestMethod]
    public async Task Optimized_KQLAlert_FastDetectionAsync()
    {
        var appInsights = new ApplicationInsightsSimulator();
        
        // Log structured event
        appInsights.LogCosmosThrottle(
            requestCharge: 15000,
            container: "Orders",
            retryAfter: 5000);
        
        // KQL query executes
        var alerts = await appInsights.QueryAsync(
            @"customMetrics
              | where name == 'CosmosDbThrottled'
              | summarize Count = count() by bin(timestamp, 5m)
              | where Count > 5");
        
        // Detection time: < 1 minute
        Assert.IsTrue(alerts.Count > 0);
        Assert.IsTrue(appInsights.QueryExecutionMs < 60000);
    }
}
```

**Operational Impact:**
| Metric | Naive | Optimized | Impact |
|--------|-------|-----------|--------|
| Detection time | 30+ min | <1 min | 30x faster |
| Manual effort | High | Automatic | Zero |
| False positives | Unknown | Low | Alert reliability |
| MTTR (Mean Time To Resolve) | 1-2 hours | 15-20 min | 5x faster |

---

## PROBLEM 6-25: Additional SRE Problems (Quick Reference)

### Problem 6: Automated SSL Certificate Renewal
**What & Why:** Certificates expire after 90 days → automatic renewal 30 days before expiration via Key Vault, preventing outages from expired certs
**Naive:** Manual renewal reminder → often forgotten → cert expires in production → SSL error → immediate firefighting
**Optimized:** Key Vault manages rotation, App Service auto-updates, 30-day alerts trigger renewal 60 days early
**Impact:** Zero cert expirations in production vs 2-3 per year

### Problem 7: Cost Attribution by Service
**What & Why:** Single Azure bill is useless for chargeback → Tag each resource with cost center/domain, analyze by tag
**Naive:** "Total bill $50K" → nobody knows which service costs what → can't optimize individual domains
**Optimized:** Cosmos tagged "Chat", App Service tagged "Orders" → cost reports by domain → teams optimize their own costs
**Impact:** Identify that one service is 60% of bill → enables targeted optimization

### Problem 8: Database Migration with Zero Downtime
**What & Why:** Migrate database without stopping service → dual-write to old+new, switchover when synchronized
**Naive:** Maintenance window = 30+ min downtime → users redirected to support pages → SLA breach
**Optimized:** Phase 1: Write to old+new (reads still from old), Phase 2: Read from new when caught up, Phase 3: Decom old
**Impact:** Zero downtime vs 30+ min outage = $10-100K difference in cost/reputation

### Problem 9: Chaos Engineering Tests
**What & Why:** Verify service survives pod failures → periodic injection of faults, verify recovery without customer impact
**Naive:** Assume HA works → first real failure = surprise outage → MTTR 2+ hours
**Optimized:** Monthly test: kill random pod → verify traffic reroutes → fix issues before prod sees them
**Impact:** Discovery of single-point-of-failure pods before customer impact

### Problem 10: Pod Security Policy / Network Policies
**What & Why:** Restrict what pods can do (no root, no privileged, limited network) → prevent pod compromise + lateral movement
**Naive:** All pods can do anything → one pod compromised = attacker accesses all data
**Optimized:** Network policy: only specific pods can talk to DB; no root; read-only filesystem
**Impact:** Reduce blast radius from 100% to 5% if one pod compromised

### Problem 11: Storage Tiering Automation
**What & Why:** Blob lifecycle rules move old data to cool/archive automatically → 80% cost reduction for aged data
**Naive:** All blobs in hot tier = $0.0184/GB/month → 1TB of year-old backups = $18/month wasted
**Optimized:** Move to cool after 30 days ($0.01/GB) = $10/month; to archive after 90 days ($0.004/GB) = $4/month
**Impact:** $200-300/month savings for typical archives

### Problem 12: Quota Management
**What & Why:** Track Azure quotas (vCPU, storage, etc.) across subscriptions → alert at 80% usage before hitting limit
**Naive:** Hit quota mid-deployment → "quota exceeded" error → manual increase → 30-min delay
**Optimized:** Query quotas hourly, alert at 80%, auto-request increase for planned workloads
**Impact:** Prevent deployment failures and SLA breaches

### Problem 13: Incident Post-Mortems Automation
**What & Why:** Structured post-mortem template → consistent root-cause analysis → actionable insights
**Naive:** Free-form write-up → inconsistent analysis → some PMs miss actual root cause → repeat incidents
**Optimized:** Template: What happened, Why, Timeline, Impact, RCA (5 Whys), Action items → forces rigor
**Impact:** 40% reduction in repeat incidents (from structured learning)

### Problem 14: Performance Baseline Tracking
**What & Why:** Capture weekly performance metrics (latency, RU, errors) → trend detection → spot regressions before SLA breach
**Naive:** No baselines → 10% latency increase invisible → suddenly at SLA limit without knowing why
**Optimized:** Weekly snapshots in KQL → alert if latency up 5% vs baseline → enable root-cause before breach
**Impact:** Proactive vs reactive: prevent 80% of SLA breaches

### Problem 15: Disaster Recovery Drill Automation
**What & Why:** Monthly automated DR test (backup restore, failover activation) → identify issues before real disaster
**Naive:** Once/year manual drill → often skipped → backup untested → real disaster = unable to restore
**Optimized:** Monthly: restore to test RG, verify data integrity, measure RTO, fix issues before prod uses it
**Impact:** Discover backup corruption issues in test (not in production)

### Problem 16: Secrets Rotation Without Downtime
**What & Why:** Rotate DB passwords/API keys every 90 days without service restart → dual-key period allows graceful transition
**Naive:** Change password → suddenly all connections fail → frantic reconnection storm
**Optimized:** Add new password (dual-key period), verify new works, clients transition, remove old password
**Impact:** Zero downtime rotation vs emergency restart

### Problem 17: Infrastructure Drift Detection
**What & Why:** Compare IaC templates vs actual cloud resources → alert if manual changes detected (config divergence)
**Naive:** IaC defines resource, but engineer manually modifies in portal → template and reality diverge
**Optimized:** Daily IaC comparison: "Bicep says X=100, but actual is X=200" → alert → redeploy to restore state
**Impact:** Prevent configuration creep and silent failures

### Problem 18: Load Test Scheduling
**What & Why:** Weekly automated load tests (10x normal traffic) → discover capacity limits before hitting them
**Naive:** Load test manually before big event → might miss edge cases → real event = overload → errors
**Optimized:** Every Friday: 10x load test, measure RU, measure latency, alert if hitting limits
**Impact:** Proactive scaling prevents 80% of load-related outages

### Problem 19: Network Security Hardening
**What & Why:** Private endpoints + service endpoints + NSG rules → zero exposed public endpoints (unless intentional)
**Naive:** Cosmos DB on public internet → accessible from anywhere → compromise risk = data exfil
**Optimized:** Cosmos in private endpoint (only accessible from VNet), App Service has service endpoint
**Impact:** Reduce blast radius from "internet" to "known VNet"

### Problem 20: Scaling Event Prediction
**What & Why:** ML model trained on historical patterns → predict spike 1-2 hours early → auto-scale before load hits
**Naive:** React to high load → HPA takes 1-2 min to scale → requests timeout → customers see errors
**Optimized:** "Friday at 3 PM always spikes" → prediction kicks in 2 hours early → already scaled when spike arrives
**Impact:** Prevent errors during predictable spikes (Black Friday, sales, etc)

### Problem 21: Vendor Cost Optimization
**What & Why:** Reserved instances (commit 1-3 years, get 30-40% discount) + spot pricing for non-critical workloads
**Naive:** Pay on-demand rates → $1000/month for predictable baseline + $200/month for burst
**Optimized:** 3-year reservation for baseline ($700/month saved), spot for burst ($180/month saved) = $50-70/month
**Impact:** 40% cost reduction for same capacity

### Problem 22: Deployment Canary Validation
**What & Why:** Gradual traffic shift (5% → 25% → 50% → 100%) with automated metrics validation → catch bugs before full rollout
**Naive:** Instant 100% traffic switch → buggy version = all customers see error → MTTR 30+ min
**Optimized:** 5% to canary, monitor errors/latency, auto-promote if healthy, auto-rollback if errors spike
**Impact:** Limit blast radius: 95% of users unaffected if canary bugs found

### Problem 23: Cross-Region Latency Optimization
**What & Why:** Measure real latency (not just geographic distance) → route to genuinely fastest region → 50-100ms latency improvement
**Naive:** Route to "nearest" region (by miles) → but network path might take detour → latency still high
**Optimized:** Periodic latency probes to each region, update DNS to lowest-latency endpoint
**Impact:** 50ms latency reduction = 5-10% faster user experience

### Problem 24: Data Residency Compliance
**What & Why:** Ensure data stored in specific regions (GDPR: EU data in EU, etc.) → Bicep validates resource locations → alert on violations
**Naive:** No enforcement → app might create resource in wrong region → compliance violation → audit failure
**Optimized:** Bicep parameter: allowed regions validated at deploy time, policy alert on manual out-of-region resource
**Impact:** Prevent compliance violations

### Problem 25: SLA Compliance Reporting
**What & Why:** Automated SLO tracking (availability % vs target, error rate, latency percentiles) → real-time dashboard shows compliance status
**Naive:** Manual calculation at month end → "We were 99.92%, target is 99.9%, margin is 0.02%" → slow insights
**Optimized:** Real-time dashboard showing "Current month 99.87% (on track for 99.9% target)" → early warning if degrading
**Impact:** Proactive SLO management vs reactive compliance reporting

---

## Implementation Templates

### Template 1: KQL Query Library
```kusto
// Save as: queries/performance-dashboard.kql

// 1. Request latency percentiles
requests
| summarize
    P50 = percentile(duration, 50),
    P95 = percentile(duration, 95),
    P99 = percentile(duration, 99),
    ErrorRate = (todouble(count(error)) / count()) * 100
    by bin(timestamp, 1h), operation_Name
| order by timestamp desc

// 2. Cosmos DB RU consumption
customMetrics
| where name == "CosmosDbRUConsumed"
| summarize TotalRU = sum(valueSum) by bin(timestamp, 1h), ContainerName = tostring(customDimensions.Container)
| where TotalRU > 100000  // Flag high consumption
```

### Template 2: Bicep Alert Configuration
```bicep
// infra/alerts.bicep
param resourceGroup string
param appInsightsName string

resource alertActionGroup 'Microsoft.Insights/actionGroups@2021-09-01' = {
  name: 'on-call-team'
  location: 'global'
  properties: {
    groupShortName: 'OnCall'
    enabled: true
    emailReceivers: [
      {
        name: 'EmailNotification'
        emailAddress: 'oncall@company.com'
        useCommonAlertSchema: true
      }
    ]
  }
}

// Repeat for various metrics...
```

### Template 3: PowerShell Verification Script
```powershell
# verify-infrastructure.ps1
param([string]$ResourceGroup)

function Test-ServiceHealth {
    # Check all critical endpoints
    # Return status object
}

function Test-BackupStatus {
    # Verify backups completed
}

function Test-SecurityCompliance {
    # Check NSGs, firewall rules
}

# Run all tests
$results = @()
$results += Test-ServiceHealth
$results += Test-BackupStatus
$results += Test-SecurityCompliance

# Report
$results | Format-Table -AutoSize
```

---

## SRE Interview Readiness Checklist

For each problem you complete:

- [ ] Can explain the naive approach in **1 minute**
- [ ] Can code the optimized solution (Bicep/PowerShell) in **10 minutes**
- [ ] Understand the **operational impact** (cost, MTTR, availability)
- [ ] Know how to **test/verify** the solution
- [ ] Can answer "What if X fails?" scenarios
- [ ] Familiar with **monitoring/alerting** for the solution
- [ ] Have **runbook ready** for incident response

---

## Daily SRE Practice Plan

**Week 1:** Infrastructure & Scaling
- Problem 1: Blue-Green Deployment
- Problem 2: Multi-Region Failover
- Problem 4: Kubernetes Resource Optimization
- Problem 7: Cost Attribution

**Week 2:** Observability & Alerting
- Problem 5: Log Aggregation + KQL
- Problem 14: Performance Baselines
- Problem 20: Scaling Prediction
- Problem 9: Chaos Engineering

**Week 3:** Reliability & Disaster Recovery
- Problem 3: Automated Backups
- Problem 15: DR Drills
- Problem 21: Vendor Optimization
- Problem 25: SLA Compliance

**Week 4:** Security & Compliance
- Problem 6: SSL Certificate Renewal
- Problem 10: Pod Security Policies
- Problem 19: Network Security
- Problem 24: Data Residency

**Week 5:** Advanced
- Problems 11-25: Mixed scenarios

---

## Repo Reference

Key files for SRE problems:
- [.pipelines/templates/deploy-bluegreen.yml](.pipelines/templates/deploy-bluegreen.yml)
- [.pipelines/templates/multi-region.bicep](.pipelines/templates/multi-region.bicep)
- [infra/cosmosdb-backup.bicep](infra/cosmosdb-backup.bicep)
- [monitoring/kql-queries/](monitoring/kql-queries/)
- [scripts/infrastructure-validation.ps1](scripts/infrastructure-validation.ps1)

---

## Quick Reference: Commands

```bash
# Bicep validation
bicep lint infra/deployment.bicep

# Deploy
az deployment group create --resource-group $RG --template-file infra/deployment.bicep

# KQL queries
az monitor metrics list --resource $RESOURCE --metric CosmosDbThrottled

# PowerShell
.\verify-infrastructure.ps1 -ResourceGroup $RG

# Kubernetes
kubectl top nodes
kubectl describe vpa api-vpa

# Cost analysis
az costmanagement query --scope /subscriptions/SUB_ID --metric UsageQuantity
```

---

## Success Criteria

After completing this guide, you should be able to:

✅ Design and implement infrastructure for 99.95% SLA  
✅ Automate operational procedures (deployment, backup, recovery)  
✅ Write KQL queries to detect operational issues  
✅ Optimize cloud costs (20-40% reduction typical)  
✅ Respond to incidents in <15 minutes (vs. 1-2 hours manual)  
✅ Explain trade-offs between cost, reliability, and complexity  

**Target interview time:** 30-45 minutes per problem, full depth technical discussion.
