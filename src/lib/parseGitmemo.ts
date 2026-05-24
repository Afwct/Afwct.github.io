export interface GitmemoSection {
  id: string
  title: string
  body: string
}

export interface GitmemoDoc {
  title: string
  sections: GitmemoSection[]
}

const sectionHeading = /^(.+?)::\s*$/

function slugify(title: string, index: number): string {
  const base = title.trim().toLowerCase().replace(/\s+/g, "-")
  return base ? `gitmemo-${base}` : `gitmemo-${index}`
}

/** 解析项目根目录 gitmemo.rst 的简易结构（章节标题 + 缩进代码块）。 */
export function parseGitmemo(source: string): GitmemoDoc {
  const lines = source.replace(/\r\n/g, "\n").split("\n")
  let i = 0

  while (i < lines.length && lines[i].trim() === "") i++

  const title = lines[i]?.trim() ?? "Git 命令"
  if (lines[i + 1]?.trim().match(/^=+$/)) i += 2
  else i += 1

  const sections: GitmemoSection[] = []

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith("..")) {
      i++
      continue
    }

    const match = line.match(sectionHeading)
    if (!match) {
      i++
      continue
    }

    const sectionTitle = match[1].trim()
    i++

    const bodyLines: string[] = []

    while (i < lines.length) {
      const current = lines[i]

      if (current.match(sectionHeading) && !current.startsWith(" ")) break

      if (current.startsWith("    ")) {
        bodyLines.push(current.slice(4))
        i++
        continue
      }

      if (current.trim() === "") {
        let j = i + 1
        while (j < lines.length && lines[j].trim() === "") j++
        if (j >= lines.length || lines[j].match(sectionHeading)) break
        bodyLines.push("")
        i++
        continue
      }

      break
    }

    sections.push({
      id: slugify(sectionTitle, sections.length),
      title: sectionTitle,
      body: bodyLines.join("\n").trimEnd(),
    })
  }

  return { title, sections }
}
