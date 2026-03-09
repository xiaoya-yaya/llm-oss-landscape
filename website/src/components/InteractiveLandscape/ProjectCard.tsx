import React from 'react';
import { Project } from './types';
import styles from './styles.module.css';
import { formatNumber, getLanguageColor } from './utils';

interface ProjectCardProps {
  project: Project;
  onClose: () => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onClose }) => {
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown';
    const [year, month, day] = dateString.split('/');
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return `${months[parseInt(month) - 1]} ${day}, ${year}`;
  };

  return (
    <div className={styles.projectCardOverlay}>
      <div className={styles.projectCard}>
        <button className={styles.closeButton} onClick={onClose}>×</button>

        <div className={styles.cardHeader}>
          <div className={styles.cardLogoContainer}>
            <img
              src={`https:/github.com/${project.repo_name.split('/')[0]}.png`}
              alt={`${project.repo_name} logo`}
              className={styles.projectLogo}
              onError={(e) => {
                // Fallback to default image if org logo fails
                (e.target as HTMLImageElement).src = "https://github.com/github.png";
              }}
            />
          </div>

          <div className={styles.cardTitleSection}>
            <h2 className={styles.cardTitle}>{project.repo_name}</h2>
            <p className={styles.cardSubtitle}>{project.repo_name}</p>
            <div className={styles.classification}>{project.classification}</div>
          </div>
        </div>

        <div className={styles.cardBody}>
          <div className={styles.metricsContainer}>
            <div className={styles.metricItem}>
              <div className={styles.metricIcon}>⭐</div>
              <div className={styles.metricValue}>{formatNumber(project.stars)}</div>
              <div className={styles.metricLabel}>Stars</div>
            </div>

            <div className={styles.metricItem}>
              <div className={styles.metricIcon}>🔱</div>
              <div className={styles.metricValue}>{formatNumber(project.forks)}</div>
              <div className={styles.metricLabel}>Forks</div>
            </div>

            <div className={styles.metricItem}>
              <div className={styles.metricIcon}>🏆</div>
              <div className={styles.metricValue}>{project.openrank_25}</div>
              <div className={styles.metricLabel}>OpenRank</div>
            </div>

            <div className={styles.metricItem}>
              <div className={styles.metricIcon}>🗓️</div>
              <div className={styles.metricValue}>{formatDate(project.created_at)}</div>
              <div className={styles.metricLabel}>Created</div>
            </div>
          </div>

          <div className={styles.descriptionSection}>
            <h3>Description</h3>
            <p>{project.description || 'No description available'}</p>
          </div>

          <div className={styles.technicalDetails}>
            <div className={styles.languageBadge} style={{
              backgroundColor: getLanguageColor(project.language),
              color: ['JavaScript', 'CSS', 'HTML'].includes(project.language) ? '#000' : '#fff'
            }}>
              {project.language}
            </div>

            {project.tags && project.tags.length > 0 && (
              <div className={styles.tagContainer}>
                {project.tags.map((tag, index) => (
                  <span key={index} className={styles.tag}>{tag}</span>
                ))}
              </div>
            )}
          </div>

          <div className={styles.cardActions}>
            <a
              href={`https://github.com/${project.repo_name}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.githubLink}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" style={{ marginRight: '5px' }}>
                <path fill="currentColor" d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.207 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.082-.73.082-.73 1.205.085 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12" />
              </svg>
              View on GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
