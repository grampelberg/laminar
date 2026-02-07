import { countAtom } from '@/playground/design.tsx'

export default {
  countAtom: { value: 100 },
  compoundingAtom: {
    read: get => get(countAtom) * 100,
  },
}
