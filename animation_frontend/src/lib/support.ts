// Browser capabilities the product depends on (plan 15.5).

/** WebCodecs: decoding for the preview and encoding for export. Missing in older Safari and Firefox. */
export function hasWebCodecs(): boolean {
  return (
    typeof VideoEncoder !== 'undefined' &&
    typeof VideoDecoder !== 'undefined' &&
    typeof AudioEncoder !== 'undefined' &&
    typeof AudioDecoder !== 'undefined'
  )
}

/** The line shown where Finish would be (plan 6.11). */
export const NO_WEBCODECS_TEXT = 'Finishing needs Chrome, Edge or another browser with WebCodecs.'
