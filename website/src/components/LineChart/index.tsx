import { EChartsOption } from 'echarts';
import { findLast, keyBy, uniq } from 'lodash-es';
import React from 'react';

import ResponsiveECharts from '@site/src/components/ResponsiveECharts';

export interface DataItem {
  month: string; // YYYY-MM-DD
  openrank: string; // 数字 string
  repo_id: string;
  repo_name: string;
}

interface LineChartProps {
  data: DataItem[];
}

const LineChart: React.FC<LineChartProps> = ({ data }) => {
  const months = uniq((data as DataItem[]).map((item) => item.month));
  const repoIds = uniq((data as DataItem[]).map((item) => item.repo_id));
  const repoNames = repoIds.map((id: string) => {
    const latestName = findLast(data as DataItem[], (item) => item.repo_id === id)?.repo_name;
    return latestName!;
  });

  const series: EChartsOption['series'] = repoIds.map((id, index) => {
    const dataForId = (data as DataItem[]).filter((item) => item.repo_id === id);
    const monthDataMap = keyBy(dataForId, 'month');
    const values: Array<number | null> = [];
    for (const m of months) {
      const monthData = monthDataMap[m];
      if (monthData) {
        values.push(Number(Number(monthData.openrank).toFixed(0)));
      } else {
        values.push(null); // 如果要补0，把null换成0即可
      }
    }
    return {
      name: repoNames[index],
      type: 'line',
      data: values,
      showSymbol: false,
      smooth: true
    };
  });

  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
    },
    legend: {
      data: repoNames,
    },
    grid: {
      top: '200px',
      left: '3%',
      right: '6%',
      bottom: '4%',
      containLabel: true,
    },
    dataZoom: [
      {
        type: 'inside',
      },
    ],
    xAxis: {
      name: '月份',
      type: 'category',
      boundaryGap: false,
      data: months,
    },
    yAxis: {
      name: 'OpenRank',
      type: 'value',
    },
    series,
  };

  return <ResponsiveECharts style={{ height: '500px' }} option={option} />;
};

export default LineChart;
