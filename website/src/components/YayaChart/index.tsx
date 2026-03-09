import { CompressOutlined, ExpandOutlined } from '@ant-design/icons';
import { Button, Card } from 'antd';
import React, { useState } from 'react';

import styles from './index.module.css';

interface YayaChartProps {
  title: string;
  chart: React.ReactNode;
}

const YayaChart: React.FC<YayaChartProps> = ({ title, chart }) => {
  const [fullScreen, setFullScreen] = useState(false);

  return (
    <Card
      className={`${styles.card} ${fullScreen ? styles.fullScreen : ''}`}
      classNames={{
        body: styles.cardBody,
      }}
      bordered={!fullScreen}
      title={title}
      extra={
        <Button
          size="small"
          icon={!fullScreen ? <ExpandOutlined /> : <CompressOutlined />}
          onClick={() => setFullScreen(!fullScreen)}
        />
      }
    >
      {chart}
    </Card>
  );
};

export default YayaChart;
