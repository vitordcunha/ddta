import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

export function Tabs(props: TabsPrimitive.TabsProps) {
  return <TabsPrimitive.Root {...props} />
}

export function TabsList({ className, ...props }: TabsPrimitive.TabsListProps) {
  return <TabsPrimitive.List className={cn('inline-flex rounded-full border border-neutral-800 bg-neutral-950 p-1', className)} {...props} />
}

export function TabsTrigger({ className, ...props }: TabsPrimitive.TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'rounded-full border border-transparent px-3 py-1.5 text-sm text-neutral-400 transition data-[state=active]:border-primary-500/40 data-[state=active]:bg-primary-500/10 data-[state=active]:text-primary-300',
        className,
      )}
      {...props}
    />
  )
}

export function TabsContent(props: TabsPrimitive.TabsContentProps) {
  return <TabsPrimitive.Content {...props} />
}
