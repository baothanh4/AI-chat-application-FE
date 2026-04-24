import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Phone, Video, Mic, MicOff, VideoOff, PhoneOff, Camera } from 'lucide-react';
import api from '../services/api';
import '../assets/CallUI.css';

const CallContext = createContext();

export const useCall = () => useContext(CallContext);

export const CallProvider = ({ children, stompClient, connected, currentUser }) => {
  const [incomingCall, setIncomingCall] = useState(null);
  const [outgoingCall, setOutgoingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [localStream, setLocalStreamState] = useState(null);
  const localStreamRef = useRef(null);

  const setLocalStream = (stream) => {
    localStreamRef.current = stream;
    setLocalStreamState(stream);
  };
  const [remoteStream, setRemoteStream] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  const peerConnectionRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const STUN_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, activeCall, outgoingCall]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, activeCall]);

  // Handle incoming STOMP messages
  useEffect(() => {
    if (!stompClient || !connected || !currentUser) return;

    const subscription = stompClient.subscribe(`/topic/users/${currentUser.id}/calls`, async (message) => {
      const signal = JSON.parse(message.body);
      handleSignalingMessage(signal);
    });

    return () => subscription.unsubscribe();
  }, [stompClient, connected, currentUser]);

  const sendSignal = (toUserId, type, payload = {}, mode = 'VIDEO', conversationId) => {
    if (!stompClient) return;
    const req = {
      conversationId: conversationId,
      fromUserId: currentUser.id,
      toUserId: toUserId,
      type: type,
      mode: mode,
      payload: payload
    };
    stompClient.publish({
      destination: '/app/call.signal',
      body: JSON.stringify(req)
    });
  };

  const createPeerConnection = (toUserId, conversationId, mode) => {
    const pc = new RTCPeerConnection(STUN_SERVERS);
    peerConnectionRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(toUserId, 'ICE_CANDIDATE', { candidate: event.candidate }, mode, conversationId);
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
    }

    return pc;
  };

  const getMedia = async (mode) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: mode === 'VIDEO',
        audio: true
      });
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error('Error accessing media devices:', err);
      alert('Cannot access camera or microphone. Please check permissions.');
      return null;
    }
  };

  const stopMedia = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setRemoteStream(null);
  };

  const closePeerConnection = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  };

  const resetCallState = () => {
    setIncomingCall(null);
    setOutgoingCall(null);
    setActiveCall(null);
    stopMedia();
    closePeerConnection();
    setIsAudioMuted(false);
    setIsVideoMuted(false);
  };

  const handleSignalingMessage = async (signal) => {
    const { type, fromUserId, conversationId, mode, payload } = signal;

    if (type === 'ERROR') {
      alert(`Call error: ${payload.message}`);
      resetCallState();
      return;
    }

    if (type === 'INVITE') {
      setIncomingCall({ callerId: fromUserId, conversationId, mode });
    }

    if (type === 'CANCEL' || type === 'REJECT') {
      resetCallState();
    }

    if (type === 'ACCEPT') {
      // Caller receives accept, creates offer
      setOutgoingCall(null);
      setActiveCall({ peerId: fromUserId, conversationId, mode });
      
      const pc = createPeerConnection(fromUserId, conversationId, mode);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal(fromUserId, 'OFFER', { sdp: offer }, mode, conversationId);
    }

    if (type === 'OFFER') {
      // Callee receives offer, creates answer
      if (!peerConnectionRef.current) {
         createPeerConnection(fromUserId, conversationId, mode);
      }
      const pc = peerConnectionRef.current;
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal(fromUserId, 'ANSWER', { sdp: answer }, mode, conversationId);
    }

    if (type === 'ANSWER') {
      // Caller receives answer
      const pc = peerConnectionRef.current;
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      }
    }

    if (type === 'ICE_CANDIDATE') {
      const pc = peerConnectionRef.current;
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch (e) {
          console.error('Error adding received ice candidate', e);
        }
      }
    }

    if (type === 'END') {
      resetCallState();
    }
  };

  // Exposed Context Functions
  const startCall = async (calleeId, conversationId, mode) => {
    const stream = await getMedia(mode);
    if (!stream) return;

    setOutgoingCall({ calleeId, conversationId, mode });
    sendSignal(calleeId, 'INVITE', {}, mode, conversationId);
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    const { callerId, conversationId, mode } = incomingCall;
    
    const stream = await getMedia(mode);
    if (!stream) {
      rejectCall();
      return;
    }

    setActiveCall({ peerId: callerId, conversationId, mode });
    setIncomingCall(null);
    sendSignal(callerId, 'ACCEPT', {}, mode, conversationId);
  };

  const rejectCall = () => {
    if (incomingCall) {
      sendSignal(incomingCall.callerId, 'REJECT', {}, incomingCall.mode, incomingCall.conversationId);
      resetCallState();
    }
  };

  const cancelCall = () => {
    if (outgoingCall) {
      sendSignal(outgoingCall.calleeId, 'CANCEL', {}, outgoingCall.mode, outgoingCall.conversationId);
      resetCallState();
    }
  };

  const endCall = () => {
    if (activeCall) {
      sendSignal(activeCall.peerId, 'END', {}, activeCall.mode, activeCall.conversationId);
      resetCallState();
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => t.enabled = !t.enabled);
      setIsAudioMuted(!isAudioMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => t.enabled = !t.enabled);
      setIsVideoMuted(!isVideoMuted);
    }
  };

  return (
    <CallContext.Provider value={{ startCall }}>
      {children}

      {/* Incoming Call Overlay */}
      {incomingCall && (
        <div className="call-overlay glass">
          <div className="call-box">
            <div className="call-avatar animate-pulse">
               <Phone size={40} className="call-icon" />
            </div>
            <h2>Incoming {incomingCall.mode === 'VIDEO' ? 'Video' : 'Audio'} Call</h2>
            <p>Someone is calling you...</p>
            <div className="call-actions">
              <button className="btn-reject" onClick={rejectCall}>
                <PhoneOff size={24} /> Decline
              </button>
              <button className="btn-accept" onClick={acceptCall}>
                {incomingCall.mode === 'VIDEO' ? <Video size={24} /> : <Phone size={24} />} Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Outgoing Call Overlay */}
      {outgoingCall && (
        <div className="call-overlay glass">
          <div className="call-box">
            <div className="call-avatar animate-bounce">
               <Phone size={40} className="call-icon" />
            </div>
            <h2>Calling...</h2>
            <p>Waiting for answer...</p>
            <div className="call-actions">
              <button className="btn-reject" onClick={cancelCall}>
                <PhoneOff size={24} /> Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Call UI */}
      {activeCall && (
        <div className="active-call-overlay">
          <div className="video-container">
            {/* Remote Video */}
            <video 
               ref={remoteVideoRef} 
               autoPlay 
               playsInline 
               className={`remote-video ${activeCall.mode === 'AUDIO' ? 'hidden' : ''}`} 
            />
            
            {/* Audio Only Mode Placeholder */}
            {activeCall.mode === 'AUDIO' && (
              <div className="audio-call-placeholder">
                <div className="audio-avatar pulse-animation">
                   <Phone size={64} />
                </div>
                <h2>Audio Call Active</h2>
                <audio ref={remoteVideoRef} autoPlay />
              </div>
            )}

            {/* Local Video Picture-in-Picture */}
            <video 
               ref={localVideoRef} 
               autoPlay 
               playsInline 
               muted 
               className={`local-video ${activeCall.mode === 'AUDIO' ? 'hidden' : ''}`} 
            />

            <div className="call-controls glass">
              <button className={`control-btn ${isAudioMuted ? 'muted' : ''}`} onClick={toggleAudio}>
                {isAudioMuted ? <MicOff size={24} /> : <Mic size={24} />}
              </button>
              
              {activeCall.mode === 'VIDEO' && (
                <button className={`control-btn ${isVideoMuted ? 'muted' : ''}`} onClick={toggleVideo}>
                  {isVideoMuted ? <VideoOff size={24} /> : <Video size={24} />}
                </button>
              )}

              <button className="control-btn end-call" onClick={endCall}>
                <PhoneOff size={24} />
              </button>
            </div>
          </div>
        </div>
      )}

    </CallContext.Provider>
  );
};
