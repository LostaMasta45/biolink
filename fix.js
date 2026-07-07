const fs = require('fs');
let code = fs.readFileSync('./src/app/payment/thankyou/page.tsx', 'utf8');
code = code.replace(/\\\`/g, '`');
fs.writeFileSync('./src/app/payment/thankyou/page.tsx', code);
console.log('Fixed ALL page.tsx template literals!');
