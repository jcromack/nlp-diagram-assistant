import { Command } from "./commands"

//Default basic diagram if no additional info supplied
export function baseDiagram(): string {
  return [
    "flowchart TD",
    "A[Start]",
    "B[Process]",
    "C[End]",
    "A --> B",
    "B --> C"
  ].join("\n")
}

//Extracts labels from mermaid diagram string to be mapped to
function parseNodes(diagram: string) {
  return [...diagram.matchAll(/([A-Z])\[(.+?)\]/g)].map(m => ({
    id: m[1],
    label: m[2]
  }))
}

//Finds and extracts all edges from mermaid diagram string
function parseEdges(diagram: string) {
  return [...diagram.matchAll(/([A-Z]) --> ([A-Z])/g)].map(m => ({
    from: m[1],
    to: m[2]
  }))
}



//Finds final node in the diagram, for when user does not specify location of add/add_multiple
function findTerminalNode(diagram: string) {
    const nodes = parseNodes(diagram)
    const edges = parseEdges(diagram)
  
    if (nodes.length === 0) return undefined
    const next = new Map<string, string>()
    for (const e of edges) {
      next.set(e.from, e.to)
    }
  
    const toSet = new Set(edges.map(e => e.to))
    let current = nodes.find(n => !toSet.has(n.id)) ?? nodes[0]
      //iterate till reach final node
      while (next.has(current.id)) {
      const nextId = next.get(current.id)!
      const nextNode = nodes.find(n => n.id === nextId)
      if (!nextNode) break
      current = nextNode
    }
  
    return current
  }

function nextId(diagram: string) {
  const ids = parseNodes(diagram).map(n => n.id)
  const last = ids.sort().pop() ?? "A"
  return String.fromCharCode(last.charCodeAt(0) + 1)
}

function findNodeIdByLabel(diagram: string, label: string): string | undefined {
    const match = [...diagram.matchAll(/([A-Z])\[(.+?)\]/g)]
      .find(([, , l]) => l.toLowerCase() === label.toLowerCase())
  
    return match?.[1]
  }


  //Applies parsed command from user to the mermaid diagram string, returns diagram string
  export function applyCommand(diagram: string | undefined, command: Command): string | undefined {

  if (command.type === "create") {
    if (!command.labels || command.labels.length < 2) {
      return baseDiagram()
    }
  
    const labels = command.labels
    const lines = ["flowchart TD"]
  
    for (let i = 0; i < labels.length; i++) {
      const id = String.fromCharCode(65 + i) 
      lines.push(`${id}[${labels[i]}]`)
  
      if (i > 0) {
        const prevId = String.fromCharCode(65 + i - 1)
        lines.push(`${prevId} --> ${id}`)
      }
    }
  
    return lines.join("\n")
  }

  if (!diagram) return diagram

  
//If add detected from user string, adds a single node/label
  if (command.type === "add") {
    const nodes = parseNodes(diagram)
    const edges = parseEdges(diagram)

  // If no position specified, append to the terminal node
    const afterNode = command.after
    ? nodes.find(n => n.label.toLowerCase() === command.after!.toLowerCase())
    : findTerminalNode(diagram)

    if (!afterNode) return diagram

    const newId = nextId(diagram)
    const outgoing = edges.find(e => e.from === afterNode.id)

    const lines = diagram.split("\n").filter(l =>
      outgoing ? !l.includes(`${afterNode.id} --> ${outgoing.to}`) : true
    )

    lines.push(`${newId}[${command.label}]`)
    lines.push(`${afterNode.id} --> ${newId}`)

    //Reconnect / link nodes
    if (outgoing) lines.push(`${newId} --> ${outgoing.to}`)

    return lines.join("\n")
  }

  //Adding multiple nodes 
  if (command.type === "add_multiple") {
    let current: string = diagram
  
    for (const label of command.labels) {
      const result = applyCommand(current, {
        type: "add",
        label
      })
  
      if (!result) break
  
      current = result
    }
  
    return current
  }


  // Remove a node and reconnect surrounding nodes
  if (command.type === "remove") {
    const id = findNodeIdByLabel(diagram, command.target)
    if (!id) return undefined
  
    const nodes = parseNodes(diagram)
    const edges = parseEdges(diagram)
  
    const incoming = edges.filter(e => e.to === id)
    const outgoing = edges.filter(e => e.from === id)
  
    const nodeLines = nodes
      .filter(n => n.id !== id)
      .map(n => `${n.id}[${n.label}]`)
  
    const edgeLines = edges
      .filter(e => e.from !== id && e.to !== id)
      .map(e => `${e.from} --> ${e.to}`)
  
    for (const inc of incoming) {
      for (const out of outgoing) {
        edgeLines.push(`${inc.from} --> ${out.to}`)
      }
    }
  
    return ["flowchart TD", ...nodeLines, ...edgeLines].join("\n")
  }

  return diagram
}