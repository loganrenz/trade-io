# Task Assignment for Parallel Agent

**Date**: 2025-12-13
**Your Role**: Complete Phase 4 (Part B) - Execution & Events
**Coordination**: Work in parallel with primary agent on Phase 4

---

## 🎯 Your Mission

Complete the second half of Phase 4 (Order Lifecycle & Execution) while the primary agent works on the first half. We're splitting work to maximize parallelization and efficiency.

---

## 📋 Your Task List (5 Issues)

### Issue #0042: Execution Simulator Core ✅
**Complexity**: Large (L) - ~60k tokens
**File**: `docs/issues/0042-execution-simulator.md`

**What to Build**:
- Create `server/lib/execution-simulator.ts` - Paper trading execution engine
- Implement market order instant execution
- Implement limit order matching logic
- Price simulation using latest quotes
- Integration with Order and Execution models
- Comprehensive unit tests

**Key Functions**:
- `executeMarketOrder(order)` - Instant fill at current price
- `executeLimitOrder(order, currentPrice)` - Conditional matching
- `createExecution(order, fillPrice, fillQty)` - Record execution
- `updateOrderStatus(order, executions)` - Order lifecycle management

**Dependencies**: Issues #0037-#0041 completed by primary agent

---

### Issue #0043: Partial Fill Support ✅
**Complexity**: Medium (M) - ~35k tokens
**File**: `docs/issues/0043-partial-fills.md`

**What to Build**:
- Extend execution simulator for partial fills
- Add `fillQuantity` tracking vs `orderQuantity`
- Handle PARTIAL order status
- Support multiple executions per order
- Tests for partial fill scenarios

**Key Features**:
- Multiple execution records for single order
- Cumulative fill quantity tracking
- Order status transitions (ACCEPTED → PARTIAL → FILLED)
- Average fill price calculation

**Dependencies**: Issue #0042 must be complete

---

### Issue #0044: Time-in-Force Handling ✅
**Complexity**: Medium (M) - ~35k tokens
**File**: `docs/issues/0044-time-in-force.md`

**What to Build**:
- Implement DAY (expire at market close)
- Implement GTC (Good 'Til Cancelled)
- Implement IOC (Immediate or Cancel)
- Implement FOK (Fill or Kill)
- Expiration logic and cleanup job

**Key Components**:
- `checkTimeInForce(order)` - Validation logic
- `expireOrders()` - Batch expiration job
- `handleIOC(order)` - Immediate or cancel logic
- `handleFOK(order)` - All or nothing logic

**Dependencies**: Issues #0042-#0043 complete

---

### Issue #0045: Slippage Simulation ✅
**Complexity**: Medium (M) - ~35k tokens
**File**: `docs/issues/0045-slippage-simulation.md`

**What to Build**:
- Add realistic slippage to execution simulator
- Bid/ask spread simulation
- Volume-based slippage
- Configurable slippage parameters
- Market impact modeling

**Key Features**:
- `calculateSlippage(order, marketPrice)` - Slippage calculation
- Spread-based slippage for small orders
- Volume impact for large orders
- Random walk within spread
- Slippage recording in executions

**Dependencies**: Issues #0042-#0044 complete

---

### Issue #0046: Order Event System ✅
**Complexity**: Medium (M) - ~35k tokens
**File**: `docs/issues/0046-order-events.md`

**What to Build**:
- Create `OrderEvent` logging system
- Track all order state transitions
- Event types: PLACED, ACCEPTED, PARTIAL_FILL, FILLED, CANCELLED, REJECTED, EXPIRED
- Query order history by order ID
- Real-time event streaming (optional)

**Key Components**:
- `server/lib/order-events.ts` - Event creation and queries
- Event creation on every order status change
- Order audit trail endpoint
- Tests for all event types

**Dependencies**: All Phase 4 issues complete

---

## 🔧 Technical Guidance

### File Structure
Create these files:
```
server/
  lib/
    execution-simulator.ts       # Core execution engine (#0042)
    execution-partial.ts          # Partial fill logic (#0043)
    time-in-force.ts             # TIF handling (#0044)
    slippage.ts                  # Slippage simulation (#0045)
    order-events.ts              # Event system (#0046)
tests/
  unit/
    execution-simulator.test.ts  # Simulator tests
    time-in-force.test.ts        # TIF tests
    slippage.test.ts             # Slippage tests
    order-events.test.ts         # Event tests
  integration/
    execution-flow.test.ts       # End-to-end execution tests
```

### Execution Simulator Pattern

```typescript
// server/lib/execution-simulator.ts
import { db } from './db';
import { pricing } from './pricing';
import { audit } from './audit';

export class ExecutionSimulator {
  /**
   * Execute a market order immediately at current price
   */
  async executeMarketOrder(orderId: string) {
    const order = await db.order.findUnique({ where: { id: orderId } });
    const currentPrice = await pricing.getCurrentPrice(order.symbol);
    
    // Apply slippage
    const fillPrice = this.applySlippage(order, currentPrice);
    
    // Create execution
    const execution = await db.execution.create({
      data: {
        orderId: order.id,
        accountId: order.accountId,
        symbol: order.symbol,
        side: order.side,
        quantity: order.quantity,
        price: fillPrice,
        executedAt: new Date(),
      },
    });
    
    // Update order status
    await db.order.update({
      where: { id: orderId },
      data: { status: 'FILLED' },
    });
    
    // Audit log
    await audit({ action: 'ORDER_FILLED', resourceId: orderId });
    
    return execution;
  }
  
  /**
   * Execute limit order if price is favorable
   */
  async executeLimitOrder(orderId: string) {
    // Implementation for #0042
  }
  
  /**
   * Apply slippage to execution price
   */
  private applySlippage(order: Order, marketPrice: number): number {
    // Implementation for #0045
    return marketPrice; // Placeholder
  }
}

export const executionSimulator = new ExecutionSimulator();
```

### Order Event Pattern

```typescript
// server/lib/order-events.ts
import { db } from './db';

export async function createOrderEvent(
  orderId: string,
  eventType: OrderEventType,
  metadata?: Record<string, any>
) {
  return db.orderEvent.create({
    data: {
      orderId,
      eventType,
      metadata,
      timestamp: new Date(),
    },
  });
}

export async function getOrderEvents(orderId: string) {
  return db.orderEvent.findMany({
    where: { orderId },
    orderBy: { timestamp: 'asc' },
  });
}
```

---

## 🧪 Testing Requirements

For each issue, write:

1. **Unit Tests** (70% coverage minimum)
   - Test each function independently
   - Mock database and external dependencies
   - Test edge cases and error conditions

2. **Integration Tests** (if applicable)
   - Test execution flow end-to-end
   - Use real test database
   - Verify state changes in database

3. **Test Data Factories**
   - Create helper functions for test orders
   - Use realistic market data
   - Parameterize for different scenarios

---

## 🔒 Security Checklist

For EVERY issue, ensure:

- [ ] Input validation with Zod schemas
- [ ] Authorization checks (user owns account)
- [ ] No secrets in code
- [ ] Audit logging for state changes
- [ ] SQL injection prevented (use Prisma)
- [ ] No leaking of sensitive data in errors
- [ ] Rate limiting on execution endpoints (if added)

---

## 📝 Commit Message Format

```
feat(execution): implement paper trading execution simulator - Refs #0042
feat(partial): add partial fill support - Refs #0043
feat(tif): implement time-in-force handling - Refs #0044
feat(slippage): add slippage simulation - Refs #0045
feat(events): create order event system - Refs #0046
```

---

## ✅ Definition of Done

Before marking each issue complete:

- [ ] All acceptance criteria met
- [ ] Unit tests written and passing
- [ ] Integration tests passing (if applicable)
- [ ] `npm run lint` - Zero errors
- [ ] `npm run typecheck` - Zero errors
- [ ] Documentation updated (inline comments + API docs)
- [ ] Security checklist complete
- [ ] **PROGRESS.md updated** (mandatory!)

---

## 📊 Progress Tracking

Update `PROGRESS.md` after completing each issue:

1. Mark issue as complete with `[x]`
2. Update completion percentages
3. Add work log entry with:
   - Issues completed
   - Files created/modified
   - Tests added
   - Next steps

**Example Work Log Entry**:
```markdown
### 2025-12-13 23:00 UTC - Agent 8 (Phase 4B - Execution)

**Action**: Completed Issues #0042-#0046 (Execution & Events)

**Issues Completed**:
- #0042 - Execution Simulator Core ✅
- #0043 - Partial Fill Support ✅
- #0044 - Time-in-Force Handling ✅
- #0045 - Slippage Simulation ✅
- #0046 - Order Event System ✅

**Files Created**:
- server/lib/execution-simulator.ts
- server/lib/execution-partial.ts
- server/lib/time-in-force.ts
- server/lib/slippage.ts
- server/lib/order-events.ts
- tests/unit/execution-simulator.test.ts (25 tests)
- tests/unit/time-in-force.test.ts (15 tests)
- tests/unit/slippage.test.ts (12 tests)
- tests/unit/order-events.test.ts (10 tests)

**Next Steps**: Phase 5 - Portfolio & Ledger (issues #0047-#0054)

**Branch**: copilot/phase-4b-execution-events
```

---

## 🚀 Branch Strategy

Create a new branch for your work:
```bash
git checkout -b copilot/phase-4b-execution-events
```

Commit frequently:
```bash
git add .
git commit -m "feat(execution): implement market order execution - Refs #0042"
```

Push when ready:
```bash
git push origin copilot/phase-4b-execution-events
```

---

## 🤝 Coordination with Primary Agent

The primary agent is working on:
- #0037 - Order Placement API
- #0038 - Order Validation Service
- #0039 - Order Modification API
- #0040 - Order Cancellation API
- #0041 - Order Query API

You depend on their work being complete before starting #0042.

**Timeline**:
1. Wait for primary agent to complete #0037-#0041 (~2-3 hours)
2. Pull their branch and merge to your branch
3. Start implementing your issues
4. Total estimated time: 4-6 hours for all 5 issues

---

## 📚 Key Documentation

Before starting, read:
- `AGENTS.md` - Agent workflow guide
- `PROGRESS.md` - Current project status
- `.github/copilot-instructions.md` - Coding standards
- `docs/architecture/data-model.md` - Database schema
- `prisma/schema.prisma` - Data models

---

## 💡 Pro Tips

1. **Read existing code first** - Check `server/lib/pricing.ts`, `server/lib/trading-hours.ts` for patterns
2. **Use factories for tests** - Consistent test data makes debugging easier
3. **Test edge cases** - Partial fills, order expirations, FOK failures
4. **Document complex logic** - Slippage calculations need clear comments
5. **Keep functions small** - Each function should do one thing well
6. **Error handling** - Use typed errors from `server/errors/`

---

## 🎯 Success Criteria

You've succeeded when:

- ✅ All 5 issues complete (Phase 4 at 100%)
- ✅ 60+ unit tests passing
- ✅ Zero linter errors
- ✅ Zero TypeScript errors
- ✅ Execution simulator can handle all order types
- ✅ Partial fills work correctly
- ✅ Time-in-force logic is correct
- ✅ Slippage adds realism
- ✅ Order event system provides full audit trail
- ✅ PROGRESS.md updated
- ✅ Ready for Phase 5!

---

## ⚠️ Common Pitfalls to Avoid

1. **Race conditions** - Use transactions for order updates
2. **Floating point errors** - Use Decimal library for financial math
3. **Missing authorization** - Always check account access
4. **Incomplete audit logs** - Log every state change
5. **Hardcoded prices** - Always fetch from pricing service
6. **No error handling** - Wrap DB calls in try-catch
7. **Skipping tests** - Tests are mandatory, not optional
8. **Forgetting PROGRESS.md** - This is how we track work!

---

## 🆘 Need Help?

If blocked:
1. Check existing code patterns in `server/lib/`
2. Read Prisma docs for complex queries
3. Review test files for testing patterns
4. Check `docs/architecture/` for system design
5. Leave a comment in the issue file with blocker details

---

## 🎉 Let's Ship It!

You've got a clear roadmap. Let's complete Phase 4 and push this project to 64% completion!

**Remember**: Quality over speed. Production-grade code only.

Good luck! 🚀
