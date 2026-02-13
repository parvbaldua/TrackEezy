import { NextRequest, NextResponse } from "next/server";
import { GoogleAuth } from "@/lib/google-auth";

export async function POST(req: NextRequest) {
    try {
        const { code } = await req.json();

        if (!code) {
            return NextResponse.json({ error: "Missing code" }, { status: 400 });
        }

        const tokens = await GoogleAuth.exchangeCodeForTokens(code);

        if (!tokens.refresh_token) {
            // This might happen if the user has already granted access and we didn't force consent.
            // But we requested 'prompt: consent' in frontend config, so we should get it.
            console.warn("No refresh token received during login");
        }

        // Get User Info
        const userInfo = await GoogleAuth.getUserInfo(tokens.access_token!);

        // Create Response
        const response = NextResponse.json({
            user: userInfo,
            access_token: tokens.access_token,
            expiry_date: tokens.expiry_date
        });

        // Set Refresh Token Cookie (HttpOnly)
        if (tokens.refresh_token) {
            response.cookies.set("bijnex_refresh_token", tokens.refresh_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax", // Must be lax to wait for cross-site redirects or calls
                path: "/",
                maxAge: 60 * 60 * 24 * 30 // 30 Days
            });
        }

        return response;
    } catch (error: any) {
        console.error("Login Error:", error);
        return NextResponse.json({ error: error.message || "Login failed" }, { status: 500 });
    }
}
