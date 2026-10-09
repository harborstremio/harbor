import { modDescriptionBlocks } from "@/lib/games/mod-description";

export function ModDescription({ text }: { text: string }) {
  const line = (value: string) => { const match = /^(FIXED|ADDED|UPDATED|REMOVED|CHANGED|REQUESTED|NOTE|IMPORTANT):\s*/i.exec(value); return match ? <><strong>{match[0]}</strong>{value.slice(match[0].length)}</> : value; };
  return <div className="mod-description">{modDescriptionBlocks(text).map((block, index) => block.kind === "heading" ? <h4 key={index}>{block.lines[0]}</h4> : block.kind === "ordered-list" ? <ol key={index} start={block.start}>{block.lines.map((value, i) => <li key={i}>{line(value)}</li>)}</ol> : block.kind === "list" ? <ul key={index}>{block.lines.map((value, i) => <li key={i}>{line(value)}</li>)}</ul> : <p key={index}>{line(block.lines[0])}</p>)}</div>;
}
