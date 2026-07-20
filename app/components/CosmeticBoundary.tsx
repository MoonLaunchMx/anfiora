'use client'

import { Component, type ReactNode } from 'react'
import * as Sentry from '@sentry/nextjs'

export default class CosmeticBoundary extends Component<
  { zona: string; children: ReactNode },
  { fallo: boolean }
> {
  state = { fallo: false }

  static getDerivedStateFromError() {
    return { fallo: true }
  }

  componentDidCatch(error: Error) {
    Sentry.captureException(error, {
      level: 'warning',
      tags: { severity: 'cosmetico', zona: this.props.zona },
    })
  }

  render() {
    if (this.state.fallo) return null
    return this.props.children
  }
}
