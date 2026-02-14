import { NextRequest, NextResponse } from "next/server";
import { GoogleAuth } from "@/lib/google-auth";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        // Check new cookie name first, fallback to legacy name
        const refreshToken = cookieStore.get("akb_refresh_token")?.value
            || cookieStore.get("bijnex_refresh_token")?.value;

        if (!refreshToken) {
            return NextResponse.json({ error: "No refresh token found" }, { status: 401 });
        }

        const tokens = await GoogleAuth.refreshAccessToken(refreshToken);

        const response = NextResponse.json({
            access_token: tokens.access_token,
            expiry_date: tokens.expiry_date
        });

        // Update Refresh Token if a new one was returned
        if (tokens.refresh_token) {
            response.cookies.set("akb_refresh_token", tokens.refresh_token, {
                httpOnly: true,
                secure: true,
                sameSite: "none",
                path: "/",
                maxAge: 60 * 60 * 24 * 30 // 30 Days
            });
        }

        return response;

    } catch (error: any) {
        console.error("Refresh Error:", error);
        return NextResponse.json({ error: "Session expired or invalid" }, { status: 401 });
    }
}
