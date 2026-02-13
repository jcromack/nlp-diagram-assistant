import { useEffect, useRef } from "react"
import mermaid from "mermaid"

type DiagramProps = {
  code: string
}

export function Diagram({ code }: DiagramProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!code || !ref.current) return

    const id = `diagram-${Date.now()}`

    mermaid.initialize({ startOnLoad: false })

    mermaid
      .render(id, code)
      .then(({ svg }) => {
        if (ref.current) {
          ref.current.innerHTML = svg
        }
      })
      .catch(err => {
        console.error("Mermaid render error:", err)
      })
  }, [code])

  console.log("MERMAID CODE:", code)
  return <div ref={ref} />
}