import { NextRequest, NextResponse } from "next/server"
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { Prisma } from "@prisma/client";

const updateEmployeeStandards = z.object({
    firstName: z.string().trim().min(2, 'FIRST_NAME_TOO_SHORT').max(30, 'FIRST_NAME_TOO_LONG').regex(/^[\u0600-\u06FFa-zA-Z\s]+$/, 'FIRST_NAME_INVALID_CHARACTERS').optional(),
    email: z.string().trim().toLowerCase().email('EMAIL_INVALID_FORMAT').optional(),
    phone: z.string().trim().min(1, 'PHONE_REQUIRED').regex(/^(05\d{8}|\+9665\d{8})$/, 'PHONE_INVALID_FORMAT')
        .transform((val) => (val.startsWith('05') ? `+966${val.slice(1)}` : val)).optional(),
    specialty: z.string().trim().min(2, 'SPECIALTY_TOO_SHORT').max(50, 'SPECIALTY_TOO_LONG')
        .regex(/^[\u0600-\u06FFa-zA-Z\s]+$/, 'SPECIALTY_INVALID_CHARACTERS').optional(),
    bio: z.string().trim().max(500, "BIO_TOO_LONG").optional(),
    status: z.enum(["active", "blocked"], { error: () => 'STATUS_INVALID' }).optional(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {

    const { id } = await params
    const employeeId = Number(id)
    if (Number.isNaN(employeeId)) {
        return NextResponse.json(
            { success: false, errorCode: 'INVALID_EMPLOYEE_ID' },
            { status: 400 }
        )
    }

    try {

        const employee = await prisma.user.findFirst({
            where: { id: employeeId, role: { in: ['employee', 'manager'] } },
            select: {
                id: true, firstName: true, lastName: true, email: true, phone: true, role: true, status: true, specialty: true, bio: true, createdAt: true
            }
        })
        if (!employee) {
            return NextResponse.json(
                { success: false, errorCode: 'EMPLOYEE_NOT_FOUND' },
                { status: 404 }
            )
        }
        return NextResponse.json(
            { success: true, data: employee },
            { status: 200 }
        )
    } catch (error) {
        console.error('Get employee error:', error)
        return NextResponse.json(
            { success: false, errorCode: 'INTERNAL_SERVER_ERROR' },
            { status: 500 }
        )
    }
}



export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {

    const { id } = await params
    const employeeId = Number(id)
    if (Number.isNaN(employeeId)) {
        return NextResponse.json(
            { success: false, errorCode: 'INVALID_EMPLOYEE_ID' },
            { status: 400 }
        )
    }

    let updatedEmployeeData: unknown
    try {
        updatedEmployeeData = await request.json()
    } catch {
        return NextResponse.json(
            { success: false, errorCode: 'INVALID_JSON_BODY' },
            { status: 400 }
        )
    }

    const parsed = updateEmployeeStandards.safeParse(updatedEmployeeData)
    if (!parsed.success) {
        return NextResponse.json(
            { success: false, errorCode: parsed.error.issues[0].message, field: parsed.error.issues[0].path.join(".") },
            { status: 400 }
        )
    }

    try {
        const existing = await prisma.user.findFirst({ where: { id: employeeId, role: { in: ['employee', 'manager'] } } })
        if (!existing) {
            return NextResponse.json(
                { success: false, errorCode: 'EMPLOYEE_NOT_FOUND' },
                { status: 404 }
            )
        }

        const { email, phone } = parsed.data
        if (email || phone) {
            const conflict = await prisma.user.findFirst({
                where: {
                    id: { not: employeeId },
                    OR: [
                        ...(email ? [{ email }] : []),
                        ...(phone ? [{ phone }] : [])
                    ],
                },
                select: { email: true, phone: true }
            })
            if (conflict) {
                if (email && conflict.email === email) {
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
        }
        const updatedEmployee = await prisma.user.update({
            where: { id: employeeId },
            data: parsed.data,
            select: {
                id: true, firstName: true, lastName: true, email: true, phone: true, role: true, status: true, specialty: true, bio: true, createdAt: true
            }
        })
        return NextResponse.json(
            { success: true, message: 'EMPLOYEE_UPDATED', data: updatedEmployee },
            { status: 200 }
        )
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return NextResponse.json(
                { success: false, errorCode: 'EMPLOYEE_NOT_FOUND' },
                { status: 404 }
            )
        }
        console.error('update employee error:', error)
        return NextResponse.json(
            { success: false, errorCode: 'INTERNAL_SERVER_ERROR' },
            { status: 500 }
        )
    }
}



export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {

    const { id } = await params
    const employeeId = Number(id)
    if (Number.isNaN(employeeId)) {
        return NextResponse.json(
            { success: false, errorCode: 'INVALID_EMPLOYEE_ID' },
            { status: 400 }
        )
    }

    try {

        const employee = await prisma.user.findFirst({
            where: { id: employeeId, role: { in: ['employee', 'manager'] } },
            include: { _count: { select: { appointmentsAsEmployee: true } } },
        })

        if (!employee) {
            return NextResponse.json(
                { success: false, errorCode: 'EMPLOYEE_NOT_FOUND' },
                { status: 404 }
            )
        }

        if (employee.role === 'manager') {
            return NextResponse.json(
                { success: false, errorCode: 'CANNOT_DELETE_MANAGER_ACCOUNT' },
                { status: 403 }
            )
        }


        if (employee._count.appointmentsAsEmployee > 0) {
            return NextResponse.json(
                { success: false, errorCode: 'EMPLOYEE_HAS_APPOINTMENTS' },
                { status: 409 }
            )
        }

        await prisma.user.delete({ where: { id: employeeId } })

        return NextResponse.json(
            { success: true, message: 'EMPLOYEE_DELETED' },
            { status: 200 }
        )
    } catch (error) {
        console.error('delete employee error', error)
        return NextResponse.json(
            { success: false, errorCode: 'INTERNAL_SERVER_ERROR' },
            { status: 500 }
        )
    }

}