import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useTitle } from '@/lib/useTitle'
import { Footer } from './components/Footer'
import { Navbar } from './components/Navbar'
import { SkipLink } from './components/SkipLink'
import { ScrollTrigger } from './lib/gsap'
import { useReveal } from './lib/useReveal'
import { EditorSpotlight } from './sections/EditorSpotlight'
import { FaqSection } from './sections/FaqSection'
import { Features } from './sections/Features'
import { FinalCta } from './sections/FinalCta'
import { Hero } from './sections/Hero'
import { HowItWorks } from './sections/HowItWorks'
import { LogoStrip } from './sections/LogoStrip'
import { PricingPreview } from './sections/PricingPreview'
import { Showcase } from './sections/Showcase'
import { Testimonials } from './sections/Testimonials'
import { UseCases } from './sections/UseCases'

export default function LandingPage() {
  useTitle('')
  const main = useRef<HTMLElement>(null)
  const { hash } = useLocation()
  useReveal(main)

  // Arriving from another page with /#section: scroll there once laid out.
  useEffect(() => {
    if (!hash) return
    const id = decodeURIComponent(hash.slice(1))
    const raf = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }))
    return () => cancelAnimationFrame(raf)
  }, [hash])

  // Web fonts change line heights; re-measure scroll positions once they are in.
  useEffect(() => {
    let alive = true
    void document.fonts?.ready.then(() => {
      if (alive) ScrollTrigger.refresh()
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="min-h-dvh overflow-x-clip bg-canvas text-fg">
      <SkipLink />
      <Navbar />
      <main id="main" ref={main} tabIndex={-1} className="outline-none">
        <Hero />
        <LogoStrip />
        <HowItWorks />
        <Features />
        <EditorSpotlight />
        <Showcase />
        <UseCases />
        <PricingPreview />
        <Testimonials />
        <FaqSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}
