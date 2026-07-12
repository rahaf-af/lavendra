<<<<<<< user-register
=======
import { NextRequest, NextResponse } from "next/server";
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { SignJWT } from 'jose'
import { prisma } from '@/lib/prisma'

const loginDataStandards = z.object({
    email: z.string({ error: (issue) => (issue.input === undefined ? 'EMAIL_REQUIRED' : undefined) }).trim().toLowerCase().email('EMAIL_INVALID_FORMAT'),
    password: z.string({ error: (issue) => (issue.input === undefined ? "PASSWORD_REQUIRED" : undefined) })
})


const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)
export async function POST(request: NextRequest) {

    let loginData: unknown
    try {
        loginData = await request.json()
    } catch {
        return NextResponse.json(
            { success: false, errorCode: 'INVALID_JSON_BODY' },
            { status: 400 }
        )
    }

    const parsed = loginDataStandards.safeParse(loginData)
    if (!parsed.success) {
        return NextResponse.json(
            { success: false, errorCode: parsed.error.issues[0].message, field: parsed.error.issues[0].path[0] },
            { status: 400 }
        )
    }

    const { email, password } = parsed.data
    try {
        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) {
            return NextResponse.json(
                { success: false, errorCode: 'INVALID_CREDENTIALS' },
                { status: 401 }
            )
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash)
        if (!isPasswordValid) {
            return NextResponse.json(
                { success: false, errorCode: 'INVALID_CREDENTIALS' },
                { status: 401 }
            )
        }

        if (user.status === 'blocked') {
            return NextResponse.json(
                { success: false, errorCode: 'ACCOUNT_BLOCKED' },
                { status: 403 }
            )
        }

        const token = await new SignJWT({ userId: user.id, role: user.role }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('2d').sign(JWT_SECRET)
        const response = NextResponse.json(
            { success: true, message: 'USER_LOGGED_IN', data: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role } },
            { status: 200 }
        )
        response.cookies.set('token', token, {
            httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24 * 2, path: '/'
        })
        return response
    } catch (error) {
        console.error('login error', error)
        return NextResponse.json(
            { success: false, errorCode: 'INTERNAL_SERVER_ERROR' },
            { status: 500 }
        )
    }
}
>>>>>>> local
