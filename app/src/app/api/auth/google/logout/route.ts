import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const response = NextResponse.json({ success: true });

    // Clear Cookie
    // Clear Cookie
    response.cookies.delete("akb_refresh_token");

    return response;
}
