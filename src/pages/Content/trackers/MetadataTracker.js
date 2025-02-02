// MetadataTracker.js
import localforage from "localforage";

class MetadataTracker {
  constructor() {
    this.recordingStartTime = 0;
    this.currentChunkIndex = 0;
    this.isTracking = false;
    
    // Store for recording metadata
    this.metadataStore = localforage.createInstance({
      name: "screenity_metadata",
      storeName: 'recording_metadata'
    });
  }

  async startTracking() {
    try {
      await this.metadataStore.clear(); // Clear previous data
      this.recordingStartTime = Date.now();
      this.isTracking = true;
      this.currentChunkIndex = 0;

      // Store initial recording metadata
      if (this.videoTrack) {
        const settings = this.videoTrack.getSettings();
        const initialMetadata = {
          startTime: this.recordingStartTime,
          resolution: {
            width: settings.width || 0,
            height: settings.height || 0
          },
          fps: settings.frameRate || 0,
          streamInfo: {
            label: this.videoTrack.label || 'unknown',
            enabled: this.videoTrack.enabled,
            muted: this.videoTrack.muted
          }
        };
        await this.metadataStore.setItem('recording_info', initialMetadata);
      }
    } catch (err) {
      console.error('Error starting metadata tracking:', err);
    }
  }

  async stopTracking() {
    try {
      this.isTracking = false;
      const endTime = Date.now();
      
      // Update recording metadata with end time and duration
      const recordingInfo = await this.metadataStore.getItem('recording_info');
      if (recordingInfo) {
        recordingInfo.endTime = endTime;
        recordingInfo.duration = endTime - recordingInfo.startTime;
        await this.metadataStore.setItem('recording_info', recordingInfo);
      }
    } catch (err) {
      console.error('Error stopping metadata tracking:', err);
    }
  }

  async addChunkMetadata(chunkIndex, chunk) {
    if (!this.isTracking) return null;

    try {
      this.currentChunkIndex = chunkIndex;
      const chunkMetadata = {
        chunkIndex,
        timestamp: Date.now(),
        quality: chunk.quality || 'unknown'
      };

      // Store chunk metadata separately
      await this.metadataStore.setItem(`chunk_${chunkIndex}`, chunkMetadata);
      return chunkMetadata;
    } catch (err) {
      console.error('Error adding chunk metadata:', err);
      return null;
    }
  }

  getVideoTrack() {
    return this.videoTrack;
  }

  async setVideoStream(stream) {
    try {
      if (stream && stream.getVideoTracks().length > 0) {
        this.videoTrack = stream.getVideoTracks()[0];
        
        // Update stream info in metadata
        const settings = this.videoTrack.getSettings();
        const streamInfo = {
          resolution: {
            width: settings.width || 0,
            height: settings.height || 0
          },
          fps: settings.frameRate || 0,
          streamInfo: {
            label: this.videoTrack.label || 'unknown',
            enabled: this.videoTrack.enabled,
            muted: this.videoTrack.muted
          }
        };
        await this.metadataStore.setItem('stream_info', streamInfo);
      }
    } catch (err) {
      console.error('Error setting video stream metadata:', err);
    }
  }

  async getRecordingMetadata() {
    try {
      const [recordingInfo, streamInfo] = await Promise.all([
        this.metadataStore.getItem('recording_info'),
        this.metadataStore.getItem('stream_info')
      ]);
      return { ...recordingInfo, ...streamInfo };
    } catch (err) {
      console.error('Error getting recording metadata:', err);
      return null;
    }
  }

  async getChunksMetadata() {
    try {
      const chunksMetadata = [];
      await this.metadataStore.iterate((value, key) => {
        if (key.startsWith('chunk_')) {
          chunksMetadata.push(value);
        }
      });
      return chunksMetadata.sort((a, b) => a.chunkIndex - b.chunkIndex);
    } catch (err) {
      console.error('Error getting chunks metadata:', err);
      return [];
    }
  }

  async clearData() {
    try {
      await this.metadataStore.clear();
    } catch (err) {
      console.error('Error clearing metadata:', err);
    }
  }
}

export default MetadataTracker; 