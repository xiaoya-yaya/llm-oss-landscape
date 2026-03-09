import { useMemo, useState, useRef } from 'react';
// @ts-ignore
import Layout from '@theme/Layout';
// @ts-ignore
import styles from './interactive-landscape.module.css';

// Import components
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import ProjectCard from '../components/InteractiveLandscape/ProjectCard';
import { Project } from '../components/InteractiveLandscape/types';
import { formatNumber } from '../components/InteractiveLandscape/utils';
import useData, { getStaticDataUrl } from '../utils/useData';

// Define main category groups and their subcategories
const categoryGroups = [
  {
    name: 'Training',
    categories: ['Pre-train', 'Post-train', 'AI Compiler', 'AI Kernel Library']
  },
  {
    name: 'AI Applications',
    categories: ['Agent Framework - SDK', 'Agent Framework - Workflow', 'General Assistant', 'Coding Assistant', 'Client Inferface', 'Tool use', 'AI Search Engine']
  },
  {
    name: 'AI Infrastructure',
    categories: ['App Framework', 'MLOps', 'API Management', 'Evaluation Platform','Inference Engine', 'Inference Deploy']
  },
  {
    name: 'Data Infrastructure',
    categories: ['Data Integration', 'Distributed Processing', 'Data Labeling', 'Unstructured Data Governance - Catalog', 'Unstructured Data Governance - Lake Format', 'Vector Storage and Search']
  }
];

// Flattened order of classifications for sorting purposes
const categoryOrder = categoryGroups.flatMap(group => group.categories);

// Map group names to gradient colors
const groupColors = {
  'Training': 'linear-gradient(135deg, #3498db, #9b59b6)',
  'AI Applications': 'linear-gradient(135deg, #16a085, #27ae60)',
  'AI Infrastructure': 'linear-gradient(135deg, #2980b9, #2c3e50)',
  'Data Infrastructure': 'linear-gradient(135deg, #8e44ad, #e67e22)'
};

// Map classifications to colors
const categoryColors = {
  'Pre-train': '#3498db',
  'Post-train': '#2ecc71',
  'Inference Engine': '#e74c3c',
  'Inference Deploy': '#f39c12',
  'AI Kernel Library': '#9b59b6',
  'AI Compiler': '#1abc9c',
  'Agent Framework - SDK': '#34495e',
  'Agent Framework - Workflow': '#16a085',
  'App Framework': '#27ae60',
  'MLOps': '#2980b9',
  'Data Integration': '#8e44ad',
  'Distributed Processing': '#c0392b',
  'Evaluation Platform': '#d35400',
  'Data Labeling': '#7f8c8d',
  'Unstructured Data Governance - Catalog': '#2c3e50',
  'Unstructured Data Governance - Lake Format': '#e67e22',
  'Vector Storage and Search': '#95a5a6',
  'API Management': '#f1c40f',
  'Coding Assistant': '#3498db',
  'Client Inferface': '#2ecc71',
  'Tool use': '#e74c3c',
  'General Assistant': '#9b59b6',
  'AI Search Engine': '#1abc9c'
};

// Map to find which group a category belongs to
const categoryToGroup = {};
categoryGroups.forEach(group => {
  group.categories.forEach(category => {
    categoryToGroup[category] = group.name;
  });
});

// ProductHunt-style project card item component
const ProductHuntProjectCard = ({ project, onClick }: { project: Project; onClick: (project: Project) => void }) => {
  const [upvoted, setUpvoted] = useState(false);
  const [downvoted, setDownvoted] = useState(false);
  const [upvotes, setUpvotes] = useState(Math.floor(Math.random() * 50) + 5); // Simulated upvote count
  const [downvotes, setDownvotes] = useState(Math.floor(Math.random() * 20)); // Simulated downvote count
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<string[]>([
    "Great project with impressive performance!",
    "Very active community and good documentation."
  ]);
  const [newComment, setNewComment] = useState('');
  const commentInputRef = useRef<HTMLInputElement>(null);

  const handleUpvote = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!upvoted) {
      setUpvotes(upvotes + 1);
    } else {
      setUpvotes(upvotes - 1);
    }
    setUpvoted(!upvoted);
    if (downvoted) {
      setDownvoted(false);
      setDownvotes(downvotes - 1);
    }
  };

  const handleDownvote = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!downvoted) {
      setDownvotes(downvotes + 1);
    } else {
      setDownvotes(downvotes - 1);
    }
    setDownvoted(!downvoted);
    if (upvoted) {
      setUpvoted(false);
      setUpvotes(upvotes - 1);
    }
  };

  const handleComment = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowComments(!showComments);
    if (!showComments && commentInputRef.current) {
      setTimeout(() => {
        commentInputRef.current?.focus();
      }, 100);
    }
  };

  const submitComment = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (newComment.trim()) {
      setComments([...comments, newComment.trim()]);
      setNewComment('');
    }
  };

  // Handle null or undefined repo_name
  const orgName = project.repo_name ? project.repo_name.split('/')[0] : '';
  const projectName = project.repo_name || 'Unknown Project';

  return (
    <div className={styles.phProjectCard} onClick={() => onClick(project)}>
      <div className={styles.phProjectHeader}>
        <img
          src={orgName ? `https://github.com/${orgName}.png` : "https://github.com/github.png"}
          alt={`${projectName} logo`}
          className={styles.phProjectLogo}
          onError={(e) => {
            // Fallback to default image if org logo fails
            (e.target as HTMLImageElement).src = "https://github.com/github.png";
          }}
        />
        <div className={styles.phProjectInfo}>
          <h3 className={styles.phProjectName}>{projectName}</h3>
          <p className={styles.phProjectDescription}>
            {project.description && project.description.length > 100
              ? project.description.substring(0, 100) + '...'
              : (project.description || 'No description available')}
          </p>
        </div>
      </div>

      <div className={styles.phProjectMeta}>
        <div className={styles.phProjectStats}>
          <div className={styles.phProjectStat}>
            <span className={styles.phStatIcon}>🏆</span>
            <span className={styles.phStatValue}>{formatNumber(parseFloat(project.openrank_25 || '0'))}</span>
          </div>
          <div className={styles.phProjectStat}>
            <span className={styles.phStatIcon}>★</span>
            <span className={styles.phStatValue}>{formatNumber(parseInt(project.stars as string || '0'))}</span>
          </div>
          <span
            className={styles.phProjectCategory}
            style={{ backgroundColor: categoryColors[project.classification] || '#777' }}
          >
            {project.classification}
          </span>
        </div>

        <div className={styles.phProjectActions}>
          <button
            className={`${styles.phActionButton} ${upvoted ? styles.phActionButtonActive : ''}`}
            onClick={handleUpvote}
            title="Upvote"
          >
            <span className={styles.phActionIcon}>▲</span>
            <span className={styles.voteCount}>{upvotes}</span>
          </button>
          <button
            className={`${styles.phActionButton} ${downvoted ? styles.phActionButtonActive : ''}`}
            onClick={handleDownvote}
            title="Downvote"
          >
            <span className={styles.phActionIcon}>▼</span>
            <span className={styles.voteCount}>{downvotes}</span>
          </button>
          <button
            className={`${styles.phActionButton} ${showComments ? styles.phActionButtonActive : ''}`}
            onClick={handleComment}
            title="Comments"
          >
            <span className={styles.phActionIcon}>💬</span>
            <span className={styles.voteCount}>{comments.length}</span>
          </button>
        </div>
      </div>

      {showComments && (
        <div className={styles.commentsSection} onClick={(e) => e.stopPropagation()}>
          <h4 className={styles.commentsTitle}>Comments ({comments.length})</h4>
          <div className={styles.commentsList}>
            {comments.map((comment, index) => (
              <div key={index} className={styles.commentItem}>
                <div className={styles.commentAuthor}>User {index + 1}</div>
                <div className={styles.commentText}>{comment}</div>
              </div>
            ))}
          </div>
          <form onSubmit={submitComment} className={styles.commentForm}>
            <input
              ref={commentInputRef}
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className={styles.commentInput}
            />
            <button type="submit" className={styles.commentSubmit}>Post</button>
          </form>
        </div>
      )}
    </div>
  );
};

export default function InteractiveLandscape(): JSX.Element {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeCategoryGroup, setActiveCategoryGroup] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const {data, loading } = useData<Project[]>({url: getStaticDataUrl('20250501-OpenSourceAI-Landscape/landscape.csv'), type: 'csv'})
  const projects = data || [];

  // Filter projects based on search term and active category
  const filteredProjects = useMemo(() => {
    let filtered = projects;

    // Apply search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(project =>
        project.repo_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.classification.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply category filter
    if (activeCategory) {
      filtered = filtered.filter(p => p.classification === activeCategory);
    }

    // Sort by OpenRank (highest first)
    return filtered.sort((a, b) => {
      const openrankA = parseFloat(a.openrank_25 as string) || 0;
      const openrankB = parseFloat(b.openrank_25 as string) || 0;
      return openrankB - openrankA;
    });
  }, [projects, searchTerm, activeCategory]);

  const handleCategoryClick = (category: string) => {
    setActiveCategory(activeCategory === category ? null : category);
  };

  const handleCategoryGroupClick = (groupName: string) => {
    setActiveCategoryGroup(activeCategoryGroup === groupName ? null : groupName);
  };

  // Get all categories that have projects
  const availableCategories = useMemo(() => {
    const categories = [...new Set(projects.map(p => p.classification))];
    // Sort categories according to the predefined order
    return categories.sort((a, b) => {
      const indexA = categoryOrder.indexOf(a);
      const indexB = categoryOrder.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [projects]);

  // Group categories by their parent group
  const categoriesByGroup = useMemo(() => {
    const result = {};

    availableCategories.forEach(category => {
      const group = categoryToGroup[category] || 'Other';
      if (!result[group]) {
        result[group] = [];
      }
      result[group].push(category);
    });

    return result;
  }, [availableCategories]);

  // Sort groups in the defined order
  const sortedGroups = useMemo(() => {
    const groupNames = Object.keys(categoriesByGroup);
    return categoryGroups
      .map(group => group.name)
      .filter(name => groupNames.includes(name))
      .concat(groupNames.filter(name => !categoryGroups.some(g => g.name === name)));
  }, [categoriesByGroup]);

  // Handle project selection
  const handleProjectClick = (project: Project) => {
    setSelectedProject(project);
  };

  // Close detailed card
  const handleCloseCard = () => {
    setSelectedProject(null);
  };

  return (
    <Layout
      title="Open Source AI Landscape"
      description="Interactive visualization of the Open Source AI landscape">
      <DndProvider backend={HTML5Backend}>
        <div className={styles.pageContainer}>
          <div className={styles.header}>
            <h1>Open Source AI Interactive Landscape</h1>
            <p>Explore the AI open source ecosystem with this interactive visualization</p>

            <div className={styles.searchContainer}>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search projects, categories, or descriptions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  className={styles.clearSearch}
                  onClick={() => setSearchTerm('')}
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Hierarchical Category Filter */}
          <div className={styles.categoriesHierarchy}>
            {sortedGroups.map(groupName => (
              <div key={groupName} className={styles.categoryGroup}>
                <button
                  className={`${styles.categoryGroupButton} ${activeCategoryGroup === groupName ? styles.categoryGroupButtonActive : ''}`}
                  onClick={() => handleCategoryGroupClick(groupName)}
                >
                  {groupName}
                  <span className={styles.categoryGroupIcon}>
                    {activeCategoryGroup === groupName ? '▼' : '▶'}
                  </span>
                </button>

                {activeCategoryGroup === groupName && (
                  <div className={styles.categoryItems}>
                    {categoriesByGroup[groupName]?.map(category => (
                      <button
                        key={category}
                        onClick={() => handleCategoryClick(category)}
                        className={`${styles.categoryItem} ${activeCategory === category ? styles.categoryItemActive : ''}`}
                        style={{
                          borderColor: categoryColors[category] || '#ddd'
                        }}
                      >
                        {category}
                        <span
                          className={styles.categoryColorDot}
                          style={{ backgroundColor: categoryColors[category] || '#777' }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {activeCategory && (
              <button
                className={styles.clearFilters}
                onClick={() => setActiveCategory(null)}
              >
                Clear Filter
              </button>
            )}
          </div>

          {loading ? (
            <div className={styles.loading}>Loading landscape data...</div>
          ) : filteredProjects.length > 0 ? (
            <div className={styles.phProjectsGrid}>
              {filteredProjects.map((project) => (
                <ProductHuntProjectCard
                  key={project.repo_id}
                  project={project}
                  onClick={handleProjectClick}
                />
              ))}
            </div>
          ) : (
            <div className={styles.noResults}>No projects match your search criteria</div>
          )}
        </div>

        {/* Show detailed project card when a project is selected */}
        {selectedProject && (
          <ProjectCard
            project={selectedProject}
            onClose={handleCloseCard}
          />
        )}
      </DndProvider>
    </Layout>
  );
}
