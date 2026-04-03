import React, { useState, useEffect } from 'react';
// @ts-ignore
import Layout from '@theme/Layout';
import { useHistory, useLocation } from '@docusaurus/router';
import { ckClient } from '../utils/clickhouseUtils';

// 自定义样式
const fullPageStyles = {
  container: {
    minHeight: '100vh',
    padding: '0px 40px',
    backgroundColor: '#f5f6f7',
    overflow: 'hidden',
  },
  card: {
    maxWidth: '100%',
    width: '100%',
    height: '100%',
    maxHeight: 'none',
    overflow: 'visible',
  }
};

// Mock 数据接口
interface ContributorStats {
  actor_login: string;
  actor_id: number;
  avatar_url: string;
  name: string;
  bio: string;
  location: string;
  company: string;
  totalIssues: number;
  participatedIssuePR: number;
  totalPRs: number;
  mergedPRs: number;
  prReviews: number;
  codeChanges: number;
  totalOpenrank: number;
}

interface RepoContribution {
  repo_name: string;
  openrank: number;
}

// Mock 数据
const mockContributorStats: ContributorStats = {
  actor_login: 'k Avoid',
  actor_id: 12459910,
  avatar_url: 'https://avatars.githubusercontent.com/u/12459910?v=4',
  name: 'Kevin Kelly',
  bio: 'Author of Out of Control, Wired Magazine founding executive editor, and Dong CEO of The Long Now Foundation.',
  location: 'Pacific Palisades, CA',
  company: 'Long Now Foundation',
  totalIssues: 156,
  participatedIssuePR: 423,
  totalPRs: 89,
  mergedPRs: 67,
  prReviews: 234,
  codeChanges: 15892,
  totalOpenrank: 2456
};

const mockTopRepos: RepoContribution[] = [
];

export default function ContributorDetail(): JSX.Element {
  const history = useHistory();
  const location = useLocation();

  // 头部基本信息（从 URL 参数获取，立即可用）
  const [basicInfo, setBasicInfo] = useState<{
    actor_login: string;
    actor_id: number;
    avatar_url: string;
    name?: string;
    bio?: string;
    location?: string;
    company?: string;
  } | null>(null);

  // 详情数据（异步加载）
  const [contributor, setContributor] = useState<ContributorStats | null>(null);
  const [topRepos, setTopRepos] = useState<RepoContribution[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(true);

  // 获取当前的年份和月份，计算过去12个月的起始日期
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // JavaScript 月份从 0 开始
  
  // 计算过去12个月的起始日期 (当前月往前12个月)
  const oneYearAgo = new Date(currentYear, currentMonth - 12, 1);
  const yearStart = `${oneYearAgo.getFullYear()}-${String(oneYearAgo.getMonth() + 1).padStart(2, '0')}-01 00:00:00`;
  
  // 计算12个月前的年份和月份，用于 toYYYYMM 过滤
  const startYear = oneYearAgo.getFullYear();
  const startMonth = oneYearAgo.getMonth() + 1;
  const startYearMonth = `${startYear}${String(startMonth).padStart(2, '0')}`;

  // 获取活跃度统计数据
  const fetchContributorStats = async (actorId: number) => {
    const sql = `
SELECT
    countIf(type = 'IssuesEvent' AND action = 'opened') AS issue_opened_count,
    countIf(type = 'PullRequestEvent' AND action = 'opened') AS pr_opened_count,
    countIf(type = 'PullRequestEvent' AND pull_merged = 1) AS pr_merged_count,
    countIf(type = 'PullRequestReviewEvent') AS pr_review_count,
    countIf(type IN ('IssuesEvent','PullRequestEvent','PullRequestReviewEvent')) AS pr_issue_participation_count,
    sumIf(pull_additions + pull_deletions, type = 'PullRequestEvent' AND pull_merged = 1) AS total_code_changes
FROM events
WHERE actor_id = ${actorId}
-- AND toYYYYMM(created_at) >= ${startYearMonth}
    `;
    const data = await ckClient.query(sql, 'contributor_overview_all');
    return data && data.length > 0 ? data[0] : null;
  };

  // 获取 OpenRank 贡献度
  const fetchOpenRank = async (actorId: number) => {
    const sql = `
SELECT sum(openrank) as openrank FROM community_openrank
WHERE actor_id = ${actorId}
-- AND created_at > '${yearStart}'
    `;
    const data = await ckClient.query(sql, 'contributor_openrank_all');
    return data && data.length > 0 ? data[0].openrank : 0;
  };

  // 获取贡献度 Top 10 仓库
  const fetchTopRepos = async (actorId: number) => {
    const sql = `
SELECT repo_name, sum(openrank) as openrank FROM community_openrank
WHERE actor_id = ${actorId}
-- AND created_at > '${yearStart}'
GROUP BY repo_name ORDER BY openrank DESC LIMIT 10
    `;
    const data = await ckClient.query(sql, 'contributorRepoTop10_all');
    return data || [];
  };

  // Parse contributor data from URL query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const contributorData = params.get('data');

    const fetchData = async () => {
      setLoadingDetails(true);
      try {
        if (contributorData) {
          const decoded = decodeURIComponent(contributorData);
          const data = JSON.parse(decoded);

          // 先设置头部基本信息（立即可用）
          setBasicInfo({
            actor_login: data.actor_login || '',
            actor_id: data.actor_id || 0,
            avatar_url: data.avatar_url || '',
            name: data.name,
            bio: data.bio,
            location: data.location,
            company: data.company,
          });

          // 从 URL 获取 actor_id
          const actorId = data.actor_id;

          // 并行获取活跃度统计、OpenRank 和 Top 10 仓库
          const [stats, openrank, repos] = await Promise.all([
            actorId ? fetchContributorStats(actorId) : Promise.resolve(null),
            actorId ? fetchOpenRank(actorId) : Promise.resolve(0),
            actorId ? fetchTopRepos(actorId) : Promise.resolve([])
          ]);

          // 合并数据
          setContributor({
            ...mockContributorStats,
            ...data,
            // 使用真实数据，如果获取失败则使用 Mock
            totalIssues: stats?.issue_opened_count ?? mockContributorStats.totalIssues,
            participatedIssuePR: stats?.pr_issue_participation_count ?? mockContributorStats.participatedIssuePR,
            totalPRs: stats?.pr_opened_count ?? mockContributorStats.totalPRs,
            mergedPRs: stats?.pr_merged_count ?? mockContributorStats.mergedPRs,
            prReviews: stats?.pr_review_count ?? mockContributorStats.prReviews,
            codeChanges: stats?.total_code_changes ?? mockContributorStats.codeChanges,
            totalOpenrank: openrank ?? data.openrank ?? mockContributorStats.totalOpenrank,
          });
          setTopRepos(repos && repos.length > 0 ? repos : mockTopRepos);
        } else {
          // 没有 URL 数据时使用 Mock 数据
          setContributor(mockContributorStats);
          setTopRepos(mockTopRepos);
        }
      } catch (e) {
        console.error('Failed to parse contributor data:', e);
        setContributor(mockContributorStats);
        setTopRepos(mockTopRepos);
      } finally {
        setLoadingDetails(false);
      }
    };

    fetchData();
  }, [location.search]);

  const formatNumber = (num: number): string => {
    // 先处理大数字，再处理小数
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    // 如果是小数，保留一位小数
    if (num % 1 !== 0) {
      return num.toFixed(1);
    }
    return num.toString();
  };

  const handleBack = () => {
    history.goBack();
  };

  // 如果没有基本信息，显示 404
  if (!basicInfo) {
    return (
      <Layout title="Contributor Not Found">
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <h1>Contributor Not Found</h1>
          <button onClick={handleBack} style={{
            padding: '10px 20px',
            fontSize: '16px',
            cursor: 'pointer',
            backgroundColor: '#4285f4',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}>
            Back to Landscape
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={`Contributor - ${basicInfo.actor_login}`}>
      <div style={fullPageStyles.container as any}>
        <div style={fullPageStyles.card as any}>
          <button onClick={handleBack} style={{
            marginBottom: '20px',
            padding: '10px 20px',
            fontSize: '14px',
            cursor: 'pointer',
            backgroundColor: 'white',
            color: '#333',
            border: '1px solid #ddd',
            borderRadius: '6px'
          }}>
            ← 返回
          </button>

          {/* 1. 开源开发者头部简介（立即显示） */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '30px',
            marginBottom: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <a href={`https://github.com/${basicInfo.actor_login}`} target="_blank" rel="noopener noreferrer">
                <img
                  src={basicInfo.avatar_url}
                  alt={basicInfo.actor_login}
                  style={{
                    width: '120px',
                    height: '120px',
                    borderRadius: '50%',
                    border: '3px solid #e8e8e8'
                  }}
                />
              </a>
              <div>

                <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', color: '#1a1a1a' }}>
                  <a href={`https://github.com/${basicInfo.actor_login}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: '#1a1a1a' }}>
                    {basicInfo.name || basicInfo.actor_login}
                  </a>
                </h1>
                <p style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#666' }}>
                  @{basicInfo.actor_login}
                </p>
                {basicInfo.bio && (
                  <p style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#444', maxWidth: '600px' }}>
                    {basicInfo.bio}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '20px', color: '#666', fontSize: '14px' }}>
                  {basicInfo.location && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      📍 {basicInfo.location}
                    </span>
                  )}
                  {basicInfo.company && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      🏢 {basicInfo.company}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 2. 活跃度统计 Overview 卡片 */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <h2 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#1a1a1a' }}>
              活跃度统计 Overview
            </h2>
            {loadingDetails ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                加载中...
              </div>
            ) : contributor ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '10px'
              }}>
                <div style={{
                  background: '#f8f9fa',
                  borderRadius: '6px',
                  padding: '12px 6px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: '#4285f4' }}>
                    {formatNumber(contributor.totalIssues)}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666', marginTop: '2px', whiteSpace: 'nowrap' }}>
                    提交 Issue
                  </div>
                </div>
                <div style={{
                  background: '#f8f9fa',
                  borderRadius: '6px',
                  padding: '12px 6px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: '#34a853' }}>
                    {formatNumber(contributor.participatedIssuePR)}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666', marginTop: '2px', whiteSpace: 'nowrap' }}>
                    参与 Issue/PR
                  </div>
                </div>
                <div style={{
                  background: '#f8f9fa',
                  borderRadius: '6px',
                  padding: '12px 6px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: '#fbbc04' }}>
                    {formatNumber(contributor.totalPRs)}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666', marginTop: '2px', whiteSpace: 'nowrap' }}>
                    提交 PR
                  </div>
                </div>
                <div style={{
                  background: '#f8f9fa',
                  borderRadius: '6px',
                  padding: '12px 6px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: '#fa7b17' }}>
                    {formatNumber(contributor.mergedPRs)}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666', marginTop: '2px', whiteSpace: 'nowrap' }}>
                    合入 PR
                  </div>
                </div>
                <div style={{
                  background: '#f8f9fa',
                  borderRadius: '6px',
                  padding: '12px 6px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: '#9334e6' }}>
                    {formatNumber(contributor.prReviews)}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666', marginTop: '2px', whiteSpace: 'nowrap' }}>
                    PR 评审
                  </div>
                </div>
                <div style={{
                  background: '#f8f9fa',
                  borderRadius: '6px',
                  padding: '12px 6px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: '#ea4335' }}>
                    {formatNumber(contributor.codeChanges)}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666', marginTop: '2px', whiteSpace: 'nowrap' }}>
                    代码变更
                  </div>
                </div>
                <div style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '6px',
                  padding: '12px 6px',
                  textAlign: 'center',
                  color: 'white'
                }}>
                  <div style={{ fontSize: '18px', fontWeight: '600' }}>
                    {formatNumber(contributor.totalOpenrank)}
                  </div>
                  <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', marginTop: '2px', whiteSpace: 'nowrap' }}>
                    OpenRank
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* 3. 贡献度 Top 10 仓库 */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '30px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <h2 style={{ margin: '0 0 24px 0', fontSize: '20px', color: '#1a1a1a' }}>
              贡献度 Top 10 仓库
            </h2>
            {loadingDetails ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                加载中...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
                {topRepos.map((repo, index) => (
                  <div
                    key={repo.repo_name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '16px',
                      background: '#f8f9fa',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f0f0f0';
                      e.currentTarget.style.transform = 'translateX(4px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#f8f9fa';
                      e.currentTarget.style.transform = 'translateX(0)';
                    }}
                  >
                    <span style={{
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      fontWeight: '600',
                      color: index < 3 ? '#fa7b17' : '#666',
                      background: index < 3 ? 'rgba(250,123,23,0.1)' : '#e8e8e8',
                      borderRadius: '50%',
                      marginRight: '16px'
                    }}>
                      {index + 1}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '16px', fontWeight: '500', color: '#1a1a1a' }}>
                        {repo.repo_name}
                      </div>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0px',
                      padding: '8px 16px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      borderRadius: '20px',
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}>
                      <span>🏆</span>
                      <span>{formatNumber(repo.openrank)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </Layout>
  );
}
