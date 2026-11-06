import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  Video,
  PhoneMissed,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Clock,
  PhoneCall,
  RefreshCw
} from 'lucide-react';
import { Call, User } from '../../types/index.js';

interface CallsHistoryModalProps {
  currentUser: User;
  onClose: () => void;
  onStartCall: (targetUser: User, isVideo: boolean) => void;
}

export const CallsHistoryModal: React.FC<CallsHistoryModalProps> = ({
  currentUser,
  onClose,
  onStartCall,
}) => {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'missed'>('all');

  const fetchCalls = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/calls?userId=${currentUser.id}`);
      if (res.ok) {
        const data: Call[] = await res.json();
        setCalls(data);
      }
    } catch (err) {
      console.error('Error fetching calls history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, [currentUser.id]);

  const filteredCalls = calls.filter((c) => {
    if (filter === 'missed') {
      return (
        (c.status === 'missed' || c.status === 'declined') &&
        c.callerId !== currentUser.id
      );
    }
    return true;
  });

  const formatCallTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) {
      return `Today, ${timeStr}`;
    }
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#202c33] border border-[#2a3942] rounded-2xl w-full max-w-lg max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="px-4 py-3.5 bg-[#111b21] border-b border-[#2a3942] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#00a884]/20 text-[#00a884] flex items-center justify-center">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Call History</h3>
              <p className="text-[11px] text-[#8696a0]">
                {calls.length} {calls.length === 1 ? 'call record' : 'call records'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={fetchCalls}
              className="p-2 rounded-full text-[#8696a0] hover:text-white hover:bg-[#202c33] transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full text-[#8696a0] hover:text-white hover:bg-[#202c33] transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters Tab */}
        <div className="flex items-center px-4 py-2 bg-[#182229] border-b border-[#2a3942] gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              filter === 'all'
                ? 'bg-[#00a884] text-white'
                : 'text-[#8696a0] hover:text-white hover:bg-[#202c33]'
            }`}
          >
            All Calls ({calls.length})
          </button>
          <button
            onClick={() => setFilter('missed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              filter === 'missed'
                ? 'bg-rose-500 text-white'
                : 'text-[#8696a0] hover:text-white hover:bg-[#202c33]'
            }`}
          >
            Missed ({calls.filter((c) => (c.status === 'missed' || c.status === 'declined') && c.callerId !== currentUser.id).length})
          </button>
        </div>

        {/* Call List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-[#2a3942]/30">
          {loading && calls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[#8696a0] gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#00a884]" />
              <p className="text-xs">Loading call history...</p>
            </div>
          ) : filteredCalls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#8696a0] text-center px-4">
              <div className="w-16 h-16 rounded-full bg-[#111b21] flex items-center justify-center mb-3">
                <PhoneMissed className="w-8 h-8 text-[#8696a0]/50" />
              </div>
              <h4 className="text-sm font-semibold text-white mb-1">No call history</h4>
              <p className="text-xs text-[#8696a0] max-w-xs">
                {filter === 'missed'
                  ? 'You have no missed calls at this time.'
                  : 'Start a voice or video call with any contact from their chat window!'}
              </p>
            </div>
          ) : (
            filteredCalls.map((call) => {
              const isOutgoing = call.callerId === currentUser.id;
              const partner = isOutgoing ? call.receiver : call.caller;
              const partnerName = partner?.name || (isOutgoing ? 'User' : 'Incoming Caller');
              const partnerAvatar =
                partner?.avatar ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
              const isVideo = call.type === 'video';
              const isMissed =
                call.status === 'missed' ||
                call.status === 'declined' ||
                call.status === 'ringing';
              const durationStr = formatDuration(call.duration);

              return (
                <div
                  key={call.id}
                  className="pt-2 first:pt-0 flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-[#111b21]/70 transition-colors"
                >
                  {/* Left: Avatar + Details */}
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={partnerAvatar}
                      alt={partnerName}
                      className="w-11 h-11 rounded-full object-cover ring-2 ring-[#2a3942] flex-shrink-0"
                    />

                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-white truncate max-w-[170px] sm:max-w-xs">
                        {partnerName}
                      </h4>

                      <div className="flex items-center gap-1.5 mt-0.5">
                        {/* Call Direction & Type Indicator */}
                        {isOutgoing ? (
                          <ArrowUpRight className="w-3.5 h-3.5 text-[#00a884] flex-shrink-0" />
                        ) : isMissed ? (
                          <ArrowDownLeft className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                        ) : (
                          <ArrowDownLeft className="w-3.5 h-3.5 text-[#00a884] flex-shrink-0" />
                        )}

                        <span
                          className={`text-xs ${
                            isMissed ? 'text-rose-400 font-medium' : 'text-[#8696a0]'
                          }`}
                        >
                          {isOutgoing
                            ? 'Outgoing'
                            : isMissed
                            ? call.status === 'declined'
                              ? 'Declined'
                              : 'Missed'
                            : 'Incoming'}
                          {isVideo ? ' Video' : ' Voice'}
                        </span>

                        {durationStr && (
                          <span className="text-xs text-[#8696a0] font-mono">
                            • {durationStr}
                          </span>
                        )}
                      </div>

                      <p className="text-[10px] text-[#8696a0] mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#8696a0]/70" />
                        <span>{formatCallTime(call.startedAt)}</span>
                      </p>
                    </div>
                  </div>

                  {/* Right: Call Back Actions */}
                  {partner && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => {
                          onClose();
                          onStartCall(partner, false);
                        }}
                        className="p-2.5 rounded-full bg-[#111b21] hover:bg-[#00a884] text-[#8696a0] hover:text-white transition-all shadow-sm active:scale-95"
                        title={`Voice Call ${partnerName}`}
                      >
                        <Phone className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          onClose();
                          onStartCall(partner, true);
                        }}
                        className="p-2.5 rounded-full bg-[#111b21] hover:bg-[#00a884] text-[#8696a0] hover:text-white transition-all shadow-sm active:scale-95"
                        title={`Video Call ${partnerName}`}
                      >
                        <Video className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
