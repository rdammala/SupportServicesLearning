# SupportServices CI/CD Pipelines: Comprehensive Educational Guide

**Purpose:** This guide provides an in-depth understanding of how CI/CD pipelines are structured and executed in the SupportServices repository. It's designed for:
- Learning the architecture for building similar systems
- Interview preparation with concrete examples
- Understanding multi-domain monorepo pipeline patterns
- Building new repositories with professional CI/CD practices

**Last Updated:** January 2026  
**Scope:** All 13 domains (Chat, Refunds, Conversations, Search, Content, etc.)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Pipeline Organization](#pipeline-organization)
4. [Official vs NonOfficial Pipeline Model](#official-vs-nonofficial-pipeline-model)
5. [Build Pipeline Deep Dive](#build-pipeline-deep-dive)
6. [Deploy Pipeline Deep Dive](#deploy-pipeline-deep-dive)
7. [Shared Template Architecture](#shared-template-architecture)
8. [Bicep & Infrastructure Integration](#bicep--infrastructure-integration)
9. [Real-World Domain Examples](#real-world-domain-examples)
10. [Key Design Patterns](#key-design-patterns)
11. [Building a New Repository](#building-a-new-repository)
12. [Interview Key Concepts](#interview-key-concepts)

---

## Executive Summary

### The Big Picture

SupportServices is a **13-domain monorepo** using **Azure Pipelines with OneBranch** for CI/CD. The architecture separates concerns using:

- **Per-domain ownership** — each domain (`Chat`, `Refunds`, `Conversations`, etc.) owns its build and deploy pipelines
- **Layered templates** — thin per-domain YAML files delegate to reusable shared templates
- **Dual pipeline flavors** — Official (production) and NonOfficial (development/testing)
- **Infrastructure-as-Code** — Bicep templates for all Azure resources, version-controlled alongside code
- **Multi-environment progression** — `pmedev` → `pmeint` → `pmeflight` → `pmeprod` with approval gates

### Why This Matters

This architecture scales to **13+ independent teams**, each shipping independently while maintaining shared standards. It's battle-tested in production with:
- ✅ **Zero-downtime deployments** (blue-green slot swaps)
- ✅ **Gated environments** (dev/int are always-deploy; flight/prod require approval)
- ✅ **Automated testing** (functional tests run before production traffic)
- ✅ **Compliance tracking** (SDL scanning enforced in Official builds)
- ✅ **Fast iteration** (NonOfficial builds on every commit for rapid feedback)

---

## Architecture Overview

### High-Level Pipeline Flow

```
Developer writes code
    ↓
Push to master
    ↓
[NonOfficial] CI Pipeline Triggers
    ├─ Build code (dotnet build)
    ├─ Run tests
    ├─ Deploy to pmedev automatically
    └─ Done (~10-15 minutes)
    ↓
Code Review & Merge
    ↓
Manual Trigger [Official] Production Pipeline
    ├─ Build with SDL scanning
    ├─ Publish to artifact store
    └─ Trigger auto-deploy pipeline
    ↓
[Official] Deploy Pipeline Executes
    ├─ Deploy to pmedev (automatic)
    ├─ Deploy to pmeint (conditional: deployHigherEnv=true)
    ├─ Deploy to pmeflight (conditional, manual gate)
    └─ Deploy to pmeprod (conditional, manual gate)
    ↓
Production live (~30-60 minutes end-to-end)
```

### Repository Structure

```
SupportServices/
├── .pipelines/                          ← Shared pipeline infrastructure
│   ├── templates/                       ← Reusable YAML templates (32 files)
│   │   ├── Build.yml                    ← Main build orchestrator
│   │   ├── Build.DotNet.*.yml
│   │   ├── Deploy.Stage.Apps.yml        ← Main deploy orchestrator
│   │   ├── Deploy.Job.*.yml             ← Job-level templates
│   │   └── Deploy.Steps.*.yml           ← Step-level templates
│   ├── build/                           ← Root-level builds (OneBranch, Dashboard)
│   └── deploy/
│
├── Chat/                                ← Domain 1
│   ├── Chat.slnx                        ← Domain solution
│   ├── Frontend/                        ← Web API (ASP.NET Core)
│   ├── Backend/                         ← Function App (isolated worker)
│   ├── Storage/                         ← Data access layer
│   ├── Deploy/                          ← Bicep infrastructure
│   │   ├── env/
│   │   │   └── chat.bicep
│   │   └── params/
│   │       ├── chat.dev.bicepparam
│   │       ├── chat.int.bicepparam
│   │       └── chat.prod.bicepparam
│   └── .pipelines/                      ← Domain-specific CI/CD
│       ├── build/
│       │   ├── Build.Official.Chat.yml
│       │   ├── Build.NonOfficial.Chat.yml
│       │   └── Build.Template.Chat.yml
│       └── deploy/
│           ├── Deploy.Official.Chat.yml
│           ├── Deploy.NonOfficial.Chat.yml
│           └── Deploy.Template.Chat.yml
│
├── Refunds/                             ← Domain 2 (similar structure)
├── Conversations/                       ← Domain 3 (with sub-domains)
├── Search/                              ← Domain 4 (complex: includes indexer pipelines)
├── [... 8 more domains ...]
│
├── Common/                              ← Shared libraries (no pipelines)
│   ├── Common.slnx
│   ├── AspNetCore/
│   ├── AzureFunctions/
│   ├── Azure/
│   └── [... 40+ shared modules ...]
│
└── Docs/
    └── Conventions/
        └── CiCdPipelines.md             ← Pipeline documentation
```

### Key Architectural Principles

| Principle | Implementation | Benefit |
|-----------|-----------------|---------|
| **Single Responsibility** | Each template does one thing (Build, Deploy, Tests) | Easy to test, debug, and reuse |
| **Layered Templates** | Wrapper → Domain Template → Shared Templates | Zero duplication across 13 domains |
| **DRY (Don't Repeat Yourself)** | Common variables, parameters in Build.CommonVariables.yml | Changes propagate to all domains automatically |
| **Loose Coupling** | Domains only reference shared templates, not each other | Teams work independently |
| **Progressive Deployment** | Dev → Int → Flight → Prod with gates | Catch issues early, minimize prod risk |
| **Infrastructure as Code** | All Azure resources defined in Bicep, version-controlled | Reproducible, auditable, version history |
| **Fast Feedback** | NonOfficial builds CI on every commit | Developers get results in 10-15 minutes |
| **Compliance Tracking** | Official builds publish SDL results to TSA | Regulatory requirements met automatically |

---

## Pipeline Organization

### Folder Layout Convention

Every domain follows this exact structure:

```
<Domain>/.pipelines/
├── build/
│   ├── Build.Official.<Domain>.yml          # Production build wrapper
│   ├── Build.NonOfficial.<Domain>.yml       # Dev/CI build wrapper
│   └── Build.Template.<Domain>.yml          # Domain-specific build definition
└── deploy/
    ├── Deploy.Official.<Domain>.yml         # Production deploy wrapper
    ├── Deploy.NonOfficial.<Domain>.yml      # Dev deploy wrapper
    └── Deploy.Template.<Domain>.yml         # Domain-specific deploy definition
```

### Consistency Across Domains

**Build pipelines always:**
- Extend OneBranch (`v2/OneBranch.Official.CrossPlat.yml` or `NonOfficial` variant)
- Import shared variables from `Build.CommonVariables.yml`
- Delegate to shared `Build.yml` template
- Reference domain-specific `Build.Template.<Domain>.yml` for solutions/projects

**Deploy pipelines always:**
- Consume artifacts from their corresponding build pipeline
- Use `Deploy.Stage.Apps.yml` or `Deploy.Stage.AppGroup.yml` orchestrator
- Define service connections, Bicep templates, and app deployments for each environment
- Progress through environments sequentially with approval gates

**Real-World Consistency Check:**
```bash
# Compare pipeline structures across domains
ls Chat/.pipelines/build/
ls Refunds/.pipelines/build/
ls Notifications/.pipelines/build/

# Output is IDENTICAL (only domain names differ)
# Build.Official.<Domain>.yml
# Build.NonOfficial.<Domain>.yml
# Build.Template.<Domain>.yml
```

### Shared Template Library

**Location:** `.pipelines/templates/` at repo root

**32 templates total:**

**Build Templates (8):**
| Template | Responsibility |
|----------|-----------------|
| `Build.yml` | Orchestrates all build steps; the main entry point |
| `Build.DotNet.Use.yml` | Installs correct .NET SDK from global.json |
| `Build.DotNet.Build.yml` | Runs `dotnet restore` then `dotnet build` |
| `Build.DotNet.Publish.yml` | Runs `dotnet publish` for binaries |
| `Build.Copy.BicepFiles.yml` | Copies infrastructure code to output |
| `Build.Copy.Files.yml` | Generic file copy utility |
| `Build.CommonVariables.yml` | Shared pipeline variables (CDP_DEFINITION_BUILD_COUNT, debug flags) |
| `Build.CG.ExcludeNpmProjects.yml` | Component Governance npm exclusions |

**Deploy Templates (24):**
| Template Category | Responsibility |
|-------------------|-----------------|
| **Orchestrators** | `Deploy.Stage.Apps.yml` (per-package), `Deploy.Stage.AppGroup.yml` (grouped), `Deploy.Stage.yml` (generic wrapper) |
| **Job-Level** | `Deploy.Job.WebApp.yml`, `Deploy.Job.FuncApp.yml`, `Deploy.Job.Bicep.Sub.yml`, `Deploy.Job.Bicep.Group.yml`, `Deploy.Job.OpenApi.yml` |
| **Step-Level** | `Deploy.Steps.WebApp.CodeDeploy.yml`, `Deploy.Steps.WebApp.SlotSwap.yml`, `Deploy.Steps.FuncApp.CodeDeploy.yml`, `Deploy.Steps.ExportServiceConnectionVars.yml` |
| **Utility** | `Deploy.DotNet.Use.yml`, `Deploy.FunctionalTests.yml`, `Deploy.Steps.Cleanup.yml` |

---

## Official vs NonOfficial Pipeline Model

### Understanding the Two Flavors

This is a **critical concept** for building scalable multi-team systems.

#### NonOfficial Pipelines: Fast Developer Feedback Loop

**Purpose:** Validate code changes on every commit to master without bureaucratic overhead.

**Characteristics:**
- **Trigger:** CI trigger on `master` branch (auto-fires on push)
- **Path filtering:** Only triggers if `Common/**` or `<Domain>/**` changed
- **SDL scanning:** Report-only (doesn't block build)
- **Environments:** `pmedev` and `pmeint` only (never production)
- **Build time:** ~10-15 minutes
- **Who runs it:** Everyone, automatically

**Real-World Example — Notifications Domain:**
```yaml
# Notifications/.pipelines/build/Build.NonOfficial.Notifications.yml
trigger:
  branches:
    include:
      - master
  paths:
    include:
      - Common/**                    # Trigger if Common changes
      - Notifications/**             # Trigger if Notifications changes

extends:
  template: v2/OneBranch.NonOfficial.CrossPlat.yml@templates
  parameters:
    sdlBreakOnWarning: false         # Report-only; doesn't break build

stages:
  - template: Build.Template.Notifications.yml
```

**Deploy happens automatically after build completes:**
```yaml
# Notifications/.pipelines/deploy/Deploy.NonOfficial.Notifications.yml
resources:
  pipelines:
    - pipeline: artifactPipeline
      source: Build.NonOfficial.Notifications
      trigger: true                  # Auto-trigger on successful build

parameters:
  - name: deployHigherEnv
    default: false                   # Don't deploy to int/prod unless overridden
```

**Use case in workflow:**
1. Developer pushes to `master`
2. Within 2 minutes: NonOfficial build fires
3. Within 10 minutes: Artifact ready
4. Within 15 minutes: Deploy to `pmedev` completes
5. Developer can immediately test in dev environment

---

#### Official Pipelines: Production-Grade Quality Gates

**Purpose:** Production releases with compliance, security scanning, and manual approval.

**Characteristics:**
- **Trigger:** `trigger: none` — manual trigger or orchestration only
- **Commit approval:** Requires commit to be on approved/protected branch (master)
- **SDL scanning:** Full enforcement; breaks build on SDL failures
- **Environments:** `pmedev` → `pmeint` → `pmeflight` → `pmeprod`
- **Build time:** ~20-30 minutes (includes extra SDL scanning)
- **Who runs it:** Release managers, DevOps engineers
- **TSA integration:** Results published to Trust Services Automation

**Real-World Example:**
```yaml
# Chat/.pipelines/build/Build.Official.Chat.yml
trigger: none                           # Manual trigger only

extends:
  template: v2/OneBranch.Official.CrossPlat.yml@templates
  parameters:
    sdlBreakOnWarning: true             # BREAK on any security findings
    publishSymbols: true                # Symbol server publishing
    tsaEnabled: true                    # TSA compliance reporting

stages:
  - template: Build.Template.Chat.yml
```

**Deploy requires manual approval at higher environments:**
```yaml
# Chat/.pipelines/deploy/Deploy.Official.Chat.yml
resources:
  pipelines:
    - pipeline: artifactPipeline
      source: Build.Official.Chat
      trigger: true                     # Auto-trigger when build completes

parameters:
  - name: deployHigherEnv
    displayName: "Deploy To Higher Environments"
    type: boolean
    default: true

extends:
  template: Deploy.Template.Chat.yml
```

**Use case in workflow:**
1. Release manager manually queues build
2. Build runs with full SDL scanning (~25 minutes)
3. If any security issues found → build FAILS (no manual override)
4. Assuming success: Deploy automatically to `pmedev`
5. Manual approval gate required before `pmeflight` deployment
6. Another approval gate required before `pmeprod` deployment
7. All deployment happens within `pmeflight` approval environment

---

### Comparison Matrix

| Aspect | NonOfficial | Official |
|--------|------------|----------|
| **Trigger** | Auto on master push | Manual only |
| **Path Filters** | Yes (only affected domains) | N/A |
| **Commit Approval Required** | No | Yes (master branch only) |
| **SDL Scanning** | Report-only | Full enforcement |
| **Build Time** | ~10-15 min | ~20-30 min |
| **Allowed Environments** | pmedev, pmeint | pmedev, pmeint, pmeflight, pmeprod |
| **Use Case** | Daily development, rapid iteration | Production releases, compliance |
| **Failure Policy** | Report issues, don't block | FAIL build, block deployment |
| **Who Uses** | All developers, every commit | Release managers, planned releases |
| **TSA Integration** | No | Yes |

### Key Insight: Why Two Pipelines?

This dual-pipeline model solves a fundamental tension:

- **Problem:** Production requires strict security gates (SDL, compliance, approvals)
- **Problem:** Developers need fast feedback loops (10 minutes, not 30 minutes)
- **Solution:** Run two pipelines!
  - NonOfficial: Fast, permissive, for development
  - Official: Slow, strict, for production

Result: Developers get fast feedback in NonOfficial; releases follow strict gates in Official.

---

## Build Pipeline Deep Dive

### The Build Workflow: Step-by-Step

A build pipeline goes through these phases:

```
1. CHECKOUT CODE
   └─ OneBranch checks out repo at specific commit
   
2. PREPARE ENVIRONMENT
   ├─ Use correct .NET SDK (from global.json)
   └─ Set common variables (CDP_DEFINITION_BUILD_COUNT, etc)
   
3. BUILD & TEST
   ├─ Run dotnet restore (download NuGet packages)
   ├─ Run dotnet build (compile, warnings as errors)
   └─ Tests run automatically as part of build
   
4. PUBLISH BINARIES
   ├─ Run dotnet publish (create deployment packages)
   ├─ Web App: outputs to bin/Release/net10.0
   └─ Function App: outputs to bin/Release/net10.0/publish
   
5. SIGN ARTIFACTS
   ├─ Code sign .exe files
   ├─ Code sign .dll files
   ├─ Code sign .ps1 PowerShell scripts
   └─ Code sign .psm1 PowerShell modules
   
6. COPY INFRASTRUCTURE CODE
   ├─ Copy global.json (for deploy-time .NET compatibility)
   ├─ Copy Common/PowerShell (deployment automation)
   ├─ Copy Common/Bicep (shared infrastructure)
   ├─ Copy Domain/Deploy (domain-specific infrastructure)
   └─ Copy FunctionalTests projects (deploy-time testing)
   
7. UPLOAD ARTIFACT
   ├─ Everything copied to $(Build.SourcesDirectory)\out
   ├─ Published as "drop_build_main" to artifact store
   └─ Deploy pipeline consumes this artifact
```

### Examining the Build Template Layers

#### Layer 1: Official/NonOfficial Wrapper

**File:** `Chat/.pipelines/build/Build.Official.Chat.yml`

```yaml
name: $(Build.DefinitionName)_Branch_$(SourceBranchName)_$(Date:yyyyMMdd)$(Rev:.r)
# Result: "Build.Official.Chat_Branch_master_20250115.1"

trigger: none  # Manual trigger only (Official)

# For NonOfficial: 
# trigger:
#   branches:
#     include: [master]
#   paths:
#     include: [Common/**, Chat/**]

parameters:
  - name: "debug"
    displayName: "Enable debug output"
    type: boolean
    default: false

variables:
  - template: /.pipelines/templates/Build.CommonVariables.yml
    parameters:
      debug: ${{ parameters.debug }}
  - template: /.pipelines/templates/Build.CG.ExcludeNpmProjects.yml

resources:
  repositories:
    - repository: templates
      type: git
      name: OneBranch.Pipelines/GovernedTemplates
      ref: refs/heads/main

extends:
  template: v2/OneBranch.Official.CrossPlat.yml@templates  # or NonOfficial variant
  parameters:
    # OneBranch feature flags
    pool: Pool-Ubuntu-2004  # Run on Linux agents
    
    # SDL (Security Development Lifecycle) settings
    sdlBreakOnWarning: true           # Official: fail on SDL warnings
    tsaEnabled: true                  # Publish to TSA compliance system
    
    # Symbol publishing
    symbolsPublishing: true           # Publish symbols to symbol server
    symbolsPublishingShare: builds    # Symbol server share name
    
    # Stages to execute
    stages:
      - template: Build.Template.Chat.yml
```

**Key Concepts:**
- `extends:` — This file extends OneBranch (Microsoft's pipeline governance framework)
- `${{ parameters.debug }}` — YAML parameter substitution (evaluated at queue time)
- `template:` reference uses root-relative path (`/.pipelines/...`) for consistency
- OneBranch handles repo checkout, agent setup, artifact publishing automatically

#### Layer 2: Domain Build Template

**File:** `Chat/.pipelines/build/Build.Template.Chat.yml`

```yaml
# This template is referenced by both Official and NonOfficial wrappers.
# It defines WHAT to build but not HOW (that's in Build.yml).

stages:
  - template: /.pipelines/templates/Build.yml
    parameters:
      stageName: build
      
      # Which solutions to compile
      solutionsToBuild:
        - solutionPath: $(Build.SourcesDirectory)\Chat\Chat.slnx
      
      # Which projects to publish (create deployment packages for)
      projectsToPublish:
        - projectPath: Chat/Frontend/Frontend.csproj
        - projectPath: Chat/Backend/Backend.csproj
        - projectPath: Chat/Frontend.Functional.Tests/Frontend.Functional.Tests.csproj
      
      # Which folders to copy as deployment artifacts
      projectsToDeploy:
        - sourceFolder: Chat/Deploy          # Bicep infrastructure files
```

**Real-World Complexity:**

Different domains have different publish requirements:

```yaml
# Notifications: Simple (Frontend + Backend only)
projectsToPublish:
  - projectPath: Notifications/Frontend/Frontend.csproj
  - projectPath: Notifications/Backend/Backend.csproj

# Search: Complex (multiple indexers)
projectsToPublish:
  - projectPath: Search/Frontend/Frontend.csproj
  - projectPath: Search/Backend/Backend.csproj
  - projectPath: Search/Indexer/Indexer.csproj
  - projectPath: Search/SvaIndexer/SvaIndexer.csproj
  - projectPath: Search/Frontend.Functional.Tests/Frontend.Functional.Tests.csproj

# MessageFulfillment: Very complex (4 coordinated services)
projectsToPublish:
  - projectPath: MessageFulfillment/Frontend/Frontend.csproj
  - projectPath: MessageFulfillment/MessageBatcher/MessageBatcher.csproj
  - projectPath: MessageFulfillment/MessageSender/MessageSender.csproj
  - projectPath: MessageFulfillment/MessageTrigger/MessageTrigger.csproj
  - projectPath: MessageFulfillment/Frontend.Functional.Tests/Frontend.Functional.Tests.csproj
```

#### Layer 3: Shared Build Orchestrator

**File:** `.pipelines/templates/Build.yml`

This is the **core engine** that actually does the building:

```yaml
parameters:
  - name: stageName
    type: string
  - name: solutionsToBuild
    type: object
  - name: projectsToPublish
    type: object
  - name: projectsToDeploy
    type: object

stages:
  - stage: ${{ parameters.stageName }}
    displayName: "Build"
    jobs:
      - job: BuildJob
        displayName: "Build and Test"
        
        steps:
          # Step 1: Install .NET SDK
          - template: /.pipelines/templates/Build.DotNet.Use.yml
            parameters:
              globalJsonPath: $(Build.SourcesDirectory)/global.json
          
          # Step 2: Build all solutions
          - ${{ each solution in parameters.solutionsToBuild }}:
            - template: /.pipelines/templates/Build.DotNet.Build.yml
              parameters:
                solutionPath: ${{ solution.solutionPath }}
          
          # Step 3: Publish all projects
          - ${{ each project in parameters.projectsToPublish }}:
            - template: /.pipelines/templates/Build.DotNet.Publish.yml
              parameters:
                projectPath: ${{ project.projectPath }}
          
          # Step 4: Copy infrastructure files
          - template: /.pipelines/templates/Build.Copy.BicepFiles.yml
          
          # Step 5: Copy domain deploy folder
          - ${{ each folder in parameters.projectsToDeploy }}:
            - template: /.pipelines/templates/Build.Copy.Files.yml
              parameters:
                sourceFolder: ${{ folder.sourceFolder }}
                targetFolder: $(Build.SourcesDirectory)\out
          
          # Step 6: Sign all artifacts
          - task: onebranch.pipeline.signing@1
            displayName: "Sign Binaries"
            inputs:
              command: "sign"
              signType: "byShadesOfBlue"
              files: |
                $(Build.SourcesDirectory)\out\**\*.exe
                $(Build.SourcesDirectory)\out\**\*.dll
                $(Build.SourcesDirectory)\out\**\*.ps1
                $(Build.SourcesDirectory)\out\**\*.psm1
```

**Loop Syntax Explained:**

```yaml
# The ${{ each ... in parameters ... }} syntax iterates through arrays
# and generates steps for each item.

# For a domain with 2 solutions:
- ${{ each solution in parameters.solutionsToBuild }}:
  - template: Build.DotNet.Build.yml
    parameters:
      solutionPath: ${{ solution.solutionPath }}

# Gets expanded to:
- template: Build.DotNet.Build.yml
  parameters:
    solutionPath: $(Build.SourcesDirectory)\Chat\Chat.slnx
- template: Build.DotNet.Build.yml
  parameters:
    solutionPath: $(Build.SourcesDirectory)\Chat\ChatIndexer.slnx
```

### Build Variables and Common Configuration

**File:** `.pipelines/templates/Build.CommonVariables.yml`

```yaml
parameters:
  - name: debug
    type: boolean
    default: false

variables:
  # CDP (Customer Data Platform) tracking
  - name: CDP_DEFINITION_BUILD_COUNT
    value: $[counter(variables['Build.DefinitionName'], 0)]
  
  # Container/agent selection
  - name: WindowsContainerImage
    value: 'onebranch.azurecr.io/windows/ltsc2022/vse2022:latest'
  
  # Debug flag for verbose logging
  - name: SYSTEM_DEBUG
    value: ${{ parameters.debug }}
  
  # Publish symbols
  - name: SYMBOL_SERVER_ENABLED
    value: true
  
  # .NET build configuration
  - name: BuildConfiguration
    value: Release
  - name: BuildPlatform
    value: AnyCPU
```

**Why These Matter:**
- `CDP_DEFINITION_BUILD_COUNT` — Tracks build numbers for telemetry and diagnostics
- `WindowsContainerImage` — Ensures all builds run on the same base image (consistency)
- `SYSTEM_DEBUG` — Developers can enable verbose logging when debugging build issues

### Build Output Artifact

After a build completes successfully, Azure Pipelines publishes:

```
drop_build_main/
├── Chat/
│   ├── Frontend/
│   │   └── bin/Release/net10.0/
│   │       ├── publish/                 ← Deployed to App Service
│   │       ├── Chat.Frontend.dll
│   │       └── ...
│   ├── Backend/
│   │   └── bin/Release/net10.0/
│   │       ├── publish/                 ← Deployed to Function App
│   │       ├── Chat.Backend.dll
│   │       └── ...
│   └── Deploy/
│       ├── env/
│       │   └── chat.bicep               ← Infrastructure code
│       └── params/
│           ├── chat.dev.bicepparam
│           ├── chat.int.bicepparam
│           └── chat.prod.bicepparam
├── Common/
│   ├── Bicep/                           ← Shared infrastructure
│   └── PowerShell/                      ← Deployment automation
├── global.json                          ← .NET version lock
└── drop_build_main.zip                  ← Everything packaged
```

**What deploy pipelines do:** Download this artifact, extract it, and use the binaries + Bicep files to update infrastructure and roll out new code.

---

## Deploy Pipeline Deep Dive

### The Deploy Workflow: Multi-Environment Progression

```
Artifact Available (pmedev ready to deploy)
    ↓
STAGE: pmedev
    ├─ Bicep deployment (infrastructure)
    ├─ App deployment (code) to staging slot
    ├─ Functional tests against staging
    └─ Slot swap (staging → production)
    ↓
GATE: Approval required for pmeint (manual approval)
    ↓
STAGE: pmeint
    ├─ Bicep deployment (infrastructure)
    ├─ App deployment (code) to staging slot
    ├─ Functional tests against staging
    └─ Slot swap (staging → production)
    ↓
GATE: Approval required for pmeflight (manual approval)
    ↓
STAGE: pmeflight
    ├─ Bicep deployment (infrastructure)
    ├─ App deployment (code) to staging slot
    ├─ Functional tests against staging
    └─ Slot swap (staging → production)
    ↓
GATE: Approval required for pmeprod (manual approval)
    ↓
STAGE: pmeprod
    ├─ Bicep deployment (infrastructure)
    ├─ App deployment (code) to staging slot
    ├─ Functional tests against staging
    └─ Slot swap (staging → production)
    ↓
COMPLETE: New version live in production
```

### Deploy Pipeline Architecture

#### Layer 1: Official/NonOfficial Deploy Wrapper

**File:** `Chat/.pipelines/deploy/Deploy.Official.Chat.yml`

```yaml
name: $(Build.DefinitionName)_$(SourceBranchName)_$(Date:yyyyMMdd)$(Rev:.r)

trigger: none

# Consume build artifact
resources:
  pipelines:
    - pipeline: artifactPipeline
      source: Build.Official.Chat
      project: Xbox.CustomerExperiencesTeam
      trigger: true                       # Auto-trigger when build completes

parameters:
  - name: deployHigherEnv
    displayName: "Deploy To Higher Environments (Int/Flight/Prod)"
    type: boolean
    default: true                         # Deploy all the way to prod
  
  - name: skipBicepDeployment
    displayName: "Skip Bicep Deployment"
    type: boolean
    default: false                        # Always deploy infrastructure

extends:
  template: Deploy.Template.Chat.yml      # Delegate to domain template
  parameters:
    deployHigherEnv: ${{ parameters.deployHigherEnv }}
    skipBicepDeployment: ${{ parameters.skipBicepDeployment }}
    environments:
      - pmedev
      - pmeint
      - pmeflight
      - pmeprod
```

**For NonOfficial deploys:**

```yaml
# Chat/.pipelines/deploy/Deploy.NonOfficial.Chat.yml
trigger: none

resources:
  pipelines:
    - pipeline: artifactPipeline
      source: Build.NonOfficial.Chat      # Different source
      trigger: true

parameters:
  - name: deployHigherEnv
    default: false                         # Stop at pmeint unless overridden
  
extends:
  template: Deploy.Template.Chat.yml
  parameters:
    deployHigherEnv: ${{ parameters.deployHigherEnv }}
    environments:
      - pmedev
      - pmeint
      # Note: pmeflight and pmeprod omitted for NonOfficial
```

#### Layer 2: Domain Deploy Template

**File:** `Chat/.pipelines/deploy/Deploy.Template.Chat.yml`

This is where the **actual deployment strategy** lives:

```yaml
parameters:
  - name: deployHigherEnv
    type: boolean
  - name: environments
    type: object
  - name: skipBicepDeployment
    type: boolean
    default: false

variables:
  # Artifact consumed from build pipeline
  artifactDir: $(Pipeline.Workspace)/artifactPipeline/drop_build_main

stages:
  # Main orchestrator template
  - template: /.pipelines/templates/Deploy.Stage.Apps.yml
    parameters:
      environments: ${{ parameters.environments }}
      skipBicepDeployment: ${{ parameters.skipBicepDeployment }}
      
      # Dependency graph: pmeint depends on pmedev first, etc
      dependsOnEnv:
        pmedev: []                       # Deploy immediately
        pmeint: [pmedev]                 # Wait for pmedev
        pmeflight: [pmeint]              # Wait for pmeint
        pmeprod: [pmeflight]             # Wait for pmeflight
      
      # Approval gates
      conditions:
        pmedev: true                     # Always deploy to dev
        pmeint: ${{ parameters.deployHigherEnv }}
        pmeflight: ${{ parameters.deployHigherEnv }}
        pmeprod: ${{ parameters.deployHigherEnv }}
      
      # Azure authentication
      serviceConnections:
        pmedev: id-green-chat-azuredeploy-pme-nonprod
        pmeint: id-green-chat-azuredeploy-pme-nonprod
        pmeflight: id-green-chat-azuredeploy-pme-nonprod
        pmeprod: id-green-chat-azuredeploy-pme-prod
      
      # Infrastructure as Code
      bicepTemplate: Chat/Chat.Deploy/env/chat.bicep
      bicepParameters:
        pmedev: Chat/Chat.Deploy/params/chat.dev.bicepparam
        pmeint: Chat/Chat.Deploy/params/chat.int.bicepparam
        pmeflight: Chat/Chat.Deploy/params/chat.flight.bicepparam
        pmeprod: Chat/Chat.Deploy/params/chat.prod.bicepparam
      
      # Application packages to deploy
      packages:
        # Frontend web application
        - packageFolder: Chat.Frontend
          appType: webapp                 # Deploy as App Service
          apps:
            pmedev:
              - app: app-chat-frontend-pme-dev-wus
                resourceGroup: rg-chat-frontend-pme-dev
                slot: staging              # Deploy to staging slot first
            pmeint:
              - app: app-chat-frontend-pme-int-wus
                resourceGroup: rg-chat-frontend-pme-int
                slot: staging
            pmeflight:
              - app: app-chat-frontend-pme-flight-wus
                resourceGroup: rg-chat-frontend-pme-flight
                slot: staging
            pmeprod:
              - app: app-chat-frontend-pme-prod-wus
                resourceGroup: rg-chat-frontend-pme-prod
                slot: staging
        
        # Backend function application
        - packageFolder: Chat.Backend
          appType: funcapp                # Deploy as Function App
          apps:
            pmedev:
              - app: func-chat-backend-pme-dev-wus
                resourceGroup: rg-chat-backend-pme-dev
                slot: staging
            pmeint:
              - app: func-chat-backend-pme-int-wus
                resourceGroup: rg-chat-backend-pme-int
                slot: staging
            pmeflight:
              - app: func-chat-backend-pme-flight-wus
                resourceGroup: rg-chat-backend-pme-flight
                slot: staging
            pmeprod:
              - app: func-chat-backend-pme-prod-wus
                resourceGroup: rg-chat-backend-pme-prod
                slot: staging
```

**Key Deployment Concepts:**

1. **`packageFolder`** — Maps to build output folder (Chat.Frontend → Chat/Frontend/bin/Release/net10.0/publish/)
2. **`appType`** — Deployment target: `webapp` (App Service) or `funcapp` (Function App)
3. **`slot: staging`** — Deploy to staging slot first (blue-green deployment)
4. **`serviceConnections`** — Azure authentication per environment

#### Layer 3: Shared Deploy Orchestrator

**File:** `.pipelines/templates/Deploy.Stage.Apps.yml`

This generates the **stage structure** dynamically:

```yaml
parameters:
  - name: environments
    type: object
  - name: skipBicepDeployment
    type: boolean
  - name: dependsOnEnv
    type: object
  - name: conditions
    type: object
  - name: serviceConnections
    type: object
  - name: bicepTemplate
    type: string
  - name: bicepParameters
    type: object
  - name: packages
    type: object

stages:
  # Generate a stage for each environment
  - ${{ each env in parameters.environments }}:
    - template: /.pipelines/templates/Deploy.Stage.yml
      parameters:
        displayName: "Deploy to ${{ env }}"
        stageName: deploy_${{ env }}
        dependsOn: ${{ parameters.dependsOnEnv[env] }}
        condition: ${{ parameters.conditions[env] }}
        
        jobs:
          # Deploy infrastructure (Bicep)
          - ${{ if not(parameters.skipBicepDeployment) }}:
            - template: /.pipelines/templates/Deploy.Job.Bicep.Sub.yml
              parameters:
                displayName: "Deploy Bicep to ${{ env }}"
                serviceConnection: ${{ parameters.serviceConnections[env] }}
                bicepTemplate: ${{ parameters.bicepTemplate }}
                bicepParameters: ${{ parameters.bicepParameters[env] }}
          
          # Deploy each application package
          - ${{ each package in parameters.packages }}:
            - ${{ each app in package.apps[env] }}:
              - ${{ if eq(package.appType, 'webapp') }}:
                - template: /.pipelines/templates/Deploy.Job.WebApp.yml
                  parameters:
                    displayName: "Deploy ${{ package.packageFolder }} to ${{ app.app }}"
                    serviceConnection: ${{ parameters.serviceConnections[env] }}
                    packageFolder: ${{ package.packageFolder }}
                    appName: ${{ app.app }}
                    resourceGroup: ${{ app.resourceGroup }}
                    slot: ${{ app.slot }}
              
              - ${{ if eq(package.appType, 'funcapp') }}:
                - template: /.pipelines/templates/Deploy.Job.FuncApp.yml
                  parameters:
                    displayName: "Deploy ${{ package.packageFolder }} to ${{ app.app }}"
                    serviceConnection: ${{ parameters.serviceConnections[env] }}
                    packageFolder: ${{ package.packageFolder }}
                    appName: ${{ app.app }}
                    resourceGroup: ${{ app.resourceGroup }}
                    slot: ${{ app.slot }}
```

**This is powerful YAML templating:**
- Loops through environments: `${{ each env in parameters.environments }}`
- Loops through packages: `${{ each package in parameters.packages }}`
- Conditionally deploys Bicep: `${{ if not(parameters.skipBicepDeployment) }}`
- Conditionally uses WebApp vs FuncApp job: `${{ if eq(package.appType, 'webapp') }}`

Result: **One template generates the entire deployment pipeline** regardless of how many environments, packages, or apps a domain has.

### Slot Swapping: Zero-Downtime Deployment Pattern

One of the most important patterns in the deploy pipeline is **blue-green slot swapping**:

```
BEFORE:
  Production Slot (Blue)     Staging Slot (Green)
  ├─ Version: v1.0           ├─ [empty]
  ├─ Serving traffic         └─ Not serving traffic
  
DURING DEPLOYMENT:
  Production Slot (Blue)     Staging Slot (Green)
  ├─ Version: v1.0           ├─ Version: v2.0
  ├─ Serving traffic         └─ Code deployed here
  
AFTER TESTS PASS:
  Production Slot (Blue)     Staging Slot (Green)
  ├─ Version: v2.0           ├─ Version: v1.0
  ├─ Serving traffic         └─ [old version, can stop to save $]
```

**Implementation in `Deploy.Steps.WebApp.SlotSwap.yml`:**

```yaml
# Before swapping, run functional tests
- task: VSTest@3
  displayName: "Run Functional Tests"
  inputs:
    testAssemblyVer2: |
      **/*Functional.Tests.dll
    runInParallel: true

# If tests pass, swap slots
- task: AzureAppServiceManage@0
  displayName: "Swap Slots: Staging → Production"
  inputs:
    azureSubscription: ${{ parameters.serviceConnection }}
    action: "Swap Slots"
    appName: ${{ parameters.appName }}
    resourceGroup: ${{ parameters.resourceGroup }}
    sourceSlot: "staging"
    destSlot: "production"

# Optionally stop staging slot to save costs
- task: AzureAppServiceManage@0
  displayName: "Stop Staging Slot"
  inputs:
    azureSubscription: ${{ parameters.serviceConnection }}
    action: "Stop Azure App Service"
    appName: ${{ parameters.appName }}
    specifySlotOrASE: true
    resourceGroup: ${{ parameters.resourceGroup }}
    slotName: "staging"
```

**Benefits:**
- ✅ **Zero-downtime** — Swap is instant; no requests are dropped
- ✅ **Rollback capability** — If production breaks, swap back to previous version
- ✅ **Test confidence** — Full functional tests run before traffic switches
- ✅ **Cost optimization** — Stop staging slot between deployments

---

## Shared Template Architecture

### The Template Hierarchy

```
OneBranch (Microsoft's governance framework)
    ↓
    ├─ Build.Official.<Domain>.yml (thin wrapper)
    │  └─ Build.Template.<Domain>.yml (domain config)
    │     └─ Build.yml (shared orchestrator)
    │        ├─ Build.DotNet.Use.yml
    │        ├─ Build.DotNet.Build.yml
    │        ├─ Build.DotNet.Publish.yml
    │        ├─ Build.Copy.BicepFiles.yml
    │        └─ [... other build steps ...]
    │
    └─ Deploy.Official.<Domain>.yml (thin wrapper)
       └─ Deploy.Template.<Domain>.yml (domain config)
          └─ Deploy.Stage.Apps.yml (shared orchestrator)
             ├─ Deploy.Stage.yml (environment wrapper)
             │  ├─ Deploy.Job.Bicep.Sub.yml
             │  ├─ Deploy.Job.WebApp.yml (or FuncApp)
             │  └─ Deploy.FunctionalTests.yml
             │
             └─ Deploy.Job.*.yml (job implementations)
                ├─ Deploy.Steps.WebApp.CodeDeploy.yml
                ├─ Deploy.Steps.WebApp.SlotSwap.yml
                └─ [... other deploy steps ...]
```

### Why Layered Templates Matter

**Problem:** Without layering, each of 13 domains would need identical 50-line YAML files. Any change (new SDK version, new security scan) requires editing 13 files. ❌

**Solution:** Layered templates with 3 levels:

| Level | File Count | Responsibility | Change Impact |
|-------|-----------|-----------------|----------------|
| **Wrapper** (Thin) | 26 total (2 per domain) | OneBranch config, trigger setup | Domain-specific only |
| **Domain Template** | 26 total (2 per domain) | What to build/deploy | Single domain affected |
| **Shared Template** | 32 total (shared) | How to build/deploy | All domains benefit from improvements |

**Real-World Impact:**

To update the .NET SDK version for all 13 domains:
- ❌ **Without layering:** Edit 26 files manually
- ✅ **With layering:** Update `Build.CommonVariables.yml`, done! Propagates to all domains automatically

To add a new security scan:
- ❌ **Without layering:** Modify OneBranch in 26 wrapper files
- ✅ **With layering:** Modify OneBranch parameters once in layer 3, done!

### Deep Dive: Build.DotNet.Publish.yml

Let's examine a real shared template to understand the pattern:

```yaml
# .pipelines/templates/Build.DotNet.Publish.yml
parameters:
  - name: projectPath
    type: string

steps:
  - task: DotNetCoreCLI@2
    displayName: "Publish: ${{ parameters.projectPath }}"
    inputs:
      command: 'publish'
      arguments: |
        '${{ parameters.projectPath }}'
        --no-build
        --configuration $(BuildConfiguration)
        --output '$(Build.SourcesDirectory)\out\${{ parameters.projectPath }}'
      publishWebProjects: false

  - task: CopyFiles@2
    displayName: "Copy published files"
    inputs:
      sourceFolder: '$(Build.SourcesDirectory)\out\${{ parameters.projectPath }}\publish'
      contents: '**'
      targetFolder: '$(Build.SourcesDirectory)\out\${{ parameters.projectPath }}'
      cleanTargetFolder: true
```

**Key Points:**
- `${{ parameters.projectPath }}` — YAML parameter substitution (compile-time)
- `$(BuildConfiguration)` — Runtime variable substitution (runtime)
- Used by all domain build templates, but each domain calls it with different projects
- If we discover a new publish flag needed, we update here once → applies to all domains

### Template Parameters Pattern

All shared templates use **explicit parameters** for configuration:

```yaml
parameters:
  - name: solutionPath
    type: string
    description: "Path to .slnx file"
  
  - name: buildConfiguration
    type: string
    default: 'Release'
    values:
      - Release
      - Debug

# Usage in steps:
- script: dotnet build '${{ parameters.solutionPath }}' --configuration ${{ parameters.buildConfiguration }}
```

**Benefits:**
- ✅ Self-documenting — parameters describe what a template does
- ✅ Type-safe — `type: string`, `type: boolean`, `type: object`
- ✅ Validation — `values:` restricts allowed inputs
- ✅ Defaults — `default:` makes templates easy to use

---

## Bicep & Infrastructure Integration

### The Bicep Deployment Pattern

Bicep files are **version-controlled alongside code** and deployed as part of the pipeline:

```
Chat/Chat.Deploy/
├── env/
│   └── chat.bicep                    ← Main infrastructure template
└── params/
    ├── chat.dev.bicepparam          ← Dev environment values
    ├── chat.int.bicepparam          ← Int environment values
    ├── chat.flight.bicepparam       ← Flight environment values
    └── chat.prod.bicepparam         ← Prod environment values
```

### Two-Tier Deployment Strategy

SupportServices uses a **hierarchical deployment pattern**:

```
1. SUBSCRIPTION-LEVEL (runs once per deployment)
   ├─ Deploy envType infrastructure
   │  ├─ Storage accounts
   │  ├─ Service connections
   │  └─ Shared resources
   │
2. RESOURCE-GROUP-LEVEL (once per domain, per environment)
   ├─ Deploy domain-specific resources
   │  ├─ App Service plan
   │  ├─ Function App
   │  ├─ Database tables
   │  └─ Domain-specific storage
```

### Bicep Deployment Job Template

**File:** `.pipelines/templates/Deploy.Job.Bicep.Sub.yml`

```yaml
parameters:
  - name: displayName
    type: string
  - name: serviceConnection
    type: string
  - name: bicepTemplate
    type: string
  - name: bicepParameters
    type: string
  - name: location
    type: string
    default: 'westus3'

jobs:
  - job: DeployBicep
    displayName: ${{ parameters.displayName }}
    
    steps:
      # Install Bicep CLI
      - template: /.pipelines/templates/Steps.Bicep.InstallVersion.yml
        parameters:
          bicepVersion: '0.25.53'      # Pinned version for reproducibility
      
      # Run Bicep deployment
      - template: /.pipelines/templates/Steps.Bicep.Command.yml
        parameters:
          azureSubscription: ${{ parameters.serviceConnection }}
          command: 'stack sub create'
          bicepTemplate: ${{ parameters.bicepTemplate }}
          bicepParameters: ${{ parameters.bicepParameters }}
          location: ${{ parameters.location }}
```

### Real Example: Chat Infrastructure

**File:** `Chat/Chat.Deploy/env/chat.bicep`

```bicep
param location string = 'westus3'
param environment string = 'dev'
param version string = 'v1'

// App Service resources
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: 'asp-chat-${environment}-${location}'
  location: location
  sku: {
    name: environment == 'prod' ? 'P1V2' : 'B1'
  }
  properties: {
    reserved: true
  }
}

resource frontendApp 'Microsoft.Web/sites@2023-01-01' = {
  name: 'app-chat-frontend-${environment}-${location}'
  location: location
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|7.0'
      minTlsVersion: '1.2'
    }
  }
}

// Storage for data persistence
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'stchat${environment}${location}'
  location: location
  kind: 'StorageV2'
  sku: {
    name: environment == 'prod' ? 'Standard_GRS' : 'Standard_LRS'
  }
  properties: {
    accessTier: 'Hot'
  }
}

// Output resource IDs for use in deploy steps
output frontendAppId string = frontendApp.id
output storageAccountId string = storageAccount.id
```

**File:** `Chat/Chat.Deploy/params/chat.dev.bicepparam`

```bicep
using './env/chat.bicep'

param location = 'westus3'
param environment = 'dev'
param version = 'v1'
```

**File:** `Chat/Chat.Deploy/params/chat.prod.bicepparam`

```bicep
using './env/chat.bicep'

param location = 'westus3'
param environment = 'prod'           // Use prod SKUs
param version = 'v1'
```

### Infrastructure as Code Benefits

| Benefit | Implementation |
|---------|-----------------|
| **Reproducibility** | Same Bicep + params = identical infrastructure every time |
| **Version Control** | Bicep files tracked in Git; every change has commit history |
| **Auditability** | Can see exactly what infrastructure changed in each deployment |
| **Rollback** | Revert infrastructure by checking out previous commit |
| **Testing** | Test infrastructure changes in dev before prod |
| **Documentation** | Bicep serves as live documentation of infrastructure |

---

## Real-World Domain Examples

### Example 1: Notifications (Simple Domain)

**Profile:** Single Frontend + Backend, straightforward deployment

**Build Pipeline:**
```yaml
# Notifications/.pipelines/build/Build.Template.Notifications.yml
projectsToPublish:
  - projectPath: Notifications/Frontend/Frontend.csproj
  - projectPath: Notifications/Backend/Backend.csproj
  - projectPath: Notifications/Frontend.Functional.Tests/Frontend.Functional.Tests.csproj
```

**Deploy Pipeline:**
```yaml
packages:
  - packageFolder: Notifications.Frontend
    appType: webapp
    apps:
      pmedev:
        - app: app-notifications-frontend-pme-dev-wus
          resourceGroup: rg-notifications-frontend-pme-dev
  
  - packageFolder: Notifications.Backend
    appType: funcapp
    apps:
      pmedev:
        - app: func-notifications-backend-pme-dev-wus
          resourceGroup: rg-notifications-backend-pme-dev
```

**Characteristics:**
- ✅ Single solution file
- ✅ 2 deployable projects
- ✅ Simple Bicep (Frontend + Backend resources only)
- ✅ Estimated build time: 8 minutes

---

### Example 2: Search (Complex Domain)

**Profile:** Multiple indexers, complex deployment strategy

**Build Pipeline:**
```yaml
# Search/.pipelines/build/Build.Template.Search.yml
projectsToPublish:
  - projectPath: Search/Frontend/Frontend.csproj
  - projectPath: Search/Backend/Backend.csproj
  - projectPath: Search/Indexer/Indexer.csproj          # Main indexer
  - projectPath: Search/SvaIndexer/SvaIndexer.csproj    # Sub-domain indexer
  - projectPath: Search/Frontend.Functional.Tests/Frontend.Functional.Tests.csproj
```

**Deploy Pipeline (Simplified):**
```yaml
packages:
  - packageFolder: Search.Frontend
    appType: webapp
    # ... deploy config
  
  - packageFolder: Search.Backend
    appType: funcapp
    # ... deploy config
  
  - packageFolder: Search.Indexer
    appType: funcapp
    # ... separate indexer deployment
  
  - packageFolder: Search.SvaIndexer
    appType: funcapp
    # ... SVA-specific indexer
```

**Additional Pipelines:**
```
Search/.pipelines/deploy/
├── SearchIndexer/
│   ├── Deploy.Official.SearchIndexer.yml
│   └── Deploy.Template.SearchIndexer.yml
└── SearchSvaIndexer/
    ├── Deploy.Official.SearchSvaIndexer.yml
    └── Deploy.Template.SearchSvaIndexer.yml
```

**Characteristics:**
- ❌ Multiple deployable services
- ❌ Separate indexer pipelines for different sub-domains
- ❌ More complex Bicep (multiple resource groups)
- ❌ Estimated build time: 12 minutes
- ❌ Estimated deploy time: 25 minutes

---

### Example 3: MessageFulfillment (Coordinated Deployment)

**Profile:** 4 tightly-coupled services that must deploy and test together

**Build Pipeline:**
```yaml
projectsToPublish:
  - projectPath: MessageFulfillment/Frontend/Frontend.csproj
  - projectPath: MessageFulfillment/MessageBatcher/MessageBatcher.csproj
  - projectPath: MessageFulfillment/MessageSender/MessageSender.csproj
  - projectPath: MessageFulfillment/MessageTrigger/MessageTrigger.csproj
  - projectPath: MessageFulfillment/Frontend.Functional.Tests/Frontend.Functional.Tests.csproj
```

**Deploy Pipeline (Uses `Deploy.Stage.AppGroup.yml`):**
```yaml
# Deploy all 4 packages to staging
# Run single coordinated functional test
# Swap all 4 at once
# Optional: run production test

stages:
  - template: /.pipelines/templates/Deploy.Stage.AppGroup.yml
    parameters:
      # Single functional test covers all 4 services
      functionalTestProject: Frontend.Functional.Tests
      packages:
        - packageFolder: MessageFulfillment.Frontend
        - packageFolder: MessageFulfillment.MessageBatcher
        - packageFolder: MessageFulfillment.MessageSender
        - packageFolder: MessageFulfillment.MessageTrigger
```

**Characteristics:**
- ❌ 4 deployable services
- ❌ Uses `Deploy.Stage.AppGroup.yml` (coordinated deployment)
- ❌ Single functional test for entire system
- ❌ All services must succeed or entire deployment rolls back
- ❌ Estimated build time: 14 minutes
- ❌ Estimated deploy time: 30 minutes

---

## Key Design Patterns

### Pattern 1: Layered Template Hierarchy

**Problem Solved:** Maintaining consistency across 13 domains without duplication

**Pattern:**
```
Wrapper (thin, domain-specific config)
    ↓
Domain Template (what to build/deploy)
    ↓
Shared Template (how to build/deploy)
```

**Benefit:** Change once → propagates to all domains automatically

**Usage:** Add new .NET version → update `Build.CommonVariables.yml` → all 13 domains get the update

---

### Pattern 2: Conditional Stage Generation

**Problem Solved:** Generating different deployment stages based on domain configuration

**Pattern:**
```yaml
- ${{ each env in parameters.environments }}:
  - template: Deploy.Stage.yml
    # This generates a stage FOR EACH environment
    # Same template, different parameters
```

**Benefit:** One template handles 1 environment or 4 environments without conditional code

**Usage:** `Deploy.Stage.Apps.yml` generates stages for each domain's environment list

---

### Pattern 3: Parameter-Driven Deployment

**Problem Solved:** Controlling deployment behavior without hardcoding

**Pattern:**
```yaml
parameters:
  - name: deployHigherEnv
    type: boolean
    default: true

stages:
  - stage: DeployInt
    condition: ${{ parameters.deployHigherEnv }}
```

**Benefit:** One pipeline can deploy to dev only OR to dev+int+prod

**Usage:** `deployHigherEnv: false` for NonOfficial (dev only); `true` for Official (full progression)

---

### Pattern 4: Blue-Green Slot Swapping

**Problem Solved:** Zero-downtime production deployments

**Pattern:**
```
Deploy to staging slot
    ↓
Run tests against staging
    ↓
Swap staging → production (instant)
    ↓
Stop staging slot (optional, saves money)
```

**Benefit:** If tests fail or production breaks, swap back to previous version

**Usage:** Reduces deployment risk; enables rapid rollback

---

### Pattern 5: Infrastructure as Code Version Control

**Problem Solved:** Infrastructure drift; audit trail for infrastructure changes

**Pattern:**
```
Bicep files version-controlled alongside code
    ↓
Every deployment tracked in Git commit history
    ↓
Rollback infrastructure by checking out previous commit
```

**Benefit:** Infrastructure changes are auditable and reversible

**Usage:** Changed database schema? Commit shows exactly when, by whom, and why

---

## Building a New Repository

### Step-by-Step Implementation Guide

If you're building a new repository with this CI/CD architecture, follow these steps:

#### Step 1: Repository Structure

```
NewRepo/
├── .pipelines/                          ← Create this
│   └── templates/                       ← Copy from SupportServices
│       ├── Build.yml
│       ├── Build.DotNet.*.yml
│       ├── Deploy.*.yml
│       └── ... (32 templates total)
│
├── Domain1/
│   ├── Domain1.slnx
│   ├── Frontend/
│   ├── Backend/
│   ├── Deploy/
│   │   ├── env/
│   │   │   └── domain1.bicep
│   │   └── params/
│   │       ├── domain1.dev.bicepparam
│   │       ├── domain1.int.bicepparam
│   │       └── domain1.prod.bicepparam
│   └── .pipelines/                      ← Domain-specific pipelines
│       ├── build/
│       │   ├── Build.Official.Domain1.yml
│       │   ├── Build.NonOfficial.Domain1.yml
│       │   └── Build.Template.Domain1.yml
│       └── deploy/
│           ├── Deploy.Official.Domain1.yml
│           ├── Deploy.NonOfficial.Domain1.yml
│           └── Deploy.Template.Domain1.yml
│
└── Common/                              ← Shared libraries
    └── Common.slnx
```

#### Step 2: Create Shared Templates

Copy `.pipelines/templates/` from SupportServices to your new repo. These are domain-agnostic.

#### Step 3: Create Domain Build Pipeline

**Step 3a:** Create `Domain1/.pipelines/build/Build.Template.Domain1.yml`

```yaml
stages:
  - template: /.pipelines/templates/Build.yml
    parameters:
      stageName: build
      solutionsToBuild:
        - solutionPath: $(Build.SourcesDirectory)\Domain1\Domain1.slnx
      projectsToPublish:
        - projectPath: Domain1/Frontend/Frontend.csproj
        - projectPath: Domain1/Backend/Backend.csproj
        - projectPath: Domain1/Frontend.Functional.Tests/Frontend.Functional.Tests.csproj
      projectsToDeploy:
        - sourceFolder: Domain1/Domain1.Deploy
```

**Step 3b:** Create `Domain1/.pipelines/build/Build.Official.Domain1.yml`

Copy from SupportServices/Notifications and update domain names:

```yaml
name: $(Build.DefinitionName)_Branch_$(SourceBranchName)_$(Date:yyyyMMdd)$(Rev:.r)
trigger: none

parameters:
  - name: "debug"
    displayName: "Enable debug output"
    type: boolean
    default: false

variables:
  - template: /.pipelines/templates/Build.CommonVariables.yml
    parameters:
      debug: ${{ parameters.debug }}
  - template: /.pipelines/templates/Build.CG.ExcludeNpmProjects.yml

resources:
  repositories:
    - repository: templates
      type: git
      name: OneBranch.Pipelines/GovernedTemplates
      ref: refs/heads/main

extends:
  template: v2/OneBranch.Official.CrossPlat.yml@templates
  parameters:
    stages:
      - template: Build.Template.Domain1.yml
```

**Step 3c:** Create `Domain1/.pipelines/build/Build.NonOfficial.Domain1.yml`

Same as Official, but:
- Change `extends` to `v2/OneBranch.NonOfficial.CrossPlat.yml@templates`
- Add CI trigger with path filtering

```yaml
trigger:
  branches:
    include:
      - master
  paths:
    include:
      - Common/**
      - Domain1/**

extends:
  template: v2/OneBranch.NonOfficial.CrossPlat.yml@templates
  parameters:
    stages:
      - template: Build.Template.Domain1.yml
```

#### Step 4: Create Domain Deploy Pipeline

**Step 4a:** Create `Domain1/.pipelines/deploy/Deploy.Template.Domain1.yml`

```yaml
parameters:
  - name: deployHigherEnv
    type: boolean
  - name: environments
    type: object
  - name: skipBicepDeployment
    type: boolean
    default: false

variables:
  artifactDir: $(Pipeline.Workspace)/artifactPipeline/drop_build_main

stages:
  - template: /.pipelines/templates/Deploy.Stage.Apps.yml
    parameters:
      environments: ${{ parameters.environments }}
      skipBicepDeployment: ${{ parameters.skipBicepDeployment }}
      dependsOnEnv:
        pmedev: []
        pmeint: [pmedev]
        pmeprod: [pmeint]
      conditions:
        pmedev: true
        pmeint: ${{ parameters.deployHigherEnv }}
        pmeprod: ${{ parameters.deployHigherEnv }}
      serviceConnections:
        pmedev: id-green-domain1-azuredeploy-pme-nonprod
        pmeint: id-green-domain1-azuredeploy-pme-nonprod
        pmeprod: id-green-domain1-azuredeploy-pme-prod
      bicepTemplate: Domain1/Domain1.Deploy/env/domain1.bicep
      bicepParameters:
        pmedev: Domain1/Domain1.Deploy/params/domain1.dev.bicepparam
        pmeint: Domain1/Domain1.Deploy/params/domain1.int.bicepparam
        pmeprod: Domain1/Domain1.Deploy/params/domain1.prod.bicepparam
      packages:
        - packageFolder: Domain1.Frontend
          appType: webapp
          apps:
            pmedev:
              - app: app-domain1-frontend-pme-dev-wus
                resourceGroup: rg-domain1-frontend-pme-dev
            pmeint:
              - app: app-domain1-frontend-pme-int-wus
                resourceGroup: rg-domain1-frontend-pme-int
            pmeprod:
              - app: app-domain1-frontend-pme-prod-wus
                resourceGroup: rg-domain1-frontend-pme-prod
        - packageFolder: Domain1.Backend
          appType: funcapp
          apps:
            pmedev:
              - app: func-domain1-backend-pme-dev-wus
                resourceGroup: rg-domain1-backend-pme-dev
            pmeint:
              - app: func-domain1-backend-pme-int-wus
                resourceGroup: rg-domain1-backend-pme-int
            pmeprod:
              - app: func-domain1-backend-pme-prod-wus
                resourceGroup: rg-domain1-backend-pme-prod
```

**Step 4b:** Create Official and NonOfficial deploy wrappers

```yaml
# Domain1/.pipelines/deploy/Deploy.Official.Domain1.yml
name: $(Build.DefinitionName)_$(SourceBranchName)_$(Date:yyyyMMdd)$(Rev:.r)
trigger: none

resources:
  pipelines:
    - pipeline: artifactPipeline
      source: Build.Official.Domain1
      project: Xbox.CustomerExperiencesTeam
      trigger: true

parameters:
  - name: deployHigherEnv
    displayName: "Deploy To Higher Environments"
    type: boolean
    default: true

extends:
  template: Deploy.Template.Domain1.yml
  parameters:
    deployHigherEnv: ${{ parameters.deployHigherEnv }}
    environments:
      - pmedev
      - pmeint
      - pmeprod
```

#### Step 5: Create Bicep Infrastructure

**Create `Domain1/Domain1.Deploy/env/domain1.bicep`:**

```bicep
param location string = 'westus3'
param environment string = 'dev'

// App Service Plan
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: 'asp-domain1-${environment}-${location}'
  location: location
  sku: {
    name: environment == 'prod' ? 'P1V2' : 'B1'
  }
  properties: {
    reserved: true
  }
}

// Frontend Web App
resource frontendApp 'Microsoft.Web/sites@2023-01-01' = {
  name: 'app-domain1-frontend-${environment}-${location}'
  location: location
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|7.0'
      minTlsVersion: '1.2'
    }
  }
}

// Function App
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'stdomain1${replace(environment, '-', '')}${replace(location, 'westus3', 'wus')}'
  location: location
  kind: 'StorageV2'
  sku: {
    name: environment == 'prod' ? 'Standard_GRS' : 'Standard_LRS'
  }
  properties: {
    accessTier: 'Hot'
  }
}

resource backendFuncApp 'Microsoft.Web/sites@2023-01-01' = {
  name: 'func-domain1-backend-${environment}-${location}'
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'DOTNET-ISOLATED|7.0'
    }
  }
}
```

**Create parameter files:**

```bicep
// Domain1/Domain1.Deploy/params/domain1.dev.bicepparam
using './env/domain1.bicep'

param location = 'westus3'
param environment = 'dev'
```

#### Step 6: Register Pipelines in Azure DevOps

In Azure DevOps, create 4 pipeline definitions:

1. **Build.Official.Domain1**
   - Path: `Domain1/.pipelines/build/Build.Official.Domain1.yml`
   - Trigger: Manual

2. **Build.NonOfficial.Domain1**
   - Path: `Domain1/.pipelines/build/Build.NonOfficial.Domain1.yml`
   - Trigger: CI on master

3. **Deploy.Official.Domain1**
   - Path: `Domain1/.pipelines/deploy/Deploy.Official.Domain1.yml`
   - Trigger: Resource trigger on build

4. **Deploy.NonOfficial.Domain1**
   - Path: `Domain1/.pipelines/deploy/Deploy.NonOfficial.Domain1.yml`
   - Trigger: Resource trigger on build

#### Step 7: Test the Pipeline

1. Commit code to master
2. NonOfficial build should fire automatically
3. Once build completes, deploy to pmedev
4. Manually queue Official build
5. Verify Official deploy to all environments

---

## Interview Key Concepts

### Concept 1: Why OneBranch?

**Interview Question:** "What's the purpose of OneBranch in your CI/CD architecture?"

**Answer:**
- OneBranch is Microsoft's **enterprise CI/CD governance framework**
- Enforces **SDL (Security Development Lifecycle)** scanning automatically
- Provides **compliance tracking** and TSA integration
- Standardizes **agent pools, signing, and artifact handling** across teams
- Enables **cross-team consistency** without building from scratch

**Example:** All 13 teams use OneBranch templates; if Microsoft finds a new security vulnerability in the agent, Microsoft fixes it once, and all teams get the update automatically.

---

### Concept 2: Official vs NonOfficial Trade-off

**Interview Question:** "Why have both Official and NonOfficial pipelines? Why not just one?"

**Answer:**
This solves a fundamental tension between **speed and safety**:

- **Developers need speed:** 10-minute feedback loops
- **Production needs safety:** Security scanning, compliance, approvals

**Solution:** Two pipelines!
- **NonOfficial** (~10 min): Fast, permissive, for development — developers get rapid feedback
- **Official** (~25 min): Slow, strict, for production — releases are safe and auditable

**Trade-off:** Extra pipeline definitions, but enormous benefit in both developer velocity and production safety.

---

### Concept 3: Layered Templates Reduce Complexity

**Interview Question:** "How do you maintain 13 domains without massive duplication?"

**Answer:**
Three-layer template hierarchy:
1. **Wrapper** (thin, domain-specific): ~30 lines, just config
2. **Domain Template** (medium, what to do): ~50 lines, what to build/deploy
3. **Shared Template** (complex, how to do it): ~100+ lines, reusable across all domains

**Benefit:** To change .NET SDK version for all 13 domains:
- ❌ Without layering: Edit 26 files
- ✅ With layering: Edit 1 file

**Pattern:** This is **DRY (Don't Repeat Yourself)** applied to YAML — changes propagate automatically.

---

### Concept 4: Progressive Deployment with Gates

**Interview Question:** "How do you minimize production risk during deployments?"

**Answer:**
**Progressive deployment with approval gates:**
```
pmedev (automatic) → pmeint (approval gate) → pmeflight (approval gate) → pmeprod (approval gate)
```

**Risk Mitigation:**
- ✅ Dev: Always deploy — catch issues immediately
- ✅ Int: Manual gate — team validates before int
- ✅ Flight: Manual gate — validates in prod-like environment with subset of traffic
- ✅ Prod: Manual gate — only deploy after validation complete

**Result:** Issues are caught early; production has minimal risk.

---

### Concept 5: Blue-Green Slot Swapping

**Interview Question:** "How do you achieve zero-downtime deployments?"

**Answer:**
**Blue-green slot swapping:**
1. Deploy new code to **staging slot** (not serving traffic)
2. Run functional tests against **staging slot**
3. If tests pass, **swap staging ↔ production** (instant)
4. Traffic immediately routes to new version; zero downtime

**Rollback:** If production breaks, swap back to previous version (instant rollback)

**Cost Optimization:** Stop staging slot between deployments to save money.

---

### Concept 6: Infrastructure as Code Benefits

**Interview Question:** "Why version-control Bicep files alongside code?"

**Answer:**
**Infrastructure as Code (IaC) enables:**
- ✅ **Reproducibility**: Same Bicep + params = identical infrastructure every time
- ✅ **Auditability**: See exactly what changed, when, by whom, why (Git commit history)
- ✅ **Rollback**: Revert infrastructure by checking out previous commit
- ✅ **Testing**: Test infrastructure changes in dev before prod
- ✅ **Documentation**: Bicep files serve as live, version-controlled documentation

**Example:** DBA realizes a table structure is wrong? Instead of manual fixes, revert commit, redeploy Bicep, infrastructure is back to correct state.

---

### Concept 7: Multi-Domain Monorepo Strategy

**Interview Question:** "Why organize as a monorepo with multiple domains instead of separate repos?"

**Answer:**
**Monorepo benefits:**
- ✅ **Shared code easy**: Common libraries in `Common/` used by all domains
- ✅ **Atomic commits**: Infrastructure + code changes in single commit
- ✅ **CI efficiency**: Build only changed domains (path filters in triggers)
- ✅ **Team independence**: Each domain owns its pipelines; teams don't block each other
- ✅ **Cross-domain refactoring**: Move code between domains, update in one commit

**Trade-off:** All teams must use same build/deploy patterns (solved by layered templates)

---

### Concept 8: Conditional Stage Generation

**Interview Question:** "How do you handle domains with different numbers of services?"

**Answer:**
**Conditional stage generation via YAML loops:**
```yaml
- ${{ each env in parameters.environments }}:
  - stage: deploy_${{ env }}
    # This generates ONE stage FOR EACH environment
    # Same template, different parameters
```

**Benefit:** One template handles:
- 1 environment or 4 environments
- 1 service or 4 services
- Conditional deployment (webapp vs funcapp)

**Without this:** Would need separate templates for each domain combination (explosion of files).

---

### Concept 9: Artifact Flow and Reusability

**Interview Question:** "Explain the artifact flow from build to deploy."

**Answer:**
**Build → Artifact → Deploy progression:**
1. **Build pipeline** produces artifact:
   - Compiled binaries (`*.dll`, `*.exe`)
   - Published app packages (ready to deploy)
   - Bicep infrastructure files
   - PowerShell scripts
   - All packaged as `drop_build_main`

2. **Artifact stored** in Azure Pipelines artifact store

3. **Deploy pipeline consumes** the artifact:
   - Downloads `drop_build_main`
   - Extracts binaries to staging slots
   - Deploys Bicep infrastructure
   - Runs functional tests
   - Performs slot swap

**Benefit:** Build once, deploy multiple times (dev, int, prod all use same artifact).

---

### Concept 10: SDL Integration and Compliance

**Interview Question:** "How do you ensure security and compliance in the pipeline?"

**Answer:**
**Official pipelines enforce SDL (Security Development Lifecycle):**
- ✅ **Static analysis**: Scans code for security vulnerabilities
- ✅ **Dependency scanning**: Checks NuGet packages for known vulnerabilities
- ✅ **Code signing**: Signs binaries to verify authenticity
- ✅ **TSA integration**: Results published to compliance system
- ✅ **Fail-fast**: Build FAILS on any SDL violation; no override

**NonOfficial** pipelines run SDL in report-only mode (doesn't block development).

**Result:** Security is built in; compliance is automatic.

---

### Common Interview Follow-Ups and Answers

**Q:** "What happens if a functional test fails during deployment?"

**A:** "Deployment stops; slot swap doesn't happen. Staging slot keeps the new code (for debugging), and production stays on old version. Team investigates the test failure, fixes the code, and retries the deployment."

**Q:** "How do you handle rollback if production breaks?"

**A:** "Fastest way: Swap the slots back (instant). Staging still has the previous version. This provides immediate rollback. For longer-term recovery, redeploy the previous build pipeline execution."

**Q:** "What's the difference between `pmeint` and `pmeflight`?"

**A:** "
- `pmeint`: Integration environment for testing with internal stakeholders
- `pmeflight`: Staging environment that mirrors production exactly, used for flighting (gradual rollout) to subset of prod customers"

**Q:** "How do you prevent teams from interfering with each other?"

**A:** "
- Path-based CI triggers: Only affected domains rebuild
- Service connections scoped to domain (Chat team can't deploy Refunds infrastructure)
- Layered templates prevent direct file conflicts
- Each domain owns its `.pipelines/` folder"

**Q:** "Why separate build from deploy pipelines?"

**A:** "Decoupling build from deploy enables:
- ✅ Build once, deploy multiple times (same artifact to dev, int, prod)
- ✅ Flexible deploy timing (build immediately, deploy after approval)
- ✅ Independent failure investigation (if deploy fails, rebuild isn't needed)
- ✅ Multi-environment progression (pmedev auto, pmeint manual approval, etc)"

---

## Summary: Key Takeaways

### For Learning

1. **Study the layered template structure** — this is the foundation of all scaling
2. **Understand the Official vs NonOfficial dual-pipeline model** — this is the speed/safety trade-off
3. **Trace through one complete domain deployment** — follow code from commit to production
4. **Examine Bicep files** — infrastructure as code is non-negotiable for production

### For Building Your Own

1. **Start with Notifications domain** — simplest real-world example
2. **Copy shared templates** — don't reinvent; these are battle-tested
3. **Create domain-specific wrappers** — keep per-domain files thin
4. **Test both Official and NonOfficial builds** — verify both paths work
5. **Document your Bicep templates** — infrastructure should be self-explanatory

### For Interviews

1. **Explain the three-layer template hierarchy** — shows understanding of DRY principles
2. **Describe blue-green slot swapping** — shows production deployment knowledge
3. **Discuss Official vs NonOfficial trade-offs** — shows systems thinking
4. **Walk through the deploy progression** — shows end-to-end understanding
5. **Explain why monorepo + per-domain pipelines** — shows architecture maturity

---

## References and Further Learning

### Key Files to Study

- `.pipelines/templates/Build.yml` — Main build orchestrator
- `.pipelines/templates/Deploy.Stage.Apps.yml` — Main deploy orchestrator
- `Notifications/.pipelines/build/Build.Template.Notifications.yml` — Simple real-world example
- `MessageFulfillment/.pipelines/deploy/Deploy.Template.MessageFulfillment.yml` — Complex example
- `Docs/Conventions/CiCdPipelines.md` — Official documentation

### Related Documentation

- [Project Structure Convention](../Docs/Conventions/ProjectStructure.md)
- [Dependency Injection Convention](../Docs/Conventions/DependencyInjection.md)
- [Infrastructure Convention](../Docs/Conventions/Infrastructure.md)
- [Testing Convention](../Docs/Conventions/Testing.md)

### External References

- [Microsoft OneBranch Documentation](https://aka.ms/obpipelines)
- [Azure Pipelines YAML Schema](https://docs.microsoft.com/en-us/azure/devops/pipelines/yaml-schema)
- [Bicep Documentation](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/)
- [Blue-Green Deployment Pattern](https://martinfowler.com/bliki/BlueGreenDeployment.html)

---

**Last Updated:** January 2026  
**Status:** Complete and ready for learning/interviews  
**Scope:** Covers all 13 SupportServices domains with real-world examples and patterns


### Copy paste of the AI Summary in the VSO Chat:

## 📚 What's in the Guide
File Created: CI_CD_PIPELINES_EDUCATIONAL_GUIDE.md

## Key Sections:

- Executive Summary — The big picture: 13 domains, OneBranch, dual pipeline model
- Architecture Overview — High-level flow from commit to production
- Official vs NonOfficial Model — Deep dive into the speed/safety trade-off
- Build Pipeline Deep Dive — Layer-by-layer explanation with code examples
- Deploy Pipeline Deep Dive — Multi-environment progression, slot swapping
- Shared Template Architecture — How 32 templates serve 13 domains
- Bicep & Infrastructure Integration — IaC patterns and two-tier deployments
- Real-World Domain Examples:
    - Notifications (simple: 2 services)
    - Search (complex: multiple indexers)
    - MessageFulfillment (coordinated: 4 tightly-coupled services)
- Key Design Patterns — 5 fundamental patterns explained
- Building a New Repository — Step-by-step implementation guide
- Interview Key Concepts — 10 essential topics with Q&A format

## Highlights for Learning:

    ✅ Complete code examples — Every template shown with full YAML
    ✅ Real-world comparisons — Side-by-side domain examples
    ✅ Visual diagrams — ASCII flowcharts of pipeline progression
    ✅ Why decisions matter — Architecture rationale for each pattern
    ✅ Interview prep — Common questions with detailed answers
    ✅ Practical guides — Step-by-step to build your own repo

## For Interview Preparation:
### The guide covers:

- Layered template hierarchy (DRY principles)
- Progressive deployment with gates (risk mitigation)
- Blue-green slot swapping (zero-downtime)
- Infrastructure as Code benefits
- Multi-domain monorepo strategy
- SDL compliance and security
- Conditional YAML templating
- Artifact flow and reusability

### This guide is ready for:

 Self-learning — Study the patterns and architecture
 
 Building a new repo — Follow the step-by-step guide
 
 Interview preparation — Reference the key concepts and Q&A sections
 
 Teaching others — Share with team members who need to understand the pipelines
 
 The file is now in your SupportServices root directory!