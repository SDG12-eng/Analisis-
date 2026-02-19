let StateRef = null;

export function setupChartsLogic(MetricsState) {
    StateRef = MetricsState;

    document.getElementById('dsSelector').addEventListener('dsUpdated', updateSelectors);
    document.getElementById('dsSelector').addEventListener('change', onDataSourceChange);
    document.getElementById('aggType').addEventListener('change', togglePercentUI);
    document.getElementById('axisY').addEventListener('change', updatePercentTargets);
    document.getElementById('btnAddFilter').addEventListener('click', addGlobalFilter);
    document.getElementById('btnBuildWidget').addEventListener('click', () => buildWidget());

    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.addEventListener('click', (e) => selectChartType(e.currentTarget.dataset.type));
    });
}

export function loadChartsFromState() {
    document.getElementById('widgetsGrid').innerHTML = '';
    StateRef.savedWidgetsConfig.forEach(c => buildWidget(c));
}

function updateSelectors() {
    const dsSel = document.getElementById('dsSelector'); const currentVal = dsSel.value; dsSel.innerHTML = '';
    Object.values(StateRef.processedDataSources).forEach(d => dsSel.innerHTML += `<option value="${d.id}">${d.name}</option>`);
    if(currentVal && StateRef.processedDataSources[currentVal]) dsSel.value = currentVal;
    onDataSourceChange();
}

function onDataSourceChange() {
    const id = document.getElementById('dsSelector').value; if(!id) return;
    const cols = StateRef.processedDataSources[id].columns;
    document.querySelectorAll('.column-selector').forEach(s => { s.innerHTML = ''; cols.forEach(c => s.innerHTML+=`<option value="${c}">${c}</option>`); });
    updatePercentTargets();
}

function selectChartType(type) {
    document.getElementById('selectedChartType').value = type;
    document.querySelectorAll('.chart-btn').forEach(b => {
        b.classList.remove('bg-slate-800', 'text-white', 'border-slate-800');
        if(b.dataset.type === type) b.classList.add('bg-slate-800', 'text-white', 'border-slate-800');
    });
}

function togglePercentUI() { 
    const show = document.getElementById('aggType').value === 'percent' || document.getElementById('aggType').value === 'count'; 
    document.getElementById('percentTargetUI').classList.toggle('hidden', !show); 
    if(show) updatePercentTargets(); 
}

function updatePercentTargets() {
    const col = document.getElementById('axisY').value; const id = document.getElementById('dsSelector').value;
    if(!col || !id) return;
    let vals = new Set(); StateRef.processedDataSources[id].data.forEach(r => { if(r[col]) vals.add(String(r[col]).trim()); });
    const container = document.getElementById('percentTargetValue'); container.innerHTML = '';
    Array.from(vals).sort().forEach(v => { container.innerHTML += `<label class="flex items-center gap-2 p-1.5 hover:bg-slate-50 cursor-pointer border-b border-slate-50"><input type="checkbox" class="target-val-chk rounded text-indigo-600 focus:ring-0" value="${v}"><span class="truncate text-xs">${v}</span></label>`; });
}

function addGlobalFilter() {
    const id = document.getElementById('dsSelector').value; const fId = 'gf_'+Date.now();
    const div = document.createElement('div'); div.className = "bg-white border p-2 rounded-lg text-xs relative mt-2 shadow-sm";
    
    // Usamos event delegation para checkboxes en filtros globales
    div.innerHTML = `<button type="button" class="absolute -top-2 -right-2 bg-white text-red-500 rounded-full w-5 h-5 flex items-center justify-center shadow border hover:bg-red-50 btn-remove-filter">×</button><select id="c_${fId}" class="w-full border rounded mb-2 text-[11px] p-1 font-bold outline-none filter-col-sel"><option>Seleccionar Columna...</option>${StateRef.processedDataSources[id].columns.map(c=>`<option value="${c}">${c}</option>`).join('')}</select><div id="k_${fId}" class="max-h-24 overflow-y-auto custom-scroll space-y-1"></div>`;
    
    document.getElementById('globalFiltersArea').appendChild(div);
    
    div.querySelector('.btn-remove-filter').addEventListener('click', (e) => e.target.closest('div').remove());
    div.querySelector('.filter-col-sel').addEventListener('change', (e) => {
        const col = e.target.value; const box = document.getElementById(`k_${fId}`); box.innerHTML = '';
        let vals = new Set(); StateRef.processedDataSources[id].data.forEach(r => { if(r[col]) vals.add(String(r[col]).trim()); });
        Array.from(vals).sort().forEach(v => box.innerHTML += `<label class="flex items-center gap-2 text-[10px] hover:bg-slate-50 p-1 rounded"><input type="checkbox" checked class="ck_${fId} rounded text-indigo-600" value="${v}"><span class="truncate">${v}</span></label>`);
    });
}

function buildWidget(cfg=null) {
    document.getElementById('emptyLocal')?.remove();
    let config = cfg;
    if(!config) {
        const dsId = document.getElementById('dsSelector').value;
        if(!dsId) return alert("Selecciona una fuente de datos");
        let filters = []; 
        document.querySelectorAll('[id^="c_gf_"]').forEach(s => { if(s.value && s.value !== 'Seleccionar Columna...') { let fid = s.id.split('_')[2]; let allowed = Array.from(document.querySelectorAll(`.ck_gf_${fid}:checked`)).map(c=>c.value); filters.push({col: s.value, allowed: allowed}); } });
        let targets = Array.from(document.querySelectorAll('.target-val-chk:checked')).map(c=>c.value);
        config = { title: document.getElementById('widgetTitle').value || 'Gráfico Generado', dsId: dsId, x: document.getElementById('axisX').value, y: document.getElementById('axisY').value, agg: document.getElementById('aggType').value, targets: targets, type: document.getElementById('selectedChartType').value, filters: filters };
        StateRef.savedWidgetsConfig.push(config);
    }

    const wid = 'chart_' + Date.now() + Math.random();
    const grid = document.getElementById('widgetsGrid');
    const card = document.createElement('div');
    card.className = "flip-container w-full h-[400px]"; 
    
    card.innerHTML = `<div class="flipper" id="flip_${wid}"><div class="front p-4 lg:p-5 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200"><div class="flex justify-between items-start mb-2"><div><h3 class="font-bold text-slate-800 text-sm lg:text-base">${config.title}</h3><p class="text-[10px] text-slate-400 uppercase font-bold tracking-wide">${config.agg} por ${config.x}</p></div><div class="flex gap-1"><button type="button" class="btn-flip p-1.5 text-slate-400 hover:text-indigo-600 transition"><i class="fas fa-table"></i></button><button type="button" class="btn-delete p-1.5 text-slate-400 hover:text-red-500 transition"><i class="fas fa-trash"></i></button></div></div><div class="flex-1 relative w-full h-full min-h-[200px]"><canvas id="${wid}"></canvas></div><p class="text-[10px] text-center text-slate-400 mt-2 italic"><i class="fas fa-hand-pointer mr-1"></i> Toca para ver datos</p></div><div class="back flex flex-col bg-white rounded-2xl shadow-sm border border-indigo-100 overflow-hidden"><div class="p-3 border-b border-indigo-50 bg-indigo-50/50 flex justify-between items-center"><h3 class="font-bold text-indigo-900 text-xs uppercase">Datos Detallados</h3><button type="button" class="btn-flip text-[10px] font-bold text-indigo-600 bg-white border border-indigo-100 px-2 py-1 rounded shadow-sm">Volver</button></div><div class="flex-1 overflow-auto custom-scroll bg-white"><table class="w-full text-xs text-left" id="table_${wid}"></table></div></div></div>`;
    
    grid.appendChild(card);
    
    // Bindear botones internos
    card.querySelectorAll('.btn-flip').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); document.getElementById(`flip_${wid}`).classList.toggle('flipped'); }));
    card.querySelector('.btn-delete').addEventListener('click', (e) => { e.stopPropagation(); card.remove(); });

    setTimeout(() => renderChart(config, wid, StateRef.processedDataSources[config.dsId].data), 50);
    document.getElementById('canvasArea3').scrollTop = document.getElementById('canvasArea3').scrollHeight; 
}

function renderChart(cfg, canvasId, data) {
    let fdata = data;
    if(cfg.filters) { cfg.filters.forEach(f => { fdata = fdata.filter(r => { let v = r[f.col] ? String(r[f.col]).trim() : ""; return f.allowed.includes(v); }); }); }
    let groups = {};
    fdata.forEach(r => {
        let k = r[cfg.x] ? String(r[cfg.x]).trim() : '(General)';
        let v = parseFloat(r[cfg.y]) || 0;
        let rawVal = r[cfg.y] ? String(r[cfg.y]).trim() : "";
        if(!groups[k]) groups[k] = { sum: 0, count: 0, hits: 0, valid: 0 };
        groups[k].count++;
        if(cfg.agg === 'percent' || cfg.agg === 'count') {
            if(cfg.targets && cfg.targets.length > 0) {
                let match = cfg.targets.some(t => t.toLowerCase().trim() === rawVal.toLowerCase().trim());
                if(match) { groups[k].hits++; groups[k].valid++; }
            } else { if(cfg.agg === 'count' && r[cfg.y]) groups[k].valid++; }
        } else { groups[k].sum += v; }
    });

    let labels = Object.keys(groups);
    let vals = labels.map(l => {
        if(cfg.agg === 'percent') return groups[l].count > 0 ? (groups[l].hits / groups[l].count) * 100 : 0;
        if(cfg.agg === 'count') return groups[l].valid;
        if(cfg.agg === 'avg') return groups[l].count > 0 ? groups[l].sum / groups[l].count : 0;
        return groups[l].sum;
    });

    let th = `<thead class="bg-slate-50 text-slate-500 sticky top-0 z-10"><tr><th class="p-2 border-b text-left">Categoría</th><th class="p-2 border-b text-right">Valor</th></tr></thead><tbody>`;
    labels.forEach((l, i) => {
        let display = cfg.agg === 'percent' ? vals[i].toFixed(1) + '%' : vals[i].toLocaleString();
        th += `<tr class="border-b border-slate-50 hover:bg-slate-50"><td class="p-2 font-medium text-slate-700">${l}</td><td class="p-2 text-right font-bold text-slate-900">${display}</td></tr>`;
    });
    th += '</tbody>';
    document.getElementById('table_' + canvasId).innerHTML = th;

    const ctx = document.getElementById(canvasId).getContext('2d');
    let options = { responsive: true, maintainAspectRatio: false, onClick: (e) => document.getElementById('flip_' + canvasId).classList.toggle('flipped') };
    if(cfg.type !== 'doughnut' && cfg.type !== 'pie') options.scales = { y: { beginAtZero: true, max: cfg.agg==='percent'?100:undefined } };

    new Chart(ctx, { type: cfg.type, data: { labels: labels, datasets: [{ label: cfg.agg.toUpperCase(), data: vals, backgroundColor: cfg.type==='line'?'transparent':['#4f46e5','#06b6d4','#f59e0b','#ec4899','#10b981'], borderColor: cfg.type==='line'?'#4f46e5':'white', borderWidth: 2, borderRadius: 4, maxBarThickness: 60 }] }, options: options });
}
