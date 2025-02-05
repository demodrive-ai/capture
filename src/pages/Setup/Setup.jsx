import React, { useEffect, useState } from "react";

const Setup = () => {
  const [setupComplete, setSetupComplete] = useState(false);

  useEffect(() => {
    // Inject content script
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("contentScript.bundle.js");
    script.async = true;
    document.body.appendChild(script);

    // Also inject CSS
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.type = "text/css";
    style.href = chrome.runtime.getURL("assets/fonts/fonts.css");
    document.body.appendChild(style);

    // Return
    return () => {
      document.body.removeChild(script);
      document.body.removeChild(style);
    };
  }, []);

  useEffect(() => {
    chrome.runtime.onMessage.addListener(function (
      request,
      sender,
      sendResponse
    ) {
      if (request.type === "setup-complete") {
        setSetupComplete(true);
      }
    });
  }, []);

  return (
    <div className="setupBackground">
      {!setupComplete && (
        <div className="setupContainer">
          <div className="setupImage">
            <img src={chrome.runtime.getURL("assets/helper/pin.gif")} />
          </div>
          <div className="setupText">
            <div className="setupEmoji">👋</div>
            <div className="setupTitle">
              {chrome.i18n.getMessage("setupTitle")}
            </div>
            <div className="setupDescription">
              <div className="setupStep">
                {chrome.i18n.getMessage("setupStep1Before")}
                <span>
                  <img
                    src={chrome.runtime.getURL("assets/helper/puzzle.svg")}
                  />
                </span>
                {chrome.i18n.getMessage("setupStep1After")}
              </div>
              <div className="setupStep">
                {chrome.i18n.getMessage("setupStep2Before")}
                <span>
                  <img src={chrome.runtime.getURL("assets/helper/pin.svg")} />
                </span>{" "}
                {chrome.i18n.getMessage("setupStep2After")}
              </div>
              <div className="setupStep">
                {chrome.i18n.getMessage("setupStep3Before")}
                <span>
                  <img
                    src={chrome.runtime.getURL(
                      "assets/helper/mini-capture.png"
                    )}
                  />
                </span>
                {chrome.i18n.getMessage("setupStep3After")}
              </div>
            </div>
          </div>
        </div>
      )}
      {setupComplete && (
        <div className="setupContainer center">
          <div className="setupText center">
            <div className="setupEmoji">🥳</div>
            <div className="setupTitle">
              {chrome.i18n.getMessage("setupCompleteTitle")}
            </div>
            <div className="setupDescription">
              {chrome.i18n.getMessage("setupCompleteDescription")}
            </div>
          </div>
        </div>
      )}
      <img
        className="setupLogo"
        src={chrome.runtime.getURL("assets/logo-text.svg")}
      />
      <style>
        {`
				body {
					overflow: hidden;
					margin: 0;
					padding: 0;
					min-height: 100%;
					background-color: hsl(240 10% 3.9%);
					color: hsl(0 0% 98%);
					font-family: system-ui, -apple-system, sans-serif;
				}

				.setupInfo {
					margin-top: 20px;
				}
				
				a {
					text-decoration: none;
					color: hsl(217.2 91.2% 59.8%);
					transition: color 0.2s ease;
				}
				
				a:hover {
					color: hsl(217.2 91.2% 69.8%);
				}

				.setupContainer {
					position: absolute;
					top: 0;
					left: 0;
					right: 0;
					bottom: 0;
					margin: auto;
					z-index: 999;
					display: flex;
					justify-content: center;
					align-items: center;
					width: 60%;
					height: fit-content;
					background-color: hsl(240 10% 3.9%);
					border: 1px solid hsl(240 3.7% 15.9%);
					border-radius: 12px;
					padding: 24px;
					gap: 40px;
					box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
				}

				.setupImage {
					width: 70%;
					display: flex;
					justify-content: center;
					align-items: center;
				}

				.setupImage img {
					width: 100%;
					border-radius: 8px;
				}

				.setupText {
					width: 50%;
					display: flex;
					flex-direction: column;
					justify-content: left;
					align-items: left;
					text-align: left;
				}

				.setupEmoji {
					font-size: 24px;
					margin-bottom: 16px;
				}

				.setupTitle {
					font-size: 24px;
					font-weight: 600;
					margin-bottom: 12px;
					color: hsl(0 0% 98%);
					letter-spacing: -0.025em;
				}

				.setupDescription {
					color: hsl(240 5% 64.9%);
					font-size: 14px;
					line-height: 1.6;
					margin-bottom: 24px;
				}

				.setupStep {
					margin-bottom: 12px;
					display: flex;
					align-items: center;
					gap: 8px;
				}

				.setupStep span {
					display: inline-flex;
					align-items: center;
					justify-content: center;
					width: 24px;
					height: 24px;
					border-radius: 6px;
					background-color: hsl(240 3.7% 15.9%);
					border: 1px solid hsl(240 5% 26%);
				}

				.setupStep img {
					width: 16px;
					height: 16px;
				}

				.button-stop {
					padding: 10px 20px;
					background-color: hsl(240 3.7% 15.9%);
					border: 1px solid hsl(240 5% 26%);
					border-radius: 6px;
					color: hsl(0 0% 98%);
					font-size: 14px;
					font-weight: 500;
					cursor: pointer;
					transition: all 0.2s ease;
				}

				.button-stop:hover {
					background-color: hsl(240 5% 26%);
				}

				.setupLogo {
					position: absolute;
					bottom: 24px;
					left: 0;
					right: 0;
					margin: auto;
					width: 120px;
					opacity: 0.9;
				}

				.setupBackground {
					height: 100vh;
					width: 100vw;
					display: flex;
					justify-content: center;
					align-items: center;
					background: linear-gradient(
						to bottom right,
						hsl(240 10% 3.9%),
						hsl(240 3.7% 15.9%)
					);
				}

				.center {
					text-align: center!important;
				}
				.setupText.center {
					width: auto!important;
				}
				.setupContainer.center {
					width: 40%!important;
				}
				
				@media (max-width: 768px) {
					.setupContainer {
						width: 90%;
						flex-direction: column;
						padding: 20px;
					}

					.setupImage, .setupText {
						width: 100%;
					}

					.setupTitle {
						font-size: 20px;
					}
				}

				@media only screen and (max-width: 500px) {
					.setupContainer {
						width: 80%!important;
						padding: 20px!important;
					}
					.setupTitle {
						font-size: 18px!important;
					}
					.setupDescription {
						font-size: 12px!important;
					}
					.setupStep {
						font-size: 12px!important;
					}
				}


				`}
      </style>
    </div>
  );
};

export default Setup;
