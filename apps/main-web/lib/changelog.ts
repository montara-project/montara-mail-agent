/// <reference types="vite/client" />
// The repo's CHANGELOG.md, inlined at build time, so a release updates the page.
import source from '../../../CHANGELOG.md?raw'

export type ChangelogEntry = {
  scope?: string
  text: string
  commit?: { hash: string; url: string }
}

export type ChangelogGroup = { title: string; entries: ChangelogEntry[] }

export type ChangelogRelease = {
  version: string
  date: string
  compareUrl?: string
  groups: ChangelogGroup[]
}

/** Reads the release-please sections: `## version`, `### group`, `* entry`. */
export function parseChangelog(markdown: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = []
  let entry: ChangelogEntry | undefined

  for (const line of markdown.split('\n')) {
    const release = releases.at(-1)

    if (line.startsWith('## ')) {
      const [, version = '', compareUrl] =
        line.match(/^## \[?(\d+\.\d+\.\d+)\]?(?:\((\S+)\))?/) ?? []
      const date = line.match(/\((\d{4}-\d{2}-\d{2})\)\s*$/)?.[1] ?? ''
      releases.push({ version, date, compareUrl, groups: [] })
      entry = undefined
    } else if (line.startsWith('### ') && release) {
      release.groups.push({ title: line.slice(4).replace('⚠', '').trim(), entries: [] })
      entry = undefined
    } else if (line.startsWith('* ') && release) {
      if (release.groups.length === 0) release.groups.push({ title: 'Changes', entries: [] })
      const commit = line.match(/\s*\(\[([0-9a-f]+)\]\((\S+)\)\)\s*$/)
      const body = commit ? line.slice(2, commit.index) : line.slice(2)
      const scoped = body.match(/^\*\*(.+?):\*\*\s*(.*)$/)
      entry = {
        scope: scoped?.[1],
        text: scoped ? scoped[2] : body,
        commit: commit ? { hash: commit[1], url: commit[2] } : undefined,
      }
      release.groups.at(-1)?.entries.push(entry)
    } else if (line.startsWith('  ') && entry) {
      // A wrapped breaking-change note continues on indented lines.
      entry.text += ` ${line.trim()}`
    }
  }

  return releases
}

export const releases = parseChangelog(source)
