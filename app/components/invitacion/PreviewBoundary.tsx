'use client'

import { Component, type ReactNode } from 'react'

export default class PreviewBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="px-6 py-10 text-center">
          <p className="text-xs font-semibold text-[#cc3333]">No se pudo mostrar la vista previa.</p>
          <p className="mt-2 break-words text-[10px] text-[#999]">{this.state.error.message}</p>
        </div>
      )
    }
    return this.props.children
  }
}
