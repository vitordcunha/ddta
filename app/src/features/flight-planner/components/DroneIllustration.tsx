import { cn } from '@/lib/utils'
import type { DroneModel } from '@/features/flight-planner/types'

interface DroneIllustrationProps {
  model: DroneModel
  className?: string
  size?: number
}

export function DroneIllustration({ model, className, size = 120 }: DroneIllustrationProps) {
  const m = model.toLowerCase()
  if (m.includes('phantom')) {
    return <Phantom4Drone className={className} size={size} />
  }
  if (m.includes('m300') || m.includes('m350') || m.includes('mavic')) {
    return <Mavic3Drone className={className} size={size} />
  }
  if (m.includes('mini')) {
    return <MiniDrone className={className} size={size} />
  }
  if (m.includes('air')) {
    return <Air3Drone className={className} size={size} />
  }
  return <MiniDrone className={className} size={size} />
}

function MiniDrone({ className, size }: { className?: string; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      className={cn('text-primary-400', className)}
      aria-hidden
    >
      {/* Body */}
      <rect x="43" y="40" width="34" height="40" rx="8" fill="currentColor" opacity="0.85" />
      {/* Front LED bar */}
      <rect x="50" y="40" width="20" height="2.5" rx="1.25" fill="white" opacity="0.7" />
      {/* Camera gimbal */}
      <circle cx="60" cy="52" r="9" fill="currentColor" opacity="0.45" />
      <circle cx="60" cy="52" r="5.5" fill="currentColor" opacity="0.55" />
      <circle cx="60" cy="52" r="2.5" fill="currentColor" opacity="0.9" />
      {/* Arms - diagonal foldable */}
      <line x1="46" y1="43" x2="21" y2="18" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" opacity="0.8" />
      <line x1="74" y1="43" x2="99" y2="18" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" opacity="0.8" />
      <line x1="46" y1="77" x2="21" y2="102" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.65" />
      <line x1="74" y1="77" x2="99" y2="102" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.65" />
      {/* Propeller discs */}
      <circle cx="21" cy="18" r="13" stroke="currentColor" strokeWidth="1" opacity="0.18" fill="currentColor" fillOpacity="0.07" />
      <circle cx="99" cy="18" r="13" stroke="currentColor" strokeWidth="1" opacity="0.18" fill="currentColor" fillOpacity="0.07" />
      <circle cx="21" cy="102" r="13" stroke="currentColor" strokeWidth="1" opacity="0.12" fill="currentColor" fillOpacity="0.05" />
      <circle cx="99" cy="102" r="13" stroke="currentColor" strokeWidth="1" opacity="0.12" fill="currentColor" fillOpacity="0.05" />
      {/* Propeller blades */}
      <ellipse cx="21" cy="18" rx="11" ry="2.5" fill="currentColor" opacity="0.38" transform="rotate(-45 21 18)" />
      <ellipse cx="99" cy="18" rx="11" ry="2.5" fill="currentColor" opacity="0.38" transform="rotate(45 99 18)" />
      <ellipse cx="21" cy="102" rx="11" ry="2.5" fill="currentColor" opacity="0.25" transform="rotate(45 21 102)" />
      <ellipse cx="99" cy="102" rx="11" ry="2.5" fill="currentColor" opacity="0.25" transform="rotate(-45 99 102)" />
      {/* Motor hubs */}
      <circle cx="21" cy="18" r="4.5" fill="currentColor" opacity="0.8" />
      <circle cx="99" cy="18" r="4.5" fill="currentColor" opacity="0.8" />
      <circle cx="21" cy="102" r="4" fill="currentColor" opacity="0.65" />
      <circle cx="99" cy="102" r="4" fill="currentColor" opacity="0.65" />
    </svg>
  )
}

function Air3Drone({ className, size }: { className?: string; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      className={cn('text-primary-400', className)}
      aria-hidden
    >
      {/* Body - wider */}
      <rect x="37" y="39" width="46" height="42" rx="9" fill="currentColor" opacity="0.85" />
      {/* Front LED bar */}
      <rect x="47" y="39" width="26" height="2.5" rx="1.25" fill="white" opacity="0.7" />
      {/* Camera gimbal - Air 3 has wider gimbal */}
      <circle cx="60" cy="53" r="11" fill="currentColor" opacity="0.4" />
      <circle cx="60" cy="53" r="6.5" fill="currentColor" opacity="0.55" />
      <circle cx="60" cy="53" r="3" fill="currentColor" opacity="0.9" />
      {/* Arms */}
      <line x1="40" y1="42" x2="16" y2="18" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
      <line x1="80" y1="42" x2="104" y2="18" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
      <line x1="40" y1="78" x2="16" y2="102" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" opacity="0.65" />
      <line x1="80" y1="78" x2="104" y2="102" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" opacity="0.65" />
      {/* Propeller discs */}
      <circle cx="16" cy="18" r="13" stroke="currentColor" strokeWidth="1" opacity="0.18" fill="currentColor" fillOpacity="0.07" />
      <circle cx="104" cy="18" r="13" stroke="currentColor" strokeWidth="1" opacity="0.18" fill="currentColor" fillOpacity="0.07" />
      <circle cx="16" cy="102" r="13" stroke="currentColor" strokeWidth="1" opacity="0.12" fill="currentColor" fillOpacity="0.05" />
      <circle cx="104" cy="102" r="13" stroke="currentColor" strokeWidth="1" opacity="0.12" fill="currentColor" fillOpacity="0.05" />
      {/* Blades */}
      <ellipse cx="16" cy="18" rx="12" ry="2.5" fill="currentColor" opacity="0.38" transform="rotate(-45 16 18)" />
      <ellipse cx="104" cy="18" rx="12" ry="2.5" fill="currentColor" opacity="0.38" transform="rotate(45 104 18)" />
      <ellipse cx="16" cy="102" rx="12" ry="2.5" fill="currentColor" opacity="0.25" transform="rotate(45 16 102)" />
      <ellipse cx="104" cy="102" rx="12" ry="2.5" fill="currentColor" opacity="0.25" transform="rotate(-45 104 102)" />
      {/* Motor hubs */}
      <circle cx="16" cy="18" r="5" fill="currentColor" opacity="0.8" />
      <circle cx="104" cy="18" r="5" fill="currentColor" opacity="0.8" />
      <circle cx="16" cy="102" r="4.5" fill="currentColor" opacity="0.65" />
      <circle cx="104" cy="102" r="4.5" fill="currentColor" opacity="0.65" />
    </svg>
  )
}

function Mavic3Drone({ className, size }: { className?: string; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      className={cn('text-primary-400', className)}
      aria-hidden
    >
      {/* Body */}
      <rect x="34" y="37" width="52" height="46" rx="10" fill="currentColor" opacity="0.85" />
      {/* Front LED bar */}
      <rect x="44" y="37" width="32" height="2.5" rx="1.25" fill="white" opacity="0.7" />
      {/* Camera housing */}
      <rect x="47" y="43" width="26" height="19" rx="5" fill="currentColor" opacity="0.45" />
      {/* Main lens */}
      <circle cx="57" cy="52" r="7" fill="currentColor" opacity="0.4" />
      <circle cx="57" cy="52" r="4" fill="currentColor" opacity="0.6" />
      <circle cx="57" cy="52" r="2" fill="currentColor" opacity="0.9" />
      {/* Tele lens */}
      <circle cx="67" cy="52" r="4.5" fill="currentColor" opacity="0.3" />
      <circle cx="67" cy="52" r="2.5" fill="currentColor" opacity="0.5" />
      <circle cx="67" cy="52" r="1.2" fill="currentColor" opacity="0.75" />
      {/* Arms */}
      <line x1="37" y1="40" x2="13" y2="16" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" opacity="0.8" />
      <line x1="83" y1="40" x2="107" y2="16" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" opacity="0.8" />
      <line x1="37" y1="80" x2="13" y2="104" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.65" />
      <line x1="83" y1="80" x2="107" y2="104" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.65" />
      {/* Propeller discs */}
      <circle cx="13" cy="16" r="14" stroke="currentColor" strokeWidth="1" opacity="0.18" fill="currentColor" fillOpacity="0.08" />
      <circle cx="107" cy="16" r="14" stroke="currentColor" strokeWidth="1" opacity="0.18" fill="currentColor" fillOpacity="0.08" />
      <circle cx="13" cy="104" r="14" stroke="currentColor" strokeWidth="1" opacity="0.12" fill="currentColor" fillOpacity="0.05" />
      <circle cx="107" cy="104" r="14" stroke="currentColor" strokeWidth="1" opacity="0.12" fill="currentColor" fillOpacity="0.05" />
      {/* Blades */}
      <ellipse cx="13" cy="16" rx="13" ry="3" fill="currentColor" opacity="0.38" transform="rotate(-45 13 16)" />
      <ellipse cx="107" cy="16" rx="13" ry="3" fill="currentColor" opacity="0.38" transform="rotate(45 107 16)" />
      <ellipse cx="13" cy="104" rx="13" ry="3" fill="currentColor" opacity="0.25" transform="rotate(45 13 104)" />
      <ellipse cx="107" cy="104" rx="13" ry="3" fill="currentColor" opacity="0.25" transform="rotate(-45 107 104)" />
      {/* Motor hubs */}
      <circle cx="13" cy="16" r="5.5" fill="currentColor" opacity="0.8" />
      <circle cx="107" cy="16" r="5.5" fill="currentColor" opacity="0.8" />
      <circle cx="13" cy="104" r="5" fill="currentColor" opacity="0.65" />
      <circle cx="107" cy="104" r="5" fill="currentColor" opacity="0.65" />
    </svg>
  )
}

function Phantom4Drone({ className, size }: { className?: string; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      className={cn('text-primary-400', className)}
      aria-hidden
    >
      {/* Body - octagonal */}
      <path
        d="M60 33 L82 41 L87 60 L82 79 L60 87 L38 79 L33 60 L38 41 Z"
        fill="currentColor"
        opacity="0.85"
      />
      {/* Camera dome */}
      <circle cx="60" cy="57" r="14" fill="currentColor" opacity="0.4" />
      <circle cx="60" cy="57" r="8.5" fill="currentColor" opacity="0.55" />
      <circle cx="60" cy="57" r="4.5" fill="currentColor" opacity="0.7" />
      <circle cx="60" cy="57" r="2" fill="currentColor" opacity="0.9" />
      {/* Fixed arms at 45deg */}
      <line x1="42" y1="42" x2="18" y2="18" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity="0.75" />
      <line x1="78" y1="42" x2="102" y2="18" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity="0.75" />
      <line x1="42" y1="78" x2="18" y2="102" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity="0.75" />
      <line x1="78" y1="78" x2="102" y2="102" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity="0.75" />
      {/* Propeller discs */}
      <circle cx="18" cy="18" r="15" stroke="currentColor" strokeWidth="1" opacity="0.2" fill="currentColor" fillOpacity="0.08" />
      <circle cx="102" cy="18" r="15" stroke="currentColor" strokeWidth="1" opacity="0.2" fill="currentColor" fillOpacity="0.08" />
      <circle cx="18" cy="102" r="15" stroke="currentColor" strokeWidth="1" opacity="0.14" fill="currentColor" fillOpacity="0.05" />
      <circle cx="102" cy="102" r="15" stroke="currentColor" strokeWidth="1" opacity="0.14" fill="currentColor" fillOpacity="0.05" />
      {/* Blades */}
      <ellipse cx="18" cy="18" rx="14" ry="3" fill="currentColor" opacity="0.38" transform="rotate(-45 18 18)" />
      <ellipse cx="102" cy="18" rx="14" ry="3" fill="currentColor" opacity="0.38" transform="rotate(45 102 18)" />
      <ellipse cx="18" cy="102" rx="14" ry="3" fill="currentColor" opacity="0.25" transform="rotate(45 18 102)" />
      <ellipse cx="102" cy="102" rx="14" ry="3" fill="currentColor" opacity="0.25" transform="rotate(-45 102 102)" />
      {/* Motor hubs */}
      <circle cx="18" cy="18" r="6" fill="currentColor" opacity="0.8" />
      <circle cx="102" cy="18" r="6" fill="currentColor" opacity="0.8" />
      <circle cx="18" cy="102" r="5.5" fill="currentColor" opacity="0.65" />
      <circle cx="102" cy="102" r="5.5" fill="currentColor" opacity="0.65" />
    </svg>
  )
}
