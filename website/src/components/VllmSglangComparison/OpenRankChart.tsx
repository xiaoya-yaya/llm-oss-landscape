import React, { useEffect, useRef } from 'react';
import { Spin } from 'antd';
import * as echarts from 'echarts';
import { ProjectMonthlyOpenRank } from '../../utils/clickhouseClient';
import styles from './styles.module.css';

interface Project {
  owner: string;
  repo: string;
  name: string;
  color: string;
}

interface OpenRankChartProps {
  projects: Project[];
  projectData: Record<string, ProjectMonthlyOpenRank[]>;
  loading: boolean;
}

const formatMonth = (month: string): string => {
  // Convert YYYYMM to YYYY-MM format for display
  if (month.length === 6) {
    return `${month.slice(0, 4)}-${month.slice(4, 6)}`;
  }
  return month;
};

const OpenRankChart: React.FC<OpenRankChartProps> = ({ projects, projectData, loading }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // Initialize chart
  useEffect(() => {
    if (!chartRef.current) return;

    // Initialize chart instance
    chartInstance.current = echarts.init(chartRef.current);

    // Handle resize
    const resizeHandler = () => {
      chartInstance.current?.resize();
    };

    window.addEventListener('resize', resizeHandler);

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeHandler);
      chartInstance.current?.dispose();
    };
  }, []);

  // Update chart when data changes
  useEffect(() => {
    if (loading || !chartInstance.current) return;

    const series: echarts.LineSeriesOption[] = [];
    const allMonths = new Set<string>();

    // Process data for each project
    projects.forEach((project) => {
      const projectKey = `${project.owner}/${project.repo}`;
      const data = projectData[projectKey] || [];

      // Collect all months for x-axis
      data.forEach(item => allMonths.add(item.month));

      // Create series data
      const seriesData: [string, number][] = data.map(item => [
        formatMonth(item.month),
        Number(item.project_openrank.toFixed(2))
      ]);

      // Add project series
      series.push({
        name: project.name,
        type: 'line',
        data: seriesData,
        smooth: true,
        lineStyle: {
          width: 3
        },
        itemStyle: {
          color: project.color
        },
        symbol: 'circle',
        symbolSize: 8,
        emphasis: {
          focus: 'series',
          itemStyle: {
            borderWidth: 2,
            borderColor: '#fff',
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.3)'
          }
        }
      });
    });

    // Sort months for x-axis
    const sortedMonths = Array.from(allMonths).sort().map(formatMonth);

    // Set chart options
    const option: echarts.EChartsOption = {
      title: {
        text: '项目月度OpenRank趋势',
        left: 'center',
        textStyle: {
          fontSize: 18,
          fontWeight: 'bold'
        },
        padding: [20, 0, 0, 0]
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          label: {
            backgroundColor: '#6a7985'
          }
        }
      },
      legend: {
        data: projects.map(p => p.name),
        top: 'bottom',
        padding: [30, 0, 0, 0]
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: sortedMonths,
        axisLabel: {
          rotate: 45,
          formatter: (value: string) => value
        }
      },
      yAxis: {
        type: 'value',
        name: 'OpenRank',
        nameLocation: 'middle',
        nameGap: 40,
        nameTextStyle: {
          fontWeight: 'bold'
        }
      },
      series: series
    };

    // Apply options to chart
    chartInstance.current.setOption(option);
  }, [projects, projectData, loading]);

  return (
    <div className={styles.chartSection}>
      <Spin spinning={loading} tip="加载项目数据中...">
        <div className={styles.chartContainer} ref={chartRef} />
      </Spin>
    </div>
  );
};

export default OpenRankChart;
