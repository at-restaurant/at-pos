const { generateKeyPairSync } = require('crypto');
const fs = require('fs');
const { exec } = require('child_process');

console.log('📜 Generating self-signed certificate...');

// Node.js built-in se generate karo
exec(`node -e "
const pem = require('pem');
pem.createCertificate({
  days: 36500,
  selfSigned: true
}, (err, keys) => {
  require('fs').writeFileSync('key.pem', keys.serviceKey);
  require('fs').writeFileSync('cert.pem', keys.certificate);
  console.log('✅ Done! key.pem aur cert.pem ban gaye');
});
"`, (err) => {
    if (err) {
        console.log('Using alternative method...');
        // Fallback
        const cmd = `openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 36500 -nodes -subj "/CN=localhost"`;
        require('child_process').execSync(cmd);
        console.log('✅ Certificate generated!');
    }
});