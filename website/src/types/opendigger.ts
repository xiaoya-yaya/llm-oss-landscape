export type OrganizationLogin = `${string}`;
export type RepositoryFullName = `${string}/${string}`;
export type DeveloperLogin = `${string}`;


/**
 * OpenDigger 指标分类枚举
 */
export enum MetricCategory {
  /** 组织指标 (目前没有组织维度的指标) */
  ORGANIZATION = 'organization',
  /** 仓库指标 */
  REPOSITORY = 'repository',
  /** 开发者指标 */
  DEVELOPER = 'developer',
}

/**
 * OpenDigger 仓库指标类型枚举
 * @see https://open-digger.cn/docs/user_docs/intro
 * @see https://github.com/X-lab2017/open-digger?tab=readme-ov-file#for-repos
 */
export enum RepositoryMetricType {
  // 核心指标
  OPENRANK = 'openrank',
  ACTIVITY = 'activity',
  // 贡献者相关
  PARTICIPANTS = 'participants',
  CONTRIBUTORS = 'contributors',
  // GitHub 相关
  STARS = 'stars',
  TECHNICAL_FORK = 'technical_fork',
  ISSUE_NEW = 'issue_new',
  ISSUE_CLOSED = 'issue_closed',
  ISSUE_COMMENTS = 'issue_comments',
  CHANGE_REQUESTS = 'change_requests',
  CHANGE_REQUESTS_ACCEPTED = 'change_requests_accepted',
  CHANGE_REQUESTS_REVIEWS = 'change_requests_reviews',
  CODE_CHANGE_LINES_ADD = 'code_change_lines_add',
  CODE_CHANGE_LINES_REMOVE = 'code_change_lines_remove',
}

export const repositoryMetricLabelMap = {
  [RepositoryMetricType.OPENRANK]: 'OpenRank',
  [RepositoryMetricType.ACTIVITY]: 'Activity',
  [RepositoryMetricType.PARTICIPANTS]: 'Participants',
  [RepositoryMetricType.CONTRIBUTORS]: 'Contributors',
  [RepositoryMetricType.STARS]: 'Stars',
  [RepositoryMetricType.TECHNICAL_FORK]: 'Technical Fork',
  [RepositoryMetricType.ISSUE_NEW]: 'Issue New',
  [RepositoryMetricType.ISSUE_CLOSED]: 'Issue Closed',
  [RepositoryMetricType.ISSUE_COMMENTS]: 'Issue Comments',
  [RepositoryMetricType.CHANGE_REQUESTS]: 'Change Requests',
  [RepositoryMetricType.CHANGE_REQUESTS_ACCEPTED]: 'Change Requests Accepted',
  [RepositoryMetricType.CHANGE_REQUESTS_REVIEWS]: 'Change Requests Reviews',
  [RepositoryMetricType.CODE_CHANGE_LINES_ADD]: 'Code Change Lines Add',
  [RepositoryMetricType.CODE_CHANGE_LINES_REMOVE]: 'Code Change Lines Remove',
}

/**
 * OpenDigger 开发者指标类型枚举
 * @see https://open-digger.cn/docs/user_docs/intro
 * @see https://github.com/X-lab2017/open-digger?tab=readme-ov-file#for-users
 */
export enum DeveloperMetricType {
  OPENRANK = 'openrank',
  ACTIVITY = 'activity'
}

export enum TimeUnit {
  YEAR = 'year',
  QUARTER = 'quarter',
  MONTH = 'month',
}

export type YearKey = `${number}`;
export type YearMonthKey = `${number}-${number}`;
export type YearMonthRawKey = `${number}-${number}-raw`;
export type YearQuarterKey = `${number}Q${number}`;
export type TimeKey = YearKey | YearMonthKey | YearQuarterKey;
/**
 * OpenDigger 指标数据结构
 * @example
 * {
 *   "2021": 10.2,
 *   "2024-01": 10.4,
 *   "2021-10-raw": 10.3,
 *   "2021Q1": 30.2,
 * }
 * @see https://oss.open-digger.cn/github/hypertrons/hypertrons-crx/participants.json
 */
export type MetricData = Record<YearKey | YearMonthKey | YearMonthRawKey | YearQuarterKey, number>;
