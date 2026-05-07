"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Sparkles, X } from 'lucide-react'
import { useDemoData } from '@/context/DemoDataContext'

interface DemoBannerProps {
  page: 'today' | 'groups' | 'followups'
}

const MESSAGES = {
  today: "You're viewing demo data. Add your own people to get started.",
  groups: "Tap + Group to create a group and add people. Use the gear icon on each group to set prayer days. People without a group appear in Everyone.",
  followups: "This follow-up is demo data. Head to Groups to add your own people.",
}

export function DemoBanner({ page }: DemoBannerProps) {
  const { hasDemoData, removeDemoData } = useDemoData()
  const router = useRouter()
  const [isRemoving, setIsRemoving] = useState(false)

  if (!hasDemoData) return null

  async function handleRemove() {
    setIsRemoving(true)
    await removeDemoData()
    window.location.reload()
  }

  return (
    <div className="mb-4 rounded-lg border border-shrub/30 bg-shrub/10 px-4 py-3 flex items-start gap-3">
      <Sparkles className="h-4 w-4 text-shrub mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground">{MESSAGES[page]}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {page !== 'groups' && (
          <Button
            size="sm"
            className="bg-shrub hover:bg-shrub/90 h-7 text-xs"
            onClick={() => router.push('/assignments')}
          >
            Go to Groups
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-muted-foreground hover:text-destructive"
          onClick={handleRemove}
          disabled={isRemoving}
        >
          {isRemoving ? 'Removing...' : 'Remove demo'}
        </Button>
      </div>
    </div>
  )
}
