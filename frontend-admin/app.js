 //const API_URL = 'http://localhost:3000/api';
 const API_URL = 'https://checkit-logistique-1.onrender.com/api';

let toutesLivraisons = [];
let filtreActuel = 'toutes';

// Vérifier l'authentification
const token = localStorage.getItem('token');
if (!token) {
    window.location.href = 'login.html';
}

// Ajouter le token à tous les fetch
async function fetchWithAuth(url, options = {}) {
    options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };
    return fetch(url, options);
}

// Chargement au démarrage
document.addEventListener('DOMContentLoaded', () => {
    chargerLivraisons();
    
    // Formulaire d'ajout
    document.getElementById('ajoutLivraison').addEventListener('submit', ajouterLivraison);
    
    // Filtres
    document.getElementById('btnToutes').addEventListener('click', () => appliquerFiltre('toutes'));
    document.getElementById('btnAttente').addEventListener('click', () => appliquerFiltre('attente'));
    document.getElementById('btnLivrees').addEventListener('click', () => appliquerFiltre('livrees'));
    
    // Modal
    const modal = document.getElementById('signatureModal');
    const closeBtn = document.querySelector('.close');
    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (e) => {
        if (e.target === modal) modal.style.display = 'none';
    };
});

async function chargerLivraisons() {
    try {
        const response = await fetch(`${API_URL}/livraisons`);
        toutesLivraisons = await response.json();
        afficherLivraisons();
    } catch (error) {
        console.error('Erreur:', error);
        document.getElementById('livraisonsBody').innerHTML = 
            '<tr><td colspan="7" class="loading">❌ Erreur de connexion au serveur</td></tr>';
    }
}

function afficherLivraisons() {
    let livraisonsFiltrees = toutesLivraisons;
    
    if (filtreActuel === 'attente') {
        livraisonsFiltrees = toutesLivraisons.filter(l => l.statut === 'en_attente');
    } else if (filtreActuel === 'livrees') {
        livraisonsFiltrees = toutesLivraisons.filter(l => l.statut === 'livree');
    }
    
    const tbody = document.getElementById('livraisonsBody');
    
    if (livraisonsFiltrees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">Aucune livraison trouvée</td></tr>';
        return;
    }
    
    tbody.innerHTML = livraisonsFiltrees.map(livraison => `
        <tr>
            <td>${livraison.id}</td>
            <td><strong>${livraison.numero_colis}</strong></td>
            <td>${livraison.client_nom}</td>
            <td>${livraison.adresse}</td>
            <td><span class="statut statut-${livraison.statut === 'en_attente' ? 'attente' : 'livree'}">
                ${livraison.statut === 'en_attente' ? '⏳ En attente' : '✅ Livrée'}
            </span></td>
            <td>${livraison.date_livraison ? new Date(livraison.date_livraison).toLocaleString() : '-'}</td>
            <td>
                ${livraison.signature_base64 ? 
                    `<button class="btn-signature" onclick="afficherSignature('${livraison.signature_base64}')">👁️ Voir signature</button>` : 
                    '-'}
            </td>
        </tr>
    `).join('');
}

function appliquerFiltre(filtre) {
    filtreActuel = filtre;
    
    // Mise à jour des classes actives
    document.getElementById('btnToutes').classList.remove('actif');
    document.getElementById('btnAttente').classList.remove('actif');
    document.getElementById('btnLivrees').classList.remove('actif');
    
    if (filtre === 'toutes') document.getElementById('btnToutes').classList.add('actif');
    if (filtre === 'attente') document.getElementById('btnAttente').classList.add('actif');
    if (filtre === 'livrees') document.getElementById('btnLivrees').classList.add('actif');
    
    afficherLivraisons();
}

async function ajouterLivraison(e) {
    e.preventDefault();
    
    const nouvelleLivraison = {
        numero_colis: document.getElementById('numero_colis').value,
        client_nom: document.getElementById('client_nom').value,
        adresse: document.getElementById('adresse').value
    };
    
    try {
        const response = await fetch(`${API_URL}/livraisons`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nouvelleLivraison)
        });
        
        if (response.ok) {
            alert('✅ Livraison ajoutée avec succès !');
            document.getElementById('ajoutLivraison').reset();
            chargerLivraisons();
        } else {
            alert('❌ Erreur lors de l\'ajout');
        }
    } catch (error) {
        alert('❌ Erreur de connexion');
    }
}

function afficherSignature(signatureBase64) {
    const canvas = document.getElementById('signatureCanvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
    };
    img.src = signatureBase64;
    document.getElementById('signatureModal').style.display = 'block';
}
// Ajouter cette fonction dans app.js (admin)
function exporterPDF(livraisonId) {
    const livraison = toutesLivraisons.find(l => l.id === livraisonId);
    if (!livraison || !livraison.signature_base64) {
        alert('Cette livraison n\'a pas de signature');
        return;
    }
    
    // Créer un iframe invisible pour l'impression
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Bon de livraison - ${livraison.numero_colis}</title>
            <style>
                body { font-family: Arial; padding: 40px; }
                .header { text-align: center; border-bottom: 2px solid #667eea; padding-bottom: 20px; }
                .content { margin: 30px 0; }
                .info { margin: 20px 0; padding: 15px; background: #f5f5f5; }
                .signature { margin-top: 50px; }
                .signature img { max-width: 300px; border: 1px solid #ddd; }
                .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #999; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📦 CHECK-IT</h1>
                <p>Bon de livraison</p>
            </div>
            <div class="content">
                <h2>Colis: ${livraison.numero_colis}</h2>
                <div class="info">
                    <p><strong>Client:</strong> ${livraison.client_nom}</p>
                    <p><strong>Adresse:</strong> ${livraison.adresse}</p>
                    <p><strong>Date de livraison:</strong> ${new Date(livraison.date_livraison).toLocaleString()}</p>
                </div>
                <div class="signature">
                    <h3>Signature du client:</h3>
                    <img src="${livraison.signature_base64}" alt="Signature">
                </div>
            </div>
            <div class="footer">
                <p>Document généré automatiquement - Fait foi de la livraison</p>
            </div>
            <script>
                window.onload = () => setTimeout(() => window.print(), 500);
            <\/script>
        </body>
        </html>
    `);
}

// Ajouter un bouton PDF dans le tableau (modifier afficherLivraisons)
// Dans la colonne Action, remplacer le bouton signature par :
/*
<td>
    ${livraison.signature_base64 ? 
        `<button class="btn-signature" onclick="exporterPDF(${livraison.id})">📄 PDF</button>` : 
        '-'}
</td>
*/