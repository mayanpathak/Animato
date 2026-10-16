// The brand kit Finish uses, as the renderer needs it: colours, heading font
// and the logo's size (read once from its data URL).
import { useEffect, useState } from 'react'
import type { BrandKit } from '@/lib/local/models'
import type { BrandRender } from '../graphics/looks'

async function imageSize(url: string): Promise<{ width: number; height: number } | null> {
  try {
    const bmp = await createImageBitmap(await (await fetch(url)).blob())
    const size = { width: bmp.width, height: bmp.height }
    bmp.close()
    return size
  } catch {
    return null
  }
}

export async function brandRender(kit: BrandKit): Promise<BrandRender> {
  const size = kit.logoDataUrl ? await imageSize(kit.logoDataUrl) : null
  return {
    kitId: kit.id,
    colors: kit.colors,
    headingFont: kit.headingFont,
    // The id changes with the kit, so an edited logo is registered again.
    logo: size ? { id: `logo_${kit.id}_${kit.updatedAt}`, ...size } : null,
    logoUrl: size ? kit.logoDataUrl : null,
  }
}

/** The render form of `kit`, or null while it loads or when there is no kit. */
export function useBrandRender(kit: BrandKit | null | undefined): BrandRender | null {
  const [render, setRender] = useState<BrandRender | null>(null)
  const key = kit ? `${kit.id}:${kit.updatedAt}` : ''
  useEffect(() => {
    let live = true
    if (!kit) {
      setRender(null)
      return
    }
    void brandRender(kit).then((r) => live && setRender(r))
    return () => {
      live = false
    }
    // The kit's id and update time say when it changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return render
}
