import { EChartsOption } from 'echarts';
import React, { useEffect, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';

// Color palette for the lines
const colorPalette = [
  '#5470C6', '#91CC75', '#FAC858', '#EE6666', '#73C0DE',
  '#3BA272', '#FC8452', '#9A60B4', '#EA7CCC', '#008080',
  '#4682B4', '#FF6347', '#32CD32', '#FFD700', '#8A2BE2'
];

interface BumpChartProps {
  title?: string;
  data: {
    dates: string[];
    series: Array<{
      name: string;
      values: (number | null)[];
      firstValueIndex: number;
    }>;
  };
  height?: string | number;
}

const BumpChart: React.FC<BumpChartProps> = ({
  title = 'Bump Chart',
  data,
  height = '700px'
}) => {
  const chartRef = useRef<ReactECharts>(null);
  const [currentOption, setCurrentOption] = useState<EChartsOption>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed] = useState(200); // Fixed at fast speed for smooth animation
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
        formatter: function(params: any) {
          const time = params[0].axisValue;
          let result = `<div style="font-weight:bold;margin-bottom:5px">${time}</div>`;

          // Sort params by value (rank) to show in ascending order (1st, 2nd, 3rd...)
          params.sort((a: any, b: any) => a.value - b.value);

          params.forEach((param: any) => {
            const color = param.color;
            const name = param.seriesName;
            const rank = param.value;
            const rankDisplay = rank === 1 ? '1st' :
                              rank === 2 ? '2nd' :
                              rank === 3 ? '3rd' : `${rank}th`;

            result += `<div style="display:flex;align-items:center;margin:5px 0">
              <div style="width:10px;height:10px;background-color:${color};border-radius:50%;margin-right:5px"></div>
              <span>${name}: <span style="font-weight:bold">${rankDisplay}</span></span>
            </div>`;
          });

          return result;
        }
      },
      // legend: {
      //   type: 'scroll',
      //   orient: 'horizontal',
      //   top: 40,
      //   left: 'center',
      //   data: data.series.map(s => s.name)
      // },
      grid: {
        left: '3%',
        right: '15%',
        bottom: '15%',
        top: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: true,
        data: data.dates,
        axisLabel: {
          showMaxLabel: true,
          rotate: 45
        }
      },
      yAxis: {
        type: 'value',
        inverse: true, // Make rank 1 at the top
        min: 1,
        max: data.series.length,
        interval: 1, // Force a tick for every 1 unit (rank)
        axisLabel: {
          formatter: function(value: number) {
            if (value === 1) return '1st';
            if (value === 2) return '2nd';
            if (value === 3) return '3rd';
            return `${value}th`;
          },
          showMinLabel: true,
          showMaxLabel: true
        }
      },
      series: data.series.map((s, index) => ({
        name: s.name,
        type: 'line',
        showSymbol: true,
        symbolSize: 8,
        smooth: true,
        lineStyle: {
          width: 3,
        },
        emphasis: {
          focus: 'series'
        },
        itemStyle: {
          color: colorPalette[index % colorPalette.length],
          borderWidth: 2
        },
        // Show empty data initially - we'll add points during animation
        data: [],
        endLabel: {
          show: true,
          formatter: (params: any) => {
            // Get the project name without owner
            const projectName = s.name.split('/').pop() || s.name;
            // Format rank display
            const rank = params.value;
            const rankDisplay = rank === 1 ? '1st' :
                              rank === 2 ? '2nd' :
                              rank === 3 ? '3rd' : `${rank}th`;

            // return `${projectName}: ${rankDisplay}`;
            return `${projectName}`;
          },
          fontSize: 14,
          offset: [10, 0],
          color: colorPalette[index % colorPalette.length], // Match text color with line color
          backgroundColor: 'rgba(255, 255, 255, 0.7)', // Lighter background for better contrast
          padding: [3, 5],
          borderRadius: 10,
          fontWeight: 'bold',
        }
      })),
      animation: true,
      animationDuration: 300,
      animationEasing: 'cubicInOut',
      animationDurationUpdate: 300,
      animationEasingUpdate: 'cubicInOut',
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
  }, [data, title]);

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

    const updatedOption: EChartsOption = {
      ...currentOption,
      series: data.series.map((s, idx) => {
        // Only include data points up to current animation frame
        // and only after the project first appears
        const firstPointIndex = Math.max(0, s.firstValueIndex); // Index where this project first appears

        let seriesData = [];
        if (nextIndex >= firstPointIndex) {
          // Only include points from when the project started to current animation frame
          const startIndex = firstPointIndex;
          const endIndex = nextIndex + 1;

          // Extract valid values from the range
          seriesData = [];
          for (let i = startIndex; i < endIndex; i++) {
            // Map index positions to values and coordinates
            const timeLabel = data.dates[i];
            const rankValue = s.values[i];

            if (rankValue !== null) {
              // Only add points where we have ranking data
              seriesData.push([timeLabel, rankValue]);
            }
          }
        }

        const currentRank = seriesData.length > 0 ? seriesData[seriesData.length - 1][1] : null;

        return {
          ...(currentOption.series as any)[idx],
          data: seriesData,
          endLabel: {
            ...(currentOption.series as any)[idx].endLabel,
            formatter: (params: any) => {
              // Get the project name without owner
              const projectName = s.name.split('/').pop() || s.name;
              // Format rank display
              const rank = currentRank;
              const rankDisplay = rank === 1 ? '1st' :
                                rank === 2 ? '2nd' :
                                rank === 3 ? '3rd' : `${rank}th`;

              // return `${projectName}: ${rankDisplay}`;
              return `${projectName}`;
            },
            color: colorPalette[idx % colorPalette.length] // Match text color with line color
          }
        };
      }),
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
          // Show no data when resetting - we'll animate from the beginning
          return {
            ...(currentOption.series as any)[idx],
            data: [],
          endLabel: {
            ...(currentOption.series as any)[idx].endLabel,
            formatter: (params: any) => {
              // Get the project name without owner
              const projectName = s.name.split('/').pop() || s.name;
              // No rank is available during reset
              return `${projectName}`;
            },
            color: colorPalette[idx % colorPalette.length] // Match text color with line color
            }
          };
        })
      };
      setCurrentOption(resetOption);
    }
    setIsPlaying(!isPlaying);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newIndex = parseInt(e.target.value, 10);
    setCurrentIndex(newIndex);

        const updatedOption: EChartsOption = {
      ...currentOption,
      series: data.series.map((s, idx) => {
        // Only include data points up to current slider position
        // and only after the project first appears
        const firstPointIndex = Math.max(0, s.firstValueIndex); // Index where this project first appears

        let seriesData = [];
        if (newIndex >= firstPointIndex) {
          // Only include points from when the project started to current slider position
          const startIndex = firstPointIndex;
          const endIndex = newIndex + 1;

          // Extract valid values from the range
          seriesData = [];
          for (let i = startIndex; i < endIndex; i++) {
            // Map index positions to values and coordinates
            const timeLabel = data.dates[i];
            const rankValue = s.values[i];

            if (rankValue !== null) {
              // Only add points where we have ranking data
              seriesData.push([timeLabel, rankValue]);
            }
          }
        }

        const currentRank = seriesData.length > 0 ? seriesData[seriesData.length - 1][1] : null;

        return {
          ...(currentOption.series as any)[idx],
          data: seriesData,
          endLabel: {
            ...(currentOption.series as any)[idx].endLabel,
            formatter: (params: any) => {
              // Get the project name without owner
              const projectName = s.name.split('/').pop() || s.name;
              // Format rank display
              const rank = currentRank;
              const rankDisplay = rank === 1 ? '1st' :
                                rank === 2 ? '2nd' :
                                rank === 3 ? '3rd' : `${rank}th`;

              return `${projectName}: ${rankDisplay}`;
            },
            color: colorPalette[idx % colorPalette.length] // Match text color with line color
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
          {isPlaying ? '暂停' : '播放'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexGrow: 1 }}>
          <span>时间轴: </span>
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
      />
    </div>
  );
};

export default BumpChart;
