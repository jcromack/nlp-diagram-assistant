//Preset commands to be extracted from user input request
export type Command =
  | { type: "create"; labels?: string[] }
  | { type: "add"; label: string; after?: string }
  | { type: "add_multiple"; labels: string[] }
  | { type: "remove"; target: string }
  | { type: "remove_all" }
  | { type: "undo" }
  | { type: "unknown" }


// Parses user message input into a structured Command object
export function parseCommand(input: string): Command {
  const text = input.toLowerCase().trim()

  if (text === "undo") return { type: "undo" }

  if (text.includes("create")) {
    const withIndex = text.indexOf("with ")
  
    if (withIndex !== -1) {
      let afterWith = text.slice(withIndex + 5).trim()
  
      afterWith = afterWith.replace(/^(steps?|labels?|points?)\s*:?\s*/, "")

      let labels = afterWith
        .replace(/\band\b/g, ",")
        .replace(/&/g, ",")
        .split(",")
        .flatMap(s => s.trim().split(/\s+/))
        .filter(Boolean)
    
      if (labels.length === 1) {
        labels = labels[0].split(/\s+/)
      }
  
      if (labels.length >= 2) {
        return { type: "create", labels }
      }
    }
  
    return { type: "create" }
  }

  const betweenMatch = text.match(/add (.+) between (.+) and (.+)/)

  if (betweenMatch) {
    return {
      type: "add",
      label: betweenMatch[1].trim(),
      after: betweenMatch[2].trim()
    }
  }

  const multiAddMatch = text.match(/add\s+(?:\d+\s*)?(?:steps?|stages?|nodes?)?\s*(.+)/)

  if (multiAddMatch) {
    let raw = multiAddMatch[1].trim()

    raw = raw.replace(/^called\s+/, "")

    if (raw.includes(",") || raw.includes(" and ") || raw.includes("&")) {
      const labels = raw
        .replace(/\b(and|&)\b/g, ",")
        .split(",")
        .flatMap(s => s.trim().split(/\s+/))
        .filter(Boolean)

      if (labels.length > 1) {
        return {
          type: "add_multiple",
          labels
        }
      }
    }
  }

  const addMatch = text.match(/add (.+?)(?: after (.+))?$/)
  if (addMatch) {
    const rawLabel = addMatch[1]
    const rawAfter = addMatch[2]
  
    return {
      type: "add",
      label: cleanLabel(rawLabel),
      after: rawAfter ? cleanLabel(rawAfter) : undefined
    }
  }

  const removeMatch = text.match(/remove (.+)$/)
  if (removeMatch) {
    const rawLabel = removeMatch[1]
  
    return {
      type: "remove",
      target: cleanLabel(rawLabel)
    }
  }

  return { type: "unknown" }
}

//Normalises / cleans messages into diagram labels - used for add and remove
function cleanLabel(rawLabel: string): string {
  return rawLabel
    .trim()
    .replace(/^the\s+/, "")
    .replace(/^a\s+/, "")
    .replace(/^(step|stage|node)\s+called\s+/, "")
    .replace(/^(step|stage|node)\s+/, "")
    .replace(/^called\s+/, "")
    .replace(/[.,]$/, "")
}