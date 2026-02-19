let StateRef = null;

export function setupAuditLogic(MetricsState) {
    StateRef = MetricsState;
    document.querySelectorAll('input[name="auditMode"]').forEach(r => r.addEventListener('change', buildAuditSidebar));
    document.getElementById('auditAggType').addEventListener('change', buildAuditSidebar);
    document.getElementById('btnGenerateAudit').addEventListener('click', () => generateMergedAudit());
}

export function loadAuditFromState() {
    document.getElementById('auditWidgetsGrid').innerHTML = '';
    StateRef.savedAuditWidgetsConfig.forEach(c => generateMergedAudit(c));
}

function buildAuditSidebar() {
    const agg = document.getElementById('auditAggType').value;
    const modeObj = document.querySelector('input[name="auditMode"]:checked');
    const mode = modeObj ? modeObj.value : 'merge';
    const container = document.getElementById('auditMappingContainer'); container.innerHTML = '';
    
    Object.values(StateRef.processedDataSources).forEach(ds => {
        let opts = `<option value="">-- Seleccionar --</option>` + ds.columns.map(c => `<option value="${c}">${c}</option>`).join('');
        let extraInputs = "";
        
        if (agg === 'percent' || agg === 'count') {
            if (mode === 'compare') {
                extraInputs = `<select id="ay_${ds.id}" class="w-full p-1.5 border border-slate-200 rounded-lg text-xs mb-2 outline-none font-medium ds-col-sel">${opts}</select><div class="grid grid-cols-2 gap-2 mt-2"><div class="bg-indigo-50 border border-indigo-100 rounded p-1.5"><span class="text-[9px] font-bold text-indigo-700 block mb-1">Grupo A</span><div id="av_c_A_${ds.id}" class="max-h-24 overflow-y-auto custom-scroll bg-white rounded border border-indigo-100 p-1 text-[10px]">Select...</div></div><div class="bg-pink-50 border border-pink-100 rounded p-1.5"><span class="text-[9px] font-bold text-pink-700 block mb-1">Grupo B (Opcional)</span><div id="av_c_B_${ds.id}" class="max-h-24 overflow-y-auto custom-scroll bg-white rounded border border-pink-100 p-1 text-[10px]">Select...</div></div></div>`;
            } else {
                extraInputs = `<select id="ay_${ds.id}" class="w-full p-1.5 border border-slate-200 rounded-lg text-xs mb-1 outline-none font-medium ds-col-sel-single">${opts}</select><div id="av_c_${ds.id}" class="max-h-32 overflow-y-auto bg-slate-50 border border-slate-200 rounded-lg p-2 text-[10px]">Selecciona Valor...</div>`;
            }
        } else {
            extraInputs = `<select id="ay_${ds.id}" class="w-full p-1.5 border border-slate-200 rounded-lg text-xs outline-none font-medium">${opts}</select>`;
        }

        const wrapper = document.createElement('div');
        wrapper.className = "bg-white border border-slate-200 rounded-xl p-3 mb-3 shadow-sm";
        wrapper.innerHTML = `<div class="flex justify-between font-bold text-xs mb-2 text-slate-800"><span>${ds.name}</span><input type="checkbox" id="inc_${ds.id}" checked class="accent-indigo-600"></div><div class="space-y-2"><label class="text-[10px] text-slate-400 font-bold uppercase block">Agrupar Por</label><select id="ax_${ds.id}" class="w-full p-1.5 border border-slate-200 rounded-lg text-xs outline-none font-medium text-slate-600">${opts}</select><label class="text-[10px] text-slate-400 font-bold uppercase block">Columna Valor/Estado</label>${extraInputs}</div>`;
        container.appendChild(wrapper);

        // Bindear eventos dinámicos
        const selCompare = wrapper.querySelector('.ds-col-sel');
        if(selCompare) selCompare.addEventListener('change', (e) => fillValCompare(ds.id, e.target.value));
        
        const selSingle = wrapper.querySelector('.ds-col-sel-single');
        if(selSingle) selSingle.addEventListener('change', (e) => fillValSingle(ds.id, e.target.value));
    });
}

function fillValSingle(id, col) {
    const container = document.getElementById(`av_c_${id}`); if(!col) { container.innerHTML='Seleccionar...'; return; }
    let vals = new Set(); StateRef.processedDataSources[id].data.forEach(r => { if(r[col]) vals.add(String(r[col]).trim()); });
    container.innerHTML = ''; Array.from(vals).sort().forEach(v => container.innerHTML+=`<label class="flex items-center gap-2 p-1.5 border-b border-slate-100 last:border-0 hover:bg-white cursor-pointer"><input type="checkbox" class="av_chk_${id} rounded text-indigo-600" value="${v}"> ${v}</label>`);
}

function fillValCompare(id, col) {
    const cA = document.getElementById(`av_c_A_${id}`); const cB = document.getElementById(`av_c_B_${id}`);
    if(!col) { cA.innerHTML='Select...'; cB.innerHTML='Select...'; return; }
    let vals = new Set(); StateRef.processedDataSources[id].data.forEach(r => { if(r[col]) vals.add(String(r[col]).trim()); });
    cA.innerHTML = ''; cB.innerHTML = ''; 
    Array.from(vals).sort().forEach(v => { 
        cA.innerHTML+=`<label class="flex items-start gap-1 p-1 border-b hover:bg-indigo-50 cursor-pointer text-[9px]"><input type="checkbox" class="av_chk_A_${id} rounded text-indigo-600 mt-0.5" value="${v}"> <span class="break-all">${v}</span></label>`;
        cB.innerHTML+=`<label class="flex items-start gap-1 p-1 border-b hover:bg-pink-50 cursor-pointer text-[9px]"><input type="checkbox" class="av_chk_B_${id} rounded text-pink-600 mt-0.5" value="${v}"> <span class="break-all">${v}</span></label>`;
    });
}

function generateMergedAudit(cfg=null) {
    document.getElementById('emptyAudit')?.remove();
    let config = cfg;
    if(!config) {
        const mode = document.querySelector('input[name="auditMode"]:checked').value;
        const agg = document.getElementById('auditAggType').value;
        let mappings = [];
        Object.values(StateRef.processedDataSources).forEach(ds => {
            if(document.getElementById(`inc_${ds.id}`)?.checked) {
                let targetsA = []; let targetsB = [];
                if (agg === 'percent' || agg === 'count') { 
                    if(mode === 'compare') {
                        targetsA = Array.from(document.querySelectorAll(`.av_chk_A_${ds.id}:checked`)).map(c=>c.value);
                        targetsB = Array.from(document.querySelectorAll(`.av_chk_B_${ds.id}:checked`)).map(c=>c.value);
                    } else {
                        targetsA = Array.from(document.querySelectorAll(`.av_chk_${ds.id}:checked`)).map(c=>c.value);
                    }
                }
                mappings.push({ dsId: ds.id, name: ds.name, x: document.getElementById(`ax_${ds.id}`).value, y: document.getElementById(`ay_${ds.id}`).value, targets: targetsA, targetsB: targetsB });
            }
        });
        if(mappings.length === 0) return alert("Selecciona fuentes.");
        config = { title: document.getElementById('auditTitle').value || 'Unificado', mode: mode, agg: agg, type: document.getElementById('auditChartType').value, mappings: mappings };
        StateRef.savedAuditWidgetsConfig.push(config);
    }
    const wid = 'aw_'+Date.now()+Math.random();
    const grid = document.getElementById('auditWidgetsGrid');
    const card = document.createElement('div');
    card.className = "flip-container h-[450px] lg:h-[500px] w-full perspective-1000";
    card.innerHTML = `<div class="flipper" id="f_${wid}"><div class="front p-4 lg:p-5 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200"><div class="flex justify-between items-center mb-4"><h3 class="font-bold text-sm text-slate-800">${config.title}</h3><div class="flex gap-2"><button type="button" class="btn-flip w-8 h-8 rounded-full bg-slate-100 hover:text-blue-600 flex items-center justify-center transition"><i class="fas fa-table"></i></button><button type="button" class="btn-delete w-8 h-8 rounded-full bg-slate-100 hover:text-red-600 flex items-center justify-center transition"><i class="fas fa-times"></i></button></div></div><div class="flex-1 relative w-full h-full min-h-[200px]"><canvas id="${wid}"></canvas></div></div><div class="back flex flex-col bg-white rounded-2xl shadow-sm border border-emerald-200 overflow-hidden"><div class="p-4 border-b border-emerald-100 bg-emerald-50 flex justify-between items-center"><h3 class="font-bold text-emerald-800 text-sm">Datos Unificados</h3><button type="button" class="btn-flip text-xs font-bold text-emerald-600 bg-white px-3 py-1 rounded-full shadow-sm">Volver</button></div><div class="flex-1 overflow-auto bg-white border-t p-0" id="tb_${wid}"></div></div></div>`;
    
    grid.appendChild(card); 
    
    card.querySelectorAll('.btn-flip').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); document.getElementById(`f_${wid}`).classList.toggle('flipped'); }));
    card.querySelector('.btn-delete').addEventListener('click', (e) => { e.stopPropagation(); card.remove(); });

    setTimeout(() => renderUnifiedChart(config, wid), 100);
    document.getElementById('canvasArea4').scrollTop = document.getElementById('canvasArea4').scrollHeight;
}

function renderUnifiedChart(cfg, id) {
    let globalLabels = new Set(); let tableData = {};
    
    cfg.mappings.forEach(map => {
        let data = StateRef.processedDataSources[map.dsId].data;
        let local = {};
        data.forEach(r => {
            let k = r[map.x] ? String(r[map.x]).trim() : '(Vacío)'; 
            globalLabels.add(k);
            if(!local[k]) local[k] = {sum:0, count:0, hitsA:0, hitsB:0, valid:0};
            local[k].count++; 
            let v = parseFloat(r[map.y]) || 0; let raw = r[map.y] ? String(r[map.y]).trim() : "";
            
            if(cfg.agg === 'percent' || cfg.agg === 'count') { 
                let isA = map.targets && map.targets.some(t => t.toLowerCase() === raw.toLowerCase());
                let isB = map.targetsB && map.targetsB.some(t => t.toLowerCase() === raw.toLowerCase());
                if(isA) { local[k].hitsA++; local[k].valid++; }
                if(isB) { local[k].hitsB++; }
            } else { local[k].sum += v; }
        });

        Object.keys(local).forEach(k => {
            let res = 0;
            if(cfg.agg === 'percent') res = local[k].count > 0 ? (local[k].hitsA/local[k].count)*100 : 0;
            else if(cfg.agg === 'count') res = local[k].valid;
            else res = local[k].sum;
            
            if(!tableData[k]) tableData[k] = {};
            tableData[k][map.name] = { val: res, hitsA: local[k].hitsA, hitsB: local[k].hitsB, count: local[k].count };
            
            if(cfg.agg === 'percent') {
                 if(!tableData[k].rawHits) tableData[k].rawHits = 0; if(!tableData[k].rawCount) tableData[k].rawCount = 0;
                 tableData[k].rawHits += local[k].hitsA; tableData[k].rawCount += local[k].count;
            } else {
                 if(!tableData[k].rawSum) tableData[k].rawSum = 0; tableData[k].rawSum += (cfg.agg==='count' ? local[k].valid : res);
            }
        });
    });

    let labels = Array.from(globalLabels).sort(); let datasets = []; const colors = ['#4f46e5','#ec4899','#06b6d4','#f59e0b', '#8b5cf6'];
    
    if(cfg.mode === 'compare') {
        let colorIdx = 0;
        cfg.mappings.forEach((map) => {
            if (cfg.agg === 'percent' || cfg.agg === 'count') {
                let dHitsA = labels.map(l => { let d = tableData[l]?.[map.name]; if(!d) return 0; return cfg.agg === 'percent' ? (d.count>0 ? (d.hitsA/d.count)*100 : 0) : d.hitsA; });
                let isBEmpty = !map.targetsB || map.targetsB.length === 0;
                let dHitsB = labels.map(l => { let d = tableData[l]?.[map.name]; if(!d) return 0; let misses = isBEmpty ? (d.count - d.hitsA) : d.hitsB; return cfg.agg === 'percent' ? (d.count>0 ? (misses/d.count)*100 : 0) : misses; });

                let labelA = map.targets && map.targets.length > 0 ? map.targets.join(', ') : 'Grupo A';
                let labelB = isBEmpty ? `No ${labelA}` : map.targetsB.join(', ');
                if(labelA.length > 15) labelA = labelA.substring(0,15) + '...'; if(labelB.length > 15) labelB = labelB.substring(0,15) + '...';

                datasets.push({ label: `${labelA} (${map.name.substring(0,8)})`, data: dHitsA, backgroundColor: colors[colorIdx % colors.length], stack: map.name, maxBarThickness: 50, borderRadius: 4 });
                datasets.push({ label: `${labelB} (${map.name.substring(0,8)})`, data: dHitsB, backgroundColor: isBEmpty ? '#cbd5e1' : colors[(colorIdx+1) % colors.length], stack: map.name, maxBarThickness: 50, borderRadius: 4 });
                colorIdx += 2;
            } else {
                let d = labels.map(l => tableData[l]?.[map.name]?.val || 0);
                datasets.push({ label: map.name, data: d, backgroundColor: colors[colorIdx % colors.length], maxBarThickness: 50, borderRadius: 4 }); colorIdx++;
            }
        });
    } else {
        let d = labels.map(l => { if(cfg.agg === 'percent') { let h = tableData[l]?.rawHits || 0; let c = tableData[l]?.rawCount || 0; return c > 0 ? (h/c)*100 : 0; } else { return tableData[l]?.rawSum || 0; } });
        datasets.push({ label: 'Total Unificado', data: d, backgroundColor: '#10b981', maxBarThickness: 50, borderRadius: 4 });
    }
    
    let th = `<table class="w-full text-xs text-left"><thead class="bg-slate-50 text-slate-600 sticky top-0"><tr><th class="p-3 border-b border-r bg-slate-50">Categoría</th>`;
    datasets.forEach(ds => { th += `<th class="p-3 border-b text-right min-w-[100px] bg-slate-50">${ds.label}</th>`; });
    th += `</tr></thead><tbody>`;
    labels.forEach((l, i) => { 
        th += `<tr class="border-b hover:bg-slate-50"><td class="p-3 font-medium border-r bg-white sticky left-0">${l}</td>`;
        datasets.forEach(ds => { let val = ds.data[i] || 0; th += `<td class="p-3 text-right">${cfg.agg === 'percent' ? val.toFixed(1) + '%' : val.toLocaleString()}</td>`; });
        th += `</tr>`; 
    });
    th += '</tbody></table>'; document.getElementById('tb_' + id).innerHTML = th;

    const ctx = document.getElementById(id).getContext('2d');
    let options = { responsive: true, maintainAspectRatio: false, onClick: (e) => document.getElementById('f_' + id).classList.toggle('flipped'), plugins: { tooltip: { mode: 'index', intersect: false } } };
    if(cfg.type !== 'doughnut') { options.scales = { y: { beginAtZero: true, max: cfg.agg==='percent'?100:undefined }, x: {} }; if (cfg.mode === 'compare' && cfg.type === 'bar' && (cfg.agg === 'percent' || cfg.agg === 'count')) { options.scales.x.stacked = true; options.scales.y.stacked = true; } }
    new Chart(ctx, { type: cfg.type, data: { labels: labels, datasets: datasets }, options: options });
}
