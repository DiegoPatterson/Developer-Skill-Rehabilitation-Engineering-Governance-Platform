"use client";

import type { Monaco } from "@monaco-editor/react";
import dynamic from "next/dynamic";

const Editor = dynamic(() => import("@monaco-editor/react").then((mod) => mod.Editor), { ssr: false });
const DiffEditor = dynamic(() => import("@monaco-editor/react").then((mod) => mod.DiffEditor), { ssr: false });

function beforeMount(monaco: Monaco) {
  monaco.editor.defineTheme("governance", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#121215",
      "editor.foreground": "#e4e4e7",
      "editorLineNumber.foreground": "#52525b",
      "editor.selectionBackground": "#14532d",
    },
  });
}

const options = {
  fontFamily: "var(--font-jetbrains), ui-monospace, monospace",
  fontSize: 13,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  automaticLayout: true,
};

export function CodeEditor({
  value,
  starter,
  diff,
  onChange,
}: {
  value: string;
  starter: string;
  diff: boolean;
  onChange: (value: string) => void;
}) {
  if (diff) {
    return (
      <div className="min-h-0 flex-1">
        <DiffEditor
          height="100%"
          language="javascript"
          theme="governance"
          original={starter}
          modified={value}
          beforeMount={beforeMount}
          onMount={(editor) => {
            const modified = editor.getModifiedEditor();
            modified.onDidChangeModelContent(() => onChange(modified.getValue()));
          }}
          options={{ ...options, originalEditable: false, renderSideBySide: true }}
        />
      </div>
    );
  }
  return (
    <div className="min-h-0 flex-1">
      <Editor
        height="100%"
        language="javascript"
        theme="governance"
        value={value}
        beforeMount={beforeMount}
        onChange={(next) => onChange(next ?? "")}
        options={options}
      />
    </div>
  );
}
