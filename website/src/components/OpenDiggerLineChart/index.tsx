import { EChartsOption } from 'echarts';
import React from 'react';

import ResponsiveECharts from '@site/src/components/ResponsiveECharts';
import { TimeKey, TimeUnit, repositoryMetricLabelMap } from '@site/src/types/opendigger';
import useGroupedData, { UseGroupedDataProps } from './useGroupedData';

const colorPalette = ['green', 'red', 'blue', '#5470C6', '#EE6666', '#91CC75', '#FAC858', '#73C0DE', '#3BA272', '#FC8452', '#9A60B4', '#EA7CCC'];

interface OpenDiggerLineChartProps extends UseGroupedDataProps {
  timeUnit: TimeUnit;
  /** 时间范围，要和 timeUnit 保持一致，默认为所有数据中的最小值和最大值 */
  timeSpan?: [TimeKey, TimeKey];
}

const OpenDiggerLineChart: React.FC<OpenDiggerLineChartProps> = ({ type, names, timeUnit, timeSpan }) => {
  const {loading, allDataGroupedByTimeUnit} = useGroupedData({ type, names });
  const {sortedRange, list} = allDataGroupedByTimeUnit[timeUnit];
  const timeKeys = timeSpan ? sortedRange.filter((timeKey) => timeKey >= timeSpan[0] && timeKey <= timeSpan[1]) : sortedRange;

  const series: EChartsOption['series'] = list.map(({name, data}, index) => {
    const values: Array<number | null> = [];
    for (const timeKey of timeKeys) {
      if (data[timeKey]) {
        values.push(Number(Number(data[timeKey]).toFixed(2)));
      } else {
        values.push(null); // 如果要补0，把null换成0即可
      }
    }
    return {
      name,
      data: values,
      type: 'line',
      showSymbol: true,
      itemStyle: { color: colorPalette[index % (colorPalette.length - 1)] },
      smooth: true,
      // endLabel: {
      //   show: values.some(v => v !== null), // Only show label if there's at least one valid data point
      //   formatter: function(params) {
      //     // Get the project name without owner (simplified name)
      //     const projectName = name.split('/').pop() || name;
      //     // Get the last valid value for this series
      //     const lastValue = values.filter(v => v !== null).pop();
      //     return lastValue !== undefined ? `${projectName}: ${lastValue}` : projectName;
      //   },
      //   fontSize: 12,
      //   offset: [10, 0],
      //   backgroundColor: 'rgba(255,255,255,0.7)',
      //   padding: [3, 5],
      //   borderRadius: 3,
      //   color: colorPalette[index % (colorPalette.length - 1)]
      // }
    };
  })

  const option: EChartsOption = {
    legend: { left: 'center', top: 0 , padding: 0} ,
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross', crossStyle: { color: '#999' } } },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '18%', containLabel: true },
    xAxis: [{ type: 'category', boundaryGap: true, data: timeKeys, axisLabel: { showMaxLabel:true} }],
    yAxis: [{ type: 'value', name: repositoryMetricLabelMap[type[1]] || type[1] }],
    series,
  };

  return <ResponsiveECharts style={{ height: '400px' }} option={option} />;
};

export default OpenDiggerLineChart;
