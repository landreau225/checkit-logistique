const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'mon_secret_tres_securise_a_changer_2026';

// Générer un token JWT
function generateToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      role: user.role 
    },
    SECRET_KEY,
    { expiresIn: '24h' }
  );
}

// Middleware pour vérifier le token
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"
  
  if (!token) {
    return res.status(401).json({ error: 'Accès non autorisé. Token manquant.' });
  }
  
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token invalide ou expiré.' });
    }
    req.user = user;
    next();
  });
}

// Middleware pour vérifier que l'utilisateur est admin
function verifyAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
  }
  next();
}

module.exports = { generateToken, verifyToken, verifyAdmin };