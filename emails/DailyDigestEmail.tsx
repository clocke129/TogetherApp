import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'

interface PersonDigest {
  name: string
  prayerRequest?: string
}

interface DailyDigestEmailProps {
  people: PersonDigest[]
  dateLabel: string       // "Monday, April 21"
  appUrl: string
  unsubscribeUrl: string
}

export function DailyDigestEmail({
  people,
  dateLabel,
  appUrl,
  unsubscribeUrl,
}: DailyDigestEmailProps) {
  const previewText = `Your prayer list for ${dateLabel} — ${people.map(p => p.name).join(', ')}`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logoText}>Together</Text>
            <Text style={dateText}>{dateLabel}</Text>
          </Section>

          <Hr style={divider} />

          {/* Intro */}
          <Text style={introText}>Your prayer list for today</Text>

          {/* People list */}
          <Section style={listSection}>
            {people.length === 0 ? (
              <Text style={emptyText}>No one scheduled for today.</Text>
            ) : (
              people.map((person, i) => (
                <Section key={i} style={personRow}>
                  <Text style={personName}>{person.name}</Text>
                  {person.prayerRequest && (
                    <Text style={prayerRequestText}>"{person.prayerRequest}"</Text>
                  )}
                </Section>
              ))
            )}
          </Section>

          {/* CTA */}
          <Section style={ctaSection}>
            <Button href={`${appUrl}/prayer`} style={ctaButton}>
              Open Today's List →
            </Button>
            <Button href={`${appUrl}/followups`} style={secondaryButton}>
              View Follow-Ups →
            </Button>
          </Section>

          <Hr style={divider} />

          {/* Footer */}
          <Text style={footerText}>
            You're receiving this because you enabled email digests in Together.{' '}
            <Link href={unsubscribeUrl} style={unsubscribeLink}>
              Unsubscribe
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default DailyDigestEmail

// --- Styles ---
const body: React.CSSProperties = {
  backgroundColor: '#f9f9f6',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  margin: 0,
  padding: '32px 0',
}

const container: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  margin: '0 auto',
  maxWidth: '480px',
  padding: '32px 40px',
}

const header: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  marginBottom: '0',
}

const logoText: React.CSSProperties = {
  color: '#8A9A80',
  fontSize: '18px',
  fontWeight: '700',
  margin: '0 0 4px 0',
  letterSpacing: '-0.3px',
}

const dateText: React.CSSProperties = {
  color: '#888',
  fontSize: '13px',
  margin: '0',
}

const divider: React.CSSProperties = {
  borderColor: '#e8e8e3',
  margin: '16px 0',
}

const introText: React.CSSProperties = {
  color: '#333',
  fontSize: '15px',
  fontWeight: '600',
  margin: '0 0 16px 0',
}

const listSection: React.CSSProperties = {
  marginBottom: '8px',
}

const personRow: React.CSSProperties = {
  marginBottom: '12px',
}

const personName: React.CSSProperties = {
  color: '#1a1a1a',
  fontSize: '15px',
  fontWeight: '500',
  margin: '0 0 2px 0',
}

const prayerRequestText: React.CSSProperties = {
  color: '#777',
  fontSize: '13px',
  fontStyle: 'italic',
  margin: '0',
  paddingLeft: '8px',
}

const emptyText: React.CSSProperties = {
  color: '#999',
  fontSize: '14px',
  fontStyle: 'italic',
}

const ctaSection: React.CSSProperties = {
  textAlign: 'center',
  margin: '24px 0',
}

const ctaButton: React.CSSProperties = {
  backgroundColor: '#8A9A80',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600',
  padding: '12px 28px',
  textDecoration: 'none',
  display: 'inline-block',
  marginBottom: '8px',
}

const secondaryButton: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '6px',
  color: '#8A9A80',
  fontSize: '14px',
  fontWeight: '600',
  padding: '10px 28px',
  textDecoration: 'none',
  display: 'inline-block',
  border: '1.5px solid #8A9A80',
}

const footerText: React.CSSProperties = {
  color: '#aaa',
  fontSize: '12px',
  margin: '0',
}

const unsubscribeLink: React.CSSProperties = {
  color: '#8A9A80',
}
