import React, { useState, useRef } from 'react';
import {
  X,
  Building2,
  MapPin,
  Clock,
  Globe,
  ShieldCheck,
  ShieldAlert,
  Mail,
  Phone,
  Edit2,
  Check,
  Copy,
  LogOut,
  Camera,
  Download,
  ChevronRight,
  Bell,
  Image as ImageIcon
} from 'lucide-react';
import { User } from '../../types/index.js';
import { getAvatarUrl } from '../../utils/avatar.js';
import { compressImage } from '../../utils/imageCompressor.js';
import { isSuperAdmin } from '../../utils/phone.js';

interface BusinessProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  isCurrentUser: boolean;
  onUpdateProfile?: (updated: Partial<User>) => void;
  onLogout?: () => void;
  onOpenWallpaper?: () => void;
  onOpenAdminDashboard?: () => void;
  pendingUsersCount?: number;
}

export const BusinessProfileModal: React.FC<BusinessProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  isCurrentUser,
  onUpdateProfile,
  onLogout,
  onOpenWallpaper,
  onOpenAdminDashboard,
  pendingUsersCount,
}) => {
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [avatar, setAvatar] = useState(user.avatar || '');

  React.useEffect(() => {
    setAvatar(user.avatar || '');
  }, [user.avatar]);
  const [alwaysRequireLogin, setAlwaysRequireLogin] = useState(
    localStorage.getItem('ichat_always_require_login') === 'true'
  );
  const [businessName, setBusinessName] = useState(user.businessName || user.name);
  const [businessCategory, setBusinessCategory] = useState(user.businessCategory || 'Retail & Shopping');
  const [businessDescription, setBusinessDescription] = useState(user.businessDescription || user.about);
  const [businessAddress, setBusinessAddress] = useState(user.businessAddress || '123 Business Avenue, CA');
  const [businessHours, setBusinessHours] = useState(user.businessHours || 'Mon - Fri: 09:00 AM - 06:00 PM');
  const [businessWebsite, setBusinessWebsite] = useState(user.businessWebsite || 'https://mybusiness.com');

  if (!isOpen) return null;

  const handleSave = () => {
    if (onUpdateProfile) {
      onUpdateProfile({
        businessName,
        businessCategory,
        businessDescription,
        businessAddress,
        businessHours,
        businessWebsite,
        isBusiness: true,
      });
    }
    setIsEditing(false);
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const compressedAvatar = await compressImage(file, 256, 0.8);
      setAvatar(compressedAvatar);
      if (onUpdateProfile) {
        onUpdateProfile({ avatar: compressedAvatar });
      }
    } catch (err) {
      console.error('Failed to compress avatar:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-[#202c33] border border-[#2a3942] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Cover / Header */}
        <div className="relative h-28 bg-gradient-to-r from-[#008069] to-[#00a884] flex items-end px-6 pb-3">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Avatar & Title */}
        <div className="px-6 -mt-12 flex items-end justify-between mb-4">
          <div className="relative group/avatar">
            <img
              src={getAvatarUrl(avatar || user.avatar)}
              alt={user.name}
              className="w-24 h-24 rounded-full object-cover border-4 border-[#202c33] shadow-lg"
            />
            {user.isBusiness && (
              <span className="absolute bottom-1 right-1 p-1 bg-[#00a884] rounded-full text-white ring-2 ring-[#202c33]">
                <ShieldCheck className="w-4 h-4" />
              </span>
            )}

            {isCurrentUser && (
              <>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-2 bg-[#00a884] hover:bg-[#008f6f] rounded-full text-white shadow-lg ring-2 ring-[#202c33] transition-transform active:scale-95"
                  title="Change Profile Photo"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input
                  type="file"
                  ref={avatarInputRef}
                  accept="image/*"
                  onChange={handleAvatarFileChange}
                  className="hidden"
                />
              </>
            )}
          </div>

          {isCurrentUser && (
            <button
              onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
              className="px-3 py-1.5 rounded-lg bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              {isEditing ? <Check className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
              {isEditing ? 'Save Changes' : 'Edit Profile'}
            </button>
          )}
        </div>

        {/* Profile Details */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">
                {isEditing ? (
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="bg-[#111b21] border border-[#2a3942] rounded px-2 py-1 text-base text-white w-full"
                  />
                ) : (
                  user.businessName || user.name
                )}
              </h2>
              {user.isBusiness && (
                <span className="text-[#00a884]" title="Official Business Account">
                  <ShieldCheck className="w-5 h-5 inline" />
                </span>
              )}
            </div>
            <p className="text-xs text-[#00a884] font-medium mt-0.5">
              {isEditing ? (
                <input
                  type="text"
                  value={businessCategory}
                  onChange={(e) => setBusinessCategory(e.target.value)}
                  className="bg-[#111b21] border border-[#2a3942] rounded px-2 py-0.5 text-xs text-white w-full mt-1"
                />
              ) : (
                user.businessCategory || 'Official Business Account'
              )}
            </p>
          </div>

          {/* Description */}
          <div className="bg-[#111b21] p-3.5 rounded-xl border border-[#2a3942]">
            <p className="text-xs text-gray-400 mb-1">Description & About</p>
            {isEditing ? (
              <textarea
                value={businessDescription}
                onChange={(e) => setBusinessDescription(e.target.value)}
                rows={3}
                className="w-full bg-[#202c33] border border-[#2a3942] rounded px-2 py-1 text-xs text-white"
              />
            ) : (
              <p className="text-xs text-gray-200 leading-relaxed">
                {user.businessDescription || user.about}
              </p>
            )}
          </div>

          {/* User ID Row (for adding as contact) */}
          <div className="flex items-center justify-between bg-[#111b21] p-3 rounded-xl border border-[#2a3942] text-xs">
            <div>
              <span className="text-[10px] text-gray-400 block uppercase font-medium">User ID (Share to add contact)</span>
              <span className="text-gray-200 font-mono text-xs select-all">{user.id}</span>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(user.id);
                setCopiedId(true);
                setTimeout(() => setCopiedId(false), 2000);
              }}
              className="px-2.5 py-1 bg-[#202c33] hover:bg-[#2a3942] rounded text-[11px] text-[#00a884] font-medium transition-colors flex items-center gap-1.5"
            >
              {copiedId ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedId ? 'Copied' : 'Copy ID'}
            </button>
          </div>

          {/* Business Details List */}
          <div className="space-y-3 bg-[#111b21] p-4 rounded-xl border border-[#2a3942] text-xs">
            {/* Phone */}
            <div className="flex items-center gap-3 text-gray-300">
              <Phone className="w-4 h-4 text-[#00a884] flex-shrink-0" />
              <span>{user.phone}</span>
            </div>

            {/* Address */}
            <div className="flex items-start gap-3 text-gray-300">
              <MapPin className="w-4 h-4 text-[#00a884] flex-shrink-0 mt-0.5" />
              {isEditing ? (
                <input
                  type="text"
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  className="w-full bg-[#202c33] border border-[#2a3942] rounded px-2 py-0.5 text-xs text-white"
                />
              ) : (
                <span>{user.businessAddress || '450 Innovation Way, Silicon Valley, CA'}</span>
              )}
            </div>

            {/* Hours */}
            <div className="flex items-start gap-3 text-gray-300">
              <Clock className="w-4 h-4 text-[#00a884] flex-shrink-0 mt-0.5" />
              {isEditing ? (
                <input
                  type="text"
                  value={businessHours}
                  onChange={(e) => setBusinessHours(e.target.value)}
                  className="w-full bg-[#202c33] border border-[#2a3942] rounded px-2 py-0.5 text-xs text-white"
                />
              ) : (
                <div className="whitespace-pre-line">{user.businessHours || 'Open: Mon - Fri (08:00 AM - 08:00 PM)'}</div>
              )}
            </div>

            {/* Website */}
            <div className="flex items-center gap-3 text-gray-300">
              <Globe className="w-4 h-4 text-[#00a884] flex-shrink-0" />
              {isEditing ? (
                <input
                  type="url"
                  value={businessWebsite}
                  onChange={(e) => setBusinessWebsite(e.target.value)}
                  className="w-full bg-[#202c33] border border-[#2a3942] rounded px-2 py-0.5 text-xs text-white"
                />
              ) : (
                <a
                  href={user.businessWebsite || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#00a884] hover:underline"
                >
                  {user.businessWebsite || 'https://officialbusiness.com'}
                </a>
              )}
            </div>
          </div>

          {/* Quick Actions (Admin Console & Download Android APK) */}
          {isCurrentUser && (
            <div className="space-y-2.5">
              {/* Admin Console Card (Only for admin) */}
              {isSuperAdmin(user) && onOpenAdminDashboard && (
                <div
                  onClick={() => {
                    onClose();
                    onOpenAdminDashboard();
                  }}
                  className="p-3.5 bg-gradient-to-r from-amber-500/15 via-[#111b21] to-[#111b21] border border-amber-500/30 hover:border-amber-500/60 rounded-xl cursor-pointer transition-all flex items-center justify-between group shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <ShieldAlert className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white group-hover:text-amber-300 transition-colors">
                          Admin Console
                        </span>
                        {pendingUsersCount !== undefined && pendingUsersCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500 text-black text-[9px] font-black animate-pulse">
                            {pendingUsersCount} pending
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#8696a0] mt-0.5">
                        Approve users & monitor active chats
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-amber-400/80 group-hover:translate-x-1 transition-transform" />
                </div>
              )}

              {/* Download Android APK Card */}
              <a
                href="/download/ichat.apk"
                download="ichat.apk"
                className="p-3.5 bg-gradient-to-r from-[#00a884]/15 via-[#111b21] to-[#111b21] border border-[#00a884]/30 hover:border-[#00a884]/60 rounded-xl transition-all flex items-center justify-between group shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#00a884]/20 text-[#00a884] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Download className="w-5 h-5 text-[#00a884]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white group-hover:text-[#00a884] transition-colors">
                        Download Android App (APK)
                      </span>
                      <span className="px-1.5 py-0.5 bg-[#00a884]/25 text-[#00a884] text-[9px] font-bold rounded">
                        v1.0.0
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8696a0] mt-0.5">
                      Install on phone for lock screen incoming calls
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#00a884] group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          )}

          {/* Security & App Access Settings */}
          {isCurrentUser && (
            <div className="bg-[#111b21] p-4 rounded-xl border border-[#2a3942] space-y-3">
              <div className="flex items-center gap-2 text-white font-semibold text-xs">
                <ShieldCheck className="w-4 h-4 text-[#00a884]" />
                <span>Security & App Settings</span>
              </div>

              {/* Toggle Require Login Every Time */}
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white">Require Login Every Time</p>
                  <p className="text-[11px] text-[#8696a0] mt-0.5">
                    Always prompt for login when opening IChat.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !alwaysRequireLogin;
                    setAlwaysRequireLogin(next);
                    localStorage.setItem('ichat_always_require_login', next ? 'true' : 'false');
                  }}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors flex-shrink-0 ${
                    alwaysRequireLogin ? 'bg-[#00a884] justify-end' : 'bg-[#2a3942] justify-start'
                  }`}
                  title={alwaysRequireLogin ? 'Enabled' : 'Disabled'}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>

              {/* Wallpaper Shortcut */}
              {onOpenWallpaper && (
                <div className="pt-2.5 border-t border-[#2a3942]/60 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white">Chat Background Image</p>
                    <p className="text-[11px] text-[#8696a0] mt-0.5">
                      Change chat wallpaper and colors.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenWallpaper();
                    }}
                    className="px-3 py-1.5 bg-[#202c33] hover:bg-[#2a3942] text-[#00a884] rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 flex-shrink-0"
                  >
                    <ImageIcon className="w-3.5 h-3.5" /> Change
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Sign Out Button (when viewing current user's profile) */}
          {isCurrentUser && onLogout && (
            <div className="pt-2">
              <button
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold flex items-center justify-center gap-2 transition-colors border border-red-500/20"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
