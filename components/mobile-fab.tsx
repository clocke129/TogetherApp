"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FileText } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/context/AuthContext"

export function MobileFAB() {
  const [isOpen, setIsOpen] = useState(false)
  const [content, setContent] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const { user } = useAuth()

  const handleSave = async () => {
    if (!user || !content.trim()) return

    setIsSaving(true)

    try {
      // TODO: Implement parsing and saving logic
      // This will parse @person and #date tags and save to Firestore
      console.log("Quick capture content:", content)

      // Clear and close after save
      setContent("")
      setIsOpen(false)
    } catch (error) {
      console.error("Error saving quick capture:", error)
    } finally {
      setIsSaving(false)
    }
  }

  if (!user) return null

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full bg-shrub text-white shadow-lg hover:bg-shrub/90 transition-all hover:scale-110 md:hidden flex items-center justify-center"
        aria-label="Quick capture"
      >
        <FileText className="h-6 w-6" />
      </button>

      {/* Quick Capture Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Quick Capture</DialogTitle>
            <DialogDescription>
              Add prayer notes, requests, or follow-ups
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Textarea
              placeholder="@chris pray for new job&#10;#1225 follow up about interview"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
              autoFocus
            />

            <div className="text-xs text-muted-foreground space-y-1">
              <p>💡 <strong>@name</strong> - Tag or create a person</p>
              <p>💡 <strong>#MMDD</strong> - Add follow-up date (e.g., #1225 for Dec 25)</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setContent("")
                setIsOpen(false)
              }}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!content.trim() || isSaving}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

