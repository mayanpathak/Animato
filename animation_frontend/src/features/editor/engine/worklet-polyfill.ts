// AudioWorkletGlobalScope has no TextDecoder/TextEncoder, which the
// wasm-bindgen glue needs for strings. Minimal UTF-8 versions, installed
// before the glue module is evaluated.
const g = globalThis as unknown as Record<string, unknown>

if (!g.TextDecoder) {
  g.TextDecoder = class {
    decode(input?: ArrayBufferView | ArrayBuffer): string {
      if (!input) return ''
      const bytes =
        input instanceof ArrayBuffer
          ? new Uint8Array(input)
          : new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
      let out = ''
      for (let i = 0; i < bytes.length;) {
        const b = bytes[i++]
        let cp = b
        if (b >= 0xf0)
          cp =
            ((b & 0x07) << 18) |
            ((bytes[i++] & 0x3f) << 12) |
            ((bytes[i++] & 0x3f) << 6) |
            (bytes[i++] & 0x3f)
        else if (b >= 0xe0) cp = ((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f)
        else if (b >= 0xc0) cp = ((b & 0x1f) << 6) | (bytes[i++] & 0x3f)
        out += String.fromCodePoint(cp)
      }
      return out
    }
  }
}

if (!g.TextEncoder) {
  g.TextEncoder = class {
    encode(s = ''): Uint8Array {
      const out: number[] = []
      for (const ch of s) {
        const cp = ch.codePointAt(0) as number
        if (cp < 0x80) out.push(cp)
        else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f))
        else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f))
        else
          out.push(
            0xf0 | (cp >> 18),
            0x80 | ((cp >> 12) & 0x3f),
            0x80 | ((cp >> 6) & 0x3f),
            0x80 | (cp & 0x3f),
          )
      }
      return new Uint8Array(out)
    }
    encodeInto(s: string, dest: Uint8Array) {
      const bytes = this.encode(s)
      const n = Math.min(bytes.length, dest.length)
      dest.set(bytes.subarray(0, n))
      return { read: s.length, written: n }
    }
  }
}

export {}
