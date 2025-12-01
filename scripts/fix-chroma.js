const fs = require('fs');
const path = require('path');
const target = path.join(__dirname, '..', 'node_modules', '@chroma-core', 'default-embed', 'dist', 'cjs', 'default-embed.d.cts');
try {
    if (fs.existsSync(target)) {
        fs.unlinkSync(target);
        console.log('Fixed @chroma-core/default-embed issue by removing default-embed.d.cts');
    }
} catch (e) {
    console.warn('Failed to fix @chroma-core/default-embed:', e.message);
}
