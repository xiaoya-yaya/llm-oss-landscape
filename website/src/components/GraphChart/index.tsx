import ResponsiveECharts from '@site/src/components/ResponsiveECharts';
import { EChartsOption } from 'echarts';
import React from 'react';
import generateGraphData from './generateGraphData';

export interface GraphChartProps {
  data: {
    nodes: any[];
    edges: any[];
  };
  highlightNodeIds?: string[];
}

const GraphChart: React.FC<GraphChartProps> = ({ data, highlightNodeIds: highlightNodeIds }) => {
  const graphData = generateGraphData(data, highlightNodeIds);
  const option: EChartsOption = {
    tooltip: {},
    animation: true,
    animationDuration: 2000,
    series: [
      {
        type: 'graph',
        layout: 'force',
        nodes: graphData.nodes,
        edges: graphData.edges,
        // Enable mouse zooming and translating
        roam: true,
        label: {
          position: 'right',
        },
        force: {
          initLayout: 'none',
          gravity: 0.01,
          repulsion: 80,
          edgeLength: [20, 400],
          // Disable the iteration animation of layout
          layoutAnimation: false,
        },
        lineStyle: {
          curveness: 0.2,
          opacity: 0.6,
        },
        emphasis: {
          focus: 'adjacency',
          label: {
            position: 'right',
            show: true,
          },
          lineStyle: {
            opacity: 0.8,
          },
        },
      },
    ],
  };

  const handleClick = (params: any) => {
    window.open(params.data.url);
  };

  return (
    <ResponsiveECharts
      style={{ height: '500px' }}
      option={option}
      onEvents={{ click: handleClick }}
    />
  );
};

export default GraphChart;
