import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Search, 
  MessageSquare,
  Users,
  User,
  Loader2,
  Plus,
  X,
  Check,
  Hash,
  ChevronLeft
} from 'lucide-react';
import Pusher from 'pusher-js';
import { authService } from '../services/authService';
import useOnlineStatus from '../hooks/useOnlineStatus';
import { formatConvTime } from '../utils/dateUtils';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';
const PUSHER_KEY = '71815fd9e2b90f89a57b';
const PUSHER_CLUSTER = 'eu';

// Extract user ID from JWT token
const getUserIdFromToken = () => {
  try {
    const token = authService.getToken();
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return parseInt(payload?.data?.user?.id);
  } catch (e) { return null; }
};

const TeamConversations = ({ onBack, onSelectConversation }) => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState('direct');
  const [groupName, setGroupName] = useState('');
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [creating, setCreating] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  
  const currentUser = authService.getUser();
  const currentUserId = getUserIdFromToken();

  // Collect DM partner IDs for online status
  const dmPartnerIds = conversations
    .filter(c => c.type === 'direct')
    .map(c => c.members?.find(m => m.userId !== currentUserId)?.userId)
    .filter(Boolean);
  const onlineStatuses = useOnlineStatus(dmPartnerIds);
  const pusherRef = useRef(null);
  const channelRef = useRef(null);

  useEffect(() => { fetchConversations(); }, []);

  // Pusher: listen for new team messages on personal channel
  useEffect(() => {
    if (!currentUserId) return;
    
    pusherRef.current = new Pusher(PUSHER_KEY, { cluster: PUSHER_CLUSTER, forceTLS: true });
    channelRef.current = pusherRef.current.subscribe(`team-user-${currentUserId}`);
    
    // When a new team message arrives, update conversation list
    channelRef.current.bind('new-team-message', (data) => {
      setConversations(prev => {
        const updated = prev.map(conv => {
          if (conv.id === data.conversationId) {
            return {
              ...conv,
              lastMessage: data.message?.content || conv.lastMessage,
              lastMessageType: data.message?.type || conv.lastMessageType,
              lastMessageSenderId: data.message?.senderId,
              lastMessageSenderName: data.message?.senderName,
              lastMessageAt: data.message?.createdAt || new Date().toISOString(),
              unreadCount: (conv.unreadCount || 0) + 1,
            };
          }
          return conv;
        });
        // Sort by last message time (newest first)
        return updated.sort((a, b) => {
          const ta = a.lastMessageAt ? new Date(a.lastMessageAt) : new Date(a.createdAt);
          const tb = b.lastMessageAt ? new Date(b.lastMessageAt) : new Date(b.createdAt);
          return tb - ta;
        });
      });
    });
    
    // When a new conversation is created that includes this user
    channelRef.current.bind('new-conversation', () => {
      fetchConversations();
    });
    
    return () => {
      if (channelRef.current) channelRef.current.unbind_all();
      if (pusherRef.current) pusherRef.current.disconnect();
    };
  }, [currentUserId]);

  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) { document.body.style.position = 'fixed'; document.body.style.width = '100%'; document.body.style.height = '100%'; }
    return () => { if (isMobile) { document.body.style.position = ''; document.body.style.width = ''; document.body.style.height = ''; } };
  }, []);

  const fetchConversations = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const token = authService.getToken();
      const res = await fetch(`${API_URL}/team/conversations`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed');
      setConversations(await res.json());
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchTeamMembers = async () => {
    setLoadingMembers(true);
    try {
      const token = authService.getToken();
      const res = await fetch(`${API_URL}/team/members`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed');
      setTeamMembers((await res.json()).filter(m => m.userId !== currentUserId));
    } catch (e) { console.error(e); } finally { setLoadingMembers(false); }
  };

  const openCreateModal = (type) => {
    setCreateType(type); setShowCreateModal(true); setSelectedMembers([]); setGroupName(''); setMemberSearch('');
    fetchTeamMembers();
  };

  const toggleMember = (member) => {
    setSelectedMembers(prev => {
      const exists = prev.find(m => m.userId === member.userId);
      if (exists) return prev.filter(m => m.userId !== member.userId);
      if (createType === 'direct') return [member];
      return [...prev, member];
    });
  };

  const handleCreate = async () => {
    if (selectedMembers.length === 0) return;
    if (createType === 'group' && !groupName.trim()) return;
    setCreating(true);
    try {
      const token = authService.getToken();
      const body = { type: createType, memberIds: selectedMembers.map(m => m.userId) };
      if (createType === 'group') body.name = groupName.trim();
      const res = await fetch(`${API_URL}/team/conversations`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setShowCreateModal(false);
      onSelectConversation(data.id);
    } catch (e) { console.error(e); } finally { setCreating(false); }
  };

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const name = conv.type === 'direct' ? conv.displayName : conv.name;
    return name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredMembers = teamMembers.filter(m => {
    if (!memberSearch) return true;
    return m.displayName?.toLowerCase().includes(memberSearch.toLowerCase()) || m.email?.toLowerCase().includes(memberSearch.toLowerCase());
  });

  const formatTime = (dateString) => {
    return formatConvTime(dateString);
  };

  const getLastMessagePreview = (conv) => {
    if (!conv.lastMessage) return 'بدون پیام';
    if (conv.lastMessageType === 'voice') return '🎤 پیام صوتی';
    if (conv.lastMessageType === 'image') return '🖼 تصویر';
    if (conv.lastMessageType === 'video') return '🎬 ویدیو';
    const senderPrefix = conv.lastMessageSenderId === currentUserId 
      ? 'شما: ' : (conv.type === 'group' ? `${conv.lastMessageSenderName}: ` : '');
    return senderPrefix + conv.lastMessage;
  };

  return (
    <div className="tc-container">
      {/* Header */}
      <div className="tc-header">
        <button className="tc-back-btn" onClick={onBack}>
          <ArrowLeft size={22} />
        </button>
        <div className="tc-header-right">
          <div className="tc-header-text">
            <span className="tc-header-title">چت تیمی</span>
            <span className="tc-header-subtitle">{conversations.length} گفتگو</span>
          </div>
          <div className="tc-header-avatar">
            <Users size={22} />
          </div>
        </div>
      </div>

      {/* Search + Actions */}
      <div className="tc-filters">
        <div className="tc-search">
          <Search size={18} />
          <input type="text" placeholder="جستجو..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <div className="tc-actions">
          <button className="tc-action-btn" onClick={() => openCreateModal('direct')}>
            <User size={16} />
            <span>چت جدید</span>
          </button>
          <button className="tc-action-btn tc-action-btn-green" onClick={() => openCreateModal('group')}>
            <Users size={16} />
            <span>گروه جدید</span>
          </button>
        </div>
      </div>

      {/* List */}
      <div className="tc-list">
        {loading ? (
          <div className="tc-loading"><Loader2 size={32} className="tc-spin" /><span>در حال بارگذاری...</span></div>
        ) : filteredConversations.length === 0 ? (
          <div className="tc-empty">
            <Users size={48} />
            <h3>چت تیمی</h3>
            <p>با اعضای تیم خود ارتباط برقرار کنید</p>
            <button className="tc-empty-btn" onClick={() => openCreateModal('direct')}>
              <Plus size={18} />شروع گفتگو
            </button>
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <div key={conv.id} className={`tc-item ${conv.unreadCount > 0 ? 'tc-item-unread' : ''}`} onClick={() => onSelectConversation(conv.id)}>
              <div className={`tc-item-avatar ${conv.type === 'group' ? 'tc-item-avatar-group' : ''}`}>
                {conv.type === 'group' ? <Users size={22} /> : <User size={22} />}
                {conv.type === 'direct' && (() => {
                  const partnerId = conv.members?.find(m => m.userId !== currentUserId)?.userId;
                  return partnerId && onlineStatuses[String(partnerId)]?.online ? <span className="online-dot-avatar"></span> : null;
                })()}
              </div>
              <div className="tc-item-body">
                <div className="tc-item-top">
                  <span className="tc-item-name">{conv.type === 'direct' ? (conv.displayName || 'ناشناس') : conv.name}</span>
                  <span className="tc-item-time">{formatTime(conv.lastMessageAt)}</span>
                </div>
                <div className="tc-item-bottom">
                  <p className="tc-item-msg">{getLastMessagePreview(conv)}</p>
                  <div className="tc-item-meta">
                    {conv.unreadCount > 0 && <span className="tc-badge">{conv.unreadCount}</span>}
                    {conv.type === 'group' && <span className="tc-member-count">👥 {conv.members?.length || 0}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="tc-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="tc-modal" onClick={e => e.stopPropagation()}>
            <div className="tc-modal-head">
              <h3>{createType === 'direct' ? 'چت جدید' : 'گروه جدید'}</h3>
              <button className="tc-modal-close" onClick={() => setShowCreateModal(false)}><X size={20} /></button>
            </div>
            
            {createType === 'group' && (
              <div className="tc-group-name-input">
                <Hash size={18} />
                <input type="text" placeholder="نام گروه..." value={groupName} onChange={e => setGroupName(e.target.value)} autoFocus />
              </div>
            )}
            
            {selectedMembers.length > 0 && (
              <div className="tc-chips">
                {selectedMembers.map(m => (
                  <div key={m.userId} className="tc-chip">
                    <span>{m.displayName}</span>
                    <button onClick={() => toggleMember(m)}><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="tc-modal-search">
              <Search size={16} />
              <input type="text" placeholder="جستجوی عضو..." value={memberSearch} onChange={e => setMemberSearch(e.target.value)} />
            </div>
            
            <div className="tc-modal-list">
              {loadingMembers ? (
                <div className="tc-modal-empty"><Loader2 size={24} className="tc-spin" /></div>
              ) : filteredMembers.length === 0 ? (
                <div className="tc-modal-empty">عضوی یافت نشد</div>
              ) : (
                filteredMembers.map(member => {
                  const isSel = selectedMembers.find(m => m.userId === member.userId);
                  return (
                    <div key={member.userId} className={`tc-modal-member ${isSel ? 'tc-modal-member-sel' : ''}`} onClick={() => toggleMember(member)}>
                      <div className="tc-modal-member-av"><User size={18} /></div>
                      <div className="tc-modal-member-info">
                        <span className="tc-modal-member-name">{member.displayName}</span>
                        <span className="tc-modal-member-role">{member.role}</span>
                      </div>
                      {isSel && <div className="tc-modal-member-check"><Check size={16} /></div>}
                    </div>
                  );
                })
              )}
            </div>
            
            <button className="tc-modal-create-btn" disabled={creating || selectedMembers.length === 0 || (createType === 'group' && !groupName.trim())} onClick={handleCreate}>
              {creating ? <Loader2 size={18} className="tc-spin" /> : null}
              {createType === 'direct' ? 'شروع گفتگو' : 'ساخت گروه'}
            </button>
          </div>
        </div>
      )}

      <style>{`
        .tc-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          position: relative;
          z-index: 10;
          overflow: hidden;
        }
        @media (max-width: 440px) {
          .tc-container { position: fixed; top: 0; left: 0; right: 0; bottom: 0; }
        }
        
        /* ─── Header ─── */
        .tc-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 20px;
          margin: 20px 16px 0;
          border-radius: 20px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.747);
          background: rgba(255,255,255,0.116);
          backdrop-filter: blur(4px) saturate(100%);
          -webkit-backdrop-filter: blur(4px) saturate(100%);
          border: 1px solid rgba(255,255,255,0.466);
        }
        .tc-back-btn {
          background: rgba(255,255,255,0.1); border: none; color: white;
          width: 38px; height: 38px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .tc-header-right { display: flex; align-items: center; gap: 12px; }
        .tc-header-text { display: flex; flex-direction: column; align-items: flex-end; }
        .tc-header-title { font-size: 17px; font-weight: 700; color: #fff; }
        .tc-header-subtitle { font-size: 12px; color: #6ee7b7; font-weight: 500; }
        .tc-header-avatar {
          width: 44px; height: 44px; border-radius: 50%;
          background: linear-gradient(135deg, #10b981, #3b82f6);
          display: flex; align-items: center; justify-content: center; color: #fff;
        }
        
        /* ─── Filters ─── */
        .tc-filters {
          padding: 12px 16px;
          display: flex; flex-direction: column; gap: 10px;
          background: rgba(0,0,0,0.3);
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .tc-search {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px;
          background: rgba(255,255,255,0.08);
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .tc-search svg { color: rgba(255,255,255,0.5); flex-shrink: 0; }
        .tc-search input {
          flex: 1; background: none; border: none; outline: none;
          color: #fff; font-size: 15px; font-family: inherit;
        }
        .tc-search input::placeholder { color: rgba(255,255,255,0.4); }
        
        .tc-actions { display: flex; gap: 8px; }
        .tc-action-btn {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: 10px 12px;
          background: rgba(99,102,241,0.15);
          border: 1px solid rgba(99,102,241,0.3);
          border-radius: 12px;
          color: #a5b4fc; font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer;
          transition: all 0.2s;
        }
        .tc-action-btn:active { background: rgba(99,102,241,0.25); transform: scale(0.98); }
        .tc-action-btn-green {
          background: rgba(16,185,129,0.15);
          border-color: rgba(16,185,129,0.3);
          color: #6ee7b7;
        }
        .tc-action-btn-green:active { background: rgba(16,185,129,0.25); }
        
        /* ─── List ─── */
        .tc-list {
          flex: 1; overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }
        .tc-list::-webkit-scrollbar { display: none; }
        
        .tc-loading {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 16px; height: 300px; color: rgba(255,255,255,0.6);
        }
        .tc-spin { animation: tcSpin 1s linear infinite; }
        @keyframes tcSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        .tc-empty {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 12px; height: 300px; color: rgba(255,255,255,0.4); text-align: center; padding: 20px;
        }
        .tc-empty h3 { font-size: 18px; color: rgba(255,255,255,0.7); margin: 0; }
        .tc-empty p { font-size: 14px; margin: 0; }
        .tc-empty-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 12px 24px;
          background: linear-gradient(135deg, #10b981, #059669);
          border: none; border-radius: 14px;
          color: white; font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer; margin-top: 8px;
        }
        
        /* ─── Conversation Item ─── */
        .tc-item {
          display: flex; align-items: center; gap: 14px;
          padding: 14px 16px;
          background: rgba(15,15,25,0.4);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          cursor: pointer;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          transition: background 0.15s;
        }
        .tc-item:active { background: rgba(255,255,255,0.06); }
        .tc-item-unread { background: rgba(16,185,129,0.06); }
        
        .tc-item-avatar {
          width: 50px; height: 50px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, rgba(99,102,241,0.4), rgba(139,92,246,0.4));
          display: flex; align-items: center; justify-content: center; color: #fff;
        }
        .tc-item-avatar-group {
          background: linear-gradient(135deg, rgba(16,185,129,0.4), rgba(59,130,246,0.4));
        }
        
        .tc-item-body { flex: 1; min-width: 0; overflow: hidden; }
        .tc-item-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
        .tc-item-name { font-size: 15px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tc-item-time { font-size: 11px; color: rgba(255,255,255,0.4); flex-shrink: 0; margin-right: 8px; }
        .tc-item-bottom { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .tc-item-msg {
          flex: 1; font-size: 13px; color: rgba(255,255,255,0.5);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0;
        }
        .tc-item-meta { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .tc-badge {
          min-width: 20px; height: 20px; padding: 0 6px;
          background: linear-gradient(135deg, #10b981, #059669);
          border-radius: 10px; font-size: 11px; font-weight: 700; color: #fff;
          display: flex; align-items: center; justify-content: center;
        }
        .tc-member-count { font-size: 11px; color: rgba(255,255,255,0.35); }
        
        /* ─── Modal ─── */
        .tc-modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          z-index: 1000;
          display: flex; align-items: flex-end; justify-content: center;
        }
        .tc-modal {
          width: 100%; max-width: 500px; max-height: 85vh;
          background: rgba(20,20,35,0.97);
          border-radius: 24px 24px 0 0;
          padding: 24px 16px; padding-bottom: max(24px, env(safe-area-inset-bottom));
          display: flex; flex-direction: column; gap: 12px;
          animation: tcSlideUp 0.3s ease;
        }
        @keyframes tcSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        
        .tc-modal-head { display: flex; align-items: center; justify-content: space-between; }
        .tc-modal-head h3 { font-size: 18px; color: #fff; margin: 0; font-weight: 700; }
        .tc-modal-close {
          background: rgba(255,255,255,0.1); border: none; color: rgba(255,255,255,0.6);
          width: 36px; height: 36px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        
        .tc-group-name-input {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px; background: rgba(255,255,255,0.06);
          border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.5);
        }
        .tc-group-name-input input {
          flex: 1; background: none; border: none; outline: none;
          color: #fff; font-size: 15px; font-family: inherit;
        }
        .tc-group-name-input input::placeholder { color: rgba(255,255,255,0.35); }
        
        .tc-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .tc-chip {
          display: flex; align-items: center; gap: 4px;
          padding: 6px 10px; background: rgba(16,185,129,0.2);
          border: 1px solid rgba(16,185,129,0.4); border-radius: 20px;
          color: #6ee7b7; font-size: 12px; font-weight: 500;
        }
        .tc-chip button { background: none; border: none; color: rgba(255,255,255,0.5); padding: 0; display: flex; cursor: pointer; }
        
        .tc-modal-search {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 14px; background: rgba(255,255,255,0.06);
          border-radius: 10px; border: 1px solid rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.4);
        }
        .tc-modal-search input {
          flex: 1; background: none; border: none; outline: none;
          color: #fff; font-size: 14px; font-family: inherit;
        }
        .tc-modal-search input::placeholder { color: rgba(255,255,255,0.3); }
        
        .tc-modal-list { flex: 1; overflow-y: auto; max-height: 40vh; -webkit-overflow-scrolling: touch; }
        .tc-modal-list::-webkit-scrollbar { display: none; }
        .tc-modal-empty { display: flex; align-items: center; justify-content: center; height: 100px; color: rgba(255,255,255,0.4); font-size: 14px; }
        
        .tc-modal-member {
          display: flex; align-items: center; gap: 12px;
          padding: 12px; border-radius: 12px; cursor: pointer; transition: all 0.15s;
        }
        .tc-modal-member:active { background: rgba(255,255,255,0.06); }
        .tc-modal-member-sel { background: rgba(16,185,129,0.1); }
        
        .tc-modal-member-av {
          width: 40px; height: 40px; border-radius: 50%;
          background: linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3));
          display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0;
        }
        .tc-modal-member-info { flex: 1; min-width: 0; }
        .tc-modal-member-name { display: block; font-size: 15px; font-weight: 500; color: #fff; }
        .tc-modal-member-role { display: block; font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 2px; }
        .tc-modal-member-check {
          width: 28px; height: 28px; border-radius: 50%;
          background: linear-gradient(135deg, #10b981, #059669);
          display: flex; align-items: center; justify-content: center; color: white;
        }
        
        .tc-modal-create-btn {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 14px;
          background: linear-gradient(135deg, #10b981, #059669);
          border: none; border-radius: 14px;
          color: white; font-size: 15px; font-weight: 600; font-family: inherit; cursor: pointer;
        }
        .tc-modal-create-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .tc-modal-create-btn:active:not(:disabled) { transform: scale(0.98); }
      `}</style>
    </div>
  );
};

export default TeamConversations;