const fs = require('fs');
const path = require('path');

const filePath = 'c:\\Users\\niyik\\OneDrive\\Desktop\\Parka\\server\\src\\database\\schema.sql';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const terms = ['parking_sessions', 'reservations'];
terms.forEach(term => {
  console.log(`\n--- Matches for "${term}" ---`);
  lines.forEach((line, index) => {
    if (line.toLowerCase().includes(term.toLowerCase())) {
      console.log(`${index + 1}: ${line.trim()}`);
    }
  });
});
