import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { buildDailyDigestData, generateUnsubscribeToken } from '@/lib/email-utils.server'
import { Timestamp } from 'firebase-admin/firestore'
import { DailyDigestEmail } from '@/emails/DailyDigestEmail'

const resend = new Resend(process.env.RESEND_API_KEY)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://together-app-nine.vercel.app'

// Returns the day-of-week (0–6) in the user's timezone
function currentDayInZone(timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
    })
    const day = formatter.format(new Date())
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(day)
  } catch {
    return new Date().getDay()
  }
}

// Returns "YYYY-MM-DD" in the user's timezone
function todayInZone(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date())
  } catch {
    return new Date().toISOString().split('T')[0]
  }
}

export async function POST(req: NextRequest) {
  // Protect endpoint — Vercel sends Authorization: Bearer {CRON_SECRET}
  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Query all users with email digests enabled
  const prefsSnap = await adminDb
    .collection('emailPreferences')
    .where('enabled', '==', true)
    .get()

  const results: { uid: string; status: string }[] = []

  for (const prefDoc of prefsSnap.docs) {
    // Document ID is the uid: emailPreferences/{uid}
    const uid = prefDoc.id
    const prefs = prefDoc.data()

    try {
      const timezone = prefs.timezone ?? 'UTC'
      const today = todayInZone(timezone)
      const dayOfWeek = currentDayInZone(timezone)

      const testMode = req.headers.get('X-Test-Mode') === '1'

      // Skip if already sent today (bypass in test mode)
      if (!testMode && prefs.lastSentDate === today) {
        results.push({ uid, status: 'skipped:already_sent' })
        continue
      }

      // Frequency checks
      if (prefs.frequency === 'weekdays' && (dayOfWeek === 0 || dayOfWeek === 6)) {
        results.push({ uid, status: 'skipped:weekend' })
        continue
      }
      if (prefs.frequency === 'weekly' && prefs.weeklyDay !== dayOfWeek) {
        results.push({ uid, status: 'skipped:wrong_day' })
        continue
      }

      // Get user's email from Firebase Auth
      const userRecord = await adminAuth.getUser(uid)
      const email = userRecord.email
      if (!email) {
        results.push({ uid, status: 'skipped:no_email' })
        continue
      }

      // Build the prayer list
      const targetDate = new Date()
      const { people, dateLabel } = await buildDailyDigestData(uid, targetDate)

      if (people.length === 0) {
        results.push({ uid, status: 'skipped:empty_list' })
        continue
      }

      const unsubscribeToken = generateUnsubscribeToken(uid)
      const unsubscribeUrl = `${APP_URL}/api/email-preferences?action=unsubscribe&uid=${uid}&token=${unsubscribeToken}`

      // Send via Resend
      await resend.emails.send({
        from: 'Together <onboarding@resend.dev>',
        to: email,
        subject: `Your prayer list for ${dateLabel}`,
        react: DailyDigestEmail({ people, dateLabel, appUrl: APP_URL, unsubscribeUrl }),
      })

      // Update lastSentDate to prevent duplicates
      await prefDoc.ref.set({ lastSentDate: today, updatedAt: Timestamp.now() }, { merge: true })

      results.push({ uid, status: 'sent' })
    } catch (err) {
      console.error(`Failed to send digest for ${uid}:`, err)
      results.push({ uid, status: 'error' })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}

// Vercel cron jobs send GET requests, so alias GET to the same handler
export const GET = POST
