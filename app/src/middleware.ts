import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
    const origin = request.headers.get("origin");

    // Define allowed origins
    const allowedOrigins = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://aapkabakaya.vercel.app",
        "https://www.aapkabakaya.vercel.app"
    ];

    // Check if origin is allowed
    const isAllowed = origin && allowedOrigins.includes(origin);

    // Handle preflight OPTIONS request
    if (request.method === "OPTIONS") {
        // If origin is allowed, return it, otherwise return null (blocks request)
        // Or we can return "*" if credentials=false, but we use credentials=true
        const response = new NextResponse(null, { status: 200 });

        if (isAllowed) {
            response.headers.set("Access-Control-Allow-Origin", origin!);
            response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
            response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Api-Version");
            response.headers.set("Access-Control-Allow-Credentials", "true");
        }

        return response;
    }

    // Handle other requests
    const response = NextResponse.next();

    if (isAllowed) {
        response.headers.set("Access-Control-Allow-Origin", origin!);
        response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
        response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Api-Version");
        response.headers.set("Access-Control-Allow-Credentials", "true");
    }

    return response;
}

export const config = {
    matcher: "/api/:path*",
};
