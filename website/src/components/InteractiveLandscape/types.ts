export interface Project {
  repo_id: string;                // 仓库ID
  repo_name: string;              // 仓库全名（owner/repo）
  classification: string;         // 项目分类
  stars: string;                  // star数
  forks: string;                  // fork数
  openrank_25: string;            // openrank分数
  language: string;               // 主要编程语言
  created_at: string;             // 创建时间（YYYY/MM/DD）
  description: string;            // 项目描述
  id?: string;                    // 唯一标识
  name?: string;                  // 项目名称
  displayName?: string;           // 显示名称
  logo?: string;                  // logo URL
  fallbackLogo?: string;          // 备用logo URL
  size?: {
    width: number;
    height: number;
  };
  upvotes?: number;               // 点赞数
  downvotes?: number;             // 踩数
  comments?: Comment[];           // 评论
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  date: Date;
}

export interface Category {
  id: string;
  name: string;
  projects: Project[];
}

export interface DragItem {
  type: string;
  id: string;
  projectId: string;
  index: number;
}
