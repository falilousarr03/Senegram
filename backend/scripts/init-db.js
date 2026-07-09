require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function initDatabase() {
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  };

  const dbName = process.env.DB_NAME || 'senegram';

  console.log(`🔧 Connexion à MySQL: ${dbConfig.host}:${dbConfig.port}`);
  
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connecté à MySQL');

    // Créer la base si elle n'existe pas
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ Base de données "${dbName}" prête`);

    await connection.query(`USE \`${dbName}\``);

    // Lire et exécuter le schéma
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Séparer les statements (gestion basique)
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    console.log(`📋 Exécution de ${statements.length} statements...`);
    
    for (const stmt of statements) {
      try {
        await connection.query(stmt);
      } catch (err) {
        // Ignore les erreurs "already exists" etc.
        if (!err.message.includes('already exists') && !err.message.includes('Duplicate')) {
          console.error('⚠️ Erreur statement:', err.message);
        }
      }
    }

    console.log('✅ Schéma de base de données initialisé avec succès');

    // Vérifier les tables
    const [tables] = await connection.query('SHOW TABLES');
    console.log('\n📊 Tables créées:');
    tables.forEach(t => console.log(`  - ${Object.values(t)[0]}`));

  } catch (err) {
    console.error('❌ Erreur initialisation DB:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

initDatabase();
