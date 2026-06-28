/**
 * ViajeDesk - Core Application Logic
 * A local-first responsive SPA for organizing group trips.
 */

// ==========================================
// 1. STATE & ROUTING CONFIGURATION
// ==========================================
let navState = {
    page: 'inicio', // 'inicio', 'personas', 'registro-persona', 'visualizacion-persona', 'aceptaciones-legales', 'viaje', 'ajustes'
    personaId: null, // active persona ID for views
    viajeId: null,   // active viaje ID for views
    editMode: false, // edit vs create mode for forms
    sourcePage: null, // navigational origin context
    viajeSection: 'transporte-ida-vuelta' // active tab in travel view
};

// Navigation history stack for "back" button logic
let navigationHistory = [];

// Interval ID for travel countdown timer
let countdownIntervalId = null;

// ==========================================
// 2. LOCALSTORAGE STORAGE LAYER (DATA LAYER)
// ==========================================
const PREFIX = 'viajedesk_';

const KEYS = {
    personas: `${PREFIX}personas`,
    viajes: `${PREFIX}viajes`,
    tareas: `${PREFIX}tareas`,
    textosLegales: `${PREFIX}textosLegales`,
    aceptaciones: `${PREFIX}aceptaciones`,
    ajustes: `${PREFIX}ajustes`,
    notas: `${PREFIX}notas`
};

// Low-level helper storage functions
function getData(key) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (e) {
        console.error(`Error reading key ${key} from localStorage:`, e);
        showToast('Error al leer de la base de datos local.', 'error');
        return null;
    }
}

function setData(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.error(`Error writing key ${key} to localStorage:`, e);
        showToast('Error de almacenamiento. ¿Está lleno el disco?', 'error');
        return false;
    }
}

function generateId() {
    return 'vd_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
}

// Personas CRUD Operations
function getPersonas() {
    return getData(KEYS.personas) || [];
}

function savePersonas(personas) {
    return setData(KEYS.personas, personas);
}

function getPersonaById(id) {
    return getPersonas().find(p => p.id === id);
}

function createPersona(persona) {
    const personas = getPersonas();
    const newPersona = {
        id: generateId(),
        fechaCreacion: new Date().toISOString(),
        fechaActualizacion: new Date().toISOString(),
        ...persona
    };
    personas.push(newPersona);
    savePersonas(personas);
    return newPersona;
}

function updatePersona(id, updatedFields) {
    const personas = getPersonas();
    const index = personas.findIndex(p => p.id === id);
    if (index === -1) return null;

    personas[index] = {
        ...personas[index],
        ...updatedFields,
        fechaActualizacion: new Date().toISOString()
    };
    savePersonas(personas);
    return personas[index];
}

function deletePersona(id) {
    // Remove persona from global list
    const personas = getPersonas();
    const filtered = personas.filter(p => p.id !== id);
    savePersonas(filtered);

    // Remove persona from all trips
    const viajes = getViajes();
    let viajesModified = false;
    viajes.forEach(v => {
        const originalLength = v.participantes.length;
        v.participantes = v.participantes.filter(p => p.personaId !== id);
        if (v.participantes.length !== originalLength) {
            v.fechaActualizacion = new Date().toISOString();
            viajesModified = true;
        }
    });
    if (viajesModified) saveViajes(viajes);

    // Unassign tasks assigned to this persona
    const tareas = getTareas();
    let tareasModified = false;
    tareas.forEach(t => {
        if (t.personaAsignadaId === id) {
            t.personaAsignadaId = "";
            t.fechaActualizacion = new Date().toISOString();
            tareasModified = true;
        }
    });
    if (tareasModified) saveTareas(tareas);

    return true;
}

// Viajes CRUD Operations
function getViajes() {
    return getData(KEYS.viajes) || [];
}

function saveViajes(viajes) {
    return setData(KEYS.viajes, viajes);
}

function getViajeById(id) {
    return getViajes().find(v => v.id === id);
}

function createViaje(viaje) {
    const viajes = getViajes();
    const newViaje = {
        id: generateId(),
        participantes: [],
        transporteHastaDestino: {
            horariosGenerales: '',
            ida: {
                estacionSalida: '',
                estacionLlegada: '',
                horaSalida: '',
                horaLlegada: '',
                numTren: '',
                operador: '',
                notas: ''
            },
            vuelta: {
                estacionSalida: '',
                estacionLlegada: '',
                horaSalida: '',
                horaLlegada: '',
                numTren: '',
                operador: '',
                notas: ''
            }
        },
        transporteEnDestino: {
            infoLibre: '',
            bloques: [] // {id, titulo, descripcion, hora, lugar, notas}
        },
        fechaCreacion: new Date().toISOString(),
        fechaActualizacion: new Date().toISOString(),
        ...viaje
    };
    viajes.push(newViaje);
    saveViajes(viajes);
    return newViaje;
}

function updateViaje(id, updatedFields) {
    const viajes = getViajes();
    const index = viajes.findIndex(v => v.id === id);
    if (index === -1) return null;

    viajes[index] = {
        ...viajes[index],
        ...updatedFields,
        fechaActualizacion: new Date().toISOString()
    };
    saveViajes(viajes);
    return viajes[index];
}

function deleteViaje(id) {
    // Delete travel
    const viajes = getViajes();
    saveViajes(viajes.filter(v => v.id !== id));

    // Delete tasks associated with the travel
    const tareas = getTareas();
    saveTareas(tareas.filter(t => t.viajeId !== id));
    return true;
}

// Tareas CRUD Operations
function getTareas() {
    return getData(KEYS.tareas) || [];
}

function saveTareas(tareas) {
    return setData(KEYS.tareas, tareas);
}

function getTareasByPersona(personaId) {
    return getTareas().filter(t => t.personaAsignadaId === personaId);
}

function getTareasByViaje(viajeId) {
    return getTareas().filter(t => t.viajeId === viajeId);
}

function createTarea(tarea) {
    const tareas = getTareas();
    const newTarea = {
        id: generateId(),
        estado: 'pendiente', // 'pendiente', 'completada'
        fechaCreacion: new Date().toISOString(),
        fechaActualizacion: new Date().toISOString(),
        ...tarea
    };
    tareas.push(newTarea);
    saveTareas(tareas);
    return newTarea;
}

function updateTarea(id, updatedFields) {
    const tareas = getTareas();
    const index = tareas.findIndex(t => t.id === id);
    if (index === -1) return null;

    tareas[index] = {
        ...tareas[index],
        ...updatedFields,
        fechaActualizacion: new Date().toISOString()
    };
    saveTareas(tareas);
    return tareas[index];
}

function deleteTarea(id) {
    const tareas = getTareas();
    saveTareas(tareas.filter(t => t.id !== id));
    return true;
}

// Notas CRUD Operations
function getNotas() {
    return getData(KEYS.notas) || [];
}

function saveNotas(notas) {
    return setData(KEYS.notas, notas);
}

function getNotaById(id) {
    return getNotas().find(n => n.id === id);
}

function createNota(nota) {
    const notas = getNotas();
    const newNota = {
        id: generateId(),
        fechaCreacion: new Date().toISOString(),
        fechaActualizacion: new Date().toISOString(),
        ...nota
    };
    notas.push(newNota);
    saveNotas(notas);
    return newNota;
}

function updateNota(id, updatedFields) {
    const notas = getNotas();
    const index = notas.findIndex(n => n.id === id);
    if (index === -1) return null;

    notas[index] = {
        ...notas[index],
        ...updatedFields,
        fechaActualizacion: new Date().toISOString()
    };
    saveNotas(notas);
    return notas[index];
}

function deleteNota(id) {
    const notas = getNotas();
    const filtered = notas.filter(n => n.id !== id);
    return saveNotas(filtered);
}

// Textos Legales Management
function getTextosLegales() {
    let textos = getData(KEYS.textosLegales);
    if (!textos) {
        textos = [
            {
                id: 'leg_proteccion_datos',
                tipo: 'proteccion_datos',
                titulo: 'Política de Protección de Datos',
                contenido: 'Este texto debe ser revisado y adaptado antes de usar la aplicación con datos reales. Los datos introducidos se almacenan localmente en este dispositivo y se usan únicamente para la organización del viaje.',
                fechaActualizacion: new Date().toISOString()
            },
            {
                id: 'leg_terminos_viaje',
                tipo: 'terminos_viaje',
                titulo: 'Términos y Condiciones del Viaje',
                contenido: 'Este texto debe ser revisado y adaptado antes de usar la aplicación con datos reales. La participación en el viaje implica aceptar las normas organizativas indicadas por el responsable.',
                fechaActualizacion: new Date().toISOString()
            }
        ];
        saveTextosLegales(textos);
    }
    return textos;
}

function saveTextosLegales(textos) {
    return setData(KEYS.textosLegales, textos);
}

// Backup & Data Control API
function exportAllData() {
    const data = {
        personas: getPersonas(),
        viajes: getViajes(),
        tareas: getTareas(),
        notas: getNotas(),
        textosLegales: getTextosLegales(),
        ajustes: getData(KEYS.ajustes) || {}
    };
    return JSON.stringify(data, null, 2);
}

function importAllData(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        if (!data || typeof data !== 'object') return false;

        // Basic structural validation
        if (data.personas && !Array.isArray(data.personas)) return false;
        if (data.viajes && !Array.isArray(data.viajes)) return false;
        if (data.tareas && !Array.isArray(data.tareas)) return false;
        if (data.notas && !Array.isArray(data.notas)) return false;

        // Save imported arrays
        if (data.personas) savePersonas(data.personas);
        if (data.viajes) saveViajes(data.viajes);
        if (data.tareas) saveTareas(data.tareas);
        if (data.notas) saveNotas(data.notas);
        if (data.textosLegales) saveTextosLegales(data.textosLegales);
        if (data.ajustes) setData(KEYS.ajustes, data.ajustes);

        const settings = getData(KEYS.ajustes) || {};
        settings.ultimaImportacion = new Date().toISOString();
        setData(KEYS.ajustes, settings);

        return true;
    } catch (e) {
        console.error('Error importing backup data:', e);
        return false;
    }
}

function resetAllData() {
    localStorage.removeItem(KEYS.personas);
    localStorage.removeItem(KEYS.viajes);
    localStorage.removeItem(KEYS.tareas);
    localStorage.removeItem(KEYS.notas);
    localStorage.removeItem(KEYS.textosLegales);
    localStorage.removeItem(KEYS.aceptaciones);
    localStorage.removeItem(KEYS.ajustes);
    // Reinitialize default data
    initDefaultData();
}

// ==========================================
// 3. SEED INITIAL DATA
// ==========================================
function initDefaultData() {
    // Triggers textos legales init
    getTextosLegales();
}

// ==========================================
// 4. UI FEEDBACK AND COMPONENT HELPERS
// ==========================================

// Toast Notifications System
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `flex items-center space-x-3 px-4 py-3 rounded-xl border shadow-xl transition-all duration-300 transform translate-y-2 opacity-0 pointer-events-auto max-w-sm glass`;

    // Choose colors/borders based on toast type
    let iconColor = 'text-brand-600';
    let borderColor = 'border-zinc-200';
    let iconSvg = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;

    if (type === 'success') {
        borderColor = 'border-emerald-500/30';
        iconColor = 'text-emerald-600';
        iconSvg = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    } else if (type === 'error') {
        borderColor = 'border-rose-500/30';
        iconColor = 'text-rose-600';
        iconSvg = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
    } else if (type === 'warning') {
        borderColor = 'border-amber-500/30';
        iconColor = 'text-amber-600';
        iconSvg = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
    }

    toast.classList.add(borderColor);

    toast.innerHTML = `
        <div class="${iconColor} flex-shrink-0">${iconSvg}</div>
        <div class="text-sm font-medium text-zinc-800 pr-2">${message}</div>
    `;

    container.appendChild(toast);

    // Animation trigger
    setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    // Auto dismiss after 3 seconds
    setTimeout(() => {
        toast.classList.add('translate-y-[-10px]', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Modal System
function showModal(title, bodyHtml, buttons = []) {
    const modalContainer = document.getElementById('modal-container');
    const modalContent = document.getElementById('modal-content');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalFooter = document.getElementById('modal-footer');

    if (!modalContainer || !modalContent) return;

    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHtml;
    modalFooter.innerHTML = '';

    if (buttons.length === 0) {
        buttons = [{ text: 'Cerrar', class: 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700', action: closeModal }];
    }

    buttons.forEach(btn => {
        const button = document.createElement('button');
        button.textContent = btn.text;
        button.className = `px-4 py-2 rounded-xl text-sm font-semibold transition-all focus:outline-none ${btn.class || 'bg-brand-600 hover:bg-brand-500 text-white'}`;
        button.onclick = () => {
            if (btn.action) btn.action();
        };
        modalFooter.appendChild(button);
    });

    modalContainer.classList.remove('hidden');
    setTimeout(() => {
        modalContainer.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
    }, 50);
}

function closeModal() {
    const modalContainer = document.getElementById('modal-container');
    const modalContent = document.getElementById('modal-content');
    if (!modalContainer) return;

    modalContainer.classList.add('opacity-0');
    modalContent.classList.add('scale-95');
    setTimeout(() => {
        modalContainer.classList.add('hidden');
    }, 300);
}

// Custom UI Confirm Dialog
function showConfirm(title, message, onConfirm, confirmText = 'Confirmar', isDanger = false) {
    const bodyHtml = `<p class="text-zinc-600 text-sm font-normal leading-relaxed">${message}</p>`;
    const buttons = [
        {
            text: 'Cancelar',
            class: 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700',
            action: closeModal
        },
        {
            text: confirmText,
            class: isDanger ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20' : 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/20',
            action: () => {
                closeModal();
                if (onConfirm) onConfirm();
            }
        }
    ];
    showModal(title, bodyHtml, buttons);
}

// Copy to Clipboard Wrapper
function copyToClipboard(text, customMessage = 'Texto copiado al portapapeles') {
    navigator.clipboard.writeText(text).then(() => {
        showToast(customMessage, 'success');
    }).catch(err => {
        console.error('Error copying text: ', err);
        showToast('Error al copiar el texto.', 'error');
    });
}

// Status Badges generators
function renderBadge(status) {
    const base = "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border";
    switch (status?.toLowerCase()) {
        case 'confirmado':
        case 'aceptado':
        case 'pagado':
        case 'completado':
            return `<span class="${base} bg-emerald-50 text-emerald-700 border-emerald-200">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>${status}
            </span>`;
        case 'pendiente':
        case 'no aceptado':
            return `<span class="${base} bg-amber-50 text-amber-700 border-amber-200">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>${status}
            </span>`;
        case 'no pagado':
            return `<span class="${base} bg-rose-50 text-rose-700 border-rose-200">
                <span class="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>${status}
            </span>`;
        case 'falta información':
        default:
            return `<span class="${base} bg-zinc-100 text-zinc-600 border-zinc-200">
                <span class="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1.5"></span>${status || 'Falta información'}
            </span>`;
    }
}

// Calculate age from birth date string
function calculateAge(dobString) {
    if (!dobString) return null;
    const today = new Date();
    const birthDate = new Date(dobString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

// Format Date string helper
function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
        return dateStr;
    }
}

// Format DateTime string helper
function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return '';
    try {
        const d = new Date(dateTimeStr);
        if (isNaN(d.getTime())) return dateTimeStr;
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return dateTimeStr;
    }
}

// ==========================================
// 5. VIEW CONTROL & ROUTING ENGINE
// ==========================================
function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    if (!menu) return;
    menu.classList.toggle('hidden');
}

function initMobileMenu() {
    const btn = document.getElementById('mobile-menu-btn');
    if (btn) {
        btn.onclick = toggleMobileMenu;
    }
}

function showPage(pageName, params = {}, pushHistory = true) {
    // Clear countdown interval if leaving voyage page
    if (pageName !== 'viaje' && countdownIntervalId) {
        clearInterval(countdownIntervalId);
        countdownIntervalId = null;
    }

    // Record history if requested
    if (pushHistory) {
        navigationHistory.push({
            page: navState.page,
            personaId: navState.personaId,
            viajeId: navState.viajeId,
            editMode: navState.editMode,
            sourcePage: navState.sourcePage,
            viajeSection: navState.viajeSection
        });
    }

    // Set new parameters
    navState.page = pageName;
    navState.personaId = params.personaId !== undefined ? params.personaId : null;
    navState.viajeId = params.viajeId !== undefined ? params.viajeId : null;
    navState.editMode = params.editMode !== undefined ? params.editMode : false;
    navState.sourcePage = params.sourcePage !== undefined ? params.sourcePage : null;
    if (params.viajeSection !== undefined) navState.viajeSection = params.viajeSection;

    // Update active state in sidebars
    updateActiveSidebarNav(pageName);

    // Set page header title
    const headerTitle = document.getElementById('current-view-title');
    if (headerTitle) {
        headerTitle.textContent = getPageTitle(pageName, navState.editMode);
    }

    // Render corresponding view content
    renderActiveView();
}

function goBack() {
    if (navigationHistory.length > 0) {
        const prevState = navigationHistory.pop();
        showPage(prevState.page, prevState, false);
    } else {
        showPage('inicio', {}, false);
    }
}

function updateActiveSidebarNav(pageName) {
    const sidebar = document.getElementById('sidebar');
    const mobileMenu = document.getElementById('mobile-menu');
    if (!sidebar) return;

    // Remove active styles from all links
    const activeClasses = ['bg-zinc-105', 'bg-zinc-100', 'text-brand-600', 'border-l-4', 'border-brand-600', 'pl-3', 'font-semibold'];

    document.querySelectorAll('[id^="nav-"]').forEach(link => {
        link.classList.remove(...activeClasses);
        link.classList.add('text-zinc-600', 'px-4');
    });

    // Highlight active link if any
    const activeLink = document.getElementById(`nav-${pageName}`);
    if (activeLink) {
        activeLink.classList.remove('text-zinc-600', 'px-4');
        activeLink.classList.add(...activeClasses);
    }
}

function getPageTitle(page, editMode) {
    switch (page) {
        case 'inicio': return 'Dashboard';
        case 'personas': return 'Personas';
        case 'registro-persona': return editMode ? 'Editar Persona' : 'Registrar Persona';
        case 'visualizacion-persona': return 'Persona';
        case 'viaje':
            const viaje = getViajeById(navState.viajeId);
            return viaje ? `Viaje: ${viaje.nombre}` : 'Viaje';
        case 'ajustes': return 'Ajustes';
        case 'notas': return 'Notas';
        default: return 'TripHub';
    }
}

function renderActiveView() {
    const viewContainer = document.getElementById('view-content');
    if (!viewContainer) return;

    // View content switchboard
    switch (navState.page) {
        case 'inicio':
            renderInicio(viewContainer);
            break;
        case 'personas':
            renderPersonas(viewContainer);
            break;
        case 'registro-persona':
            renderRegistroPersona(viewContainer);
            break;
        case 'visualizacion-persona':
            renderVisualizacionPersona(viewContainer);
            break;
        case 'viaje':
            renderViaje(viewContainer);
            break;
        case 'ajustes':
            renderAjustes(viewContainer);
            break;
        case 'notas':
            renderNotas(viewContainer);
            break;
        default:
            viewContainer.innerHTML = `<div class="p-6 text-rose-500 font-semibold border border-rose-500/20 rounded-xl bg-rose-500/5">Vista no encontrada.</div>`;
    }
}

// ==========================================
// 6. DETAILED PAGE RENDERERS
// ==========================================

// --- PÁGINA 1: INICIO (DASHBOARD) ---
function renderInicio(container) {
    const viajes = getViajes();
    const personas = getPersonas();
    const tareas = getTareas();
    const tareasPendientes = tareas.filter(t => t.estado === 'pendiente').length;

    // Find next upcoming trip (closest future date)
    let proximoViajeHtml = '<span class="text-zinc-500 font-normal">No hay viajes programados</span>';
    if (viajes.length > 0) {
        const sorted = [...viajes].filter(v => v.fecha).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
        const futureTrips = sorted.filter(v => new Date(v.fecha) >= new Date().setHours(0, 0, 0, 0));
        const nextTrip = futureTrips[0] || sorted[0]; // fallback to oldest if all past
        if (nextTrip) {
            proximoViajeHtml = `
                <div class="flex items-center space-x-3">
                    <div class="p-2 rounded-xl bg-brand-500/10 text-brand-400">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    </div>
                    <div>
                        <div class="font-bold text-zinc-800 text-sm md:text-base truncate max-w-[150px]">${nextTrip.nombre}</div>
                        <div class="text-[11px] font-medium text-zinc-600 truncate max-w-[150px]">${nextTrip.destino} (${formatDate(nextTrip.fecha)})</div>
                    </div>
                </div>
            `;
        }
    }

    container.innerHTML = `
        <div class="space-y-8 animate-fadeIn">
            <!-- Header Banner -->
            <div class="bg-gradient-to-r from-brand-50 via-indigo-50/30 to-white border border-zinc-200 p-6 md:p-8 rounded-3xl relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-sm">
                <div class="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-brand-100/20 blur-3xl"></div>
                <div class="space-y-2 max-w-xl">
                    <h3 class="text-xl md:text-2xl font-extrabold text-zinc-900">Organiza viajes grupales con total seguridad</h3>
                    <p class="text-zinc-650 text-sm leading-relaxed font-normal">
                        Gestiona itinerarios, datos de contacto de personas, asignaciones de billetes, consentimientos de privacidad y tareas asociadas.
                    </p>
                </div>
                <div class="flex flex-wrap gap-3 w-full sm:w-auto flex-shrink-0">
                    <button onclick="openCreateViajeModal()" class="flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm shadow-lg shadow-brand-600/30 hover:-translate-y-0.5 transition-all w-full sm:w-auto">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                        <span>Crear Viaje</span>
                    </button>
                </div>
            </div>

            <!-- Trips Section -->
            <div class="space-y-6">
                <div class="flex items-center justify-between">
                    <h4 class="font-bold text-lg text-zinc-800 flex items-center space-x-2">
                        <span>Listado de Viajes Activos</span>
                        <span class="bg-zinc-200 text-zinc-650 text-xs font-bold px-2 py-0.5 rounded-full">${viajes.length}</span>
                    </h4>
                </div>

                ${viajes.length === 0 ? `
                    <div class="text-center py-16 bg-white border border-zinc-200 rounded-2xl shadow-sm">
                        <svg class="w-12 h-12 text-zinc-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
                        <p class="text-zinc-500 text-sm font-medium">No se han creado viajes aún.</p>
                        <button onclick="openCreateViajeModal()" class="mt-4 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs rounded-xl transition-all shadow-md shadow-brand-600/10">Crear Primer Viaje</button>
                    </div>
                ` : `
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        ${viajes.map(v => {
        const tripTasks = tareas.filter(t => t.viajeId === v.id);
        const pendingTasks = tripTasks.filter(t => t.estado === 'pendiente').length;
        return `
                                <div onclick="showPage('viaje', {viajeId: '${v.id}'})" class="bg-white hover:bg-zinc-50/40 border border-zinc-200 hover:border-zinc-350 p-6 md:p-8 rounded-3xl flex flex-col justify-between shadow-sm hover:shadow-md transition-all group relative overflow-hidden cursor-pointer">
                                    <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-brand-600/5 to-transparent rounded-tr-3xl pointer-events-none"></div>
                                    <div class="space-y-4">
                                        <div class="flex items-start justify-between gap-4">
                                            <div>
                                                <h5 class="font-extrabold text-zinc-900 text-lg md:text-xl leading-tight group-hover:text-brand-600 transition-colors">${v.nombre}</h5>
                                                <div class="flex items-center text-xs text-zinc-500 mt-1.5 font-bold space-x-1.5">
                                                    <span class="text-brand-600">${v.destino}</span>
                                                    <span class="text-zinc-300">•</span>
                                                    <span class="text-zinc-400 font-mono">${formatDate(v.fecha)}</span>
                                                </div>
                                            </div>
                                            <div class="flex items-center space-x-1">
                                                <button onclick="event.stopPropagation(); deleteViajeHandler('${v.id}')" class="text-zinc-400 hover:text-rose-600 p-2 rounded-xl hover:bg-rose-50 transition" title="Eliminar Viaje">
                                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                </button>
                                            </div>
                                        </div>
                                        <p class="text-zinc-650 text-sm line-clamp-3 leading-relaxed font-normal">${v.descripcion || 'Sin descripción adicional.'}</p>
                                    </div>
                                    
                                    <div class="border-t border-zinc-100 mt-6 pt-4 flex items-center justify-between text-xs text-zinc-550 font-bold">
                                        <div class="flex items-center space-x-4">
                                            <div class="flex items-center space-x-1" title="Personas asignadas">
                                                <svg class="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                                                <span class="text-zinc-700 font-bold">${v.participantes ? v.participantes.length : 0} personas</span>
                                            </div>
                                            <div class="flex items-center space-x-1" title="Tareas pendientes de este viaje">
                                                <svg class="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                                                <span class="${pendingTasks > 0 ? 'text-amber-600 font-bold' : 'text-zinc-650'}">${pendingTasks} pendientes</span>
                                            </div>
                                        </div>
                                        <div class="flex items-center space-x-1 text-brand-600 font-extrabold group-hover:translate-x-1 transition-transform">
                                            <span>Abrir</span>
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                                        </div>
                                    </div>
                                </div>
                            `;
    }).join('')}
                    </div>
                `}
            </div>
        </div>
    `;
}

function openCreateViajeModal() {
    const bodyHtml = `
        <form id="create-viaje-form" class="space-y-4 font-sans">
            <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5" for="v-nombre">Nombre del Viaje *</label>
                <input type="text" id="v-nombre" required class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 text-sm focus:outline-none placeholder-zinc-400 transition" placeholder="Ej. Valencia Fin de Semana">
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5" for="v-destino">Destino *</label>
                    <input type="text" id="v-destino" required class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 text-sm focus:outline-none placeholder-zinc-400 transition" placeholder="Ej. Valencia">
                </div>
                <div>
                    <label class="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5" for="v-fecha">Fecha *</label>
                    <input type="date" id="v-fecha" required class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 text-sm focus:outline-none transition">
                </div>
            </div>
            <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5" for="v-descripcion">Descripción Breve</label>
                <textarea id="v-descripcion" rows="3" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 text-sm focus:outline-none placeholder-zinc-400 transition resize-none" placeholder="Breve resumen del propósito del viaje..."></textarea>
            </div>
            <p class="text-[10.5px] text-zinc-450 font-semibold">* Campos obligatorios. El viaje se guardará directamente en local.</p>
        </form>
    `;

    const buttons = [
        {
            text: 'Cancelar',
            class: 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700',
            action: closeModal
        },
        {
            text: 'Crear Viaje',
            class: 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/20',
            action: () => {
                const form = document.getElementById('create-viaje-form');
                if (!form || !form.reportValidity()) return;

                const name = document.getElementById('v-nombre').value.trim();
                const destination = document.getElementById('v-destino').value.trim();
                const date = document.getElementById('v-fecha').value;
                const desc = document.getElementById('v-descripcion').value.trim();

                const newViaje = createViaje({
                    nombre: name,
                    destino: destination,
                    fecha: date,
                    descripcion: desc
                });

                if (newViaje) {
                    showToast('¡Viaje creado satisfactoriamente!');
                    closeModal();
                    renderActiveView(); // Refresh Dashboard
                }
            }
        }
    ];

    showModal('Crear Nuevo Viaje en Grupo', bodyHtml, buttons);
}

function deleteViajeHandler(id) {
    const viaje = getViajeById(id);
    if (!viaje) return;

    showConfirm(
        'Confirmar eliminación',
        `¿Estás seguro de que quieres eliminar el viaje "${viaje.nombre}"? Esta acción borrará todas sus tareas asociadas permanentemente y desvinculará a sus personas.`,
        () => {
            if (deleteViaje(id)) {
                showToast('Viaje eliminado correctamente.', 'warning');
                renderActiveView(); // Refresh page
            }
        },
        'Eliminar Viaje',
        true
    );
}


// --- PÁGINA 2: PERSONAS (LISTA Y BUSCADOR) ---
let personasSearchQuery = '';
let personasActiveFilter = 'todas'; // 'todas', 'con_lpd', 'sin_lpd', 'con_term', 'sin_term'

function renderPersonas(container) {
    const personas = getPersonas();

    // Sort alphabetically
    let filtered = [...personas].sort((a, b) => a.nombre.localeCompare(b.nombre));

    // Filter by query
    if (personasSearchQuery.trim()) {
        const query = personasSearchQuery.toLowerCase().trim();
        filtered = filtered.filter(p =>
            p.nombre.toLowerCase().includes(query) ||
            (p.apellido1 && p.apellido1.toLowerCase().includes(query)) ||
            (p.apellido2 && p.apellido2.toLowerCase().includes(query)) ||
            (p.dni && p.dni.toLowerCase().includes(query)) ||
            (p.telefono && p.telefono.includes(query))
        );
    }

    // Filter by options
    if (personasActiveFilter === 'con_lpd') {
        filtered = filtered.filter(p => p.aceptacionProteccionDatos === true);
    } else if (personasActiveFilter === 'sin_lpd') {
        filtered = filtered.filter(p => p.aceptacionProteccionDatos !== true);
    } else if (personasActiveFilter === 'con_term') {
        filtered = filtered.filter(p => p.aceptacionTerminosViaje === true);
    } else if (personasActiveFilter === 'sin_term') {
        filtered = filtered.filter(p => p.aceptacionTerminosViaje !== true);
    }

    // Check if the search shell is already rendered in the DOM
    const hasShell = document.getElementById('personas-search-container');
    if (!hasShell) {
        container.innerHTML = `
            <div class="space-y-6 animate-fadeIn font-sans pb-12">
                <!-- Header section -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h3 class="font-bold text-lg text-zinc-900 flex items-center space-x-2">
                            <span>Listado de Personas</span>
                            <span id="personas-count-badge" class="bg-zinc-200 text-zinc-600 text-xs font-semibold px-2 py-0.5 rounded-full">${filtered.length} de ${personas.length}</span>
                        </h3>
                        <p class="text-xs text-zinc-500 mt-1">Busca, filtra, gestiona expedientes o edita fichas personales.</p>
                    </div>
                    <button onclick="showPage('registro-persona', {editMode: false, sourcePage: 'personas'})" class="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm shadow-lg shadow-brand-600/30 transition w-full sm:w-auto">
                        <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                        <span>Registrar Persona</span>
                    </button>
                </div>

                <!-- Filters & Search Bar -->
                <div id="personas-search-container" class="bg-white border border-zinc-200 p-4 rounded-2xl flex flex-col md:flex-row items-center gap-4 shadow-sm">
                    <!-- Search Input -->
                    <div class="relative w-full md:flex-1">
                        <span class="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-zinc-400">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        </span>
                        <input type="text" id="personas-search" value="${personasSearchQuery}" oninput="handlePersonasSearch(this.value)" class="w-full bg-zinc-50 border border-zinc-200 focus:border-brand-500 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-zinc-800 text-sm focus:outline-none placeholder-zinc-400 transition" placeholder="Buscar por nombre, apellidos, teléfono o DNI...">
                    </div>

                    <!-- Select Filter -->
                    <div class="w-full md:w-auto flex-shrink-0">
                        <select id="personas-filter" onchange="handlePersonasFilter(this.value)" class="w-full md:w-56 bg-zinc-50 border border-zinc-200 focus:border-brand-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-zinc-700 text-sm focus:outline-none transition font-medium">
                            <option value="todas" ${personasActiveFilter === 'todas' ? 'selected' : ''}>Todos los consentimientos</option>
                            <option value="con_lpd" ${personasActiveFilter === 'con_lpd' ? 'selected' : ''}>Prot. Datos: Aceptada</option>
                            <option value="sin_lpd" ${personasActiveFilter === 'sin_lpd' ? 'selected' : ''}>Prot. Datos: Pendiente</option>
                            <option value="con_term" ${personasActiveFilter === 'con_term' ? 'selected' : ''}>Términos Viaje: Aceptada</option>
                            <option value="sin_term" ${personasActiveFilter === 'sin_term' ? 'selected' : ''}>Términos Viaje: Pendiente</option>
                        </select>
                    </div>
                </div>

                <!-- Person List Mount Container -->
                <div id="personas-list-mount">
                    <!-- Rendered dynamically below -->
                </div>
            </div>
        `;
    }

    // Update count badge
    const countBadge = document.getElementById('personas-count-badge');
    if (countBadge) {
        countBadge.textContent = `${filtered.length} de ${personas.length}`;
    }

    const listMount = document.getElementById('personas-list-mount');
    if (listMount) {
        if (filtered.length === 0) {
            listMount.innerHTML = `
                <div class="text-center py-16 bg-white border border-zinc-200 rounded-2xl shadow-sm">
                    <svg class="w-12 h-12 text-zinc-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                    <p class="text-zinc-500 text-sm font-medium">Ninguna persona coincide con los filtros aplicados.</p>
                </div>
            `;
        } else {
            listMount.innerHTML = `
                <div class="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
                    <div class="overflow-x-auto">
                        <table class="w-full border-collapse text-left text-sm text-zinc-600">
                            <thead class="bg-zinc-50 border-b border-zinc-200 text-xs font-bold uppercase tracking-wider text-zinc-500">
                                <tr>
                                    <th class="px-6 py-4">Nombre Completo</th>
                                    <th class="px-6 py-4">DNI</th>
                                    <th class="px-6 py-4">Contacto</th>
                                    <th class="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-zinc-200">
                                ${filtered.map(p => {
                const fullName = `${p.nombre} ${p.apellido1 || ''} ${p.apellido2 || ''}`.trim();
                return `
                                        <tr class="hover:bg-zinc-50/50 transition">
                                            <td class="px-6 py-4 whitespace-nowrap">
                                                <div class="font-bold text-zinc-900 cursor-pointer hover:text-brand-600" onclick="showPage('visualizacion-persona', {personaId: '${p.id}'})">
                                                    ${fullName}
                                                </div>
                                                <div class="text-[10px] text-zinc-400 mt-0.5">Creación: ${formatDate(p.fechaCreacion)}</div>
                                            </td>
                                            <td class="px-6 py-4 font-mono text-xs text-zinc-700 whitespace-nowrap">
                                                ${p.dni || '<span class="text-zinc-300">—</span>'}
                                            </td>
                                            <td class="px-6 py-4 whitespace-nowrap">
                                                <div class="text-xs font-medium text-zinc-800">${p.telefono || '—'}</div>
                                                <div class="text-[11px] text-zinc-500 lowercase">${p.email || '—'}</div>
                                            </td>
                                            <td class="px-6 py-4 whitespace-nowrap text-right text-xs font-medium space-x-2">
                                                <button onclick="showPage('visualizacion-persona', {personaId: '${p.id}'})" class="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 rounded-lg transition font-bold" title="Ver ficha completa">Ver Ficha</button>
                                                <button onclick="deletePersonaHandler('${p.id}')" class="px-2.5 py-1.5 hover:bg-rose-50 text-zinc-500 hover:text-rose-600 border border-zinc-200 hover:border-rose-200 rounded-lg transition font-bold" title="Eliminar persona">Eliminar</button>
                                            </td>
                                        </tr>
                                    `;
            }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }
    }
}

function handlePersonasSearch(value) {
    personasSearchQuery = value;
    const container = document.getElementById('view-content');
    renderPersonas(container);
}

function handlePersonasFilter(value) {
    personasActiveFilter = value;
    const container = document.getElementById('view-content');
    renderPersonas(container);
}

function deletePersonaHandler(id) {
    const persona = getPersonaById(id);
    if (!persona) return;
    const name = `${persona.nombre} ${persona.apellido1 || ''}`.trim();

    showConfirm(
        'Confirmar eliminación',
        `¿Estás seguro de que quieres eliminar a "${name}" de la base de datos global? Esto lo desvinculará de todos los viajes organizados y tareas que tuviera asignadas.`,
        () => {
            if (deletePersona(id)) {
                showToast('Persona eliminada correctamente.', 'warning');
                renderActiveView();
            }
        },
        'Eliminar Persona',
        true
    );
}


// --- PÁGINA 3: REGISTRO/EDICIÓN DE PERSONA ---
function renderRegistroPersona(container) {
    const editMode = navState.editMode;
    const personaId = navState.personaId;
    let p = {
        nombre: '',
        apellido1: '',
        apellido2: '',
        dni: '',
        carnetJoven: '',
        fechaNacimiento: '',
        telefono: '',
        email: '',
        anotaciones: '',
        aceptacionProteccionDatos: false,
        fechaAceptacionProteccionDatos: '',
        aceptacionTerminosViaje: false,
        fechaAceptacionTerminosViaje: ''
    };

    if (editMode && personaId) {
        const found = getPersonaById(personaId);
        if (found) p = { ...p, ...found };
    }

    container.innerHTML = `
        <div class="max-w-4xl mx-auto space-y-6 animate-fadeIn font-sans pb-12">
            <!-- Header bar -->
            <div class="flex items-center justify-between border-b border-zinc-200 pb-4">
                <button onclick="goBack()" class="flex items-center space-x-2 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-xl text-zinc-700 text-xs font-semibold transition">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    <span>Volver</span>
                </button>
                <div class="flex space-x-3">
                    <button onclick="goBack()" class="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-xl text-zinc-700 text-sm font-semibold transition">Cancelar</button>
                    <button onclick="savePersonaForm()" class="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-600/20 transition">Guardar Ficha</button>
                </div>
            </div>

            <!-- Page Title -->
            <div>
                <h3 class="font-extrabold text-2xl text-zinc-800">${editMode ? 'Editar Persona' : 'Registrar Nueva Persona'}</h3>
                <p class="text-xs text-zinc-500 mt-1">Completa los datos del formulario local. Toda la información permanece en este navegador.</p>
            </div>

            <!-- Alert recommendation -->
            <div id="validation-alert" class="hidden bg-rose-500/10 border border-rose-500/25 p-4 rounded-xl text-rose-400 text-xs font-medium space-y-1">
                <!-- Errors appended dynamically -->
            </div>

            <form id="persona-form" class="space-y-6">
                <!-- SECCIÓN 1: Identificación básica -->
                <div class="bg-white border border-zinc-200 p-6 rounded-2xl space-y-4 shadow-sm">
                    <h4 class="text-sm font-extrabold uppercase tracking-widest text-brand-600 border-b border-zinc-100 pb-2">Sección 1: Nombre y Apellidos</h4>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label class="block text-xs font-bold text-zinc-400 mb-1.5" for="p-nombre">Nombre *</label>
                            <input type="text" id="p-nombre" value="${p.nombre}" required class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 text-sm focus:outline-none transition" placeholder="Ej. Ana">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-zinc-400 mb-1.5" for="p-apellido1">Primer Apellido (Recomendado)</label>
                            <input type="text" id="p-apellido1" value="${p.apellido1}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 text-sm focus:outline-none transition" placeholder="Ej. García">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-zinc-400 mb-1.5" for="p-apellido2">Segundo Apellido</label>
                            <input type="text" id="p-apellido2" value="${p.apellido2}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 text-sm focus:outline-none transition" placeholder="Ej. López">
                        </div>
                    </div>
                </div>

                <!-- SECCIÓN 2 & 3: Documentación y Datos Personales -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="bg-white border border-zinc-200 p-6 rounded-2xl space-y-4 shadow-sm">
                        <h4 class="text-sm font-extrabold uppercase tracking-widest text-brand-600 border-b border-zinc-100 pb-2">Sección 2: Documentación</h4>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-zinc-400 mb-1.5" for="p-dni">DNI / NIE / Pasaporte</label>
                                <input type="text" id="p-dni" value="${p.dni}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 text-sm focus:outline-none transition" placeholder="Ej. 12345678Z">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-zinc-400 mb-1.5" for="p-carnetJoven">Carnet Joven ID</label>
                                <input type="text" id="p-carnetJoven" value="${p.carnetJoven}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 text-sm focus:outline-none transition" placeholder="Ej. CJ-998877">
                            </div>
                        </div>
                    </div>

                    <div class="bg-white border border-zinc-200 p-6 rounded-2xl space-y-4 shadow-sm">
                        <h4 class="text-sm font-extrabold uppercase tracking-widest text-brand-600 border-b border-zinc-100 pb-2">Sección 3: Datos Personales</h4>
                        <div>
                            <label class="block text-xs font-bold text-zinc-400 mb-1.5" for="p-fechaNacimiento">Fecha de Nacimiento</label>
                            <input type="date" id="p-fechaNacimiento" value="${p.fechaNacimiento}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 text-sm focus:outline-none transition">
                        </div>
                    </div>
                </div>

                <!-- SECCIÓN 4: Contacto -->
                <div class="bg-white border border-zinc-200 p-6 rounded-2xl space-y-4 shadow-sm">
                    <h4 class="text-sm font-extrabold uppercase tracking-widest text-brand-600 border-b border-zinc-100 pb-2">Sección 4: Datos de Contacto</h4>
                    <p class="text-[11px] text-zinc-500 -mt-2">Recomendamos rellenar al menos un dato de contacto para comunicación (teléfono o email).</p>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold text-zinc-400 mb-1.5" for="p-telefono">Teléfono móvil</label>
                            <input type="tel" id="p-telefono" value="${p.telefono}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 text-sm focus:outline-none transition" placeholder="Ej. +34 600 000 000">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-zinc-400 mb-1.5" for="p-email">Correo Electrónico</label>
                            <input type="email" id="p-email" value="${p.email}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 text-sm focus:outline-none transition" placeholder="Ej. ana.garcia@mail.com">
                        </div>
                    </div>
                </div>

                <!-- SECCIÓN 5: Anotaciones -->
                <div class="bg-white border border-zinc-200 p-6 rounded-2xl space-y-4 shadow-sm">
                    <h4 class="text-sm font-extrabold uppercase tracking-widest text-brand-600 border-b border-zinc-100 pb-2">Sección 5: Información adicional</h4>
                    <div>
                        <label class="block text-xs font-bold text-zinc-400 mb-1.5" for="p-anotaciones">Información adicional</label>
                        <textarea id="p-anotaciones" rows="4" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 text-sm focus:outline-none transition resize-none" placeholder="Añade observaciones especiales, alergias alimentarias, intolerancias, o preferencias de asiento...">${p.anotaciones}</textarea>
                    </div>
                </div>

                <!-- SECCIÓN 6: Aceptaciones Legales -->
                <div class="bg-white border border-zinc-200 p-6 rounded-2xl space-y-4 shadow-sm">
                    <h4 class="text-sm font-extrabold uppercase tracking-widest text-brand-600 border-b border-zinc-100 pb-2">Sección 6: Aceptaciones de Consentimiento</h4>
                    <div class="space-y-4">
                        <!-- LOPD Consent -->
                        <div class="flex items-start space-x-3">
                            <input type="checkbox" id="p-aceptacionProteccionDatos" ${p.aceptacionProteccionDatos ? 'checked' : ''} class="mt-1 h-4.5 w-4.5 rounded border-zinc-300 bg-white text-brand-600 focus:ring-brand-500 focus:ring-offset-white">
                            <div>
                                <label for="p-aceptacionProteccionDatos" class="text-sm text-zinc-700 font-semibold cursor-pointer">Acepto la Política de Protección de Datos</label>
                                <div class="text-xs text-zinc-400 mt-0.5">
                                    Aceptación obligatoria de privacidad. 
                                    <button type="button" onclick="viewLegalModal('proteccion_datos')" class="text-brand-400 hover:text-brand-300 font-bold underline ml-1 focus:outline-none">Ver Política de Protección de Datos</button>
                                </div>
                                <div id="lopd-date-container" class="text-[10px] text-zinc-500 mt-1 ${p.aceptacionProteccionDatos ? '' : 'hidden'}">
                                    Fecha de aceptación: <span id="lopd-date-text" class="font-mono">${formatDateTime(p.fechaAceptacionProteccionDatos)}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Terms Consent -->
                        <div class="flex items-start space-x-3">
                            <input type="checkbox" id="p-aceptacionTerminosViaje" ${p.aceptacionTerminosViaje ? 'checked' : ''} class="mt-1 h-4.5 w-4.5 rounded border-zinc-300 bg-white text-brand-600 focus:ring-brand-500 focus:ring-offset-white">
                            <div>
                                <label for="p-aceptacionTerminosViaje" class="text-sm text-zinc-700 font-semibold cursor-pointer">Acepto los Términos y Condiciones Generales del Viaje</label>
                                <div class="text-xs text-zinc-400 mt-0.5">
                                    Consentimiento de las normas del viaje. 
                                    <button type="button" onclick="viewLegalModal('terminos_viaje')" class="text-brand-400 hover:text-brand-300 font-bold underline ml-1 focus:outline-none">Ver Términos y Condiciones del Viaje</button>
                                </div>
                                <div id="terms-date-container" class="text-[10px] text-zinc-500 mt-1 ${p.aceptacionTerminosViaje ? '' : 'hidden'}">
                                    Fecha de aceptación: <span id="terms-date-text" class="font-mono">${formatDateTime(p.fechaAceptacionTerminosViaje)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <!-- Botón de guardar al final del formulario -->
                <div class="flex justify-end space-x-3 pt-4 border-t border-zinc-200">
                    <button type="button" onclick="goBack()" class="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-xl text-zinc-700 text-sm font-semibold transition">Cancelar</button>
                    <button type="button" onclick="savePersonaForm()" class="px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-600/20 transition">Guardar Ficha</button>
                </div>
            </form>
        </div>
    `;

    // Dynamic Date updater callbacks for Consent Checkboxes
    const chkLopd = document.getElementById('p-aceptacionProteccionDatos');
    const chkTerms = document.getElementById('p-aceptacionTerminosViaje');

    if (chkLopd) {
        chkLopd.onchange = function () {
            const container = document.getElementById('lopd-date-container');
            const text = document.getElementById('lopd-date-text');
            if (this.checked) {
                const now = new Date().toISOString();
                container.classList.remove('hidden');
                text.textContent = formatDateTime(now);
                text.dataset.date = now;
            } else {
                container.classList.add('hidden');
                text.textContent = '';
                text.dataset.date = '';
            }
        };
    }

    if (chkTerms) {
        chkTerms.onchange = function () {
            const container = document.getElementById('terms-date-container');
            const text = document.getElementById('terms-date-text');
            if (this.checked) {
                const now = new Date().toISOString();
                container.classList.remove('hidden');
                text.textContent = formatDateTime(now);
                text.dataset.date = now;
            } else {
                container.classList.add('hidden');
                text.textContent = '';
                text.dataset.date = '';
            }
        };
    }
}

function viewLegalModal(tipo) {
    const textos = getTextosLegales();
    const texto = textos.find(t => t.tipo === tipo);
    if (!texto) return;

    const bodyHtml = `
        <div class="whitespace-pre-wrap text-zinc-700 text-sm leading-relaxed max-h-[50vh] overflow-y-auto pr-2 bg-zinc-50 p-4 rounded-xl border border-zinc-200">${texto.contenido}</div>
        <p class="text-[10px] text-zinc-500 mt-3 font-semibold">Última actualización legal: ${formatDateTime(texto.fechaActualizacion)}</p>
    `;
    showModal(texto.titulo, bodyHtml);
}

function savePersonaForm() {
    const alertBox = document.getElementById('validation-alert');
    if (alertBox) {
        alertBox.classList.add('hidden');
        alertBox.innerHTML = '';
    }

    const form = document.getElementById('persona-form');
    if (!form) return;

    // Custom validations
    const nombre = document.getElementById('p-nombre').value.trim();
    const apellido1 = document.getElementById('p-apellido1').value.trim();
    const apellido2 = document.getElementById('p-apellido2').value.trim();
    const dni = document.getElementById('p-dni').value.trim();
    const carnetJoven = document.getElementById('p-carnetJoven').value.trim();
    const fechaNacimiento = document.getElementById('p-fechaNacimiento').value;
    const telefono = document.getElementById('p-telefono').value.trim();
    const email = document.getElementById('p-email').value.trim();
    const anotaciones = document.getElementById('p-anotaciones').value.trim();

    const acceptLopd = document.getElementById('p-aceptacionProteccionDatos').checked;
    const acceptTerms = document.getElementById('p-aceptacionTerminosViaje').checked;

    // Get date dataset or fallback to existing
    const textLopd = document.getElementById('lopd-date-text');
    const textTerms = document.getElementById('terms-date-text');

    let dateLopd = acceptLopd ? (textLopd.dataset.date || new Date().toISOString()) : '';
    let dateTerms = acceptTerms ? (textTerms.dataset.date || new Date().toISOString()) : '';

    const errors = [];

    if (!nombre) {
        errors.push('El campo Nombre es obligatorio.');
    }

    if (!telefono && !email) {
        errors.push('Recomendado: Rellene al menos un método de contacto (Teléfono o Email).');
    }

    if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            errors.push('El formato del Correo Electrónico no es correcto.');
        }
    }

    if (!acceptLopd) {
        errors.push('Debe aceptar la Política de Protección de Datos.');
    }

    if (!acceptTerms) {
        errors.push('Debe aceptar los Términos y Condiciones Generales del Viaje.');
    }

    // Display validation recommendations/errors
    if (errors.length > 0) {
        alertBox.classList.remove('hidden');
        errors.forEach(err => {
            const el = document.createElement('div');
            el.className = 'flex items-center space-x-1';
            el.innerHTML = `<span>•</span> <span>${err}</span>`;
            alertBox.appendChild(el);
        });

        // Block only on strict requirement (Name, Email format, or missing Consents)
        if (!nombre || !acceptLopd || !acceptTerms || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
            showToast('Faltan requisitos obligatorios o aceptación de consentimientos.', 'error');
            return;
        }
    }

    // Build the payload
    const payload = {
        nombre,
        apellido1,
        apellido2,
        dni,
        carnetJoven,
        fechaNacimiento,
        telefono,
        email,
        anotaciones,
        aceptacionProteccionDatos: acceptLopd,
        fechaAceptacionProteccionDatos: dateLopd,
        aceptacionTerminosViaje: acceptTerms,
        fechaAceptacionTerminosViaje: dateTerms
    };

    let resultPersona;
    if (navState.editMode && navState.personaId) {
        resultPersona = updatePersona(navState.personaId, payload);
        showToast('Persona actualizada correctamente.');
    } else {
        resultPersona = createPersona(payload);
        showToast('Persona registrada correctamente.');

        // Navigation context check: if came from a specific trip attendee add flow
        if (navState.sourcePage === 'viaje-add' && navState.viajeId) {
            const viaje = getViajeById(navState.viajeId);
            if (viaje) {
                // Auto assign person to this trip
                const hasAssigned = viaje.participantes.some(p => p.personaId === resultPersona.id);
                if (!hasAssigned) {
                    viaje.participantes.push({
                        personaId: resultPersona.id,
                        estadoConfirmacion: 'pendiente',
                        estadoPago: 'no pagado',
                        billeteIdaComprado: false,
                        billeteVueltaComprado: false,
                        asientoIda: '',
                        asientoVuelta: '',
                        vagonIda: '',
                        vagonVuelta: '',
                        localizadorIda: '',
                        localizadorVuelta: '',
                        observacionesIda: '',
                        observacionesVuelta: '',
                        notasViaje: ''
                    });
                    updateViaje(viaje.id, { participantes: viaje.participantes });
                    showToast(`Asignado automáticamente a "${viaje.nombre}"`);
                }
            }
        }
    }

    if (resultPersona) {
        // Redirection to full visual file page
        showPage('visualizacion-persona', { personaId: resultPersona.id });
    }
}


// --- PÁGINA 4: VISUALIZACIÓN DE PERSONA (FICHA) ---
function renderVisualizacionPersona(container) {
    const personaId = navState.personaId;
    const p = getPersonaById(personaId);

    if (!p) {
        container.innerHTML = `<div class="p-6 text-rose-500 font-semibold border border-rose-500/20 rounded-xl bg-rose-500/5">Ficha de persona no encontrada o eliminada.</div>`;
        return;
    }

    const edad = calculateAge(p.fechaNacimiento);

    // Associated Trips
    const viajes = getViajes();
    const viajesAsociados = viajes.filter(v =>
        v.participantes && v.participantes.some(part => part.personaId === p.id)
    );

    // Associated Tasks
    const tareas = getTareasByPersona(p.id);

    container.innerHTML = `
        <div class="max-w-5xl mx-auto space-y-6 animate-fadeIn font-sans pb-12">
            <!-- Header bar / Actions -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
                <div class="flex items-center space-x-3">
                    <button onclick="goBack()" class="flex items-center justify-center space-x-2 px-3 py-1.5 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-xl text-zinc-700 text-xs font-bold transition">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        <span>Volver</span>
                    </button>
                    <div id="autosave-status-container" class="flex items-center">
                        <span id="autosave-status-indicator" class="text-[11px] text-zinc-400 font-semibold">✓ Todos los cambios guardados automáticamente</span>
                    </div>
                </div>
                <div class="flex flex-wrap gap-2.5">
                    <button onclick="copyAllPersonaData('${p.id}')" class="flex items-center space-x-1.5 px-4 py-2 bg-white hover:bg-zinc-50 border border-zinc-250 text-zinc-700 rounded-xl text-xs font-bold transition">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-5 4h5m-5 4h5m-5 4h5"></path></svg>
                        <span>Copiar Todo</span>
                    </button>
                    <button onclick="deletePersonaVisualHandler('${p.id}')" class="flex items-center space-x-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold transition">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        <span>Eliminar Persona</span>
                    </button>
                </div>
            </div>

            <!-- Main Ficha Cards -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Left Main Column (Profile Overview + Contact) -->
                <div class="lg:col-span-2 space-y-6">
                    <!-- General Details Block -->
                    <div class="bg-white border border-zinc-200 p-6 rounded-2xl space-y-5 relative shadow-sm">
                        <div class="flex items-center space-x-4">
                            <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-600 to-indigo-500 flex items-center justify-center font-bold text-xl text-white shadow-lg">
                                ${p.nombre.charAt(0)}${p.apellido1 ? p.apellido1.charAt(0) : ''}
                            </div>
                            <div>
                                <h3 class="font-extrabold text-xl text-zinc-900 leading-tight">Perfil de Persona</h3>
                                <p class="text-xs text-zinc-400 mt-0.5 font-medium">Los cambios se guardan al instante. ID: <span class="font-mono text-zinc-500">${p.id}</span></p>
                            </div>
                        </div>

                        <!-- Info Grid: Inputs -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-zinc-100 pt-5 text-sm">
                            <!-- Nombre -->
                            <div class="flex items-end space-x-2">
                                <div class="flex-1">
                                    <label class="block text-[10px] text-zinc-400 uppercase tracking-wider font-bold mb-1">Nombre</label>
                                    <input type="text" id="vp-nombre" value="${p.nombre || ''}" oninput="autoSavePersonaField('${p.id}', 'nombre', this.value)" class="w-full bg-zinc-50 border border-zinc-200 focus:border-brand-500 focus:bg-white rounded-xl px-3 py-2 text-zinc-800 font-bold text-sm focus:outline-none transition">
                                </div>
                                <button onclick="copySingleValue(document.getElementById('vp-nombre').value, 'Nombre')" class="text-zinc-500 hover:text-brand-600 hover:bg-zinc-100 p-2.5 rounded-xl border border-zinc-200 transition" title="Copiar Nombre">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                                </button>
                            </div>

                            <!-- Primer Apellido -->
                            <div class="flex items-end space-x-2">
                                <div class="flex-1">
                                    <label class="block text-[10px] text-zinc-400 uppercase tracking-wider font-bold mb-1">Primer Apellido</label>
                                    <input type="text" id="vp-apellido1" value="${p.apellido1 || ''}" oninput="autoSavePersonaField('${p.id}', 'apellido1', this.value)" class="w-full bg-zinc-50 border border-zinc-200 focus:border-brand-500 focus:bg-white rounded-xl px-3 py-2 text-zinc-800 font-semibold text-sm focus:outline-none transition">
                                </div>
                                <button onclick="copySingleValue(document.getElementById('vp-apellido1').value, 'Primer Apellido')" class="text-zinc-500 hover:text-brand-600 hover:bg-zinc-100 p-2.5 rounded-xl border border-zinc-200 transition" title="Copiar Primer Apellido">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                                </button>
                            </div>

                            <!-- Segundo Apellido -->
                            <div class="flex items-end space-x-2">
                                <div class="flex-1">
                                    <label class="block text-[10px] text-zinc-400 uppercase tracking-wider font-bold mb-1">Segundo Apellido</label>
                                    <input type="text" id="vp-apellido2" value="${p.apellido2 || ''}" oninput="autoSavePersonaField('${p.id}', 'apellido2', this.value)" class="w-full bg-zinc-50 border border-zinc-200 focus:border-brand-500 focus:bg-white rounded-xl px-3 py-2 text-zinc-800 font-semibold text-sm focus:outline-none transition">
                                </div>
                                <button onclick="copySingleValue(document.getElementById('vp-apellido2').value, 'Segundo Apellido')" class="text-zinc-500 hover:text-brand-600 hover:bg-zinc-100 p-2.5 rounded-xl border border-zinc-200 transition" title="Copiar Segundo Apellido">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                                </button>
                            </div>

                            <!-- DNI / Pasaporte -->
                            <div class="flex items-end space-x-2">
                                <div class="flex-1">
                                    <label class="block text-[10px] text-zinc-400 uppercase tracking-wider font-bold mb-1">DNI / Pasaporte</label>
                                    <input type="text" id="vp-dni" value="${p.dni || ''}" oninput="autoSavePersonaField('${p.id}', 'dni', this.value)" class="w-full bg-zinc-50 border border-zinc-200 focus:border-brand-500 focus:bg-white rounded-xl px-3 py-2 text-zinc-800 font-mono text-sm focus:outline-none transition">
                                </div>
                                <button onclick="copySingleValue(document.getElementById('vp-dni').value, 'DNI')" class="text-zinc-500 hover:text-brand-600 hover:bg-zinc-100 p-2.5 rounded-xl border border-zinc-200 transition" title="Copiar DNI">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                                </button>
                            </div>

                            <!-- Carnet Joven -->
                            <div class="flex items-end space-x-2">
                                <div class="flex-1">
                                    <label class="block text-[10px] text-zinc-400 uppercase tracking-wider font-bold mb-1">Carnet Joven</label>
                                    <input type="text" id="vp-carnetjoven" value="${p.carnetJoven || ''}" oninput="autoSavePersonaField('${p.id}', 'carnetJoven', this.value)" class="w-full bg-zinc-50 border border-zinc-200 focus:border-brand-500 focus:bg-white rounded-xl px-3 py-2 text-zinc-800 text-sm focus:outline-none transition">
                                </div>
                                <button onclick="copySingleValue(document.getElementById('vp-carnetjoven').value, 'Carnet Joven')" class="text-zinc-500 hover:text-brand-600 hover:bg-zinc-100 p-2.5 rounded-xl border border-zinc-200 transition" title="Copiar Carnet Joven">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                                </button>
                            </div>

                            <!-- Fecha de Nacimiento -->
                            <div class="flex items-end space-x-2">
                                <div class="flex-1">
                                    <label class="block text-[10px] text-zinc-400 uppercase tracking-wider font-bold mb-1">Fecha de Nacimiento</label>
                                    <input type="date" id="vp-fechanacimiento" value="${p.fechaNacimiento || ''}" onchange="autoSavePersonaField('${p.id}', 'fechaNacimiento', this.value)" class="w-full bg-zinc-50 border border-zinc-200 focus:border-brand-500 focus:bg-white rounded-xl px-3 py-2 text-zinc-800 text-sm focus:outline-none transition">
                                </div>
                                <div class="px-3.5 py-2 bg-zinc-100 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-500 self-end">
                                    <span id="vp-calculated-age">${edad !== null ? `${edad} años` : '—'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Contact Block -->
                    <div class="bg-white border border-zinc-200 p-6 rounded-2xl space-y-4 shadow-sm">
                        <h4 class="text-sm font-extrabold uppercase tracking-widest text-brand-600 border-b border-zinc-100 pb-2">Datos de Contacto</h4>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <!-- Teléfono -->
                            <div class="flex items-end space-x-2">
                                <div class="flex-1">
                                    <label class="block text-[10px] text-zinc-400 uppercase tracking-wider font-bold mb-1">Teléfono</label>
                                    <input type="tel" id="vp-telefono" value="${p.telefono || ''}" oninput="autoSavePersonaField('${p.id}', 'telefono', this.value)" class="w-full bg-zinc-50 border border-zinc-200 focus:border-brand-500 focus:bg-white rounded-xl px-3 py-2 text-zinc-800 text-sm focus:outline-none transition">
                                </div>
                                <button onclick="copySingleValue(document.getElementById('vp-telefono').value, 'Teléfono')" class="text-zinc-500 hover:text-brand-600 hover:bg-zinc-100 p-2.5 rounded-xl border border-zinc-200 transition" title="Copiar Teléfono">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                                </button>
                            </div>

                            <!-- Email -->
                            <div class="flex items-end space-x-2">
                                <div class="flex-1">
                                    <label class="block text-[10px] text-zinc-400 uppercase tracking-wider font-bold mb-1">Email</label>
                                    <input type="email" id="vp-email" value="${p.email || ''}" oninput="autoSavePersonaField('${p.id}', 'email', this.value)" class="w-full bg-zinc-50 border border-zinc-200 focus:border-brand-500 focus:bg-white rounded-xl px-3 py-2 text-zinc-800 text-sm focus:outline-none transition">
                                </div>
                                <button onclick="copySingleValue(document.getElementById('vp-email').value, 'Email')" class="text-zinc-500 hover:text-brand-600 hover:bg-zinc-100 p-2.5 rounded-xl border border-zinc-200 transition" title="Copiar Email">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Personal Annotations Block -->
                    <div class="bg-white border border-zinc-200 p-6 rounded-2xl space-y-3 shadow-sm">
                        <div class="flex items-center justify-between border-b border-zinc-100 pb-2">
                            <h4 class="text-sm font-extrabold uppercase tracking-widest text-brand-600">Anotaciones</h4>
                            <button onclick="copySingleValue(document.getElementById('vp-anotaciones').value, 'Anotaciones')" class="text-zinc-500 hover:text-brand-600 hover:bg-zinc-100 p-2 rounded-xl transition" title="Copiar anotaciones">
                                <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                            </button>
                        </div>
                        <textarea id="vp-anotaciones" rows="4" oninput="autoSavePersonaField('${p.id}', 'anotaciones', this.value)" class="w-full bg-zinc-50 border border-zinc-200 focus:border-brand-500 focus:bg-white rounded-xl p-3 text-zinc-800 text-sm focus:outline-none transition resize-none leading-relaxed" placeholder="Introduce preferencias de viaje, intolerancias, alergias o diagnósticos de salud...">${p.anotaciones || ''}</textarea>
                    </div>
                </div>

                <!-- Right Sidebar Column (Consent status + Summary info) -->
                <div class="space-y-6">
                    <!-- Legal Consent status -->
                    <div class="bg-white border border-zinc-200 p-6 rounded-2xl space-y-4 shadow-sm">
                        <h4 class="text-sm font-extrabold uppercase tracking-widest text-brand-600 border-b border-zinc-100 pb-2">Estado Consentimiento</h4>
                        
                        <div class="space-y-3.5 text-xs font-semibold">
                            <!-- LOPD Consent -->
                            <div class="p-4 bg-zinc-50 rounded-xl border border-zinc-200 flex flex-col space-y-2.5">
                                <div class="flex items-center justify-between">
                                    <label class="text-zinc-700 font-bold cursor-pointer select-none" for="vp-aceptacionProteccionDatos">Protección de Datos (LOPD):</label>
                                    <input type="checkbox" id="vp-aceptacionProteccionDatos" ${p.aceptacionProteccionDatos ? 'checked' : ''} onchange="autoSavePersonaField('${p.id}', 'aceptacionProteccionDatos', this.checked)" class="w-4.5 h-4.5 text-brand-600 focus:ring-brand-500 rounded border-zinc-300 transition">
                                </div>
                                <div class="text-[10px] text-zinc-400 font-medium font-mono">Última aceptación: <span id="vp-date-lopd" class="text-zinc-600">${p.fechaAceptacionProteccionDatos ? formatDate(p.fechaAceptacionProteccionDatos) : '—'}</span></div>
                            </div>

                            <!-- Terms Consent -->
                            <div class="p-4 bg-zinc-50 rounded-xl border border-zinc-200 flex flex-col space-y-2.5">
                                <div class="flex items-center justify-between">
                                    <label class="text-zinc-700 font-bold cursor-pointer select-none" for="vp-aceptacionTerminosViaje">Términos del Viaje:</label>
                                    <input type="checkbox" id="vp-aceptacionTerminosViaje" ${p.aceptacionTerminosViaje ? 'checked' : ''} onchange="autoSavePersonaField('${p.id}', 'aceptacionTerminosViaje', this.checked)" class="w-4.5 h-4.5 text-brand-600 focus:ring-brand-500 rounded border-zinc-300 transition">
                                </div>
                                <div class="text-[10px] text-zinc-400 font-medium font-mono">Última aceptación: <span id="vp-date-terms" class="text-zinc-600">${p.fechaAceptacionTerminosViaje ? formatDate(p.fechaAceptacionTerminosViaje) : '—'}</span></div>
                            </div>
                        </div>
                    </div>

                    <!-- Logistics overview dates -->
                    <div class="bg-white border border-zinc-200 p-5 rounded-2xl text-[11px] text-zinc-500 font-semibold space-y-2.5 shadow-sm">
                        <div class="flex justify-between border-b border-zinc-100 pb-2">
                            <span class="text-zinc-400">Registro Creado:</span>
                            <span class="text-zinc-600 font-mono">${formatDateTime(p.fechaCreacion)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-zinc-400">Última Actualización:</span>
                            <span id="vp-last-update-time" class="text-zinc-600 font-mono">${formatDateTime(p.fechaActualizacion)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Lower Section (Participaciones en viajes & Tareas asignadas) -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Associated Trips -->
                <div class="bg-white border border-zinc-200 p-6 rounded-2xl space-y-4 shadow-sm">
                    <h4 class="text-sm font-extrabold uppercase tracking-widest text-brand-600 border-b border-zinc-100 pb-2">Viajes en los que participa</h4>
                    
                    ${viajesAsociados.length === 0 ? `
                        <p class="text-zinc-500 text-xs italic font-normal">Esta persona no está asignada a ningún viaje activo.</p>
                    ` : `
                        <div class="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                            ${viajesAsociados.map(v => {
        const participantInfo = v.participantes.find(part => part.personaId === p.id);
        return `
                                    <div class="p-3 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-xl flex items-center justify-between text-xs transition">
                                        <div class="space-y-1">
                                            <div class="font-bold text-zinc-800">${v.nombre}</div>
                                            <div class="text-[10px] text-zinc-500">${v.destino} • ${formatDate(v.fecha)}</div>
                                            <div class="flex items-center space-x-1.5 mt-1">
                                                ${renderBadge(participantInfo.estadoConfirmacion)}
                                                ${renderBadge(participantInfo.estadoPago)}
                                            </div>
                                        </div>
                                        <button onclick="showPage('viaje', {viajeId: '${v.id}'})" class="px-2 py-1 bg-zinc-100 hover:bg-brand-600 text-zinc-700 hover:text-white rounded-lg transition border border-zinc-200 hover:border-transparent font-bold">Abrir Viaje</button>
                                    </div>
                                `;
    }).join('')}
                        </div>
                    `}
                </div>

                <!-- Assigned Tasks -->
                <div class="bg-white border border-zinc-200 p-6 rounded-2xl space-y-4 shadow-sm">
                    <h4 class="text-sm font-extrabold uppercase tracking-widest text-brand-600 border-b border-zinc-100 pb-2">Tareas Asignadas</h4>
                    
                    ${tareas.length === 0 ? `
                        <p class="text-zinc-500 text-xs italic font-normal">Esta persona no tiene tareas asignadas en este momento.</p>
                    ` : `
                        <div class="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                            ${tareas.map(t => {
        const viaje = getViajeById(t.viajeId);
        return `
                                    <div class="p-3 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between text-xs">
                                        <div class="space-y-1 pr-3">
                                            <div class="font-bold text-zinc-800 ${t.estado === 'completada' ? 'line-through text-zinc-400' : ''}">${t.titulo}</div>
                                            <div class="text-[10px] text-zinc-500">Viaje: ${viaje ? viaje.nombre : 'General'}</div>
                                            ${t.fechaLimite ? `<div class="text-[10px] text-zinc-500">Límite: <span class="font-mono text-zinc-600">${formatDate(t.fechaLimite)}</span></div>` : ''}
                                        </div>
                                        <div class="flex items-center space-x-2 flex-shrink-0">
                                            ${renderBadge(t.estado === 'completada' ? 'Completado' : 'Pendiente')}
                                            ${viaje ? `<button onclick="showPage('viaje', {viajeId: '${viaje.id}', viajeSection: 'tareas'})" class="px-2 py-1 bg-zinc-100 hover:bg-brand-600 text-zinc-700 hover:text-white rounded-lg transition border border-zinc-200 hover:border-transparent font-bold" title="Ir a la sección de tareas del viaje">Ver</button>` : ''}
                                        </div>
                                    </div>
                                `;
    }).join('')}
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;
}

function autoSavePersonaField(id, field, value) {
    const p = getPersonaById(id);
    if (!p) return;

    // Checkbox validations for consent
    if (field === 'aceptacionProteccionDatos' || field === 'aceptacionTerminosViaje') {
        const checked = !!value;
        if (!checked) {
            showToast('Los consentimientos legales son obligatorios. No se pueden desactivar en la ficha.', 'error');
            // Force checkbox back to checked in the DOM
            const chk = document.getElementById(field === 'aceptacionProteccionDatos' ? 'vp-aceptacionProteccionDatos' : 'vp-aceptacionTerminosViaje');
            if (chk) chk.checked = true;
            return;
        }
    }

    const payload = {};

    // Normalize checkbox values to boolean, inputs to trimmed string
    if (field === 'aceptacionProteccionDatos' || field === 'aceptacionTerminosViaje') {
        payload[field] = !!value;
    } else {
        payload[field] = value.trim();
    }

    // If checkbox changes state, we also update timestamps
    if (field === 'aceptacionProteccionDatos') {
        payload.fechaAceptacionProteccionDatos = new Date().toISOString();
        const dateEl = document.getElementById('vp-date-lopd');
        if (dateEl) dateEl.textContent = formatDate(payload.fechaAceptacionProteccionDatos);
    }
    if (field === 'aceptacionTerminosViaje') {
        payload.fechaAceptacionTerminosViaje = new Date().toISOString();
        const dateEl = document.getElementById('vp-date-terms');
        if (dateEl) dateEl.textContent = formatDate(payload.fechaAceptacionTerminosViaje);
    }

    // Special validation for email format if they type email (we only save if empty or valid)
    if (field === 'email' && value.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value.trim())) {
            updateSaveStatusIndicator('Correo no válido', true);
            return;
        }
    }

    // Special validation for Nombre
    if (field === 'nombre' && !value.trim()) {
        updateSaveStatusIndicator('Nombre obligatorio', true);
        return;
    }

    if (updatePersona(id, payload)) {
        updateSaveStatusIndicator('Guardado', false);

        // Dynamic age calculator update if dob changes
        if (field === 'fechaNacimiento') {
            const ageEl = document.getElementById('vp-calculated-age');
            if (ageEl) {
                const age = calculateAge(value);
                ageEl.textContent = age !== null ? `${age} años` : '—';
            }
        }

        // Update last modified timestamp
        const timeEl = document.getElementById('vp-last-update-time');
        if (timeEl) {
            const updatedP = getPersonaById(id);
            if (updatedP && updatedP.fechaActualizacion) {
                timeEl.textContent = formatDateTime(updatedP.fechaActualizacion);
            }
        }
    }
}

function updateSaveStatusIndicator(text, isError) {
    let indicator = document.getElementById('autosave-status-indicator');
    if (!indicator) {
        const header = document.getElementById('autosave-status-container');
        if (header) {
            header.innerHTML = `<span id="autosave-status-indicator" class="text-[11px] font-bold"></span>`;
            indicator = document.getElementById('autosave-status-indicator');
        }
    }
    if (indicator) {
        indicator.textContent = text === 'Guardado' ? '✓ Guardado' : text;
        if (isError) {
            indicator.className = 'text-rose-500 font-bold';
        } else {
            indicator.className = 'text-emerald-600 font-bold';
            setTimeout(() => {
                if (indicator && (indicator.textContent === '✓ Guardado' || indicator.textContent === 'Guardado')) {
                    indicator.textContent = '✓ Todos los cambios guardados automáticamente';
                    indicator.className = 'text-zinc-400 font-semibold';
                }
            }, 1200);
        }
    }
}


function copySingleValue(value, label) {
    copyToClipboard(value, `¡${label} copiado correctamente!`);
}

function copyAllPersonaData(id) {
    const p = getPersonaById(id);
    if (!p) return;
    const edad = calculateAge(p.fechaNacimiento);

    const txt = `Nombre completo: ${p.nombre} ${p.apellido1 || ''} ${p.apellido2 || ''}`.trim() + `
DNI: ${p.dni || 'No proporcionado'}
Carnet Joven: ${p.carnetJoven || 'No proporcionado'}
Fecha de nacimiento: ${p.fechaNacimiento ? `${formatDate(p.fechaNacimiento)} (${edad} años)` : 'No proporcionado'}
Teléfono: ${p.telefono || 'No proporcionado'}
Email: ${p.email || 'No proporcionado'}
Anotaciones: ${p.anotaciones || 'Ninguna'}
Protección de datos: ${p.aceptacionProteccionDatos ? `Aceptado (${formatDate(p.fechaAceptacionProteccionDatos)})` : 'No aceptado'}
Términos del viaje: ${p.aceptacionTerminosViaje ? `Aceptado (${formatDate(p.fechaAceptacionTerminosViaje)})` : 'No aceptado'}`;

    copyToClipboard(txt, '¡Todos los datos copiados al portapapeles!');
}

function deletePersonaVisualHandler(id) {
    const persona = getPersonaById(id);
    if (!persona) return;

    showConfirm(
        'Confirmar eliminación',
        `¿Estás seguro de que quieres eliminar a "${persona.nombre}"? Esto la quitará de los viajes y tareas de forma permanente.`,
        () => {
            if (deletePersona(id)) {
                showToast('Persona eliminada correctamente.', 'warning');
                showPage('personas');
            }
        },
        'Eliminar Persona',
        true
    );
}


// --- PÁGINA 6: PÁGINA DE DETALLE DEL VIAJE (SPA CON SECCIONES/PESTAÑAS) ---
function renderViaje(container) {
    const viajeId = navState.viajeId;
    const viaje = getViajeById(viajeId);

    if (!viaje) {
        container.innerHTML = `<div class="p-6 text-rose-500 font-semibold border border-rose-500/20 rounded-xl bg-rose-500/5">El viaje especificado no existe o ha sido borrado.</div>`;
        return;
    }

    // Tabs / Sections bar inside the travel page
    const sections = [
        { id: 'transporte-ida-vuelta', label: 'Transporte Ida/Vuelta' },
        { id: 'transporte-destino', label: 'Transporte en Destino' },
        { id: 'personas', label: `Personas (${viaje.participantes ? viaje.participantes.length : 0})` },
        { id: 'tareas', label: 'Tareas' },
        { id: 'tareas-asignadas', label: 'Rendimiento Tareas' }
    ];

    container.innerHTML = `
        <div class="space-y-6 animate-fadeIn font-sans pb-12">
            <!-- Upper title banner -->
            <div class="bg-white border border-zinc-200 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-sm">
                <div class="space-y-1">
                    <div class="flex items-center space-x-2">
                        <button onclick="showPage('inicio')" class="p-1 hover:bg-zinc-100 rounded-lg text-zinc-500 hover:text-zinc-800 transition">
                            <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        </button>
                        <h3 class="font-extrabold text-lg text-zinc-900 leading-none">${viaje.nombre}</h3>
                    </div>
                    <div class="text-xs text-zinc-500 font-medium pl-6">${viaje.destino} • ${formatDate(viaje.fecha)}</div>
                    <!-- Countdown element slot -->
                    <div id="viaje-countdown" class="text-[11px] font-bold text-brand-600 pl-6 mt-1.5 flex items-center space-x-1.5">
                        <span class="w-1.5 h-1.5 rounded-full bg-brand-500 animate-ping"></span>
                        <span id="countdown-text" class="tracking-wide">Calculando tiempo restante...</span>
                    </div>
                </div>

                <div class="flex items-center space-x-2 pl-6 md:pl-0">
                    <button onclick="openEditViajeGeneralModal('${viaje.id}')" class="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 rounded-xl text-xs font-bold transition">Editar Información</button>
                    <button onclick="deleteViajeHandler('${viaje.id}')" class="px-3 py-2 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition">Eliminar</button>
                </div>
            </div>

            <!-- Tab Switcher Navigation -->
            <div class="border-b border-zinc-200 flex overflow-x-auto gap-2">
                ${sections.map(sec => {
        const isActive = navState.viajeSection === sec.id;
        return `
                        <button onclick="switchViajeSection('${sec.id}')" class="px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 whitespace-nowrap transition-all focus:outline-none ${isActive ? 'border-brand-600 text-brand-600' : 'border-transparent text-zinc-500 hover:text-zinc-700'}">
                            ${sec.label}
                        </button>
                    `;
    }).join('')}
            </div>

            <!-- Inner dynamic section mount -->
            <div id="viaje-tab-content">
                <!-- Rendered dynamically below -->
            </div>
        </div>
    `;

    renderViajeSubSection(viaje);
    startCountdown(viaje.fecha);
}

function startCountdown(targetDateStr) {
    if (countdownIntervalId) {
        clearInterval(countdownIntervalId);
        countdownIntervalId = null;
    }

    const countdownTextEl = document.getElementById('countdown-text');
    if (!countdownTextEl) return;

    if (!targetDateStr) {
        countdownTextEl.textContent = 'Fecha de viaje no especificada.';
        return;
    }

    function update() {
        const targetDate = new Date(targetDateStr + 'T00:00:00');
        const now = new Date();
        const diffMs = targetDate - now;

        if (diffMs <= 0) {
            const isToday = now.toDateString() === targetDate.toDateString();
            if (isToday) {
                countdownTextEl.textContent = '¡El viaje comienza hoy!';
            } else {
                countdownTextEl.textContent = '¡Viaje en curso o finalizado!';
            }
            if (countdownIntervalId) {
                clearInterval(countdownIntervalId);
                countdownIntervalId = null;
            }
            return;
        }

        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);

        countdownTextEl.textContent = `Quedan: ${diffDays}d ${diffHours}h ${diffMinutes}m ${diffSeconds}s`;
    }

    update();
    countdownIntervalId = setInterval(update, 1000);
}

function switchViajeSection(secId) {
    navState.viajeSection = secId;
    renderActiveView();
}

function renderViajeSubSection(viaje) {
    const subContainer = document.getElementById('viaje-tab-content');
    if (!subContainer) return;

    switch (navState.viajeSection) {
        case 'transporte-ida-vuelta':
            renderViajeTransporteIdaVuelta(subContainer, viaje);
            break;
        case 'transporte-destino':
            renderViajeTransporteDestino(subContainer, viaje);
            break;
        case 'personas':
            renderViajePersonas(subContainer, viaje);
            break;
        case 'tareas':
            renderViajeTareas(subContainer, viaje);
            break;
        case 'tareas-asignadas':
            renderViajeTareasAsignadas(subContainer, viaje);
            break;
        default:
            subContainer.innerHTML = `<div class="text-rose-500 text-xs italic font-medium">Subsección inválida.</div>`;
    }
}

function openEditViajeGeneralModal(id) {
    const v = getViajeById(id);
    if (!v) return;

    const bodyHtml = `
        <form id="edit-viaje-form" class="space-y-4 font-sans">
            <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5" for="ev-nombre">Nombre del Viaje *</label>
                <input type="text" id="ev-nombre" value="${v.nombre}" required class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 text-sm focus:outline-none placeholder-zinc-400 transition">
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5" for="ev-destino">Destino *</label>
                    <input type="text" id="ev-destino" value="${v.destino}" required class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 text-sm focus:outline-none placeholder-zinc-400 transition">
                </div>
                <div>
                    <label class="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5" for="ev-fecha">Fecha *</label>
                    <input type="date" id="ev-fecha" value="${v.fecha || ''}" required class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 text-sm focus:outline-none transition">
                </div>
            </div>
            <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5" for="ev-descripcion">Descripción Breve</label>
                <textarea id="ev-descripcion" rows="3" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 text-sm focus:outline-none placeholder-zinc-400 transition resize-none">${v.descripcion || ''}</textarea>
            </div>
        </form>
    `;

    const buttons = [
        {
            text: 'Cancelar',
            class: 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700',
            action: closeModal
        },
        {
            text: 'Guardar Cambios',
            class: 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/20',
            action: () => {
                const form = document.getElementById('edit-viaje-form');
                if (!form || !form.reportValidity()) return;

                const name = document.getElementById('ev-nombre').value.trim();
                const destination = document.getElementById('ev-destino').value.trim();
                const date = document.getElementById('ev-fecha').value;
                const desc = document.getElementById('ev-descripcion').value.trim();

                const updated = updateViaje(v.id, {
                    nombre: name,
                    destino: destination,
                    fecha: date,
                    descripcion: desc
                });

                if (updated) {
                    showToast('Información general del viaje actualizada.');
                    closeModal();
                    renderActiveView(); // reload page
                }
            }
        }
    ];

    showModal('Editar Viaje', bodyHtml, buttons);
}


// --- PÁGINA 8: SECCIÓN VIAJE: TRANSPORTE HASTA EL DESTINO ---
function renderViajeTransporteIdaVuelta(container, viaje) {
    const t = viaje.transporteHastaDestino || { ida: {}, vuelta: {}, horariosGenerales: '' };
    const personas = getPersonas();

    container.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn font-sans">
            <!-- Left Side: General Transport schedule metadata -->
            <div class="lg:col-span-1 space-y-4">
                <div class="bg-white border border-zinc-200 p-5 rounded-2xl space-y-4 shadow-sm">
                    <h4 class="font-extrabold text-xs text-brand-600 uppercase tracking-widest border-b border-zinc-100 pb-2">Información del Transporte Común</h4>
                    
                    <form id="transporte-general-form" class="space-y-4 text-xs">
                        <!-- Ida -->
                        <div class="space-y-3 bg-zinc-50 p-4 rounded-xl border border-zinc-200">
                            <h5 class="font-extrabold text-[10px] text-brand-600 uppercase tracking-widest border-b border-zinc-200 pb-1.5">Trayecto Ida</h5>
                            <div>
                                <label class="block font-bold text-zinc-500 mb-1" for="t-ida-operador">Operador (Renfe, Ouigo...)</label>
                                <input type="text" id="t-ida-operador" value="${t.ida?.operador || ''}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-lg px-2.5 py-1.5 text-zinc-800 focus:outline-none transition">
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="block font-bold text-zinc-500 mb-1" for="t-ida-num-tren">Nº Tren / Vuelo</label>
                                    <input type="text" id="t-ida-num-tren" value="${t.ida?.numTren || ''}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-lg px-2.5 py-1.5 text-zinc-800 focus:outline-none transition">
                                </div>
                                <div>
                                    <label class="block font-bold text-zinc-500 mb-1" for="t-ida-salida">Est. Salida</label>
                                    <input type="text" id="t-ida-salida" value="${t.ida?.estacionSalida || ''}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-lg px-2.5 py-1.5 text-zinc-800 focus:outline-none transition">
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="block font-bold text-zinc-500 mb-1" for="t-ida-llegada">Est. Llegada</label>
                                    <input type="text" id="t-ida-llegada" value="${t.ida?.estacionLlegada || ''}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-lg px-2.5 py-1.5 text-zinc-800 focus:outline-none transition">
                                </div>
                                <div>
                                    <label class="block font-bold text-zinc-500 mb-1" for="t-ida-hora-salida">Hora Salida</label>
                                    <input type="time" id="t-ida-hora-salida" value="${t.ida?.horaSalida || ''}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-lg px-2.5 py-1.5 text-zinc-800 focus:outline-none transition">
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="block font-bold text-zinc-500 mb-1" for="t-ida-hora-llegada">Hora Llegada</label>
                                    <input type="time" id="t-ida-hora-llegada" value="${t.ida?.horaLlegada || ''}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-lg px-2.5 py-1.5 text-zinc-800 focus:outline-none transition">
                                </div>
                                <div>
                                    <label class="block font-bold text-zinc-500 mb-1" for="t-ida-notas">Notas Ida</label>
                                    <input type="text" id="t-ida-notas" value="${t.ida?.notes || t.ida?.notas || ''}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-lg px-2.5 py-1.5 text-zinc-800 focus:outline-none transition" placeholder="Vías, equipajes...">
                                </div>
                            </div>
                        </div>

                        <!-- Vuelta -->
                        <div class="space-y-3 bg-zinc-50 p-4 rounded-xl border border-zinc-200">
                            <h5 class="font-extrabold text-[10px] text-brand-600 uppercase tracking-widest border-b border-zinc-200 pb-1.5">Trayecto Vuelta</h5>
                            <div>
                                <label class="block font-bold text-zinc-500 mb-1" for="t-vta-operador">Operador (Renfe, Ouigo...)</label>
                                <input type="text" id="t-vta-operador" value="${t.vuelta?.operador || ''}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-lg px-2.5 py-1.5 text-zinc-800 focus:outline-none transition">
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="block font-bold text-zinc-500 mb-1" for="t-vta-num-tren">Nº Tren / Vuelo</label>
                                    <input type="text" id="t-vta-num-tren" value="${t.vuelta?.numTren || ''}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-lg px-2.5 py-1.5 text-zinc-800 focus:outline-none transition">
                                </div>
                                <div>
                                    <label class="block font-bold text-zinc-500 mb-1" for="t-vta-salida">Est. Salida</label>
                                    <input type="text" id="t-vta-salida" value="${t.vuelta?.estacionSalida || ''}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-lg px-2.5 py-1.5 text-zinc-800 focus:outline-none transition">
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="block font-bold text-zinc-500 mb-1" for="t-vta-llegada">Est. Llegada</label>
                                    <input type="text" id="t-vta-llegada" value="${t.vuelta?.estacionLlegada || ''}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-lg px-2.5 py-1.5 text-zinc-800 focus:outline-none transition">
                                </div>
                                <div>
                                    <label class="block font-bold text-zinc-500 mb-1" for="t-vta-hora-salida">Hora Salida</label>
                                    <input type="time" id="t-vta-hora-salida" value="${t.vuelta?.horaSalida || ''}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-lg px-2.5 py-1.5 text-zinc-800 focus:outline-none transition">
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="block font-bold text-zinc-500 mb-1" for="t-vta-hora-llegada">Hora Llegada</label>
                                    <input type="time" id="t-vta-hora-llegada" value="${t.vuelta?.horaLlegada || ''}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-lg px-2.5 py-1.5 text-zinc-800 focus:outline-none transition">
                                </div>
                                <div>
                                    <label class="block font-bold text-zinc-500 mb-1" for="t-vta-notas">Notas Vuelta</label>
                                    <input type="text" id="t-vta-notas" value="${t.vuelta?.notes || t.vuelta?.notas || ''}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-lg px-2.5 py-1.5 text-zinc-800 focus:outline-none transition" placeholder="Vías, equipajes...">
                                </div>
                            </div>
                        </div>

                        <div>
                            <label class="block font-bold text-zinc-500 mb-1" for="t-horarios">Notas</label>
                            <textarea id="t-horarios" rows="3" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl p-3 text-zinc-800 focus:outline-none transition resize-none" placeholder="Otras notas sobre transbordos o puntos de reunión comunes...">${t.horariosGenerales || ''}</textarea>
                        </div>
                        <button type="button" onclick="saveTransporteGeneral('${viaje.id}')" class="w-full py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-brand-600/15">Guardar Info Común</button>
                    </form>
                </div>
            </div>

            <!-- Right Side: List of members to customize ticket/seat details -->
            <div class="lg:col-span-2 space-y-4">
                <div class="bg-white border border-zinc-200 p-5 rounded-2xl shadow-sm">
                    <h4 class="font-extrabold text-xs text-brand-600 uppercase tracking-widest border-b border-zinc-100 pb-2 mb-4">Información de Billetes por Pasajero</h4>

                    ${!viaje.participantes || viaje.participantes.length === 0 ? `
                        <p class="text-zinc-500 text-xs italic font-normal py-6 text-center">No hay pasajeros asignados a este viaje. Por favor, añádelos en la sección "Pasajeros".</p>
                    ` : `
                        <div class="divide-y divide-zinc-100">
                            ${viaje.participantes.map(part => {
        const pers = personas.find(p => p.id === part.personaId);
        if (!pers) return '';
        const fullName = `${pers.nombre} ${pers.apellido1 || ''}`.trim();

        return `
                                    <div class="py-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                        <div class="space-y-1">
                                            <span class="font-bold text-zinc-850 text-sm cursor-pointer hover:underline hover:text-brand-600" onclick="showPage('visualizacion-persona', {personaId: '${pers.id}'})">${fullName}</span>
                                            <div class="flex flex-wrap gap-2 text-[10px] font-semibold mt-1">
                                                <span class="px-2 py-0.5 rounded-md border ${part.billeteIdaComprado ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}">
                                                    Ida: ${part.billeteIdaComprado ? 'Comprado' : 'Falta'}
                                                </span>
                                                <span class="px-2 py-0.5 rounded-md border ${part.billeteVueltaComprado ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}">
                                                    Vuelta: ${part.billeteVueltaComprado ? 'Comprado' : 'Falta'}
                                                </span>
                                                ${part.localizadorIda || part.localizadorVuelta ? `
                                                    <span class="text-zinc-500 font-mono text-[9px] flex items-center">
                                                        Loc: ${[part.localizadorIda, part.localizadorVuelta].filter(Boolean).join(' / ')}
                                                    </span>
                                                ` : ''}
                                                ${part.driveLinkIda ? `
                                                    <a href="${part.driveLinkIda}" target="_blank" class="px-2 py-0.5 rounded-md border bg-indigo-550/10 text-indigo-700 border-indigo-200 flex items-center hover:bg-indigo-50 transition" title="Ver billete de ida en Google Drive">
                                                        Drive Ida ↗
                                                    </a>
                                                ` : ''}
                                                ${part.driveLinkVuelta ? `
                                                    <a href="${part.driveLinkVuelta}" target="_blank" class="px-2 py-0.5 rounded-md border bg-indigo-550/10 text-indigo-700 border-indigo-200 flex items-center hover:bg-indigo-50 transition" title="Ver billete de vuelta en Google Drive">
                                                        Drive Vuelta ↗
                                                    </a>
                                                ` : ''}
                                            </div>
                                        </div>
                                        <button onclick="openPersonalTicketModal('${viaje.id}', '${pers.id}')" class="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 rounded-lg text-xs font-bold transition">Gestionar Billete</button>
                                    </div>
                                `;
    }).join('')}
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;
}

function saveTransporteGeneral(viajeId) {
    const updateObj = {
        transporteHastaDestino: {
            horariosGenerales: document.getElementById('t-horarios').value.trim(),
            ida: {
                operador: document.getElementById('t-ida-operador').value.trim(),
                numTren: document.getElementById('t-ida-num-tren').value.trim(),
                estacionSalida: document.getElementById('t-ida-salida').value.trim(),
                estacionLlegada: document.getElementById('t-ida-llegada').value.trim(),
                horaSalida: document.getElementById('t-ida-hora-salida').value,
                horaLlegada: document.getElementById('t-ida-hora-llegada').value,
                notas: document.getElementById('t-ida-notas').value.trim()
            },
            vuelta: {
                operador: document.getElementById('t-vta-operador').value.trim(),
                numTren: document.getElementById('t-vta-num-tren').value.trim(),
                estacionSalida: document.getElementById('t-vta-salida').value.trim(),
                estacionLlegada: document.getElementById('t-vta-llegada').value.trim(),
                horaSalida: document.getElementById('t-vta-hora-salida').value,
                horaLlegada: document.getElementById('t-vta-hora-llegada').value,
                notas: document.getElementById('t-vta-notas').value.trim()
            }
        }
    };

    if (updateViaje(viajeId, updateObj)) {
        showToast('Información de transporte de ida/vuelta guardada.');
        renderActiveView();
    }
}

function updateTicketRequiredFields() {
    const idaChecked = document.getElementById('pt-ida-compra')?.checked;
    const vtaChecked = document.getElementById('pt-vuelta-compra')?.checked;

    // Ida fields
    const idaFields = ['pt-num-billete-ida', 'pt-loc-ida', 'pt-coche-ida', 'pt-asiento-ida', 'pt-drive-ida'];
    idaFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.required = !!idaChecked;
            const star = document.getElementById(id + '-req-star');
            if (star) {
                star.textContent = idaChecked ? ' *' : '';
            }
        }
    });

    // Vuelta fields
    const vtaFields = ['pt-num-billete-vta', 'pt-loc-vta', 'pt-coche-vta', 'pt-asiento-vta', 'pt-drive-vta'];
    vtaFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.required = !!vtaChecked;
            const star = document.getElementById(id + '-req-star');
            if (star) {
                star.textContent = vtaChecked ? ' *' : '';
            }
        }
    });
}

function openPersonalTicketModal(viajeId, personaId) {
    const viaje = getViajeById(viajeId);
    const pIndex = viaje.participantes.findIndex(part => part.personaId === personaId);
    if (pIndex === -1) return;

    const part = viaje.participantes[pIndex];
    const pers = getPersonaById(personaId);
    const fullName = `${pers.nombre} ${pers.apellido1 || ''}`.trim();

    const bodyHtml = `
        <form id="personal-ticket-form" class="space-y-4 font-sans text-xs">
            <div class="grid grid-cols-2 gap-4">
                <div class="flex items-center space-x-2 p-2.5 bg-zinc-50 rounded-xl border border-zinc-200">
                    <input type="checkbox" id="pt-ida-compra" ${part.billeteIdaComprado ? 'checked' : ''} onchange="updateTicketRequiredFields()" class="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500">
                    <label for="pt-ida-compra" class="font-bold text-zinc-700">Billete Ida Comprado</label>
                </div>
                <div class="flex items-center space-x-2 p-2.5 bg-zinc-50 rounded-xl border border-zinc-200">
                    <input type="checkbox" id="pt-vuelta-compra" ${part.billeteVueltaComprado ? 'checked' : ''} onchange="updateTicketRequiredFields()" class="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500">
                    <label for="pt-vuelta-compra" class="font-bold text-zinc-700">Billete Vuelta Comprado</label>
                </div>
            </div>

            <!-- Trayecto Ida -->
            <div class="grid grid-cols-2 gap-3 bg-zinc-50 border border-zinc-200 p-4 rounded-xl">
                <div class="col-span-2 font-bold text-[10px] text-brand-600 uppercase tracking-widest border-b border-zinc-200 pb-1 mb-1">Trayecto Ida</div>
                
                <div>
                    <label class="block text-zinc-500 mb-1" for="pt-num-billete-ida">Nº de Billete<span id="pt-num-billete-ida-req-star" class="text-rose-500"></span></label>
                    <input type="text" id="pt-num-billete-ida" value="${part.numBilleteIda || ''}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-lg px-2 py-1 text-zinc-800">
                </div>
                <div>
                    <label class="block text-zinc-500 mb-1" for="pt-loc-ida">Nº de Localizador<span id="pt-loc-ida-req-star" class="text-rose-500"></span></label>
                    <input type="text" id="pt-loc-ida" value="${part.localizadorIda || ''}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-lg px-2 py-1 text-zinc-800 font-mono">
                </div>
                <div>
                    <label class="block text-zinc-500 mb-1" for="pt-coche-ida">Nº de Coche<span id="pt-coche-ida-req-star" class="text-rose-500"></span></label>
                    <input type="text" id="pt-coche-ida" value="${part.cocheIda || part.vagonIda || ''}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-lg px-2 py-1 text-zinc-800">
                </div>
                <div>
                    <label class="block text-zinc-500 mb-1" for="pt-asiento-ida">Asiento<span id="pt-asiento-ida-req-star" class="text-rose-500"></span></label>
                    <input type="text" id="pt-asiento-ida" value="${part.asientoIda || ''}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-lg px-2 py-1 text-zinc-800">
                </div>
                <div class="col-span-2">
                    <label class="block text-zinc-500 mb-1" for="pt-drive-ida">Enlace Google Drive (Obligatorio si está comprado)<span id="pt-drive-ida-req-star" class="text-rose-500"></span></label>
                    <input type="url" id="pt-drive-ida" value="${part.driveLinkIda || ''}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-lg px-2.5 py-1.5 text-zinc-800 font-medium" placeholder="https://drive.google.com/...">
                </div>
            </div>

            <!-- Trayecto Vuelta -->
            <div class="grid grid-cols-2 gap-3 bg-zinc-50 border border-zinc-200 p-4 rounded-xl">
                <div class="col-span-2 font-bold text-[10px] text-brand-600 uppercase tracking-widest border-b border-zinc-200 pb-1 mb-1">Trayecto Vuelta</div>
                
                <div>
                    <label class="block text-zinc-500 mb-1" for="pt-num-billete-vta">Nº de Billete<span id="pt-num-billete-vta-req-star" class="text-rose-500"></span></label>
                    <input type="text" id="pt-num-billete-vta" value="${part.numBilleteVuelta || ''}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-lg px-2 py-1 text-zinc-800">
                </div>
                <div>
                    <label class="block text-zinc-500 mb-1" for="pt-loc-vta">Nº de Localizador<span id="pt-loc-vta-req-star" class="text-rose-500"></span></label>
                    <input type="text" id="pt-loc-vta" value="${part.localizadorVuelta || ''}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-lg px-2 py-1 text-zinc-800 font-mono">
                </div>
                <div>
                    <label class="block text-zinc-500 mb-1" for="pt-coche-vta">Nº de Coche<span id="pt-coche-vta-req-star" class="text-rose-500"></span></label>
                    <input type="text" id="pt-coche-vta" value="${part.cocheVuelta || part.vagonVuelta || ''}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-lg px-2 py-1 text-zinc-800">
                </div>
                <div>
                    <label class="block text-zinc-500 mb-1" for="pt-asiento-vta">Asiento<span id="pt-asiento-vta-req-star" class="text-rose-500"></span></label>
                    <input type="text" id="pt-asiento-vta" value="${part.asientoVuelta || ''}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-lg px-2 py-1 text-zinc-800">
                </div>
                <div class="col-span-2">
                    <label class="block text-zinc-500 mb-1" for="pt-drive-vta">Enlace Google Drive (Obligatorio si está comprado)<span id="pt-drive-vta-req-star" class="text-rose-500"></span></label>
                    <input type="url" id="pt-drive-vta" value="${part.driveLinkVuelta || ''}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-lg px-2.5 py-1.5 text-zinc-800 font-medium" placeholder="https://drive.google.com/...">
                </div>
            </div>
            
            <div class="flex justify-between items-center text-[10.5px] text-zinc-500 font-semibold mt-2">
                <span>Persona: ${fullName}</span>
                <button type="button" onclick="copyPersonalTicketSummary('${personaId}', '${viajeId}')" class="text-brand-600 hover:underline">Copiar Datos de este Billete</button>
            </div>
        </form>
    `;

    const buttons = [
        {
            text: 'Cancelar',
            class: 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700',
            action: closeModal
        },
        {
            text: 'Guardar Billetes',
            class: 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/20',
            action: () => {
                const form = document.getElementById('personal-ticket-form');
                if (!form || !form.reportValidity()) return;

                const idaComp = document.getElementById('pt-ida-compra').checked;
                const vtaComp = document.getElementById('pt-vuelta-compra').checked;

                const numBilIda = document.getElementById('pt-num-billete-ida').value.trim();
                const locIda = document.getElementById('pt-loc-ida').value.trim();
                const cocheIda = document.getElementById('pt-coche-ida').value.trim();
                const asIda = document.getElementById('pt-asiento-ida').value.trim();
                const drvIda = document.getElementById('pt-drive-ida').value.trim();

                const numBilVta = document.getElementById('pt-num-billete-vta').value.trim();
                const locVta = document.getElementById('pt-loc-vta').value.trim();
                const cocheVta = document.getElementById('pt-coche-vta').value.trim();
                const asVta = document.getElementById('pt-asiento-vta').value.trim();
                const drvVta = document.getElementById('pt-drive-vta').value.trim();

                viaje.participantes[pIndex] = {
                    ...part,
                    billeteIdaComprado: idaComp,
                    billeteVueltaComprado: vtaComp,
                    numBilleteIda: numBilIda,
                    localizadorIda: locIda,
                    cocheIda: cocheIda,
                    vagonIda: cocheIda,
                    asientoIda: asIda,
                    driveLinkIda: drvIda,
                    numBilleteVuelta: numBilVta,
                    localizadorVuelta: locVta,
                    cocheVuelta: cocheVta,
                    vagonVuelta: cocheVta,
                    asientoVuelta: asVta,
                    driveLinkVuelta: drvVta
                };

                if (updateViaje(viajeId, { participantes: viaje.participantes })) {
                    showToast(`Datos del billete de ${fullName} actualizados.`);
                    closeModal();
                    renderActiveView(); // reload page
                }
            }
        }
    ];

    showModal('Detalle de Billetes y Asientos', bodyHtml, buttons);
    // Initialize required indicators after showing modal
    updateTicketRequiredFields();
}

function copyPersonalTicketSummary(personaId, viajeId) {
    const viaje = getViajeById(viajeId);
    const part = viaje.participantes.find(p => p.personaId === personaId);
    const pers = getPersonaById(personaId);
    if (!part || !pers) return;

    const summaryText = `Billetes de ${pers.nombre} ${pers.apellido1 || ''}
Viaje: ${viaje.nombre}
-- Trayecto Ida --
¿Comprado?: ${part.billeteIdaComprado ? 'Sí' : 'No'}
Nº de Billete: ${part.numBilleteIda || '—'}
Localizador: ${part.localizadorIda || '—'}
Coche / Asiento: Coche ${part.cocheIda || '—'}, Asiento ${part.asientoIda || '—'}
Drive: ${part.driveLinkIda || '—'}
-- Trayecto Vuelta --
¿Comprado?: ${part.billeteVueltaComprado ? 'Sí' : 'No'}
Nº de Billete: ${part.numBilleteVuelta || '—'}
Localizador: ${part.localizadorVuelta || '—'}
Coche / Asiento: Coche ${part.cocheVuelta || '—'}, Asiento ${part.asientoVuelta || '—'}
Drive: ${part.driveLinkVuelta || '—'}`;

    copyToClipboard(summaryText, '¡Resumen de billetes de ' + pers.nombre + ' copiado al portapapeles!');
}

function renderViajeTransporteDestino(container, viaje) {
    const td = viaje.transporteEnDestino || { infoLibre: '', bloques: [] };

    container.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn font-sans">
            <!-- Left Side: Free form notes -->
            <div class="lg:col-span-1 space-y-4">
                <div class="bg-white border border-zinc-200 p-5 rounded-2xl space-y-4 shadow-sm">
                    <h4 class="font-extrabold text-xs text-brand-600 uppercase tracking-widest border-b border-zinc-100 pb-2">Información sobre el transporte en el destino</h4>
                    <div>
                        <label class="block text-[11px] font-bold text-zinc-500 mb-1.5">Escribe libremente puntos de encuentro, líneas de autobús o metros de interés:</label>
                        <textarea id="td-infolibre" rows="12" class="w-full bg-zinc-50 border border-zinc-200 focus:border-brand-500 focus:bg-white rounded-xl p-3 text-xs text-zinc-700 focus:outline-none transition resize-none leading-relaxed" placeholder="Ejemplo:
- Tarjeta de transporte de 10 viajes recomendada.
- Punto de encuentro en la puerta de la estación a las 11:15.
- Autobús Línea 19 o metro L3 para ir al centro...">${td.infoLibre || ''}</textarea>
                    </div>
                    <button onclick="saveTransporteDestinoInfoLibre('${viaje.id}')" class="w-full py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-brand-600/15">Guardar Notas</button>
                </div>
            </div>

            <!-- Right Side: Structured schedule itinerary blocks -->
            <div class="lg:col-span-2 space-y-4">
                <div class="bg-white border border-zinc-200 p-5 rounded-2xl space-y-4 shadow-sm">
                    <div class="flex items-center justify-between border-b border-zinc-100 pb-2">
                        <h4 class="font-extrabold text-xs text-brand-600 uppercase tracking-widest">Transportes en el destino</h4>
                        <button onclick="openAddBloqueTransporteModal('${viaje.id}')" class="px-2.5 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-bold transition shadow-sm">Añadir Bloque</button>
                    </div>

                    ${!td.bloques || td.bloques.length === 0 ? `
                        <p class="text-zinc-500 text-xs italic font-normal py-8 text-center">No se han añadido bloques estructurados para este destino. Organiza rutas internas, traslados o buses internos.</p>
                    ` : `
                        <div class="space-y-4">
                            ${td.bloques.map((b, idx) => {
        return `
                                    <div class="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2 relative overflow-hidden group">
                                        <div class="flex justify-between items-start">
                                            <div>
                                                <h5 class="font-bold text-zinc-900 text-sm">${b.titulo}</h5>
                                                <div class="flex items-center text-[10px] text-zinc-500 font-semibold space-x-2 mt-0.5">
                                                    <span>Hora: ${b.hora || '—'}</span>
                                                    <span>•</span>
                                                    <span>Lugar: ${b.lugar || '—'}</span>
                                                </div>
                                            </div>
                                            <div class="flex space-x-1.5 opacity-60 group-hover:opacity-100 transition">
                                                <button onclick="openEditBloqueTransporteModal('${viaje.id}', '${b.id}')" class="text-zinc-500 hover:text-brand-600 p-1" title="Editar bloque">
                                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                                </button>
                                                <button onclick="deleteBloqueTransporte('${viaje.id}', '${b.id}')" class="text-zinc-500 hover:text-rose-600 p-1" title="Eliminar bloque">
                                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                </button>
                                            </div>
                                        </div>
                                        <p class="text-zinc-650 text-xs font-normal leading-relaxed">${b.descripcion || ''}</p>
                                        ${b.notas ? `<div class="text-[10px] text-zinc-500 font-semibold bg-white border border-zinc-200 p-2 rounded-lg mt-2">Notas: ${b.notas}</div>` : ''}
                                    </div>
                                `;
    }).join('')}
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;
}

function saveTransporteDestinoInfoLibre(viajeId) {
    const text = document.getElementById('td-infolibre').value;
    const viaje = getViajeById(viajeId);
    if (!viaje) return;

    if (!viaje.transporteEnDestino) viaje.transporteEnDestino = { infoLibre: '', bloques: [] };
    viaje.transporteEnDestino.infoLibre = text;

    if (updateViaje(viajeId, { transporteEnDestino: viaje.transporteEnDestino })) {
        showToast('Notas de transporte en destino guardadas.');
        renderActiveView();
    }
}

function openAddBloqueTransporteModal(viajeId) {
    const bodyHtml = `
        <form id="bloque-form" class="space-y-4 font-sans text-xs">
            <div>
                <label class="block font-bold text-zinc-500 mb-1.5" for="b-titulo">Título del Bloque *</label>
                <input type="text" id="b-titulo" required class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 focus:outline-none placeholder-zinc-400 transition" placeholder="Ej. Traslado al Hotel (Metro L5)">
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block font-bold text-zinc-500 mb-1.5" for="b-hora">Hora de Salida</label>
                    <input type="text" id="b-hora" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 focus:outline-none placeholder-zinc-400 transition" placeholder="Ej. 12:45 o Tarde">
                </div>
                <div>
                    <label class="block font-bold text-zinc-500 mb-1.5" for="b-lugar">Lugar de Salida/label>
                    <input type="text" id="b-lugar" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 focus:outline-none placeholder-zinc-400 transition" placeholder="Ej. Estación de trenes">
                </div>
            </div>
            <div>
                <label class="block font-bold text-zinc-500 mb-1.5" for="b-desc">Descripción de la Ruta</label>
                <textarea id="b-desc" rows="3" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 focus:outline-none placeholder-zinc-400 transition resize-none" placeholder="Indica el transporte o trayecto..."></textarea>
            </div>
            <div>
                <label class="block font-bold text-zinc-500 mb-1.5" for="b-notas">Notas</label>
                <input type="text" id="b-notas" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 focus:outline-none placeholder-zinc-400 transition" placeholder="Ej. Cuesta 2,50€">
            </div>
        </form>
    `;

    const buttons = [
        {
            text: 'Cancelar',
            class: 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700',
            action: closeModal
        },
        {
            text: 'Añadir Bloque',
            class: 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/20',
            action: () => {
                const form = document.getElementById('bloque-form');
                if (!form || !form.reportValidity()) return;

                const titulo = document.getElementById('b-titulo').value.trim();
                const hora = document.getElementById('b-hora').value.trim();
                const lugar = document.getElementById('b-lugar').value.trim();
                const desc = document.getElementById('b-desc').value.trim();
                const notas = document.getElementById('b-notas').value.trim();

                const viaje = getViajeById(viajeId);
                if (!viaje.transporteEnDestino) viaje.transporteEnDestino = { infoLibre: '', bloques: [] };

                viaje.transporteEnDestino.bloques.push({
                    id: generateId(),
                    titulo,
                    hora,
                    lugar,
                    descripcion: desc,
                    notas
                });

                if (updateViaje(viajeId, { transporteEnDestino: viaje.transporteEnDestino })) {
                    showToast('Bloque de transporte añadido.');
                    closeModal();
                    renderActiveView();
                }
            }
        }
    ];

    showModal('Añadir Bloque de Ruta/Destino', bodyHtml, buttons);
}

function openEditBloqueTransporteModal(viajeId, bloqueId) {
    const viaje = getViajeById(viajeId);
    const bIndex = viaje.transporteEnDestino.bloques.findIndex(b => b.id === bloqueId);
    if (bIndex === -1) return;

    const b = viaje.transporteEnDestino.bloques[bIndex];

    const bodyHtml = `
        <form id="bloque-form" class="space-y-4 font-sans text-xs">
            <div>
                <label class="block font-bold text-zinc-500 mb-1.5" for="b-titulo">Título del Bloque *</label>
                <input type="text" id="b-titulo" value="${b.titulo}" required class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 focus:outline-none placeholder-zinc-400 transition">
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block font-bold text-zinc-500 mb-1.5" for="b-hora">Hora de Salida / Encuentro</label>
                    <input type="text" id="b-hora" value="${b.hora || ''}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 focus:outline-none placeholder-zinc-400 transition">
                </div>
                <div>
                    <label class="block font-bold text-zinc-500 mb-1.5" for="b-lugar">Lugar de Salida / Encuentro</label>
                    <input type="text" id="b-lugar" value="${b.lugar || ''}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 focus:outline-none placeholder-zinc-400 transition">
                </div>
            </div>
            <div>
                <label class="block font-bold text-zinc-500 mb-1.5" for="b-desc">Descripción de la Ruta</label>
                <textarea id="b-desc" rows="3" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 focus:outline-none placeholder-zinc-400 transition resize-none">${b.descripcion || ''}</textarea>
            </div>
            <div>
                <label class="block font-bold text-zinc-500 mb-1.5" for="b-notas">Notas / Avisos adicionales</label>
                <input type="text" id="b-notas" value="${b.notas || ''}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 focus:outline-none placeholder-zinc-400 transition">
            </div>
        </form>
    `;

    const buttons = [
        {
            text: 'Cancelar',
            class: 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700',
            action: closeModal
        },
        {
            text: 'Guardar Bloque',
            class: 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/20',
            action: () => {
                const form = document.getElementById('bloque-form');
                if (!form || !form.reportValidity()) return;

                const titulo = document.getElementById('b-titulo').value.trim();
                const hora = document.getElementById('b-hora').value.trim();
                const lugar = document.getElementById('b-lugar').value.trim();
                const desc = document.getElementById('b-desc').value.trim();
                const notas = document.getElementById('b-notas').value.trim();

                viaje.transporteEnDestino.bloques[bIndex] = {
                    ...b,
                    titulo,
                    hora,
                    lugar,
                    descripcion: desc,
                    notas
                };

                if (updateViaje(viajeId, { transporteEnDestino: viaje.transporteEnDestino })) {
                    showToast('Bloque de transporte editado correctamente.');
                    closeModal();
                    renderActiveView();
                }
            }
        }
    ];

    showModal('Editar Bloque de Ruta/Destino', bodyHtml, buttons);
}

function deleteBloqueTransporte(viajeId, bloqueId) {
    showConfirm(
        'Confirmar eliminación',
        '¿Estás seguro de que quieres borrar este bloque de transporte del itinerario de destino?',
        () => {
            const viaje = getViajeById(viajeId);
            viaje.transporteEnDestino.bloques = viaje.transporteEnDestino.bloques.filter(b => b.id !== bloqueId);
            if (updateViaje(viajeId, { transporteEnDestino: viaje.transporteEnDestino })) {
                showToast('Bloque de transporte eliminado.', 'warning');
                renderActiveView();
            }
        },
        'Eliminar Bloque',
        true
    );
}


// --- PÁGINA 10: SECCIÓN VIAJE: LISTADO DE PERSONAS DEL VIAJE (PASAJEROS) ---
let viajePersonasFilter = 'todos'; // 'todos', 'confirmados', 'pendientes', 'pagado', 'no_pagado', 'falta_ida', 'falta_vuelta'

function renderViajePersonas(container, viaje) {
    const personas = getPersonas();
    let list = viaje.participantes || [];

    // Apply Filter selection
    if (viajePersonasFilter === 'confirmados') {
        list = list.filter(p => p.estadoConfirmacion === 'confirmado');
    } else if (viajePersonasFilter === 'pendientes') {
        list = list.filter(p => p.estadoConfirmacion === 'pendiente');
    } else if (viajePersonasFilter === 'pagado') {
        list = list.filter(p => p.estadoPago === 'pagado');
    } else if (viajePersonasFilter === 'no_pagado') {
        list = list.filter(p => p.estadoPago === 'no pagado');
    } else if (viajePersonasFilter === 'falta_ida') {
        list = list.filter(p => !p.billeteIdaComprado);
    } else if (viajePersonasFilter === 'falta_vuelta') {
        list = list.filter(p => !p.billeteVueltaComprado);
    }

    container.innerHTML = `
        <div class="space-y-6 animate-fadeIn font-sans">
            <!-- Table Header quick tools -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="flex flex-wrap items-center gap-2">
                    <!-- Filters Select -->
                    <select onchange="handleViajePersonasFilter(this.value)" class="bg-white border border-zinc-200 text-xs font-bold text-zinc-700 rounded-xl px-3 py-1.5 focus:outline-none focus:border-brand-500">
                        <option value="todos" ${viajePersonasFilter === 'todos' ? 'selected' : ''}>Todos los Pasajeros</option>
                        <option value="confirmados" ${viajePersonasFilter === 'confirmados' ? 'selected' : ''}>Confirmados</option>
                        <option value="pendientes" ${viajePersonasFilter === 'pendientes' ? 'selected' : ''}>Pendientes de Confirmar</option>
                        <option value="pagado" ${viajePersonasFilter === 'pagado' ? 'selected' : ''}>Estado: Pagado</option>
                        <option value="no_pagado" ${viajePersonasFilter === 'no_pagado' ? 'selected' : ''}>Estado: No Pagado</option>
                        <option value="falta_ida" ${viajePersonasFilter === 'falta_ida' ? 'selected' : ''}>Falta comprar Ida</option>
                        <option value="falta_vuelta" ${viajePersonasFilter === 'falta_vuelta' ? 'selected' : ''}>Falta comprar Vuelta</option>
                    </select>

                    <!-- Collective copiers -->
                    <div class="relative inline-block group">
                        <button class="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold border border-zinc-200 flex items-center space-x-1">
                            <span>Copiar Listados</span>
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                        <div class="absolute left-0 mt-1 w-48 rounded-xl bg-white border border-zinc-200 py-1 shadow-xl z-20 hidden group-hover:block text-xs">
                            <button onclick="copyViajeAttendeeList('${viaje.id}')" class="w-full text-left px-4 py-2 hover:bg-zinc-50 text-zinc-700 font-semibold">Lista Pasajeros Completa</button>
                            <button onclick="copyViajePhoneList('${viaje.id}')" class="w-full text-left px-4 py-2 hover:bg-zinc-50 text-zinc-700 font-semibold">Lista de Teléfonos</button>
                            <button onclick="copyViajePaymentsSummary('${viaje.id}')" class="w-full text-left px-4 py-2 hover:bg-zinc-50 text-zinc-700 font-semibold">Resumen de Pagos</button>
                            <button onclick="copyViajeTicketsSummary('${viaje.id}')" class="w-full text-left px-4 py-2 hover:bg-zinc-50 text-zinc-700 font-semibold">Resumen de Billetes</button>
                        </div>
                    </div>
                </div>

                <button onclick="openAssignAttendeesModal('${viaje.id}')" class="flex items-center justify-center space-x-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-brand-600/15">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
                    <span>Asignar Personas</span>
                </button>
            </div>

            <!-- Pasajeros table -->
            ${list.length === 0 ? `
                <div class="text-center py-12 bg-white border border-zinc-200 rounded-2xl shadow-sm">
                    <p class="text-zinc-500 text-xs italic">Ningún pasajero coincide con el filtro de búsqueda.</p>
                </div>
            ` : `
                <div class="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-xs text-zinc-700 border-collapse">
                            <thead class="bg-zinc-50 border-b border-zinc-200 font-bold uppercase text-zinc-500 tracking-wider">
                                <tr>
                                    <th class="px-5 py-3.5">Nombre Completo</th>
                                    <th class="px-5 py-3.5">Teléfono</th>
                                    <th class="px-5 py-3.5">Asiento Ida</th>
                                    <th class="px-5 py-3.5">Asiento Vuelta</th>
                                    <th class="px-5 py-3.5">Confirmación</th>
                                    <th class="px-5 py-3.5">Pago</th>
                                    <th class="px-5 py-3.5 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-zinc-200/60 bg-white">
                                ${list.map(part => {
        const pers = personas.find(p => p.id === part.personaId);
        if (!pers) return '';
        const name = `${pers.nombre} ${pers.apellido1 || ''} ${pers.apellido2 || ''}`.trim();
        return `
                                        <tr class="hover:bg-zinc-50 transition">
                                            <td class="px-5 py-3.5 whitespace-nowrap">
                                                <div class="font-bold text-zinc-800 cursor-pointer hover:underline" onclick="showPage('visualizacion-persona', {personaId: '${pers.id}'})">${name}</div>
                                            </td>
                                            <td class="px-5 py-3.5 font-mono text-zinc-600 whitespace-nowrap">
                                                ${pers.telefono || '—'}
                                            </td>
                                            <td class="px-5 py-3.5 whitespace-nowrap">
                                                ${part.asientoIda ? `<span class="bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded text-zinc-700 font-bold">V${part.vagonIda || '-'}:${part.asientoIda}</span>` : '<span class="text-zinc-600">—</span>'}
                                            </td>
                                            <td class="px-5 py-3.5 whitespace-nowrap">
                                                ${part.asientoVuelta ? `<span class="bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded text-zinc-700 font-bold">V${part.vagonVuelta || '-'}:${part.asientoVuelta}</span>` : '<span class="text-zinc-600">—</span>'}
                                            </td>
                                            <td class="px-5 py-3.5 whitespace-nowrap">
                                                ${renderBadge(part.estadoConfirmacion)}
                                            </td>
                                            <td class="px-5 py-3.5 whitespace-nowrap">
                                                ${renderBadge(part.estadoPago)}
                                            </td>
                                            <td class="px-5 py-3.5 whitespace-nowrap text-right space-x-2">
                                                <button onclick="openPersonalTravelInfoModal('${viaje.id}', '${pers.id}')" class="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded border border-zinc-200 font-bold" title="Gestionar estados de viaje y notas específicas">Estado</button>
                                                <button onclick="removeAttendeeFromViaje('${viaje.id}', '${pers.id}')" class="px-2 py-1 bg-white hover:bg-rose-50 text-zinc-500 hover:text-rose-600 rounded border border-zinc-200 hover:border-rose-200 font-bold" title="Desasignar del viaje">Quitar</button>
                                            </td>
                                        </tr>
                                    `;
    }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `}
        </div>
    `;
}

function handleViajePersonasFilter(value) {
    viajePersonasFilter = value;
    renderActiveView();
}

// --- PÁGINA 7: VISTA / MODAL DE ASIGNAR PERSONAS AL VIAJE ---
let searchAssignQuery = '';
let assignSelectedIds = [];

function openAssignAttendeesModal(viajeId) {
    searchAssignQuery = '';
    assignSelectedIds = [];
    renderAssignModalList(viajeId);
}

function renderAssignModalList(viajeId) {
    const viaje = getViajeById(viajeId);
    const personas = getPersonas();

    // People not already in this trip
    const available = personas.filter(p => !viaje.participantes.some(part => part.personaId === p.id));

    // Sort
    let filtered = [...available].sort((a, b) => a.nombre.localeCompare(b.nombre));

    if (searchAssignQuery.trim()) {
        const q = searchAssignQuery.toLowerCase().trim();
        filtered = filtered.filter(p =>
            p.nombre.toLowerCase().includes(q) ||
            (p.apellido1 && p.apellido1.toLowerCase().includes(q)) ||
            (p.dni && p.dni.toLowerCase().includes(q))
        );
    }

    const bodyHtml = `
        <div class="space-y-4 font-sans text-xs">
            <!-- Search & Actions -->
            <div class="flex items-center gap-3">
                <div class="relative flex-1">
                    <input type="text" id="assign-search" value="${searchAssignQuery}" oninput="handleAssignSearch(this.value, '${viajeId}')" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl pl-3 pr-3 py-2 text-zinc-800 focus:outline-none placeholder-zinc-400 transition text-xs" placeholder="Buscar persona por nombre, DNI...">
                </div>
                <button onclick="closeModal(); showPage('registro-persona', {editMode: false, sourcePage: 'viaje-add', viajeId: '${viajeId}'})" class="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-700 rounded-xl font-bold flex-shrink-0">
                    + Registrar Nueva
                </button>
            </div>

            <!-- List box -->
            <div class="border border-zinc-200 rounded-xl overflow-hidden max-h-[350px] overflow-y-auto bg-zinc-50">
                ${filtered.length === 0 ? `
                    <p class="text-zinc-600 italic py-6 text-center">No hay más personas disponibles para añadir.</p>
                ` : `
                    <div class="divide-y divide-zinc-200">
                        ${filtered.map(p => {
        const isChecked = assignSelectedIds.includes(p.id);
        return `
                                <div class="px-4 py-3 flex items-center justify-between hover:bg-zinc-100 transition">
                                    <div class="flex items-center space-x-3">
                                        <input type="checkbox" id="chk-assign-${p.id}" ${isChecked ? 'checked' : ''} onchange="toggleAssignSelection('${p.id}', this.checked)" class="h-4.5 w-4.5 rounded border-zinc-300 bg-white text-brand-600">
                                        <label for="chk-assign-${p.id}" class="flex flex-col cursor-pointer">
                                            <span class="font-bold text-zinc-800">${p.nombre} ${p.apellido1 || ''}</span>
                                            <span class="text-[10px] text-zinc-500">DNI: ${p.dni || '—'} • Tel: ${p.telefono || '—'}</span>
                                        </label>
                                    </div>
                                    <button onclick="addSingleAttendeeToViaje('${viajeId}', '${p.id}')" class="px-2 py-1 bg-white border border-zinc-200 hover:bg-brand-600 hover:text-white hover:border-transparent text-zinc-700 rounded font-bold transition">Añadir</button>
                                </div>
                            `;
    }).join('')}
                    </div>
                `}
            </div>

            <div class="flex justify-between items-center text-zinc-500 font-semibold">
                <span>Seleccionadas: ${assignSelectedIds.length} personas</span>
            </div>
        </div>
    `;

    const buttons = [
        {
            text: 'Cancelar',
            class: 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700',
            action: closeModal
        },
        {
            text: 'Añadir Seleccionadas',
            class: 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/20',
            action: () => {
                if (assignSelectedIds.length === 0) {
                    showToast('Por favor, selecciona al menos una persona para añadir.', 'warning');
                    return;
                }

                const viaje = getViajeById(viajeId);
                assignSelectedIds.forEach(id => {
                    viaje.participantes.push(createEmptyParticipantSchema(id));
                });

                if (updateViaje(viajeId, { participantes: viaje.participantes })) {
                    showToast(`Añadidos ${assignSelectedIds.length} pasajeros al viaje.`);
                    closeModal();
                    renderActiveView(); // reload
                }
            }
        }
    ];

    showModal('Asignar Personas al Viaje', bodyHtml, buttons);
}

function handleAssignSearch(val, viajeId) {
    searchAssignQuery = val;
    renderAssignModalList(viajeId);
}

function toggleAssignSelection(id, checked) {
    if (checked) {
        if (!assignSelectedIds.includes(id)) assignSelectedIds.push(id);
    } else {
        assignSelectedIds = assignSelectedIds.filter(x => x !== id);
    }
}

function createEmptyParticipantSchema(personaId) {
    return {
        personaId,
        estadoConfirmacion: 'pendiente',
        estadoPago: 'no pagado',
        billeteIdaComprado: false,
        billeteVueltaComprado: false,
        asientoIda: '',
        asientoVuelta: '',
        vagonIda: '',
        vagonVuelta: '',
        localizadorIda: '',
        localizadorVuelta: '',
        observacionesIda: '',
        observacionesVuelta: '',
        notasViaje: ''
    };
}

function addSingleAttendeeToViaje(viajeId, personaId) {
    const viaje = getViajeById(viajeId);
    viaje.participantes.push(createEmptyParticipantSchema(personaId));
    if (updateViaje(viajeId, { participantes: viaje.participantes })) {
        showToast('Pasajero añadido correctamente.');
        closeModal();
        renderActiveView();
    }
}

function removeAttendeeFromViaje(viajeId, personaId) {
    showConfirm(
        'Confirmar desasignación',
        '¿Quieres desvincular a este pasajero de este viaje? Conservará su ficha personal global, pero perderá la configuración de asientos, tareas asignadas del viaje e información de billetes.',
        () => {
            const viaje = getViajeById(viajeId);
            viaje.participantes = viaje.participantes.filter(p => p.personaId !== personaId);

            // Also unassign tasks of this trip assigned to this person
            const tareas = getTareas();
            tareas.forEach(t => {
                if (t.viajeId === viajeId && t.personaAsignadaId === personaId) {
                    t.personaAsignadaId = "";
                    t.fechaActualizacion = new Date().toISOString();
                }
            });
            saveTareas(tareas);

            if (updateViaje(viajeId, { participantes: viaje.participantes })) {
                showToast('Pasajero desvinculado correctamente.', 'warning');
                renderActiveView();
            }
        },
        'Quitar Pasajero',
        true
    );
}

function openPersonalTravelInfoModal(viajeId, personaId) {
    const viaje = getViajeById(viajeId);
    const pIndex = viaje.participantes.findIndex(part => part.personaId === personaId);
    if (pIndex === -1) return;

    const part = viaje.participantes[pIndex];
    const pers = getPersonaById(personaId);
    const fullName = `${pers.nombre} ${pers.apellido1 || ''}`.trim();

    const bodyHtml = `
        <form id="personal-travel-form" class="space-y-4 font-sans text-xs">
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block font-bold text-zinc-500 mb-1.5" for="pt-confirm">Confirmación</label>
                    <select id="pt-confirm" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-3 py-2 text-zinc-800">
                        <option value="pendiente" ${part.estadoConfirmacion === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                        <option value="confirmado" ${part.estadoConfirmacion === 'confirmado' ? 'selected' : ''}>Confirmado</option>
                    </select>
                </div>
                <div>
                    <label class="block font-bold text-zinc-500 mb-1.5" for="pt-pago">Estado Pago</label>
                    <select id="pt-pago" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-3 py-2 text-zinc-800">
                        <option value="no pagado" ${part.estadoPago === 'no pagado' ? 'selected' : ''}>No pagado</option>
                        <option value="pagado" ${part.estadoPago === 'pagado' ? 'selected' : ''}>Pagado</option>
                    </select>
                </div>
            </div>
            <div>
                <label class="block font-bold text-zinc-500 mb-1.5" for="pt-notas">Anotaciones</label>
                <textarea id="pt-notas" rows="4" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl p-3 text-zinc-800 focus:outline-none transition resize-none" placeholder="Habitación asignada, vegetarianismo, notas de equipaje...">${part.notasViaje || ''}</textarea>
            </div>
        </form>
    `;

    const buttons = [
        {
            text: 'Cancelar',
            class: 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700',
            action: closeModal
        },
        {
            text: 'Guardar Estado',
            class: 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/20',
            action: () => {
                const conf = document.getElementById('pt-confirm').value;
                const pago = document.getElementById('pt-pago').value;
                const notas = document.getElementById('pt-notas').value.trim();

                viaje.participantes[pIndex] = {
                    ...part,
                    estadoConfirmacion: conf,
                    estadoPago: pago,
                    notasViaje: notas
                };

                if (updateViaje(viajeId, { participantes: viaje.participantes })) {
                    showToast(`Estado de viaje de ${fullName} guardado.`);
                    closeModal();
                    renderActiveView(); // reload page
                }
            }
        }
    ];

    showModal(`Estados de Viaje: ${fullName}`, bodyHtml, buttons);
}

// Copy tools for Passenger sections
function copyViajeAttendeeList(viajeId) {
    const viaje = getViajeById(viajeId);
    const personas = getPersonas();
    if (!viaje.participantes || viaje.participantes.length === 0) return;

    const text = viaje.participantes.map((part, idx) => {
        const p = personas.find(x => x.id === part.personaId);
        return p ? `${idx + 1}. ${p.nombre} ${p.apellido1 || ''} (DNI: ${p.dni || '—'})` : '';
    }).filter(Boolean).join('\n');

    copyToClipboard(text, 'Lista de pasajeros copiada');
}

function copyViajePhoneList(viajeId) {
    const viaje = getViajeById(viajeId);
    const personas = getPersonas();
    if (!viaje.participantes || viaje.participantes.length === 0) return;

    const text = viaje.participantes.map(part => {
        const p = personas.find(x => x.id === part.personaId);
        return p && p.telefono ? `${p.nombre} ${p.apellido1 || ''}: ${p.telefono}` : null;
    }).filter(Boolean).join('\n');

    copyToClipboard(text || 'No hay teléfonos registrados', 'Lista de teléfonos copiada');
}

function copyViajePaymentsSummary(viajeId) {
    const viaje = getViajeById(viajeId);
    const personas = getPersonas();
    if (!viaje.participantes || viaje.participantes.length === 0) return;

    const text = viaje.participantes.map(part => {
        const p = personas.find(x => x.id === part.personaId);
        return p ? `${p.nombre} ${p.apellido1 || ''}: ${part.estadoPago.toUpperCase()}` : '';
    }).filter(Boolean).join('\n');

    copyToClipboard(text, 'Resumen de pagos copiado');
}

function copyViajeTicketsSummary(viajeId) {
    const viaje = getViajeById(viajeId);
    const personas = getPersonas();
    if (!viaje.participantes || viaje.participantes.length === 0) return;

    const text = viaje.participantes.map(part => {
        const p = personas.find(x => x.id === part.personaId);
        if (!p) return '';
        return `${p.nombre} ${p.apellido1 || ''}: 
- Ida: ${part.billeteIdaComprado ? 'Comprado' : 'Falta'} (Vagón: ${part.vagonIda || '-'}, Asiento: ${part.asientoIda || '-'})
- Vuelta: ${part.billeteVueltaComprado ? 'Comprado' : 'Falta'} (Vagón: ${part.vagonVuelta || '-'}, Asiento: ${part.asientoVuelta || '-'})`;
    }).filter(Boolean).join('\n\n');

    copyToClipboard(text, 'Resumen de billetes copiado');
}


// --- PÁGINA 11: SECCIÓN VIAJE: TAREAS DEL VIAJE ---
let viajeTareasFilter = 'todas'; // 'todas', 'pendientes', 'completadas', 'asignada_a'
let viajeTareasSelectedPersonaId = '';

function renderViajeTareas(container, viaje) {
    const tareas = getTareasByViaje(viaje.id);
    const personas = getPersonas();

    // Map participant details inside this trip for assignment
    const participantesDelViaje = viaje.participantes.map(part => {
        return personas.find(p => p.id === part.personaId);
    }).filter(Boolean);

    // Apply Filter selection
    let filtered = [...tareas];
    if (viajeTareasFilter === 'pendientes') {
        filtered = filtered.filter(t => t.estado === 'pendiente');
    } else if (viajeTareasFilter === 'completadas') {
        filtered = filtered.filter(t => t.estado === 'completada');
    } else if (viajeTareasFilter === 'asignada_a' && viajeTareasSelectedPersonaId) {
        filtered = filtered.filter(t => t.personaAsignadaId === viajeTareasSelectedPersonaId);
    }

    container.innerHTML = `
        <div class="space-y-6 animate-fadeIn font-sans">
            <!-- Filter Actions Bar -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="flex flex-wrap items-center gap-2">
                    <select id="filt-tarea-type" onchange="handleViajeTareasFilterType(this.value, '${viaje.id}')" class="bg-white border border-zinc-200 text-xs font-bold text-zinc-700 rounded-xl px-3 py-1.5 focus:outline-none focus:border-brand-500">
                        <option value="todas" ${viajeTareasFilter === 'todas' ? 'selected' : ''}>Todas las Tareas</option>
                        <option value="pendientes" ${viajeTareasFilter === 'pendientes' ? 'selected' : ''}>Pendientes</option>
                        <option value="completadas" ${viajeTareasFilter === 'completadas' ? 'selected' : ''}>Completadas</option>
                        <option value="asignada_a" ${viajeTareasFilter === 'asignada_a' ? 'selected' : ''}>Asignada a...</option>
                    </select>

                    <select id="filt-tarea-persona" onchange="handleViajeTareasFilterPersona(this.value, '${viaje.id}')" class="bg-white border border-zinc-200 text-xs text-zinc-700 rounded-xl px-3 py-1.5 focus:outline-none focus:border-brand-500 ${viajeTareasFilter === 'asignada_a' ? '' : 'hidden'}">
                        <option value="">-- Seleccionar Persona --</option>
                        ${participantesDelViaje.map(p => {
        return `<option value="${p.id}" ${viajeTareasSelectedPersonaId === p.id ? 'selected' : ''}>${p.nombre} ${p.apellido1 || ''}</option>`;
    }).join('')}
                    </select>
                </div>

                <button onclick="openCreateTareaModal('${viaje.id}')" class="flex items-center justify-center space-x-1 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-brand-600/15">
                    + Crear Tarea
                </button>
            </div>

            <!-- Task List Display -->
            ${filtered.length === 0 ? `
                <div class="text-center py-12 bg-white border border-zinc-200 rounded-2xl shadow-sm">
                    <p class="text-zinc-500 text-xs italic">Ninguna tarea coincide con el filtro seleccionado.</p>
                </div>
            ` : `
                <div class="grid md:grid-cols-2 gap-4">
                    ${filtered.map(t => {
        const isDone = t.estado === 'completada';
        const assignedTo = t.personaAsignadaId ? personas.find(x => x.id === t.personaAsignadaId) : null;
        const assignedName = assignedTo ? `${assignedTo.nombre} ${assignedTo.apellido1 || ''}`.trim() : 'Sin asignar';

        return `
                            <div class="bg-white border border-zinc-200 p-4 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group">
                                <div class="space-y-2">
                                    <div class="flex items-start justify-between gap-4">
                                        <div class="flex items-start space-x-2">
                                            <input type="checkbox" ${isDone ? 'checked' : ''} onchange="toggleTareaState('${t.id}', this.checked)" class="mt-1 h-4.5 w-4.5 rounded border-zinc-300 bg-white text-brand-600">
                                            <div>
                                                <h5 class="font-bold text-sm text-zinc-800 leading-snug ${isDone ? 'line-through text-zinc-400' : ''}">${t.titulo}</h5>
                                                <p class="text-[11px] text-zinc-600 mt-1 font-normal line-clamp-2 leading-relaxed">${t.descripcion || 'Sin descripción.'}</p>
                                            </div>
                                        </div>
                                        
                                        <!-- Actions -->
                                        <div class="flex space-x-1.5 opacity-60 group-hover:opacity-100 transition flex-shrink-0">
                                            <button onclick="openEditTareaModal('${viaje.id}', '${t.id}')" class="text-zinc-500 hover:text-brand-600 p-1" title="Editar Tarea">
                                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                            </button>
                                            <button onclick="deleteTareaHandler('${t.id}')" class="text-zinc-500 hover:text-rose-600 p-1" title="Eliminar Tarea">
                                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div class="border-t border-zinc-100 mt-3 pt-3 flex items-center justify-between text-[10px] text-zinc-500 font-semibold">
                                    <div class="flex items-center space-x-1" title="Persona asignada">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                                        <span class="text-zinc-600">${assignedName}</span>
                                    </div>
                                    ${t.fechaLimite ? `
                                        <div class="flex items-center space-x-1" title="Fecha límite">
                                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                            <span class="font-mono text-zinc-400">${formatDate(t.fechaLimite)}</span>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        `;
    }).join('')}
                </div>
            `}
        </div>
    `;
}

function handleViajeTareasFilterType(val, viajeId) {
    viajeTareasFilter = val;
    const personaSelect = document.getElementById('filt-tarea-persona');
    if (personaSelect) {
        if (val === 'asignada_a') {
            personaSelect.classList.remove('hidden');
        } else {
            personaSelect.classList.add('hidden');
            viajeTareasSelectedPersonaId = '';
        }
    }
    renderActiveView();
}

function handleViajeTareasFilterPersona(val, viajeId) {
    viajeTareasSelectedPersonaId = val;
    renderActiveView();
}

function toggleTareaState(id, completed) {
    if (updateTarea(id, { estado: completed ? 'completada' : 'pendiente' })) {
        showToast(completed ? 'Tarea completada.' : 'Tarea reabierta como pendiente.', 'info');
        renderActiveView();
    }
}

function deleteTareaHandler(id) {
    showConfirm(
        'Confirmar eliminación',
        '¿Deseas eliminar esta tarea del viaje? Esta acción no se puede deshacer.',
        () => {
            if (deleteTarea(id)) {
                showToast('Tarea eliminada correctamente.', 'warning');
                renderActiveView();
            }
        },
        'Eliminar Tarea',
        true
    );
}

function openCreateTareaModal(viajeId) {
    const viaje = getViajeById(viajeId);
    const personas = getPersonas();

    // Trip members for assign option
    const participantes = viaje.participantes.map(part => {
        return personas.find(p => p.id === part.personaId);
    }).filter(Boolean);

    const bodyHtml = `
        <form id="create-tarea-form" class="space-y-4 font-sans text-xs">
            <div>
                <label class="block font-bold text-zinc-500 mb-1.5" for="t-titulo">Título de la Tarea *</label>
                <input type="text" id="t-titulo" required class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 focus:outline-none placeholder-zinc-400 transition" placeholder="Ej. Comprar billetes de metro">
            </div>
            <div>
                <label class="block font-bold text-zinc-500 mb-1.5" for="t-desc">Descripción detallada</label>
                <textarea id="t-desc" rows="3" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 focus:outline-none placeholder-zinc-400 transition resize-none" placeholder="Explica las instrucciones del encargo..."></textarea>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block font-bold text-zinc-500 mb-1.5" for="t-persona">Asignar a Pasajero</label>
                    <select id="t-persona" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-3 py-2 text-zinc-800">
                        <option value="">-- Sin asignar --</option>
                        ${participantes.map(p => {
        return `<option value="${p.id}">${p.nombre} ${p.apellido1 || ''}</option>`;
    }).join('')}
                    </select>
                </div>
                <div>
                    <label class="block font-bold text-zinc-500 mb-1.5" for="t-limite">Fecha Límite</label>
                    <input type="date" id="t-limite" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 focus:outline-none transition">
                </div>
            </div>
        </form>
    `;

    const buttons = [
        {
            text: 'Cancelar',
            class: 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700',
            action: closeModal
        },
        {
            text: 'Crear Tarea',
            class: 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/20',
            action: () => {
                const form = document.getElementById('create-tarea-form');
                if (!form || !form.reportValidity()) return;

                const titulo = document.getElementById('t-titulo').value.trim();
                const desc = document.getElementById('t-desc').value.trim();
                const assigned = document.getElementById('t-persona').value;
                const limite = document.getElementById('t-limite').value;

                const newT = createTarea({
                    viajeId,
                    titulo,
                    descripcion: desc,
                    personaAsignadaId: assigned,
                    fechaLimite: limite
                });

                if (newT) {
                    showToast('Tarea de viaje creada.');
                    closeModal();
                    renderActiveView();
                }
            }
        }
    ];

    showModal('Crear Tarea del Viaje', bodyHtml, buttons);
}

function openEditTareaModal(viajeId, tareaId) {
    const t = getTareas().find(x => x.id === tareaId);
    if (!t) return;

    const viaje = getViajeById(viajeId);
    const personas = getPersonas();
    const participantes = viaje.participantes.map(part => {
        return personas.find(p => p.id === part.personaId);
    }).filter(Boolean);

    const bodyHtml = `
        <form id="edit-tarea-form" class="space-y-4 font-sans text-xs">
            <div>
                <label class="block font-bold text-zinc-500 mb-1.5" for="et-titulo">Título de la Tarea *</label>
                <input type="text" id="et-titulo" value="${t.titulo}" required class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 focus:outline-none placeholder-zinc-400 transition">
            </div>
            <div>
                <label class="block font-bold text-zinc-500 mb-1.5" for="et-desc">Descripción detallada</label>
                <textarea id="et-desc" rows="3" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 focus:outline-none transition resize-none">${t.descripcion || ''}</textarea>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block font-bold text-zinc-500 mb-1.5" for="et-persona">Asignar a Pasajero</label>
                    <select id="et-persona" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-3 py-2 text-zinc-800">
                        <option value="">-- Sin asignar --</option>
                        ${participantes.map(p => {
        return `<option value="${p.id}" ${t.personaAsignadaId === p.id ? 'selected' : ''}>${p.nombre} ${p.apellido1 || ''}</option>`;
    }).join('')}
                    </select>
                </div>
                <div>
                    <label class="block font-bold text-zinc-500 mb-1.5" for="et-limite">Fecha Límite</label>
                    <input type="date" id="et-limite" value="${t.fechaLimite || ''}" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 focus:outline-none transition">
                </div>
            </div>
        </form>
    `;

    const buttons = [
        {
            text: 'Cancelar',
            class: 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700',
            action: closeModal
        },
        {
            text: 'Guardar Tarea',
            class: 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/20',
            action: () => {
                const form = document.getElementById('edit-tarea-form');
                if (!form || !form.reportValidity()) return;

                const titulo = document.getElementById('et-titulo').value.trim();
                const desc = document.getElementById('et-desc').value.trim();
                const assigned = document.getElementById('et-persona').value;
                const limite = document.getElementById('et-limite').value;

                if (updateTarea(tareaId, {
                    titulo,
                    descripcion: desc,
                    personaAsignadaId: assigned,
                    fechaLimite: limite
                })) {
                    showToast('Tarea editada satisfactoriamente.');
                    closeModal();
                    renderActiveView();
                }
            }
        }
    ];

    showModal('Editar Tarea de Viaje', bodyHtml, buttons);
}


// --- PÁGINA 12: SECCIÓN VIAJE: TAREAS ASIGNADAS (PORCENTAJES DE RENDIMIENTO) ---
function renderViajeTareasAsignadas(container, viaje) {
    const personas = getPersonas();
    const tareas = getTareasByViaje(viaje.id);

    // Filter people assigned to this trip
    const pasajeros = viaje.participantes.map(part => {
        const pers = personas.find(p => p.id === part.personaId);
        if (!pers) return null;

        // Tasks assigned to this passenger in this specific trip
        const pTasks = tareas.filter(t => t.personaAsignadaId === pers.id);
        const pend = pTasks.filter(t => t.estado === 'pendiente');
        const comp = pTasks.filter(t => t.estado === 'completada');

        // Percentages
        let pct = 0;
        if (pTasks.length > 0) {
            pct = Math.round((comp.length / pTasks.length) * 100);
        }

        return {
            persona: pers,
            tasksCount: pTasks.length,
            pending: pend,
            completed: comp,
            percentage: pct
        };
    }).filter(Boolean);

    container.innerHTML = `
        <div class="space-y-6 animate-fadeIn font-sans">
            <div>
                <h4 class="font-extrabold text-sm text-zinc-900 uppercase tracking-wider">Rendimiento de Tareas por Pasajero</h4>
                <p class="text-xs text-zinc-500 mt-1">Monitorea el progreso de tareas completadas de cada miembro del viaje.</p>
            </div>

            ${pasajeros.length === 0 ? `
                <p class="text-zinc-500 text-xs italic">No hay pasajeros en este viaje para calcular rendimiento.</p>
            ` : `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    ${pasajeros.map(p => {
        const name = `${p.persona.nombre} ${p.persona.apellido1 || ''}`.trim();
        return `
                            <div class="bg-white border border-zinc-200 p-5 rounded-2xl space-y-4 shadow-sm">
                                <!-- Name and stats -->
                                <div class="flex justify-between items-start">
                                    <div>
                                        <h5 class="font-bold text-zinc-800 text-sm cursor-pointer hover:underline" onclick="showPage('visualizacion-persona', {personaId: '${p.persona.id}'})">${name}</h5>
                                        <span class="text-[10px] text-zinc-500 font-semibold">${p.tasksCount} tareas asignadas en total</span>
                                    </div>
                                    <span class="text-xs font-extrabold px-2 py-1 rounded bg-brand-50 text-brand-600 border border-brand-100">${p.percentage}% Completado</span>
                                </div>

                                <!-- Progress Bar -->
                                <div class="w-full bg-zinc-100 h-2 rounded-full overflow-hidden border border-zinc-200">
                                    <div class="bg-gradient-to-r from-brand-600 to-indigo-500 h-full rounded-full transition-all duration-300" style="width: ${p.percentage}%"></div>
                                </div>

                                <!-- Tasks lists -->
                                <div class="grid grid-cols-2 gap-4 text-xs font-semibold pt-2">
                                    <!-- Pending Tasks list -->
                                    <div class="space-y-2">
                                        <span class="text-amber-600 text-[10px] uppercase tracking-wider block">Pendientes (${p.pending.length})</span>
                                        ${p.pending.length === 0 ? `
                                            <span class="text-[10px] text-zinc-600 font-normal italic">Ninguna pendiente</span>
                                        ` : `
                                            <ul class="space-y-1.5 list-disc pl-3 text-zinc-600 font-normal">
                                                ${p.pending.map(t => `<li class="truncate" title="${t.titulo}">${t.titulo}</li>`).join('')}
                                            </ul>
                                        `}
                                    </div>

                                    <!-- Completed Tasks list -->
                                    <div class="space-y-2">
                                        <span class="text-emerald-600 text-[10px] uppercase tracking-wider block">Completadas (${p.completed.length})</span>
                                        ${p.completed.length === 0 ? `
                                            <span class="text-[10px] text-zinc-600 font-normal italic">Ninguna completada</span>
                                        ` : `
                                            <ul class="space-y-1.5 list-disc pl-3 text-zinc-400 font-normal line-through">
                                                ${p.completed.map(t => `<li class="truncate" title="${t.titulo}">${t.titulo}</li>`).join('')}
                                            </ul>
                                        `}
                                    </div>
                                </div>
                            </div>
                        `;
    }).join('')}
                </div>
            `}
        </div>
    `;
}


// --- PÁGINA 16: NOTAS Y ANOTACIONES LIBRES ---
let notasSearchQuery = '';

function renderNotas(container) {
    const notas = getNotas();

    // Filter by search query
    let filtered = [...notas];
    if (notasSearchQuery.trim()) {
        const q = notasSearchQuery.toLowerCase().trim();
        filtered = filtered.filter(n =>
            n.titulo.toLowerCase().includes(q) ||
            n.contenido.toLowerCase().includes(q)
        );
    }

    // Sort by last updated (newest first)
    filtered.sort((a, b) => new Date(b.fechaActualizacion) - new Date(a.fechaActualizacion));

    container.innerHTML = `
        <div class="space-y-6 animate-fadeIn font-sans pb-12">
            <!-- Header bar with search and create button -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-zinc-200 p-4 rounded-2xl shadow-sm">
                <div class="relative flex-1 max-w-md">
                    <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    </span>
                    <input type="text" id="notas-search" value="${notasSearchQuery}" oninput="handleNotasSearch(this.value)" class="w-full bg-zinc-50 border border-zinc-200 focus:border-brand-500 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-zinc-800 text-sm focus:outline-none placeholder-zinc-400 transition" placeholder="Buscar notas por título o contenido...">
                </div>
                <button onclick="openCreateNotaModal()" class="flex items-center justify-center space-x-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-brand-600/15">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                    <span>Nueva Nota</span>
                </button>
            </div>

            <!-- Notes Grid -->
            ${filtered.length === 0 ? `
                <div class="text-center py-16 bg-white border border-zinc-200 rounded-3xl shadow-sm">
                    <svg class="w-12 h-12 text-zinc-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    <p class="text-zinc-500 text-sm font-medium">No se han encontrado notas.</p>
                    ${notas.length === 0 ? `
                        <button onclick="openCreateNotaModal()" class="mt-4 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs rounded-xl transition-all shadow-md shadow-brand-600/10">Crear mi primera nota</button>
                    ` : ''}
                </div>
            ` : `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${filtered.map(n => {
        return `
                            <div class="bg-white border border-zinc-200 p-6 rounded-3xl flex flex-col justify-between shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                                <div class="space-y-3">
                                    <div class="flex items-start justify-between gap-4">
                                        <h5 class="font-extrabold text-zinc-900 text-base md:text-lg leading-tight group-hover:text-brand-600 transition-colors break-words w-full">${n.titulo}</h5>
                                    </div>
                                    <span class="text-[10px] text-zinc-400 font-mono block">Actualizado: ${formatDateTime(n.fechaActualizacion)}</span>
                                    <p class="text-zinc-650 text-sm whitespace-pre-wrap leading-relaxed font-normal break-words">${n.contenido}</p>
                                </div>
                                <div class="border-t border-zinc-100 mt-5 pt-3.5 flex justify-end space-x-2">
                                    <button onclick="openEditNotaModal('${n.id}')" class="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-bold transition flex items-center space-x-1">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                        <span>Editar</span>
                                    </button>
                                    <button onclick="deleteNotaHandler('${n.id}')" class="px-3 py-1.5 bg-white hover:bg-rose-50 border border-zinc-200 hover:border-rose-200 text-zinc-500 hover:text-rose-600 rounded-lg text-xs font-bold transition flex items-center space-x-1">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                        <span>Eliminar</span>
                                    </button>
                                </div>
                            </div>
                        `;
    }).join('')}
                </div>
            `}
        </div>
    `;
}

function handleNotasSearch(value) {
    notasSearchQuery = value;
    renderActiveView();
}

function openCreateNotaModal() {
    const bodyHtml = `
        <form id="create-nota-form" class="space-y-4 font-sans text-xs">
            <div>
                <label class="block font-bold text-zinc-500 mb-1.5" for="n-titulo">Título de la Nota *</label>
                <input type="text" id="n-titulo" required class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 text-sm focus:outline-none placeholder-zinc-400 transition" placeholder="Ej. Lista de la compra, contraseñas...">
            </div>
            <div>
                <label class="block font-bold text-zinc-500 mb-1.5" for="n-contenido">Contenido de la Nota *</label>
                <textarea id="n-contenido" rows="8" required class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 text-sm focus:outline-none placeholder-zinc-400 transition resize-none" placeholder="Escribe aquí los apuntes..."></textarea>
            </div>
        </form>
    `;

    const buttons = [
        {
            text: 'Cancelar',
            class: 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700',
            action: closeModal
        },
        {
            text: 'Crear Nota',
            class: 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/20',
            action: () => {
                const form = document.getElementById('create-nota-form');
                if (!form || !form.reportValidity()) return;

                const titulo = document.getElementById('n-titulo').value.trim();
                const contenido = document.getElementById('n-contenido').value.trim();

                createNota({ titulo, contenido });
                showToast('Nota creada correctamente.');
                closeModal();
                renderActiveView();
            }
        }
    ];

    showModal('Crear Nueva Nota', bodyHtml, buttons);
}

function openEditNotaModal(id) {
    const n = getNotaById(id);
    if (!n) return;

    const bodyHtml = `
        <form id="edit-nota-form" class="space-y-4 font-sans text-xs">
            <div>
                <label class="block font-bold text-zinc-500 mb-1.5" for="en-titulo">Título de la Nota *</label>
                <input type="text" id="en-titulo" value="${n.titulo}" required class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 text-sm focus:outline-none placeholder-zinc-400 transition">
            </div>
            <div>
                <label class="block font-bold text-zinc-500 mb-1.5" for="en-contenido">Contenido de la Nota *</label>
                <textarea id="en-contenido" rows="8" required class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-zinc-800 text-sm focus:outline-none placeholder-zinc-400 transition resize-none">${n.contenido}</textarea>
            </div>
        </form>
    `;

    const buttons = [
        {
            text: 'Cancelar',
            class: 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700',
            action: closeModal
        },
        {
            text: 'Guardar Cambios',
            class: 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/20',
            action: () => {
                const form = document.getElementById('edit-nota-form');
                if (!form || !form.reportValidity()) return;

                const titulo = document.getElementById('en-titulo').value.trim();
                const contenido = document.getElementById('en-contenido').value.trim();

                updateNota(id, { titulo, contenido });
                showToast('Nota actualizada correctamente.');
                closeModal();
                renderActiveView();
            }
        }
    ];

    showModal('Editar Nota', bodyHtml, buttons);
}

function deleteNotaHandler(id) {
    showConfirm(
        'Confirmar eliminación',
        '¿Estás seguro de que quieres borrar esta nota? Esta acción no se puede deshacer.',
        () => {
            deleteNota(id);
            showToast('Nota eliminada correctamente.', 'warning');
            renderActiveView();
        },
        'Eliminar Nota',
        true
    );
}


// --- PÁGINA 14 & 15: AJUSTES Y CONTROL DE DATOS ---
function renderAjustes(container) {
    const personas = getPersonas();
    const viajes = getViajes();
    const tareas = getTareas();
    const textos = getTextosLegales();

    // Calculate approx local storage size
    let storageSizeStr = '0.00 KB';
    try {
        let total = 0;
        for (let x in localStorage) {
            if (localStorage.hasOwnProperty(x)) {
                total += (localStorage[x].length + x.length) * 2; // approximation (UTF-16 characters = 2 bytes)
            }
        }
        storageSizeStr = (total / 1024).toFixed(2) + ' KB';
    } catch (e) {
        storageSizeStr = 'Desconocido';
    }

    const settings = getData(KEYS.ajustes) || {};
    const uExport = settings.ultimaExportacion ? formatDateTime(settings.ultimaExportacion) : 'Nunca';
    const uImport = settings.ultimaImportacion ? formatDateTime(settings.ultimaImportacion) : 'Nunca';

    container.innerHTML = `
        <div class="max-w-4xl mx-auto space-y-8 animate-fadeIn font-sans pb-12">
            <!-- PÁGINA 15: Control de datos stats overview -->
            <div class="bg-white border border-zinc-200 p-6 rounded-2xl space-y-5 shadow-sm">
                <h4 class="font-extrabold text-sm text-brand-600 uppercase tracking-widest border-b border-zinc-100 pb-2">Control de Base de Datos Local</h4>
                
                <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs font-bold">
                    <div class="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                        <span class="block text-zinc-500 text-[10px] uppercase">Personas totales</span>
                        <span class="text-lg font-bold text-zinc-800 mt-1 block">${personas.length}</span>
                    </div>
                    <div class="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                        <span class="block text-zinc-500 text-[10px] uppercase">Viajes totales</span>
                        <span class="text-lg font-bold text-zinc-800 mt-1 block">${viajes.length}</span>
                    </div>
                    <div class="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                        <span class="block text-zinc-500 text-[10px] uppercase">Tareas totales</span>
                        <span class="text-lg font-bold text-zinc-800 mt-1 block">${tareas.length}</span>
                    </div>
                    <div class="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                        <span class="block text-zinc-500 text-[10px] uppercase">Notas totales</span>
                        <span class="text-lg font-bold text-zinc-800 mt-1 block">${getNotas().length}</span>
                    </div>
                    <div class="p-3 bg-zinc-50 rounded-xl border border-zinc-200 col-span-2 md:col-span-1">
                        <span class="block text-zinc-500 text-[10px] uppercase">Peso en LocalStorage</span>
                        <span class="text-lg font-bold text-zinc-800 mt-1 block">${storageSizeStr}</span>
                    </div>
                </div>

                <div class="text-[10.5px] text-zinc-500 font-semibold space-y-1 bg-zinc-50 p-3 rounded-xl border border-zinc-200">
                    <div class="flex justify-between"><span>Última Exportación:</span> <span class="text-zinc-700 font-mono">${uExport}</span></div>
                    <div class="flex justify-between"><span>Última Importación:</span> <span class="text-zinc-700 font-mono">${uImport}</span></div>
                </div>

                <!-- Backup Actions -->
                <div class="flex flex-wrap gap-3 border-t border-zinc-100 pt-4">
                    <button onclick="handleExportData()" class="flex items-center space-x-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-brand-600/10">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        <span>Exportar Copia Seguridad (JSON)</span>
                    </button>

                    <label class="flex items-center space-x-1.5 px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 rounded-xl text-xs font-bold transition cursor-pointer">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                        <span>Importar Copia Seguridad</span>
                        <input type="file" id="import-file-input" accept=".json" onchange="handleImportData(event)" class="hidden">
                    </label>

                    <button onclick="handleResetAllData()" class="flex items-center space-x-1.5 px-4 py-2.5 bg-rose-50 hover:bg-rose-600 hover:text-white border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        <span>Restaurar Base Datos (Reset)</span>
                    </button>
                </div>
            </div>

            <!-- PÁGINA 14: Textos legales editables block -->
            <div class="bg-white border border-zinc-200 p-6 rounded-2xl space-y-4 shadow-sm">
                <h4 class="font-extrabold text-sm text-brand-600 uppercase tracking-widest border-b border-zinc-100 pb-2">Control de Cláusulas y Textos de Consentimiento</h4>
                <p class="text-xs text-zinc-500 -mt-2">Modifica los contratos reguladores de protección de datos y términos de viaje. Estos textos aparecerán en las vistas de los checkboxes de firma.</p>

                <div class="space-y-6">
                    ${textos.map(t => {
        return `
                            <div class="space-y-2">
                                <div class="flex justify-between items-center text-xs">
                                    <span class="font-bold text-zinc-800">${t.titulo}</span>
                                    <span class="text-[10px] text-zinc-500 font-semibold font-mono">Actualizado: ${formatDateTime(t.fechaActualizacion)}</span>
                                </div>
                                <textarea id="settings-legal-txt-${t.id}" rows="6" class="w-full bg-white border border-zinc-200 focus:border-brand-500 rounded-xl p-3 text-xs text-zinc-700 focus:outline-none transition resize-none leading-relaxed">${t.contenido}</textarea>
                                <button onclick="saveSettingsLegalText('${t.id}')" class="px-4 py-2 bg-zinc-100 hover:bg-brand-600 hover:text-white border border-zinc-200 hover:border-transparent text-zinc-700 rounded-xl text-xs font-bold transition shadow-sm">Guardar Cláusula</button>
                            </div>
                        `;
    }).join('<hr class="border-zinc-100 my-4">')}
                </div>
            </div>
        </div>
    `;
}

function saveSettingsLegalText(id) {
    const textarea = document.getElementById(`settings-legal-txt-${id}`);
    if (!textarea) return;

    const content = textarea.value.trim();
    if (!content) {
        showToast('El texto legal no puede quedar completamente vacío.', 'error');
        return;
    }

    const textos = getTextosLegales();
    const index = textos.findIndex(t => t.id === id);
    if (index === -1) return;

    textos[index].contenido = content;
    textos[index].fechaActualizacion = new Date().toISOString();

    if (saveTextosLegales(textos)) {
        showToast('Texto legal de Ajustes actualizado con éxito.');
        renderActiveView(); // reload page to sync lists
    }
}

// Backup Export Handlers
function handleExportData() {
    const jsonStr = exportAllData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_viajedesk_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();

    // cleanup
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const settings = getData(KEYS.ajustes) || {};
    settings.ultimaExportacion = new Date().toISOString();
    setData(KEYS.ajustes, settings);

    showToast('¡Copia de seguridad descargada correctamente!');
    renderActiveView(); // Refresh dates
}

// Backup Import Handlers
function handleImportData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const content = e.target.result;

        showConfirm(
            'Confirmar Importación',
            '¿Estás seguro de que quieres importar esta copia de seguridad? Se reemplazarán todos los viajes, personas, tareas y textos legales de la base de datos actual.',
            () => {
                const success = importAllData(content);
                if (success) {
                    showToast('Copia de seguridad importada con éxito.');
                    showPage('inicio'); // Go back to start
                } else {
                    showToast('Error al importar. El archivo JSON no tiene una estructura compatible.', 'error');
                }
            },
            'Reemplazar e Importar'
        );

        // Reset file input value to allow re-trigger same file
        document.getElementById('import-file-input').value = '';
    };
    reader.readAsText(file);
}

function handleResetAllData() {
    // Pedimos confirmación fuerte (escribir BORRAR)
    const bodyHtml = `
        <div class="space-y-3 font-sans text-xs">
            <p class="text-zinc-600 font-normal leading-relaxed">Esta acción borrará irreversiblemente todos los pasajeros, itinerarios, transportes, billetes y tareas del almacenamiento local de este dispositivo.</p>
            <p class="text-zinc-700 font-bold">Escribe la palabra <span class="text-rose-600">BORRAR</span> a continuación para continuar:</p>
            <input type="text" id="confirm-reset-txt" class="w-full bg-white border border-zinc-200 focus:border-rose-500 rounded-xl px-4 py-2.5 text-zinc-800 text-sm focus:outline-none placeholder-zinc-400 transition" placeholder="Escribe BORRAR aquí...">
        </div>
    `;

    const buttons = [
        {
            text: 'Cancelar',
            class: 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700',
            action: closeModal
        },
        {
            text: 'BORRAR BASE DATOS',
            class: 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/10',
            action: () => {
                const inputVal = document.getElementById('confirm-reset-txt').value.trim();
                if (inputVal === 'BORRAR') {
                    resetAllData();
                    showToast('Base de datos restablecida correctamente.', 'warning');
                    closeModal();
                    showPage('inicio');
                } else {
                    showToast('Confirmación incorrecta. No se han borrado datos.', 'error');
                }
            }
        }
    ];

    showModal('Restablecimiento General de Base de Datos', bodyHtml, buttons);
}


// ==========================================
// 7. INITIALIZATION HANDLER
// ==========================================
window.onload = function () {
    // Initialize DB elements if empty
    initDefaultData();

    // Start mobile headers menu toggle callbacks
    initMobileMenu();

    // Start default routing
    // Clean initial history
    navigationHistory = [];
    showPage('inicio', {}, false);
};
