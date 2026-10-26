import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from 'lucide-react';
import { useSocket } from './SocketContext';
import { Avatar } from '../components/common/Avatar';
import type { UserSummary } from '../types';
import { fullName } from '../utils/helpers';

/** Google's public STUN servers; enough for most home/office NATs (no TURN relay). */
const ICE_SERVERS: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
const RING_TIMEOUT_MS = 30_000;

type Phase = 'outgoing' | 'incoming' | 'connected';

interface CallState {
  phase: Phase;
  conversationId: string;
  peer: Pick<UserSummary, '_id' | 'firstName' | 'lastName' | 'avatar'>;
  video: boolean;
  /** Incoming offer, kept until the callee answers. */
  offer?: RTCSessionDescriptionInit;
}

interface CallContextType {
  startCall: (conversationId: string, peer: CallState['peer'], video: boolean) => void;
  inCall: boolean;
}

const CallContext = createContext<CallContextType>({ startCall: () => {}, inCall: false });

// eslint-disable-next-line react-refresh/only-export-components -- hook is colocated with its provider
export const useCall = () => useContext(CallContext);

const END_MESSAGES: Record<string, string> = {
  declined: 'Call declined',
  busy: 'They are on another call',
  unavailable: 'They are offline right now',
  ended: 'Call ended',
};

/**
 * 1:1 WebRTC calls over the chat socket (signalling: call:offer/answer/ice/end). Mounted once
 * so an incoming call rings on any page.
 */
export function CallProvider({ children }: { children: ReactNode }) {
  const { socket } = useSocket();
  const [call, setCall] = useState<CallState | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const callRef = useRef<CallState | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const ringTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);

  const update = (next: CallState | null) => {
    callRef.current = next;
    setCall(next);
  };

  /** Stops media and closes the connection; optionally tells the peer why. */
  const teardown = useCallback(
    (notify?: 'declined' | 'ended' | 'busy') => {
      const current = callRef.current;
      if (notify && current && socket) socket.emit('call:end', { conversationId: current.conversationId, reason: notify });
      clearTimeout(ringTimer.current);
      pc.current?.close();
      pc.current = null;
      localStream.current?.getTracks().forEach((t) => t.stop());
      localStream.current = null;
      pendingIce.current = [];
      setMuted(false);
      setCameraOff(false);
      update(null);
    },
    [socket]
  );

  /** Camera/mic + a peer connection that forwards ICE candidates through the socket. */
  const prepare = async (conversationId: string, video: boolean) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
    localStream.current = stream;
    if (localVideo.current) localVideo.current.srcObject = stream;

    const conn = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    stream.getTracks().forEach((track) => conn.addTrack(track, stream));
    conn.onicecandidate = (e) => e.candidate && socket?.emit('call:ice', { conversationId, candidate: e.candidate.toJSON() });
    conn.ontrack = (e) => {
      if (remoteVideo.current) remoteVideo.current.srcObject = e.streams[0];
    };
    conn.onconnectionstatechange = () => {
      if (['failed', 'disconnected'].includes(conn.connectionState) && callRef.current) {
        toast.error('Call connection lost');
        teardown('ended');
      }
    };
    pc.current = conn;
    return conn;
  };

  const flushIce = async () => {
    for (const candidate of pendingIce.current.splice(0)) await pc.current?.addIceCandidate(candidate).catch(() => {});
  };

  const startCall = useCallback<CallContextType['startCall']>(
    async (conversationId, peer, video) => {
      if (!socket || callRef.current) return;
      update({ phase: 'outgoing', conversationId, peer, video });
      try {
        const conn = await prepare(conversationId, video);
        const offer = await conn.createOffer();
        await conn.setLocalDescription(offer);
        socket.emit('call:offer', { conversationId, sdp: { type: offer.type, sdp: offer.sdp }, video }, (res: { ok: boolean; error?: string }) => {
          if (!res.ok) {
            toast(END_MESSAGES[res.error ?? ''] ?? res.error ?? 'Call failed');
            teardown();
          }
        });
        ringTimer.current = setTimeout(() => {
          toast('No answer');
          teardown('ended');
        }, RING_TIMEOUT_MS);
      } catch {
        toast.error('Could not access your camera or microphone');
        teardown();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prepare reads refs only
    [socket, teardown]
  );

  const accept = async () => {
    const current = callRef.current;
    if (!current?.offer || !socket) return;
    try {
      const conn = await prepare(current.conversationId, current.video);
      await conn.setRemoteDescription(current.offer);
      await flushIce();
      const answer = await conn.createAnswer();
      await conn.setLocalDescription(answer);
      socket.emit('call:answer', { conversationId: current.conversationId, sdp: { type: answer.type, sdp: answer.sdp } });
      update({ ...current, phase: 'connected', offer: undefined });
    } catch {
      toast.error('Could not access your camera or microphone');
      teardown('ended');
    }
  };

  useEffect(() => {
    if (!socket) return;
    const onOffer = (data: { conversationId: string; from: CallState['peer']; sdp: RTCSessionDescriptionInit; video: boolean }) => {
      if (callRef.current) {
        socket.emit('call:end', { conversationId: data.conversationId, reason: 'busy' });
        return;
      }
      update({ phase: 'incoming', conversationId: data.conversationId, peer: data.from, video: data.video, offer: data.sdp });
      ringTimer.current = setTimeout(() => teardown(), RING_TIMEOUT_MS);
    };
    const onAnswer = async (data: { conversationId: string; sdp: RTCSessionDescriptionInit }) => {
      const current = callRef.current;
      if (!current || current.conversationId !== data.conversationId || !pc.current) return;
      clearTimeout(ringTimer.current);
      await pc.current.setRemoteDescription(data.sdp);
      await flushIce();
      update({ ...current, phase: 'connected' });
    };
    const onIce = async (data: { conversationId: string; candidate: RTCIceCandidateInit }) => {
      if (callRef.current?.conversationId !== data.conversationId) return;
      // Candidates can arrive before the remote description is set; queue them until then.
      if (pc.current?.remoteDescription) await pc.current.addIceCandidate(data.candidate).catch(() => {});
      else pendingIce.current.push(data.candidate);
    };
    const onEnd = (data: { conversationId: string; reason: string }) => {
      if (callRef.current?.conversationId !== data.conversationId) return;
      toast(END_MESSAGES[data.reason] ?? 'Call ended');
      teardown();
    };
    socket.on('call:offer', onOffer);
    socket.on('call:answer', onAnswer);
    socket.on('call:ice', onIce);
    socket.on('call:end', onEnd);
    return () => {
      socket.off('call:offer', onOffer);
      socket.off('call:answer', onAnswer);
      socket.off('call:ice', onIce);
      socket.off('call:end', onEnd);
    };
  }, [socket, teardown]);

  // Re-attach streams when the modal (and its <video> elements) mounts.
  useEffect(() => {
    if (localVideo.current && localStream.current) localVideo.current.srcObject = localStream.current;
  }, [call?.phase]);

  const toggleMute = () => {
    localStream.current?.getAudioTracks().forEach((t) => (t.enabled = muted));
    setMuted(!muted);
  };
  const toggleCamera = () => {
    localStream.current?.getVideoTracks().forEach((t) => (t.enabled = cameraOff));
    setCameraOff(!cameraOff);
  };

  return (
    <CallContext.Provider value={{ startCall, inCall: Boolean(call) }}>
      {children}
      {call && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Call">
          <div className="w-full max-w-3xl rounded-3xl border border-slate-700 bg-slate-900 p-4 sm:p-6">
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-slate-950">
              <video ref={remoteVideo} autoPlay playsInline className={`h-full w-full object-cover ${call.phase === 'connected' && call.video ? '' : 'hidden'}`} />
              {(call.phase !== 'connected' || !call.video) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                  <Avatar src={call.peer.avatar} firstName={call.peer.firstName} lastName={call.peer.lastName} size="xl" className="rounded-full" />
                  <p className="text-lg font-semibold text-white">{fullName(call.peer)}</p>
                  <p className="text-sm text-slate-400">
                    {call.phase === 'outgoing' ? 'Calling…' : call.phase === 'incoming' ? `Incoming ${call.video ? 'video' : 'voice'} call` : 'Connected'}
                  </p>
                </div>
              )}
              {call.video && call.phase !== 'incoming' && (
                <video ref={localVideo} autoPlay playsInline muted className="absolute bottom-3 right-3 w-32 sm:w-44 rounded-xl border border-slate-700 bg-black" />
              )}
            </div>
            <div className="mt-4 flex justify-center gap-3">
              {call.phase === 'incoming' ? (
                <>
                  <button onClick={() => teardown('declined')} className="rounded-full bg-red-600 p-4 text-white hover:bg-red-500 focus-ring" aria-label="Decline">
                    <PhoneOff className="h-6 w-6" />
                  </button>
                  <button onClick={accept} className="rounded-full bg-emerald-600 p-4 text-white hover:bg-emerald-500 focus-ring" aria-label="Accept">
                    {call.video ? <Video className="h-6 w-6" /> : <Phone className="h-6 w-6" />}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={toggleMute} className="rounded-full bg-slate-700 p-4 text-white hover:bg-slate-600 focus-ring" aria-label={muted ? 'Unmute' : 'Mute'}>
                    {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                  </button>
                  {call.video && (
                    <button onClick={toggleCamera} className="rounded-full bg-slate-700 p-4 text-white hover:bg-slate-600 focus-ring" aria-label={cameraOff ? 'Turn camera on' : 'Turn camera off'}>
                      {cameraOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
                    </button>
                  )}
                  <button onClick={() => teardown('ended')} className="rounded-full bg-red-600 p-4 text-white hover:bg-red-500 focus-ring" aria-label="Hang up">
                    <PhoneOff className="h-6 w-6" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </CallContext.Provider>
  );
}
