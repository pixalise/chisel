import { cn } from "@/lib/utils"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"
const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)
const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>
>((input1, ref) => {
  const { className, ...props } = input1
  return <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />
})
Label.displayName = LabelPrimitive.Root.displayName
export { Label }
