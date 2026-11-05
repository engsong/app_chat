import React, { useState } from 'react';
import { X, Building2, MapPin, Clock, Globe, ShieldCheck, Mail, Phone, Edit2, Check } from 'lucide-react';
import { User } from '../../types/index.js';

interface BusinessProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  isCurrentUser: boolean;
  onUpdateProfile?: (updated: Partial<User>) => void;
}

export const BusinessProfileModal: React.FC<BusinessProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  isCurrentUser,
  onUpdateProfile,
}) => {
  const [isEditing, setIsEditing] = useState(false);
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
          <div className="relative">
            <img
              src={user.avatar || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=150'}
              alt={user.name}
              className="w-24 h-24 rounded-full object-cover border-4 border-[#202c33] shadow-lg"
            />
            {user.isBusiness && (
              <span className="absolute bottom-1 right-1 p-1 bg-[#00a884] rounded-full text-white ring-2 ring-[#202c33]">
                <ShieldCheck className="w-4 h-4" />
              </span>
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
        </div>
      </div>
    </div>
  );
};
