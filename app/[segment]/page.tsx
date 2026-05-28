import { notFound } from 'next/navigation'
import { SEGMENTS } from './config'
import SegmentClient from './SegmentClient'

export async function generateMetadata({ params }: { params: Promise<{ segment: string }> }) {
  const { segment } = await params
  const config = SEGMENTS[segment]
  if (!config) return {}
  return {
    title: config.metaTitle,
    description: config.metaDescription,
    alternates: {
      canonical: `https://anfiora.com/${segment}`,
    },
    openGraph: {
      title: config.metaTitle,
      description: config.metaDescription,
      url: `https://anfiora.com/${segment}`,
      siteName: 'Anfiora',
      locale: 'es_MX',
      type: 'website',
    },
  }
}

export default async function SegmentPage({ params }: { params: Promise<{ segment: string }> }) {
  const { segment } = await params
  const config = SEGMENTS[segment]
  if (!config) notFound()
  return <SegmentClient config={config} />
}