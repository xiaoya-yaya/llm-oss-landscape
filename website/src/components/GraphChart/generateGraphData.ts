import { GraphSeriesOption } from "echarts";

function linearMap(val: number, domain: number[], range: number[]): number {
  const d0 = domain[0];
  const d1 = domain[1];
  const r0 = range[0];
  const r1 = range[1];

  const subDomain = d1 - d0;
  const subRange = r1 - r0;

  if (subDomain === 0) {
    return subRange === 0 ? r0 : (r0 + r1) / 2;
  }
  if (subDomain > 0) {
    if (val <= d0) {
      return r0;
    } else if (val >= d1) {
      return r1;
    }
  } else if (val >= d0) {
    return r0;
  } else if (val <= d1) {
    return r1;
  }

  return ((val - d0) / subDomain) * subRange + r0;
}

const NODE_SIZE = [15, 100];

const generateGraphData = (data: any, highlightNodeIds?: string[]): any => {
  const generateNodes = (nodes: any[]): any => {
    const values: number[] = nodes.map((item) => item[1]);
    const minMax = [Math.min(...values), Math.max(...values)];
    return nodes.map((n: any) => {
      const avatarId = n[0].split('/')[0];
      const highlight = highlightNodeIds?.includes(n[0]);
      const nodeData: GraphSeriesOption['nodes'][0] & {
        url: string;
      } = {
        id: n[0],
        name: n[0].split('/')[1],
        value: n[1],
        itemStyle: {
          shadowColor: highlight ? 'skyblue' : undefined,
          shadowBlur: highlight ? 10 : undefined,
        },
        symbolSize: linearMap(n[1], minMax, NODE_SIZE),
        symbol: `image://https://avatars.githubusercontent.com/${avatarId}`,
        url: `https://github.com/${n[0]}`,
        label: {
          show: true,
          fontWeight: highlight ? 'bolder' : undefined,
          fontSize: highlight ? 16 : undefined,
          textShadowColor: highlight ? 'skyblue' : undefined,
          textShadowBlur: highlight ? 10 : undefined,
        },
      };
      return nodeData;
    });
  };
  const generateEdges = (edges: any[]): any => {
    return edges
      .map((e: any) => {
        return {
          source: e[0],
          target: e[1],
          value: e[2],
        };
      })
      .filter((edge) => edge.value > 0); // trim edges with small value to avoid a dense but useless graph
  };
  return {
    nodes: generateNodes(data.nodes),
    edges: generateEdges(data.edges),
  };
};

export default generateGraphData;
