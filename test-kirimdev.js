require('dotenv').config({path: '.env.local'});
fetch('https://api.kirimdev.com/v1/1106343869238385/messages', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + process.env.KIRIMDEV_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    messaging_product: 'whatsapp',
    to: '6283122866975',
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: 'Test' },
      action: {
        buttons: [
          { type: 'reply', reply: { id: 'inv_lowongan', title: 'Invoice Lowongan' } },
          { type: 'reply', reply: { id: 'inv_umum', title: 'Invoice Lengkap' } }
        ]
      }
    }
  })
}).then(async r => console.log(r.status, await r.text()))
