import Anser from 'anser'
import { useMemo } from 'react'

import { cn } from '@/lib/utils'

interface AnsiToken {
  bg?: string
  content: string
  decorations?: string[]
  fg?: string
  isInverted?: boolean
}

const ANSI_FG_CLASS: Record<string, string> = {
  'ansi-black': 'text-zinc-400',
  'ansi-red': 'text-red-400',
  'ansi-green': 'text-emerald-400',
  'ansi-yellow': 'text-amber-400',
  'ansi-blue': 'text-blue-400',
  'ansi-magenta': 'text-fuchsia-400',
  'ansi-cyan': 'text-sky-400',
  'ansi-white': 'text-zinc-200',
  'ansi-bright-black': 'text-zinc-300',
  'ansi-bright-red': 'text-red-300',
  'ansi-bright-green': 'text-emerald-300',
  'ansi-bright-yellow': 'text-amber-300',
  'ansi-bright-blue': 'text-blue-300',
  'ansi-bright-magenta': 'text-fuchsia-300',
  'ansi-bright-cyan': 'text-sky-300',
  'ansi-bright-white': 'text-zinc-100',
}

const ANSI_BG_CLASS: Record<string, string> = {
  'ansi-black': 'bg-zinc-400/25',
  'ansi-red': 'bg-red-400/25',
  'ansi-green': 'bg-emerald-400/25',
  'ansi-yellow': 'bg-amber-400/25',
  'ansi-blue': 'bg-blue-400/25',
  'ansi-magenta': 'bg-fuchsia-400/25',
  'ansi-cyan': 'bg-sky-400/25',
  'ansi-white': 'bg-zinc-200/25',
  'ansi-bright-black': 'bg-zinc-300/25',
  'ansi-bright-red': 'bg-red-300/25',
  'ansi-bright-green': 'bg-emerald-300/25',
  'ansi-bright-yellow': 'bg-amber-300/25',
  'ansi-bright-blue': 'bg-blue-300/25',
  'ansi-bright-magenta': 'bg-fuchsia-300/25',
  'ansi-bright-cyan': 'bg-sky-300/25',
  'ansi-bright-white': 'bg-zinc-100/25',
}

const ANSI_DECORATION_CLASS: Record<string, string> = {
  bold: 'font-bold',
  dim: 'opacity-60',
  italic: 'italic',
  strikethrough: 'line-through',
  underline: 'underline',
}

export const AnsiText = ({
  className,
  text,
}: {
  className?: string
  text: string
}) => {
  const tokens = useMemo<AnsiToken[]>(() => {
    const parsed = Anser.ansiToJson(text, {
      json: true,
      remove_empty: true,
      use_classes: true,
    }) as AnsiToken[]

    if (parsed.length === 0) {
      return [
        {
          content: text,
        },
      ]
    }

    return parsed
  }, [text])

  return (
    <span className={cn('wrap-break-word whitespace-pre-wrap', className)}>
      {tokens.map((token, index) => (
        <Token key={index} token={token} />
      ))}
    </span>
  )
}

const Token = ({ token }: { token: AnsiToken }) => {
  const [fg, bg] = token.isInverted
    ? [token.bg, token.fg]
    : [token.fg, token.bg]

  return (
    <span
      className={cn(
        fg && ANSI_FG_CLASS[fg],
        bg && ANSI_BG_CLASS[bg],
        token.decorations?.map(
          (decoration: string) => ANSI_DECORATION_CLASS[decoration],
        ),
      )}
    >
      {token.content}
    </span>
  )
}
