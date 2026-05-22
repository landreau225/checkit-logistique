// Configuration
const API_URL = window.location.origin + '/api';

// Récupérer le token
const token = localStorage.getItem('token');
if (!token) {
    window.location.href = 'login.html';
}

// Fonction pour les appels API authentifiés
async function fetchAPI(url, options = {}) {
    options.headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
    };
    
    const response = await fetch(API_URL + url, options);
    
    if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
        throw new Error('Non autorisé');
    }
    
    return response;
}

// Chargement initial
document.addEventListener('DOMContentLoaded', () => {
    chargerLivraisons();
    
    document.getElementById('ajoutLivraison').addEventListener('submit', ajouterLivraison);
    document.getElementById('btnToutes').addEventListener('click', () => appliquerFiltre('toutes'));
    document.getElementById('btnAttente').addEventListener('click', () => appliquerFiltre('attente'));
    document.getElementById('btnLivrees').addEventListener('click', () => appliquerFiltre('livrees'));
    document.getElementById('btnLogout').addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = 'login.html';
    });
    
    // Modal signature
    const modal = document.getElementById('signatureModal');
    document.querySelector('.close').onclick = () => modal.style.display = 'none';
    window.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
});

let toutesLivraisons = [];
let filtreActuel = 'toutes';

async function chargerLivraisons() {
    try {
        const response = await fetchAPI('/livraisons');
        toutesLivraisons = await response.json();
        afficherLivraisons();
    } catch (error) {
        console.error('Erreur:', error);
        document.getElementById('livraisonsBody').innerHTML = '<tr><td colspan="8" class="loading">❌ Erreur de chargement</td></tr>';
    }
}

function afficherLivraisons() {
    let livraisons = toutesLivraisons;
    if (filtreActuel === 'attente') livraisons = toutesLivraisons.filter(l => l.statut === 'en_attente');
    if (filtreActuel === 'livrees') livraisons = toutesLivraisons.filter(l => l.statut === 'livree');
    
    const tbody = document.getElementById('livraisonsBody');
    if (livraisons.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">Aucune livraison</td></tr>';
        return;
    }
    
    tbody.innerHTML = livraisons.map(l => `
        <tr>
            <td>${l.id}</td>
            <td><strong>${l.numero_colis}</strong></td>
            <td>${l.client_nom}</td>
            <td>${l.adresse}</td>
            <td><span class="statut statut-${l.statut === 'en_attente' ? 'attente' : 'livree'}">
                ${l.statut === 'en_attente' ? '⏳ En attente' : '✅ Livrée'}</span>
            </td>
            <td>${l.date_livraison ? new Date(l.date_livraison).toLocaleString() : '-'}</td>
            <td>${l.signature_base64 ? `<button onclick="afficherSignature('${l.signature_base64}')">👁️ Voir</button>` : '-'}</td>
            <td>${l.signature_base64 ? `<button onclick="exporterPDF(${l.id})">📄 PDF</button>` : '-'}</td>
        </tr>
    `).join('');
}

function appliquerFiltre(filtre) {
    filtreActuel = filtre;
    document.querySelectorAll('.btn-filtre').forEach(btn => btn.classList.remove('actif'));
    if (filtre === 'toutes') document.getElementById('btnToutes').classList.add('actif');
    if (filtre === 'attente') document.getElementById('btnAttente').classList.add('actif');
    if (filtre === 'livrees') document.getElementById('btnLivrees').classList.add('actif');
    afficherLivraisons();
}

async function ajouterLivraison(e) {
    e.preventDefault();
    
    const data = {
        numero_colis: document.getElementById('numero_colis').value,
        client_nom: document.getElementById('client_nom').value,
        adresse: document.getElementById('adresse').value
    };
    
    try {
        const response = await fetchAPI('/livraisons', { method: 'POST', body: JSON.stringify(data) });
        if (response.ok) {
            alert('✅ Livraison ajoutée');
            document.getElementById('ajoutLivraison').reset();
            chargerLivraisons();
        } else {
            alert('❌ Erreur');
        }
    } catch (error) {
        alert('❌ Erreur');
    }
}

function afficherSignature(signature) {
    const canvas = document.getElementById('signatureCanvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => { canvas.width = img.width; canvas.height = img.height; ctx.drawImage(img, 0, 0); };
    img.src = signature;
    document.getElementById('signatureModal').style.display = 'block';
}

function exporterPDF(id) {
    const livraison = toutesLivraisons.find(l => l.id === id);
    if (!livraison) return;
    
    const win = window.open('', '_blank');
    win.document.write(`
        <html><head><title>Bon livraison ${livraison.numero_colis}</title>
        <style>body{font-family:Arial;padding:40px}</style></head>
        <body>
            <h1>Bon de livraison</h1>
            <p><strong>Colis:</strong> ${livraison.numero_colis}</p>
            <p><strong>Client:</strong> ${livraison.client_nom}</p>
            <p><strong>Adresse:</strong> ${livraison.adresse}</p>
            <p><strong>Date:</strong> ${new Date(livraison.date_livraison).toLocaleString()}</p>
            <h3>Signature</h3>
            <img src="${livraison.signature_base64}" style="max-width:300px;border:1px solid #ccc">
            <script>setTimeout(()=>window.print(),500)<\/script>
        </body></html>
    `);
}