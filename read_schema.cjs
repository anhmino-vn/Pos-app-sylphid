
const fs = require('fs');
const sql = fs.readFileSync('MASTER_DB_SETUP.sql', 'utf8');
['product_categories', 'brands', 'products', 'customers', 'service_categories', 'services'].forEach(t => {
  const match = sql.match(new RegExp('CREATE TABLE IF NOT EXISTS public.' + t + '[\\\\s\\\\S]*?\\\\);', 'i'));
  console.log('--- ' + t + ' ---');
  if (match) console.log(match[0].split('\\n').map(l => l.trim()).join(' '));
  else console.log('Not found');
});

