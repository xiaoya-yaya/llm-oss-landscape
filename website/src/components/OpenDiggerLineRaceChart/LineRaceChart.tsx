import { EChartsOption } from 'echarts';
import React, { useEffect, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';

// Color palette for the lines
const colorPalette = [
  '#5470C6', '#91CC75', '#FAC858', '#EE6666', '#73C0DE',
  '#3BA272', '#FC8452', '#9A60B4', '#EA7CCC', '#008080',
  '#4682B4', '#FF6347', '#32CD32', '#FFD700', '#8A2BE2'
];

interface LineRaceChartProps {
  title?: string;
  data: {
    dates: string[];
    series: Array<{
      name: string;
      values: (number | null)[];
    }>;
  };
  height?: string | number;
  yAxisName?: string;
}

const LineRaceChart: React.FC<LineRaceChartProps> = ({
  title = 'Line Race Chart',
  data,
  height = '1500px',
  yAxisName = 'Value'
}) => {
  const chartRef = useRef<ReactECharts>(null);
  const [currentOption, setCurrentOption] = useState<EChartsOption>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1000); // milliseconds between updates
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Prepare the initial chart option
  useEffect(() => {
    if (!data || !data.dates || !data.series || data.dates.length === 0) return;

    const initialOption: EChartsOption = {
      title: {
        text: title,
        left: 'center',
        top: 10
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
        type: 'scroll',
        orient: 'horizontal',
        top: 10,
        left: 'center',
        data: data.series.map(s => s.name)
      },
      grid: {
        left: '3%',
        right: '15%',
        bottom: '5%',
        top: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: data.dates,
        axisLabel: {
          showMaxLabel: true,
          rotate: 45
        }
      },
      yAxis: {
        // type: 'value',
        type: 'log',
        name: yAxisName,
        // scale: true
      },
      series: data.series.map((s, index) => ({
        name: s.name,
        type: 'line',
        showSymbol: false,
        smooth: true,
        lineStyle: {
          width: 3,
          // shadowColor: 'rgba(0,0,0,0.3)',
          // shadowBlur: 10,
          // shadowOffsetY: 8
        },
        emphasis: {
          focus: 'series'
        },
        symbolSize: 7,
        itemStyle: {
          color: colorPalette[index % colorPalette.length],
          borderWidth: 3
        },
        data: s.values.slice(0, 1), // Start with just the first data point
        endLabel: {
          show: true,
          formatter: (params: any) => {
            // Format: ProjectName: OpenRank
            // return `${s.name.split('/').pop()}: ${params.value ?? 0}`;
            return `${s.name.split('/').pop()}`;
          },
          fontSize: 12,
          offset: [10, 0],
          backgroundColor: 'rgba(255,255,255,0.7)',
          padding: [3, 5],
          borderRadius: 4
        }
      })),
      animation: true,
      animationDuration: 500,
      animationEasing: 'cubicInOut',
      animationDurationUpdate: 500,
      animationEasingUpdate: 'linear',
      toolbox: {
        feature: {
          saveAsImage: {}
        }
      },
      dataZoom: [
        {
          type: 'slider',
          show: true,
          start: 0,
          end: 100,
          bottom: 10
        }
      ]
    };

    setCurrentOption(initialOption);
  }, [data, title, yAxisName]);

  // Function to update the chart with new data points
  const updateChart = () => {
    if (!data || currentIndex >= data.dates.length - 1) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsPlaying(false);
      return;
    }

    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);

    const newSeries = [...currentOption.series as any];
    newSeries.forEach((s: any, idx: number) => {
      const seriesData = [...s.data, data.series[idx].values[nextIndex]];
      const currentValue = seriesData[seriesData.length - 1];

      s.data = seriesData;
      s.endLabel.formatter = (params: any) => {
        // Format: ProjectName: OpenRank
        const projectName = data.series[idx].name.split('/').pop();
        return `${projectName}: ${currentValue !== null ? currentValue.toFixed(2) : 'N/A'}`;
      };
    });

    const updatedOption: EChartsOption = {
      ...currentOption,
      series: newSeries,
      xAxis: {
        ...(currentOption.xAxis as any),
        axisLabel: {
          ...(currentOption.xAxis as any)?.axisLabel,
          formatter: (value: string) => {
            return value === data.dates[nextIndex] ? `→ ${value}` : value;
          }
        }
      }
    };

    setCurrentOption(updatedOption);
  };

  // Handle play/pause
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(updateChart, playSpeed);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, currentIndex, playSpeed]);

  // Reset when data changes
  useEffect(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [data]);

  const handlePlayPause = () => {
    if (currentIndex >= data.dates.length - 1) {
      // If at the end, reset to beginning
      setCurrentIndex(0);
      const resetOption: EChartsOption = {
        ...currentOption,
        series: data.series.map((s, idx) => {
          const initialValue = s.values[0];

          return {
            ...(currentOption.series as any)[idx],
            data: s.values.slice(0, 1),
            endLabel: {
              ...(currentOption.series as any)[idx].endLabel,
              formatter: (params: any) => {
                // Format: ProjectName: OpenRank
                const projectName = s.name.split('/').pop();
                return `${projectName}: ${initialValue !== null ? initialValue.toFixed(2) : 'N/A'}`;
              }
            }
          };
        })
      };
      setCurrentOption(resetOption);
    }
    setIsPlaying(!isPlaying);
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPlaySpeed(Number(e.target.value));
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newIndex = parseInt(e.target.value, 10);
    setCurrentIndex(newIndex);

    const updatedOption: EChartsOption = {
      ...currentOption,
      series: data.series.map((s, idx) => {
        const seriesData = s.values.slice(0, newIndex + 1);
        const currentValue = seriesData[seriesData.length - 1];

        return {
          ...(currentOption.series as any)[idx],
          data: seriesData,
          endLabel: {
            ...(currentOption.series as any)[idx].endLabel,
            formatter: (params: any) => {
              // Format: ProjectName: OpenRank
              const projectName = s.name.split('/').pop();
              return `${projectName}: ${currentValue !== null ? currentValue.toFixed(2) : 'N/A'}`;
            }
          }
        };
      })
    };

    setCurrentOption(updatedOption);
  };

  return (
    <div style={{ width: '100%', height }}>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: '10px',
        gap: '20px'
      }}>
        <button
          onClick={handlePlayPause}
          style={{
            padding: '8px 16px',
            backgroundColor: isPlaying ? '#f44336' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>

        <div>
          <label htmlFor="speed">Speed: </label>
          <select
            id="speed"
            value={playSpeed}
            onChange={handleSpeedChange}
            style={{
              padding: '8px',
              borderRadius: '4px'
            }}
          >
            <option value="1000">Slow</option>
            <option value="500">Normal</option>
            <option value="200">Fast</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexGrow: 1 }}>
          <span>Timeline: </span>
          <input
            type="range"
            min="0"
            max={data.dates.length - 2}
            value={currentIndex}
            onChange={handleSliderChange}
            style={{ flexGrow: 1 }}
          />
          <span>{data.dates[currentIndex]}</span>
        </div>
      </div>

      <ReactECharts
        ref={chartRef}
        option={currentOption}
        style={{ height: 'calc(100% - 50px)', width: '100%' }}
        notMerge={false}
        // lazyUpdate={true}
      />
    </div>
  );
};

export default LineRaceChart;
