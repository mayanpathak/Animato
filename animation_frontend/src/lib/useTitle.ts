import { useEffect } from 'react'

/** Sets the document title for the current page. */
export function useTitle(title: string): void {
  useEffect(() => {
    document.title = title ? `${title} · Animato` : 'Animato: describe it, watch it move'
  }, [title])
}
