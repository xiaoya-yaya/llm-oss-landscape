import React from 'react';
import { useDrop } from 'react-dnd';
import { Project } from './types';
import ProjectItem from './ProjectItem';
import styles from './styles.module.css';

interface ProjectGridProps {
  projects: Project[];
  onProjectClick: (project: Project) => void;
  gridLayout?: 'compact' | 'standard' | 'comfortable';
}

const ProjectGrid: React.FC<ProjectGridProps> = ({
  projects,
  onProjectClick,
  gridLayout = 'standard'
}) => {
  // Setup drag and drop functionality
  const [, drop] = useDrop(() => ({
    accept: 'project',
    drop: () => ({ name: 'ProjectGrid' }),
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }));

  // Determine grid class based on layout preference
  const gridClass = gridLayout === 'compact'
    ? styles.projectGridCompact
    : gridLayout === 'comfortable'
      ? styles.projectGridComfortable
      : styles.projectGrid;

  return (
    <div ref={drop} className={gridClass}>
      {projects.map((project) => (
        <ProjectItem
          key={project.id || project.repo_id}
          project={project}
          onClick={onProjectClick}
        />
      ))}
    </div>
  );
};

export default ProjectGrid;
