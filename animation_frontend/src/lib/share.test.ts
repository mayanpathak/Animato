import { describe, expect, it } from 'vitest'
import { exportFileName, hashtags, postText, remixLink, slugify } from './share'

describe('share', () => {
  it('names files <title-slug>-<format>', () => {
    expect(exportFileName('Fourier Epicycles', '9:16', 'mp4')).toBe('fourier-epicycles-9x16.mp4')
    expect(exportFileName('Ça marche — vraiment?', '1:1', 'webm')).toBe('ca-marche-vraiment-1x1.webm')
    expect(slugify('!!!')).toBe('animato-video')
  })

  it('links carry the prompt and engine only', () => {
    const url = new URL(remixLink('Explain gradient descent & momentum', 'manim'))
    expect(url.pathname).toBe('/')
    expect(url.searchParams.get('prompt')).toBe('Explain gradient descent & momentum')
    expect(url.searchParams.get('engine')).toBe('manim')
    expect([...url.searchParams.keys()]).toEqual(['prompt', 'engine'])
  })

  it('derives two hashtags from the prompt, skipping verbs and filler', () => {
    expect(hashtags('Explain how gradient descent finds the minimum')).toEqual(['#Gradient', '#Descent'])
    expect(hashtags('Show a 3D rotating cube')).toEqual(['#Rotating', '#Cube'])
    expect(hashtags('a b c')).toEqual([])
    expect(postText('Gradient Descent', 'Explain gradient descent')).toBe(
      'Gradient Descent\n\n#Gradient #Descent',
    )
  })
})
