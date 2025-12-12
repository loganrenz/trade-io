# ADR 0004: Authentication Provider Selection

## Status
**Accepted** - 2025-12-12

## Context
We need to choose an authentication provider for user identity management. Requirements include:
- **Security**: Industry-standard password hashing, session management
- **User management**: Registration, login, password reset, email verification
- **Session handling**: Secure token generation and validation
- **Social login**: Optional OAuth providers (Google, GitHub, etc.)
- **Multi-factor auth (MFA)**: 2FA/TOTP support for enhanced security
- **Rate limiting**: Protection against brute force attacks
- **Database integration**: Works with our PostgreSQL database
- **Row-Level Security (RLS)**: Enables database-level authorization
- **Admin tools**: User management interface
- **Cost**: Reasonable pricing for production use

The platform needs secure authentication for both regular users and admin operations, with audit logging of all authentication events.

## Decision
**We will use Supabase Auth as our authentication provider.**

## Rationale

### Why Supabase Auth
1. **Integrated with database**: Supabase provides both auth and PostgreSQL hosting
2. **Row-Level Security (RLS)**: Native PostgreSQL RLS policies for authorization
3. **Built-in user management**: Admin dashboard for user operations
4. **Email verification**: Automatic email confirmation flows
5. **Social OAuth**: Support for 20+ providers (Google, GitHub, etc.)
6. **JWT tokens**: Standard JWT with automatic refresh
7. **MFA support**: TOTP-based two-factor authentication
8. **Rate limiting**: Built-in protection against abuse
9. **Generous free tier**: 50,000 monthly active users
10. **Open source**: Can self-host if needed

### Why Supabase over Custom JWT
1. **Less security risk**: Don't have to implement password hashing, session management
2. **Faster development**: Email verification, password reset flows built-in
3. **Better UX**: Pre-built components and flows
4. **Audit trail**: Authentication events logged automatically
5. **Compliance**: SOC 2, HIPAA compliant infrastructure

### Alternatives Considered

#### Clerk
**Pros:**
- Excellent developer experience
- Beautiful pre-built UI components
- Advanced features (organizations, SAML SSO)
- Strong TypeScript SDK
- Admin dashboard

**Cons:**
- More expensive ($25/month for production)
- External service (adds latency)
- No RLS integration (separate authorization layer needed)
- No free tier for production

**Decision:** Supabase is more cost-effective and integrates better with our database.

#### Auth0
**Pros:**
- Enterprise-grade security
- Extensive customization
- Compliance certifications
- Large ecosystem

**Cons:**
- Expensive for scale (pricing can get high)
- Complex configuration
- Separate from database (no RLS)
- Overkill for our needs

**Decision:** Too expensive and complex for a paper trading platform.

#### Custom JWT Implementation
**Pros:**
- Full control over implementation
- No external dependencies
- No vendor lock-in
- Can customize everything

**Cons:**
- Security risk (easy to get wrong)
- Time-consuming to build
- Must implement email flows, password reset, etc.
- No MFA out of the box
- Maintenance burden

**Decision:** Not worth the security risk and development time. Use proven solution.

#### NextAuth.js / Nuxt Auth
**Pros:**
- Framework-specific integration
- Flexible provider configuration
- Open source
- No cost

**Cons:**
- Session management complexity
- Need to implement database strategy
- No RLS integration
- Email sending requires external service
- Less secure than dedicated auth providers

**Decision:** Supabase provides more features out of the box.

## Consequences

### Positive
- **RLS support**: Can use PostgreSQL row-level security for authorization
- **Rapid development**: Email flows, password reset work immediately
- **Cost-effective**: Free tier covers development and small production deployments
- **Security**: Proven implementation, regular security audits
- **Admin tools**: User management without building admin UI
- **Compliance**: SOC 2 certified infrastructure

### Negative
- **Vendor lock-in**: Migrating away from Supabase auth requires significant work
- **Customization limits**: Some flows hard to customize beyond Supabase's offerings
- **External dependency**: Platform depends on Supabase uptime
- **Learning curve**: Team must learn Supabase SDK and RLS patterns

### Neutral
- **JWT tokens**: Standard approach, works with any frontend
- **Database hosting**: Couples us to Supabase for both auth and database

## Implementation Notes

### Installation
```bash
npm install @supabase/supabase-js
```

### Environment Variables
```bash
# .env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key # Server-side only!
```

### Supabase Client Setup
```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);

// Server-side client (for admin operations)
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Bypasses RLS
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
```

### User Registration
```typescript
// composables/useAuth.ts
export function useAuth() {
  const supabase = useSupabaseClient();
  
  async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    
    if (error) throw error;
    return data;
  }
  
  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    return data;
  }
  
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }
  
  async function resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) throw error;
  }
  
  return { signUp, signIn, signOut, resetPassword };
}
```

### Authentication State
```typescript
// composables/useUser.ts
export function useUser() {
  const supabase = useSupabaseClient();
  const user = ref(null);
  
  // Get initial session
  supabase.auth.getSession().then(({ data: { session } }) => {
    user.value = session?.user ?? null;
  });
  
  // Listen for auth changes
  supabase.auth.onAuthStateChange((event, session) => {
    user.value = session?.user ?? null;
  });
  
  return {
    user: readonly(user),
    isAuthenticated: computed(() => !!user.value),
  };
}
```

### tRPC Context with Auth
```typescript
// server/trpc/context.ts
import { supabaseAdmin } from '../lib/supabase';

export async function createContext({ req, res }: { req: any; res: any }) {
  // Extract JWT from Authorization header
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  let userId: string | null = null;
  if (token) {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    userId = user?.id ?? null;
  }
  
  return {
    userId,
    requestId: crypto.randomUUID(),
    ipAddress: req.ip,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
```

### Protected Procedure Middleware
```typescript
// server/trpc/trpc.ts
import { TRPCError } from '@trpc/server';

const isAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ 
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId, // Type-safe userId
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthenticated);
```

### Row-Level Security (RLS) Policies
```sql
-- Enable RLS on accounts table
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own accounts
CREATE POLICY "users_own_accounts" ON accounts
  FOR SELECT
  USING (auth.uid() = owner_id);

-- Policy: Users can insert their own accounts
CREATE POLICY "users_create_accounts" ON accounts
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Policy: Users can update their own accounts
CREATE POLICY "users_update_accounts" ON accounts
  FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
```

### Email Templates
Configure in Supabase Dashboard:
- Welcome email
- Email verification
- Password reset
- Magic link login

### Social OAuth Setup
```typescript
// Sign in with Google
async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
}

// Sign in with GitHub
async function signInWithGitHub() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
}
```

### Enable MFA (Two-Factor Authentication)
```typescript
// Enroll in MFA
async function enrollMFA() {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
  });
  
  if (error) throw error;
  
  // Display QR code to user
  const qrCode = data.totp.qr_code;
  const secret = data.totp.secret;
  
  return { qrCode, secret };
}

// Verify MFA code
async function verifyMFA(factorId: string, code: string) {
  const { data, error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code,
  });
  
  if (error) throw error;
  return data;
}
```

## Security Considerations

### Password Policy
Supabase enforces:
- Minimum 6 characters (can be increased via dashboard)
- No maximum length limit
- bcrypt hashing with salt

**Recommendation**: Configure minimum 12 characters in production.

### Session Management
- JWT tokens with 1-hour expiry
- Automatic refresh token rotation
- Refresh tokens valid for 30 days (configurable)
- Revocable sessions via admin API

### Rate Limiting
Supabase provides built-in rate limiting:
- 30 requests per hour per IP for sign-up
- 30 requests per hour per IP for password reset
- Customizable via Supabase dashboard

### Audit Logging
All authentication events logged:
- Sign up, sign in, sign out
- Password reset requests
- Email verification
- MFA enrollment

Access via Supabase Dashboard > Authentication > Logs.

## Related Decisions
- [ADR 0003: Database ORM](./0003-database-orm.md) - Prisma for database access
- [ADR 0005: Database Hosting](./0005-database-hosting.md) - Supabase for hosting

## References
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Row-Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase with Nuxt](https://supabase.com/docs/guides/getting-started/quickstarts/nuxtjs)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)

## Review Date
This decision should be reviewed in **12 months (December 2026)** or when:
- Supabase pricing becomes prohibitive
- Need for advanced enterprise features (SAML, SCIM) arises
- Vendor lock-in becomes a significant concern
