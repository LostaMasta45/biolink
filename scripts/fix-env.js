const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');

try {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    
    const cleanedLines = lines.map(line => {
        // Skip comments and empty lines
        if (!line || line.trim().startsWith('#')) {
            return line;
        }

        // Split by first equals sign
        const parts = line.split('=');
        if (parts.length < 2) return line;

        const key = parts[0].trim();
        // Join the rest back in case the value has equals signs (like base64)
        const value = parts.slice(1).join('=').trim(); 

        return `${key}=${value}`;
    });

    const newContent = cleanedLines.join('\n');
    fs.writeFileSync(envPath, newContent, 'utf8');
    
    console.log('Successfully cleaned .env.local file!');
    console.log('Removed hidden whitespace from ' + lines.length + ' lines.');
} catch (error) {
    console.error('Error fixing .env.local:', error);
}
