const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const { generateToken, verifyToken, verifyAdmin } = require('./auth');

// ========== CONFIGURATION BASE DE DONNÉES ==========
let db;
const isPostgreSQL = process.env.DATABASE_URL ? true : false;

if (isPostgreSQL) {
  // Mode production : PostgreSQL sur Render
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  db = pool;
  console.log('📁 Connexion à PostgreSQL sur Render');
  
  // Initialiser les tables PostgreSQL
  (async () => {
    try {
      // Table utilisateurs
      await db.query(`
        CREATE TABLE IF NOT EXISTS utilisateurs (
          id SERIAL PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT DEFAULT 'chauffeur'
        )
      `);
      
      // Table livraisons
      await db.query(`
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
      
      // Créer utilisateur admin par défaut
      const adminExists = await db.query("SELECT * FROM utilisateurs WHERE username = 'admin'");
      if (adminExists.rows.length === 0) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await db.query(
          "INSERT INTO utilisateurs (username, password, role) VALUES ($1, $2, $3)",
          ['admin', hashedPassword, 'admin']
        );
        console.log('✅ Utilisateur admin créé (login: admin / mdp: admin123)');
      }
      
      // Créer utilisateur chauffeur par défaut
      const chauffeurExists = await db.query("SELECT * FROM utilisateurs WHERE username = 'chauffeur'");
      if (chauffeurExists.rows.length === 0) {
        const hashedPassword = await bcrypt.hash('chauffeur123', 10);
        await db.query(
          "INSERT INTO utilisateurs (username, password, role) VALUES ($1, $2, $3)",
          ['chauffeur', hashedPassword, 'chauffeur']
        );
        console.log('✅ Utilisateur chauffeur créé (login: chauffeur / mdp: chauffeur123)');
      }
      
      // Ajouter données démo si table vide
      const count = await db.query("SELECT COUNT(*) FROM livraisons");
      if (parseInt(count.rows[0].count) === 0) {
        await db.query(`
          INSERT INTO livraisons (numero_colis, adresse, client_nom) 
          VALUES 
            ('COLIS-001', '10 Rue de Paris, 75001 Paris', 'Jean Dupont'),
            ('COLIS-002', '25 Avenue Victor Hugo, 69001 Lyon', 'Marie Martin'),
            ('COLIS-003', '5 Boulevard Gambetta, 13001 Marseille', 'Pierre Durand')
        `);
        console.log('✅ 3 livraisons de démonstration ajoutées');
      }
      
      console.log('✅ Base PostgreSQL prête');
    } catch (err) {
      console.error('❌ Erreur initialisation PostgreSQL:', err.message);
    }
  })();
  
} else {
  // Mode développement : SQLite en local
  console.log('📁 Mode local: utilisation SQLite');
  const sqlite3 = require('sqlite3').verbose();
  const fs = require('fs');
  
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const dbPath = path.join(dataDir, 'checkit.db');
  const sqlite = new sqlite3.Database(dbPath);
  
  sqlite.serialize(() => {
    // Table livraisons
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
    
    // Table utilisateurs
    sqlite.run(`CREATE TABLE IF NOT EXISTS utilisateurs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'chauffeur'
    )`);
    
    // Créer utilisateurs par défaut
    sqlite.get("SELECT * FROM utilisateurs WHERE username = 'admin'", [], async (err, row) => {
      if (!row) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        sqlite.run("INSERT INTO utilisateurs (username, password, role) VALUES (?, ?, ?)", 
          ['admin', hashedPassword, 'admin']);
        console.log('✅ Utilisateur admin créé');
      }
    });
    
    sqlite.get("SELECT * FROM utilisateurs WHERE username = 'chauffeur'", [], async (err, row) => {
      if (!row) {
        const hashedPassword = await bcrypt.hash('chauffeur123', 10);
        sqlite.run("INSERT INTO utilisateurs (username, password, role) VALUES (?, ?, ?)", 
          ['chauffeur', hashedPassword, 'chauffeur']);
        console.log('✅ Utilisateur chauffeur créé');
      }
    });
    
    // Ajouter données démo
    sqlite.get("SELECT COUNT(*) as count FROM livraisons", [], (err, row) => {
      if (row && row.count === 0) {
        const stmt = sqlite.prepare("INSERT INTO livraisons (numero_colis, adresse, client_nom) VALUES (?, ?, ?)");
        stmt.run('COLIS-001', '10 Rue de Paris, 75001 Paris', 'Jean Dupont');
        stmt.run('COLIS-002', '25 Avenue Victor Hugo, 69001 Lyon', 'Marie Martin');
        stmt.run('COLIS-003', '5 Boulevard Gambetta, 13001 Marseille', 'Pierre Durand');
        stmt.finalize();
        console.log('✅ 3 livraisons démo ajoutées');
      }
    });
  });
  
  db = sqlite;
}

// ========== CONFIGURATION EXPRESS ==========
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Servir les fichiers statiques (interfaces)
app.use('/frontend-admin', express.static(path.join(__dirname, '../frontend-admin')));
app.use('/frontend-mobile', express.static(path.join(__dirname, '../frontend-mobile')));

// Route racine
app.get('/', (req, res) => {
  res.redirect('/frontend-admin/login.html');
});

// Route de test API
app.get('/api/status', (req, res) => {
  res.json({ status: 'OK', message: 'API Check-IT fonctionne', database: isPostgreSQL ? 'PostgreSQL' : 'SQLite' });
});

// ========== ROUTES D'AUTHENTIFICATION ==========

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis' });
  }
  
  try {
    let user;
    
    if (isPostgreSQL) {
      const result = await db.query('SELECT * FROM utilisateurs WHERE username = $1', [username]);
      user = result.rows[0];
    } else {
      user = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM utilisateurs WHERE username = ?', [username], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }
    
    const token = generateToken(user);
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        role: user.role 
      } 
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// ========== ROUTES API (PROTÉGÉES) ==========

// Récupérer toutes les livraisons (admin uniquement)
app.get('/api/livraisons', verifyToken, verifyAdmin, async (req, res) => {
  try {
    if (isPostgreSQL) {
      const result = await db.query('SELECT * FROM livraisons ORDER BY id DESC');
      res.json(result.rows);
    } else {
      db.all('SELECT * FROM livraisons ORDER BY id DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Récupérer les livraisons en attente (chauffeur et admin)
app.get('/api/livraisons/en-attente', verifyToken, async (req, res) => {
  try {
    if (isPostgreSQL) {
      const result = await db.query("SELECT * FROM livraisons WHERE statut = 'en_attente' ORDER BY id");
      res.json(result.rows);
    } else {
      db.all("SELECT * FROM livraisons WHERE statut = 'en_attente' ORDER BY id", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Valider une livraison (prendre signature)
app.post('/api/livraisons/:id/valider', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { signature_base64, photo_url } = req.body;
  const now = new Date().toISOString();

  if (!signature_base64) {
    return res.status(400).json({ error: 'Signature requise' });
  }

  try {
    if (isPostgreSQL) {
      await db.query(
        `UPDATE livraisons 
         SET statut = 'livree', 
             signature_base64 = $1, 
             photo_url = $2, 
             date_livraison = $3,
             synchro = 1
         WHERE id = $4`,
        [signature_base64, photo_url || null, now, id]
      );
      res.json({ success: true, message: 'Livraison validée' });
    } else {
      db.run(
        `UPDATE livraisons 
         SET statut = 'livree', 
             signature_base64 = ?, 
             photo_url = ?, 
             date_livraison = ?,
             synchro = 1
         WHERE id = ?`,
        [signature_base64, photo_url || null, now, id],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          if (this.changes === 0) return res.status(404).json({ error: 'Livraison non trouvée' });
          res.json({ success: true, message: 'Livraison validée' });
        }
      );
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ajouter une nouvelle livraison (admin uniquement)
app.post('/api/livraisons', verifyToken, verifyAdmin, async (req, res) => {
  const { numero_colis, adresse, client_nom } = req.body;
  
  if (!numero_colis || !adresse || !client_nom) {
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  }
  
  try {
    if (isPostgreSQL) {
      const result = await db.query(
        'INSERT INTO livraisons (numero_colis, adresse, client_nom, statut) VALUES ($1, $2, $3, $4) RETURNING id',
        [numero_colis, adresse, client_nom, 'en_attente']
      );
      res.json({ id: result.rows[0].id, success: true });
    } else {
      db.run(
        'INSERT INTO livraisons (numero_colis, adresse, client_nom, statut) VALUES (?, ?, ?, ?)',
        [numero_colis, adresse, client_nom, 'en_attente'],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ id: this.lastID, success: true });
        }
      );
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== DÉMARRAGE DU SERVEUR ==========
app.listen(PORT, () => {
  console.log(`✅ Serveur API démarré sur http://localhost:${PORT}`);
  console.log(`📦 Base de données: ${isPostgreSQL ? 'PostgreSQL (production)' : 'SQLite (développement)'}`);
});