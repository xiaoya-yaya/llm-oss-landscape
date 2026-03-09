import React from 'react';

import { TimeKey, TimeUnit, repositoryMetricLabelMap } from '../../types/opendigger';
import useGroupedData, { UseGroupedDataProps } from '../OpenDiggerLineChart/useGroupedData';
import LineRaceChart from './LineRaceChart';

interface OpenDiggerLineRaceChartProps extends UseGroupedDataProps {
  timeUnit: TimeUnit;
  /** Time range, should be consistent with timeUnit, default is min and max of all data */
  timeSpan?: [TimeKey, TimeKey];
  height?: string | number;
}

const OpenDiggerLineRaceChart: React.FC<OpenDiggerLineRaceChartProps> = ({
  type,
  names,
  timeUnit,
  timeSpan,
  height = '1500px'
}) => {
  const { loading, allDataGroupedByTimeUnit } = useGroupedData({ type, names });
  const { sortedRange, list } = allDataGroupedByTimeUnit[timeUnit];
  const timeKeys = timeSpan
    ? sortedRange.filter((timeKey) => timeKey >= timeSpan[0] && timeKey <= timeSpan[1])
    : sortedRange;

  if (loading || !timeKeys.length || !list.length) {
    return <div>Loading data...</div>;
  }

  // Transform data for LineRaceChart
  const chartData = {
    dates: timeKeys,
    series: list.map(item => {
      const values: Array<number | null> = [];

      for (const timeKey of timeKeys) {
        if (item.data[timeKey]) {
          values.push(Number(Number(item.data[timeKey]).toFixed(2)));
        } else {
          values.push(null); // Use null for missing data points
        }
      }

      return {
        name: item.name,
        values
      };
    })
  };

  const title = `OpenRank Monthly Trend (${timeSpan ? `${timeSpan[0]} to ${timeSpan[1]}` : 'All Time'})`;
  const yAxisName = repositoryMetricLabelMap[type[1]] || type[1];

  return (
    <LineRaceChart
      title={title}
      data={chartData}
      height={height}
      yAxisName={yAxisName}
    />
  );
};

export default OpenDiggerLineRaceChart;
