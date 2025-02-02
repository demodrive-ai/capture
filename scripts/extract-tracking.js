const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Function to run chrome command line
async function extractTrackingData() {
  console.log('Starting extraction of tracking data...');
  
  const command = `
    /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\
    --enable-logging \\
    --v=1 \\
    --load-extension=${process.cwd()} \\
    --headless \\
    --remote-debugging-port=9222 \\
    "chrome://extensions"
  `;

  console.log('Executing command:', command);

  return new Promise((resolve, reject) => {
    console.log('Launching Chrome in headless mode...');
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Error executing Chrome command:', error);
        reject(error);
        return;
      }

      console.log('Chrome command executed successfully');
      if (stderr) {
        console.log('stderr output:', stderr);
      }
      
      // Get the data from chrome.storage.local
      const data = stdout;
      console.log('Received data from stdout, length:', data.length);
      
      const timestamp = new Date().toISOString();
      const filename = `screenity-tracking-data-${timestamp}.json`;
      
      console.log('Writing data to file:', filename);
      fs.writeFileSync(filename, data);
      console.log(`Data successfully extracted and saved to ${filename}`);
      resolve(data);
    });
  });
}

console.log('Starting script execution...');
extractTrackingData()
  .then(() => console.log('Script completed successfully'))
  .catch(error => {
    console.error('Script failed with error:', error);
  });
