import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Return a mock client if Supabase is not configured
    if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === "your_supabase_project_url") {
        // Return a mock object for demo purposes
        return {
            auth: {
                signInWithPassword: async () => ({
                    data: null,
                    error: { message: "Supabase belum dikonfigurasi. Silakan setup environment variables." },
                }),
                signOut: async () => ({ error: null }),
                getUser: async () => ({ data: { user: null }, error: null }),
            },
            from: () => ({
                select: () => ({ eq: () => ({ single: () => ({ data: null, error: null }), order: () => ({ data: [], error: null }) }) }),
                upsert: () => ({ select: () => ({ single: () => ({ data: null, error: null }) }) }),
                insert: () => ({ select: () => ({ single: () => ({ data: null, error: null }) }) }),
                update: () => ({ eq: () => ({ select: () => ({ single: () => ({ data: null, error: null }) }) }) }),
                delete: () => ({ eq: () => ({ data: null, error: null }) }),
            }),
            storage: {
                from: () => ({
                    upload: async () => ({ data: null, error: null }),
                    getPublicUrl: () => ({ data: { publicUrl: "" } }),
                })
            },
            channel: () => ({
                on: () => ({ subscribe: () => { } }),
                subscribe: () => { }
            })
        } as any;
    }

    return createBrowserClient(supabaseUrl!, supabaseAnonKey!);
}
