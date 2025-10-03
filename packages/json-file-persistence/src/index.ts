import * as fs from 'fs';
import * as path from 'path';
//
// save doc :
//  - every 2 minutes
//  - on SIGUSR1
//  - on exit
//
setInterval(() => {
  saveDoc();
}, 120 * 1000);

// Send signal with: kill -USR1 <pid>
process.on('SIGUSR1', () => {
  log(6, 'SIGNAL', 'Received SIGUSR1, saving doc state');
  saveDoc();
});

const STORAGE_PATH = './data';

const getProjectStoragePath = () => {
  // Take first part of UUID (before first dash) as folder name
  const folderName = gateway_init.project.PROJECT_ID.split('-')[0];
  return path.join(STORAGE_PATH, folderName);
};

//

const ensureStorageDirectory = () => {
  const storagePath = getProjectStoragePath();
  if (!storagePath) return false;

  try {
    if (!fs.existsSync(STORAGE_PATH)) {
      fs.mkdirSync(STORAGE_PATH);
    }
    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath);
    }
    return true;
  } catch (err) {
    console.error('Failed to create storage directory:', err);
    return false;
  }
};

//

const getLatestSavedFile = () => {
  const storagePath = getProjectStoragePath();
  if (!storagePath) return null;

  try {
    const files = fs
      .readdirSync(storagePath)
      .filter((file) => file.endsWith('.json'))
      .map((file) => ({
        name: file,
        path: path.join(storagePath, file),
        timestamp: parseInt(file.replace('.json', '')),
      }))
      .sort((a, b) => b.timestamp - a.timestamp);

    return files.length > 0 ? files[0].path : null;
  } catch (err) {
    console.error('Failed to list saved files:', err);
    return null;
  }
};

//

const loadDoc = () => {
  let success = false;
  try {
    const latestFile = getLatestSavedFile();
    if (!latestFile) {
      console.log('No saved data found');
      return false;
    }

    const savedData = fs.readFileSync(latestFile, 'utf-8');
    const jsonData = JSON.parse(savedData);
    setAllSharedDataFromJSON(gateway_init.ydoc, jsonData);
    console.log(`Loaded data from ${latestFile}`);
    success = true;
  } catch (err) {
    console.error('Failed to load saved shared data:', err);
  }
  return success;
};

//

const saveDoc = () => {
  try {
    if (!ensureStorageDirectory()) {
      console.error('Failed to ensure storage directory exists');
      return;
    }

    const storagePath = getProjectStoragePath();
    if (!storagePath) {
      console.error('No project ID available for saving');
      return;
    }

    const timestamp = Date.now();
    const filename = path.join(storagePath, `${timestamp}.json`);
    const savedFile = JSON.stringify(getAllSharedDataAsJSON(gateway_init.ydoc));
    fs.writeFileSync(filename, savedFile);
    console.log(`Saved project data to ${filename}`);
  } catch (err) {
    console.error('Failed to save project data:', err);
  }
};
