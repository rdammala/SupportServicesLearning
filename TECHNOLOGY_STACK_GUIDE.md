# SupportServices Technology Stack: Comprehensive Guide

**Purpose:** This guide provides an in-depth understanding of all technologies used in the SupportServices repository, where they're used, how they're implemented, and best practices. For technologies not currently in use, publicly available industry best practices are included.

**Status:** Production repository with 13 domains, 385+ projects, 100+ NuGet packages  
**Last Updated:** January 2026  
**.NET Version:** 10.0.204 (latest)  
**Front-End:** React 19.2.4, TypeScript 5.6.3

---

## Table of Contents

1. [Technology Stack Overview](#technology-stack-overview)
2. [Frontend Technologies](#frontend-technologies)
3. [Backend Technologies](#backend-technologies)
4. [Cloud & DevOps](#cloud--devops)
5. [Database & Storage](#database--storage)
6. [Authentication & Security](#authentication--security)
7. [Testing & Quality Assurance](#testing--quality-assurance)
8. [Domain-Specific Technologies](#domain-specific-technologies)
9. [Technologies Not Used (With Best Practices)](#technologies-not-used-with-best-practices)
10. [Architecture Patterns](#architecture-patterns)
11. [Interview Key Concepts](#interview-key-concepts)

---

## Technology Stack Overview

### Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                             │
│  React 19.2.4 + TypeScript 5.6.3 + Redux (Loyalty Portal)  │
│  (Single SPA frontend; 99% .NET backend)                    │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐    ┌─────▼─────┐   ┌───▼────┐
    │ Azure   │    │ Azure     │   │ Azure  │
    │ App     │    │ Functions │   │ Front  │
    │ Service │    │ (Isolated │   │ Door   │
    │ (.NET)  │    │ Worker)   │   │ (CDN)  │
    └────┬────┘    └─────┬─────┘   └────────┘
         │               │
         └───────────────┼───────────────┐
                         │               │
                    ┌────▼────┐     ┌───▼─────┐
                    │ Cosmos  │     │ Storage │
                    │ DB      │     │ Account │
                    │ (NoSQL) │     │ (Blobs) │
                    └─────────┘     └─────────┘
         │
         └─────────► Azure Key Vault (Secrets Management)
         │
         └─────────► Application Insights (Telemetry)
         │
         └─────────► Azure Search / Cognitive Services
```

### The Numbers

| Category | Count | Details |
|----------|-------|---------|
| **Domains** | 13 | Independent service domains |
| **Projects** | 385+ | C# projects across all layers |
| **NuGet Packages** | 100+ | Centrally managed via Directory.Packages.props |
| **Bicep Files** | 194+ | Infrastructure definition |
| **Frontend Apps** | 1 | React Loyalty Portal |
| **NPM Packages** | 50+ | React ecosystem (Loyalty Portal only) |
| **.NET Version** | 10.0.204 | Latest preview/production |
| **Languages** | C#, TypeScript, JSON | No Python, Java, or Go |

---

## Frontend Technologies

### Current Frontend Stack

The SupportServices repo has **one frontend application**: **Loyalty Portal UI** (React-based).

#### React & Core Libraries

**Version:** React 19.2.4 (latest)

```json
// Loyalty/Portal.UI/package.json
{
  "dependencies": {
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-router-dom": "^5.3.4",
    "@reduxjs/toolkit": "^1.6.2",
    "redux": "^4.0.5",
    "typescript": "^5.6.3"
  }
}
```

**Usage:**
- Loyalty Portal is a **single-page application (SPA)**
- Client-side routing via React Router v5
- State management via Redux Toolkit

**Why React 19?**
- Latest concurrency features
- Improved performance
- Server components ready (future)
- Better TypeScript support

#### Build Tool: Vite 6.3.5

```json
{
  "devDependencies": {
    "vite": "^6.3.5",
    "typescript": "^5.6.3"
  }
}
```

**Why Vite over Webpack?**
| Aspect | Webpack | Vite |
|--------|---------|------|
| **Build Time** | Slow (seconds) | Instant (milliseconds) |
| **Dev Server** | Full rebuild | ESM-based rebuild |
| **Hot Module Reload** | Slower | Instant |
| **Config Complexity** | High | Minimal |
| **JavaScript Focus** | Bundler-first | ESM-first |

**Vite Configuration Pattern:**
```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000'  // Proxy to backend
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false  // Production
  }
})
```

#### UI Component Library: Fluent UI React 9.73.2

**Microsoft's Design System**

```typescript
// Example: Button Component
import { Button } from '@fluentui/react-components'
import { bundleIcon, CalendarMonthFilled, CalendarMonthRegular } from '@fluentui/react-icons'

const CalendarMonth = bundleIcon(CalendarMonthFilled, CalendarMonthRegular)

export const App = () => (
  <Button icon={<CalendarMonth />} appearance="primary">
    Click me
  </Button>
)
```

**Why Fluent UI?**
- ✅ **Microsoft-first** — Aligns with Xbox/Gaming ecosystem
- ✅ **Accessibility built-in** — WCAG 2.1 AA compliance
- ✅ **Theming** — Dark mode, custom colors
- ✅ **Consistency** — All Xbox UIs follow same design language
- ✅ **Component library** — 100+ pre-built components

**Key Components Used:**
- Buttons, Menus, Dropdowns
- Data grids (Table)
- Form inputs (TextField, Checkbox, Radio)
- Modal dialogs
- Toast notifications
- Navigation (Sidebar, Tabs)

#### State Management: Redux Toolkit 1.6.2

**Pattern: Slice-based Redux**

```typescript
// store/loyaltySlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'

export const fetchLoyaltyPoints = createAsyncThunk(
  'loyalty/fetchPoints',
  async (userId: string) => {
    const response = await fetch(`/api/loyalty/${userId}`)
    return response.json()
  }
)

const loyaltySlice = createSlice({
  name: 'loyalty',
  initialState: {
    points: 0,
    loading: false,
    error: null
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLoyaltyPoints.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchLoyaltyPoints.fulfilled, (state, action) => {
        state.points = action.payload.points
        state.loading = false
      })
      .addCase(fetchLoyaltyPoints.rejected, (state, action) => {
        state.error = action.error.message
        state.loading = false
      })
  }
})

export default loyaltySlice.reducer
```

**Redux Thunk for Async Actions:**
```typescript
// Handles async operations within Redux
const store = configureStore({
  reducer: { loyalty: loyaltyReducer },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false })
})
```

**Best Practices Used:**
- ✅ Redux Toolkit (replaces Redux Saga)
- ✅ Slice pattern (co-locate reducer + actions)
- ✅ Async thunks for API calls
- ✅ Normalized state shape
- ✅ Immutable updates (RTK handles Immer internally)

#### TypeScript: 5.6.3 (Strict Mode)

**Strict Configuration:**
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

**Usage Pattern in Loyalty Portal:**
```typescript
// pages/LoyaltyDashboard.tsx
import React, { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../hooks'
import { fetchLoyaltyPoints } from '../store/loyaltySlice'

interface DashboardProps {
  userId: string
}

export const LoyaltyDashboard: React.FC<DashboardProps> = ({ userId }) => {
  const dispatch = useAppDispatch()
  const { points, loading, error } = useAppSelector(state => state.loyalty)

  useEffect(() => {
    dispatch(fetchLoyaltyPoints(userId))
  }, [userId, dispatch])

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  return <div>Points: {points}</div>
}
```

**Why TypeScript?**
- ✅ **Type safety** — Catch errors at compile time
- ✅ **IntelliSense** — IDE autocomplete
- ✅ **Refactoring** — Rename/refactor with confidence
- ✅ **Documentation** — Types serve as inline docs
- ✅ **Less runtime errors** — Most bugs caught during development

#### Authentication: Azure AD (MSAL React 5.0.6)

```typescript
// main.tsx
import { MsalProvider } from '@azure/msal-react'
import { PublicClientApplication } from '@azure/msal-browser'

const msalInstance = new PublicClientApplication({
  auth: {
    clientId: 'YOUR_CLIENT_ID',
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: window.location.origin
  }
})

ReactDOM.render(
  <MsalProvider instance={msalInstance}>
    <App />
  </MsalProvider>,
  document.getElementById('root')
)
```

**Protected Route Pattern:**
```typescript
import { useIsAuthenticated } from '@azure/msal-react'

export const ProtectedRoute: React.FC = () => {
  const isAuthenticated = useIsAuthenticated()
  
  if (!isAuthenticated) {
    return <LoginPage />
  }
  
  return <Dashboard />
}
```

#### Code Quality Tools

| Tool | Version | Purpose |
|------|---------|---------|
| **ESLint** | 8.57.1 | Linting & code standards |
| **Prettier** | 3.3.3 | Code formatting (autofix) |
| **Jest** | 29.7.0 | Unit testing |
| **React Testing Library** | Latest | Component testing |

**ESLint Config:**
```json
// .eslintrc.json
{
  "extends": ["react-app", "react-app/jest"],
  "rules": {
    "no-unused-vars": "warn",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

**Prettier Config:**
```json
// .prettierrc.json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

#### Frontend Testing

**Jest Unit Tests:**
```typescript
// __tests__/LoyaltyDashboard.test.tsx
import { render, screen } from '@testing-library/react'
import { LoyaltyDashboard } from '../LoyaltyDashboard'

describe('LoyaltyDashboard', () => {
  it('displays loading state initially', () => {
    render(<LoyaltyDashboard userId="123" />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })
})
```

**Test Categories (Frontend):**
- **Unit**: Component logic in isolation
- **Integration**: Multiple components together
- **E2E**: Full user workflows (rare in this repo)

---

## Backend Technologies

### .NET 10.0 & ASP.NET Core

#### Runtime Version

**File:** `global.json`
```json
{
  "sdk": {
    "version": "10.0.204",
    "rollForward": "latestFeature"
  }
}
```

**Why .NET 10?**
- Latest LTS (Long-Term Support) version
- Performance improvements
- Security patches
- Modern language features (C# 14)

#### ASP.NET Core Web API

**Framework:** ASP.NET Core (NOT MVC, NOT Minimal APIs)

**Project Type:**
```xml
<!-- Chat/Frontend/Frontend.csproj -->
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>
  
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.OpenApi" Version="10.0.8" />
  </ItemGroup>
</Project>
```

**API Startup Pattern:**
```csharp
// Chat/Frontend/Program.cs
var builder = WebApplication.CreateBuilder(args);

// Register services
builder.Services
  .AddCommonForAspNetCore()
  .AddErrorCodeResultFactory<ChatErrorCode>()
  .AddXbl30()                          // Xbox Live auth
  .AddAzureAppRegistrationAuthentication()  // Entra ID
  .AddControllers();

// Middleware
var app = builder.Build();
app
  .UseMise()                           // Identity middleware
  .UseOpenApi()                        // Swagger
  .MapControllers();

app.Run()
```

#### RESTful API Design

**Convention-based routing:**
```csharp
[ApiController]
[Route("api/[controller]")]
public class RefundsController : ControllerBase
{
    [HttpGet("{refundId}")]
    public async Task<ActionResult<RefundResponse>> GetRefund(string refundId)
    {
        var refund = await _refundService.GetAsync(refundId);
        return Ok(refund);
    }
    
    [HttpPost]
    [Authorize(Policy = "RefundCreator")]
    public async Task<ActionResult> CreateRefund(CreateRefundRequest request)
    {
        var refund = await _refundService.CreateAsync(request);
        return CreatedAtAction(nameof(GetRefund), new { refundId = refund.Id }, refund);
    }
}
```

**HTTP Status Codes:**
- `200 OK` — Successful retrieval or update
- `201 Created` — Resource created
- `204 No Content` — Successful deletion
- `400 Bad Request` — Invalid input
- `401 Unauthorized` — Auth required
- `403 Forbidden` — Auth succeeded but not authorized
- `404 Not Found` — Resource doesn't exist
- `500 Internal Server Error` — Server-side failure

#### OpenAPI/Swagger Integration

```xml
<!-- Chat/Frontend/Frontend.csproj -->
<ItemGroup>
  <PackageReference Include="Microsoft.AspNetCore.OpenApi" Version="10.0.8" />
  <PackageReference Include="Swashbuckle.AspNetCore" Version="6.4.6" />
</ItemGroup>
```

**Generated automatically during publish:**
```xml
<PropertyGroup>
  <GenerateOpenApiOnPublish>true</GenerateOpenApiOnPublish>
</PropertyGroup>
```

**Swagger UI at:** `https://localhost:5000/swagger`

#### OData Support

```csharp
builder.Services.AddOData();

// Usage: GET /api/refunds?$filter=status eq 'pending'&$orderby=createdDate desc
app.MapODataRoute("odata", "odata", GetEdmModel());
```

**OData Query Examples:**
- `$filter=status eq 'completed'` — Filter
- `$orderby=createdDate desc` — Sort
- `$select=id,status` — Projection
- `$expand=customer` — Include relations
- `$top=10&$skip=20` — Pagination

### Azure Functions: Isolated Worker Model

#### Project Structure

```xml
<!-- Notifications/Backend/Backend.csproj -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <AzureFunctionsVersion>v4</AzureFunctionsVersion>
    <OutputType>Exe</OutputType>
  </PropertyGroup>
  
  <ItemGroup>
    <PackageReference Include="Microsoft.Azure.Functions.Worker" Version="2.52.0" />
    <PackageReference Include="Microsoft.Azure.Functions.Worker.Extensions.ServiceBus" Version="5.20.0" />
  </ItemGroup>
</Project>
```

**Why Isolated Worker Model?**

| Aspect | In-Process | Isolated Worker |
|--------|-----------|-----------------|
| **Process** | Shared with runtime | Separate process |
| **Startup** | Slower cold start | Faster cold start |
| **Dependency** | Runtime version-locked | Independent versioning |
| **Debugging** | Harder | Easier (standard .NET debugging) |
| **Language Support** | Limited | All languages (.NET, Python, Java) |

#### Function Trigger Types

**1. Service Bus Trigger (Event-Driven)**
```csharp
[Function("ProcessOrderMessage")]
public async Task RunAsync(
    [ServiceBusTrigger("orders-topic", "order-processor", Connection = "ServiceBusConnection")]
    ServiceBusReceivedMessage message,
    FunctionContext context)
{
    var logger = context.GetLogger("ProcessOrderMessage");
    logger.LogInformation("Processing message: {MessageId}", message.MessageId);
    
    var orderData = JsonSerializer.Deserialize<Order>(message.Body);
    await _orderService.ProcessAsync(orderData);
}
```

**2. Timer Trigger (Scheduled)**
```csharp
[Function("DailyReportGenerator")]
public async Task RunAsync(
    [TimerTrigger("0 2 * * *")] TimerInfo myTimer,  // 2 AM daily
    FunctionContext context)
{
    var logger = context.GetLogger("DailyReportGenerator");
    logger.LogInformation("Report generation started at {Time}", myTimer.ScheduleStatus.Last);
    
    await _reportService.GenerateDailyReportAsync();
}
```

**3. HTTP Trigger**
```csharp
[Function("GetUserStatus")]
public async Task<HttpResponseData> RunAsync(
    [HttpTrigger(AuthorizationLevel.User, "get", Route = "users/{userId}/status")] 
    HttpRequestData req,
    string userId,
    FunctionContext context)
{
    var response = req.CreateResponse(HttpStatusCode.OK);
    var status = await _userService.GetStatusAsync(userId);
    await response.WriteAsJsonAsync(status);
    return response;
}
```

**4. Queue Trigger**
```csharp
[Function("ProcessNotificationQueue")]
public async Task RunAsync(
    [QueueTrigger("notifications")] QueueMessage message,
    FunctionContext context)
{
    var logger = context.GetLogger("ProcessNotificationQueue");
    var notification = JsonSerializer.Deserialize<Notification>(message.Body);
    await _notificationService.SendAsync(notification);
}
```

**5. Cosmos DB Trigger (Change Feed)**
```csharp
[Function("ProcessCosmosFeed")]
public async Task RunAsync(
    [CosmosDBTrigger("database", "container", Connection = "CosmosDbConnection",
     CreateLeaseContainerIfNotExists = true)]
    IReadOnlyList<OrderChanged> changes,
    FunctionContext context)
{
    var logger = context.GetLogger("ProcessCosmosFeed");
    foreach (var change in changes)
    {
        logger.LogInformation("Change detected: {OrderId}", change.Id);
        await _auditService.LogChangeAsync(change);
    }
}
```

#### Durable Functions (Orchestration)

```csharp
// Orchestrator (orchestrates the workflow)
[Function("OrderProcessingOrchestrator")]
public static async Task RunOrchestrator(
    [OrchestrationTrigger] TaskOrchestrationContext context)
{
    var input = context.GetInput<OrderInput>();
    
    // Step 1: Validate order
    var validation = await context.CallActivityAsync("ValidateOrder", input);
    
    // Step 2: Reserve inventory
    var reservation = await context.CallActivityAsync("ReserveInventory", input);
    
    // Step 3: Process payment
    try
    {
        await context.CallActivityAsync("ProcessPayment", input);
    }
    catch
    {
        // Compensating transaction (rollback)
        await context.CallActivityAsync("ReleaseInventory", reservation);
        throw;
    }
    
    // Step 4: Send confirmation
    await context.CallActivityAsync("SendOrderConfirmation", input);
}

// Activity function (does the work)
[Function("ProcessPayment")]
public static async Task ProcessPayment([ActivityTrigger] OrderInput input)
{
    await _paymentService.ChargeAsync(input);
}
```

**Use Cases for Durable Functions:**
- ✅ Multi-step workflows with coordination
- ✅ Compensation logic (sagas)
- ✅ Long-running operations
- ✅ Fan-out/fan-in patterns
- ✅ Human-in-the-loop approvals

### Testing: MSTest SDK 4.2.3

#### MSTest vs XUnit vs NUnit

| Framework | Syntax | Attributes | Parallelization |
|-----------|--------|-----------|-----------------|
| **MSTest** | `[TestClass]`, `[TestMethod]` | Native to Visual Studio | Default parallel |
| **XUnit** | Facts/Theories | Simple, extensible | Always parallel |
| **NUnit** | `[TestFixture]`, `[Test]` | Rich, mature | Manual configuration |

**SupportServices uses MSTest SDK (Microsoft's modern test framework)**

#### Test Structure

```csharp
// Notifications/Frontend.Tests/RefundCreation.Tests.cs
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Moq;
using FluentAssertions;

[TestClass]
public class RefundCreationTests
{
    private Mock<IRefundService> _mockRefundService;
    private RefundController _controller;

    [TestInitialize]
    public void Setup()
    {
        _mockRefundService = new Mock<IRefundService>();
        _controller = new RefundController(_mockRefundService.Object);
    }

    [TestMethod]
    [TestCategory("Unit")]
    public async Task CreateRefundAsync_ValidInput_ReturnsCreatedRefund()
    {
        // Arrange
        var request = new CreateRefundRequest { Amount = 100 };
        var expected = new RefundResponse { Id = "R123", Amount = 100 };
        _mockRefundService.Setup(s => s.CreateAsync(request))
            .ReturnsAsync(expected);

        // Act
        var result = await _controller.CreateRefund(request);

        // Assert
        result.Should().BeEquivalentTo(expected);
        _mockRefundService.Verify(s => s.CreateAsync(request), Times.Once);
    }

    [TestMethod]
    [TestCategory("Functional")]
    public async Task CreateRefundAsync_WithInvalidAmount_Throws()
    {
        // Arrange
        var request = new CreateRefundRequest { Amount = -100 };

        // Act & Assert
        await _controller.Invoking(c => c.CreateRefund(request))
            .Should()
            .ThrowAsync<ArgumentException>();
    }
}
```

#### Test Categories

```csharp
[TestCategory("Unit")]           // Fast, no dependencies, 10-100ms
[TestCategory("BVT")]            // Build Verification, quick smoke tests
[TestCategory("Functional")]     // Integration tests, 100ms-10s
[TestCategory("Developer")]      // Manual tests hitting live environments
```

**Running filtered tests:**
```bash
dotnet test --filter "TestCategory=Unit"
dotnet test --filter "TestCategory=Functional"
dotnet test --filter "FullyQualifiedName~RefundCreation"
```

#### Mocking: Moq 4.20.72

```csharp
// Setup mocks
var mockOrderService = new Mock<IOrderService>();

// Setup return value
mockOrderService
    .Setup(s => s.GetOrderAsync("O123"))
    .ReturnsAsync(new Order { Id = "O123", Total = 100 });

// Setup with any parameter
mockOrderService
    .Setup(s => s.ProcessAsync(It.IsAny<Order>()))
    .Returns(Task.CompletedTask);

// Verify calls
mockOrderService.Verify(s => s.ProcessAsync(It.IsAny<Order>()), Times.Once);

// Setup throw
mockOrderService
    .Setup(s => s.GetOrderAsync("INVALID"))
    .ThrowsAsync(new NotFoundException());
```

#### Assertions: FluentAssertions 6.12.2

```csharp
// Traditional assertions
Assert.AreEqual(expected, actual);

// Fluent assertions (readable)
actual.Should().Be(expected);
actual.Should().BeGreaterThan(0);
actual.Should().Contain(x => x.Status == "Active");

// Collections
orders.Should().HaveCount(3);
orders.Should().AllSatisfy(o => o.Amount.Should().BePositive());

// String assertions
message.Should().StartWith("Error:");
message.Should().Contain("refund");

// Exception assertions
await action.Should().ThrowAsync<ArgumentException>()
    .WithMessage("*invalid*");
```

#### Snapshot Testing: Snapper 2.4.1

```csharp
[TestMethod]
public void SerializeOrder_MatchesSnapshot()
{
    var order = new Order 
    { 
        Id = "O123", 
        Customer = "John", 
        Total = 99.99m, 
        CreatedDate = new DateTime(2025, 1, 14)
    };
    
    var json = JsonSerializer.Serialize(order);
    json.Should().MatchSnapshot();
}

// First run: Creates snapshot file
// Subsequent runs: Compares against snapshot
// If JSON structure changes, test fails (ensures backward compatibility)
```

---

## Cloud & DevOps

### Azure Services in Use

#### 1. App Services (Hosting Frontend APIs)

**Bicep Definition:**
```bicep
param location string = 'westus3'
param environment string = 'dev'

resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: 'asp-chat-${environment}-${location}'
  location: location
  sku: {
    name: environment == 'prod' ? 'P1V2' : 'B1'  // Premium prod, Basic dev
  }
  properties: {
    reserved: true  // Linux app service plan
  }
}

resource frontendApp 'Microsoft.Web/sites@2023-01-01' = {
  name: 'app-chat-frontend-${environment}-${location}'
  location: location
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'  // Managed identity
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true         // Force HTTPS
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|10.0'
      minTlsVersion: '1.2'  // TLS 1.2 minimum
      appSettings: [
        {
          name: 'ASPNETCORE_ENVIRONMENT'
          value: environment == 'prod' ? 'Production' : 'Development'
        }
      ]
    }
  }
}
```

**Deployment Slots (Blue-Green):**
```bicep
resource stagingSlot 'Microsoft.Web/sites/slots@2023-01-01' = {
  parent: frontendApp
  name: 'staging'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
  }
}
```

**Pipeline Slot Swap:**
```yaml
# .pipelines/templates/Deploy.Steps.WebApp.SlotSwap.yml
- task: AzureAppServiceManage@0
  displayName: "Swap Slots: Staging → Production"
  inputs:
    azureSubscription: $(ServiceConnection)
    action: "Swap Slots"
    appName: app-chat-frontend-pme-prod-wus
    resourceGroup: rg-chat-frontend-pme-prod
    sourceSlot: "staging"
    destSlot: "production"
```

#### 2. Azure Functions (Backend Worker Model)

**Deployment Configuration:**
```bicep
resource functionApp 'Microsoft.Web/sites@2023-01-01' = {
  name: 'func-chat-backend-${environment}-${location}'
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'DOTNET-ISOLATED|10.0'  // Isolated worker model
    }
  }
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'stchatfunc${environment}${location}'
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'  // Local redundancy
  }
}

// Function app connection to storage
resource appSetting 'Microsoft.Web/sites/config@2023-01-01' = {
  parent: functionApp
  name: 'appsettings'
  properties: {
    AzureWebJobsStorage: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};...'
    FUNCTIONS_WORKER_RUNTIME: 'dotnet-isolated'
  }
}
```

**Trigger Configuration in Code:**
```csharp
// Service Bus trigger function
[Function("ProcessOrderUpdate")]
public async Task RunAsync(
    [ServiceBusTrigger("orders", Connection = "ServiceBusConnection")] 
    ServiceBusReceivedMessage message,
    FunctionContext context)
{
    var logger = context.GetLogger("ProcessOrderUpdate");
    logger.LogInformation("Processing order: {MessageId}", message.MessageId);
}
```

#### 3. Azure Cosmos DB (NoSQL Database)

**Purpose:** All operational data storage across all 13 domains

**Bicep Definition:**
```bicep
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' = {
  name: 'cosmos-${environment}-${location}'
  location: location
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [
      {
        locationName: location
        failoverPriority: 0
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Eventual'  // Eventual consistency
      maxIntervalInSeconds: 5
      maxStalenessPrefix: 100
    }
  }
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-04-15' = {
  parent: cosmosAccount
  name: 'orders'
  properties: {
    resource: {
      id: 'orders'
    }
  }
}

resource container 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'orders'
  properties: {
    resource: {
      id: 'orders'
      partitionKey: {
        paths: ['/customerId']  // Partition by customer
      }
      indexingPolicy: {
        indexingMode: 'consistent'
      }
    }
    options: {
      throughput: environment == 'prod' ? 10000 : 400  // RUs
    }
  }
}
```

**C# Usage Pattern:**
```csharp
// IStorage<T> abstraction (custom SupportServices pattern)
public class OrderStorage : IStorage<Order>
{
    private readonly CosmosClient _cosmosClient;
    
    public async Task<Order> CreateAsync(Order order)
    {
        var container = _cosmosClient.GetContainer("orders", "orders");
        var response = await container.CreateItemAsync(order, 
            new PartitionKey(order.CustomerId));
        return response.Resource;
    }
    
    public async Task<Order> GetAsync(string id, string customerId)
    {
        var container = _cosmosClient.GetContainer("orders", "orders");
        try
        {
            var response = await container.ReadItemAsync<Order>(id, 
                new PartitionKey(customerId));
            return response.Resource;
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            throw new NotFoundException($"Order {id} not found");
        }
    }
    
    public async Task<IEnumerable<Order>> QueryAsync(string query)
    {
        var container = _cosmosClient.GetContainer("orders", "orders");
        var iterator = container.GetItemQueryIterator<Order>(query);
        var results = new List<Order>();
        
        while (iterator.HasMoreResults)
        {
            results.AddRange(await iterator.ReadNextAsync());
        }
        
        return results;
    }
}
```

**Partition Key Strategy:**
- ✅ **Good:** `customerId` (even distribution, frequently filtered)
- ✅ **Good:** `tenantId` (multi-tenant, logical isolation)
- ❌ **Bad:** `status` (hot partitions, skewed distribution)
- ❌ **Bad:** `timestamp` (sequential, all new items in one partition)

#### 4. Azure Storage

**Blob Storage (Unstructured Data):**
```bicep
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'stcontent${environment}wus'
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    accessTier: 'Hot'
  }
}

resource blobContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  name: '${storageAccount.name}/default/documents'
  properties: {
    publicAccess: 'None'
  }
}
```

**C# Usage:**
```csharp
var blobClient = new BlobClient(new Uri("https://stcontent.blob.core.windows.net/documents/file.pdf"));
var download = await blobClient.DownloadAsync();
using (var file = File.OpenWrite("file.pdf"))
{
    await download.Value.Content.CopyToAsync(file);
}
```

**Queue Storage (Async Messaging):**
```bicep
resource queueService 'Microsoft.Storage/storageAccounts/queueServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
}

resource queue 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-01-01' = {
  parent: queueService
  name: 'notifications'
  properties: {
    metadata: {}
  }
}
```

#### 5. Azure Service Bus (Pub/Sub & Queuing)

**Why Service Bus vs Storage Queue?**

| Aspect | Storage Queue | Service Bus |
|--------|---|---|
| **Message size** | 64 KB | 256 KB |
| **TTL** | 7 days | Configurable |
| **Topics** | No (queues only) | Yes (pub/sub) |
| **DLQ** | Manual | Automatic |
| **Transactions** | Single message | Batch operations |
| **Cost** | $0.05/million ops | Fixed per hour |

**Bicep Definition:**
```bicep
resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' = {
  name: 'sb-${environment}-${location}'
  location: location
  sku: {
    name: 'Standard'  // Premium for prod recommended
    tier: 'Standard'
  }
}

resource topic 'Microsoft.ServiceBus/namespaces/topics@2022-10-01-preview' = {
  parent: serviceBusNamespace
  name: 'orders'
  properties: {
    enablePartitioning: true  // Partition for throughput
    maxSizeInMegabytes: 1024
  }
}

resource subscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2022-10-01-preview' = {
  parent: topic
  name: 'orderprocessor'
  properties: {
    autoDeleteOnIdle: 'P14D'  // Cleanup idle subscriptions
  }
}
```

**C# Sender:**
```csharp
var sender = new ServiceBusClient(connection).CreateSender("orders");
var message = new ServiceBusMessage(JsonSerializer.SerializeToUtf8Bytes(order))
{
    CorrelationId = order.CorrelationId,
    Subject = "OrderCreated"
};
await sender.SendMessageAsync(message);
```

**C# Receiver (Function):**
```csharp
[Function("ProcessOrder")]
public async Task RunAsync(
    [ServiceBusTrigger("orders", "orderprocessor")] 
    ServiceBusReceivedMessage message,
    FunctionContext context)
{
    var order = JsonSerializer.Deserialize<Order>(message.Body);
    await _orderService.ProcessAsync(order);
    // Message auto-completes on success, goes to DLQ on exception
}
```

#### 6. Application Insights (Telemetry & APM)

**Bicep Definition:**
```bicep
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'ai-${environment}-${location}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    RetentionInDays: environment == 'prod' ? 90 : 30
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}
```

**ASP.NET Core Integration:**
```csharp
builder.Services.AddApplicationInsightsTelemetry(
    builder.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"]);

// Automatic collection:
// - HTTP requests
// - Dependencies (SQL, HTTP, Redis)
// - Exceptions
// - Performance counters
```

**Custom Telemetry:**
```csharp
public class OrderService
{
    private readonly TelemetryClient _telemetryClient;
    
    public OrderService(TelemetryClient telemetryClient)
    {
        _telemetryClient = telemetryClient;
    }
    
    public async Task<Order> CreateAsync(CreateOrderRequest request)
    {
        var properties = new Dictionary<string, string>
        {
            { "OrderTotal", request.Total.ToString() },
            { "CustomerSegment", request.Segment }
        };
        var measurements = new Dictionary<string, double>
        {
            { "LineItemCount", request.Items.Count }
        };
        
        _telemetryClient.TrackEvent("OrderCreated", properties, measurements);
        
        // Create order...
        return order;
    }
}
```

**KQL Queries (Kusto Query Language):**
```kusto
// Top slowest API calls
requests
| where name contains "api/orders"
| summarize avg(duration), max(duration), percentile(duration, 95) by name
| sort by avg_duration desc
```

#### 7. Azure Key Vault (Secrets Management)

**Bicep Definition:**
```bicep
resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: 'kv-${environment}-${location}'
  location: location
  properties: {
    enabledForDeployment: true
    enabledForTemplateDeployment: true
    enabledForDiskEncryption: false
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    accessPolicies: [
      {
        tenantId: subscription().tenantId
        objectId: principalId  // Managed identity
        permissions: {
          secrets: ['get', 'list']
        }
      }
    ]
  }
}

resource dbPassword 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'db-password'
  properties: {
    value: dbPasswordValue  // Passed as parameter
  }
}
```

**C# Usage:**
```csharp
// Automatic by ASP.NET Core
var secretClient = new SecretClient(
    new Uri($"https://kv-{environment}.vault.azure.net"), 
    new DefaultAzureCredential());

var secret = await secretClient.GetSecretAsync("db-password");
var password = secret.Value.Value;
```

#### 8. Azure Front Door (Global CDN & DDoS Protection)

**Bicep Definition:**
```bicep
resource frontDoor 'Microsoft.Cdn/profiles@2023-05-01' = {
  name: 'fd-supportservices-${environment}'
  location: 'global'
  sku: {
    name: 'Premium_AzureFrontDoor'  // Premium for geo-distribution
  }
  properties: {
    originResponseTimeoutSeconds: 60
  }
}

resource endpoint 'Microsoft.Cdn/profiles/afdEndpoints@2023-05-01' = {
  parent: frontDoor
  name: 'api-${environment}'
  properties: {
    enabledState: 'Enabled'
  }
}
```

**Benefits:**
- ✅ Global edge caching
- ✅ DDoS protection (built-in)
- ✅ WAF (Web Application Firewall)
- ✅ SSL/TLS termination
- ✅ Compression
- ✅ Request routing rules

#### 9. Azure Search / Cognitive Search

**Used in:** Search domain for full-text search and semantic search

```bicep
resource searchService 'Microsoft.Search/searchServices@2023-11-01' = {
  name: 'search-${environment}-${location}'
  location: location
  sku: {
    name: environment == 'prod' ? 'standard' : 'basic'
  }
  properties: {
    replicaCount: environment == 'prod' ? 3 : 1
    partitionCount: environment == 'prod' ? 2 : 1
  }
}

resource index 'Microsoft.Search/searchServices/indexes@2023-11-01' = {
  parent: searchService
  name: 'documents'
  properties: {
    fields: [
      {
        name: 'id'
        type: 'Edm.String'
        key: true
      },
      {
        name: 'content'
        type: 'Edm.String'
        searchable: true
        retrievable: true
      }
    ]
  }
}
```

**C# Usage:**
```csharp
var client = new SearchClient(endpoint, indexName, credential);

// Full-text search
var results = await client.SearchAsync<SearchDocument>("xbox refund");

// Semantic search (AI-powered)
var options = new SearchOptions { QueryLanguage = "en-us", QueryType = SearchQueryType.Semantic };
results = await client.SearchAsync<SearchDocument>("how to return a game", options);
```

### Bicep Infrastructure as Code

**Two-Tier Deployment Pattern:**

```
Subscription Level (Global Resources)
├── Resource Groups
├── Managed Identities
└── Role Assignments
    │
    ├→ Resource Group Level (Domain-Specific)
      ├── App Service Plan
      ├── App Service (Frontend)
      ├── Function App (Backend)
      ├── Cosmos DB Container
      ├── Storage Account
      └── Application Insights
```

**Bicep Benefits:**
- ✅ **Type-safe** — Compile-time error checking
- ✅ **No JSON duplication** — Cleaner syntax
- ✅ **Intellisense** — IDE support
- ✅ **Loops & conditions** — Reduce repetition
- ✅ **Modular** — Reusable modules

---

## Database & Storage

### Cosmos DB (Primary Database)

**Design Pattern: IStorage<T> Abstraction**

```csharp
// Common/Azure.CosmosDb/IStorage.cs
public interface IStorage<T> where T : IStorageModel
{
    Task<T> CreateAsync(T entity);
    Task<T> GetAsync(string id, string partitionKey);
    Task<T> UpdateAsync(T entity);
    Task DeleteAsync(string id, string partitionKey);
    Task<IEnumerable<T>> QueryAsync(string query);
}

// Refunds domain implementation
public class RefundStorage : IStorage<Refund>
{
    private readonly IContainer _container;
    
    public async Task<Refund> CreateAsync(Refund refund)
    {
        var response = await _container.CreateItemAsync(refund, 
            new PartitionKey(refund.CustomerId));
        return response.Resource;
    }
}
```

**Partition Key Strategy:**
```csharp
// Good: Evenly distributed, frequently filtered
public class Order : IStorageModel
{
    [JsonPropertyName("id")]
    public string Id { get; set; }  // Unique per partition
    
    [JsonPropertyName("customerId")]
    public string CustomerId { get; set; }  // Partition key
    
    public string Status { get; set; }
    public DateTime CreatedDate { get; set; }
}

// Usage:
var response = await container.ReadItemAsync<Order>(orderId, 
    new PartitionKey(customerId));
```

**Batch Operations:**
```csharp
var batch = new List<Order> { order1, order2, order3 };

using (var batch = container.CreateTransactionalBatch(new PartitionKey(customerId)))
{
    foreach (var order in batch)
    {
        batch.CreateItem(order);
    }
    var result = await batch.ExecuteAsync();
}
```

**Querying:**
```csharp
var query = "SELECT * FROM c WHERE c.status = 'completed' AND c.total > @amount";
var iterator = container.GetItemQueryIterator<Order>(query, 
    parameters: new[] { new QueryParameter("@amount", 100) });

while (iterator.HasMoreResults)
{
    var page = await iterator.ReadNextAsync();
    // Process page
}
```

### Azure Storage Services

**Blob Storage (Document Storage):**
```csharp
var containerClient = new BlobContainerClient(
    new Uri("https://stcontent.blob.core.windows.net/documents"), 
    new DefaultAzureCredential());

// Upload
var blobClient = containerClient.GetBlobClient("document.pdf");
using (var fileStream = File.OpenRead("document.pdf"))
{
    await blobClient.UploadAsync(fileStream, overwrite: true);
}

// Download
var download = await blobClient.DownloadAsync();
using (var fileStream = File.OpenWrite("downloaded.pdf"))
{
    await download.Value.Content.CopyToAsync(fileStream);
}

// List
await foreach (var blobItem in containerClient.GetBlobsAsync())
{
    Console.WriteLine(blobItem.Name);
}
```

**Queue Storage (Async Messaging):**
```csharp
var queueClient = new QueueClient(
    new Uri("https://stcontent.queue.core.windows.net/notifications"),
    new DefaultAzureCredential());

// Send message
await queueClient.SendMessageAsync(JsonSerializer.Serialize(notification));

// Receive and process
QueueMessage[] messages = await queueClient.ReceiveMessagesAsync(maxMessages: 10);
foreach (var message in messages)
{
    var notification = JsonSerializer.Deserialize<Notification>(message.MessageText);
    await ProcessNotificationAsync(notification);
    await queueClient.DeleteMessageAsync(message.MessageId, message.PopReceipt);
}
```

**Table Storage (NoSQL Key-Value):**
```csharp
var tableClient = new TableClient(
    new Uri("https://stcontent.table.core.windows.net"),
    "users",
    new DefaultAzureCredential());

// Create entity
var entity = new TableEntity(partitionKey: "xbox", rowKey: "user123")
{
    { "Name", "John" },
    { "Email", "john@xbox.com" }
};
await tableClient.AddEntityAsync(entity);

// Query
var query = tableClient.QueryAsync<TableEntity>($"PartitionKey eq 'xbox'");
```

---

## Authentication & Security

### Xbox Live XToken (XBL 3.0)

**Used in:** Xbox-focused domains (Refunds, Notifications, Tokens)

```csharp
// Startup
builder.Services.AddXbl30(options =>
{
    options.Authority = "https://xsts.xbox.com";
    options.Audience = "https://identity.xbox.com";
});

// Controller usage
[ApiController]
[Route("api/[controller]")]
[Authorize(AuthenticationSchemes = "XBL")]
public class RefundsController : ControllerBase
{
    [HttpGet("my-refunds")]
    public async Task<ActionResult> GetMyRefunds()
    {
        var xuid = User.FindFirst(XBoxClaimTypes.Xuid)?.Value;
        var refunds = await _refundService.GetByXuidAsync(xuid);
        return Ok(refunds);
    }
}
```

**XToken Claims:**
```csharp
public static class XBoxClaimTypes
{
    public const string Xuid = "http://schemas.microsoft.com/identity/claims/identityprovider";
    public const string Gamertag = "gamertag";
    public const string XboxLiveAccountId = "xboxliveid";
}
```

### Entra ID (Azure AD)

**For:** Service-to-service, partner authentication

```csharp
// Startup
builder.Services.AddAzureAppRegistrationAuthentication();
builder.Services.UseMise();  // MISE v2 middleware

// In controller
[Authorize]
public async Task<ActionResult> GetOrderHistory()
{
    var userId = User.GetObjectId();
    var orders = await _orderService.GetByUserAsync(userId);
    return Ok(orders);
}

// Service-to-service
var credential = new DefaultAzureCredential();
var client = new SecretClient(new Uri($"https://kv-{env}.vault.azure.net"), credential);
```

### Managed Identity (Passwordless Auth)

**Replaces connection strings and secrets:**

```bicep
resource functionApp 'Microsoft.Web/sites@2023-01-01' = {
  identity: {
    type: 'SystemAssigned'  // Enables Managed Identity
  }
}

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: cosmosDb
  properties: {
    roleDefinitionId: '/subscriptions/{subId}/providers/Microsoft.Authorization/roleDefinitions/{roleDef}'
    principalId: functionApp.identity.principalId
  }
}
```

**C# Usage (no secrets needed):**
```csharp
// Automatically uses managed identity
var cosmosClient = new CosmosClient(
    $"https://cosmos-{env}.documents.azure.com:443/",
    new DefaultAzureCredential());
```

### Azure Key Vault

**Secrets Management:**

```csharp
// Configuration binding
builder.Configuration.AddAzureKeyVault(
    new Uri($"https://kv-{env}.vault.azure.net"),
    new DefaultAzureCredential());

// Access in code
var connectionString = configuration["DatabaseConnectionString"];
```

---

## Testing & Quality Assurance

### MSTest Framework

**Covered extensively in Backend Technologies section above**

### Test Categories

```bash
# Run only unit tests (fast)
dotnet test --filter "TestCategory=Unit"

# Run all tests including functional (slow)
dotnet test

# Run specific test class
dotnet test --filter "FullyQualifiedName~RefundCreationTests"

# Run by namespace
dotnet test --filter "FullyQualifiedName~SupportServices.Refunds.Frontend.Tests"
```

### Code Quality Tools

| Tool | Purpose | Configuration |
|------|---------|---|
| **SonarAnalyzer** | Static code analysis | `.editorconfig` |
| **StyleCop** | Code style enforcement | StyleCop.json |
| **Visual Studio Analyzers** | IDE diagnostics | Built-in |

**Example .editorconfig:**
```
root = true

# C# files
[*.cs]
charset = utf-8
indent_style = space
indent_size = 4
trim_trailing_whitespace = true
insert_final_newline = true

# Naming conventions
dotnet_naming_rule.constants_rule.severity = suggestion
dotnet_naming_rule.constants_rule.symbols = constants_symbols
dotnet_naming_style.constants_style.capitalization = all_upper
```

---

## Domain-Specific Technologies

### Chat Domain

**Stack:** ASP.NET Core Frontend + Azure Functions Backend + Cosmos DB

**Integrations:**
- OneCustomerConnector (customer data aggregation)
- Xbox Identity (XBL 3.0 auth)
- Chat orchestration services

### Conversations Domain

**Stack:** ASP.NET Core + Azure Functions + Cosmos DB + AI Services

**Key Technologies:**
- **Azure OpenAI** — GPT-4 integration for chatbot
- **Document Intelligence** — OCR for document processing
- **Semantic Kernel** — Orchestration framework
- **Content Safety** — Content moderation

**Example:**
```csharp
using Azure.AI.OpenAI;

var client = new OpenAIClient(new Uri(endpoint), new DefaultAzureCredential());

var chatCompletionsOptions = new ChatCompletionsOptions()
{
    DeploymentName = "gpt-4",
    Messages = {
        new ChatMessage(ChatRole.User, "Help me with my Xbox issue")
    }
};

var response = await client.GetChatCompletionsAsync(chatCompletionsOptions);
var reply = response.Value.Choices[0].Message.Content;
```

### Search Domain

**Stack:** ASP.NET Core Frontend + Azure Functions (Indexers) + Azure Cognitive Search

**Components:**
- **Main Indexer** — Indexes documents into Azure Search
- **SVA Indexer** — Sub-domain specific indexing
- **Kusto Queries** — Analytics on search patterns
- **MCP (Model Context Protocol)** — Tool integration

**Indexing Pattern:**
```csharp
[Function("DocumentIndexer")]
public async Task IndexDocumentsAsync(
    [TimerTrigger("0 2 * * *")] TimerInfo timer,
    FunctionContext context)
{
    var documents = await _documentService.GetAllAsync();
    var searchClient = new SearchClient(endpoint, "documents", credential);
    
    var actions = documents.Select(d => 
        IndexDocumentsAction.Upload(d)).ToList();
    
    var batch = IndexDocumentsBatch.Create(actions);
    var result = await searchClient.IndexDocumentsAsync(batch);
}
```

### Loyalty Domain

**Stack:** React 19.2.4 + ASP.NET Core Backend + Cosmos DB

**Frontend:**
- Redux for state management
- Fluent UI for components
- TypeScript for type safety

**Backend:**
- Loyalty points calculation
- Reward redemption
- Tier management

### Notifications & MessageFulfillment

**Stack:** Azure Functions + Service Bus + Cosmos DB + Storage

**Message Pipeline:**
```
MessageTrigger (detects new message)
    ↓
MessageBatcher (batches messages)
    ↓
MessageSender (sends via email/SMS)
    ↓
Audit logging (Cosmos DB)
```

---

## Technologies Not Used (With Best Practices)

### Not Used: SQL Server / Entity Framework Core

**Why Not?**
- SupportServices is cloud-native
- Cosmos DB chosen for global scale, no-schema flexibility
- SQL Server would add operational overhead (patches, backups)

**When to Use SQL Server:**
- ✅ Relational data with complex joins
- ✅ ACID transactions across multiple tables
- ✅ On-premises legacy systems
- ✅ Structured, normalized data

**EF Core Best Practices:**
```csharp
// DbContext pattern (if using SQL)
public class OrderContext : DbContext
{
    public DbSet<Order> Orders { get; set; }
    
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Order>()
            .HasKey(o => o.Id);
        
        modelBuilder.Entity<Order>()
            .Property(o => o.CreatedDate)
            .HasDefaultValueSql("GETUTCDATE()");
    }
}

// Usage
using (var context = new OrderContext())
{
    context.Orders.Add(new Order { ... });
    await context.SaveChangesAsync();
}
```

### Not Used: MongoDB

**Why Not?**
- Cosmos DB supports multiple APIs (SQL, MongoDB, Cassandra, Table)
- MongoDB would require separate infrastructure
- Cosmos DB provides better global distribution, compliance

**When to Use MongoDB:**
- ✅ Document-oriented data (similar to Cosmos DB)
- ✅ Flexible schemas
- ✅ Horizontal scaling
- ✅ Development speed

**MongoDB Best Practices:**
```csharp
// C# driver pattern
var client = new MongoClient("mongodb://localhost:27017");
var database = client.GetDatabase("orders");
var collection = database.GetCollection<Order>("orders");

// Insert
await collection.InsertOneAsync(new Order { ... });

// Query
var orders = await collection.Find(o => o.CustomerId == customerId)
    .ToListAsync();

// Aggregation
var pipeline = new[] {
    new BsonDocument("$match", new BsonDocument("status", "pending")),
    new BsonDocument("$group", new BsonDocument
    {
        { "_id", "$customerId" },
        { "total", new BsonDocument("$sum", "$amount") }
    })
};

var results = await collection.AggregateAsync<BsonDocument>(pipeline);
```

### Not Used: Node.js Backend

**Why Not?**
- Team expertise in C# and .NET
- .NET 10 has superior performance benchmarks
- All service integrations built for .NET

**When to Use Node.js:**
- ✅ Real-time applications (WebSockets)
- ✅ JavaScript monoliths (same language frontend/backend)
- ✅ Rapid prototyping
- ✅ Microservices with polyglot teams

**Node.js Best Practices:**
```typescript
// Express.js pattern
import express from 'express'

const app = express()
app.use(express.json())

// Middleware
app.use((req, res, next) => {
  req.userId = extractFromToken(req.headers.authorization)
  next()
})

// Routes
app.get('/api/orders/:id', async (req, res) => {
  const order = await orderService.getById(req.params.id)
  res.json(order)
})

// Error handling
app.use((err, req, res, next) => {
  logger.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(3000)
```

### Not Used: Kubernetes / Docker

**Why Not?**
- Azure App Services and Functions abstracts container complexity
- No need to manage container orchestration
- Lower operational overhead

**When to Use Kubernetes:**
- ✅ Multi-cloud deployments
- ✅ Complex microservices (100+ services)
- ✅ Custom resource requirements
- ✅ Hybrid on-premises + cloud

**Kubernetes Best Practices:**
```yaml
# Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chat-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: chat-api
  template:
    metadata:
      labels:
        app: chat-api
    spec:
      containers:
      - name: chat-api
        image: acr.azurecr.io/chat-api:1.0.0
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 10
```

### Not Used: Terraform

**Why Not?**
- Bicep is Microsoft's native IaC language for Azure
- Bicep optimized for Azure resource definitions
- Team expertise in Bicep

**When to Use Terraform:**
- ✅ Multi-cloud deployments (AWS, Azure, GCP)
- ✅ Infrastructure shared across cloud providers
- ✅ Complex module reuse across organizations

**Terraform Best Practices:**
```hcl
# main.tf
provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "rg" {
  name     = "rg-${var.environment}"
  location = var.location
}

resource "azurerm_app_service_plan" "plan" {
  name                = "asp-${var.environment}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  kind                = "Linux"
  
  sku {
    tier = var.environment == "prod" ? "Premium" : "Basic"
    size = var.environment == "prod" ? "P1V2" : "B1"
  }
}

variable "environment" {
  type = string
  validation {
    condition     = contains(["dev", "int", "prod"], var.environment)
    error_message = "Environment must be dev, int, or prod."
  }
}

variable "location" {
  type    = string
  default = "eastus"
}

output "app_service_plan_id" {
  value = azurerm_app_service_plan.plan.id
}
```

### Not Used: GraphQL

**Why Not?**
- REST APIs sufficient for current requirements
- GraphQL adds complexity without clear benefit
- Team expertise in REST

**When to Use GraphQL:**
- ✅ Complex nested data relationships
- ✅ Client-driven query optimization
- ✅ Multiple data sources (aggregation)
- ✅ Real-time subscriptions

**GraphQL Best Practices:**
```typescript
// Apollo Server pattern
import { ApolloServer, gql } from 'apollo-server-express'

const typeDefs = gql`
  type Query {
    order(id: ID!): Order
    orders(limit: Int): [Order]
  }
  
  type Order {
    id: ID!
    customerId: ID!
    customer: Customer
    total: Float!
    items: [OrderItem]
  }
  
  type Customer {
    id: ID!
    name: String!
  }
  
  type OrderItem {
    id: ID!
    productId: ID!
    quantity: Int!
    price: Float!
  }
`

const resolvers = {
  Query: {
    order: async (_, { id }) => {
      return await orderService.getById(id)
    }
  },
  Order: {
    customer: async (order) => {
      return await customerService.getById(order.customerId)
    }
  }
}

const server = new ApolloServer({ typeDefs, resolvers })
```

### Not Used: Selenium / UI Automation

**Why Not?**
- Backend-heavy repository (13 domains, 1 frontend)
- Frontend tests use React Testing Library (unit/component level)
- No browser automation needed at scale

**When to Use Selenium:**
- ✅ E2E testing of web applications
- ✅ Cross-browser compatibility testing
- ✅ Legacy system automation
- ✅ Complex user workflows

**Selenium Best Practices:**
```csharp
// C# Selenium pattern
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;

[TestClass]
public class OrderCheckoutTests
{
    private IWebDriver driver;
    
    [TestInitialize]
    public void Setup()
    {
        driver = new ChromeDriver("./chromedriver");
        driver.Manage().Timeouts().ImplicitWait = TimeSpan.FromSeconds(10);
    }
    
    [TestMethod]
    public void CheckoutFlow_CompleteOrder_Success()
    {
        driver.Navigate().GoToUrl("https://localhost:3000");
        
        // Click add to cart
        var addButton = driver.FindElement(By.Id("add-to-cart"));
        addButton.Click();
        
        // Verify item added
        var cart = driver.FindElement(By.ClassName("cart-count"));
        Assert.AreEqual("1", cart.Text);
        
        // Proceed to checkout
        var checkoutButton = driver.FindElement(By.Id("checkout"));
        checkoutButton.Click();
        
        // Verify checkout page loaded
        var waitDriver = new WebDriverWait(driver, TimeSpan.FromSeconds(10));
        waitDriver.Until(ExpectedConditions.PresenceOfAllElementsLocatedBy(By.Id("payment-form")));
    }
    
    [TestCleanup]
    public void Cleanup()
    {
        driver.Quit();
    }
}
```

### Not Used: React Native

**Why Not?**
- No mobile applications in this repository
- Focus is web APIs and backend services
- Desktop/web-only strategy

**When to Use React Native:**
- ✅ iOS and Android apps
- ✅ Code sharing between mobile platforms
- ✅ JavaScript team expertise
- ✅ Rapid mobile prototyping

**React Native Best Practices:**
```typescript
// React Native pattern
import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useQuery } from '@tanstack/react-query'

const OrderScreen: React.FC = () => {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => fetch('/api/orders').then(r => r.json())
  })
  
  if (isLoading) return <Text>Loading...</Text>
  
  return (
    <View style={{ flex: 1, padding: 10 }}>
      {orders?.map(order => (
        <TouchableOpacity key={order.id} onPress={() => navigateToDetail(order.id)}>
          <Text>{order.id} - ${order.total}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

export default OrderScreen
```

---

## Architecture Patterns

### Layered Domain Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND LAYER                        │
│  ├─ Controllers (HTTP endpoints)                             │
│  ├─ Request/Response Models                                  │
│  └─ Authorization middleware                                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      BUSINESS LOGIC LAYER                    │
│  ├─ Service classes                                          │
│  ├─ Domain models                                            │
│  ├─ Business rules & validation                              │
│  └─ Orchestration                                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     DATA ACCESS LAYER                        │
│  ├─ IStorage<T> abstraction                                  │
│  ├─ Cosmos DB client                                         │
│  ├─ Query builders                                           │
│  └─ Caching                                                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                      │
│  ├─ Cosmos DB (NoSQL)                                        │
│  ├─ Azure Storage (Blobs, Queues)                            │
│  ├─ Application Insights (Telemetry)                         │
│  └─ Key Vault (Secrets)                                      │
└─────────────────────────────────────────────────────────────┘
```

### Shared Infrastructure (Common Libraries)

```
Common/
├─ Common.AspNetCore
│  ├─ Authentication (XBL, Entra ID)
│  ├─ Error handling (ErrorCodeResultFactory)
│  └─ Middleware (MISE, Correlation)
│
├─ Common.Azure.CosmosDb
│  ├─ IStorage<T> interface
│  ├─ Cosmos client configuration
│  └─ Query helpers
│
├─ Common.Azure
│  ├─ Managed identity
│  ├─ Key Vault client
│  └─ Azure service clients
│
├─ Common.Logging
│  ├─ Structured logging
│  ├─ Application Insights integration
│  └─ Correlation ID tracking
│
├─ Common.Http
│  ├─ Typed HTTP clients
│  ├─ Resilience policies (retry, timeout)
│  └─ Request/response logging
│
└─ Common.Clients
   ├─ OneCustomerConnector (Xbox profile)
   ├─ Dynamics CRM (Refunds)
   └─ XToken service (Xbox Live tokens)
```

---

## Interview Key Concepts

### 1. Why .NET 10 Over Competitors?

**Interview Answer:**
"We chose .NET 10 because:
- **Performance**: Benchmarked 3-5x faster than Node.js for CPU-intensive operations
- **Type safety**: C# strict typing catches 40% more bugs than JavaScript
- **Maturity**: 20+ years in production; proven reliability
- **Azure integration**: Native support for all Azure services
- **Team expertise**: Team has deep C# experience
- **LTS support**: 3-year support commitment from Microsoft"

### 2. Why Cosmos DB Over SQL Server?

**Interview Answer:**
"Cosmos DB provides:
- **Global distribution**: <10ms latency worldwide (SQL Server: single region)
- **Elastic scale**: Auto-scale from 400 to millions of RU/s (SQL: vertical scaling)
- **No schema enforcement**: Flexible schema for rapidly evolving domains
- **Built-in replication**: Multi-region failover automatic (SQL: manual setup)
- **Cost model**: Pay per RU, stop paying when not used (SQL: always running)
- **SLA**: 99.99% guaranteed (vs 99.9% SQL)

**Trade-off**: Eventual consistency instead of strong ACID"

### 3. Frontend: React vs Angular vs Vue?

**Interview Answer:**
"We chose React because:
- **Ecosystem**: Largest ecosystem (100k+ npm packages)
- **Component reuse**: Unidirectional data flow = easier debugging
- **Performance**: Virtual DOM optimizations, fast re-renders
- **JSX**: More intuitive (HTML-like syntax vs template strings)
- **Adoption**: 65% of new web projects (vs 20% Angular)
- **Learning curve**: Faster to onboard new developers

**For our use case**: Loyalty Portal has moderate complexity; React sweet spot"

### 4. Testing Strategy: Unit vs Integration vs E2E?

**Interview Answer:**
```
Test Pyramid:
         /\
        /E2E\ (1-2% of tests) — Full user workflows
       /------\
      /Integ-\ (15-20% of tests) — API + DB
     /--------\
    /Unit    \ (75-85% of tests) — Single class, no dependencies
   /----------\
```

"We focus on unit tests:
- **Cost**: Unit tests run in milliseconds
- **Reliability**: No external dependencies = no flakiness
- **Feedback**: Developers get results in seconds vs minutes
- **Coverage**: Easy to maintain 80%+ coverage

Functional tests validate end-to-end flows but run selectively"

### 5. Security: Managed Identity vs Connection Strings?

**Interview Answer:**
"Managed Identity eliminates credential management:
- **No secrets**: No connection strings, passwords, or API keys to rotate
- **Automatic rotation**: Azure handles token refresh
- **Auditability**: Every API call logged with service identity
- **Compliance**: Meets SOC 2, HIPAA requirements

Example: Function app connects to Cosmos DB without any credentials — just identity-based RBAC"

### 6. CI/CD: Why Official vs NonOfficial Pipelines?

**Interview Answer:**
"Dual pipelines solve the speed/safety tension:

| Need | NonOfficial | Official |
|------|-------------|----------|
| Developer feedback | 10 min | 25 min |
| Security scanning | Report | Enforced |
| Environments | Dev/Int | All |
| Manual gates | None | After int |

NonOfficial fires on every commit → fast feedback loop
Official enforces security → production safety"

### 7. Database Design: Partition Keys?

**Interview Answer:**
"Good partition keys:
- **Distribute evenly**: Avoid hot partitions
- **Frequent filtering**: Often appear in WHERE clauses
- **Immutable**: Don't change after insert

Example:
- ✅ `customerId` (evenly distributed, filtered every query)
- ❌ `status` (skewed: 80% 'completed', 20% 'pending')
- ❌ `timestamp` (sequential: all new items in one partition)"

---

## Summary

### Technology Stack at a Glance

```
FRONTEND              BACKEND                CLOUD & DEVOPS
├─ React 19.2.4       ├─ C# / .NET 10.0       ├─ Azure App Service
├─ TypeScript 5.6.3   ├─ ASP.NET Core         ├─ Azure Functions
├─ Redux + Thunk      ├─ Azure Functions      ├─ Cosmos DB
├─ Fluent UI          ├─ Durable Functions    ├─ Service Bus
├─ Vite 6.3.5         ├─ MSTest 4.2.3         ├─ Key Vault
├─ Jest 29.7.0        ├─ Moq 4.20.72          ├─ Application Insights
├─ ESLint             ├─ FluentAssertions     ├─ Azure Search
└─ Prettier           └─ Snapper              └─ Front Door

DATABASES             INFRASTRUCTURE         SECURITY
├─ Cosmos DB          ├─ Bicep 0.43.8         ├─ XBL 3.0 (Xbox)
├─ Blob Storage       ├─ YAML pipelines       ├─ Entra ID (Azure AD)
├─ Queue Storage      ├─ OneBranch            ├─ Managed Identity
└─ Table Storage      └─ 13 domains           └─ Key Vault
```

### What's Not Used

- ❌ SQL Server / Entity Framework
- ❌ MongoDB
- ❌ Node.js backend
- ❌ Kubernetes / Docker
- ❌ Terraform (Bicep instead)
- ❌ GraphQL
- ❌ Selenium
- ❌ React Native
- ❌ WCF / SOAP

---

**This guide is production-ready, interview-prepared, and comprehensive for learning the full SupportServices technology landscape.**
