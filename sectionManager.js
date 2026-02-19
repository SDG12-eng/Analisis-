import { initMetrics } from './metrics/metrics.js';
import { initValidations } from './validations/validations.js';

// Registro centralizado de módulos
export const sections = {
    metrics: {
        id: 'metrics',
        title: 'Dashboard Analytics',
        icon: 'fa-chart-pie',
        htmlPath: './assets/js/metrics/metrics.html',
        init: initMetrics
    },
    validations: {
        id: 'validations',
        title: 'Validador de Datos',
        icon: 'fa-check-double',
        htmlPath: './assets/js/validations/validations.html',
        init: initValidations
    }
};

let currentSection = null;

export function initSectionManager(defaultSectionId) {
    buildSidebar();
    loadSection(defaultSectionId);
}

function buildSidebar() {
    const nav = document.getElementById('sidebar-nav');
    nav.innerHTML = '';
    
    Object.values(sections).forEach(sec => {
        const btn = document.createElement('button');
        btn.id = `nav-${sec.id}`;
        btn.className = 'nav-item nav-inactive';
        btn.innerHTML = `
            <i class="fas ${sec.icon} text-lg w-5 text-center"></i>
            <span class="hidden lg:block">${sec.title}</span>
        `;
        btn.onclick = () => loadSection(sec.id);
        nav.appendChild(btn);
    });
}

export async function loadSection(sectionId) {
    if (currentSection === sectionId) return;
    const sectionData = sections[sectionId];
    if (!sectionData) return;

    // Actualizar UI del Sidebar
    Object.values(sections).forEach(sec => {
        const btn = document.getElementById(`nav-${sec.id}`);
        if(btn) btn.className = (sec.id === sectionId) ? 'nav-item nav-active' : 'nav-item nav-inactive';
    });

    document.getElementById('global-header-title').innerText = sectionData.title;
    const container = document.getElementById('app-content');
    
    try {
        // Cargar HTML dinámico
        const response = await fetch(sectionData.htmlPath);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const html = await response.text();
        
        container.innerHTML = `<div id="section-${sectionId}" class="flex-1 flex flex-col w-full h-full fade-enter relative">${html}</div>`;
        
        // Ejecutar inicializador del módulo
        if (typeof sectionData.init === 'function') {
            sectionData.init();
        }
        
        currentSection = sectionId;
        setTimeout(() => window.dispatchEvent(new Event('resize')), 100); // Fix Chart.js resize
        
    } catch (error) {
        console.error("Error loading section:", error);
        container.innerHTML = `<div class="p-6 text-red-500">Error loading module: ${sectionId}</div>`;
    }
}
