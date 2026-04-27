"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/context/AuthContext"
import type { EmailPreferences } from "@/lib/types"

const US_TIMEZONES = [
  { value: 'America/New_York',    label: 'Eastern'  },
  { value: 'America/Chicago',     label: 'Central'  },
  { value: 'America/Denver',      label: 'Mountain' },
  { value: 'America/Phoenix',     label: 'Arizona (no DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific'  },
  { value: 'America/Anchorage',   label: 'Alaska'   },
  { value: 'Pacific/Honolulu',    label: 'Hawaii'   },
]

const DEFAULT_PREFS: EmailPreferences = {
  enabled: false,
  timezone: 'America/New_York',
}

interface EmailPreferencesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EmailPreferencesDialog({ open, onOpenChange }: EmailPreferencesDialogProps) {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState<EmailPreferences>(DEFAULT_PREFS)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [savedMessage, setSavedMessage] = useState(false)

  useEffect(() => {
    if (!open || !user) return
    setIsLoading(true)

    user.getIdToken().then(async (token) => {
      try {
        const res = await fetch('/api/email-preferences', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          if (data) {
            setPrefs({ ...DEFAULT_PREFS, ...data })
          } else {
            const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
            const matched = US_TIMEZONES.find(tz => tz.value === detected)?.value ?? 'America/New_York'
            setPrefs({ ...DEFAULT_PREFS, timezone: matched })
          }
        }
      } catch (err) {
        console.error('Failed to fetch email preferences:', err)
      } finally {
        setIsLoading(false)
      }
    })
  }, [open, user])

  const handleSave = async () => {
    if (!user) return
    setIsSaving(true)
    try {
      const token = await user.getIdToken()
      await fetch('/api/email-preferences', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(prefs),
      })
      setSavedMessage(true)
      setTimeout(() => setSavedMessage(false), 2000)
    } catch (err) {
      console.error('Failed to save email preferences:', err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>Email Digest</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-5 py-2">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="email-toggle" className="text-sm font-normal cursor-pointer leading-snug">
                Send me a daily prayer list
              </Label>
              <Switch
                id="email-toggle"
                checked={prefs.enabled}
                onCheckedChange={(checked) => setPrefs(p => ({ ...p, enabled: checked }))}
              />
            </div>

            {prefs.enabled && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Timezone</Label>
                <Select
                  value={prefs.timezone}
                  onValueChange={(v) => setPrefs(p => ({ ...p, timezone: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {US_TIMEZONES.map(tz => (
                      <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              className="w-full bg-shrub hover:bg-shrub/90"
              onClick={handleSave}
              disabled={isSaving}
            >
              {savedMessage ? 'Saved!' : isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
