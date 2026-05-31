import { google } from 'googleapis'

export function getOAuth2Client() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  )

  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  })

  return oauth2Client
}

export async function fetchTodayReport(forced = false): Promise<{ found: false } | { found: true; content: string; messageId: string }> {
  const auth = getOAuth2Client()
  const gmail = google.gmail({ version: 'v1', auth })

  const q = forced
    ? `subject:"FW: TableSpace Report" newer_than:1d`
    : `subject:"FW: TableSpace Report" newer_than:4h`

  try {
    const { data: listData } = await gmail.users.messages.list({
      userId: 'me',
      q,
      maxResults: 5,
    })

    if (!listData.messages || listData.messages.length === 0) {
      return { found: false }
    }

    // Get most recent
    const messageId = listData.messages[0].id!

    const { data: message } = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    })

    // Find HTML attachment or body
    const payload = message.payload
    if (!payload) return { found: false }

    // Check parts for HTML attachment
    const htmlContent = findHtmlContent(payload)

    if (!htmlContent) return { found: false }

    return { found: true, content: htmlContent, messageId }
  } catch (error) {
    console.error('Gmail API error:', error)
    return { found: false }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function findHtmlContent(payload: any): string | null {
  if (!payload) return null
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8')
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      const found = findHtmlContent(part)
      if (found) return found
    }
  }

  return null
}
