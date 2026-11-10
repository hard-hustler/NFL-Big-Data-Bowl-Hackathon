import katex from "katex"
import "katex/dist/katex.min.css"

/** LaTeX rendered with KaTeX at build time; `block` gives a centered display equation. */
export function Tex({ children, block = false }: { children: string; block?: boolean }) {
  const html = katex.renderToString(children, { displayMode: block, throwOnError: false, output: "html" })
  return block ? (
    <div className="overflow-x-auto py-1 text-zinc-100" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span className="text-zinc-200" dangerouslySetInnerHTML={{ __html: html }} />
  )
}
