import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  // Get the pathname from the URL
  const pathname = request.nextUrl.pathname

  // Check if this is an admin route
  const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/api/admin')

  if (!isAdminRoute) {
    // Not an admin route, allow through
    return NextResponse.next()
  }

  // This is an admin route - check auth and admin status
  // Create Supabase client with cookies from the request
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          let response = NextResponse.next()
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
          return response
        },
      },
    }
  )

  // Get the authentication session from Supabase
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  // If no session, user is not logged in
  if (!session || sessionError) {
    return handleUnauthorized(request, 'No session found')
  }

  // Get the user's admin status from the database
  // Query the admins table using the service role key for server-side check
  const supabaseAdmin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Server-only key
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          let response = NextResponse.next()
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
          return response
        },
      },
    }
  )

  // Query the admins table - user must exist and be active
  const { data: adminRecord, error: adminError } = await supabaseAdmin
    .from('admins')
    .select('id, email, is_active, role')
    .eq('email', session.user.email)
    .eq('is_active', true)
    .single()

  // User is not an admin
  if (!adminRecord || adminError) {
    return handleUnauthorized(
      request,
      `User ${session.user.email} is not an active admin`
    )
  }

  // User IS an admin, allow the request through
  return NextResponse.next()
}

/**
 * Handle unauthorized access based on route type
 * Returns JSON 401 for API routes
 * Redirects to /login for page routes
 */
function handleUnauthorized(request: NextRequest, reason: string): NextResponse {
  const pathname = request.nextUrl.pathname

  console.warn(`[Admin Auth Failed] ${reason} | Path: ${pathname}`)

  // API routes return JSON 401
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        message: 'You must be logged in as an admin to access this resource',
      },
      { status: 401 }
    )
  }

  // Page routes redirect to login
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('redirectTo', pathname)
  return NextResponse.redirect(loginUrl)
}

// Matcher config: which routes should trigger middleware
export const config = {
  matcher: [
    // Admin pages and API routes
    '/admin/:path*',
    '/api/admin/:path*',
  ],
}
