import { useRequest } from 'ahooks';

import { MetricData, TimeKey, TimeUnit, YearKey, YearMonthKey, YearQuarterKey } from '@site/src/types/opendigger';
import fetchOpenDiggerData, { FetchOpenDiggerDataProps } from '@site/src/utils/fetchOpenDiggerData';

const fetchAllData = async (
  type: FetchOpenDiggerDataProps['type'],
  names: Array<FetchOpenDiggerDataProps['name']>
) => {
  const promises = names.map(async (name) => ({
    name,
    data: await fetchOpenDiggerData({ type, name })
  }));

  return await Promise.all(promises);
};

interface DataGroupedByTimeUnit {
  range: Set<TimeKey>,
  sortedRange: TimeKey[];
  list: Array<{
    name: FetchOpenDiggerDataProps['name'];
    data: MetricData;
  }>
}

const extractFromAllData = (allData: Awaited<ReturnType<typeof fetchAllData>>) => {
  const result: {
    [key in TimeUnit]: DataGroupedByTimeUnit;
  } = {
    year: { range: new Set(), sortedRange: [], list: [] },
    quarter: { range: new Set(), sortedRange: [], list: [] },
    month: { range: new Set(), sortedRange: [], list: [] },
  };

  for (const { name, data } of allData) {
    const dataGroup: {[key in TimeUnit]: MetricData} = {
      [TimeUnit.YEAR]: {},
      [TimeUnit.QUARTER]: {},
      [TimeUnit.MONTH]: {}
    };

    Object.keys(data).forEach((timeKey: TimeKey) => {
      switch(true) {
        case /^\d{4}$/.test(timeKey):
          result[TimeUnit.YEAR].range.add(timeKey as YearKey);
          dataGroup[TimeUnit.YEAR][timeKey as YearKey] = data[timeKey as YearKey];
          break;
        case /^\d{4}Q\d$/.test(timeKey):
          result[TimeUnit.QUARTER].range.add(timeKey as YearQuarterKey);
          dataGroup[TimeUnit.QUARTER][timeKey as YearQuarterKey] = data[timeKey as YearQuarterKey];
          break;
        case /^\d{4}-\d{2}$/.test(timeKey):
          result[TimeUnit.MONTH].range.add(timeKey as YearMonthKey);
          dataGroup[TimeUnit.MONTH][timeKey as YearMonthKey] = data[timeKey as YearMonthKey];
          break;
      }
    });

    result[TimeUnit.YEAR].list.push({ name, data: dataGroup[TimeUnit.YEAR]});
    result[TimeUnit.QUARTER].list.push({ name, data: dataGroup[TimeUnit.QUARTER] });
    result[TimeUnit.MONTH].list.push({ name, data: dataGroup[TimeUnit.MONTH] });
  }

  // 将Set转换为有序数组（仅在需要时）
  for (const unit of Object.values(TimeUnit)) {
    result[unit].sortedRange = [...result[unit].range].sort();
  }

  return result;
}

export interface UseGroupedDataProps {
  type: FetchOpenDiggerDataProps['type'];
  names: Array<FetchOpenDiggerDataProps['name']>;
}

const useGroupedData = ({ type, names }: UseGroupedDataProps) => {
  const {data: allData, loading} = useRequest(fetchAllData, {
    defaultParams: [type, names],
  })
  const allDataGroupedByTimeUnit = extractFromAllData(allData || []);

  return {
    loading,
    allData,
    allDataGroupedByTimeUnit,
  };
};

export default useGroupedData;
