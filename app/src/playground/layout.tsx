import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'

import { cn } from '@/lib/utils'

export const Layout = () => {
  const [isOpen, setIsOpen] = useState(true)

  const toggleSidebar = () => {
    setIsOpen(!isOpen)
  }

  return (
    <>
      <button onClick={toggleSidebar}>Toggle Sidebar</button>
      <div className="flex w-full">
        <motion.div
          className={cn('min-w-0 border border-red-400')}
          initial={false}
          animate={{
            width: isOpen ? 'calc(100% / 3 * 2)' : '100%',
          }}
          transition={{
            duration: 3,
          }}
        >
          Left
        </motion.div>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              className="absolute right-0 w-[33.3333vw] border border-green-400"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{
                duration: 3,
              }}
            >
              derisively marginally obviously moodily silently quizzically
              humorously gaily appositely signally obliquely feasibly
              fractiously criminally moderately fulsomely respectively robustly
              awfully unduly desolately permanent pointer
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
