/**
 * ===============================================
 * APP.JS - FUNCIONALIDAD PRINCIPAL DE LA APLICACIÓN
 * ===============================================
 * Este archivo maneja toda la lógica del frontend:
 * - Carga y renderizado de proyectos
 * - Búsqueda en tiempo real
 * - Interacciones del usuario
 * - Tooltips y efectos visuales
 * - Manejo de estados y errores
 * ===============================================
 */

/**
 * CONFIGURACIÓN Y VARIABLES GLOBALES
 */
const APP_CONFIG = {
    searchDelay: 300,        // Delay para búsqueda en tiempo real (ms)
    animationDuration: 300,  // Duración de animaciones (ms)
    tooltipDelay: 500,       // Delay para mostrar tooltips (ms)
    retryAttempts: 3,        // Intentos de reconexión a la API
    useMockData: true,       // ← AGREGAR COMA AQUÍ
};

/**
 * ESTADO GLOBAL DE LA APLICACIÓN
 */
let appState = {
    projects: {
        active: [],
        completed: []
    },
    currentSearch: '',
    isLoading: false,
    apiConnected: false,
    lastUpdate: null
};

/**
 * ELEMENTOS DEL DOM
 */
let domElements = {};

/**
 * INICIALIZACIÓN DE LA APLICACIÓN
 */
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Iniciando Sistema de Gestión de Tareas...');
    
    // Inicializar elementos del DOM
    initializeDOMElements();
    
    // Configurar event listeners
    setupEventListeners();
    
    // Inicializar tooltips de Bootstrap
    initializeTooltips();
    
    // Cargar datos iniciales
    await loadInitialData();
    
    // Mostrar mensaje de bienvenida
    showToast('Sistema cargado correctamente', 'success');
    
    console.log('✅ Aplicación inicializada correctamente');
});

/**
 * INICIALIZAR REFERENCIAS A ELEMENTOS DEL DOM
 */
function initializeDOMElements() {
    domElements = {
        // Búsqueda
        searchInput: document.getElementById('searchInput'),
        
        // Botones principales
        createProjectBtn: document.getElementById('createProjectBtn'),
        createFirstProject: document.getElementById('createFirstProject'),
        
        // Contenedores de proyectos
        activeProjectsContainer: document.getElementById('activeProjectsContainer'),
        completedProjectsContainer: document.getElementById('completedProjectsContainer'),
        
        // Estados de carga
        activeLoading: document.getElementById('activeLoading'),
        completedLoading: document.getElementById('completedLoading'),
        
        // Mensajes vacíos
        noActiveProjects: document.getElementById('noActiveProjects'),
        noCompletedProjects: document.getElementById('noCompletedProjects'),
        noSearchResults: document.getElementById('noSearchResults'),
        
        // Toast
        mainToast: document.getElementById('mainToast'),
        toastMessage: document.getElementById('toastMessage')
    };
    
    console.log('📱 Elementos del DOM inicializados');
}

/**
 * CONFIGURAR EVENT LISTENERS
 */
function setupEventListeners() {
    // Búsqueda en tiempo real
    if (domElements.searchInput) {
        let searchTimeout;
        domElements.searchInput.addEventListener('input', function(e) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                handleSearch(e.target.value.trim());
            }, APP_CONFIG.searchDelay);
        });
    }
    
    // Botón crear proyecto
    if (domElements.createProjectBtn) {
        domElements.createProjectBtn.addEventListener('click', handleCreateProject);
    }
    
    // Botón crear primer proyecto
    if (domElements.createFirstProject) {
        domElements.createFirstProject.addEventListener('click', handleCreateProject);
    }
    
    // Limpiar búsqueda con Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && domElements.searchInput) {
            domElements.searchInput.value = '';
            handleSearch('');
        }
    });
    
    console.log('🎯 Event listeners configurados');
}

/**
 * INICIALIZAR TOOLTIPS DE BOOTSTRAP
 */
function initializeTooltips() {
    // Inicializar todos los tooltips existentes
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function(tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl, {
            delay: { show: APP_CONFIG.tooltipDelay, hide: 100 },
            boundary: 'viewport'
        });
    });
    
    console.log('💡 Tooltips inicializados');
}

/**
 * CARGAR DATOS INICIALES DE LA APLICACIÓN
 */
async function loadInitialData() {
    console.log('📊 Cargando datos iniciales...');
    
    // Mostrar indicadores de carga
    showLoadingState(true);
    
    try {
        // Intentar conectar con la API real
        if (!APP_CONFIG.useMockData) {
            const response = await projectAPI.getAllProjects();
            
            if (response.success) {
                appState.apiConnected = true;
                await processProjectsData(response.data);
                console.log('✅ Datos cargados desde API');
            } else {
                throw new Error('API no disponible');
            }
        } else {
            // Usar datos mock para desarrollo
            console.log('🔧 Modo desarrollo: usando datos mock');
            await loadMockData();
        }
        
    } catch (error) {
        console.warn('⚠️ Error al cargar desde API, usando datos mock:', error);
        await loadMockData();
    } finally {
        showLoadingState(false);
        appState.lastUpdate = new Date();
    }
}

/**
 * CARGAR DATOS MOCK PARA DESARROLLO
 */
async function loadMockData() {
    const mockResponse = await mockApiResponse(MOCK_DATA.projects, 800);
    await processProjectsData(mockResponse.data);
    appState.apiConnected = false;
    console.log('🎭 Datos mock cargados');
}

/**
 * PROCESAR Y ORGANIZAR DATOS DE PROYECTOS
 */
async function processProjectsData(projects) {
    // Validar y filtrar proyectos
    const validProjects = projects.filter(project => {
        if (!validateProjectData(project)) {
            console.warn('Proyecto con datos inválidos:', project);
            return false;
        }
        return true;
    });
    
    // Separar proyectos por estado
    appState.projects.active = validProjects.filter(p => p.status === 'en_proceso');
    appState.projects.completed = validProjects.filter(p => p.status === 'terminado');
    
    // Ordenar proyectos
    appState.projects.active.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    appState.projects.completed.sort((a, b) => new Date(b.endDate) - new Date(a.endDate));
    
    // Renderizar proyectos
    await renderProjects();
    
    console.log(`📋 Procesados: ${appState.projects.active.length} activos, ${appState.projects.completed.length} completados`);
}

/**
 * RENDERIZAR TODOS LOS PROYECTOS
 */
async function renderProjects() {
    await Promise.all([
        renderActiveProjects(),
        renderCompletedProjects()
    ]);
}

/**
 * RENDERIZAR PROYECTOS ACTIVOS
 */
async function renderActiveProjects() {
    const container = domElements.activeProjectsContainer;
    const noProjectsMessage = domElements.noActiveProjects;
    
    if (!container) return;
    
    // Limpiar contenedor
    container.innerHTML = '';
    
    // Filtrar proyectos según búsqueda actual
    const filteredProjects = filterProjectsBySearch(appState.projects.active, appState.currentSearch);
    
    if (filteredProjects.length === 0) {
        // Mostrar mensaje apropiado
        if (appState.currentSearch) {
            showNoSearchResults(true);
            hideElement(noProjectsMessage);
        } else {
            showNoSearchResults(false);
            showElement(noProjectsMessage);
        }
        return;
    }
    
    // Ocultar mensajes
    hideElement(noProjectsMessage);
    showNoSearchResults(false);
    
    // Renderizar cada proyecto
    filteredProjects.forEach((project, index) => {
        const projectCard = createActiveProjectCard(project);
        container.appendChild(projectCard);
        
        // Animación de entrada escalonada
        setTimeout(() => {
            projectCard.classList.add('fade-in');
        }, index * 50);
    });
    
    // Reinicializar tooltips
    initializeTooltips();
}

/**
 * RENDERIZAR PROYECTOS COMPLETADOS
 */
async function renderCompletedProjects() {
    const container = domElements.completedProjectsContainer;
    const noProjectsMessage = domElements.noCompletedProjects;
    
    if (!container) return;
    
    // Limpiar contenedor
    container.innerHTML = '';
    
    // Filtrar proyectos según búsqueda actual
    const filteredProjects = filterProjectsBySearch(appState.projects.completed, appState.currentSearch);
    
    if (filteredProjects.length === 0) {
        showElement(noProjectsMessage);
        return;
    }
    
    hideElement(noProjectsMessage);
    
    // Renderizar cada proyecto
    filteredProjects.forEach((project, index) => {
        const projectCard = createCompletedProjectCard(project);
        container.appendChild(projectCard);
        
        // Animación de entrada
        setTimeout(() => {
            projectCard.classList.add('fade-in');
        }, index * 30);
    });
}

/**
 * CREAR TARJETA DE PROYECTO ACTIVO
 */
function createActiveProjectCard(project) {
    const card = document.createElement('div');
    card.className = 'active-project-card';
    card.dataset.projectId = project.id;
    
    // Calcular días restantes
    const daysRemaining = calculateDaysRemaining(project.endDate);
    const daysRemainingText = getDaysRemainingText(daysRemaining);
    
    // Generar HTML de usuarios
    const usersHTML = generateUsersHTML(project.users);
    
    // Crear descripción destacada para búsqueda
    const highlightedName = highlightSearchTerm(project.name, appState.currentSearch);
    const highlightedDescription = highlightSearchTerm(project.description, appState.currentSearch);
    
    card.innerHTML = `
        <div class="project-header">
            <h4 class="project-name" 
                data-bs-toggle="tooltip" 
                data-bs-placement="top" 
                title="${escapeHtml(project.description)}">
                ${highlightedName}
            </h4>
            <span class="project-id badge bg-secondary">${project.id}</span>
        </div>
        
        <div class="project-dates">
            <div class="date-item">
                <span class="date-label">Inicio</span>
                <span class="date-value">${formatDate(project.startDate)}</span>
            </div>
            <div class="date-item">
                <span class="date-label">Finalización</span>
                <span class="date-value">${formatDate(project.endDate)}</span>
            </div>
            <div class="date-item ${getDaysRemainingClass(daysRemaining)}">
                <span class="date-label">Restantes</span>
                <span class="date-value">${daysRemainingText}</span>
            </div>
        </div>
        
        <div class="project-users">
            <div class="users-label">
                <i class="bi bi-people-fill me-1"></i>
                Equipo (${project.users?.length || 0})
            </div>
            <div class="users-list">
                ${usersHTML}
            </div>
        </div>
        
        <div class="project-description mt-2">
            <small class="text-muted">${highlightedDescription}</small>
        </div>
    `;
    
    // Agregar event listener para click
    card.addEventListener('click', () => handleProjectClick(project));
    
    return card;
}

/**
 * CREAR TARJETA DE PROYECTO COMPLETADO
 */
function createCompletedProjectCard(project) {
    const card = document.createElement('div');
    card.className = 'completed-project-card';
    card.dataset.projectId = project.id;
    
    const highlightedName = highlightSearchTerm(project.name, appState.currentSearch);
    
    card.innerHTML = `
        <div class="completed-project-name">${highlightedName}</div>
        <div class="completed-project-id">ID: ${project.id}</div>
        <div class="mt-1">
            <small class="text-success">
                <i class="bi bi-check-circle me-1"></i>
                Finalizado: ${formatDate(project.endDate)}
            </small>
        </div>
    `;
    
    // Agregar event listener para click
    card.addEventListener('click', () => handleCompletedProjectClick(project));
    
    return card;
}

/**
 * GENERAR HTML PARA MOSTRAR USUARIOS DEL PROYECTO
 */
function generateUsersHTML(users) {
    if (!users || users.length === 0) {
        return '<span class="text-muted small">Sin usuarios asignados</span>';
    }
    
    return users.map(user => `
        <div class="user-avatar">
            <img src="${user.profileImage || 'https://via.placeholder.com/35x35/61534D/FFFFFF?text=' + (user.name?.charAt(0) || 'U')}" 
                 alt="${escapeHtml(user.name || 'Usuario')}"
                 class="user-image"
                 data-bs-toggle="tooltip"
                 data-bs-placement="top"
                 title="${escapeHtml(user.name || 'Usuario sin nombre')}"
                 onerror="this.src='https://via.placeholder.com/35x35/61534D/FFFFFF?text=${user.name?.charAt(0) || 'U'}'">
        </div>
    `).join('');
}

/**
 * FILTRAR PROYECTOS POR TÉRMINO DE BÚSQUEDA
 */
function filterProjectsBySearch(projects, searchTerm) {
    if (!searchTerm) return projects;
    
    const term = searchTerm.toLowerCase();
    
    return projects.filter(project => {
        return project.name.toLowerCase().includes(term) ||
               project.id.toLowerCase().includes(term) ||
               (project.description && project.description.toLowerCase().includes(term));
    });
}

/**
 * DESTACAR TÉRMINO DE BÚSQUEDA EN TEXTO
 */
function highlightSearchTerm(text, searchTerm) {
    if (!text || !searchTerm) return escapeHtml(text);
    
    const escapedText = escapeHtml(text);
    const escapedTerm = escapeHtml(searchTerm);
    const regex = new RegExp(`(${escapedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    
    return escapedText.replace(regex, '<span class="search-highlight">$1</span>');
}

/**
 * OBTENER TEXTO PARA DÍAS RESTANTES
 */
function getDaysRemainingText(days) {
    if (days === null) return 'N/A';
    if (days > 0) return `${days} días`;
    if (days === 0) return 'Hoy';
    return `${Math.abs(days)} días atrás`;
}

/**
 * OBTENER CLASE CSS PARA DÍAS RESTANTES
 */
function getDaysRemainingClass(days) {
    if (days === null) return '';
    if (days < 0) return 'text-danger';
    if (days <= 7) return 'text-warning';
    return 'text-success';
}

/**
 * MANEJAR BÚSQUEDA EN TIEMPO REAL
 */
async function handleSearch(searchTerm) {
    console.log(`🔍 Búsqueda: "${searchTerm}"`);
    
    appState.currentSearch = searchTerm;
    
    // Si hay término de búsqueda, buscar en API (futuro)
    if (searchTerm && appState.apiConnected) {
        try {
            const response = await projectAPI.searchProjects(searchTerm);
            if (response.success) {
                await processProjectsData(response.data);
                return;
            }
        } catch (error) {
            console.warn('Error en búsqueda API:', error);
        }
    }
    
    // Filtrar proyectos localmente
    await renderProjects();
}

/**
 * MANEJAR CLICK EN PROYECTO ACTIVO
 */
function handleProjectClick(project) {
    console.log('🔗 Click en proyecto activo:', project.id);
    
    // Aquí se implementará la navegación al detalle del proyecto
    showToast(`Abriendo proyecto: ${project.name}`, 'info');
    
    // TODO: Implementar navegación SPA o modal de detalle
    // window.location.hash = `#/project/${project.id}`;
}

/**
 * MANEJAR CLICK EN PROYECTO COMPLETADO
 */
function handleCompletedProjectClick(project) {
    console.log('🏁 Click en proyecto completado:', project.id);
    
    showToast(`Abriendo proyecto completado: ${project.name}`, 'info');
    
    // TODO: Implementar navegación a vista de solo lectura
    // window.location.hash = `#/project/${project.id}/readonly`;
}

/**
 * MANEJAR CREACIÓN DE NUEVO PROYECTO
 */
function handleCreateProject() {
    console.log('➕ Crear nuevo proyecto');
    
    // Mostrar modal de creación (placeholder)
    const modal = new bootstrap.Modal(document.getElementById('projectModal'));
    modal.show();
    
    // TODO: Implementar formulario de creación real
    showToast('Modal de creación en desarrollo', 'warning');
}

/**
 * MOSTRAR/OCULTAR ESTADOS DE CARGA
 */
function showLoadingState(show) {
    const elements = [domElements.activeLoading, domElements.completedLoading];
    
    elements.forEach(element => {
        if (element) {
            if (show) {
                showElement(element);
            } else {
                hideElement(element);
            }
        }
    });
    
    appState.isLoading = show;
}

/**
 * MOSTRAR/OCULTAR MENSAJE DE SIN RESULTADOS DE BÚSQUEDA
 */
function showNoSearchResults(show) {
    const element = domElements.noSearchResults;
    if (element) {
        if (show) {
            showElement(element);
        } else {
            hideElement(element);
        }
    }
}

/**
 * MOSTRAR ELEMENTO CON ANIMACIÓN
 */
function showElement(element) {
    if (element) {
        element.classList.remove('d-none');
        setTimeout(() => element.classList.add('fade-in'), 10);
    }
}

/**
 * OCULTAR ELEMENTO
 */
function hideElement(element) {
    if (element) {
        element.classList.add('d-none');
        element.classList.remove('fade-in');
    }
}

/**
 * MOSTRAR NOTIFICACIÓN TOAST
 */
function showToast(message, type = 'info') {
    const toast = domElements.mainToast;
    const toastMessage = domElements.toastMessage;
    
    if (!toast || !toastMessage) return;
    
    // Configurar mensaje y estilo
    toastMessage.textContent = message;
    
    // Remover clases anteriores
    toast.classList.remove('text-bg-success', 'text-bg-danger', 'text-bg-warning', 'text-bg-info');
    
    // Agregar clase según tipo
    switch(type) {
        case 'success':
            toast.classList.add('text-bg-success');
            break;
        case 'error':
        case 'danger':
            toast.classList.add('text-bg-danger');
            break;
        case 'warning':
            toast.classList.add('text-bg-warning');
            break;
        default:
            toast.classList.add('text-bg-info');
    }
    
    // Mostrar toast
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    
    console.log(`📢 Toast ${type}: ${message}`);
}

/**
 * REFRESCAR DATOS DE LA APLICACIÓN
 */
async function refreshData() {
    console.log('🔄 Refrescando datos...');
    
    showToast('Actualizando datos...', 'info');
    
    try {
        await loadInitialData();
        showToast('Datos actualizados correctamente', 'success');
    } catch (error) {
        console.error('Error al refrescar datos:', error);
        showToast('Error al actualizar datos', 'error');
    }
}

/**
 * MANEJAR ERRORES DE CONEXIÓN
 */
function handleConnectionError(error) {
    console.error('❌ Error de conexión:', error);
    
    appState.apiConnected = false;
    
    // Mostrar indicador de estado de conexión
    showConnectionStatus('disconnected');
    
    // Mostrar toast de error
    showToast('Conexión perdida. Usando datos locales.', 'warning');
}

/**
 * MOSTRAR ESTADO DE CONEXIÓN
 */
function showConnectionStatus(status) {
    // Remover indicador anterior si existe
    const existingStatus = document.querySelector('.connection-status');
    if (existingStatus) {
        existingStatus.remove();
    }
    
    // Crear nuevo indicador
    const statusElement = document.createElement('div');
    statusElement.className = `connection-status ${status}`;
    
    let statusText = '';
    let statusIcon = '';
    
    switch(status) {
        case 'connected':
            statusText = 'Conectado';
            statusIcon = 'bi-wifi';
            break;
        case 'disconnected':
            statusText = 'Sin conexión';
            statusIcon = 'bi-wifi-off';
            break;
        case 'connecting':
            statusText = 'Conectando...';
            statusIcon = 'bi-arrow-repeat';
            break;
    }
    
    statusElement.innerHTML = `<i class="bi ${statusIcon} me-1"></i>${statusText}`;
    document.body.appendChild(statusElement);
    
    // Auto-ocultar después de 3 segundos si está conectado
    if (status === 'connected') {
        setTimeout(() => {
            if (statusElement.parentNode) {
                statusElement.remove();
            }
        }, 3000);
    }
}

/**
 * VALIDAR CONECTIVIDAD CON EL SERVIDOR
 */
async function checkConnectivity() {
    try {
        const response = await fetch(`${projectAPI.baseURL}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
            appState.apiConnected = true;
            showConnectionStatus('connected');
            return true;
        }
    } catch (error) {
        console.warn('Servidor no disponible:', error);
    }
    
    appState.apiConnected = false;
    showConnectionStatus('disconnected');
    return false;
}

/**
 * CONFIGURAR VERIFICACIÓN PERIÓDICA DE CONECTIVIDAD
 */
function setupConnectivityCheck() {
    // Verificar cada 30 segundos
    setInterval(async () => {
        if (!appState.apiConnected) {
            console.log('🔄 Verificando reconexión...');
            const isConnected = await checkConnectivity();
            
            if (isConnected) {
                showToast('Conexión restaurada', 'success');
                await refreshData();
            }
        }
    }, 30000);
}

/**
 * MANEJAR EVENTOS DE TECLADO GLOBALES
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + K para enfocar búsqueda
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (domElements.searchInput) {
                domElements.searchInput.focus();
                domElements.searchInput.select();
            }
        }
        
        // F5 para refrescar (prevenir default y usar nuestro refresh)
        if (e.key === 'F5') {
            e.preventDefault();
            refreshData();
        }
        
        // Ctrl/Cmd + N para nuevo proyecto
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            handleCreateProject();
        }
    });
    
    console.log('⌨️ Atajos de teclado configurados');
}

/**
 * MANEJAR REDIMENSIONAMIENTO DE VENTANA
 */
function setupWindowResize() {
    let resizeTimeout;
    
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Reinicializar tooltips después de redimensionar
            initializeTooltips();
            console.log('🔄 Tooltips reinicializados después de resize');
        }, 250);
    });
}

/**
 * CONFIGURAR LAZY LOADING PARA IMÁGENES
 */
function setupLazyLoading() {
    // Configurar intersection observer para lazy loading de avatares
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        observer.unobserve(img);
                    }
                }
            });
        });
        
        // Observar imágenes cuando se agregan
        const observeImages = () => {
            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        };
        
        // Configurar observer para cambios en el DOM
        const mutationObserver = new MutationObserver(() => {
            observeImages();
        });
        
        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        console.log('🖼️ Lazy loading configurado');
    }
}

/**
 * FUNCIONES DE UTILIDAD PARA DEBUGGING
 */
window.debugApp = {
    // Obtener estado actual
    getState: () => appState,
    
    // Forzar recarga
    reload: refreshData,
    
    // Simular error de conexión
    simulateError: () => handleConnectionError(new Error('Error simulado')),
    
    // Cambiar a datos mock
    useMock: () => {
        APP_CONFIG.useMockData = true;
        refreshData();
    },
    
    // Intentar conexión real
    useAPI: () => {
        APP_CONFIG.useMockData = false;
        refreshData();
    },
    
    // Mostrar toast de prueba
    testToast: (message = 'Toast de prueba', type = 'info') => showToast(message, type)
};

/**
 * INICIALIZACIÓN ADICIONAL DESPUÉS DE CARGA COMPLETA
 */
window.addEventListener('load', function() {
    // Configurar verificación de conectividad
    setupConnectivityCheck();
    
    // Configurar atajos de teclado
    setupKeyboardShortcuts();
    
    // Configurar redimensionamiento
    setupWindowResize();
    
    // Configurar lazy loading
    setupLazyLoading();
    
    // Verificar conectividad inicial
    setTimeout(checkConnectivity, 1000);
    
    console.log('🔧 Configuraciones adicionales completadas');
});

/**
 * MANEJAR ERRORES GLOBALES
 */
window.addEventListener('error', function(e) {
    console.error('💥 Error global capturado:', e.error);
    showToast('Ha ocurrido un error inesperado', 'error');
});

/**
 * MANEJAR PROMESAS RECHAZADAS
 */
window.addEventListener('unhandledrejection', function(e) {
    console.error('💥 Promesa rechazada:', e.reason);
    showToast('Error en operación asíncrona', 'error');
});

/**
 * FUNCIONES EXPORTADAS PARA USO EXTERNO
 */
window.appUtils = {
    showToast,
    refreshData,
    handleSearch,
    showLoadingState,
    formatDate,
    escapeHtml
};

console.log('📚 App.js cargado completamente');

/**
 * ===============================================
 * NOTAS PARA EL COMPAÑERO ERICK O EMILIO
 * ===============================================
 * 
 * ENDPOINTS NECESARIOS:
 * 1. GET /api/projects - Obtener todos los proyectos
 * 2. GET /api/projects?status=en_proceso - Filtrar por estado
 * 3. GET /api/projects/search?q=termino - Búsqueda
 * 4. GET /api/projects/:id - Proyecto específico
 * 5. POST /api/projects - Crear proyecto
 * 6. PUT /api/projects/:id - Actualizar proyecto
 * 7. DELETE /api/projects/:id - Eliminar proyecto
 * 8. GET /api/health - Verificar estado del servidor
 * 
 * ESTRUCTURA DE DATOS ESPERADA:
 * {
 *   id: string,
 *   name: string,
 *   startDate: string (ISO),
 *   endDate: string (ISO),
 *   description: string,
 *   status: 'en_proceso' | 'terminado',
 *   users: [
 *     {
 *       id: string,
 *       name: string,
 *       profileImage: string (URL)
 *     }
 *   ]
 * }
 * 
 * FORMATO DE RESPUESTA:
 * {
 *   success: boolean,
 *   data: any,
 *   message?: string,
 *   error?: string
 * }
 * ===============================================
 */