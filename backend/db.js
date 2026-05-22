const { Pool } = require('pg');
const bcrypt = require('bcrypt');

let db;

async function initDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  console.log('📁 Connexion à PostgreSQL sur Render');

  // Créer les tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS utilisateurs (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'chauffeur'
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS livraisons (
      id SERIAL PRIMARY KEY,
      numero_colis TEXT NOT NULL,
      adresse TEXT NOT NULL,
      client_nom TEXT NOT NULL,
      statut TEXT DEFAULT 'en_attente',
      signature_base64 TEXT,
      photo_url TEXT,
      date_livraison TIMESTAMP,
      synchro INTEGER DEFAULT 0
    )
  `);

  // Créer un utilisateur admin par défaut (mot de passe: admin123)
  const adminExists = await pool.query("SELECT * FROM utilisateurs WHERE username = 'admin'");
  if (adminExists.rows.length === 0) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await pool.query(
      "INSERT INTO utilisateurs (username, password, role) VALUES ($1, $2, $3)",
      ['admin', hashedPassword, 'admin']
    );
    console.log('✅ Utilisateur admin créé (login: admin / mot de passe: admin123)');
  }

  // Créer un chauffeur par défaut
  const chauffeurExists = await pool.query("SELECT * FROM utilisateurs WHERE username = 'chauffeur'");
  if (chauffeurExists.rows.length === 0) {
    const hashedPassword = await bcrypt.hash('chauffeur123', 10);
    await pool.query(
      "INSERT INTO utilisateurs (username, password, role) VALUES ($1, $2, $3)",
      ['chauffeur', hashedPassword, 'chauffeur']
    );
    console.log('✅ Utilisateur chauffeur créé (login: chauffeur / mot de passe: chauffeur123)');
  }

  // Vérifier si la table livraisons est vide (ajout données démo)
  const count = await pool.query("SELECT COUNT(*) FROM livraisons");
  if (parseInt(count.rows[0].count) === 0) {
    await pool.query(`
      INSERT INTO livraisons (numero_colis, adresse, client_nom) 
      VALUES 
        ('COLIS-001', '10 Rue de Paris, 75001 Paris', 'Jean Dupont'),
        ('COLIS-002', '25 Avenue Victor Hugo, 69001 Lyon', 'Marie Martin'),
        ('COLIS-003', '5 Boulevard Gambetta, 13001 Marseille', 'Pierre Durand')
    `);
    console.log('✅ 3 livraisons de démonstration ajoutées');
  }

  console.log('✅ Base de données PostgreSQL prête');
  return pool;
}

// Mode développement (SQLite) – si pas de DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.log('📁 Mode local: utilisation SQLite');
  const sqlite3 = require('sqlite3').verbose();
  const path = require('path');
  const fs = require('fs');
  
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  
  const dbPath = path.join(dataDir, 'checkit.db');
  const sqlite = new sqlite3.Database(dbPath);
  
  sqlite.serialize(() => {
    sqlite.run(`CREATE TABLE IF NOT EXISTS livraisons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_colis TEXT NOT NULL,
      adresse TEXT NOT NULL,
      client_nom TEXT NOT NULL,
      statut TEXT DEFAULT 'en_attente',
      signature_base64 TEXT,
      photo_url TEXT,
      date_livraison DATETIME,
      synchro INTEGER DEFAULT 0
    )`);
    
    // Pour SQLite en local, on crée aussi une table users simplifiée
    sqlite.run(`CREATE TABLE IF NOT EXISTS utilisateurs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'chauffeur'
    )`);
  });
  
  db = sqlite;
  module.exports = db;
} else {
  // Mode production
  initDatabase().then(pool => {
    db = pool;
    module.exports = db;
  }).catch(err => {
    console.error('❌ Erreur PostgreSQL:', err);
    process.exit(1);
  });
}