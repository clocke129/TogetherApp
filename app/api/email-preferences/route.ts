import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { verifyUnsubscribeToken } from '@/lib/email-utils.server'
import { Timestamp } from 'firebase-admin/firestore'

// Verify Firebase ID token from Authorization header → returns uid or null
async function verifyIdToken(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  try {
    const token = authHeader.slice(7)
    const decoded = await adminAuth.verifyIdToken(token)
    return decoded.uid
  } catch {
    return null
  }
}

// GET /api/email-preferences
// GET /api/email-preferences?action=unsubscribe&uid=...&token=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  // --- One-click unsubscribe ---
  if (action === 'unsubscribe') {
    const uid = searchParams.get('uid')
    const token = searchParams.get('token')
    if (!uid || !token || !verifyUnsubscribeToken(uid, token)) {
      return NextResponse.json({ error: 'Invalid unsubscribe link' }, { status: 400 })
    }
    await adminDb.doc(`emailPreferences/${uid}`).set(
      { enabled: false, updatedAt: Timestamp.now() },
      { merge: true }
    )
    // Redirect to the app with a message
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    return NextResponse.redirect(`${appUrl}/?unsubscribed=true`)
  }

  // --- Fetch preferences ---
  const uid = await verifyIdToken(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const snap = await adminDb.doc(`emailPreferences/${uid}`).get()
  if (!snap.exists) {
    return NextResponse.json(null)
  }
  return NextResponse.json(snap.data())
}

// POST /api/email-preferences  — save preferences
export async function POST(req: NextRequest) {
  const uid = await verifyIdToken(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const preferences = {
    enabled: !!body.enabled,
    sendTime: body.sendTime ?? '07:00',
    timezone: body.timezone ?? 'UTC',
    frequency: body.frequency ?? 'daily',
    ...(body.weeklyDay !== undefined ? { weeklyDay: body.weeklyDay } : {}),
    updatedAt: Timestamp.now(),
  }

  await adminDb.doc(`emailPreferences/${uid}`).set(preferences, { merge: true })
  return NextResponse.json({ ok: true })
}
