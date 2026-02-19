import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, orderBy, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { setupChartsLogic, loadChartsFromState } from './metricsCharts.js';
import { setupAuditLogic, loadAuditFromState } from './metricsAudit.js';

// --- ESTADO CENTRALIZADO DEL MÓDULO ---
export const MetricsState = {
    rawWorkbooks: {},
    processedDataSources: {},
    currentFileId: null,
    savedWidgetsConfig: [],
    savedAuditWidgetsConfig: [],
    db: null
};

// Config Firebase
const firebaseConfig = { apiKey: "AIzaSyCZXwXN15MYVpFP0-QbgR-H4bHqMH4_EFA", authDomain: "reporte-d37d1.firebaseapp.com", projectId: "reporte-d37d1", storageBucket: "reporte-d37d1.firebasestorage.app", messagingSenderId: "995600823465", appId: "1:995600823465:web:3ae9ede621cf0631ad65b8" };

export function initMetrics() {
    // 1. Inyectar Tabs en el Header Global
    const headerControls = document.getElementById('section-header-controls');
    const template = document.getElementById('metrics-tabs-template');
    if(headerControls && template) {
        headerControls.innerHTML = '';
        headerControls.appendChild(template.content.cloneNode(true));
    }

    // 2. Init Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    MetricsState.db = getFirestore(app);
    signInAnonymously(auth).then(() => loadProjs()).catch(() => console.log("Modo local."));

    // 3. Bindear Eventos de Navegación Interna
    [1,2,3,4].forEach(n => {
        const btn = document.getElementById(`step${n}`);
        if(btn) btn.addEventListener('click', () => switchView(n));
    });
    
    document.getElementById('btnNext1').addEventListener('click', () => switchView(2));
    document.getElementById('btnGoPlayground').addEventListener('click', () => switchView(3));
    document.getElementById('btnGoAudit').addEventListener('click', () => switchView(4));

    // 4. Bindear Eventos de Archivos
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);
    document.getElementById('fileSelector').addEventListener('change', changeActiveFile);
    document.getElementById('sheetSelector').addEventListener('change', renderRawPreview);
    document.getElementById('btnSaveSource').addEventListener('click', saveAsDataSource);

    // 5. Firebase Events
    document.getElementById('btnLoadCloud').addEventListener('click', loadProjs);
    document.querySelectorAll('.btnSaveCloud').forEach(b => b.addEventListener('click', saveToFirebase));

    // 6. Inicializar submódulos
    setupChartsLogic(MetricsState);
    setupAuditLogic(MetricsState);
}

// --- LOGICA INTERNA ---
function switchView(step) {
    ['view-1','view-2','view-3','view-4'].forEach(v => {
        const el = document.getElementById(v);
        if(el) { el.classList.add('hidden'); el.classList.remove('flex'); }
    });
    const target = document.getElementById('view-' + step);
    if(target) { target.classList.remove('hidden'); target.classList.add('flex'); }

    if(step === 4 && Object.keys(MetricsState.processedDataSources).length > 0) {
        document.getElementById('auditAggType').dispatchEvent(new Event('change')); // Fuerza build audit sidebar
    }
    
    setTimeout(() => window.dispatchEvent(new Event('resize')), 100);

    [1,2,3,4].forEach(n => {
        const btn = document.getElementById('step'+n);
        if(btn) {
            if(n === step) { btn.classList.add('step-active'); btn.classList.remove('step-inactive', 'step-disabled'); } 
            else { btn.classList.remove('step-active'); if(btn.disabled) btn.classList.add('step-disabled'); else btn.classList.add('step-inactive'); }
        }
    });
}

async function handleFileUpload(e) {
    const files = Array.from(e.target.files); if(files.length===0) return;
    document.getElementById('uploadStatus').innerText = `Leyendo ${files.length} archivos...`;
    for(let i=0; i<files.length; i++) {
        const data = await files[i].arrayBuffer();
        MetricsState.rawWorkbooks['file_'+i] = { name: files[i].name, workbook: XLSX.read(data) };
    }
    const fSel = document.getElementById('fileSelector'); fSel.innerHTML = '';
    Object.keys(MetricsState.rawWorkbooks).forEach(id => fSel.innerHTML += `<option value="${id}">${MetricsState.rawWorkbooks[id].name}</option>`);
    document.getElementById('btnNext1').classList.remove('hidden');
    changeActiveFile();
    const s2 = document.getElementById('step2');
    if(s2) { s2.disabled = false; s2.classList.remove('step-disabled'); }
}

function changeActiveFile() {
    MetricsState.currentFileId = document.getElementById('fileSelector').value;
    const wb = MetricsState.rawWorkbooks[MetricsState.currentFileId].workbook;
    const sSel = document.getElementById('sheetSelector'); sSel.innerHTML = '';
    wb.SheetNames.forEach(s => sSel.innerHTML += `<option value="${s}">${s}</option>`);
    renderRawPreview();
}

function renderRawPreview() {
    const wb = MetricsState.rawWorkbooks[MetricsState.currentFileId].workbook;
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[document.getElementById('sheetSelector').value], {header:1, defval:""});
    const tbody = document.getElementById('rawTablePreview'); 
    let theadHtml = '<thead><tr><th>#</th>';
    if(raw.length > 0) raw[0].forEach(h => theadHtml += `<th>${h}</th>`);
    theadHtml += '</tr></thead><tbody>';
    for(let i=1; i<Math.min(raw.length,25); i++) {
        theadHtml += `<tr><td class="font-bold text-slate-400 bg-slate-50 text-center border-r">${i}</td>${raw[i].map(c=>`<td>${c}</td>`).join('')}</tr>`;
    }
    tbody.innerHTML = theadHtml + '</tbody>';
}

function saveAsDataSource() {
    const wb = MetricsState.rawWorkbooks[MetricsState.currentFileId].workbook; 
    const sName = document.getElementById('sheetSelector').value;
    const hRow = parseInt(document.getElementById('headerRow').value)-1;
    const sheet = wb.Sheets[sName]; 
    let range = XLSX.utils.decode_range(sheet['!ref']); range.s.r = Math.max(0, hRow);
    let data = XLSX.utils.sheet_to_json(sheet, {range: XLSX.utils.encode_range(range), defval:null});
    let clean = data.map(r => { let c={}; for(let k in r) if(!k.includes("__EMPTY")) c[k.trim()]=r[k]; return c; }).filter(r=>Object.keys(r).length>0);

    if(clean.length===0) return alert("Error: Hoja vacía.");
    let id = 'ds_'+Date.now();
    MetricsState.processedDataSources[id] = { id: id, name: `${MetricsState.rawWorkbooks[MetricsState.currentFileId].name} (${sName})`, columns: Object.keys(clean[0]), data: clean };
    
    const list = document.getElementById('processedSourcesList');
    if(list.children[0]?.tagName === 'P') list.innerHTML = '';
    list.innerHTML += `<div class="p-3 bg-white border border-indigo-100 rounded-lg text-xs text-slate-600 shadow-sm flex items-center gap-2 animate-pulse"><div class="w-2 h-2 rounded-full bg-green-500"></div> ${MetricsState.processedDataSources[id].name}</div>`;
    
    ['step3','step4','btnGoPlayground'].forEach(id => {
        const el = document.getElementById(id);
        if(el) { el.disabled=false; el.classList.remove('step-disabled', 'opacity-50', 'cursor-not-allowed'); }
    });
    
    // Disparar evento a la vista de Charts
    document.getElementById('dsSelector').dispatchEvent(new Event('dsUpdated'));
}

async function saveToFirebase() {
    try {
        await addDoc(collection(MetricsState.db, "reportes_v24"), {
            nombre: document.getElementById('projectName3').value || document.getElementById('projectName4').value || 'Reporte Final', 
            date: serverTimestamp(),
            sources: JSON.stringify(MetricsState.processedDataSources), 
            widgetsLocal: MetricsState.savedWidgetsConfig, 
            widgetsGlobal: MetricsState.savedAuditWidgetsConfig
        });
        alert("Guardado Exitosamente en Nube"); loadProjs();
    } catch(e) { console.error(e); alert("Guardado (Local temporal)"); }
}

async function loadProjs() {
    try {
        const list = document.getElementById('cloudProjectsList');
        if(list) { list.classList.remove('hidden'); list.innerHTML = '<p class="text-xs text-slate-400"><i class="fas fa-spinner fa-spin"></i> Cargando...</p>'; }
        const snaps = await getDocs(query(collection(MetricsState.db, "reportes_v24"), orderBy("date", "desc")));
        if(list) list.innerHTML = '';
        snaps.forEach(doc => {
            const d = doc.data();
            const b = document.createElement('button'); b.className = "w-full text-left p-3 border border-slate-200 rounded-lg text-sm font-semibold hover:bg-indigo-50 text-slate-700 transition";
            b.innerHTML = `<i class="fas fa-cloud text-indigo-400 mr-2"></i> ${d.nombre} <span class="block text-[10px] text-slate-400 font-normal mt-1">${new Date(d.date.seconds*1000).toLocaleString()}</span>`;
            b.onclick = () => {
                MetricsState.processedDataSources = JSON.parse(d.sources); 
                MetricsState.savedWidgetsConfig = d.widgetsLocal||[]; 
                MetricsState.savedAuditWidgetsConfig = d.widgetsGlobal||[];
                
                document.getElementById('dsSelector').dispatchEvent(new Event('dsUpdated'));
                loadChartsFromState();
                loadAuditFromState();
                
                ['step2','step3','step4'].forEach(id => { const btn = document.getElementById(id); if(btn) { btn.disabled=false; btn.classList.remove('step-disabled'); }});
                switchView(3);
            };
            list.appendChild(b);
        });
    } catch(e) { console.log("Offline mode", e); }
}
