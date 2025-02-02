import React, { useEffect, useState, useRef, useCallback } from "react";
import localforage from "localforage";

import Warning from "./warning/Warning";
import MetadataTracker from '../Content/trackers/MetadataTracker';
import CursorTracker from '../Content/trackers/CursorTracker';

localforage.config({
  driver: localforage.INDEXEDDB, // or choose another driver
  name: "screenity", // optional
  version: 1, // optional
});

// Get chunks store
const chunksStore = localforage.createInstance({
  name: "chunks",
});

const Recorder = () => {
  const isRestarting = useRef(false);
  const isFinishing = useRef(false);
  const sentLast = useRef(false);
  const lastTimecode = useRef(0);
  const hasChunks = useRef(false);

  const index = useRef(0);

  const [started, setStarted] = useState(false);

  // Main stream (recording)
  const liveStream = useRef(null);

  // Helper streams
  const helperVideoStream = useRef(null);
  const helperAudioStream = useRef(null);

  // Audio controls, with refs to persist across renders
  const aCtx = useRef(null);
  const destination = useRef(null);
  const audioInputSource = useRef(null);
  const audioOutputSource = useRef(null);
  const audioInputGain = useRef(null);
  const audioOutputGain = useRef(null);

  const recorder = useRef(null);

  const isTab = useRef(false);
  const tabID = useRef(null);
  const tabPreferred = useRef(false);

  const backupRef = useRef(false);

  const metadataTracker = useRef(null);
  const cursorTracker = useRef(null);

  useEffect(() => {
    chrome.storage.local.get(["backup"], (result) => {
      if (result.backup) {
        backupRef.current = true;
      } else {
        backupRef.current = false;
      }
    });
  }, []);

  useEffect(() => {
    // Clear any existing data on mount
    chunksStore.clear();
    console.log('Cleared existing chunks store');

    // Initialize trackers
    metadataTracker.current = new MetadataTracker();
    cursorTracker.current = new CursorTracker();
    console.log('Initialized trackers');

    return () => {
      // Cleanup on unmount
      if (metadataTracker.current) metadataTracker.current.clearData();
      if (cursorTracker.current) cursorTracker.current.clearData();
    };
  }, []);

  async function startRecording() {
    if (recorder.current !== null) return;

    try {
      // Clear all stores
      await Promise.all([
        chunksStore.clear(),
        metadataTracker.current?.clearData(),
        cursorTracker.current?.clearData()
      ]);
      console.log('Cleared all stores');

      // Start tracking directly in recorder for all recording modes
      if (cursorTracker.current) {
        await cursorTracker.current.startTracking();
        console.log('[Recorder] Started cursor tracking');
      }
      
      if (metadataTracker.current) {
        await metadataTracker.current.startTracking();
        console.log('[Recorder] Started metadata tracking');
      }

      if (!helperVideoStream.current || helperVideoStream.current.getVideoTracks().length === 0) {
        throw new Error("No video tracks available");
      }

      console.log('Video tracks available:', helperVideoStream.current.getVideoTracks().length);

      const { qualityValue } = await chrome.storage.local.get(["qualityValue"]);
      console.log('Recording quality:', qualityValue);

      // Set more conservative bitrates
      let audioBitsPerSecond = 64000; // Reduced from 128000
      let videoBitsPerSecond = 2500000; // Reduced from 5000000

      if (qualityValue === "4k") {
        audioBitsPerSecond = 128000;
        videoBitsPerSecond = 8000000;
      } else if (qualityValue === "1080p") {
        audioBitsPerSecond = 96000;
        videoBitsPerSecond = 4000000;
      } else if (qualityValue === "720p") {
        audioBitsPerSecond = 64000;
        videoBitsPerSecond = 2500000;
      } else {
        // For all lower qualities, use most conservative settings
        audioBitsPerSecond = 32000;
        videoBitsPerSecond = 1000000;
      }

      console.log('Using bitrates:', { audioBitsPerSecond, videoBitsPerSecond });

      // Try simpler codec first
      const mimeType = "video/webm;codecs=vp8,opus";
      console.log('Using mime type:', mimeType);

      if (!MediaRecorder.isTypeSupported(mimeType)) {
        throw new Error(`Mime type ${mimeType} not supported`);
      }

      recorder.current = new MediaRecorder(liveStream.current, {
        mimeType,
        audioBitsPerSecond,
        videoBitsPerSecond,
      });

      console.log('MediaRecorder created with settings:', recorder.current);

      chrome.storage.local.set({
        recording: true,
        restarting: false,
      });

      isRestarting.current = false;
      index.current = 0;

      // Use 2-second chunks for better stability
      recorder.current.start(2000);
      console.log('Recording started with 2-second chunks');

      recorder.current.ondataavailable = async (e) => {
        try {
          if (e.data && e.data.size > 0) {
            console.log(`Received chunk ${index.current}, size: ${e.data.size} bytes`);
            
            // Store video chunk
            await chunksStore.setItem(`chunk_${index.current}`, {
              index: index.current,
              chunk: e.data,
              timestamp: Date.now()
            });

            // Add chunk metadata (if tracker is active)
            if (metadataTracker.current) {
              await metadataTracker.current.addChunkMetadata(index.current, {
                quality: qualityValue
              });
            }

            // Check storage usage
            const { quota, usage } = await navigator.storage.estimate();
            const usedPercentage = (usage / quota) * 100;
            console.log(`Storage usage: ${usedPercentage.toFixed(2)}%`);
            
            if (usedPercentage > 85) {
              console.warn('Storage usage critical, stopping recording');
              await stopRecording();
              chrome.runtime.sendMessage({ 
                type: "recording-error",
                error: "memory-full",
                why: `Storage usage at ${usedPercentage.toFixed(2)}%`
              });
              return;
            }

            index.current++;
          } else {
            console.warn('Received empty chunk or zero size chunk');
          }
        } catch (err) {
          console.error('Error handling chunk:', err);
          await stopRecording();
          chrome.runtime.sendMessage({ 
            type: "recording-error",
            error: "chunk-error",
            why: err.message
          });
        }
      };

      recorder.current.onerror = async (err) => {
        console.error('MediaRecorder error:', err);
        await stopRecording();
        chrome.runtime.sendMessage({ 
          type: "recording-error",
          error: "recorder-error",
          why: err.message
        });
      };

    } catch (err) {
      console.error('Error starting recording:', err);
      chrome.runtime.sendMessage({
        type: "recording-error",
        error: "start-error",
        why: err.message
      });
    }
  }

  async function stopRecording() {
    try {
      console.log('Stopping recording');
      isFinishing.current = true;

      // Stop trackers and collect data
      let cursorEvents = [];
      let metadata = null;

      if (cursorTracker.current) {
        await cursorTracker.current.stopTracking();
        cursorEvents = await cursorTracker.current.getAllEvents();
        console.log('[Recorder] Cursor events collected:', cursorEvents.length);
      }

      if (metadataTracker.current) {
        await metadataTracker.current.stopTracking();
        metadata = await metadataTracker.current.getRecordingMetadata();
        console.log('[Recorder] Metadata collected:', metadata);
      }

      // Store tracking data in chrome.storage.local
      await chrome.storage.local.set({
        trackingData: {
          cursorEvents,
          metadata
        }
      });
      console.log('[Recorder] Tracking data stored in chrome.storage.local');

      // Stop recording
      if (recorder.current && recorder.current.state !== 'inactive') {
        recorder.current.stop();
        console.log('Stopped MediaRecorder');
      }
      recorder.current = null;

      // Stop all tracks
      const streams = [liveStream.current, helperVideoStream.current, helperAudioStream.current];
      streams.forEach(stream => {
        if (stream) {
          stream.getTracks().forEach(track => {
            track.stop();
            console.log(`Stopped track: ${track.kind}`);
          });
        }
      });

      liveStream.current = null;
      helperVideoStream.current = null;
      helperAudioStream.current = null;

      // Get final counts
      const chunkKeys = await chunksStore.keys();

      console.log(`Recording finished:
        - ${chunkKeys.length} video chunks
        - ${cursorEvents.length || 0} cursor events
        - Duration: ${metadata?.duration ? (metadata.duration / 1000).toFixed(1) + 's' : 'unknown'}
      `);

      // After successful recording, export tracking data
      try {
        const trackingData = await exportTrackingData();
        console.log('Successfully exported tracking data');
      } catch (err) {
        console.error('Failed to export tracking data:', err);
      }

      chrome.runtime.sendMessage({ type: "video-ready" });
    } catch (err) {
      console.error('Error stopping recording:', err);
      chrome.runtime.sendMessage({ 
        type: "recording-error",
        error: "stop-error",
        why: err.message
      });
    }
  }

  const dismissRecording = async () => {
    isRestarting.current = true;
    if (recorder.current !== null) {
      recorder.current.stop();
      recorder.current = null;
    }
    window.close();
  };

  const restartRecording = async () => {
    isRestarting.current = true;
    if (recorder.current !== null) {
      recorder.current.stop();
    }
    recorder.current = null;
    chrome.runtime.sendMessage({ type: "new-sandbox-page-restart" });
  };

  async function startAudioStream(id) {
    const audioStreamOptions = {
      mimeType: "video/webm;codecs=vp8,opus",
      audio: {
        deviceId: {
          exact: id,
        },
      },
    };

    const result = await navigator.mediaDevices
      .getUserMedia(audioStreamOptions)
      .then((stream) => {
        return stream;
      })
      .catch((err) => {
        // Try again without the device ID
        const audioStreamOptions = {
          mimeType: "video/webm;codecs=vp8,opus",
          audio: true,
        };

        return navigator.mediaDevices
          .getUserMedia(audioStreamOptions)
          .then((stream) => {
            return stream;
          })
          .catch((err) => {
            return null;
          });
      });

    return result;
  }
  // Set audio input volume
  function setAudioInputVolume(volume) {
    audioInputGain.current.gain.value = volume;
  }

  // Set audio output volume
  function setAudioOutputVolume(volume) {
    audioOutputGain.current.gain.value = volume;
  }

  const setMic = async (result) => {
    if (helperAudioStream.current != null) {
      if (result.active) {
        setAudioInputVolume(1);
      } else {
        setAudioInputVolume(0);
      }
    } else {
      // No microphone available
    }
  };

  async function startStream(data, id, options, permissions, permissions2) {
    // Get quality value
    const { qualityValue } = await chrome.storage.local.get(["qualityValue"]);

    let width = 1920;
    let height = 1080;

    if (qualityValue === "4k") {
      width = 4096;
      height = 2160;
    } else if (qualityValue === "1080p") {
      width = 1920;
      height = 1080;
    } else if (qualityValue === "720p") {
      width = 1280;
      height = 720;
    } else if (qualityValue === "480p") {
      width = 854;
      height = 480;
    } else if (qualityValue === "360p") {
      width = 640;
      height = 360;
    } else if (qualityValue === "240p") {
      width = 426;
      height = 240;
    }

    const { fpsValue } = await chrome.storage.local.get(["fpsValue"]);
    let fps = parseInt(fpsValue);

    // Check if fps is a number
    if (isNaN(fps)) {
      fps = 30;
    }

    // Check if the user selected a tab in desktopcapture
    let userConstraints = {
      audio: {
        deviceId: data.defaultAudioInput,
      },
      video: {
        deviceId: data.defaultVideoInput,
        width: {
          ideal: width,
        },
        height: {
          ideal: height,
        },
        frameRate: {
          ideal: fps,
        },
      },
    };
    if (permissions.state === "denied") {
      userConstraints.video = false;
    }
    if (permissions2.state === "denied") {
      userConstraints.audio = false;
    }

    let userStream;
    if (
      permissions.state != "denied" &&
      permissions2.state != "denied" &&
      data.recordingType === "camera"
    ) {
      userStream = await navigator.mediaDevices.getUserMedia(userConstraints);
    }

    // Save the helper streams
    if (data.recordingType === "camera") {
      helperVideoStream.current = userStream;
    } else {
      const constraints = {
        audio: {
          mandatory: {
            chromeMediaSource: isTab.current ? "tab" : "desktop",
            chromeMediaSourceId: id,
          },
        },
        video: {
          mandatory: {
            chromeMediaSource: isTab.current ? "tab" : "desktop",
            chromeMediaSourceId: id,
            maxWidth: width,
            maxHeight: height,
            maxFrameRate: fps,
          },
        },
      };

      let stream;

      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);

        // Check if the stream actually has data in it
        if (stream.getVideoTracks().length === 0) {
          chrome.runtime.sendMessage({
            type: "recording-error",
            error: "stream-error",
            why: "No video tracks available",
          });
          return;
        }
      } catch (err) {
        chrome.runtime.sendMessage({
          type: "recording-error",
          error: "stream-error",
          why: JSON.stringify(err),
        });
        return;
      }

      if (isTab.current) {
        // Continue to play the captured audio to the user.
        const output = new AudioContext();
        const source = output.createMediaStreamSource(stream);
        source.connect(output.destination);
      }

      helperVideoStream.current = stream;

      const surface = stream.getVideoTracks()[0].getSettings().displaySurface;
      chrome.runtime.sendMessage({ type: "set-surface", surface: surface });
    }

    // Create an audio context, destination, and stream
    aCtx.current = new AudioContext();
    destination.current = aCtx.current.createMediaStreamDestination();
    liveStream.current = new MediaStream();

    const micstream = await startAudioStream(data.defaultAudioInput);
    helperAudioStream.current = micstream;

    // Check if micstream has an audio track
    if (
      helperAudioStream.current != null &&
      helperAudioStream.current.getAudioTracks().length > 0
    ) {
      audioInputGain.current = aCtx.current.createGain();
      audioInputSource.current = aCtx.current.createMediaStreamSource(
        helperAudioStream.current
      );
      audioInputSource.current
        .connect(audioInputGain.current)
        .connect(destination.current);
    } else {
      // No microphone available
    }

    if (helperAudioStream.current != null && !data.micActive) {
      setAudioInputVolume(0);
    }

    // Check if stream has an audio track
    if (helperVideoStream.current.getAudioTracks().length > 0) {
      audioOutputGain.current = aCtx.current.createGain();
      audioOutputSource.current = aCtx.current.createMediaStreamSource(
        helperVideoStream.current
      );
      audioOutputSource.current
        .connect(audioOutputGain.current)
        .connect(destination.current);
    } else {
      // No system audio available
    }

    // Add the tracks to the stream
    liveStream.current.addTrack(helperVideoStream.current.getVideoTracks()[0]);
    if (
      (helperAudioStream.current != null &&
        helperAudioStream.current.getAudioTracks().length > 0) ||
      helperVideoStream.current.getAudioTracks().length > 0
    ) {
      liveStream.current.addTrack(
        destination.current.stream.getAudioTracks()[0]
      );
    }

    // Send message to go back to the previously active tab
    setStarted(true);

    chrome.runtime.sendMessage({ type: "reset-active-tab" });
  }

  async function startStreaming(data) {
    // Check user permissions for camera and microphone individually
    const permissions = await navigator.permissions.query({
      name: "camera",
    });
    const permissions2 = await navigator.permissions.query({
      name: "microphone",
    });

    try {
      if (data.recordingType === "camera") {
        startStream(data, null, null, permissions, permissions2);
      } else if (!isTab.current) {
        let captureTypes = ["screen", "window", "tab", "audio"];
        if (tabPreferred.current) {
          captureTypes = ["tab", "screen", "window", "audio"];
        }
        chrome.desktopCapture.chooseDesktopMedia(
          captureTypes,
          null,
          (streamId, options) => {
            if (
              streamId === undefined ||
              streamId === null ||
              streamId === ""
            ) {
              chrome.runtime.sendMessage({
                type: "recording-error",
                error: "cancel-modal",
                why: "User cancelled the modal",
              });
              return;
            } else {
              startStream(data, streamId, options, permissions, permissions2);
            }
          }
        );
      } else {
        startStream(data, tabID.current, null, permissions, permissions2);
      }
    } catch (err) {
      chrome.runtime.sendMessage({
        type: "recording-error",
        error: "cancel-modal",
        why: JSON.stringify(err),
      });
    }
  }

  // Check if trying to record from Playground
  useEffect(() => {
    chrome.storage.local.get(["tabPreferred"], (result) => {
      tabPreferred.current = result.tabPreferred;
    });
  }, []);

  const getStreamID = async (id) => {
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: id,
    });
    tabID.current = streamId;
  };

  const onMessage = useCallback(
    (request, sender, sendResponse) => {
      if (request.type === "loaded") {
        backupRef.current = request.backup;
        if (!tabPreferred.current) {
          isTab.current = request.isTab;
          if (request.isTab) {
            getStreamID(request.tabID);
          }
        } else {
          isTab.current = false;
        }
        chrome.runtime.sendMessage({ type: "get-streaming-data" });
      }
      if (request.type === "streaming-data") {
        startStreaming(JSON.parse(request.data));
      } else if (request.type === "start-recording-tab") {
        startRecording();
      } else if (request.type === "restart-recording-tab") {
        restartRecording();
      } else if (request.type === "stop-recording-tab") {
        stopRecording();
      } else if (request.type === "set-mic-active-tab") {
        setMic(request);
      } else if (request.type === "set-audio-output-volume") {
        setAudioOutputVolume(request.volume);
      } else if (request.type === "pause-recording-tab") {
        if (!recorder.current) return;
        recorder.current.pause();
      } else if (request.type === "resume-recording-tab") {
        if (!recorder.current) return;
        recorder.current.resume();
      } else if (request.type === "dismiss-recording") {
        dismissRecording();
      }
    },
    [recorder.current, tabPreferred.current]
  );

  useEffect(() => {
    // Event listener (extension messaging)
    chrome.runtime.onMessage.addListener(onMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(onMessage);
    };
  }, []);

  // Add this new function to export tracking data
  async function exportTrackingData() {
    try {
      // Get tracking data from background script
      const { trackingData } = await chrome.storage.local.get(['trackingData']);
      
      // Get all data from different stores
      const [metadata, chunks] = await Promise.all([
        metadataTracker.current?.getRecordingMetadata(),
        getAllChunks()
      ]);

      // Create a complete tracking data object
      const exportData = {
        metadata: {
          ...metadata,
          totalChunks: chunks.length,
          totalCursorEvents: trackingData?.cursorEvents?.length || 0,
          exportTime: new Date().toISOString()
        },
        cursorEvents: trackingData?.cursorEvents || [],
        chunksMetadata: chunks.map(chunk => ({
          index: chunk.index,
          timestamp: chunk.timestamp,
          size: chunk.chunk?.size || 0
        }))
      };

      // Convert to JSON and create blob
      const jsonBlob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(jsonBlob);

      // Create download link
      const a = document.createElement('a');
      a.href = url;
      a.download = `screenity-tracking-data-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('Exported tracking data:', exportData);
      return exportData;
    } catch (err) {
      console.error('Error exporting tracking data:', err);
      throw err;
    }
  }

  // Helper function to get all chunks metadata
  async function getAllChunks() {
    const chunks = [];
    await chunksStore.iterate((value, key) => {
      chunks.push(value);
    });
    return chunks.sort((a, b) => a.index - b.index);
  }

  // Add listener for tracking data from content script
  useEffect(() => {
    const trackingDataListener = (request, sender, sendResponse) => {
      if (request.type === 'tracking-data') {
        const { cursorEvents, metadata } = request.data;
        if (cursorTracker.current) {
          // Store received cursor events
          cursorEvents.forEach(event => {
            cursorTracker.current.addEvent(event);
          });
        }
        if (metadataTracker.current && metadata) {
          // Update metadata if needed
          Object.assign(metadataTracker.current, metadata);
        }
      }
    };

    chrome.runtime.onMessage.addListener(trackingDataListener);
    return () => {
      chrome.runtime.onMessage.removeListener(trackingDataListener);
    };
  }, []);

  return (
    <div className="wrap">
      <img
        className="logo"
        src={chrome.runtime.getURL("assets/logo-text.svg")}
      />
      <div className="middle-area">
        <img src={chrome.runtime.getURL("assets/record-tab-active.svg")} />
        <div className="title">
          {!started
            ? chrome.i18n.getMessage("recorderSelectTitle")
            : chrome.i18n.getMessage("recorderSelectProgressTitle")}
        </div>
        <div className="subtitle">
          {chrome.i18n.getMessage("recorderSelectDescription")}
        </div>
        {/*started && (
          <div
            className="button-stop"
            onClick={() => {
              chrome.runtime.sendMessage({ type: "stop-recording-tab" });
            }}
          >
            {chrome.i18n.getMessage("stopRecording")}
          </div>
					)*/}
      </div>
      {!isTab.current && !started && <Warning />}
      <div className="setupBackgroundSVG"></div>
      {started && (
        <div 
          className="button-export"
          onClick={exportTrackingData}
          style={{
            padding: '10px 20px',
            background: '#FFF',
            borderRadius: '30px',
            color: '#29292F',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            marginTop: '10px',
            border: '1px solid #E8E8E8',
            marginLeft: 'auto',
            marginRight: 'auto',
            zIndex: 999999
          }}
        >
          Export Tracking Data
        </div>
      )}
      <style>
        {`
				body {
					overflow: hidden;
				}
				.button-stop {
					padding: 10px 20px;
					background: #FFF;
					border-radius: 30px;
					color: #29292F;
					font-size: 14px;
					font-weight: 500;
					cursor: pointer;
					margin-top: 0px;
					border: 1px solid #E8E8E8;
					margin-left: auto;
					margin-right: auto;
					z-index: 999999;
				}
				.setupBackgroundSVG {
					position: absolute;
					top: 0px;
					left: 0px;
					width: 100%;
					height:100%;
					background: url('` +
          chrome.runtime.getURL("assets/helper/pattern-svg.svg") +
          `') repeat;
					background-size: 62px 23.5px;
					animation: moveBackground 138s linear infinite;
					transform: rotate(0deg);
				}
				
				@keyframes moveBackground {
					0% {
						background-position: 0 0;
					}
					100% {
						background-position: 100% 0;
					}
				}
				.logo {
					position: absolute;
					bottom: 30px;
					left: 0px;
					right: 0px;
					margin: auto;
					width: 120px;
				}
				.wrap {
					position: absolute;
					top: 0;
					left: 0;
					width: 100%;
					height: 100%;
					background-color: #F6F7FB;
				}
					.middle-area {
						display: flex;
						flex-direction: column;
						align-items: center;
						justify-content: center;
						height: 100%;
						font-family: "Satoshi Medium", sans-serif;
					}
					.middle-area img {
						width: 40px;
						margin-bottom: 20px;
					}
					.title {
						font-size: 24px;
						font-weight: 700;
						color: #1A1A1A;
						margin-bottom: 14px;
						font-family: Satoshi-Medium, sans-serif;
					}
					.subtitle {
						font-size: 14px;
						font-weight: 400;
						color: #6E7684;
						margin-bottom: 24px;
						font-family: Satoshi-Medium, sans-serif;
					}
					
					`}
      </style>
    </div>
  );
};

export default Recorder;
