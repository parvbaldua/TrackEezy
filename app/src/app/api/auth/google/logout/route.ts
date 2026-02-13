import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const response = NextResponse.json({ success: true });

    // Clear Cookie
    // Clear Cookie
    response.cookies.delete({
        name: "bijnex_refresh_token",
        path: "/",
    });

    return response;
}
