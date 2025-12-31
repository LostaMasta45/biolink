const sharp = require('@capacitor/assets/node_modules/sharp');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const inputPath = path.join(process.cwd(), 'src/app/icon.png');
const outputDir = path.join(process.cwd(), 'public/icons');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Generate icons for each size
async function generateIcons() {
  console.log('Generating PWA icons from:', inputPath);
  
  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}.png`);
    try {
      await sharp(inputPath)
        .resize(size, size)
        .toFile(outputPath);
      console.log(`✓ Created icon-${size}.png`);
    } catch (error) {
      console.error(`✗ Failed to create icon-${size}.png:`, error.message);
    }
  }
  
  // Also create apple-touch-icon (180x180)
  try {
    await sharp(inputPath)
      .resize(180, 180)
      .toFile(path.join(outputDir, 'apple-touch-icon.png'));
    console.log('✓ Created apple-touch-icon.png');
  } catch (error) {
    console.error('✗ Failed to create apple-touch-icon.png:', error.message);
  }
  
  console.log('\nDone! Icons generated in:', outputDir);
}

generateIcons();
