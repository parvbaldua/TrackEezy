import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const response = NextResponse.json({ success: true });

    // Clear Cookie
    response.cookies.delete("akb_refresh_token");
    response.cookies.delete("bijnex_refresh_token"); // Clear legacy cookie too

    return response;
}
