const API_URL = 'http://localhost:3000/api';

let livraisonsEnAttente = [];
let livraisonCourante = null;
let signatureData = null;
let photoData = null;
let drawing = false;
let ctx = null;

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    chargerLivraisons();
    initSignature();
    
    // Rafraîchir toutes les 30 secondes
    setInterval(chargerLivraisons, 30000);
});

async function chargerLivraisons() {
    try {
        const response = await fetch(`${API_URL}/livraisons/en-attente`);
        livraisonsEnAttente = await response.json();
        afficherListeLivraisons();
    } catch (error) {
        console.error('Erreur:', error);
        document.getElementById('listeLivraisons').innerHTML = 
            '<div class="loading">❌ Erreur de connexion au serveur<br>Vérifiez que le serveur est lancé</div>';
    }
}

function afficherListeLivraisons() {
    const container = document.getElementById('listeLivraisons');
    
    if (livraisonsEnAttente.length === 0) {
        container.innerHTML = `
            <div class="loading">
                ✅ Toutes les livraisons sont terminées !<br>
                🎉 Bonne journée !
            </div>
        `;
        return;
    }
    
    container.innerHTML = livraisonsEnAttente.map(livraison => `
        <div class="carte-livraison" onclick="ouvrirModal(${livraison.id})">
            <h3>📦 ${livraison.numero_colis}</h3>
            <div class="client">👤 ${livraison.client_nom}</div>
            <div class="adresse">📍 ${livraison.adresse}</div>
            <span class="statut-badge">⏳ À livrer</span>
        </div>
    `).join('');
}

// Rendre la fonction accessible globalement pour les onclick
window.ouvrirModal = async function(id) {
    // Récupérer les détails complets
    const response = await fetch(`${API_URL}/livraisons`);
    const toutes = await response.json();
    livraisonCourante = toutes.find(l => l.id === id);
    
    if (!livraisonCourante) return;
    
    // Afficher les détails
    const detailsDiv = document.getElementById('detailsLivraison');
    detailsDiv.innerHTML = `
        <p><strong>📦 Colis :</strong> ${livraisonCourante.numero_colis}</p>
        <p><strong>👤 Client :</strong> ${livraisonCourante.client_nom}</p>
        <p><strong>📍 Adresse :</strong> ${livraisonCourante.adresse}</p>
    `;
    
    // Réinitialiser la signature
    reinitialiserSignature();
    
    // Réinitialiser la photo
    photoData = null;
    document.getElementById('apercuPhoto').innerHTML = '';
    
    // Afficher le modal
    document.getElementById('modalLivraison').style.display = 'block';
};

function initSignature() {
    const canvas = document.getElementById('signatureCanvas');
    ctx = canvas.getContext('2d');
    
    // Taille adaptée
    const resizeCanvas = () => {
        const container = canvas.parentElement;
        const width = container.clientWidth - 20;
        canvas.width = width;
        canvas.height = 150;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Événements souris
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);
    
    // Événements tactiles (mobile)
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        startDrawing({ offsetX: x, offsetY: y });
    });
    
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        draw({ offsetX: x, offsetY: y });
    });
    
    canvas.addEventListener('touchend', stopDrawing);
    
    // Bouton effacer
    document.getElementById('effacerSignature').addEventListener('click', reinitialiserSignature);
}

function startDrawing(e) {
    drawing = true;
    ctx.beginPath();
    ctx.moveTo(e.offsetX, e.offsetY);
}

function draw(e) {
    if (!drawing) return;
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(e.offsetX, e.offsetY);
}

function stopDrawing() {
    drawing = false;
    ctx.beginPath();
    // Sauvegarder la signature en base64
    const canvas = document.getElementById('signatureCanvas');
    signatureData = canvas.toDataURL();
}

function reinitialiserSignature() {
    const canvas = document.getElementById('signatureCanvas');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    signatureData = null;
}

// Gestion photo
document.getElementById('prendrePhoto').addEventListener('click', () => {
    const input = document.getElementById('photoInput');
    input.click();
});

document.getElementById('photoInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            photoData = event.target.result;
            const apercu = document.getElementById('apercuPhoto');
            apercu.innerHTML = `<img src="${photoData}" alt="Photo colis">`;
        };
        reader.readAsDataURL(file);
    }
});

// Validation de la livraison
document.getElementById('validerLivraison').addEventListener('click', async () => {
    if (!signatureData) {
        alert('⚠️ Veuillez prendre la signature du client');
        return;
    }
    
    if (!confirm(`Confirmez la livraison du colis ${livraisonCourante.numero_colis} ?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/livraisons/${livraisonCourante.id}/valider`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                signature_base64: signatureData,
                photo_url: photoData || null
            })
        });
        
        if (response.ok) {
            alert('✅ Livraison validée avec succès !');
            // Fermer le modal
            document.getElementById('modalLivraison').style.display = 'none';
            // Recharger la liste
            chargerLivraisons();
        } else {
            alert('❌ Erreur lors de la validation');
        }
    } catch (error) {
        alert('❌ Erreur de connexion');
    }
});

// Fermer le modal
document.querySelector('.close-modal').addEventListener('click', () => {
    document.getElementById('modalLivraison').style.display = 'none';
});

// Fermer en cliquant à l'extérieur
window.onclick = (e) => {
    const modal = document.getElementById('modalLivraison');
    if (e.target === modal) {
        modal.style.display = 'none';
    }
}; 
// Service Worker pour PWA et mode hors ligne
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(reg => {
        console.log('Service Worker enregistré');
    }).catch(err => {
        console.log('Erreur Service Worker:', err);
    });
}

// Stockage local pour mode hors ligne
const STORAGE_KEY = 'livraisons_hors_ligne';

async function chargerLivraisons() {
    try {
        const response = await fetch(`${API_URL}/livraisons/en-attente`);
        livraisonsEnAttente = await response.json();
        // Sauvegarder en cache
        localStorage.setItem(STORAGE_KEY, JSON.stringify(livraisonsEnAttente));
        afficherListeLivraisons();
    } catch (error) {
        console.log('Mode hors ligne - utilisation du cache');
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
            livraisonsEnAttente = JSON.parse(cached);
            afficherListeLivraisons();
        } else {
            document.getElementById('listeLivraisons').innerHTML = 
                '<div class="loading">⚠️ Pas de connexion et pas de cache disponible</div>';
        }
    }
}

// File d'attente pour les validations hors ligne
let fileAttente = JSON.parse(localStorage.getItem('file_attente') || '[]');

async function validerLivraisonHorsLigne(livraison, signature, photo) {
    // Stocker dans la file d'attente
    fileAttente.push({
        id: livraison.id,
        signature: signature,
        photo: photo,
        timestamp: new Date().toISOString()
    });
    localStorage.setItem('file_attente', JSON.stringify(fileAttente));
    
    // Retirer de la liste des livraisons en attente
    livraisonsEnAttente = livraisonsEnAttente.filter(l => l.id !== livraison.id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(livraisonsEnAttente));
    afficherListeLivraisons();
    
    alert('📱 Livraison enregistrée localement. Sera synchronisée automatiquement.');
    
    // Tenter la synchronisation
    synchroniserFileAttente();
}

async function synchroniserFileAttente() {
    if (fileAttente.length === 0) return;
    
    console.log(`Synchronisation de ${fileAttente.length} livraisons...`);
    
    for (let i = 0; i < fileAttente.length; i++) {
        const item = fileAttente[i];
        try {
            const response = await fetch(`${API_URL}/livraisons/${item.id}/valider`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    signature_base64: item.signature,
                    photo_url: item.photo
                })
            });
            
            if (response.ok) {
                fileAttente.splice(i, 1);
                i--;
                console.log(`✅ Livraison ${item.id} synchronisée`);
            }
        } catch (error) {
            console.log('Erreur synchro, réessaie plus tard');
        }
    }
    
    localStorage.setItem('file_attente', JSON.stringify(fileAttente));
}

// Synchroniser toutes les 2 minutes
setInterval(synchroniserFileAttente, 120000);

// Scanner de code-barres
let html5QrCode = null;

function demarrerScan() {
    const scannerDiv = document.createElement('div');
    scannerDiv.id = 'scanner';
    scannerDiv.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; z-index:2000; background:black;';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✖ Fermer';
    closeBtn.style.cssText = 'position:absolute; top:20px; right:20px; z-index:2001; background:white; border:none; padding:10px; border-radius:50%; font-size:20px; cursor:pointer;';
    closeBtn.onclick = () => {
        if (html5QrCode) {
            html5QrCode.stop();
            html5QrCode = null;
        }
        scannerDiv.remove();
    };
    
    scannerDiv.appendChild(closeBtn);
    document.body.appendChild(scannerDiv);
    
    html5QrCode = new Html5Qrcode("scanner");
    html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decodedText) => {
            // Code-barres scanné = numéro de colis
            const colis = livraisonsEnAttente.find(l => l.numero_colis === decodedText);
            if (colis) {
                html5QrCode.stop();
                scannerDiv.remove();
                ouvrirModal(colis.id);
            } else {
                alert(`Colis ${decodedText} non trouvé dans les livraisons du jour`);
            }
        },
        (error) => { console.log(error); }
    );
}

// Ajouter un bouton scan dans l'interface mobile
// Dans le HTML, ajoutez après le header :
/*
<button id="btnScan" style="position:fixed; bottom:20px; right:20px; width:60px; height:60px; border-radius:50%; background:#667eea; color:white; border:none; font-size:30px; cursor:pointer; box-shadow:0 2px 10px rgba(0,0,0,0.2);">📷</button>
*/

// Et dans app.js :
document.getElementById('btnScan')?.addEventListener('click', demarrerScan);