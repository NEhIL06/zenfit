const { exec } = require('child_process');
const fs = require('fs');

console.log('Starting tsc...');
exec('npx tsc --noEmit', { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
    console.log('tsc finished');
    const output = stdout + '\n' + stderr;
    fs.writeFileSync('tsc_full_output.txt', output);
    console.log('Output written to tsc_full_output.txt');
});
