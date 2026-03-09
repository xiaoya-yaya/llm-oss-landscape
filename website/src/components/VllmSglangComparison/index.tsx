import React, { useEffect, useState } from 'react';
import { message } from 'antd';
import * as echarts from 'echarts';
import axios from 'axios';
import OpenRankChart from './OpenRankChart';
import DeveloperBoard from './DeveloperBoard';
import clickhouseClient from '../../utils/clickhouseClient';
import { ProjectMonthlyOpenRank, DeveloperInfo } from '../../utils/clickhouseClient';
import styles from './styles.module.css';

// Project configs
const PROJECTS = [
  { owner: 'vllm-project', repo: 'vllm', name: 'vLLM', color: '#5470c6' },
  { owner: 'sgl-project', repo: 'sglang', name: 'SGLang', color: '#91cc75' },
];

const VllmSglangComparison: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [projectData, setProjectData] = useState<Record<string, ProjectMonthlyOpenRank[]>>({});
  const [developerData, setDeveloperData] = useState<Record<string, DeveloperInfo[]>>({});
  const [connectionStatus, setConnectionStatus] = useState<boolean | null>(null);

  // Test the connection to ClickHouse on component mount
  useEffect(() => {
    const testClickHouseConnection = async () => {
      try {
        const isConnected = await clickhouseClient.testConnection();
        setConnectionStatus(isConnected);
        if (isConnected) {
          message.success('ClickHouse连接成功');
        } else {
          message.error('ClickHouse连接失败');
        }
      } catch (error) {
        console.error('Connection test error:', error);
        setConnectionStatus(false);
        message.error('ClickHouse连接测试出错');
      }
    };

    testClickHouseConnection();
  }, []);

  // Fetch data for all projects when connection is established
  useEffect(() => {
    if (connectionStatus === true) {
      fetchAllData();
    }
  }, [connectionStatus]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // Create promises to fetch all project data in parallel
      const projectDataPromises = PROJECTS.map(async (project) => {
        const query = clickhouseClient.getProjectMonthlyOpenRankQuery(project.owner, project.repo);
        const result = await clickhouseClient.executeQuery<ProjectMonthlyOpenRank[]>({ query });
        return {
          project: `${project.owner}/${project.repo}`,
          data: result
        };
      });

      const developersPromises = PROJECTS.map(async (project) => {
        const query = clickhouseClient.getTopDevelopersQuery(project.owner, project.repo, 20);
        const result = await clickhouseClient.executeQuery<DeveloperInfo[]>({ query });
        return {
          project: `${project.owner}/${project.repo}`,
          data: result
        };
      });

      // Wait for all promises to resolve
      const projectResults = await Promise.all(projectDataPromises);
      const developerResults = await Promise.all(developersPromises);

      // Process project data
      const projectDataMap: Record<string, ProjectMonthlyOpenRank[]> = {};
      projectResults.forEach(result => {
        projectDataMap[result.project] = result.data;
      });

      // Process developer data
      const developerDataMap: Record<string, DeveloperInfo[]> = {};
      developerResults.forEach(result => {
        developerDataMap[result.project] = result.data;
      });

      setProjectData(projectDataMap);
      setDeveloperData(developerDataMap);
    } catch (error) {
      console.error('Data fetching error:', error);
      message.error('数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>vLLM 与 SGLang 项目对比</h1>
        <p>此页面展示了vLLM和SGLang两个项目的OpenRank指标和开发者贡献排名</p>
        {connectionStatus === null && <div className={styles.loading}>正在连接到数据库...</div>}
        {connectionStatus === false && (
          <div className={styles.error}>
            <p>数据库连接失败，可能原因：</p>
            <ul>
              <li>ClickHouse 服务器暂时不可用（502 错误）</li>
              <li>网络连接问题</li>
              <li>认证配置问题</li>
            </ul>
            <p>请稍后再试或联系管理员</p>
          </div>
        )}
      </div>

      <OpenRankChart
        projects={PROJECTS}
        projectData={projectData}
        loading={loading}
      />

      <DeveloperBoard
        projects={PROJECTS}
        developerData={developerData}
        loading={loading}
      />
    </div>
  );
};

export default VllmSglangComparison;
