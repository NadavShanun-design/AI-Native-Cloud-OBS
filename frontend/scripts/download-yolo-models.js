#!/usr/bin/env node

/**
 * YOLO Model Download Script
 * Downloads pre-converted ONNX models for browser-based inference
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, '..', 'public', 'models');

// Model URLs (using RTOD repository mirrors)
const MODELS = [
  {
    name: 'yolo11n_256.onnx',
    url: 'https://github.com/AndreyGermanov/rtod/raw/main/public/models/yolo11n.onnx',
    description: 'YOLOv11 Nano 256x256 (Recommended for real-time)',
    size: '~6MB',
    recommended: true,
  },
  {
    name: 'yolov10n_256.onnx',
    url: 'https://github.com/AndreyGermanov/rtod/raw/main/public/models/yolov10n.onnx',
    description: 'YOLOv10 Nano 256x256 (Fast, no NMS needed)',
    size: '~5MB',
    recommended: false,
  },
  {
    name: 'yolov7-tiny_256x256.onnx',
    url: 'https://github.com/AndreyGermanov/rtod/raw/main/public/models/yolov7-tiny_256x256.onnx',
    description: 'YOLOv7 Tiny 256x256 (Stable, proven)',
    size: '~12MB',
    recommended: false,
  },
];

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${path.basename(destPath)}...`);

    const file = fs.createWriteStream(destPath);
    let receivedBytes = 0;

    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        return downloadFile(response.headers.location, destPath)
          .then(resolve)
          .catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      const totalBytes = parseInt(response.headers['content-length'], 10);

      response.on('data', (chunk) => {
        receivedBytes += chunk.length;
        if (totalBytes) {
          const percent = ((receivedBytes / totalBytes) * 100).toFixed(2);
          process.stdout.write(`\r  Progress: ${percent}%`);
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log('\n  ✅ Download complete');
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function main() {
  console.log('='.repeat(60));
  console.log('YOLO Model Download Tool');
  console.log('='.repeat(60));
  console.log();

  // Ensure models directory exists
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
    console.log(`✅ Created directory: ${MODELS_DIR}`);
  }

  console.log('Available models:\n');
  MODELS.forEach((model, index) => {
    const tag = model.recommended ? ' [RECOMMENDED]' : '';
    console.log(`${index + 1}. ${model.name}${tag}`);
    console.log(`   ${model.description}`);
    console.log(`   Size: ${model.size}`);
    console.log();
  });

  console.log('Downloading recommended model...\n');

  // Download recommended model
  const recommendedModel = MODELS.find(m => m.recommended);
  if (recommendedModel) {
    const destPath = path.join(MODELS_DIR, recommendedModel.name);

    if (fs.existsSync(destPath)) {
      console.log(`⚠️  ${recommendedModel.name} already exists, skipping...`);
    } else {
      try {
        await downloadFile(recommendedModel.url, destPath);
        console.log(`✅ Successfully downloaded ${recommendedModel.name}`);
      } catch (error) {
        console.error(`❌ Failed to download ${recommendedModel.name}:`, error.message);
        console.log('\n⚠️  Manual download instructions:');
        console.log(`   1. Visit: ${recommendedModel.url}`);
        console.log(`   2. Download the file`);
        console.log(`   3. Save it as: ${destPath}`);
      }
    }
  }

  console.log();
  console.log('='.repeat(60));
  console.log('Download complete!');
  console.log('='.repeat(60));
  console.log();
  console.log('To download additional models, visit:');
  console.log('  - https://github.com/AndreyGermanov/rtod/tree/main/public/models');
  console.log('  - https://github.com/ultralytics/assets/releases');
  console.log();
  console.log('Or export your own using Ultralytics:');
  console.log('  pip install ultralytics');
  console.log('  python -c "from ultralytics import YOLO; YOLO(\'yolo11n.pt\').export(format=\'onnx\', imgsz=256, simplify=True)"');
  console.log();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
