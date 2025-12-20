import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
    // Check if Supabase is configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // If Supabase is not configured, allow access to all routes except admin
    if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === "your_supabase_project_url") {
        // If trying to access admin routes without Supabase, redirect to a config message
        if (request.nextUrl.pathname.startsWith("/admin")) {
            // For demo purposes, allow access to admin without auth
            // In production, this should redirect to setup or login
            return NextResponse.next({ request });
        }
        // Allow access to public pages
        return NextResponse.next({ request });
    }

    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) =>
                    request.cookies.set(name, value)
                );
                supabaseResponse = NextResponse.next({
                    request,
                });
                cookiesToSet.forEach(({ name, value, options }) =>
                    supabaseResponse.cookies.set(name, value, options)
                );
            },
        },
    });

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Protect admin routes
    if (request.nextUrl.pathname.startsWith("/admin")) {
        if (!user) {
            // Not logged in, redirect to login
            const url = request.nextUrl.clone();
            url.pathname = "/login";
            url.searchParams.set("redirect", request.nextUrl.pathname);
            return NextResponse.redirect(url);
        }
    }

    // If logged in and trying to access login page, redirect to admin
    if (request.nextUrl.pathname === "/login" && user) {
        const url = request.nextUrl.clone();
        url.pathname = "/admin";
        return NextResponse.redirect(url);
    }

    return supabaseResponse;
}
