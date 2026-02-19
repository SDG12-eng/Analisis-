// ==========================================
// 🚀 GESTOR DE SECCIONES (SaaS Navigation)
// ==========================================
window.switchSection = (section) => {
    document.getElementById('section-metrics').classList.add('hidden');
    document.getElementById('section-validations').classList.add('hidden');
    document.getElementById('metrics-steps').classList.add('hidden');
    
    document.getElementById('nav-metrics').className = 'nav-item nav-inactive';
    document.getElementById('nav-validations').className = 'nav-item nav-inactive';

    if(section === 'metrics') {
        document.getElementById('section-metrics').classList.remove('hidden');
        document.getElementById('metrics-steps').classList.remove('hidden');
        document.getElementById('nav-metrics').className = 'nav-item nav-active';
        document.getElementById('section-title').innerText = "Dashboard Analytics";
        window.dispatchEvent(new Event('resize')); // Fix Chart.js
    } else {
        document.getElementById('section-validations').classList.remove('hidden');
        document.getElementById('nav-validations').className = 'nav-item nav-active';
        document.getElementById('section-title').innerText = "Validador de Datos Excel";
    }
};

// ==========================================
// 🧠 MÓDULO: SISTEMA DE MÉTRICAS
// ==========================================
let rawWorkbooks = {}; 
let processedDataSources = {}; 
let currentMetricFileId = null;

window.switchMetricView = (step) => {
    document.querySelectorAll('.metric-view').forEach(v => v.classList.add('hidden'));
    document.getElementById(`m-view-${step}`).classList.remove('hidden');
    if(step !== 1) document.getElementById(`m-view-${step}`).classList.add('flex');
    
    [1,2,3,4].forEach(n => {
        const btn = document.getElementById(`step${n}`);
        btn.className = (n === step) ? 'step-btn step-active' : (btn.disabled ? 'step-btn step-disabled' : 'step-btn step-inactive');
    });
};

document.getElementById('fileInput').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    document.getElementById('uploadStatus').innerText = `Procesando ${files.length} archivos...`;
    for(let i=0; i<files.length; i++) {
        const data = await files[i].arrayBuffer();
        rawWorkbooks['file_'+i] = { name: files[i].name, workbook: XLSX.read(data) };
    }
    const fSel = document.getElementById('fileSelector'); fSel.innerHTML = '';
    Object.keys(rawWorkbooks).forEach(id => fSel.innerHTML += `<option value="${id}">${rawWorkbooks[id].name}</option>`);
    document.getElementById('btnNext1').classList.remove('hidden');
    document.getElementById('step2').disabled = false;
    window.changeActiveFile();
});

window.changeActiveFile = () => {
    currentMetricFileId = document.getElementById('fileSelector').value;
    const wb = rawWorkbooks[currentMetricFileId].workbook;
    const sSel = document.getElementById('sheetSelector'); sSel.innerHTML = '';
    wb.SheetNames.forEach(s => sSel.innerHTML += `<option value="${s}">${s}</option>`);
    window.renderRawPreview();
};

window.renderRawPreview = () => {
    const wb = rawWorkbooks[currentMetricFileId].workbook;
    const sheet = document.getElementById('sheetSelector').value;
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheet], {header:1, defval:""});
    const tbody = document.getElementById('rawTablePreview');
    let html = '<thead><tr>' + raw[0].map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>';
    for(let i=1; i<Math.min(raw.length, 15); i++) {
        html += '<tr>' + raw[i].map(c => `<td>${c}</td>`).join('') + '</tr>';
    }
    tbody.innerHTML = html + '</tbody>';
};

window.saveAsDataSource = () => {
    const wb = rawWorkbooks[currentMetricFileId].workbook;
    const sName = document.getElementById('sheetSelector').value;
    const hRow = parseInt(document.getElementById('headerRow').value) - 1;
    const sheet = wb.Sheets[sName];
    let range = XLSX.utils.decode_range(sheet['!ref']); range.s.r = Math.max(0, hRow);
    let data = XLSX.utils.sheet_to_json(sheet, {range: XLSX.utils.encode_range(range), defval:null});
    let clean = data.filter(r => Object.keys(r).length > 0);
    
    let id = 'ds_' + Date.now();
    processedDataSources[id] = { id, name: `${rawWorkbooks[currentMetricFileId].name} (${sName})`, columns: Object.keys(clean[0]), data: clean };
    document.getElementById('processedSourcesList').innerHTML += `<div class="p-2 bg-indigo-50 border rounded text-[10px] font-bold text-indigo-700">${processedDataSources[id].name}</div>`;
    
    document.getElementById('step3').disabled = false;
    document.getElementById('step4').disabled = false;
    updateSelectors();
};

function updateSelectors() {
    const dsSel = document.getElementById('dsSelector'); dsSel.innerHTML = '';
    Object.values(processedDataSources).forEach(d => dsSel.innerHTML += `<option value="${d.id}">${d.name}</option>`);
    window.onDataSourceChange();
}

window.onDataSourceChange = () => {
    const id = document.getElementById('dsSelector').value; if(!id) return;
    const cols = processedDataSources[id].columns;
    document.querySelectorAll('.column-selector').forEach(s => { s.innerHTML = ''; cols.forEach(c => s.innerHTML += `<option value="${c}">${c}</option>`); });
};

// --- LOGICA DE GRAFICOS (Simplificada para el ejemplo) ---
window.buildWidget = () => {
    const dsId = document.getElementById('dsSelector').value;
    const config = {
        title: document.getElementById('widgetTitle').value || 'Gráfico',
        x: document.getElementById('axisX').value,
        y: document.getElementById('axisY').value,
        agg: document.getElementById('aggType').value,
        type: document.getElementById('selectedChartType').value
    };
    const wid = 'chart_' + Date.now();
    const grid = document.getElementById('widgetsGrid');
    const card = document.createElement('div');
    card.className = "flip-container";
    card.innerHTML = `<div class="flipper" id="f_${wid}"><div class="front p-5 flex flex-col"><h4 class="font-bold text-sm mb-4">${config.title}</h4><div class="flex-1"><canvas id="${wid}"></canvas></div></div></div>`;
    grid.appendChild(card);
    
    const ctx = document.getElementById(wid).getContext('2d');
    const data = processedDataSources[dsId].data;
    const labels = [...new Set(data.map(r => r[config.x]))];
    const values = labels.map(l => data.filter(r => r[config.x] === l).length);
    
    new Chart(ctx, { type: config.type, data: { labels, datasets: [{ label: config.agg, data: values, backgroundColor: '#6366f1' }] }, options: { responsive: true, maintainAspectRatio: false } });
};

// ==========================================
// ✅ MÓDULO: VALIDADOR DE DATOS
// ==========================================
let valWb1 = null; let valWb2 = null;

function setupValInput(fileId, wbKey, hojaId, colId, tableId, infoId) {
    document.getElementById(fileId).addEventListener('change', async (e) => {
        const file = e.target.files[0]; if(!file) return;
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        if(wbKey === 'wb1') valWb1 = workbook; else valWb2 = workbook;
        
        const sel = document.getElementById(hojaId); sel.innerHTML = '';
        workbook.SheetNames.forEach(n => sel.add(new Option(n, n)));
        updateValPreview(workbook, workbook.SheetNames[0], colId, tableId, infoId);
    });
}

function updateValPreview(wb, sheetName, colId, tableId, infoId) {
    const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {defval: ""});
    const cols = Object.keys(data[0]);
    const sel = document.getElementById(colId); sel.innerHTML = '';
    cols.forEach(c => sel.add(new Option(c, c)));
    document.getElementById(infoId).innerText = `Total: ${data.length} filas.`;
}

setupValInput('archivo1', 'wb1', 'hoja1', 'col1', 'tabla1', 'info1');
setupValInput('archivo2', 'wb2', 'hoja2', 'col2', 'tabla2', 'info2');

document.getElementById('btnValidar').addEventListener('click', () => {
    if(!valWb1 || !valWb2) return alert("Sube ambos archivos");
    const dataMain = XLSX.utils.sheet_to_json(valWb1.Sheets[document.getElementById('hoja1').value]);
    const dataRef = new Set(XLSX.utils.sheet_to_json(valWb2.Sheets[document.getElementById('hoja2').value]).map(r => String(r[document.getElementById('col2').value]).trim()));
    
    const validated = dataMain.map(r => ({ ...r, ESTADOS: dataRef.has(String(r[document.getElementById('col1').value]).trim()) ? 'DIGITALIZADO' : 'NO DIGITALIZADO' }));
    
    const ws = XLSX.utils.json_to_sheet(validated);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resultado");
    XLSX.writeFile(wb, "Validacion_DataMaster.xlsx");
});

// Inicialización
switchSection('metrics');
