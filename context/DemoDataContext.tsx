"use client"

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebaseConfig'
import { hasDemoData, isNewUser, seedDemoData, removeDemoData as removeDemoDataFn, resetAccount as resetAccountFn } from '@/lib/demo-data'

interface DemoDataContextValue {
  hasDemoData: boolean
  isLoading: boolean
  removeDemoData: () => Promise<void>
  resetAccount: () => Promise<void>
}

const DemoDataContext = createContext<DemoDataContextValue>({
  hasDemoData: false,
  isLoading: true,
  removeDemoData: async () => {},
  resetAccount: async () => {},
})

export function DemoDataProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [hasDemo, setHasDemo] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setIsLoading(false)
      return
    }

    async function checkAndSeed() {
      setIsLoading(true)
      try {
        const demoExists = await hasDemoData(db, user!.uid)
        if (demoExists) {
          setHasDemo(true)
          return
        }

        const newUser = await isNewUser(db, user!.uid)
        if (newUser) {
          await seedDemoData(db, user!.uid)
          setHasDemo(true)
        }
      } catch (err) {
        console.error('[DemoData] Error checking/seeding demo data:', err)
      } finally {
        setIsLoading(false)
      }
    }

    checkAndSeed()
  }, [user, authLoading])

  const removeDemoData = useCallback(async () => {
    if (!user) return
    try {
      await removeDemoDataFn(db, user.uid)
      sessionStorage.removeItem(`prayerApp_dailyCache_${user.uid}`)
      setHasDemo(false)
    } catch (err) {
      console.error('[DemoData] Error removing demo data:', err)
    }
  }, [user])

  const resetAccount = useCallback(async () => {
    if (!user) return
    try {
      await resetAccountFn(db, user.uid)
      sessionStorage.removeItem(`prayerApp_dailyCache_${user.uid}`)
      setHasDemo(true)
    } catch (err) {
      console.error('[DemoData] Error resetting account:', err)
    }
  }, [user])

  return (
    <DemoDataContext.Provider value={{ hasDemoData: hasDemo, isLoading, removeDemoData, resetAccount }}>
      {children}
    </DemoDataContext.Provider>
  )
}

export function useDemoData() {
  return useContext(DemoDataContext)
}
