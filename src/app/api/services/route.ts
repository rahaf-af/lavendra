import { NextRequest, NextResponse } from "next/server"
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const createServicesStandards = z.object({
    nameAr: z.string({ error: (issue) => (issue.input === undefined ? 'NAME_AR_REQUIRED' : undefined) }).trim().min(2, 'NAME_AR_TOO_SHORT').max(100, 'NAME_AR_TOO_LONG').regex(/^[\u0600-\u06FFa-zA-Z\s]+$/, 'NAME_AR_INVALID_CHARACTERS'),
    nameEn: z.string({ error: (issue) => (issue.input === undefined ? 'NAME_EN_REQUIRED' : undefined) }).trim().min(2, 'NAME_EN_TOO_SHORT').max(100, 'NAME_EN_TOO_LONG').regex(/^[\u0600-\u06FFa-zA-Z\s]+$/, 'NAME_EN_INVALID_CHARACTERS'),
    descriptionAr: z.string({ error: (issue) => (issue.input === undefined ? 'DESCRIPTION_AR_REQUIRED' : undefined) }).trim().max(500, 'DESCRIPTION_AR_TOO_LONG'),
    descriptionEn: z.string({ error: (issue) => (issue.input === undefined ? 'DESCRIPTION_EN_REQUIRED' : undefined) }).trim().max(500, 'DESCRIPTION_EN_TOO_LONG'),
    imageUrl: z.string({ error: (issue) => (issue.input === undefined ? 'IMAGE_URL_REQUIRED' : undefined) }).trim().url('IMAGE_URL_INVALID'),
    variants: z
        .array(
            z.object({
                nameAr: z.string().trim().min(1, 'VARIANT_NAME_AR_REQUIRED'),
                nameEn: z.string().trim().min(1, 'VARIANT_NAME_En_REQUIRED'),
                price: z.number({ error: (issue) => (issue.input === undefined ? 'VARIANT_PRICE_REQUIRED' : undefined) }).positive('VARIANT_PRICE_MUST_BE_POSITIVE'),
                durationMinutes: z.number({ error: (issue) => (issue.input === undefined ? "VARIANT_DURATION_REQUIRED" : undefined) }).int("VARIANT_DURATION_MUST_BE_INTEGER").positive("VARIANT_DURATION_MUST_BE_POSITIVE"),
            })
        ).min(1, 'AT_LEAST_ONE_VARIANT_REQUIRED')
})

export async function GET() {
    try {
        const services = await prisma.service.findMany({
            include: { variants: true },
            orderBy: { createdAt: 'desc' }
        })
        return NextResponse.json(
            { success: true, data: services },
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


export async function POST(request: NextRequest) {
    let serviceData: unknown

    try {
        serviceData = await request.json()
    } catch {
        return NextResponse.json(
            { success: false, errorCode: 'INVALID_JSON_BODY' },
            { status: 400 }
        )
    }

    const parsed = createServicesStandards.safeParse(serviceData)
    if (!parsed.success) {
        return NextResponse.json(
            { success: false, errorCode: parsed.error.issues[0].message, field: parsed.error.issues[0].path.join(".") },
            { status: 400 }
        )
    }

    const { variants, ...servicesData } = parsed.data
    try {
        const newService = await prisma.service.create({
            data: { ...servicesData, variants: { create: variants } },
            include: { variants: true }
        })
        return NextResponse.json(
            { success: true, message: 'SERVICE_CREATED', data: newService },
            { status: 201 }
        )
    } catch (error) {
        console.error('add service error', error)
        return NextResponse.json(
            { success: false, errorCode: 'INTERNAL_SERVER_ERROR' },
            { status: 500 }
        )
    }
}
