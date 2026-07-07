const fs = require('fs');
const content = fs.readFileSync('C:/Users/user/.gemini/antigravity-ide/brain/cfc239b0-8c25-4d05-bfed-c4aed63f633b/scratch-payment-page.txt', 'utf8');
let text = content;
if(text.startsWith('"') && text.endsWith('"')) {
    text = text.substring(1, text.length-1);
}
text = text.replace(/\\n/g, '\n').replace(/\\"/g, '"');
fs.writeFileSync('original-page-extracted.tsx', text);
