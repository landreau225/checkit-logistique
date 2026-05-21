 const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// La base de données sera un fichier dans /data
const dbPath = path.join(__dirname, '..', 'data', 'checkit.db');
const db = new sqlite3.Database(dbPath);

// Création de la table des livraisons
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS livraisons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_colis TEXT NOT NULL,
      adresse TEXT NOT NULL,
      client_nom TEXT NOT NULL,
      statut TEXT DEFAULT 'en_attente',
      signature_base64 TEXT,
      photo_url TEXT,
      date_livraison DATETIME,
      synchro INTEGER DEFAULT 0
    )
  `);

  // Insertion de données de démonstration (utiles pour tester)
  const demo = db.prepare(`
    INSERT OR IGNORE INTO livraisons (numero_colis, adresse, client_nom, statut)
    VALUES (?, ?, ?, ?)
  `);

  demo.run('COLIS-001', '10 Rue de Paris, 75001 Paris', 'Jean Dupont', 'en_attente');
  demo.run('COLIS-002', '25 Avenue Victor Hugo, 69001 Lyon', 'Marie Martin', 'en_attente');
  demo.run('COLIS-003', '5 Boulevard Gambetta, 13001 Marseille', 'Pierre Durand', 'en_attente');
  demo.finalize();
  
  console.log('✅ Base de données initialisée avec 3 livraisons de test');
});

module.exports = db;
