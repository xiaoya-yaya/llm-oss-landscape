import React from 'react';

import { TimeKey, TimeUnit, repositoryMetricLabelMap } from '../../types/opendigger';
import useGroupedData, { UseGroupedDataProps } from '../OpenDiggerLineChart/useGroupedData';
import BumpChart from './BumpChart';

interface OpenDiggerBumpChartProps extends UseGroupedDataProps {
  timeUnit: TimeUnit;
  /** Time range, should be consistent with timeUnit, default is min and max of all data */
  timeSpan?: [TimeKey, TimeKey];
  height?: string | number;
}

const OpenDiggerBumpChart: React.FC<OpenDiggerBumpChartProps> = ({
  type,
  names,
  timeUnit,
  timeSpan,
  height = '700px'
}) => {
  const { loading, allDataGroupedByTimeUnit } = useGroupedData({ type, names });
  const { sortedRange, list } = allDataGroupedByTimeUnit[timeUnit];
  const timeKeys = timeSpan
    ? sortedRange.filter((timeKey) => timeKey >= timeSpan[0] && timeKey <= timeSpan[1])
    : sortedRange;

  if (loading || !timeKeys.length || !list.length) {
    return <div>Loading data...</div>;
  }

  // Transform data for BumpChart - Calculate rankings for each time period
  const chartData = {
    dates: timeKeys,
    series: []
  };

  // Create a structure to hold OpenRank values per time period to calculate rankings
  const timePeriodsData = timeKeys.map(timeKey => {
    return list.map(item => ({
      name: item.name,
      value: item.data[timeKey] ? Number(item.data[timeKey]) : 0,
      hasValue: item.data[timeKey] ? Number(item.data[timeKey]) > 0 : false
    }));
  });

  // Calculate rankings for each time period
  const rankingsByTimePeriod = timePeriodsData.map(periodData => {
    // Filter out items with no OpenRank value
    const activeItems = periodData.filter(item => item.hasValue);

    // Sort by OpenRank value in descending order
    const sorted = [...activeItems].sort((a, b) => b.value - a.value);

    // Assign rankings - only for items that have values
    const rankings = new Map();
    sorted.forEach((item, index) => {
      rankings.set(item.name, index + 1); // 1-based ranking
    });

    return rankings;
  });

  // Create series data with rankings - only show data points starting from first non-zero OpenRank value
  list.forEach(item => {
    // Find first index where this project has a value
    const firstValueIndex = timeKeys.findIndex((timeKey) =>
      item.data[timeKey] && Number(item.data[timeKey]) > 0
    );

    if (firstValueIndex === -1) {
      // Skip projects with no data at all in this time range
      return;
    }

    const rankValues = timeKeys.map((timeKey, index) => {
      // Only include values from the point where this project starts having OpenRank data
      if (index < firstValueIndex) {
        return null; // No data point before the project started
      }
      return rankingsByTimePeriod[index].get(item.name) || null;
    });

    chartData.series.push({
      name: item.name,
      values: rankValues,
      firstValueIndex: firstValueIndex // Store the index of first value for the chart
    });
  });

  const title = `OpenRank 排名变化 (${timeSpan ? `${timeSpan[0]} to ${timeSpan[1]}` : 'All Time'})`;

  return (
    <BumpChart
      title={title}
      data={chartData}
      height={height}
    />
  );
};

export default OpenDiggerBumpChart;
