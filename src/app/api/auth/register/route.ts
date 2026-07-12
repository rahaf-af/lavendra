import { NextRequest, NextResponse } from "next/server";
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { Prisma } from "@prisma/client";
import { prisma } from '@/lib/prisma'


const registerDataStandards = z.object({
    firstName: z.string({ error: (issue) => (issue.input === undefined ? 'FIRST_NAME_REQUIRED' : undefined) }).trim().min(2, 'FIRST_NAME_TOO_SHORT').max(50, 'FIRST_NAME_TOO_LONG').regex(/^[\u0600-\u06FFa-zA-Z\s]+$/, 'FIRST_NAME_INVALID_CHARACTERS'),
    lastName: z.string({ error: (issue) => (issue.input === undefined ? 'LAST_NAME_REQUIRED' : undefined) }).trim().min(2, 'LAST_NAME_TOO_SHORT').max(50, 'LAST_NAME_TOO_LONG').regex(/^[\u0600-\u06FFa-zA-Z\s]+$/, 'LAST_NAME_INVALID_CHARACTERS'),
    email: z.string({ error: (issue) => (issue.input === undefined ? 'EMAIL_REQUIRED' : undefined) }).trim().toLowerCase().email('EMAIL_INVALID_FORMAT'),
    password: z.string({ error: (issue) => (issue.input === undefined ? "PASSWORD_REQUIRED" : undefined) }).min(8, 'PASSWORD_TOO_SHORT').regex(/[A-Z]/, 'PASSWORD_MISSING_UPPERCASE').regex(/[a-z]/, 'PASSWORD_MISSING_LOWERCASE')
        .regex(/[0-9]/, 'PASSWORD_MISSING_NUMBER').regex(/[^A-Za-z0-9]/, 'PASSWORD_MISSING_SPECIAL_CHAR'),
    phone: z.string({ error: (issue) => (issue.input === undefined ? "PHONE_REQUIRED" : undefined) }).trim().min(1, 'PHONE_REQUIRED').regex(/^(05\d{8}|\+9665\d{8})$/, 'PHONE_INVALID_FORMAT')
        .transform((val) => (val.startsWith('05') ? `+966${val.slice(1)}` : val))
})

export async function POST(request: NextRequest) {

    let registerData: unknown
    try {
        registerData = await request.json()
    } catch {
        return NextResponse.json(
            { success: false, errorCode: 'INVALID_JSON_BODY' },
            { status: 400 }
        )
    }

    const parsed = registerDataStandards.safeParse(registerData)
    if (!parsed.success) {
        return NextResponse.json(
            { success: false, errorCode: parsed.error.issues[0].message, field: parsed.error.issues[0].path[0] },
            { status: 400 }
        )
    }

    const { firstName, lastName, email, password, phone } = parsed.data
    try {
        const existingUser = await prisma.user.findFirst({
            where: { OR: [{ email }, { phone }] },
            select: { email: true, phone: true }
        })
        if (existingUser) {
            if (existingUser.email === email) {
                return NextResponse.json(
                    { success: false, errorCode: 'EMAIL_ALREADY_EXISTS', field: 'email' },
                    { status: 409 }
                )
            }
            return NextResponse.json(
                { success: false, errorCode: 'PHONE_ALREADY_EXISTS', field: 'phone' },
                { status: 409 }
            )
        }

        const passwordHash = await bcrypt.hash(password, 10)
        const newUser = await prisma.user.create({
            data: {
                firstName, lastName, email, passwordHash, phone, role: 'customer'
            },
            select: {
                id: true, firstName: true, lastName: true, phone: true, email: true, role: true, createdAt: true
            }
        })
        return NextResponse.json(
            { success: true, message: 'USER_CREATED', data: newUser },
            { status: 201 }
        )
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const target = (error.meta?.target as string[]) || []

            if (target.includes('phone')) {
                return NextResponse.json(
                    { success: false, errorCode: 'PHONE_ALREADY_EXISTS', field: 'phone' },
                    { status: 409 }
                )
            }
            return NextResponse.json(
                { success: false, errorCode: 'EMAIL_ALREADY_EXISTS', field: 'email' },
                { status: 409 }
            )
        }
        console.error('register error', error)
        return NextResponse.json(
            { success: false, errorCode: 'INTERNAL_SERVER_ERROR' },
            { status: 500 }
        )
    }
}