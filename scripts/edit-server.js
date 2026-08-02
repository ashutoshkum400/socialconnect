// Helper script to add system-volume require and route registration to server.js
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'server.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add require line after DataManager require
let count1 = 0;
content = content.replace(
  /const \{ DataManager \} = require\('\.\/data-manager'\);/,
  (match) => {
    count1++;
    return match + "\nconst { registerSystemVolumeRoute } = require('./system-volume');";
  }
);
console.log('Added require line:', count1 > 0);

// 2. Find a good place to register the route - after seed data and before advanced-post-api registration
// Look for the advancedPostAPI call
let count2 = 0;
content = content.replace(
  /const advancedPostAPI = require\('\.\/advanced-post-api'\);/,
  (match) => {
    count2++;
    return match;
  }
);
console.log('Found advancedPostAPI require:', count2 > 0);

// 3. Register the system volume route after the advanced post API registration
let count3 = 0;
content = content.replace(
  /advancedPostAPI\(app, io, db, authenticate\);/,
  (match) => {
    count3++;
    return match + "\nregisterSystemVolumeRoute(app);";
  }
);
console.log('Added route registration:', count3 > 0);

fs.writeFileSync(filePath, content);
console.log('server.js updated successfully');
