import type { CSSProperties } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ theme = "system", ...props }: ToasterProps) => {
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
          success:
            "border-emerald-200! bg-emerald-50! text-emerald-950! [&_[data-icon]]:text-emerald-700!",
          info:
            "border-sky-200! bg-sky-50! text-sky-950! [&_[data-icon]]:text-sky-700!",
          warning:
            "border-amber-200! bg-amber-50! text-amber-950! [&_[data-icon]]:text-amber-700!",
          error:
            "border-rose-200! bg-rose-50! text-rose-950! [&_[data-icon]]:text-rose-700!",
          description: "text-current! font-medium",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
