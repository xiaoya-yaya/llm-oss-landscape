import EChartsReact, { EChartsReactProps } from 'echarts-for-react';
import { useEffect, useRef, useState } from 'react';

import styles from './index.module.css';

const ResponsiveECharts: React.FC<EChartsReactProps> = (props) => {
  const [height, setHeight] = useState(500);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeight(entry.contentRect.height);
      }
    });

    observer.observe(element);

    return () => {
      observer.unobserve(element);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className={styles.container}>
      <EChartsReact {...props} opts={{ height }} />
    </div>
  );
};

export default ResponsiveECharts;
