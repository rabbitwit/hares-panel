import { Pipette } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { isEyedropperSupported, pickScreenColor, toHex6 } from '@/lib/eyedropper'

/** Empty string means "follow the automatic brand colour". */
const PRESETS = ['', '#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899']

interface ColorFieldProps {
  value: string
  onChange: (color: string) => void
  placeholder?: string
  className?: string
}

/**
 * Colour input with presets and a screen eyedropper.
 *
 * Automatic brand detection covers the common sites, but a self-hosted app or
 * an unusual favicon has nothing to detect from -- then the user picks the
 * colour themselves, ideally straight off the icon.
 */
export function ColorField({ value, onChange, placeholder = '留空自动', className }: ColorFieldProps) {
  const canPick = isEyedropperSupported()

  const pick = async () => {
    const picked = await pickScreenColor()
    if (picked) onChange(picked)
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset || 'auto'}
            type="button"
            onClick={() => onChange(preset)}
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full border border-border/80 text-[9px] text-muted-foreground transition-transform hover:scale-110',
              !preset && 'bg-[linear-gradient(135deg,#fff_50%,#333_50%)]',
              value === preset && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
            )}
            style={preset ? { backgroundColor: preset } : undefined}
            title={preset || '自动匹配品牌色'}
            aria-label={preset || '自动匹配品牌色'}
          >
            {!preset && 'A'}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={toHex6(value)}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-9 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
          aria-label="选择颜色"
        />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-8 min-w-0 flex-1 font-mono text-xs"
          maxLength={32}
        />
        {canPick && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 px-2"
            onClick={() => void pick()}
            title="从屏幕上取色"
          >
            <Pipette className="h-3.5 w-3.5" />
            <span className="sr-only">取色笔</span>
          </Button>
        )}
      </div>
    </div>
  )
}
