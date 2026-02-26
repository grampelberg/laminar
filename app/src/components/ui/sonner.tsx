import { Toaster as Sonner, type ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner closeButton expand richColors theme="system" {...props} />
)

export { Toaster }
