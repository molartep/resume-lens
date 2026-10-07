import {open} from 'node:fs/promises';
// Prisma's SQLite schema engine requires an existing file on some macOS setups.
// Create the default file only when absent; never truncate an existing database.
try{const file=await open(new URL('../prisma/dev.db',import.meta.url),'wx',0o600);await file.close();}catch(error){if(error.code!=='EEXIST')throw error;}
