function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Looks for the opt-out pragma anywhere in the file's leading comment region.
 *
 * The old check was `code.startsWith('// @sort-imports-ignore')`, which silently
 * failed after a BOM, a shebang, a blank line, a `'use client'` directive, when
 * written without a space, or as a block comment. All of those work now.
 */
export function hasIgnorePragma(code: string, pragma: string): boolean {
  const needle = escapeRegExp(pragma.replace(/^@/, ''))
  const matcher = new RegExp(`(?:^|\\s)@?${needle}(?:\\s|$)`)

  let i = code.charCodeAt(0) === 0xfeff ? 1 : 0

  if (code.startsWith('#!', i)) {
    const lineEnd = code.indexOf('\n', i)
    if (lineEnd < 0) return false
    i = lineEnd + 1
  }

  for (;;) {
    while (i < code.length && /\s/.test(code.charAt(i))) i += 1
    if (i >= code.length) return false

    if (code.startsWith('//', i)) {
      const lineEnd = code.indexOf('\n', i)
      const body = code.slice(i + 2, lineEnd < 0 ? code.length : lineEnd)
      if (matcher.test(body)) return true
      if (lineEnd < 0) return false
      i = lineEnd + 1
      continue
    }

    if (code.startsWith('/*', i)) {
      const close = code.indexOf('*/', i + 2)
      const body = code.slice(i + 2, close < 0 ? code.length : close)
      if (matcher.test(body)) return true
      if (close < 0) return false
      i = close + 2
      continue
    }

    // Directives such as 'use client' may sit above the pragma.
    const directive = /^(['"])use [\w-]+\1\s*;?/.exec(code.slice(i, i + 40))
    if (directive) {
      i += directive[0].length
      continue
    }

    return false
  }
}
