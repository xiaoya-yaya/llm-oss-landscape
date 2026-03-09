import React from 'react';
import { useDrag } from 'react-dnd';
import { Project } from './types';
import styles from './styles.module.css';
import { getLanguageColor, formatNumber } from './utils';

interface ProjectItemProps {
  project: Project;
  onClick: (project: Project) => void;
}

const ProjectItem: React.FC<ProjectItemProps> = ({ project, onClick }) => {
  // Setup drag functionality
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'project',
    item: { id: project.id, type: 'project' },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  // Get repo name parts to construct proper display
  const orgName = project.repo_name ? project.repo_name.split('/')[0] : '';
  const repoName = project.repo_name ? project.repo_name.split('/')[1] : '';
  const displayName = project.displayName || repoName || 'Unknown Project';

  // Construct logo URL
  const logoUrl = project.logo || (orgName ? `https:/github.com/${orgName}.png` : "https://github.com/github.png");
  const fallbackLogo = project.fallbackLogo || "https://github.com/github.png";

  // Get numerical values for display
  const openRank = parseFloat(project.openrank_25 || '0');
  const stars = parseInt(project.stars as string || '0');

  return (
    <div
      ref={drag}
      className={styles.projectItem}
      onClick={() => onClick(project)}
      style={{
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <div className={styles.projectContent}>
        <div className={styles.logoContainer}>
          <img
            src={logoUrl}
            alt={`${displayName} logo`}
            className={styles.projectLogo}
            onError={(e) => {
              (e.target as HTMLImageElement).src = fallbackLogo;
            }}
          />
        </div>
        <div className={styles.projectName}>{displayName}</div>

        <div className={styles.projectMetrics}>
          <div className={styles.projectMetric} title="OpenRank">
            <span className={styles.metricIcon}>🏆</span>
            <span className={styles.metricValue}>{formatNumber(openRank)}</span>
          </div>
          <div className={styles.projectMetric} title="Stars">
            <span className={styles.metricIcon}>★</span>
            <span className={styles.metricValue}>{formatNumber(stars)}</span>
          </div>
        </div>

        <div
          className={styles.languageIndicator}
          style={{ backgroundColor: getLanguageColor(project.language) }}
          title={project.language}
        />
      </div>
    </div>
  );
};

export default ProjectItem;
