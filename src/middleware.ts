import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)

const routeRules: { pattern: RegExp; methods: string[]; roles: string[] }[] = [
    { pattern: /^\/api\/services(\/.*)?$/, methods: ["POST", "PATCH", "DELETE"], roles: ["manager"] },
    { pattern: /^\/api\/employees(\/.*)?$/, methods: ["GET", "POST", "PATCH", "DELETE"], roles: ["manager"] },
]

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl
    const method = request.method

    const rule = routeRules.find(
        (r) => r.pattern.test(pathname) && r.methods.includes(method)
    )

    if (!rule) {
        return NextResponse.next()
    }

    const token = request.cookies.get('token')?.value
    if (!token) {
        return NextResponse.json(
            { success: false, errorCode: 'AUTHENTICATION_REQUIRED' },
            { status: 401 }
        )
    }

    try {
        const { payload } = await jwtVerify(token, JWT_SECRET)
        const role = payload.role as string

        if (!rule.roles.includes(role)) {
            return NextResponse.json(
                { success: false, errorCode: 'PERMISSION_DENIED' },
                { status: 403 }
            )
        }

        return NextResponse.next()
    } catch {
        return NextResponse.json(
            { success: false, errorCode: 'INVALID_OR_EXPIRED_TOKEN' },
            { status: 401 }
        )
    }
}

export const config = {
    matcher: ["/api/services/:path*", "/api/employees/:path*"]
}
