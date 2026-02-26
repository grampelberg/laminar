import type { Meta, StoryObj } from '@storybook/react-vite'

import { Label } from '@/components/ui/label'

/**
 * Renders an accessible label associated with controls.
 */
const meta = {
  argTypes: {
    children: {
      control: { type: 'text' },
    },
  },
  args: {
    children: 'Your email address',
    htmlFor: 'email',
  },
  component: Label,
  tags: ['autodocs'],
  title: 'ui/Label',
} satisfies Meta<typeof Label>

export default meta

type Story = StoryObj<typeof meta>

/**
 * The default form of the label.
 */
export const Default: Story = {}
