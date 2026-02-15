import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Loader2, Clock, Calendar, Video, Trash2, RotateCcw, X, Eye, EyeOff, Pencil, Check } from 'lucide-react';
import { authService } from '../services/authService';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';

const LiveArchive = ({ onBack, onWatchArchive, isAdmin }) => {
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [showTrash, setShowTrash] = useState(false);
  const [trashItems, setTrashItems] = useState([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [trashCount, setTrashCount] = useState(0);
  const [actionId, setActionId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const sentinelRef = useRef(null);
  const observerRef = useRef(null);

  const fetchArchive = useCallback(async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) setLoading(true); else setLoadingMore(true);
      const token = authService.getToken();
      const res = await fetch(`${API_URL}/live/archive?page=${pageNum}&per_page=15`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error('err');
      const data = await res.json();
      if (append) setStreams(prev => [...prev, ...data.streams]); else setStreams(data.streams);
      setTotal(data.total); setHasMore(data.streams.length === 15); setPage(pageNum);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setLoadingMore(false); }
  }, []);

  useEffect(() => { fetchArchive(1); }, [fetchArchive]);

  useEffect(() => {
    if (!sentinelRef.current || loading) return;
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) fetchArchive(page + 1, true);
    }, { threshold: 0.1 });
    observerRef.current.observe(sentinelRef.current);
    return () => { if (observerRef.current) observerRef.current.disconnect(); };
  }, [hasMore, loadingMore, page, loading, fetchArchive]);

  const fetchTrash = async () => {
    setTrashLoading(true);
    try {
      const token = authService.getToken();
      const res = await fetch(`${API_URL}/live/trash`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setTrashItems(data.streams); setTrashCount(data.total);
    } catch (e) { console.error(e); }
    finally { setTrashLoading(false); }
  };

  useEffect(() => {
    if (isAdmin) {
      const token = authService.getToken();
      fetch(`${API_URL}/live/trash`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json()).then(d => setTrashCount(d.total || 0)).catch(() => {});
    }
  }, [isAdmin]);

  const handleTrash = async (id) => {
    setActionId(id);
    try {
      const token = authService.getToken();
      const res = await fetch(`${API_URL}/live/delete/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) { setStreams(prev => prev.filter(s => s.id !== id)); setTotal(prev => prev - 1); setTrashCount(prev => prev + 1); }
    } catch (e) { console.error(e); }
    finally { setActionId(null); setConfirmId(null); setConfirmAction(null); }
  };

  const handleRestore = async (id) => {
    setActionId(id);
    try {
      const token = authService.getToken();
      const res = await fetch(`${API_URL}/live/restore/${id}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) { setTrashItems(prev => prev.filter(s => s.id !== id)); setTrashCount(prev => prev - 1); fetchArchive(1); }
    } catch (e) { console.error(e); }
    finally { setActionId(null); setConfirmId(null); setConfirmAction(null); }
  };

  const handlePermanentDelete = async (id) => {
    setActionId(id);
    try {
      const token = authService.getToken();
      const res = await fetch(`${API_URL}/live/permanent-delete/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) { setTrashItems(prev => prev.filter(s => s.id !== id)); setTrashCount(prev => prev - 1); }
    } catch (e) { console.error(e); }
    finally { setActionId(null); setConfirmId(null); setConfirmAction(null); }
  };

  const handleToggleVisibility = async (id) => {
    setActionId(id);
    try {
      const token = authService.getToken();
      const res = await fetch(`${API_URL}/live/toggle-visibility/${id}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setStreams(prev => prev.map(s => s.id === id ? { ...s, is_visible: data.is_visible } : s));
      }
    } catch (e) { console.error(e); }
    finally { setActionId(null); }
  };

  const startEdit = (stream) => { setEditingId(stream.id); setEditTitle(stream.title || ''); };
  const cancelEdit = () => { setEditingId(null); setEditTitle(''); };
  const saveEdit = async (id) => {
    if (!editTitle.trim()) return;
    setEditLoading(true);
    try {
      const token = authService.getToken();
      const res = await fetch(`${API_URL}/live/update/${id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        setStreams(prev => prev.map(s => s.id === id ? { ...s, title: data.title } : s));
        setEditingId(null); setEditTitle('');
      }
    } catch (e) { console.error(e); }
    finally { setEditLoading(false); }
  };

  const formatDuration = (sec) => {
    if (!sec || sec <= 0) return '--';
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };
  const formatDate = (d) => { if(!d) return ''; try { return new Date(d.replace(' ','T')).toLocaleDateString('fa-IR',{month:'short',day:'numeric'}); } catch{return d;} };
  const timeAgo = (d) => { if(!d) return ''; try { const diff=Math.floor((Date.now()-new Date(d.replace(' ','T')).getTime())/86400000); if(diff===0)return'امروز';if(diff===1)return'دیروز';if(diff<7)return`${diff} روز پیش`;return formatDate(d); } catch{return '';} };

  return (
    <div style={{ position:'relative', zIndex:5, display:'flex', flexDirection:'column', height:'100%', direction:'rtl' }}>

      {/* ====== HEADER ====== */}
      <div className="chat-header-glass" style={{ direction: 'rtl' }}>
        <div className="chat-header-info">
          <div className="chat-avatar-glass" style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(99, 102, 241, 0.3))'
          }}>
            <Video size={20} />
          </div>
          <div className="chat-header-text">
            <span className="chat-header-title">لایوهای قبلی</span>
            <span className="chat-header-status">
              {total > 0 ? `${total} لایو ضبط شده` : 'آرشیو لایو استریم‌ها'}
            </span>
          </div>
        </div>
        <button className="chat-back-btn" onClick={onBack}>
          <ArrowLeft size={22} />
        </button>
      </div>

      {/* Admin: trash toggle */}
      {isAdmin && (
        <div style={{ display:'flex', justifyContent:'flex-start', padding:'12px 16px 0', gap: 8 }}>
          <button onClick={()=>{setShowTrash(!showTrash);if(!showTrash)fetchTrash();}} style={{
            display:'flex', alignItems:'center', gap:6,
            padding:'6px 14px', borderRadius:10,
            background: showTrash ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.06)',
            border: showTrash ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.08)',
            color: showTrash ? '#ef4444' : 'rgba(255,255,255,0.5)',
            fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit', transition:'all 0.2s',
          }}>
            <Trash2 size={15} />
            <span>سطل آشغال</span>
            {trashCount > 0 && (
              <span style={{
                background:'#ef4444', color:'white', fontSize:9, fontWeight:700,
                minWidth:16, height:16, borderRadius:8,
                display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px',
              }}>{trashCount}</span>
            )}
          </button>
        </div>
      )}

      {/* ====== TRASH SECTION ====== */}
      {showTrash && isAdmin && (
        <div style={{
          margin:'10px 16px', borderRadius:12, overflow:'hidden',
          background:'rgba(239,68,68,0.04)',
          border:'1px solid rgba(239,68,68,0.1)',
          maxHeight:220, overflowY:'auto',
        }}>
          <div style={{ display:'flex',alignItems:'center',gap:6,padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
            <Trash2 size={13} style={{color:'#ef4444'}} />
            <span style={{ fontSize:12,fontWeight:600,color:'#ef4444',flex:1 }}>سطل آشغال</span>
            <span style={{ fontSize:10,color:'rgba(255,255,255,0.3)' }}>{trashCount} مورد</span>
          </div>
          {trashLoading ? (
            <div style={{padding:20,display:'flex',justifyContent:'center'}}><Loader2 size={18} className="live-spin" style={{color:'rgba(255,255,255,0.2)'}} /></div>
          ) : trashItems.length === 0 ? (
            <div style={{padding:16,textAlign:'center',color:'rgba(255,255,255,0.2)',fontSize:12}}>سطل آشغال خالیست</div>
          ) : trashItems.map(item => (
            <div key={item.id} style={{ display:'flex',alignItems:'center',gap:10,padding:'8px 14px',borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ width:40,height:26,borderRadius:5,overflow:'hidden',background:'rgba(255,255,255,0.05)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center' }}>
                {item.thumbnail_url ? <img src={item.thumbnail_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>e.target.style.display='none'} /> : <Video size={11} style={{opacity:0.2,color:'white'}} />}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{ fontSize:11,fontWeight:500,color:'rgba(255,255,255,0.5)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{item.title}</div>
                <div style={{ fontSize:9,color:'rgba(255,255,255,0.2)' }}>{timeAgo(item.trashed_at)}</div>
              </div>
              {confirmId===item.id&&confirmAction==='permDelete' ? (
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{color:'#ef4444',fontSize:10}}>حذف دائم؟</span>
                  <button onClick={()=>handlePermanentDelete(item.id)} disabled={actionId===item.id} style={{ background:'rgba(239,68,68,0.2)',border:'none',color:'#ef4444',padding:'8px 24px',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',minWidth:50,display:'flex',alignItems:'center',justifyContent:'center' }}>
                    {actionId===item.id?<Loader2 size={11} className="live-spin" />:'حذف'}
                  </button>
                  <button onClick={()=>{setConfirmId(null);setConfirmAction(null);}} style={{ background:'rgba(255,255,255,0.08)',border:'none',color:'rgba(255,255,255,0.5)',padding:'8px 24px',borderRadius:8,fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit' }}>انصراف</button>
                </div>
              ) : (
                <div style={{display:'flex',gap:4}}>
                  <button onClick={()=>handleRestore(item.id)} disabled={actionId===item.id} style={{ background:'rgba(34,197,94,0.1)',border:'none',color:'#22c55e',width:32,height:32,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>
                    {actionId===item.id?<Loader2 size={11} className="live-spin" />:<RotateCcw size={11} />}
                  </button>
                  <button onClick={()=>{setConfirmId(item.id);setConfirmAction('permDelete');}} style={{ background:'rgba(239,68,68,0.1)',border:'none',color:'#ef4444',width:32,height:32,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>
                    <X size={11} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ====== ARCHIVE LIST ====== */}
      <div className="alpha-content-area" style={{ direction:'rtl', paddingTop: showTrash ? '10px' : '16px' }}>
        {loading ? (
          <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'50vh',gap:12 }}>
            <Loader2 size={28} className="live-spin" style={{color:'rgba(139,92,246,0.5)'}} />
            <span style={{color:'rgba(255,255,255,0.3)',fontSize:13}}>در حال بارگذاری...</span>
          </div>
        ) : streams.length === 0 ? (
          <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'50vh',gap:12 }}>
            <Video size={44} style={{color:'rgba(255,255,255,0.08)'}} />
            <span style={{color:'rgba(255,255,255,0.2)',fontSize:13}}>هنوز لایوی ضبط نشده</span>
          </div>
        ) : (
          <>
            {streams.map((stream) => (
              <div key={stream.id} className="gradient-border-br"
                style={{
                  padding:10, marginBottom:10,
                  background: stream.is_visible === false ? 'rgba(0, 0, 0, 0.59)' : 'rgba(255,255,255,0.1)',
                  backdropFilter:'blur(4px)', WebkitBackdropFilter:'blur(4px)',
                  borderRadius:14,
                  border:'1px solid rgba(255, 255, 255, 0.16)',
                  opacity: stream.is_visible === false ? 0.6 : 1,
                  transition: 'opacity 0.2s',
                }}>

                {/* Top row: thumbnail + info */}
                <div
                  onClick={()=>{ if(editingId !== stream.id && stream.has_video!==false) onWatchArchive(stream.id); }}
                  style={{ display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>

                  {/* Thumbnail */}
                  <div style={{
                    width:95, height:60, borderRadius:10, overflow:'hidden', flexShrink:0,
                    background:'rgba(0, 0, 0, 0.47)',
                    border:'1px solid rgba(255, 255, 255, 0.29)',
                  }}>
                    {stream.thumbnail_url ? (
                      <img src={stream.thumbnail_url} alt=""
                        style={{width:'100%',height:'100%',objectFit:'cover'}}
                        onError={e=>{e.target.style.display='none';}} />
                    ) : (
                      <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        <Video size={18} style={{color:'rgba(255, 255, 255, 0.56)'}} />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{flex:1,display:'flex',flexDirection:'column',gap:5,minWidth:0}}>
                    {editingId === stream.id ? (
                      <div style={{display:'flex',alignItems:'center',gap:6}} onClick={e=>e.stopPropagation()}>
                        <input
                          type="text" value={editTitle}
                          onChange={e=>setEditTitle(e.target.value)}
                          onKeyDown={e=>{ if(e.key==='Enter') saveEdit(stream.id); if(e.key==='Escape') cancelEdit(); }}
                          autoFocus
                          style={{
                            flex:1, background:'rgba(255,255,255,0.08)',
                            border:'1px solid rgba(139,92,246,0.3)',
                            borderRadius:8, padding:'5px 10px',
                            color:'white', fontSize:13, fontWeight:500,
                            outline:'none', fontFamily:'inherit',
                          }}
                        />
                        <button onClick={()=>saveEdit(stream.id)} disabled={editLoading}
                          style={{ background:'rgba(34,197,94,0.15)',border:'none',color:'#22c55e',width:34,height:34,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>
                          {editLoading ? <Loader2 size={12} className="live-spin" /> : <Check size={15} />}
                        </button>
                        <button onClick={cancelEdit}
                          style={{ background:'rgba(255,255,255,0.06)',border:'none',color:'rgba(255,255,255,0.4)',width:34,height:34,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <span style={{
                          color:'white',fontSize:13,fontWeight:600,
                          overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap', flex:1,
                        }}>{stream.title||'بدون عنوان'}</span>
                        {stream.is_visible === false && isAdmin && (
                          <span style={{
                            background:'rgba(234,179,8,0.15)', color:'#eab308',
                            fontSize:9, fontWeight:600, padding:'2px 6px', borderRadius:4,
                            flexShrink:0,
                          }}>مخفی</span>
                        )}
                      </div>
                    )}
                    <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                      <div style={{display:'flex',alignItems:'center',gap:4,color:'rgba(255, 255, 255, 0.92)',fontSize:10}}>
                        <Calendar size={10} />
                        <span>{formatDate(stream.started_at)}</span>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:4,color:'rgba(255,255,255,0.92)',fontSize:10}}>
                        <Clock size={10} />
                        <span>{formatDuration(stream.duration)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Admin action buttons */}
                {isAdmin && editingId !== stream.id && (
                  <div style={{
                    display:'flex', alignItems:'center',
                    gap:6, marginTop:8, paddingTop:8,
                    borderTop:'1px solid rgba(255,255,255,0.04)',
                  }}>
                    {confirmId===stream.id&&confirmAction==='trash' ? (
                      <div style={{display:'flex',alignItems:'center',gap:8,direction:'ltr'}}>
                        <span style={{color:'#ef4444',fontSize:11,fontWeight:500}}>حذف شود؟</span>
                        <button onClick={()=>handleTrash(stream.id)} disabled={actionId===stream.id}
                          style={{ background:'rgba(239,68,68,0.2)',border:'none',color:'#ef4444',padding:'8px 24px',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',minWidth:60,display:'flex',alignItems:'center',justifyContent:'center' }}>
                          {actionId===stream.id?<Loader2 size={13} className="live-spin" />:'حذف'}
                        </button>
                        <button onClick={()=>{setConfirmId(null);setConfirmAction(null);}}
                          style={{ background:'rgba(255,255,255,0.08)',border:'none',color:'rgba(255,255,255,0.5)',padding:'8px 24px',borderRadius:8,fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit' }}>
                          انصراف
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Trash */}
                        <button onClick={(e)=>{e.stopPropagation();setConfirmId(stream.id);setConfirmAction('trash');}}
                          style={{
                            background:'rgba(239,68,68,0.08)', border:'none', color:'#ef4444',
                            width:36,height:36,borderRadius:9,
                            display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',
                          }}>
                          <Trash2 size={15} />
                        </button>
                        {/* Edit */}
                        <button onClick={(e)=>{e.stopPropagation();startEdit(stream);}}
                          style={{
                            background:'rgba(139,92,246,0.08)', border:'none', color:'#a78bfa',
                            width:36,height:36,borderRadius:9,
                            display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',
                          }}>
                          <Pencil size={15} />
                        </button>
                        {/* Visibility */}
                        <button onClick={(e)=>{e.stopPropagation();handleToggleVisibility(stream.id);}} disabled={actionId===stream.id}
                          style={{
                            background: stream.is_visible === false ? 'rgba(234,179,8,0.08)' : 'rgba(34,197,94,0.08)',
                            border:'none',
                            color: stream.is_visible === false ? '#eab308' : '#22c55e',
                            width:36,height:36,borderRadius:9,
                            display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',
                          }}>
                          {actionId===stream.id ? <Loader2 size={13} className="live-spin" /> :
                           stream.is_visible === false ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}

            <div ref={sentinelRef} style={{height:1}}>
              {loadingMore && <div style={{display:'flex',justifyContent:'center',padding:16}}><Loader2 size={18} className="live-spin" style={{color:'rgba(139,92,246,0.4)'}} /></div>}
            </div>
          </>
        )}
      </div>

      <style>{`
        .alpha-content-area {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 20px 16px;
          padding-bottom: 120px;
          -webkit-overflow-scrolling: touch;
        }
        .alpha-content-area::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default LiveArchive;