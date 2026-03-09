import React, { useEffect, useState } from 'react';
import { Table, Spin, Tabs, Avatar, Tooltip } from 'antd';
import type { TabsProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { GithubOutlined, TwitterOutlined, MailOutlined, HomeOutlined, GlobalOutlined } from '@ant-design/icons';
import { DeveloperInfo } from '../../utils/clickhouseClient';
import { fetchGithubUser, GithubUser } from '../../utils/githubApi';
import styles from './styles.module.css';

interface Project {
  owner: string;
  repo: string;
  name: string;
  color: string;
}

interface DeveloperBoardProps {
  projects: Project[];
  developerData: {[key: string]: DeveloperInfo[]};
  loading: boolean;
}

const DeveloperBoard: React.FC<DeveloperBoardProps> = ({ projects, developerData, loading }) => {
  const [githubUsers, setGithubUsers] = useState<Map<string, GithubUser>>(new Map());
  const [loadingAvatars, setLoadingAvatars] = useState<boolean>(false);

  // Fetch GitHub avatars and additional info when developer data is loaded
  useEffect(() => {
    const allDevelopers: string[] = [];

    // Collect all unique developer logins from all projects
    for (const projectKey in developerData) {
      developerData[projectKey]?.forEach(dev => {
        if (dev.login && !allDevelopers.includes(dev.login)) {
          allDevelopers.push(dev.login);
        }
      });
    }

    if (allDevelopers.length > 0) {
      fetchDeveloperInfo(allDevelopers);
    }
  }, [developerData]);

  // Fetch GitHub information for developers
  const fetchDeveloperInfo = async (logins: string[]) => {
    setLoadingAvatars(true);
    try {
      // Fetch in batches of 10 to avoid rate limits
      const batchSize = 10;
      const userMap = new Map<string, GithubUser>();

      for (let i = 0; i < logins.length; i += batchSize) {
        const batch = logins.slice(i, i + batchSize);
        const promises = batch.map(login => fetchGithubUser(login));
        const results = await Promise.all(promises);

        results.forEach((user, index) => {
          if (user) {
            userMap.set(batch[index], user);
          }
        });

        // Add a small delay between batches to respect rate limits
        if (i + batchSize < logins.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      setGithubUsers(userMap);
    } catch (error) {
      console.error('Error fetching developer info:', error);
    } finally {
      setLoadingAvatars(false);
    }
  };

  // Define columns for the developer table
  const columns: ColumnsType<DeveloperInfo> = [
    {
      title: '排名',
      key: 'rank',
      width: 70,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: '开发者',
      dataIndex: 'login',
      key: 'login',
      render: (login: string) => {
        const user = githubUsers.get(login);
        return (
          <div className={styles.developerCell}>
            <Avatar
              src={user?.avatar_url}
              size={40}
              icon={<GithubOutlined />}
            />
            <div className={styles.developerInfo}>
              <a href={`https://github.com/${login}`} target="_blank" rel="noopener noreferrer">
                {login}
              </a>
              {user?.name && <div className={styles.developerName}>{user.name}</div>}
            </div>
          </div>
        );
      },
    },
    {
      title: 'OpenRank',
      dataIndex: 'openrank_value',
      key: 'openrank_value',
      sorter: (a, b) => a.openrank_value - b.openrank_value,
      render: (value: number) => value.toFixed(2),
    },
    {
      title: '公司/组织',
      dataIndex: 'company',
      key: 'company',
    },
    {
      title: '位置',
      dataIndex: 'location',
      key: 'location',
    },
    {
      title: '社交媒体',
      key: 'social',
      render: (_: any, record: DeveloperInfo) => (
        <div className={styles.socialIcons}>
          {record.email && (
            <Tooltip title={record.email}>
              <a href={`mailto:${record.email}`}>
                <MailOutlined className={styles.socialIcon} />
              </a>
            </Tooltip>
          )}
          {record.twitter_username && (
            <Tooltip title={`@${record.twitter_username}`}>
              <a href={`https://twitter.com/${record.twitter_username}`} target="_blank" rel="noopener noreferrer">
                <TwitterOutlined className={styles.socialIcon} />
              </a>
            </Tooltip>
          )}
          {record.blog && (
            <Tooltip title={record.blog}>
              <a href={record.blog} target="_blank" rel="noopener noreferrer">
                <HomeOutlined className={styles.socialIcon} />
              </a>
            </Tooltip>
          )}
        </div>
      ),
    },
  ];

  // Create tabs for each project
  const tabItems: TabsProps['items'] = projects.map(project => {
    const projectKey = `${project.owner}/${project.repo}`;
    const projectDevelopers = developerData[projectKey] || [];

    return {
      label: (
        <span>
          <span
            className={styles.colorDot}
            style={{ backgroundColor: project.color }}
          ></span>
          {project.name}
        </span>
      ),
      key: projectKey,
      children: (
        <Table
          dataSource={projectDevelopers}
          columns={columns}
          loading={loading || loadingAvatars}
          rowKey="login"
          pagination={{ pageSize: 10 }}
        />
      ),
    };
  });

  return (
    <div className={styles.developerSection}>
      <div className={styles.sectionTitle}>开发者贡献排行榜</div>
      <Spin spinning={loading} tip="加载开发者数据中...">
        <Tabs items={tabItems} centered />
      </Spin>
    </div>
  );
};

export default DeveloperBoard;
