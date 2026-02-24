import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

const NUM_COLUMNS = 12

const fractionVars = (max: number) => {
  const vars: Record<string, string> = {}

  for (let j = 1; j <= max; j += 1) {
    for (let i = 1; i <= j; i += 1) {
      vars[`--width-${i}-${j}`] = `${(i / j) * 100}%`
    }
  }

  return vars
}

export default {
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root': fractionVars(NUM_COLUMNS),
      })
    }),
  ],
} satisfies Config
