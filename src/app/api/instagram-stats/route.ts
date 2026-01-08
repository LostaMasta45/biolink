import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

// Instagram Stats API
// This fetches stats from database or returns cached/default values
// Stats can be updated manually in the database or via admin panel

interface InstagramStats {
    posts: string;
    followers: string;
}

// Default/fallback stats
const DEFAULT_STATS: InstagramStats = {
    posts: "9.800+",
    followers: "205rb",
};

export async function GET() {
    try {
        // Try to get stats from database first
        const supabase = createClient();
        const { data, error } = await supabase
            .from("app_settings")
            .select("value")
            .eq("key", "instagram_stats")
            .single();

        if (data && !error) {
            const stats = JSON.parse(data.value);
            return NextResponse.json(stats);
        }

        // Return default stats if database fetch fails
        return NextResponse.json(DEFAULT_STATS);
    } catch (error) {
        console.error("Error fetching Instagram stats:", error);
        return NextResponse.json(DEFAULT_STATS);
    }
}

// Update stats (admin only - can be called from admin panel)
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { posts, followers } = body;

        const supabase = createClient();

        const stats: InstagramStats = {
            posts: posts || DEFAULT_STATS.posts,
            followers: followers || DEFAULT_STATS.followers,
        };

        const { error } = await supabase
            .from("app_settings")
            .upsert({
                key: "instagram_stats",
                value: JSON.stringify(stats),
                updated_at: new Date().toISOString(),
            });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, stats });
    } catch (error) {
        console.error("Error updating Instagram stats:", error);
        return NextResponse.json({ error: "Failed to update stats" }, { status: 500 });
    }
}
