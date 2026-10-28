import { cn } from "@/lib/utils"
import * as React from "react"
const ScrollArea = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (input1, ref) => {
    const { className, children, ...props } = input1
    return (
      <div ref={ref} className={cn("overflow-auto", className)} {...props}>
        {children}
      </div>
    )
  }
)
ScrollArea.displayName = "ScrollArea"
export { ScrollArea }
