import React, { useState, useEffect } from 'react';
// @ts-ignore
import Layout from '@theme/Layout';
import { Project } from '../components/InteractiveLandscape/types';
import styles from '../components/InteractiveLandscape/styles.module.css';
import { formatNumber } from '../components/InteractiveLandscape/utils';
import { ckClient } from '../utils/clickhouseUtils';
import { useHistory, useLocation } from '@docusaurus/router';
import { GITHUB_HEADERS } from '../utils/constant';

import {
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area
} from 'recharts';


export default function ProjectDetail(): JSX.Element {
  const history = useHistory();
  const location = useLocation();

  const [project, setProject] = useState<Project | null>(null);
  const [repoName, setRepoName] = useState<string | null>(null);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [openrankCurYear, setOpenrankCurYear] = useState(0);
  const [releases, setReleases] = useState<Release[]>([]);
  const [feature, setFeature] = useState<any[]>([]);
  const [openrankData, setOpenrankData] = useState<{ date: string; value: number }[]>([]);

  const [loadingContributors, setLoadingContributors] = useState(false);

  // Parse project data from URL query params
  useEffect(() => {


    const params = new URLSearchParams(location.search);
    const repo_name = params.get('repo_name');
    if (repo_name) {
      try {
        setRepoName(repo_name);
        setProject({
          repo_id: '',
          repo_name: repo_name,
          classification: params.get('classification') || '',
          stars: '0',
          forks: '0',
          openrank_25: '',
          language: params.get('language') || '',
          created_at: '',
          description: ''
        });
      } catch (e) {
        console.error('Failed to parse project data:', e);
      }
    }
    const fetchReleases = async (repoName: string) => {
      if (!repoName) return;

      try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);


        const response = await fetchWithCache(
            `https://api.github.com/repos/${repoName}/releases?per_page=50`,
            {
              headers: GITHUB_HEADERS
            }
        );

        if (!response.ok) {
          throw new Error(`GitHub API error: ${response.status}`);
        }

        const data = await response.json();

        const recentReleases = data.filter((release: Release) => {
          const publishedDate = new Date(release.published_at);
          return publishedDate >= sixMonthsAgo;
        });
        console.log('recentReleases', recentReleases);
        setReleases(recentReleases);
        setFeature(extractKeyFeatures(recentReleases));
        return recentReleases;
      } catch (error) {
        console.error(`Failed to fetch releases for ${repoName}:`, error);
        return [];
      }
    };
    const fetchContributors = async (repoName: string) => {
      if (!repoName) return;

      setLoadingContributors(true);
      const sql = `SELECT actor_login, actor_id, SUM(openrank) AS openrank
        FROM opensource.community_openrank
        WHERE repo_name = '${repoName}'
        and actor_login not like '%bot'
        and actor_login not like '%[bot]'
        and actor_id !=0
        GROUP BY actor_login, actor_id
        ORDER BY openrank DESC
        LIMIT 10`;
      const data = await ckClient.query(sql, 'topNcontributors');

      if (data) {
        const contributorsWithDetails = await Promise.all(
            (data as Contributor[]).map(async (contributor) => {
              try {
                const response = await fetchWithCache(`https://api.github.com/users/${contributor.actor_login}`,    {
                  headers: GITHUB_HEADERS
                });
                if (response.ok) {
                  const githubUser = await response.json();
                  return {
                    ...contributor,
                    actor_id: contributor.actor_id || githubUser.id, // 使用数据库的 actor_id，如果为空则用 GitHub API 的 id
                    avatar_url: githubUser.avatar_url,
                    bio: githubUser.bio,
                    name: githubUser.name,
                    location: githubUser.location,
                    company: githubUser.company,
                  };
                }
              } catch (error) {
                console.error(`Failed to fetch GitHub user ${contributor.actor_login}:`, error);
              }
              return contributor;
            })
        );
        setContributors(contributorsWithDetails);
      }
      setLoadingContributors(false);
    };
    const fetchProjectGithubInfo = async (repoName: string) => {
      if (!repoName) return;
      try {
        const response = await fetchWithCache(
            `https://api.github.com/repos/${repoName}`,
            {
              headers: GITHUB_HEADERS
            }
        );
        if (!response.ok) {
          throw new Error(`GitHub API error: ${response.status}`);
        }

        const data = await response.json();
        setProject({
          repo_id: '',
          repo_name: repoName,
          classification: classification,
          stars: String(data.stargazers_count),
          forks: String(data.forks_count),
          openrank_25: '',
          language: language,
          created_at: data.created_at,
          description: data.description
        });
      } catch (error) {
        console.error(`Failed to fetch GitHub info for ${repoName}:`, error);
      }
    }
    // 获取 OpenRank 历史数据
    const fetchOpenRankData = async (repoName: string) => {
      if (!repoName) return;

      try {
        const response = await fetch(
            `https://oss.open-digger.cn/github/${repoName}/openrank.json`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch OpenRank data: ${response.status}`);
        }
        const now = new Date();

        const data = await response.json();

        // 过滤出 yyyy-mm 格式的月份数据
        const entries = Object.entries(data) as [string, number][];
        const currentYear = now.getFullYear();

        // 获取当前年份的 OpenRank（数据中以年份为 key）
        const curYearEntry = entries.find((entry) => entry[0] === String(currentYear));
        const openrankCurYear = curYearEntry ? curYearEntry[1] : 0;
        setOpenrankCurYear(openrankCurYear);
        const monthlyData = entries
            .filter((entry) => /^\d{4}-\d{2}$/.test(entry[0]))
            .map(([date, value]) => ({
              date,
              value: value as number
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // 取最近半年的数据
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        const recentData = monthlyData.filter(item => {
          const [year, month] = item.date.split('-').map(Number);
          const itemDate = new Date(year, month - 1, 1);
          return itemDate >= sixMonthsAgo;
        });

        console.log('setOpenrankData', recentData);
        setOpenrankData(recentData);
      } catch (error) {
        console.error(`Failed to fetch OpenRank data for ${repoName}:`, error);
      }
    };
    fetchProjectGithubInfo(repoName);
    fetchReleases(repoName);
    fetchContributors(repoName);
    fetchOpenRankData(repoName);
  }, [location.search]);



  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown';

    // 处理 ISO 8601 格式: 2021-04-29T02:57:53Z
    if (dateString.includes('T')) {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Unknown';
      const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
    }

    // 处理 yyyy/mm/dd 格式
    const [year, month, day] = dateString.split('/');
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return `${months[parseInt(month) - 1]} ${day}, ${year}`;
  };

  const handleBack = () => {
    history.push('/llm-oss-landscape');
  };

  const handleContributorClick = (contributor: Contributor) => {
    const contributorData = {
      actor_login: contributor.actor_login,
      actor_id: contributor.actor_id,
      avatar_url: contributor.avatar_url,
      name: contributor.name,
      bio: contributor.bio,
      location: contributor.location,
      company: contributor.company,
      openrank: contributor.openrank
    };
    const encoded = encodeURIComponent(JSON.stringify(contributorData));
    history.push(`/llm-oss-landscape/contributor_detail?data=${encoded}`);
  };

// GitHub API 缓存工具函数 - 缓存 12 小时
  const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 小时
  const githubApiCache = new Map<string, { data: any; timestamp: number }>();

// 上次请求时间戳，用于限流
  let lastRequestTime = 0;

  const fetchWithCache = async (url: string, options?: RequestInit): Promise<Response> => {
    const cacheKey = url;

    // 检查缓存
    const cached = githubApiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`[Cache] Using cached data for: ${url}`);
      // 返回一个模拟的 Response 对象
      const response = new Response(JSON.stringify(cached.data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      return response;
    }

    // 休眠 100ms 避免被限流
    const now = Date.now();
    if (now - lastRequestTime < 100) {
      await new Promise(resolve => setTimeout(resolve, 100 - (now - lastRequestTime)));
    }
    lastRequestTime = Date.now();

    // 发起实际请求
    const response = await fetch(url, options);

    if (response.ok) {
      const data = await response.json();
      // 存入缓存
      githubApiCache.set(cacheKey, { data, timestamp: Date.now() });
      console.log(`[Cache] Cached data for: ${url}`);

      // 返回新的 Response 对象
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return response;
  };


// 简单的 Markdown 渲染组件
  const MarkdownContent: React.FC<{ content: string }> = ({ content }) => {
    const renderMarkdown = (text: string) => {
      const lines = text.split('\n');
      const elements: JSX.Element[] = [];
      let inCodeBlock = false;
      let codeContent = '';
      let codeLanguage = '';

      lines.forEach((line, index) => {
        // 代码块
        if (line.startsWith('```')) {
          if (inCodeBlock) {
            elements.push(
                <pre key={`code-${index}`} className={styles.markdownCodeBlock}>
              <code>{codeContent.trim()}</code>
            </pre>
            );
            codeContent = '';
            inCodeBlock = false;
          } else {
            inCodeBlock = true;
            codeLanguage = line.slice(3);
          }
          return;
        }

        if (inCodeBlock) {
          codeContent += line + '\n';
          return;
        }

        // 标题
        if (line.startsWith('### ')) {
          elements.push(<h4 key={index} className={styles.markdownH4}>{line.slice(4)}</h4>);
          return;
        }
        if (line.startsWith('## ')) {
          elements.push(<h3 key={index} className={styles.markdownH3}>{line.slice(3)}</h3>);
          return;
        }
        if (line.startsWith('# ')) {
          elements.push(<h2 key={index} className={styles.markdownH2}>{line.slice(2)}</h2>);
          return;
        }

        // 列表项
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
          const content = renderInlineMarkdown(trimmed.slice(2));
          elements.push(<div key={index} className={styles.markdownListItem}><span className={styles.markdownBullet}>•</span>{content}</div>);
          return;
        }

        // 空行
        if (trimmed === '') {
          elements.push(<div key={index} className={styles.markdownEmpty}></div>);
          return;
        }

        // 普通段落
        elements.push(<p key={index} className={styles.markdownParagraph}>{renderInlineMarkdown(trimmed)}</p>);
      });

      return elements;
    };

    const renderInlineMarkdown = (text: string) => {
      // 处理行内代码 `code`
      let parts = text.split(/(`[^`]+`)/);
      return parts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={i} className={styles.markdownInlineCode}>{part.slice(1, -1)}</code>;
        }

        // 处理 bold **text**
        let boldParts = part.split(/(\*\*[^*]+\*\*)/);
        return boldParts.map((bp, j) => {
          if (bp.startsWith('**') && bp.endsWith('**')) {
            return <strong key={`${i}-${j}`}>{bp.slice(2, -2)}</strong>;
          }

          // 处理 italic *text*
          let italicParts = bp.split(/(\*[^*]+\*)/);
          return italicParts.map((ip, k) => {
            if (ip.startsWith('*') && ip.endsWith('*') && !ip.startsWith('**')) {
              return <em key={`${i}-${j}-${k}`}>{ip.slice(1, -1)}</em>;
            }

            // 处理链接 [text](url)
            let linkParts = ip.split(/(\[[^\]]+\]\([^)]+\))/);
            return linkParts.map((lp, m) => {
              const linkMatch = lp.match(/\[([^\]]+)\]\(([^)]+)\)/);
              if (linkMatch) {
                return <a key={`${i}-${j}-${k}-${m}`} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className={styles.markdownLink}>{linkMatch[1]}</a>;
              }
              return lp;
            });
          });
        });
      });
    };

    return <div className={styles.markdownContent}>{renderMarkdown(content)}</div>;
  };


  interface Contributor {
    actor_login: string;
    actor_id: number;
    openrank: number;
    // GitHub 用户详细信息
    avatar_url?: string;
    bio?: string;
    name?: string;
    location?: string;
    company?: string;
  }

  interface Release {
    id: number;
    tag_name: string;
    name: string;
    body: string;
    published_at: string;
    html_url: string;
    author: {
      login: string;
      avatar_url: string;
    };
  }
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


  const extractKeyFeatures = (releases: Release[]): string[] => {
    const features: string[] = [];
    const keywords = [
      'support',
      'add',
      'new',
      'feature',
      'improve',
      'optimize',
      'performance',
      'fix',
      'update',
      'enhance'
    ];

    releases.slice(0, 5).forEach((release) => {
      const lines = release.body.split('\n');
      lines.forEach((line) => {
        const trimmedLine = line.trim();
        if (
            trimmedLine.startsWith('*') ||
            trimmedLine.startsWith('-') ||
            trimmedLine.startsWith('•')
        ) {
          const content = trimmedLine.substring(1).trim();
          const lowerContent = content.toLowerCase();
          if (
              keywords.some((keyword) => lowerContent.includes(keyword)) &&
              content.length > 20 &&
              content.length < 150
          ) {
            features.push(content);
          }
        }
      });
    });

    return features.slice(0, 5);
  };
  if (!project) {
    return (
      <Layout title="Project Not Found">
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <h1>Loading...</h1>
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

  const orgName = repoName.split('/')[0];

  return (
    <Layout title={repoName}>
      <div style={fullPageStyles.container as any}>
        <div style={fullPageStyles.card as any} className={styles.projectCard}>
          <button className={styles.backButton} onClick={handleBack}>
            ← Back to Landscape
          </button>

          <div className={styles.cardHeader}>
            <div className={styles.cardLogoContainer}>
              <img
                  src={`https://github.com/${orgName}.png`}
                  alt={`${repoName} logo`}
                  className={styles.projectLogo}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://github.com/github.png";
                  }}
              />
            </div>

            <div className={styles.cardTitleSection}>
              <div className={styles.titleRow}>
                <div className={styles.titleMain}>
                  <a href={`https://github.com/${repoName}`} target="_blank" rel="noopener noreferrer"
                     style={{textDecoration: 'none', color: 'inherit'}}>
                    <h2 className={styles.cardTitle}>{repoName}</h2>
                  </a>
                  <p className={styles.cardSubtitle}>{repoName}</p>
                  <div className={styles.classification}>{project.classification}</div>
                  <div className={styles.classification}>{project.language}</div>
                </div>
              </div>

              <div className={styles.descriptionRow}>
                <p className={styles.headerDescription}>{project.description || 'No description available'}</p>
              </div>
            </div>
          </div>

          <div className={styles.cardBody}>
            <div className={styles.metricsContainer}>
              <div className={styles.metricItem}>
                <div className={styles.metricIcon}>⭐</div>
                <div className={styles.metricValue}>{formatNumber(project.forks)}</div>
                <div className={styles.metricLabel}>Stars</div>
              </div>

              <div className={styles.metricItem}>
                <div className={styles.metricIcon}>🔱</div>
                <div className={styles.metricValue}>{formatNumber(project.stars)}</div>
                <div className={styles.metricLabel}>Forks</div>
              </div>

              <div className={styles.metricItem}>
                <div className={styles.metricIcon}>🏆</div>
                <div className={styles.metricValue}>{formatNumber(openrankCurYear)}</div>
                <div className={styles.metricLabel}>OpenRank</div>
              </div>

              <div className={styles.metricItem}>
                <div className={styles.metricIcon}>🗓️</div>
                <div className={styles.metricValue}>{formatDate(project.created_at)}</div>
                <div className={styles.metricLabel}>Created</div>
              </div>
            </div>

            {/* OpenRank 趋势图 - 最近半年 */}
            {openrankData.length > 0 && (
                <div className={styles.openrankChartSection}>
                  <h2 className="text-xl font-semibold text-white">OpenRank（近半年）</h2>

                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={openrankData}
                        margin={{top: 5, right: 30, left: 20, bottom: 5}}
                    >
                      <defs>
                        <linearGradient id="colorStarsMain" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#727eff" stopOpacity={0.3}/>
                          <stop offset="25%" stopColor="#727eff" stopOpacity={0.2}/>
                          <stop offset="50%" stopColor="#727eff" stopOpacity={0.15}/>
                          <stop offset="75%" stopColor="#727eff" stopOpacity={0.1}/>
                          <stop offset="100%" stopColor="#727eff" stopOpacity={0.05}/>
                        </linearGradient>
                      </defs>
                      {/*<CartesianGrid strokeDasharray="3 3" stroke="#334155" />*/}
                      <XAxis
                          dataKey="date"
                          stroke="#94a3b8"

                      />
                      <YAxis
                          stroke="#94a3b8"
                          tick={{fill: '#94a3b8'}}
                      />
                      <Tooltip
                          contentStyle={{
                            backgroundColor: '#1e293b',
                            borderColor: '#334155',
                            borderRadius: '0.5rem',
                            color: '#f1f5f9'
                          }}
                          itemStyle={{color: '#f1f5f9'}}
                          labelStyle={{color: '#f1f5f9', fontWeight: 'bold'}}
                          formatter={(value: number) => [value.toLocaleString(), 'OpenRank']}
                      />
                      <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#8090fe"
                          strokeWidth={1}
                          fillOpacity={1}
                          fill="url(#colorStarsMain)"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
            )}



            <div className={styles.contributorsSection}>
            <h3>Top 10 Contributors</h3>
              {loadingContributors ? (
                  <p>Loading contributors...</p>
              ) : contributors.length > 0 ? (
                  <>
                    <div className={styles.contributorHeader}>
                      <span className={styles.contributorHeaderRank}>排名</span>
                      <span className={styles.contributorHeaderInfo}>开发者信息</span>
                      <span className={styles.contributorHeaderMeta}>组织与位置</span>
                      <span className={styles.contributorHeaderOpenrank}>OPENRANK</span>
                    </div>
                    <ul className={styles.contributorList}>
                      {contributors.map((contributor, index) => (
                          <li
                            key={index}
                            className={styles.contributorItem}
                            onClick={() => handleContributorClick(contributor)}
                            style={{ cursor: 'pointer' }}
                          >
                            <span className={styles.contributorRank}>{index + 1}</span>

                            {/* 头像 */}
                            {contributor.avatar_url && (
                                <img
                                    src={contributor.avatar_url}
                                    alt={contributor.actor_login}
                                    className={styles.contributorAvatar}
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            )}

                            <div className={styles.contributorInfo}>
                              {/* 昵称 */}
                              {(contributor.name || contributor.actor_login) && (
                                  <span> {contributor.name || contributor.actor_login}</span>
                              )}

                              {/* 简介 */}
                              {contributor.bio && (
                                  <span className={styles.contributorBio}>{contributor.bio}</span>
                              )}
                            </div>

                            {/* 中间列：位置和公司 */}
                            <div className={styles.contributorMeta}>
                              {contributor.location && (
                                  <span className={styles.contributorMetaItem}>
                            {contributor.location}
                          </span>
                              )}
                              {contributor.company && (
                                  <span className={styles.contributorMetaItem}>
                            {contributor.company}
                          </span>
                              )}
                            </div>
                            <span className={styles.contributorOpenrank}>
                        {formatNumber(contributor.openrank)}
                      </span>
                          </li>
                      ))}
                    </ul>
                  </>
              ) : (
                  <p>No contributor data available</p>
              )}
            </div>

            {/* 版本发布记录 */}
            {releases.length > 0 && (
                <div className={styles.releasesSection}>
                  <h3>版本发布记录</h3>
                  {/* 近期关键特性 - 总结卡片 */}
                  {feature.length > 0 && (
                      <div className={styles.featureSummaryCard}>
                        <div className={styles.featureSummaryHeader}>
                          <span className={styles.featureSummaryIcon}>✨</span>
                          <span>近期关键特性总结</span>
                        </div>
                        <ul className={styles.featureSummaryList}>
                          {feature.map((f, index) => (
                              <MarkdownContent content={f}/>
                          ))}
                        </ul>
                      </div>
                  )}
                  <div className={styles.releaseTimeline}>
                    {releases.map((release, index) => (
                        <div key={release.id} className={styles.releaseCard}>
                          <div className={styles.releaseTimelineConnector}>
                            <div className={styles.releaseTimelineDot}></div>
                            {index < releases.length - 1 && <div className={styles.releaseTimelineLine}></div>}
                          </div>
                          <div className={styles.releaseCardContent}>
                            <div className={styles.releaseCardHeader}>
                              <a
                                  href={release.html_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.releaseVersion}
                              >
                                {release.tag_name}
                              </a>
                              <span className={styles.releaseDate}>
                            {new Date(release.published_at).toLocaleDateString('zh-CN', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                            </div>
                            {release.name && (
                                <div className={styles.releaseTitle}>{release.name}</div>
                            )}
                            <div className={styles.releaseAuthor}>
                              <img
                                  src={release.author.avatar_url}
                                  alt={release.author.login}
                                  className={styles.releaseAuthorAvatar}
                              />
                              <span>{release.author.login}</span>
                            </div>
                            {release.body && (
                                <div className={styles.releaseBody}>
                                  <MarkdownContent content={release.body}/>
                                </div>
                            )}
                          </div>
                        </div>
                    ))}
                  </div>
                </div>
            )}


          </div>
        </div>
      </div>
    </Layout>
  );
}
