#!/usr/bin/env node
// Plan 7.2 / P2 acceptance: UI colour comes only from tokens. Fails on a hex
// colour or rgb()/hsl() literal anywhere in src/ except:
//   - src/styles/tokens.css            the token definitions themselves
//   - src/features/brand/              the user's brand colours (content, not chrome)
//   - src/features/editor/             colours drawn into the output video (graphics)
//   - src/features/editor/graphics/    (same, from P5)
//   - src/wasm/pkg/                    generated
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SRC = join(ROOT, 'src')
const ALLOW = ['src/styles/tokens.css', 'src/features/brand/', 'src/features/editor/', 'src/wasm/pkg/']
const COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/g
const EXT = /\.(tsx?|css)$/

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (EXT.test(name)) yield p
  }
}

const problems = []
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file).split('\\').join('/')
  if (ALLOW.some((a) => rel.startsWith(a))) continue
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      // `#` followed by hex digits inside an id/href/anchor is not a colour.
      const hits = [...line.matchAll(COLOUR)].filter(
        (m) => !/(href|id|to)=["'`{]?[^"'`]*$/.test(line.slice(0, m.index)),
      )
      for (const m of hits) problems.push(`${rel}:${i + 1}  ${m[0]}  ${line.trim().slice(0, 100)}`)
    })
}

if (problems.length) {
  console.error(
    `Colour literals outside tokens (${problems.length}). Use a token from src/styles/tokens.css:\n`,
  )
  for (const p of problems) console.error(`  ${p}`)
  process.exit(1)
}
console.log('check-tokens: UI colours come only from tokens.')
