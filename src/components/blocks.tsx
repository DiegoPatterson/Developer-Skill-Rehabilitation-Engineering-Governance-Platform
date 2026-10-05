import type { Block } from "@/content/types";

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-3 text-sm leading-6 text-zinc-300">
      {blocks.map((block, index) => {
        if (block.type === "p") return <p key={index}>{block.text}</p>;
        if (block.type === "ul") {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ul>
          );
        }
        return (
          <pre key={index} className="overflow-auto rounded-md border border-[#27272A] bg-[#09090B] p-3 font-mono text-xs text-zinc-200">
            {block.text}
          </pre>
        );
      })}
    </div>
  );
}
