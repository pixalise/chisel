import { cn } from "@/lib/utils"
import * as React from "react"
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (input1, ref) => {
    const { className, ...props } = input1
    return (
      <div
        ref={ref}
        className={cn("rounded-xl border bg-card text-card-foreground shadow", className)}
        {...props}
      />
    )
  }
)
Card.displayName = "Card"
const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (input1, ref) => {
    const { className, ...props } = input1
    return <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  }
)
CardContent.displayName = "CardContent"
export { Card, CardContent }
