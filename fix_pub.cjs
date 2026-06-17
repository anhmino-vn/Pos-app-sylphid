const fs = require('fs');
let sql = fs.readFileSync('MASTER_DB_SETUP.sql', 'utf8');

// Replace all ALTER PUBLICATION statements with a safe block
sql = sql.replace(/ALTER PUBLICATION supabase_realtime ADD TABLE public\.([a-zA-Z0-9_]+);/g, (match, tableName) => {
  return `
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = '${tableName}'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.${tableName};
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;
`;
});

fs.writeFileSync('MASTER_DB_SETUP.sql', sql);
console.log('Fixed ALTER PUBLICATION in MASTER_DB_SETUP.sql');
