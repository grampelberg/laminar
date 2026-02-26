declare module 'react-syntax-highlighter' {
  import type { ComponentType, CSSProperties } from 'react'

  export interface SyntaxHighlighterProps {
    children?: string
    customStyle?: CSSProperties
    language?: string
    lineNumberStyle?: CSSProperties
    lineProps?:
      | { style?: CSSProperties }
      | ((lineNumber: number) => { style?: CSSProperties })
    showLineNumbers?: boolean
    style?: Record<string, CSSProperties>
    wrapLines?: boolean
    wrapLongLines?: boolean
  }

  export const Prism: ComponentType<SyntaxHighlighterProps>
}

declare module 'react-syntax-highlighter/dist/esm/styles/prism' {
  import type { CSSProperties } from 'react'

  export const oneDark: Record<string, CSSProperties>
  export const oneLight: Record<string, CSSProperties>
}
