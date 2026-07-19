import { NextResponse } from "next/server"
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        const employees = await prisma.user.findMany({
            where: { role: 'employee', status: 'active' },
            select: { id: true, firstName: true, lastName: true, specialty: true, bio: true }
        })
        return NextResponse.json(
            { success: true, data: employees },
            { status: 200 }
        )
    } catch (error) {
        console.error('Get employees directory error:', error)
        return NextResponse.json(
            { success: false, errorCode: 'INTERNAL_SERVER_ERROR' },
            { status: 500 }
        )
    }
}
