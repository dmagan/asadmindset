import React from 'react';
import { useTranslation } from 'react-i18next';
import { Film, ChevronRight, Calendar, Clock } from 'lucide-react';

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    labelDe: 'Ausstehend',
    color: '#eab308',
    bg: 'rgba(234, 179, 8, 0.15)'
  },
  need_info: {
    label: 'Need Info',
    labelDe: 'Info benötigt',
    color: '#f97316',
    bg: 'rgba(249, 115, 22, 0.15)'
  },
  in_progress: {
    label: 'In Progress',
    labelDe: 'In Bearbeitung',
    color: '#3b82f6',
    bg: 'rgba(59, 130, 246, 0.15)'
  },
  revision: {
    label: 'Revision',
    labelDe: 'Überarbeitung',
    color: '#a855f7',
    bg: 'rgba(168, 85, 247, 0.15)'
  },
  completed: {
    label: 'Completed',
    labelDe: 'Abgeschlossen',
    color: '#22c55e',
    bg: 'rgba(34, 197, 94, 0.15)'
  },
  delivered: {
    label: 'Delivered',
    labelDe: 'Geliefert',
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.15)'
  }
};

const ProjectCard = ({ project, onClick }) => {
  const { t, i18n } = useTranslation();
  const status = STATUS_CONFIG[project.status] || STATUS_CONFIG.pending;
  const isGerman = i18n.language === 'de';

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(isGerman ? 'de-DE' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="project-card" onClick={onClick}>
      <div className="project-thumbnail">
        {project.thumbnail ? (
          <img src={project.thumbnail} alt="Project" />
        ) : (
          <div className="thumbnail-placeholder">
            <Film size={24} />
          </div>
        )}
        <span className="video-count">{project.videoCount} {project.videoCount === 1 ? 'video' : 'videos'}</span>
      </div>

      <div className="project-info">
        <div className="project-style">{project.style}</div>
        
        <div className="project-meta">
          <span className="project-date">
            <Calendar size={14} />
            {formatDate(project.createdAt)}
          </span>
          <span className="project-delivery">
            <Clock size={14} />
            {project.deliveryTime}
          </span>
        </div>

        <div className="project-bottom">
          <span 
            className="project-status"
            style={{ 
              color: status.color,
              background: status.bg
            }}
          >
            {isGerman ? status.labelDe : status.label}
          </span>
          <span className="project-price">${project.total}</span>
        </div>
      </div>

      <ChevronRight size={20} className="project-arrow" />

      <style>{`
       .project-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .project-card:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.15);
        }

        .project-card:active {
          transform: scale(0.98);
        }

        .project-thumbnail {
          position: relative;
          width: 72px;
          height: 72px;
          border-radius: 12px;
          overflow: hidden;
          flex-shrink: 0;
        }

        .project-thumbnail img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .thumbnail-placeholder {
          width: 100%;
          height: 100%;
          background: rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.4);
        }

        .video-count {
          position: absolute;
          bottom: 4px;
          left: 4px;
          padding: 2px 6px;
          background: rgba(0, 0, 0, 0.7);
          border-radius: 6px;
          font-size: 10px;
          color: white;
          font-weight: 500;
        }

        .project-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .project-style {
          font-size: 15px;
          font-weight: 600;
          color: white;
        }

        .project-meta {
          display: flex;
          gap: 12px;
        }

        .project-date,
        .project-delivery {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }

        .project-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 2px;
        }

        .project-status {
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 600;
        }

        .project-price {
          font-size: 15px;
          font-weight: 700;
          color: #10b981;
        }

        .project-arrow {
          color: rgba(255, 255, 255, 0.3);
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
};

export default ProjectCard;
