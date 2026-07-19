import { NextResponse } from "next/server";

export async function POST() {
    try {
        const response = NextResponse.json(
            { success: true, message: "USER_LOGGED_OUT" },
            { status: 200 }
        )

        response.cookies.set('token', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 0,
            path: '/'
        })
        return response
    } catch (error) {
        console.error('logout error', error)
        return NextResponse.json(
            { success: false, errorCode: 'INTERNAL_SERVER_ERROR' },
            { status: 500 }
        )
    }

}