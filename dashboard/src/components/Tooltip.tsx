import { useState, useRef, useCallback, useLayoutEffect, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right'

const VIEWPORT_MARGIN = 8

interface TooltipCoords {
  top: number
  left: number
}

interface TriggerRect {
  top: number
  left: number
  right: number
  bottom: number
  width: number
  height: number
}

interface UseTooltipOptions {
  position?: TooltipPosition
  delay?: number
}

interface UseTooltipReturn<T extends HTMLElement> {
  triggerRef: RefObject<T | null>
  triggerProps: {
    onMouseEnter: () => void
    onMouseLeave: () => void
  }
  tooltipProps: {
    isVisible: boolean
    coords: TooltipCoords
    position: TooltipPosition
    triggerRect: TriggerRect | null
  }
}

export function useTooltip<T extends HTMLElement = HTMLElement>(
  options: UseTooltipOptions = {}
): UseTooltipReturn<T> {
  const { position = 'top', delay = 200 } = options
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState<TooltipCoords>({ top: 0, left: 0 })
  const [triggerRect, setTriggerRect] = useState<TriggerRect | null>(null)
  const triggerRef = useRef<T>(null)
  const timeoutRef = useRef<number | null>(null)

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return

    const rect = triggerRef.current.getBoundingClientRect()
    setTriggerRect({
      top: rect.top,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    })
    const padding = VIEWPORT_MARGIN
    const scrollY = window.scrollY
    const scrollX = window.scrollX

    let top = 0
    let left = 0

    switch (position) {
      case 'top':
        top = rect.top + scrollY - padding
        left = rect.left + scrollX + rect.width / 2
        break
      case 'bottom':
        top = rect.bottom + scrollY + padding
        left = rect.left + scrollX + rect.width / 2
        break
      case 'left':
        top = rect.top + scrollY + rect.height / 2
        left = rect.left + scrollX - padding
        break
      case 'right':
        top = rect.top + scrollY + rect.height / 2
        left = rect.right + scrollX + padding
        break
    }

    setCoords({ top, left })
  }, [position])

  const handleMouseEnter = useCallback(() => {
    timeoutRef.current = window.setTimeout(() => {
      calculatePosition()
      setIsVisible(true)
    }, delay)
  }, [calculatePosition, delay])

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsVisible(false)
    setTriggerRect(null)
  }, [])

  return {
    triggerRef,
    triggerProps: {
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
    },
    tooltipProps: {
      isVisible,
      coords,
      position,
      triggerRect,
    },
  }
}

interface TooltipPortalProps {
  isVisible: boolean
  coords: TooltipCoords
  position: TooltipPosition
  triggerRect: TriggerRect | null
  content: ReactNode
  className?: string
}

function getTransformOrigin(position: TooltipPosition) {
  switch (position) {
    case 'top': return 'bottom center'
    case 'bottom': return 'top center'
    case 'left': return 'center right'
    case 'right': return 'center left'
  }
}

function getTransform(position: TooltipPosition) {
  switch (position) {
    case 'top': return 'translateX(-50%) translateY(-100%)'
    case 'bottom': return 'translateX(-50%)'
    case 'left': return 'translateY(-50%) translateX(-100%)'
    case 'right': return 'translateY(-50%)'
  }
}

/** Compute viewport-aware style (fixed position, clamped so tooltip stays on screen). */
function useViewportAwareStyle(
  isVisible: boolean,
  triggerRect: TriggerRect | null,
  position: TooltipPosition,
  tooltipRef: RefObject<HTMLDivElement | null>
) {
  const [style, setStyle] = useState<{
    left: number
    top: number
    transform: string
    transformOrigin: string
  } | null>(null)

  useLayoutEffect(() => {
    if (!isVisible || !triggerRect) {
      setStyle(null)
      return
    }

    const measure = () => {
      const el = tooltipRef.current
      if (!el) return

      const rect = el.getBoundingClientRect()
      const tw = rect.width
      const th = rect.height
      const vw = window.innerWidth
      const vh = window.innerHeight
      const m = VIEWPORT_MARGIN

      let pos = position
      let left = 0
      let top = triggerRect.top + triggerRect.height / 2

      switch (position) {
        case 'right':
          left = triggerRect.right + 8
          if (left + tw > vw - m) {
            if (triggerRect.left - 8 - tw >= m) {
              pos = 'left'
              left = triggerRect.left - 8 - tw
            } else {
              left = vw - m - tw
            }
          }
          break
        case 'left':
          left = triggerRect.left - 8 - tw
          if (left < m) {
            if (triggerRect.right + 8 + tw <= vw - m) {
              pos = 'right'
              left = triggerRect.right + 8
            } else {
              left = m
            }
          }
          break
        case 'top':
          left = triggerRect.left + triggerRect.width / 2
          top = triggerRect.top - 8 - th
          if (top < m) {
            top = m
          }
          if (left - tw / 2 < m) left = m + tw / 2
          if (left + tw / 2 > vw - m) left = vw - m - tw / 2
          break
        case 'bottom':
          left = triggerRect.left + triggerRect.width / 2
          top = triggerRect.bottom + 8
          if (top + th > vh - m) {
            top = vh - m - th
          }
          if (left - tw / 2 < m) left = m + tw / 2
          if (left + tw / 2 > vw - m) left = vw - m - tw / 2
          break
      }

      setStyle({
        left,
        top,
        transform: getTransform(pos),
        transformOrigin: getTransformOrigin(pos),
      })
    }

    const el = tooltipRef.current
    if (el) {
      measure()
    } else {
      const id = requestAnimationFrame(() => measure())
      return () => cancelAnimationFrame(id)
    }
  }, [isVisible, triggerRect, position, tooltipRef])

  return style
}

export function TooltipPortal({
  isVisible,
  coords,
  position,
  triggerRect,
  content,
  className = '',
}: TooltipPortalProps) {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const viewportStyle = useViewportAwareStyle(isVisible, triggerRect, position, tooltipRef)

  const useViewportPlacement = Boolean(triggerRect && viewportStyle)
  const waitingForMeasure = Boolean(triggerRect && !viewportStyle && isVisible)
  const finalStyle = useViewportPlacement && viewportStyle
    ? {
        position: 'fixed' as const,
        left: viewportStyle.left,
        top: viewportStyle.top,
        transform: viewportStyle.transform,
        transformOrigin: viewportStyle.transformOrigin,
        zIndex: 9999,
      }
    : {
        position: 'absolute' as const,
        top: coords.top,
        left: coords.left,
        transform: getTransform(position),
        transformOrigin: getTransformOrigin(position),
        zIndex: 9999,
        visibility: waitingForMeasure ? ('hidden' as const) : undefined,
      }

  return createPortal(
    <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={tooltipRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1 }}
          style={finalStyle}
          className={`
            bg-hud-bg-panel border border-hud-line
            px-3 py-2 text-xs text-hud-text
            pointer-events-none
            ${className || 'max-w-xs'}
          `}
        >
          {content}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

interface TooltipProps {
  children: ReactNode
  content: ReactNode
  position?: TooltipPosition
  delay?: number
  className?: string
}

export function Tooltip({ 
  children, 
  content, 
  position = 'top',
  delay = 200,
  className = ''
}: TooltipProps) {
  const { triggerRef, triggerProps, tooltipProps } = useTooltip<HTMLDivElement>({ position, delay })

  return (
    <>
      <div
        ref={triggerRef}
        {...triggerProps}
        className="block"
      >
        {children}
      </div>
      <TooltipPortal
        {...tooltipProps}
        triggerRect={tooltipProps.triggerRect}
        content={content}
        className={className}
      />
    </>
  )
}

interface TooltipContentProps {
  title?: string
  items?: Array<{ label: string; value: string | number; color?: string }>
  description?: string
}

export function TooltipContent({ title, items, description }: TooltipContentProps) {
  return (
    <div className="space-y-2">
      {title && (
        <div className="hud-label text-hud-primary border-b border-hud-line/50 pb-1">
          {title}
        </div>
      )}
      
      {items && items.length > 0 && (
        <div className="space-y-1">
          {items.map((item, i) => (
            <div key={i} className="flex justify-between gap-4">
              <span className="text-hud-text-dim">{item.label}</span>
              <span className={item.color || 'text-hud-text-bright'}>{item.value}</span>
            </div>
          ))}
        </div>
      )}
      
      {description && (
        <p className="text-hud-text-dim text-hud-sm leading-tight">
          {description}
        </p>
      )}
    </div>
  )
}
