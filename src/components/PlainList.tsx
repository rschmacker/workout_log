// Shows text lines as written, e.g. a warmup. Lines starting with "- " (or "* ")
// become bullet points under the line above:
//   "2 Rounds:", "- 10 Ring Rows", "- 10 Push Ups"
export default function PlainList({ lines }: { lines: string[] }) {
  // Group the lines: each normal line starts a group, bullet lines belong to it
  const groups: { heading: string | null; bullets: string[] }[] = []
  for (const line of lines) {
    const bullet = line.match(/^[-*]\s+(.*)$/)
    if (bullet) {
      if (groups.length === 0) groups.push({ heading: null, bullets: [] })
      groups[groups.length - 1].bullets.push(bullet[1])
    } else {
      groups.push({ heading: line, bullets: [] })
    }
  }

  return (
    <div className="plain-list">
      {groups.map((group, i) => (
        <div key={i}>
          {group.heading && <p>{group.heading}</p>}
          {group.bullets.length > 0 && (
            <ul>
              {group.bullets.map((b, j) => (
                <li key={j}>{b}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}
