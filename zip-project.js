import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

const zip = new JSZip();

function addFilesToZip(dir, zipFolder) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    // Exclude directories we do not want to zip
    if (stat.isDirectory()) {
      if (
        file === 'node_modules' || 
        file === 'dist' || 
        file === '.git' || 
        file === 'build' || 
        file === '.gradle' ||
        file === 'capacitor-cordova-android-plugins'
      ) {
        continue;
      }
      const newZipFolder = zipFolder.folder(file);
      addFilesToZip(filePath, newZipFolder);
    } else {
      // Exclude generated zip files to avoid infinite loops
      if (file.endsWith('.zip')) {
        continue;
      }
      const fileData = fs.readFileSync(filePath);
      zipFolder.file(file, fileData);
    }
  }
}

async function run() {
  console.log("Zipping project files...");
  addFilesToZip('.', zip);

  // Create public folder at root if it doesn't exist
  if (!fs.existsSync('./public')) {
    fs.mkdirSync('./public');
  }

  const content = await zip.generateAsync({ 
    type: 'nodebuffer', 
    compression: 'DEFLATE', 
    compressionOptions: { level: 9 } 
  });
  
  fs.writeFileSync('./public/app-source.zip', content);
  fs.writeFileSync('./public/app-source_share.zip', content);
  console.log("Successfully created ./public/app-source.zip and ./public/app-source_share.zip");

  // Also write to dist if it exists
  if (fs.existsSync('./dist')) {
    fs.writeFileSync('./dist/app-source.zip', content);
    fs.writeFileSync('./dist/app-source_share.zip', content);
    console.log("Successfully created ./dist/app-source.zip and ./dist/app-source_share.zip");
  }
}

run().catch(err => {
  console.error("Error during zip creation:", err);
});
