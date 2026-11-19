import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ShieldAlert,
  Users,
  MessageSquare,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Search,
  Trash2,
  X,
  ArrowLeft,
  Eye,
  FileText,
  MapPin,
  Image as ImageIcon,
  Mic,
  ExternalLink,
  Layers,
  Globe,
  Radio,
  RefreshCw,
  LocateFixed,
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { User, Chat, Message } from '../../types/index.js';
import { getAvatarUrl } from '../../utils/avatar.js';

// Safe Leaflet marker icons in Vite/bundler environments
try {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
} catch (_) {}

const formatSafeDate = (rawDate: any): string => {
  if (!rawDate) return 'Recently';
  try {
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return 'Recently';
    return d.toLocaleDateString();
  } catch {
    return 'Recently';
  }
};

const formatSafeDateTime = (rawDate: any): string => {
  if (!rawDate) return '';
  try {
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString();
  } catch {
    return '';
  }
};

const parseMetadata = (raw: any): any => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  socket?: any;
}

interface OverviewData {
  totalUsers: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  totalChats: number;
  totalMessages: number;
}

export interface UserLocationData {
  id: string;
  phone: string;
  name: string;
  avatar?: string;
  role: string;
  isOnline: boolean;
  lastSeen: string;
  location: {
    lat: number;
    lng: number;
    city?: string;
    country?: string;
    source?: 'gps' | 'ip';
    updatedAt: string;
  };
}

// Local Storage Cache Keys for Instant 0ms Rendering
const CACHE_KEY_OVERVIEW = 'ichat_admin_cache_overview';
const CACHE_KEY_USERS = 'ichat_admin_cache_users';
const CACHE_KEY_CHATS = 'ichat_admin_cache_chats';
const CACHE_KEY_MAP = 'ichat_admin_cache_map';

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  socket,
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'map' | 'chats' | 'overview'>('users');
  const [userFilter, setUserFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Instant Cache Initialization with strict array/object checks
  const [overview, setOverview] = useState<OverviewData | null>(() => {
    try {
      const saved = localStorage.getItem(CACHE_KEY_OVERVIEW);
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      return parsed && typeof parsed === 'object' && !parsed.error && typeof parsed.totalUsers === 'number'
        ? parsed
        : null;
    } catch {
      return null;
    }
  });

  const [users, setUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem(CACHE_KEY_USERS);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [chats, setChats] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(CACHE_KEY_CHATS);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [selectedAuditChat, setSelectedAuditChat] = useState<any | null>(null);
  const [auditMessages, setAuditMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Live Map Geolocation State
  const [mapUsers, setMapUsers] = useState<UserLocationData[]>(() => {
    try {
      const saved = localStorage.getItem(CACHE_KEY_MAP);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [mapLoading, setMapLoading] = useState(false);
  const [mapFilter, setMapFilter] = useState<'all' | 'online'>('all');
  const [mapSearch, setMapSearch] = useState('');
  const [selectedMapUser, setSelectedMapUser] = useState<UserLocationData | null>(null);
  const [mapStyle, setMapStyle] = useState<'dark' | 'street' | 'satellite'>('dark');
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map());
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const adminId = currentUser?.id || '';

  // Fetch Overview with Cache Persistence
  const fetchOverview = async () => {
    if (!adminId) return;
    try {
      const res = await fetch('/api/admin/overview', {
        headers: { 'x-admin-id': adminId },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object' && !data.error) {
          setOverview(data);
          try {
            localStorage.setItem(CACHE_KEY_OVERVIEW, JSON.stringify(data));
          } catch (_) {}
        }
      }
    } catch (e) {
      console.error('Error fetching admin overview:', e);
    }
  };

  // Fetch Users with Cache Persistence
  const fetchUsers = async () => {
    if (!adminId) return;
    try {
      if (!Array.isArray(users) || users.length === 0) setLoading(true);
      const res = await fetch('/api/admin/users?status=all', {
        headers: { 'x-admin-id': adminId },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setUsers(data);
          try {
            localStorage.setItem(CACHE_KEY_USERS, JSON.stringify(data));
          } catch (_) {}
        }
      }
    } catch (e) {
      console.error('Error fetching admin users:', e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Chats with Cache Persistence
  const fetchChats = async () => {
    if (!adminId) return;
    try {
      if (!Array.isArray(chats) || chats.length === 0) setLoading(true);
      const res = await fetch('/api/admin/chats', {
        headers: { 'x-admin-id': adminId },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setChats(data);
          try {
            localStorage.setItem(CACHE_KEY_CHATS, JSON.stringify(data));
          } catch (_) {}
        }
      }
    } catch (e) {
      console.error('Error fetching admin chats:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditMessages = async (chatId: string) => {
    if (!adminId || !chatId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/chats/${chatId}/messages`, {
        headers: { 'x-admin-id': adminId },
      });
      if (res.ok) {
        const data = await res.json();
        setAuditMessages(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Error fetching audit messages:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchOnlineLocations = async () => {
    if (!adminId) return;
    try {
      if (!Array.isArray(mapUsers) || mapUsers.length === 0) setMapLoading(true);
      const res = await fetch('/api/admin/online-locations', {
        headers: { 'x-admin-id': adminId },
      });
      if (res.ok) {
        const data: UserLocationData[] = await res.json();
        if (Array.isArray(data)) {
          setMapUsers(data);
          try {
            localStorage.setItem(CACHE_KEY_MAP, JSON.stringify(data));
          } catch (_) {}
        }
      }
    } catch (e) {
      console.error('Error fetching online locations:', e);
    } finally {
      setMapLoading(false);
    }
  };

  // On Tab change or Modal Open, revalidate in background
  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === 'users' || activeTab === 'overview') {
      fetchOverview();
      fetchUsers();
    } else if (activeTab === 'chats') {
      fetchChats();
    } else if (activeTab === 'map') {
      fetchOnlineLocations();
    }
  }, [isOpen, activeTab]);

  const handleApprove = async (userId: string) => {
    if (!adminId || !userId) return;
    try {
      setActionLoadingId(userId);
      setUsers((prev) =>
        Array.isArray(prev) ? prev.map((u) => (u.id === userId ? { ...u, status: 'approved' } : u)) : []
      );
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              pendingCount: Math.max(0, prev.pendingCount - 1),
              approvedCount: prev.approvedCount + 1,
            }
          : null
      );

      const res = await fetch(`/api/admin/users/${userId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': adminId },
      });
      if (res.ok) {
        const updated = await res.json();
        if (updated.user) {
          setUsers((prev) =>
            Array.isArray(prev) ? prev.map((u) => (u.id === userId ? { ...u, ...updated.user } : u)) : []
          );
        }
      }
    } catch (e) {
      console.error('Error approving user:', e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (userId: string) => {
    if (!adminId || !userId) return;
    try {
      setActionLoadingId(userId);
      setUsers((prev) =>
        Array.isArray(prev) ? prev.map((u) => (u.id === userId ? { ...u, status: 'rejected' } : u)) : []
      );
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              pendingCount: Math.max(0, prev.pendingCount - 1),
              rejectedCount: prev.rejectedCount + 1,
            }
          : null
      );

      const res = await fetch(`/api/admin/users/${userId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': adminId },
      });
      if (res.ok) {
        const updated = await res.json();
        if (updated.user) {
          setUsers((prev) =>
            Array.isArray(prev) ? prev.map((u) => (u.id === userId ? { ...u, ...updated.user } : u)) : []
          );
        }
      }
    } catch (e) {
      console.error('Error rejecting user:', e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleAdminRole = async (userId: string, currentRole: string) => {
    if (!adminId || !userId) return;
    const nextRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      setActionLoadingId(userId);
      setUsers((prev) =>
        Array.isArray(prev) ? prev.map((u) => (u.id === userId ? { ...u, role: nextRole } : u)) : []
      );
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': adminId },
        body: JSON.stringify({ role: nextRole }),
      });
      if (res.ok) {
        const updated = await res.json();
        if (updated.user) {
          setUsers((prev) =>
            Array.isArray(prev) ? prev.map((u) => (u.id === userId ? { ...u, ...updated.user } : u)) : []
          );
        }
      }
    } catch (e) {
      console.error('Error toggling admin role:', e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!adminId || !userId) return;
    if (!window.confirm(`Are you sure you want to permanently delete user "${userName}"?`)) {
      return;
    }
    try {
      setActionLoadingId(userId);
      setUsers((prev) => (Array.isArray(prev) ? prev.filter((u) => u.id !== userId) : []));
      setMapUsers((prev) => (Array.isArray(prev) ? prev.filter((u) => u.id !== userId) : []));
      await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'x-admin-id': adminId },
      });
    } catch (e) {
      console.error('Error deleting user:', e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const updateTileLayer = (map: L.Map, style: 'dark' | 'street' | 'satellite') => {
    try {
      if (tileLayerRef.current) {
        tileLayerRef.current.remove();
        tileLayerRef.current = null;
      }

      let url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
      let options: L.TileLayerOptions = { maxZoom: 19 };

      if (style === 'dark') {
        url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
        options.className = 'map-tiles-dark';
      } else if (style === 'street') {
        url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
      } else {
        url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      }

      const layer = L.tileLayer(url, options).addTo(map);
      tileLayerRef.current = layer;
    } catch (err) {
      console.warn('[AdminDashboard] updateTileLayer error:', err);
    }
  };

  // Real-time WebSocket Listeners for Instant Incremental Sync
  useEffect(() => {
    if (!isOpen || !socket) return;

    try {
      socket.emit('admin_join_map_monitoring');
    } catch (_) {}

    const handleLocationUpdate = (data: { userId: string; location: any; isOnline: boolean }) => {
      if (!data?.userId) return;
      setMapUsers((prev) =>
        Array.isArray(prev)
          ? prev.map((u) =>
              u.id === data.userId
                ? { ...u, location: data.location, isOnline: data.isOnline }
                : u
            )
          : []
      );
      setUsers((prev) =>
        Array.isArray(prev)
          ? prev.map((u) =>
              u.id === data.userId
                ? { ...u, location: data.location, isOnline: data.isOnline }
                : u
            )
          : []
      );
    };

    const handleStatusUpdate = (data: { userId: string; isOnline: boolean; lastSeen: string }) => {
      if (!data?.userId) return;
      setMapUsers((prev) =>
        Array.isArray(prev)
          ? prev.map((u) =>
              u.id === data.userId
                ? { ...u, isOnline: data.isOnline, lastSeen: data.lastSeen }
                : u
            )
          : []
      );
      setUsers((prev) =>
        Array.isArray(prev)
          ? prev.map((u) =>
              u.id === data.userId
                ? { ...u, isOnline: data.isOnline, lastSeen: data.lastSeen }
                : u
            )
          : []
      );
    };

    const handleNewUserRegistered = (data: { user: User }) => {
      if (!data?.user) return;
      setUsers((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        if (list.some((u) => u.id === data.user.id)) {
          return list.map((u) => (u.id === data.user.id ? { ...u, ...data.user } : u));
        }
        return [data.user, ...list];
      });
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              totalUsers: prev.totalUsers + 1,
              pendingCount: data.user.status === 'pending' ? prev.pendingCount + 1 : prev.pendingCount,
              approvedCount: data.user.status === 'approved' ? prev.approvedCount + 1 : prev.approvedCount,
            }
          : null
      );
    };

    const handleUserUpdated = (data: { user: any }) => {
      if (!data?.user) return;
      if (data.user.deleted) {
        setUsers((prev) => (Array.isArray(prev) ? prev.filter((u) => u.id !== data.user.id) : []));
        setMapUsers((prev) => (Array.isArray(prev) ? prev.filter((u) => u.id !== data.user.id) : []));
      } else {
        setUsers((prev) =>
          Array.isArray(prev) ? prev.map((u) => (u.id === data.user.id ? { ...u, ...data.user } : u)) : []
        );
        setMapUsers((prev) =>
          Array.isArray(prev) ? prev.map((u) => (u.id === data.user.id ? { ...u, ...data.user } : u)) : []
        );
      }
    };

    socket.on('admin_user_location_updated', handleLocationUpdate);
    socket.on('admin_user_status_changed', handleStatusUpdate);
    socket.on('admin_new_user_registered', handleNewUserRegistered);
    socket.on('admin_user_updated', handleUserUpdated);

    return () => {
      try {
        socket.emit('admin_leave_map_monitoring');
      } catch (_) {}
      socket.off('admin_user_location_updated', handleLocationUpdate);
      socket.off('admin_user_status_changed', handleStatusUpdate);
      socket.off('admin_new_user_registered', handleNewUserRegistered);
      socket.off('admin_user_updated', handleUserUpdated);
    };
  }, [isOpen, socket]);

  // Clean up Leaflet Map instance safely on modal close / unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (_) {}
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Initialize Leaflet Map safely when activeTab === 'map'
  useEffect(() => {
    if (!isOpen || activeTab !== 'map') return;

    const timer = setTimeout(() => {
      try {
        if (!mapContainerRef.current) return;

        // If map already exists, re-tile and invalidate size
        if (mapInstanceRef.current) {
          updateTileLayer(mapInstanceRef.current, mapStyle);
          mapInstanceRef.current.invalidateSize();
          return;
        }

        // Clear container ID if previously assigned
        if ((mapContainerRef.current as any)._leaflet_id) {
          (mapContainerRef.current as any)._leaflet_id = null;
        }

        const defaultCenter: [number, number] = [17.9757, 102.6331];
        const map = L.map(mapContainerRef.current, {
          center: defaultCenter,
          zoom: 12,
          zoomControl: false,
          attributionControl: false,
        });

        updateTileLayer(map, mapStyle);
        mapInstanceRef.current = map;
      } catch (err) {
        console.error('[AdminDashboard] Leaflet map initialization error:', err);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [activeTab, isOpen, mapStyle]);

  // Update Map Markers on Location updates
  useEffect(() => {
    if (activeTab !== 'map' || !mapInstanceRef.current) return;
    try {
      const map = mapInstanceRef.current;

      markersMapRef.current.forEach((m) => {
        try { m.remove(); } catch (_) {}
      });
      markersMapRef.current.clear();

      const list = Array.isArray(mapUsers) ? mapUsers : [];
      const filtered = list.filter((u) => {
        if (!u) return false;
        if (mapFilter === 'online' && !u.isOnline) return false;
        if (mapSearch) {
          const q = mapSearch.toLowerCase();
          return (u.name || '').toLowerCase().includes(q) || (u.phone || '').includes(q);
        }
        return true;
      });

      const bounds: L.LatLngTuple[] = [];

      filtered.forEach((u) => {
        try {
          const lat = Number(u.location?.lat) || 17.9757;
          const lng = Number(u.location?.lng) || 102.6331;
          bounds.push([lat, lng]);

          const avatarSrc = getAvatarUrl(u.avatar);
          const isOnline = Boolean(u.isOnline);
          const sourceBadge = u.location?.source === 'gps' ? 'GPS Exact' : 'IP Network';

          const customHtml = `
            <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
              ${isOnline ? '<div style="position: absolute; width: 44px; height: 44px; border-radius: 9999px; background: rgba(0, 168, 132, 0.4); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>' : ''}
              <div style="position: relative; width: 36px; height: 36px; border-radius: 9999px; overflow: hidden; border: 3px solid ${isOnline ? '#00a884' : '#6b7280'}; box-shadow: 0 4px 14px rgba(0,0,0,0.6); background: #202c33;">
                <img src="${avatarSrc}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'" />
              </div>
              <span style="position: absolute; bottom: 0px; right: 0px; width: 12px; height: 12px; border-radius: 9999px; border: 2px solid #111b21; background: ${isOnline ? '#00a884' : '#6b7280'};"></span>
            </div>
          `;

          const icon = L.divIcon({
            html: customHtml,
            className: 'custom-admin-marker',
            iconSize: [44, 44],
            iconAnchor: [22, 22],
            popupAnchor: [0, -22],
          });

          const marker = L.marker([lat, lng], { icon }).addTo(map);

          const popupHtml = `
            <div style="color: #fff; font-family: system-ui, -apple-system, sans-serif; min-width: 210px; padding: 2px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <img src="${avatarSrc}" style="width: 38px; height: 38px; border-radius: 9999px; object-fit: cover; border: 2px solid ${isOnline ? '#00a884' : '#6b7280'};" />
                <div>
                  <div style="font-weight: 700; font-size: 13px; color: #fff;">${u.name || 'User'}</div>
                  <div style="font-size: 11px; color: #8696a0;">${u.phone || ''}</div>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 6px; font-size: 11px; margin-bottom: 6px;">
                <span style="width: 8px; height: 8px; border-radius: 9999px; background: ${isOnline ? '#00a884' : '#6b7280'}; display: inline-block;"></span>
                <span style="color: ${isOnline ? '#00a884' : '#8696a0'}; font-weight: 600;">${isOnline ? 'Online Now' : 'Offline'}</span>
                <span style="background: rgba(255,255,255,0.12); padding: 2px 6px; border-radius: 4px; font-size: 9px; margin-left: auto; color: #e9edef;">${sourceBadge}</span>
              </div>
              <div style="font-size: 11px; color: #e9edef; margin-bottom: 4px;">
                📍 ${u.location?.city || 'Unknown'}, ${u.location?.country || ''}
              </div>
              <div style="font-size: 10px; color: #8696a0; margin-bottom: 6px;">
                Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}
              </div>
            </div>
          `;

          marker.bindPopup(popupHtml, { className: 'custom-admin-popup' });
          marker.on('click', () => {
            setSelectedMapUser(u);
          });

          markersMapRef.current.set(u.id, marker);
        } catch (markerErr) {
          console.warn('[AdminDashboard] Marker rendering error:', markerErr);
        }
      });

      if (bounds.length > 0 && !selectedMapUser) {
        try {
          map.fitBounds(bounds, { maxZoom: 13, padding: [40, 40] });
        } catch (_) {}
      }
    } catch (err) {
      console.error('[AdminDashboard] Markers effect error:', err);
    }
  }, [mapUsers, mapFilter, mapSearch, activeTab]);

  const userCounts = useMemo(() => {
    let pending = 0, approved = 0, rejected = 0;
    const list = Array.isArray(users) ? users : [];
    for (const u of list) {
      if (!u || typeof u !== 'object') continue;
      if (u.status === 'pending') pending++;
      else if (u.status === 'approved') approved++;
      else if (u.status === 'rejected') rejected++;
    }
    return {
      all: list.length,
      pending,
      approved,
      rejected,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    if (!Array.isArray(users)) return [];
    return users.filter((u) => {
      if (!u || typeof u !== 'object') return false;
      if (userFilter !== 'all' && u.status !== userFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const name = (u.name || '').toLowerCase();
      const phone = (u.phone || '').toLowerCase();
      const bName = (u.businessName || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || bName.includes(q);
    });
  }, [users, userFilter, searchQuery]);

  const filteredChats = useMemo(() => {
    if (!Array.isArray(chats)) return [];
    if (!searchQuery.trim()) return chats;
    const q = searchQuery.toLowerCase();
    return chats.filter((c) => {
      if (!c || typeof c !== 'object') return false;
      if (c.name && String(c.name).toLowerCase().includes(q)) return true;
      return Array.isArray(c.members) && c.members.some((m: any) =>
        (m?.user?.name || '').toLowerCase().includes(q) || (m?.user?.phone || '').includes(q)
      );
    });
  }, [chats, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#111b21] sm:bg-black/80 sm:backdrop-blur-sm flex items-center justify-center sm:p-4 animate-fade-in">
      <div className="bg-[#111b21] sm:border sm:border-[#2a3942] sm:rounded-2xl w-full max-w-5xl h-full sm:h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-[#202c33] border-b border-[#2a3942] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#00a884]/20 border border-[#00a884]/40 flex items-center justify-center text-[#00a884] flex-shrink-0">
              <ShieldAlert className="w-5 h-5 text-[#00a884]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-semibold text-white">
                  IChat Admin Console
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00a884] text-white font-bold">
                  SUPER ADMIN
                </span>
              </div>
              <p className="text-[11px] text-[#8696a0] truncate">
                User approvals, live GPS map & chat monitoring
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                fetchOverview();
                fetchUsers();
                if (activeTab === 'chats') fetchChats();
                if (activeTab === 'map') fetchOnlineLocations();
              }}
              className="p-2 text-[#8696a0] hover:text-white rounded-full hover:bg-[#374248] transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading || mapLoading ? 'animate-spin text-[#00a884]' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-[#8696a0] hover:text-white rounded-full hover:bg-[#374248] transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-3 sm:px-4 pt-2 bg-[#202c33] border-b border-[#2a3942] flex items-center gap-2 flex-shrink-0 overflow-x-auto no-scrollbar">
          <button
            onClick={() => {
              setActiveTab('users');
              setSelectedAuditChat(null);
            }}
            className={`pb-2.5 px-3 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'users'
                ? 'border-[#00a884] text-[#00a884]'
                : 'border-transparent text-[#8696a0] hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Registrations</span>
            {userCounts.pending > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-black font-bold animate-pulse">
                {userCounts.pending}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('map');
              setSelectedAuditChat(null);
            }}
            className={`pb-2.5 px-3 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'map'
                ? 'border-[#00a884] text-[#00a884]'
                : 'border-transparent text-[#8696a0] hover:text-white'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Live GPS Map</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#2a3942] text-gray-300">
              {mapUsers.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('chats');
              setSelectedAuditChat(null);
            }}
            className={`pb-2.5 px-3 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'chats'
                ? 'border-[#00a884] text-[#00a884]'
                : 'border-transparent text-[#8696a0] hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat Monitor</span>
            {overview && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#2a3942] text-gray-300">
                {overview.totalChats}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('overview');
              setSelectedAuditChat(null);
            }}
            className={`pb-2.5 px-3 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-[#00a884] text-[#00a884]'
                : 'border-transparent text-[#8696a0] hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>System Stats</span>
          </button>
        </div>

        {/* Tab 1: Users & Approvals */}
        {activeTab === 'users' && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#111b21]">
            {/* Search and Filters */}
            <div className="p-3 bg-[#111b21] border-b border-[#2a3942] flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between flex-shrink-0">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#8696a0]" />
                <input
                  type="text"
                  placeholder="Search user by name, phone, or business..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#202c33] text-white text-xs pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                />
              </div>

              {/* Status filter tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
                {(['all', 'pending', 'approved', 'rejected'] as const).map((filter) => {
                  const count = userCounts[filter];
                  return (
                    <button
                      key={filter}
                      onClick={() => setUserFilter(filter)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-all flex items-center gap-1.5 flex-shrink-0 ${
                        userFilter === filter
                          ? 'bg-[#00a884] text-white font-semibold shadow-sm'
                          : 'bg-[#202c33] text-[#8696a0] hover:text-white'
                      }`}
                    >
                      <span>{filter}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          userFilter === filter
                            ? 'bg-black/20 text-white'
                            : filter === 'pending' && count > 0
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-[#111b21] text-[#8696a0]'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Users List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loading && filteredUsers.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#8696a0]">Loading users...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#8696a0]">
                  No users found in this category.
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = u.id === currentUser.id;
                  const isPending = u.status === 'pending';
                  const isApproved = u.status === 'approved';
                  const isRejected = u.status === 'rejected';

                  return (
                    <div
                      key={u.id}
                      className="p-3 bg-[#202c33] rounded-xl border border-[#2a3942] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-[#374248] transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={getAvatarUrl(u.avatar)}
                          alt={u.name || 'User'}
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100';
                          }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-white truncate">
                              {u.name || 'Unnamed User'}
                            </span>
                            {u.role === 'admin' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30 flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" /> Admin
                              </span>
                            )}
                            {isPending && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Pending Approval
                              </span>
                            )}
                            {isApproved && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#00a884]/20 text-[#00a884] font-bold border border-[#00a884]/30 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Approved
                              </span>
                            )}
                            {isRejected && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30 flex items-center gap-1">
                                <XCircle className="w-3 h-3" /> Rejected
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-[#8696a0] flex items-center gap-2 flex-wrap mt-0.5">
                            <span className="font-mono text-gray-300">📞 {u.phone}</span>
                            <span>•</span>
                            <span>Registered: {formatSafeDate(u.createdAt)}</span>
                            {u.isBusiness && (
                              <span className="text-amber-400 font-medium">🏢 {u.businessName || 'Business'}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                        {isPending && (
                          <>
                            <button
                              onClick={() => handleApprove(u.id)}
                              disabled={actionLoadingId === u.id}
                              className="px-3 py-1.5 rounded-lg bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-semibold flex items-center gap-1 transition-colors shadow-sm disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleReject(u.id)}
                              disabled={actionLoadingId === u.id}
                              className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30 text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </>
                        )}

                        {isRejected && (
                          <button
                            onClick={() => handleApprove(u.id)}
                            disabled={actionLoadingId === u.id}
                            className="px-3 py-1.5 rounded-lg bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Re-Approve</span>
                          </button>
                        )}

                        {!isCurrent && (
                          <>
                            <button
                              onClick={() => handleToggleAdminRole(u.id, u.role || 'user')}
                              disabled={actionLoadingId === u.id}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                u.role === 'admin'
                                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20'
                                  : 'bg-[#111b21] border-[#2a3942] text-[#8696a0] hover:text-white'
                              }`}
                              title={u.role === 'admin' ? 'Remove Admin Privileges' : 'Grant Admin Privileges'}
                            >
                              {u.role === 'admin' ? 'Admin Role' : 'Make Admin'}
                            </button>

                            <button
                              onClick={() => handleDeleteUser(u.id, u.name)}
                              disabled={actionLoadingId === u.id}
                              className="p-1.5 rounded-lg bg-[#111b21] text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="Delete User"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Live GPS Geolocation Map */}
        {activeTab === 'map' && (
          <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-[#111b21] relative overflow-hidden">
            {/* Map Container */}
            <div className="flex-1 h-full min-h-[300px] relative">
              <div ref={mapContainerRef} className="w-full h-full z-10" />

              {/* Map Floating Style Controls */}
              <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-[#202c33]/90 backdrop-blur-md p-1.5 rounded-xl border border-[#2a3942] shadow-xl">
                {(['dark', 'street', 'satellite'] as const).map((style) => (
                  <button
                    key={style}
                    onClick={() => setMapStyle(style)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize transition-all ${
                      mapStyle === style
                        ? 'bg-[#00a884] text-white shadow-sm'
                        : 'text-[#8696a0] hover:text-white'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>

              {/* Online Marker Counter */}
              <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 bg-[#202c33]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#2a3942] text-xs text-white shadow-xl">
                <span className="w-2 h-2 rounded-full bg-[#00a884] animate-ping" />
                <span className="font-semibold">{mapUsers.filter((u) => u.isOnline).length} Active Online</span>
              </div>
            </div>

            {/* Sidebar list of participants */}
            <div className="w-full md:w-80 h-48 md:h-full bg-[#202c33] border-t md:border-t-0 md:border-l border-[#2a3942] flex flex-col flex-shrink-0">
              <div className="p-2.5 border-b border-[#2a3942] flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#8696a0]" />
                  <input
                    type="text"
                    placeholder="Search participant..."
                    value={mapSearch}
                    onChange={(e) => setMapSearch(e.target.value)}
                    className="w-full bg-[#111b21] text-white text-xs pl-8 pr-2 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                  />
                </div>
                <button
                  onClick={() => setMapFilter((prev) => (prev === 'all' ? 'online' : 'all'))}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    mapFilter === 'online' ? 'bg-[#00a884] text-white' : 'bg-[#111b21] text-[#8696a0]'
                  }`}
                >
                  {mapFilter === 'online' ? 'Online' : 'All'}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {mapUsers.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => {
                      setSelectedMapUser(u);
                      if (mapInstanceRef.current && u.location) {
                        mapInstanceRef.current.setView([u.location.lat, u.location.lng], 15);
                      }
                    }}
                    className={`p-2 rounded-xl border cursor-pointer transition-all flex items-center gap-2.5 ${
                      selectedMapUser?.id === u.id
                        ? 'bg-[#111b21] border-[#00a884]'
                        : 'bg-[#111b21]/60 border-[#2a3942] hover:border-[#374248]'
                    }`}
                  >
                    <div className="relative">
                      <img
                        src={getAvatarUrl(u.avatar)}
                        alt={u.name}
                        className="w-8 h-8 rounded-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100';
                        }}
                      />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[#111b21] ${
                          u.isOnline ? 'bg-[#00a884]' : 'bg-gray-500'
                        }`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-white truncate">{u.name}</div>
                      <div className="text-[10px] text-[#8696a0] truncate">
                        {u.location?.city ? `${u.location.city}, ` : ''}{u.location?.country || 'Laos'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Chat Monitor & Audit */}
        {activeTab === 'chats' && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#111b21]">
            {selectedAuditChat ? (
              // Active Chat Transcript Inspector
              <div className="flex-1 flex flex-col min-h-0">
                <div className="px-4 py-2.5 bg-[#202c33] border-b border-[#2a3942] flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedAuditChat(null)}
                      className="p-1.5 rounded-full hover:bg-[#374248] text-[#8696a0] hover:text-white transition-colors"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                      <h3 className="text-xs sm:text-sm font-semibold text-white">
                        {selectedAuditChat.isGroup
                          ? `Group: ${selectedAuditChat.name}`
                          : `Direct Chat: ${selectedAuditChat.members?.map((m: any) => m.user?.name || m.user?.phone).join(' ↔ ')}`}
                      </h3>
                      <p className="text-[10px] text-[#8696a0]">
                        Audit Mode • {auditMessages.length} total messages
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono">
                    ADMIN AUDIT VIEW
                  </span>
                </div>

                {/* Audit Messages Stream */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-[#0b141a]">
                  {loading ? (
                    <div className="py-12 text-center text-xs text-[#8696a0]">
                      Loading chat messages...
                    </div>
                  ) : auditMessages.length === 0 ? (
                    <div className="py-12 text-center text-xs text-[#8696a0]">
                      No messages recorded in this chat yet.
                    </div>
                  ) : (
                    auditMessages.map((msg: any) => (
                      <div
                        key={msg.id}
                        className="p-3 bg-[#202c33] border border-[#2a3942] rounded-xl max-w-xl shadow"
                      >
                        <div className="flex items-center justify-between text-[11px] text-[#8696a0] border-b border-[#2a3942] pb-1.5 mb-1.5 flex-wrap gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-[#00a884]">
                              {msg.sender?.name || 'Unknown User'} ({msg.sender?.phone || 'No phone'})
                            </span>
                            {msg.wasDeletedForEveryone && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-medium border border-red-500/30">
                                🗑️ Deleted for everyone
                              </span>
                            )}
                            {msg.wasDeletedForUsers && !msg.wasDeletedForEveryone && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30">
                                🗑️ Deleted/Cleared by user
                              </span>
                            )}
                          </div>
                          <span>{formatSafeDateTime(msg.createdAt)}</span>
                        </div>

                        {/* Content based on type */}
                        {msg.type === 'image' && (
                          <div className="mb-2">
                            <img
                              src={msg.mediaUrl}
                              alt="Attached"
                              className="max-h-60 rounded-lg object-contain bg-black/40"
                            />
                            {msg.content && msg.content !== 'Photo' && (
                              <p className="text-xs text-white mt-1">{msg.content}</p>
                            )}
                          </div>
                        )}

                        {msg.type === 'location' && (() => {
                          const meta = parseMetadata(msg.metadata);
                          const mapUrl = meta?.mapUrl || (meta?.lat && meta?.lng ? `https://maps.google.com?q=${meta.lat},${meta.lng}` : null);
                          return (
                            <div className="p-2 bg-[#111b21] rounded-lg border border-[#2a3942] flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs text-white">
                                <MapPin className="w-4 h-4 text-rose-500" />
                                <span>{msg.content}</span>
                              </div>
                              {mapUrl && (
                                <a
                                  href={mapUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1 text-[#00a884] hover:text-white"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              )}
                            </div>
                          );
                        })()}

                        {msg.type === 'audio' && (
                          <div className="p-2 bg-[#111b21] rounded-lg border border-[#2a3942] flex items-center gap-2">
                            <Mic className="w-4 h-4 text-[#00a884]" />
                            <audio controls src={msg.mediaUrl} className="h-8 flex-1" />
                          </div>
                        )}

                        {msg.type === 'document' && (
                          <div className="p-2 bg-[#111b21] rounded-lg border border-[#2a3942] flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-white">
                              <FileText className="w-4 h-4 text-blue-400" />
                              <span className="font-mono truncate">{msg.content}</span>
                            </div>
                            {msg.mediaUrl && (
                              <a
                                href={msg.mediaUrl}
                                download={msg.content}
                                className="px-2 py-1 bg-[#202c33] rounded text-[11px] text-[#00a884]"
                              >
                                Download
                              </a>
                            )}
                          </div>
                        )}

                        {(msg.type === 'text' || !msg.type) && (
                          <p className="text-xs sm:text-sm text-gray-200 whitespace-pre-wrap">
                            {msg.content}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              // Chat List
              <div className="flex-1 flex flex-col min-h-0">
                <div className="p-3 bg-[#111b21] border-b border-[#2a3942] flex-shrink-0">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#8696a0]" />
                    <input
                      type="text"
                      placeholder="Search conversations by participant name or phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#202c33] text-white text-xs pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {loading && filteredChats.length === 0 ? (
                    <div className="py-12 text-center text-xs text-[#8696a0]">Loading chats...</div>
                  ) : filteredChats.length === 0 ? (
                    <div className="py-12 text-center text-xs text-[#8696a0]">
                      No conversations found.
                    </div>
                  ) : (
                    filteredChats.map((c) => {
                      const memberNames = c.members?.map((m: any) => `${m.user?.name || 'User'} (${m.user?.phone || 'No phone'})`).join(', ');

                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedAuditChat(c);
                            fetchAuditMessages(c.id);
                          }}
                          className="p-3 bg-[#202c33] rounded-xl border border-[#2a3942] hover:border-[#00a884]/60 cursor-pointer transition-all flex items-center justify-between gap-3 group"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs sm:text-sm font-semibold text-white group-hover:text-[#00a884] transition-colors truncate">
                                {c.isGroup ? `Group: ${c.name}` : `Direct: ${c.members?.map((m: any) => m.user?.name).join(' ↔ ')}`}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#111b21] text-[#8696a0]">
                                {c.totalMessages || 0} msgs
                              </span>
                            </div>

                            <p className="text-[11px] text-[#8696a0] line-clamp-1 mt-0.5">
                              Members: {memberNames || 'None'}
                            </p>

                            {c.lastMessage && (
                              <p className="text-[11px] text-gray-400 line-clamp-1 mt-1 font-mono">
                                Last: {c.lastMessage.content}
                              </p>
                            )}
                          </div>

                          <button className="px-3 py-1.5 rounded-lg bg-[#111b21] group-hover:bg-[#00a884] text-gray-300 group-hover:text-white text-xs font-medium flex items-center gap-1 transition-all flex-shrink-0">
                            <Eye className="w-3.5 h-3.5" /> Inspect
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: System Overview */}
        {activeTab === 'overview' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#111b21]">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
              <div className="p-4 bg-[#202c33] border border-[#2a3942] rounded-2xl">
                <span className="text-[11px] text-[#8696a0] block uppercase tracking-wider font-semibold">
                  Registered Users
                </span>
                <span className="text-2xl sm:text-3xl font-bold text-white mt-1 block">
                  {overview?.totalUsers || 0}
                </span>
              </div>

              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                <span className="text-[11px] text-amber-400 block uppercase tracking-wider font-semibold">
                  Pending Approvals
                </span>
                <span className="text-2xl sm:text-3xl font-bold text-amber-400 mt-1 block">
                  {overview?.pendingCount || 0}
                </span>
              </div>

              <div className="p-4 bg-[#00a884]/10 border border-[#00a884]/30 rounded-2xl">
                <span className="text-[11px] text-[#00a884] block uppercase tracking-wider font-semibold">
                  Approved Users
                </span>
                <span className="text-2xl sm:text-3xl font-bold text-[#00a884] mt-1 block">
                  {overview?.approvedCount || 0}
                </span>
              </div>

              <div className="p-4 bg-[#202c33] border border-[#2a3942] rounded-2xl">
                <span className="text-[11px] text-[#8696a0] block uppercase tracking-wider font-semibold">
                  Total Conversations
                </span>
                <span className="text-2xl sm:text-3xl font-bold text-white mt-1 block">
                  {overview?.totalChats || 0}
                </span>
              </div>

              <div className="p-4 bg-[#202c33] border border-[#2a3942] rounded-2xl">
                <span className="text-[11px] text-[#8696a0] block uppercase tracking-wider font-semibold">
                  Total Messages Sent
                </span>
                <span className="text-2xl sm:text-3xl font-bold text-white mt-1 block">
                  {overview?.totalMessages || 0}
                </span>
              </div>

              <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl">
                <span className="text-[11px] text-rose-400 block uppercase tracking-wider font-semibold">
                  Rejected Users
                </span>
                <span className="text-2xl sm:text-3xl font-bold text-rose-400 mt-1 block">
                  {overview?.rejectedCount || 0}
                </span>
              </div>
            </div>

            <div className="p-4 bg-[#202c33] border border-[#2a3942] rounded-2xl text-xs text-[#8696a0] space-y-2">
              <h4 className="text-sm font-semibold text-white">Admin Policy & Security Rules:</h4>
              <p>• Only authorized administrators have access to this console.</p>
              <p>• When a new user registers, their account is flagged as &apos;Pending Approval&apos; until approved here.</p>
              <p>• The Chat Monitoring tab allows compliance inspection of all 1-on-1 and group chats.</p>
              <p>• Live GPS Map shows real-time location telemetry of online devices.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
