import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Loader2,
  Play,
  Clock,
  Users,
  Calendar,
  Video,
  Trash2,
  Check,
  X,
  ChevronLeft
} from 'lucide-react';
import { authService } from '../services/authService';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';

const LiveArchive = ({ onBack, onWatchArchive, isAdmin }) => {
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // ==========================================
  // Fetch archive
  // ==========================================
  const fetchArchive = useCallback(async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const token = authService.getToken();
      const res = await fetch(`${API_URL}/live/archive?page=${pageNum}&per_page=15`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('خطا در دریافت آرشیو');

      const data = await res.json();

      if (append) {
        setStreams(prev => [...prev, ...data.streams]);
      } else {
        setStreams(data.streams);
      }

      setTotal(data.total);
      setHasMore(data.streams.length === data.per_page);
      setPage(pageNum);
    } catch (e) {
      console.error('Fetch archive error:', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchArchive(1);
  }, [fetchArchive]);

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    fetchArchive(page + 1, true);
  };

  // ==========================================
  // Delete
  // ==========================================
  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      const token = authService.getToken();
      const res = await fetch(`${API_URL}/live/delete/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setStreams(prev => prev.filter(s => s.id !== id));
        setTotal(prev => prev - 1);
      }
    } catch (e) {
      console.error('Delete error:', e);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  // ==========================================
  // Format helpers
  // ==========================================
  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr.replace(' ', 'T'));
      return date.toLocaleDateString('fa-IR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr.replace(' ', 'T'));
      return date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // ==========================================
  // Render
  // ==========================================
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={22} />
        </button>
        <div style={styles.headerCenter}>
          <Video size={18} style={{ color: 'rgba(255,255,255,0.5)' }} />
          <span style={styles.headerTitle}>لایوهای قبلی</span>
          {total > 0 && (
            <span style={styles.totalBadge}>{total}</span>
          )}
        </div>
        <div style={{ width: 38 }} />
      </div>

      {/* Content */}
      <div style={styles.scrollArea}>
        {loading ? (
          <div style={styles.center}>
            <Loader2 size={28} className="live-spin" />
            <span style={styles.loadingText}>در حال بارگذاری...</span>
          </div>
        ) : streams.length === 0 ? (
          <div style={styles.center}>
            <Video size={40} style={{ color: 'rgba(255,255,255,0.15)' }} />
            <span style={styles.emptyText}>هنوز لایوی ضبط نشده</span>
          </div>
        ) : (
          <>
            {streams.map((stream) => (
              <div key={stream.id} style={styles.card}>
                {/* Thumbnail / Play area */}
                <div
                  style={styles.cardThumb}
                  onClick={() => onWatchArchive(stream.id)}
                >
                  {stream.thumbnail_url ? (
                    <img
                      src={stream.thumbnail_url}
                      alt=""
                      style={styles.thumbImg}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div style={styles.thumbPlaceholder}>
                      <Video size={24} />
                    </div>
                  )}
                  <div style={styles.playOverlay}>
                    <div style={styles.playCircle}>
                      <Play size={20} fill="white" />
                    </div>
                  </div>
                  {stream.duration > 0 && (
                    <span style={styles.durationBadge}>
                      {formatDuration(stream.duration)}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div style={styles.cardInfo}>
                  <div style={styles.cardTitleRow}>
                    <span
                      style={styles.cardTitle}
                      onClick={() => onWatchArchive(stream.id)}
                    >
                      {stream.title}
                    </span>
                    {isAdmin && (
                      <div style={styles.deleteArea}>
                        {confirmDeleteId === stream.id ? (
                          <div style={styles.deleteConfirm}>
                            <button
                              style={styles.deleteYes}
                              onClick={() => handleDelete(stream.id)}
                              disabled={deletingId === stream.id}
                            >
                              {deletingId === stream.id ? (
                                <Loader2 size={12} className="live-spin" />
                              ) : (
                                <Check size={12} />
                              )}
                            </button>
                            <button
                              style={styles.deleteNo}
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            style={styles.deleteBtn}
                            onClick={() => setConfirmDeleteId(stream.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={styles.cardMeta}>
                    <div style={styles.metaItem}>
                      <Calendar size={12} />
                      <span>{formatDate(stream.started_at || stream.created_at)}</span>
                    </div>
                    {stream.started_at && (
                      <div style={styles.metaItem}>
                        <Clock size={12} />
                        <span>{formatTime(stream.started_at)}</span>
                      </div>
                    )}
                    <div style={styles.metaItem}>
                      <Users size={12} />
                      <span>{stream.max_viewers || 0}</span>
                    </div>
                  </div>

                  {stream.description && (
                    <p style={styles.cardDesc}>{stream.description}</p>
                  )}

                  {!stream.has_video && (
                    <span style={styles.noVideo}>ویدیو هنوز آماده نشده</span>
                  )}
                </div>
              </div>
            ))}

            {/* Load More */}
            {hasMore && (
              <button
                style={styles.loadMoreBtn}
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <Loader2 size={16} className="live-spin" />
                ) : (
                  <ChevronLeft size={16} />
                )}
                <span>{loadingMore ? 'در حال بارگذاری...' : 'بیشتر'}</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ==========================================
// Styles
// ==========================================
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    overflow: 'hidden',
    background: '#0a0a0a',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    paddingTop: 'max(12px, env(safe-area-inset-top))',
    background: 'rgba(255, 255, 255, 0.06)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    flexShrink: 0,
    zIndex: 20,
  },
  backBtn: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    color: 'white',
    width: 36,
    height: 36,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  headerCenter: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 600,
  },
  totalBadge: {
    background: 'rgba(255, 255, 255, 0.1)',
    color: 'rgba(255, 255, 255, 0.5)',
    padding: '2px 8px',
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 500,
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 14px',
    paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    WebkitOverflowScrolling: 'touch',
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '60vh',
    gap: 12,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 13,
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 14,
    marginTop: 8,
  },

  // Card
  card: {
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    overflow: 'hidden',
    transition: 'all 0.2s',
  },
  cardThumb: {
    position: 'relative',
    width: '100%',
    aspectRatio: '16/9',
    background: 'rgba(0, 0, 0, 0.4)',
    cursor: 'pointer',
    overflow: 'hidden',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  thumbPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255, 255, 255, 0.1)',
  },
  playOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.25)',
    transition: 'background 0.2s',
  },
  playCircle: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: 'rgba(99, 102, 241, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    background: 'rgba(0, 0, 0, 0.75)',
    color: 'white',
    padding: '2px 8px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'monospace',
  },
  cardInfo: {
    padding: '10px 14px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    direction: 'rtl',
  },
  cardTitleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: 600,
    flex: 1,
    cursor: 'pointer',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 11,
  },
  cardDesc: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
    lineHeight: 1.5,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  noVideo: {
    color: 'rgba(234, 179, 8, 0.6)',
    fontSize: 11,
    fontStyle: 'italic',
  },
  deleteArea: {
    flexShrink: 0,
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.2)',
    padding: 4,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  deleteConfirm: {
    display: 'flex',
    gap: 4,
  },
  deleteYes: {
    background: 'rgba(239, 68, 68, 0.2)',
    border: 'none',
    color: '#ef4444',
    width: 26,
    height: 26,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  deleteNo: {
    background: 'rgba(255, 255, 255, 0.08)',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.4)',
    width: 26,
    height: 26,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  loadMoreBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '10px',
    borderRadius: 10,
    border: '1px solid rgba(255, 255, 255, 0.08)',
    background: 'rgba(255, 255, 255, 0.03)',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

export default LiveArchive;