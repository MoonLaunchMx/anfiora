'use client'

type Props = {
  budgeted: number
  contracted: number
  className?: string
}

export default function HealthBar({ budgeted, contracted, className = '' }: Props) {
  if (budgeted <= 0) {
    return <div className={`h-1.5 w-full rounded-full bg-[#f0f0f0] ${className}`} />
  }

  const percentage = (contracted / budgeted) * 100
  const cappedPercentage = Math.min(percentage, 100)

  let color = 'bg-[#48C9B0]'
  if (percentage > 110) color = 'bg-red-400'
  else if (percentage > 100) color = 'bg-yellow-400'

  return (
    <div className={`relative h-1.5 w-full overflow-hidden rounded-full bg-[#f0f0f0] ${className}`}>
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${cappedPercentage}%` }}
      />
    </div>
  )
}