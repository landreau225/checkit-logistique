 const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = 3000;
const path = require('path');

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Pour les signatures (base64)

// Servir les fichiers statiques (interface admin et mobile)
app.use('/frontend-admin', express.static(path.join(__dirname, '..', 'frontend-admin')));
app.use('/frontend-mobile', express.static(path.join(__dirname, '..', 'frontend-mobile')));

// Ajoutez cette route juste après app.use(...)
app.get('/', (req, res) => {
  res.json({ message: 'API Check-IT fonctionne !' });
});


// ========== ROUTES D'AUTHENTIFICATION ==========

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    let user;
    
    if (process.env.DATABASE_URL) {
      // PostgreSQL
      const result = await db.query('SELECT * FROM utilisateurs WHERE username = $1', [username]);
      user = result.rows[0];
    } else {
      // SQLite
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
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---------- ROUTES API ----------

// 1. Récupérer toutes les livraisons (pour l'admin)
app.get('/api/livraisons', (req, res) => {
  db.all('SELECT * FROM livraisons ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 2. Récupérer les livraisons du jour pour un chauffeur (statut 'en_attente')
app.get('/api/livraisons/en-attente', (req, res) => {
  db.all("SELECT * FROM livraisons WHERE statut = 'en_attente'", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 3. Marquer une livraison comme effectuée (avec signature)
app.post('/api/livraisons/:id/valider', (req, res) => {
  const { id } = req.params;
  const { signature_base64, photo_url } = req.body;
  const now = new Date().toISOString();

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
});

// 4. Ajouter une nouvelle livraison depuis l'admin
app.post('/api/livraisons', (req, res) => {
  const { numero_colis, adresse, client_nom } = req.body;
  if (!numero_colis || !adresse || !client_nom) {
    return res.status(400).json({ error: 'Champs manquants' });
  }
  db.run(
    'INSERT INTO livraisons (numero_colis, adresse, client_nom, statut) VALUES (?, ?, ?, ?)',
    [numero_colis, adresse, client_nom, 'en_attente'],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, success: true });
    }
  );
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`✅ Serveur API démarré sur http://localhost:${PORT}`);
  console.log(`📦 Base de données : ${require('path').join(__dirname, '..', 'data', 'checkit.db')}`);
});
