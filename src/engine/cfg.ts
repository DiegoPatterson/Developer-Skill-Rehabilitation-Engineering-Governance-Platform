import * as acorn from "acorn";

export type CfgNode = { id: string; label: string; kind: string; unreachable: boolean };
export type CfgEdge = { id: string; source: string; target: string; label: string };

type Statement = acorn.Statement | acorn.ModuleDeclaration;
type Port = { node: string; label: string };

function snippet(source: string, node: acorn.Node): string {
  return source.slice(node.start, node.end).replace(/\s+/g, " ").slice(0, 96);
}

function asList(node: acorn.Statement): Statement[] {
  if (node.type === "BlockStatement") return node.body;
  return [node];
}

export function buildCfg(source: string): { nodes: CfgNode[]; edges: CfgEdge[] } {
  const ast = acorn.parse(source, { ecmaVersion: "latest", sourceType: "script" });
  const fn = ast.body.find((node) => node.type === "FunctionDeclaration");
  if (!fn || fn.type !== "FunctionDeclaration") {
    throw new Error("CFG builder expected a function declaration.");
  }

  const nodes: CfgNode[] = [];
  const edges: CfgEdge[] = [];
  let counter = 0;

  function add(label: string, kind: string, unreachable: boolean): string {
    const id = `n${counter++}`;
    nodes.push({ id, label, kind, unreachable });
    return id;
  }

  function link(from: string, to: string, label: string) {
    edges.push({ id: `e${edges.length}`, source: from, target: to, label });
  }

  function connect(ports: Port[], to: string) {
    for (const port of ports) link(port.node, to, port.label);
  }

  const entry = add("entry", "entry", false);
  const exit = add("exit", "exit", false);

  function walk(statements: Statement[], ports: Port[], dead: boolean): Port[] {
    let incoming = ports;
    let unreachable = dead;
    for (const statement of statements) {
      if (statement.type === "EmptyStatement") continue;
      if (statement.type === "BlockStatement") {
        incoming = walk(statement.body, incoming, unreachable);
        unreachable = incoming.length === 0;
        continue;
      }
      if (statement.type === "IfStatement") {
        const cond = add(snippet(source, statement.test), "condition", unreachable);
        connect(incoming, cond);
        const thenPorts = walk(asList(statement.consequent), [{ node: cond, label: "true" }], unreachable);
        const elsePorts = statement.alternate
          ? walk(asList(statement.alternate), [{ node: cond, label: "false" }], unreachable)
          : unreachable
            ? []
            : [{ node: cond, label: "false" }];
        incoming = [...thenPorts, ...elsePorts];
        unreachable = incoming.length === 0;
        continue;
      }
      if (statement.type === "ReturnStatement") {
        const node = add(snippet(source, statement), "return", unreachable);
        connect(incoming, node);
        if (!unreachable) link(node, exit, "");
        incoming = [];
        unreachable = true;
        continue;
      }
      const node = add(snippet(source, statement), "statement", unreachable);
      connect(incoming, node);
      incoming = unreachable ? [] : [{ node, label: "" }];
    }
    return incoming;
  }

  const falling = walk(fn.body.body, [{ node: entry, label: "" }], false);
  connect(falling, exit);
  return { nodes, edges };
}
