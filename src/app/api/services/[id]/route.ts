import { NextRequest, NextResponse } from "next/server"
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const updateServicesStandards = z.object({
    nameAr: z.string().trim().min(2, 'NAME_AR_TOO_SHORT').max(100, 'NAME_AR_TOO_LONG').regex(/^[\u0600-\u06FFa-zA-Z\s]+$/, 'NAME_AR_INVALID_CHARACTERS').optional(),
    nameEn: z.string().trim().min(2, 'NAME_EN_TOO_SHORT').max(100, 'NAME_EN_TOO_LONG').regex(/^[\u0600-\u06FFa-zA-Z\s]+$/, 'NAME_EN_INVALID_CHARACTERS').optional(),
    descriptionAr: z.string().trim().max(500, 'DESCRIPTION_AR_TOO_LONG').optional(),
    descriptionEn: z.string({ error: (issue) => (issue.input === undefined ? 'DESCRIPTION_EN_REQUIRED' : undefined) }).trim().max(500, 'DESCRIPTION_EN_TOO_LONG').optional(),
    imageUrl: z.string().trim().url('IMAGE_URL_INVALID').optional(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {

    const { id } = await params
    const serviceId = Number(id)
    if (Number.isNaN(serviceId)) {
        return NextResponse.json(
            { success: false, errorCode: 'INVALID_SERVICE_ID' },
            { status: 400 }
        )
    }

    try {

        const service = await prisma.service.findUnique({
            where: { id: serviceId },
            include: { variants: true }
        })

        if (!service) {
            return NextResponse.json(
                { success: false, errorCode: 'SERVICE_NOT_FOUND' },
                { status: 404 }
            )
        }
        return NextResponse.json(
            { success: true, data: service },
            { status: 200 }
        )
    } catch (error) {
        console.error('Get services error:', error)
        return NextResponse.json(
            { success: false, errorCode: 'INTERNAL_SERVER_ERROR' },
            { status: 500 }
        )
    }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {

    const { id } = await params
    const serviceId = Number(id)
    if (Number.isNaN(serviceId)) {
        return NextResponse.json(
            { success: false, errorCode: 'INVALID_SERVICE_ID' },
            { status: 400 }
        )
    }

    let updatedServiceData: unknown
    try {
        updatedServiceData = await request.json()
    } catch {
        return NextResponse.json(
            { success: false, errorCode: 'INVALID_JSON_BODY' },
            { status: 400 }
        )
    }

    const parsed = updateServicesStandards.safeParse(updatedServiceData)
    if (!parsed.success) {
        return NextResponse.json(
            { success: false, errorCode: parsed.error.issues[0].message, field: parsed.error.issues[0].path.join(".") },
            { status: 400 }
        )
    }

    try {

        const updatedService = await prisma.service.update({
            where: { id: serviceId },
            data: parsed.data,
            include: { variants: true }
        })
        return NextResponse.json(
            { success: true, message: 'SERVICE_UPDATED', data: updatedService },
            { status: 200 }
        )
    } catch (error: any) {
        console.error('update services error:', error)
        return NextResponse.json(
            { success: false, errorCode: 'INTERNAL_SERVER_ERROR' },
            { status: 500 }
        )
    }
}


export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {

    const { id } = await params
    const serviceId = Number(id)
    if (Number.isNaN(serviceId)) {
        return NextResponse.json(
            { success: false, errorCode: 'INVALID_SERVICE_ID' },
            { status: 400 }
        )
    }

    try {

        const service = await prisma.service.findUnique({
            where: { id: serviceId },
            include: { variants: { include: { _count: { select: { appointments: true } } } } },
        })

        if (!service) {
            return NextResponse.json(
                { success: false, errorCode: 'SERVICE_NOT_FOUND' },
                { status: 404 }
            )
        }

        const hasAppointments = service.variants.some((v) => v._count.appointments > 0)
        if (hasAppointments) {
            return NextResponse.json(
                { success: false, errorCode: 'SERVICE_HAS_APPOINTMENTS' },
                { status: 409 }
            )
        }

        await prisma.$transaction([
            prisma.serviceVariant.deleteMany({ where: { serviceId } }),
            prisma.service.delete({ where: { id: serviceId } }),
        ]);

        return NextResponse.json(
            { success: true, message: 'SERVICE_DELETED' },
            { status: 200 }
        )
    } catch (error) {
        console.error('delete service error', error)
        return NextResponse.json(
            { success: false, errorCode: 'INTERNAL_SERVER_ERROR' },
            { status: 500 }
        )
    }

}