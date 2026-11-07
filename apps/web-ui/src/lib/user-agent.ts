// Order matters: Edge and Opera say Chrome too, Chrome says Safari, iOS says Mac OS.
// Firefox and Chrome on iOS name themselves FxiOS and CriOS, and say Safari.
const BROWSERS: [RegExp, string][] = [
  [/Edg\//, 'Edge'],
  [/OPR\//, 'Opera'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
]
const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad/, 'iOS'],
  [/Android/, 'Android'],
  [/Windows/, 'Windows'],
  [/Mac OS/, 'macOS'],
  [/Linux/, 'Linux'],
]

// ponytail: a few regexes cover the common browsers; swap in a UA parser if the names fall short.
/** A readable device name, e.g. "Chrome on macOS", from a User-Agent header. */
export function describeUserAgent(ua: string | null) {
  if (!ua) return { name: 'Unknown device', mobile: false }
  const browser = BROWSERS.find(([re]) => re.test(ua))?.[1]
  const system = SYSTEMS.find(([re]) => re.test(ua))?.[1]
  const name =
    browser && system ? `${browser} on ${system}` : (browser ?? system ?? 'Unknown device')
  return { name, mobile: /Mobi|iPhone|Android/.test(ua) }
}
