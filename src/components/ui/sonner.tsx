import type * as React from 'react'
import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      position="bottom-center"
      toastOptions={{
        classNames: {
          toast:
            'group toast !rounded-xl !border-white/10 !bg-[#0c1128]/95 !text-white !shadow-2xl !backdrop-blur-xl',
          description: '!text-white/60',
          actionButton: '!bg-white !text-black',
          cancelButton: '!bg-white/10 !text-white',
          error: '!border-red-400/30',
          success: '!border-emerald-400/30',
        },
      }}
      {...props}
    />
  )
}
