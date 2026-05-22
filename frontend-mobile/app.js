const API_URL = window.location.origin + '/api';

const token = localStorage.getItem('token');
if (!token) {
    window.location.href = '../frontend-admin/login.html';
}

async function fetchAPI(url, options = {}) {
    options.headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
    };
    const response = await fetch(API_URL + url, options);
    if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '../frontend-admin/login.html';
    }
    return response;
}

let livraisons = [];
let livraisonCourante = null;
let signatureData = null;

document.addEventListener('DOMContentLoaded', () => {
    chargerLivraisons();
    initSignature();
    setInterval(chargerLivraisons, 30000);
});

async function chargerLivraisons() {
    try {
        const response = await fetchAPI('/livraisons/en-attente');
        livraisons = await response.json();
        afficherListe();
    } catch (error) {
        console.error('Erreur:', error);
    }
}

function afficherListe() {
    const container = document.getElementById('listeLivraisons');
    if (!container) return;
    
    if (livraisons.length === 0) {
        container.innerHTML = '<div class="loading">✅ Toutes les livraisons sont terminées !</div>';
        return;
    }
    
    container.innerHTML = livraisons.map(l => `
        <div class="carte-livraison" onclick="ouvrirModal(${l.id})">
            <h3>📦 ${l.numero_colis}</h3>
            <div>👤 ${l.client_nom}</div>
            <div>📍 ${l.adresse}</div>
        </div>
    `).join('');
}

window.ouvrirModal = async (id) => {
    livraisonCourante = livraisons.find(l => l.id === id);
    if (!livraisonCourante) return;
    
    document.getElementById('detailsLivraison').innerHTML = `
        <p><strong>Colis:</strong> ${livraisonCourante.numero_colis}</p>
        <p><strong>Client:</strong> ${livraisonCourante.client_nom}</p>
        <p><strong>Adresse:</strong> ${livraisonCourante.adresse}</p>
    `;
    reinitialiserSignature();
    document.getElementById('modalLivraison').style.display = 'block';
};

function initSignature() {
    const canvas = document.getElementById('signatureCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.clientWidth;
    canvas.height = 150;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    
    let drawing = false;
    canvas.addEventListener('mousedown', (e) => { drawing = true; ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY); });
    canvas.addEventListener('mousemove', (e) => { if(drawing){ ctx.lineTo(e.offsetX, e.offsetY); ctx.stroke(); ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY); } });
    canvas.addEventListener('mouseup', () => { drawing = false; signatureData = canvas.toDataURL(); });
    
    document.getElementById('effacerSignature')?.addEventListener('click', () => {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        signatureData = null;
    });
}

function reinitialiserSignature() {
    const canvas = document.getElementById('signatureCanvas');
    if(canvas){
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        signatureData = null;
    }
}

document.getElementById('validerLivraison')?.addEventListener('click', async () => {
    if (!signatureData) {
        alert('Signature requise');
        return;
    }
    
    try {
        const response = await fetchAPI(`/livraisons/${livraisonCourante.id}/valider`, {
            method: 'POST',
            body: JSON.stringify({ signature_base64: signatureData, photo_url: null })
        });
        
        if (response.ok) {
            alert('✅ Livraison validée');
            document.getElementById('modalLivraison').style.display = 'none';
            chargerLivraisons();
        } else {
            alert('❌ Erreur');
        }
    } catch (error) {
        alert('❌ Erreur');
    }
});

document.querySelector('.close-modal')?.addEventListener('click', () => {
    document.getElementById('modalLivraison').style.display = 'none';
});