import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that authenticate via CRON_SECRET — skip session check
const CRON_PATHS = ['/api/cron', '/api/cron-backup', '/api/ingest']

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Skip session validation for secret-authenticated cron/ingest routes
  if (CRON_PATHS.some(p => path.startsWith(p))) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isLoginPage = path === '/login'
  const isDashboard = path.startsWith('/dashboard')
  const isProtectedApi = path.startsWith('/api/')

  // Unauthenticated: redirect dashboard pages to login, return 401 for API routes
  if (!user && isDashboard) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (!user && isProtectedApi) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Already logged in: redirect login page to dashboard
  if (user && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/api/:path*'],
}
