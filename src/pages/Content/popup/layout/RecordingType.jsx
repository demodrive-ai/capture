import React, { useEffect, useContext, useState, useRef } from "react";

import Dropdown from "../components/Dropdown";
import Switch from "../components/Switch";
import RegionDimensions from "../components/RegionDimensions";
import Settings from "./Settings";
import { contentStateContext } from "../../context/ContentState";
import { CameraOffBlue, MicOffBlue } from "../../images/popup/images";

import BackgroundEffects from "../components/BackgroundEffects";

import { AlertIcon, TimeIcon, NoInternet } from "../../toolbar/components/SVG";

const RecordingType = (props) => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const [cropActive, setCropActive] = useState(false);
  const [time, setTime] = useState(0);
  const [URL, setURL] = useState(
    "https://help.capture.io/getting-started/77KizPC8MHVGfpKpqdux9D/what-are-the-technical-requirements-for-using-capture/6kdB6qru6naVD8ZLFvX3m9"
  );
  const [URL2, setURL2] = useState(
    "https://help.capture.io/troubleshooting/9Jy5RGjNrBB42hqUdREQ7W/how-to-grant-capture-permission-to-record-your-camera-and-microphone/x6U69TnrbMjy5CQ96Er2E9"
  );

  const buttonRef = useRef(null);
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  useEffect(() => {
    const locale = chrome.i18n.getMessage("@@ui_locale");
    if (!locale.includes("en")) {
      setURL(
        `https://translate.google.com/translate?sl=en&tl=${locale}&u=https://help.capture.io/getting-started/77KizPC8MHVGfpKpqdux9D/what-are-the-technical-requirements-for-using-capture/6kdB6qru6naVD8ZLFvX3m9`
      );
      setURL2(
        `https://translate.google.com/translate?sl=en&tl=${locale}&u=https://help.capture.io/troubleshooting/9Jy5RGjNrBB42hqUdREQ7W/how-to-grant-capture-permission-to-record-your-camera-and-microphone/x6U69TnrbMjy5CQ96Er2E9`
      );
    }
  }, []);

  useEffect(() => {
    // Convert seconds to mm:ss
    let minutes = Math.floor(contentState.alarmTime / 60);
    let seconds = contentState.alarmTime - minutes * 60;
    if (seconds < 10) {
      seconds = "0" + seconds;
    }
    setTime(minutes + ":" + seconds);
  }, []);

  useEffect(() => {
    // Convert seconds to mm:ss
    let minutes = Math.floor(contentState.alarmTime / 60);
    let seconds = contentState.alarmTime - minutes * 60;
    if (seconds < 10) {
      seconds = "0" + seconds;
    }
    setTime(minutes + ":" + seconds);
  }, [contentState.alarmTime]);

  // Start recording
  const startStreaming = () => {
    contentState.startStreaming();
  };

  useEffect(() => {
    // Check if CropTarget is null
    if (typeof CropTarget === "undefined") {
      setCropActive(false);
      setContentState((prevContentState) => ({
        ...prevContentState,
        customRegion: false,
      }));
    } else {
      setCropActive(true);
    }
  }, []);

  useEffect(() => {
    if (contentState.recording) {
      setContentState((prevContentState) => ({
        ...prevContentState,
        pendingRecording: false,
      }));
    }
  }, [contentState.recording]);

  return (
    <div>
      {contentState.updateChrome && (
        <div className="popup-warning">
          <div className="popup-warning-left">
            <AlertIcon />
          </div>
          <div className="popup-warning-middle">
            <div className="popup-warning-title">
              {chrome.i18n.getMessage("customAreaRecordingDisabledTitle")}
            </div>
            <div className="popup-warning-description">
              {chrome.i18n.getMessage("customAreaRecordingDisabledDescription")}
            </div>
          </div>
          <div className="popup-warning-right">
            <a href={URL} target="_blank">
              {chrome.i18n.getMessage("customAreaRecordingDisabledAction")}
            </a>
          </div>
        </div>
      )}
      {/*contentState.offline && (
        <div className="popup-warning">
          <div className="popup-warning-left">
            <NoInternet />
          </div>
          <div className="popup-warning-middle">
            <div className="popup-warning-title">You are currently offline</div>
            <div className="popup-warning-description">
              Some features are unavailable
            </div>
          </div>
          <div className="popup-warning-right">
            <a href="#">Try again</a>
          </div>
        </div>
			)*/}
      {!cropActive &&
        contentState.recordingType === "region" &&
        !contentState.offline && (
          <div className="popup-warning">
            <div className="popup-warning-left">
              <AlertIcon />
            </div>
            <div className="popup-warning-middle">
              <div className="popup-warning-title">
                {chrome.i18n.getMessage("customAreaRecordingDisabledTitle")}
              </div>
              <div className="popup-warning-description">
                {chrome.i18n.getMessage(
                  "customAreaRecordingDisabledDescription"
                )}
              </div>
            </div>
            <div className="popup-warning-right">
              <a
                href="https://support.google.com/chrome/answer/95414?hl=en-GB&co=GENIE.Platform%3DDesktop"
                target="_blank"
              >
                {chrome.i18n.getMessage("customAreaRecordingDisabledAction")}
              </a>
            </div>
          </div>
        )}
      {!contentState.cameraPermission && (
        <button
          className="permission-button"
          onClick={() => {
            if (typeof contentState.openModal === "function") {
              contentState.openModal(
                chrome.i18n.getMessage("permissionsModalTitle"),
                chrome.i18n.getMessage("permissionsModalDescription"),
                chrome.i18n.getMessage("permissionsModalReview"),
                chrome.i18n.getMessage("permissionsModalDismiss"),
                () => {
                  chrome.runtime.sendMessage({
                    type: "extension-media-permissions",
                  });
                },
                () => {},
                chrome.runtime.getURL("assets/helper/permissions.webp"),
                chrome.i18n.getMessage("learnMoreDot"),
                URL2,
                true,
                false
              );
            }
          }}
        >
          <img src={CameraOffBlue} />
          <span>{chrome.i18n.getMessage("allowCameraAccessButton")}</span>
        </button>
      )}
      {contentState.cameraPermission && (
        <Dropdown type="camera" shadowRef={props.shadowRef} />
      )}
      {contentState.cameraPermission &&
        contentState.defaultVideoInput != "none" &&
        contentState.cameraActive && (
          <div>
            <Switch
              label={chrome.i18n.getMessage("flipCameraLabel")}
              name="flip-camera"
              value="cameraFlipped"
            />
            <Switch
              label={chrome.i18n.getMessage("backgroundEffectsLabel")}
              name="background-effects-active"
              value="backgroundEffectsActive"
            />
            {contentState.backgroundEffectsActive && <BackgroundEffects />}
          </div>
        )}

      {!contentState.microphonePermission && (
        <button
          className="permission-button"
          onClick={() => {
            if (typeof contentState.openModal === "function") {
              contentState.openModal(
                chrome.i18n.getMessage("permissionsModalTitle"),
                chrome.i18n.getMessage("permissionsModalDescription"),
                chrome.i18n.getMessage("permissionsModalReview"),
                chrome.i18n.getMessage("permissionsModalDismiss"),
                () => {
                  chrome.runtime.sendMessage({
                    type: "extension-media-permissions",
                  });
                },
                () => {},
                chrome.runtime.getURL("assets/helper/permissions.webp"),
                chrome.i18n.getMessage("learnMoreDot"),
                URL2,
                true,
                false
              );
            }
          }}
        >
          <img src={MicOffBlue} />
          <span>{chrome.i18n.getMessage("allowMicrophoneAccessButton")}</span>
        </button>
      )}
      {contentState.microphonePermission && (
        <Dropdown type="mic" shadowRef={props.shadowRef} />
      )}
      {((contentState.microphonePermission &&
        contentState.defaultAudioInput != "none" &&
        contentState.micActive) ||
        (contentState.microphonePermission && contentState.pushToTalk)) && (
        <div>
          <iframe
            style={{
              width: "100%",
              height: "30px",
              zIndex: 9999999999,
              position: "relative",
            }}
            allow="camera; microphone"
            src={chrome.runtime.getURL("waveform.html")}
          ></iframe>
          <Switch
            label={
              isMac
                ? chrome.i18n.getMessage("pushToTalkLabel") + " (⌥⇧U)"
                : chrome.i18n.getMessage("pushToTalkLabel") + " (Alt⇧U)"
            }
            name="pushToTalk"
            value="pushToTalk"
          />
        </div>
      )}
      {contentState.recordingType === "region" && cropActive && (
        <div>
          <div className="popup-content-divider"></div>
          <Switch
            label={chrome.i18n.getMessage("customAreaLabel")}
            name="customRegion"
            value="customRegion"
          />
          {contentState.customRegion && <RegionDimensions />}
        </div>
      )}
      <button
        role="button"
        className="main-button recording-button"
        ref={buttonRef}
        tabIndex="0"
        onClick={startStreaming}
        disabled={
          contentState.pendingRecording ||
          ((!contentState.cameraPermission || !contentState.cameraActive) &&
            contentState.recordingType === "camera")
        }
      >
        {contentState.alarm && contentState.alarmTime > 0 && (
          <div className="alarm-time-button">
            <TimeIcon />
            {time}
          </div>
        )}
        <span className="main-button-label">
          {contentState.pendingRecording
            ? chrome.i18n.getMessage("recordButtonInProgressLabel")
            : (!contentState.cameraPermission || !contentState.cameraActive) &&
              contentState.recordingType === "camera"
            ? chrome.i18n.getMessage("recordButtonNoCameraLabel")
            : chrome.i18n.getMessage("recordButtonLabel")}
        </span>
        <span className="main-button-shortcut">
          {contentState.recordingShortcut}
        </span>
      </button>
      <Settings />
    </div>
  );
};

export default RecordingType;

<style>
{`
.recording-type-container {
  padding: 16px;
}

.recording-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.recording-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background-color: hsl(240 3.7% 15.9%);
  border: 1px solid hsl(240 5% 26%);
  border-radius: 6px;
  color: hsl(0 0% 98%);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.recording-option:hover {
  background-color: hsl(240 5% 26%);
}

.recording-option.active {
  border-color: hsl(217.2 91.2% 59.8%);
}

.recording-option-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.recording-option-icon img {
  width: 20px;
  height: 20px;
  opacity: 0.9;
}

.recording-settings {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid hsl(240 3.7% 15.9%);
}

.recording-settings-title {
  font-size: 14px;
  font-weight: 500;
  color: hsl(0 0% 98%);
  margin-bottom: 12px;
}

.recording-settings-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
}

.recording-settings-option-label {
  font-size: 14px;
  color: hsl(240 5% 64.9%);
}

.recording-button {
  margin-top: 16px;
  width: 100%;
  padding: 12px;
  background-color: hsl(217.2 91.2% 59.8%);
  border: none;
  border-radius: 6px;
  color: hsl(0 0% 98%);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.recording-button:hover {
  background-color: hsl(217.2 91.2% 69.8%);
}

.recording-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.recording-button-shortcut {
  padding: 2px 6px;
  background-color: hsl(240 5% 26%);
  border-radius: 4px;
  font-size: 12px;
  color: hsl(240 5% 64.9%);
}

.alarm-time-button {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background-color: hsl(240 5% 26%);
  border-radius: 4px;
  font-size: 12px;
  color: hsl(240 5% 64.9%);
}

.popup-content-divider {
  height: 1px;
  background-color: hsl(240 3.7% 15.9%);
  margin: 16px 0;
}

.waveform-container {
  margin: 12px 0;
  padding: 12px;
  background-color: hsl(240 3.7% 15.9%);
  border-radius: 6px;
  height: 30px;
}
`}
</style>
