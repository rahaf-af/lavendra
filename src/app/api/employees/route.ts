import { NextRequest, NextResponse } from "next/server";
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { Prisma } from "@prisma/client";
import { prisma } from '@/lib/prisma'


const employeeDataStandards = z
    .object({
        firstName: z.string({ error: (issue) => (issue.input === undefined ? 'FIRST_NAME_REQUIRED' : undefined) }).trim().min(2, 'FIRST_NAME_TOO_SHORT').max(30, 'FIRST_NAME_TOO_LONG').regex(/^[\u0600-\u06FFa-zA-Z\s]+$/, 'FIRST_NAME_INVALID_CHARACTERS'),
        lastName: z.string({ error: (issue) => (issue.input === undefined ? 'LAST_NAME_REQUIRED' : undefined) }).trim().min(2, 'LAST_NAME_TOO_SHORT').max(30, 'LAST_NAME_TOO_LONG').regex(/^[\u0600-\u06FFa-zA-Z\s]+$/, 'LAST_NAME_INVALID_CHARACTERS'),
        email: z.string({ error: (issue) => (issue.input === undefined ? 'EMAIL_REQUIRED' : undefined) }).trim().toLowerCase().email('EMAIL_INVALID_FORMAT'),
        password: z.string({ error: (issue) => (issue.input === undefined ? 'PASSWORD_REQUIRED' : undefined) }).min(8, 'PASSWORD_TOO_SHORT').regex(/[A-Z]/, 'PASSWORD_MISSING_UPPERCASE').regex(/[a-z]/, 'PASSWORD_MISSING_LOWERCASE')
            .regex(/[0-9]/, 'PASSWORD_MISSING_NUMBER').regex(/[^A-Za-z0-9]/, 'PASSWORD_MISSING_SPECIAL_CHAR'),
        phone: z.string({ error: (issue) => (issue.input === undefined ? "PHONE_REQUIRED" : undefined) }).trim().min(1, 'PHONE_REQUIRED').regex(/^(05\d{8}|\+9665\d{8})$/, 'PHONE_INVALID_FORMAT')
            .transform((val) => (val.startsWith('05') ? `+966${val.slice(1)}` : val)),
        role: z.enum(["employee", "manager"], { error: () => 'ROLE_INVALID_OR_REQUIRED' }),
        specialty: z.string().trim().min(2, 'SPECIALTY_TOO_SHORT').max(50, 'SPECIALTY_TOO_LONG')
            .regex(/^[\u0600-\u06FFa-zA-Z\s]+$/, 'SPECIALTY_INVALID_CHARACTERS').optional(),
        bio: z.string().trim().max(500, "BIO_TOO_LONG").optional(),
        serviceIds: z.array(z.number().int()).optional()

    })
    .superRefine((data, ctx) => {
        if (data.role === 'employee' && !data.specialty) {
            ctx.addIssue({
                code: 'custom',
                path: ['specialty'],
                message: 'SPECIALTY_REQUIRED_FOR_EMPLOYEE',
            })
        }
    })


export async function GET() {
    try {
        const employees = await prisma.user.findMany({
            where: { role: { in: ['employee', 'manager'] } },
            select: {
                id: true, firstName: true, lastName: true, email: true, phone: true, role: true, status: true, specialty: true, bio: true, createdAt: true
            },
            orderBy: { createdAt: "desc" }
        })
        return NextResponse.json(
            { success: true, data: employees },
            { status: 200 }
        )
    } catch (error) {
        console.error('Get employees error:', error)
        return NextResponse.json(
            { success: false, errorCode: 'INTERNAL_SERVER_ERROR' },
            { status: 500 }
        )
    }

}

export async function POST(request: NextRequest) {

    let employeeData: unknown
    try {
        employeeData = await request.json()
    } catch {
        return NextResponse.json(
            { success: false, errorCode: 'INVALID_JSON_BODY' },
            { status: 400 }
        )
    }

    const parsed = employeeDataStandards.safeParse(employeeData)
    if (!parsed.success) {

        return NextResponse.json(
            { success: false, errorCode: parsed.error.issues[0].message, field: parsed.error.issues[0].path.join('.') },
            { status: 400 }
        )
    }

    const { firstName, lastName, email, phone, password, role, specialty, bio, serviceIds } = parsed.data
    try {
        const existingEmployee = await prisma.user.findFirst({
            where: { OR: [{ email }, { phone }] },
            select: { email: true, phone: true }
        })
        if (existingEmployee) {
            if (existingEmployee.email === email) {
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
        const newEmployee = await prisma.user.create({
            data: {
                firstName, lastName, email, phone, passwordHash, role, specialty: role === 'employee' ? specialty : null, bio,
                servicesOffered: serviceIds ? { create: serviceIds.map((serviceId) => ({ serviceId })) } : undefined
            },
            select: {
                id: true, firstName: true, lastName: true, phone: true, email: true, role: true, specialty: true, bio: true, createdAt: true
            }
        })
        return NextResponse.json(
            { success: true, message: 'EMPLOYEE_CREATED', data: newEmployee },
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
        console.error('add employee error', error)
        return NextResponse.json(
            { success: false, errorCode: 'INTERNAL_SERVER_ERROR' },
            { status: 500 }
        )
    }
}