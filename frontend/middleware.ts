import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Only protect /admin/* and /api/admin/* routes
  const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
  if (!isAdminRoute) {
    return NextResponse.next();
  }

  try {
    const cookieStore = await cookies();
    
    // Create Supabase client with cookies
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet: any[]) => {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    // Get session
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      console.log('[Admin Auth] No session found');
      
      // Redirect to login for page routes
      if (pathname.startsWith('/admin')) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirectTo', pathname);
        return NextResponse.redirect(loginUrl);
      }
      
      // Return 401 for API routes
      return NextResponse.json(
        { error: 'Unauthorized: No session found' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const supabaseAdmin = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll: () => [],
          setAll: () => {},
        },
      }
    );

    const { data: admin, error } = await supabaseAdmin
      .from('admins')
      .select('id, email, is_active')
      .eq('email', session.user.email)
      .eq('is_active', true)
      .single();

    if (error || !admin) {
      console.log(`[Admin Auth Failed] User ${session.user.email} is not admin`);
      
      // Redirect to login for page routes
      if (pathname.startsWith('/admin')) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirectTo', pathname);
        return NextResponse.redirect(loginUrl);
      }
      
      // Return 401 for API routes
      return NextResponse.json(
        { error: 'Unauthorized: Not admin user' },
        { status: 401 }
      );
    }

    // Admin verified - allow request
    return NextResponse.next();
  } catch (error) {
    console.error('[Middleware Error]', error);
    
    // Return 401 for API routes on error
    if (pathname.startsWith('/api/admin')) {
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
    
    // Redirect to login for page routes on error
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
