declare module 'dagre' {
  namespace graphlib {
    class Graph {
      setGraph(label?: any): Graph;
      setDefaultEdgeLabel(label: any): Graph;
      setNode(node: string, label?: any): Graph;
      setEdge(source: string, target: string, label?: any): Graph;
      node(node: string): any;
      edge(source: string, target: string): any;
      nodes(): string[];
      edges(): Array<{ v: string; w: string }>;
      outEdges(node: string): Array<{ v: string; w: string }>;
      successors(node: string): string[];
      predecessors(node: string): string[];
      sources(): string[];
      sinks(): string[];
    }
  }

  export interface LayoutOptions {
    rankdir?: 'TB' | 'LR' | 'BT' | 'RL';
    nodesep?: number;
    ranksep?: number;
    edgesep?: number;
    marginx?: number;
    marginy?: number;
  }

  export function layout(g: graphlib.Graph, options?: LayoutOptions): void;
  export const graphlib: {
    Graph: new (options?: any) => graphlib.Graph;
  };

  const dagre: {
    layout: typeof layout;
    graphlib: typeof graphlib;
  };

  export default dagre;
}
