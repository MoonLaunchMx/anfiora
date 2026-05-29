'use client'

interface SparklineProps {
  data: number[]
  type?: 'line' | 'bar'
  className?: string
}

export default function Sparkline({ data, type = 'line', className = '' }: SparklineProps) {
  if (!data.length) return null
  const W = 80, H = 20, max = Math.max(...data, 1)

  if (type === 'bar') {
    const gap = 3
    const bw = (W - gap * (data.length - 1)) / data.length
    return (
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className}>
        {data.map((v, i) => {
          const h = Math.max(2, (v / max) * H)
          const last = i === data.length - 1
          return <rect key={i} x={i * (bw + gap)} y={H - h} width={bw} height={h} rx="1"
            fill={last ? '#48C9B0' : '#cfeee7'} />
        })}
      </svg>
    )
  }

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - (v / max) * (H - 2) - 1
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className}>
      <polyline points={pts} fill="none" stroke="#48C9B0" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
