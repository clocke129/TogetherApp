"use client"

import { useState, useEffect } from "react"
import { Mail } from "lucide-react"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useAuth } from "@/context/AuthContext"
import type { EmailPreferences } from "@/lib/types"

// Generate time options in 30-min increments from 5:00 to 22:00
const TIME_OPTIONS = Array.from({ length: 35 }, (_, i) => {
  const totalMins = 5 * 60 + i * 30
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  const hh = String(h).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  const value = `${hh}:${mm}`
  const label = new Date(2000, 0, 1, h, m).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  return { value, label }
})

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const DEFAULT_PREFS: EmailPreferences = {
  enabled: false,
  sendTime: '07:00',
  timezone: 'UTC',
  frequency: 'daily',
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

  // Fetch current preferences when dialog opens
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
            // First time — auto-detect timezone
            setPrefs({
              ...DEFAULT_PREFS,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            })
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
            {/* Enable toggle */}
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
              <>
                {/* Send time */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Time</Label>
                  <Select
                    value={prefs.sendTime}
                    onValueChange={(v) => setPrefs(p => ({ ...p, sendTime: v }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-52">
                      {TIME_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Timezone */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Timezone</Label>
                  <Select
                    value={prefs.timezone}
                    onValueChange={(v) => setPrefs(p => ({ ...p, timezone: v }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-52">
                      {Intl.supportedValuesOf('timeZone').map(tz => (
                        <SelectItem key={tz} value={tz}>{tz.replace(/_/g, ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Frequency */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Frequency</Label>
                  <RadioGroup
                    value={prefs.frequency}
                    onValueChange={(v) => setPrefs(p => ({ ...p, frequency: v as EmailPreferences['frequency'] }))}
                    className="space-y-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="daily" id="freq-daily" />
                      <Label htmlFor="freq-daily" className="text-sm font-normal cursor-pointer">Daily</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="weekdays" id="freq-weekdays" />
                      <Label htmlFor="freq-weekdays" className="text-sm font-normal cursor-pointer">Weekdays only</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="weekly" id="freq-weekly" />
                      <Label htmlFor="freq-weekly" className="text-sm font-normal cursor-pointer">Weekly</Label>
                      {prefs.frequency === 'weekly' && (
                        <Select
                          value={String(prefs.weeklyDay ?? 1)}
                          onValueChange={(v) => setPrefs(p => ({ ...p, weeklyDay: Number(v) }))}
                        >
                          <SelectTrigger className="h-7 w-32 text-xs ml-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DAY_NAMES.map((day, i) => (
                              <SelectItem key={i} value={String(i)}>{day}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </RadioGroup>
                </div>
              </>
            )}

            {/* Save button */}
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
