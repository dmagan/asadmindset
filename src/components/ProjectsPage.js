import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOpen, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ProjectCard from './ProjectCard';
import ProjectDetail from './ProjectDetail';
import { authService } from '../services/authService';


const ProjectsPage = () => {
  const { t } = useTranslation();
  const { isLoggedIn } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);

  useEffect(() => {
    if (isLoggedIn) {
      fetchProjects();
    } else {
      setLoading(false);
    }
  }, [isLoggedIn]);

const fetchProjects = async () => {
  try {
    const data = await authService.getMyOrders();
    setProjects(data);
    setLoading(false);
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    setLoading(false);
  }
};

  const handleProjectClick = (project) => {
    setSelectedProject(project);
  };

  const handleBack = () => {
    setSelectedProject(null);
  };

  // Show project detail if selected
  if (selectedProject) {
    return <ProjectDetail project={selectedProject} onBack={handleBack} />;
  }

  return (
    <div className="projects-page">
      <div className="projects-header">
        <h2 className="projects-title">
          <FolderOpen size={24} />
          {t('myProjects', 'My Projects')}
        </h2>
      </div>

      {loading ? (
        <div className="projects-loading">
          <Loader size={32} className="spin" />
          <span>{t('loading', 'Loading...')}</span>
        </div>
      ) : !isLoggedIn ? (
        <div className="projects-empty">
          <FolderOpen size={48} strokeWidth={1.5} />
          <p>{t('loginToSeeProjects', 'Please login to see your projects')}</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="projects-empty">
          <FolderOpen size={48} strokeWidth={1.5} />
          <p>{t('noProjects', 'No projects yet')}</p>
          <span>{t('noProjectsDesc', 'Your orders will appear here')}</span>
        </div>
      ) : (
        <div className="projects-list">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => handleProjectClick(project)}
            />
          ))}
        </div>
      )}

      <style>{`
        .projects-page {
  padding: 20px;
  padding-bottom: 100px;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  margin: 16px;
}

        .projects-header {
          margin-bottom: 20px;
        }

        .projects-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 22px;
          font-weight: 700;
          color: white;
          margin: 0;
        }

        .projects-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 60px 20px;
          color: rgba(255, 255, 255, 0.5);
        }

        .projects-loading .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .projects-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 60px 20px;
          text-align: center;
          color: rgba(255, 255, 255, 0.4);
        }

        .projects-empty p {
          margin: 0;
          font-size: 16px;
          color: rgba(255, 255, 255, 0.6);
        }

        .projects-empty span {
          font-size: 14px;
        }

        .projects-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
      `}</style>
    </div>
  );
};

export default ProjectsPage;
