import { createContext, useContext } from 'react'
import type { Owner, Workspace, Settings, Task } from '../../../shared/model'
export type CaptureContext = { courseId?: string; sessionId?: string | null; tab?: string }
export type AppData = {
  user: Owner
  w: Workspace
  p: Settings
  term?: string
  setTerm: (v?: string) => void
  toast: (text: string, undo?: () => void, error?: boolean) => void
  capture: (v?: CaptureContext) => void
  task: (v?: CaptureContext, existing?: Task) => void
  celebrate: () => void
  cheering: boolean
  now: Date
}
export const AppContext = createContext<AppData | null>(null)
export function useApp() {
  const value = useContext(AppContext)
  if (!value) throw new Error('Ruang belajar belum dimuat.')
  return value
}
