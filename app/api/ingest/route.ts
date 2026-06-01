import { NextRequest, NextResponse } from 'next/server'
import { secureCompare } from '@/lib/utils/secureCompare'
import { processIngest } from '@/lib/services/ingestService'

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret')
  if (!secret || !secureCompare(secret, process.env.CRON_SECRET ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let htmlContent: string

  try {
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File
      if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      htmlContent = await file.text()
    } else {
      const body = await request.json()
      htmlContent = body.html
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // SEC-H-04: reject payloads larger than 1 MB
  if (!htmlContent || htmlContent.length > 1_000_000) {
    return NextResponse.json({ success: false, reason: 'payload_too_large' }, { status: 413 })
  }

  const isTest = request.nextUrl.searchParams.get('test') === '1'
  const result = await processIngest(htmlContent, isTest)
  return NextResponse.json(result)
}
