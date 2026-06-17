import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('./src', function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Count how many levels deep we are to construct relative path to src/lib/firebaseAdapter
    const depth = filePath.split(path.sep).length - 2; 
    let relativePath = '';
    if (depth <= 0) {
       relativePath = './lib/firebaseAdapter';
    } else {
       relativePath = '../'.repeat(depth) + 'lib/firebaseAdapter';
    }
    
    let newContent = content.replace(/from ['"]firebase\/firestore['"]/g, `from '${relativePath}'`);
    newContent = newContent.replace(/from ['"]firebase\/storage['"]/g, `from '${relativePath}'`);
    
    if (content !== newContent) {
      fs.writeFileSync(filePath, newContent);
      console.log('Updated imports in ' + filePath);
    }
  }
});
