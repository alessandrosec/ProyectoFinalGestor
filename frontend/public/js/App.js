/**
 * ===============================================
 * APP.JS - FUNCIONALIDAD PRINCIPAL MEJORADA
 * ===============================================
 * MEJORAS APLICADAS:
 * 1. Mejor manejo de estados y errores
 * 2. Búsqueda avanzada con filtros
 * 3. Gestión de caché inteligente
 * 4. Indicadores de progreso mejorados
 * 5. Interfaz más responsiva y fluida
 * 6. Funciones de debug y monitoreo
 * ===============================================
 */

/**
 * CONFIGURACIÓN Y VARIABLES GLOBALES MEJORADAS
 */
const APP_CONFIG = {
    searchDelay: 300,           // Delay para búsqueda en tiempo real (ms)
    animationDuration: 300,     // Duración de animaciones (ms)
    tooltipDelay: 500,          // Delay para mostrar tooltips (ms)
    retryAttempts: 3,           // Intentos de reconexión a la API
    useMockData: true,          // Usar datos mock si la API no está disponible
    cacheRefreshInterval: 30000, // Refrescar caché cada 30 segundos
    maxSearchHistory: 10,       // Máximo de búsquedas recordadas
    autoSaveInterval: 60000,    // Auto-guardar estado cada minuto
    debugMode: false            // Modo debug para desarrollo
};

/**
 * ESTADO GLOBAL DE LA APLICACIÓN MEJORADO
 */
let appState = {
    // Datos de proyectos
    projects: {
        active: [],
        completed: [],
        filtered: {
            active: [],
            completed: []
        }
    },
    
    // Estado de búsqueda
    search: {
        currentTerm: '',
        history: [],
        filters: {
            priority: 'all',
            dateRange: 'all',
            userFilter: 'all'
        }
    },
    
    // Estado de la aplicación
    ui: {
        isLoading: false,
        apiConnected: false,
        showAdvancedSearch: false,
        selectedProject: null,
        viewMode: 'cards' // 'cards' o 'list'
    },
    
    // Estadísticas
    stats: {
        totalProjects: 0,
        activeProjects: 0,
        completedProjects: 0,
        overdueProjects: 0,
        lastUpdate: null
    },
    
    // Cache y performance
    cache: {
        lastRefresh: null,
        version: '1.0'
    }
};

/**
 * ELEMENTOS DEL DOM MEJORADOS
 */
let domElements = {};

/**
 * INICIALIZACIÓN DE LA APLICACIÓN MEJORADA
 */
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Iniciando Sistema de Gestión de Tareas Mejorado...');
    
    try {
        // Mostrar splash screen o indicador de carga
        showInitialLoader(true);
        
        // Inicializar elementos del DOM
        await initializeDOMElements();
        
        // Cargar configuración guardada
        loadUserPreferences();
        
        // Configurar event listeners
        setupEventListeners();
        
        // Inicializar tooltips de Bootstrap
        initializeTooltips();
        
        // Configurar funciones avanzadas
        setupAdvancedFeatures();
        
        // Cargar datos iniciales
        await loadInitialData();
        
        // Inicializar intervalos automáticos
        setupAutoRefresh();
        
        // Ocultar loader inicial
        showInitialLoader(false);
        
        // Mostrar mensaje de bienvenida
        showToast('✅ Sistema cargado correctamente', 'success');
        
        console.log('✅ Aplicación inicializada correctamente');
        
    } catch (error) {
        console.error('💥 Error crítico al inicializar:', error);
        showCriticalError(error);
    }
});

/**
 * MOSTRAR/OCULTAR LOADER INICIAL
 */
function showInitialLoader(show) {
    const existingLoader = document.getElementById('initialLoader');
    
    if (show && !existingLoader) {
        const loader = document.createElement('div');
        loader.id = 'initialLoader';
        loader.className = 'position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center';
        loader.style.backgroundColor = 'rgba(255,255,255,0.9)';
        loader.style.zIndex = '9999';
        loader.innerHTML = `
            <div class="text-center">
                <div class="spinner-border text-primary mb-3" style="width: 3rem; height: 3rem;"></div>
                <h5>Cargando Sistema de Gestión...</h5>
                <p class="text-muted">Preparando interfaz y datos...</p>
            </div>
        `;
        document.body.appendChild(loader);
    } else if (!show && existingLoader) {
        existingLoader.remove();
    }
}

/**
 * INICIALIZAR REFERENCIAS A ELEMENTOS DEL DOM MEJORADO
 */
async function initializeDOMElements() {
    domElements = {
        // Búsqueda y filtros
        searchInput: document.getElementById('searchInput'),
        searchHistory: document.getElementById('searchHistory'),
        advancedSearchBtn: document.getElementById('advancedSearchBtn'),
        filtersContainer: document.getElementById('filtersContainer'),
        
        // Botones principales
        createProjectBtn: document.getElementById('createProjectBtn'),
        createFirstProject: document.getElementById('createFirstProject'),
        refreshBtn: document.getElementById('refreshBtn'),
        viewModeToggle: document.getElementById('viewModeToggle'),
        
        // Contenedores de proyectos
        activeProjectsContainer: document.getElementById('activeProjectsContainer'),
        completedProjectsContainer: document.getElementById('completedProjectsContainer'),
        
        // Estados de carga
        activeLoading: document.getElementById('activeLoading'),
        completedLoading: document.getElementById('completedLoading'),
        
        // Mensajes
        noActiveProjects: document.getElementById('noActiveProjects'),
        noCompletedProjects: document.getElementById('noCompletedProjects'),
        noSearchResults: document.getElementById('noSearchResults'),
        
        // Notificaciones
        mainToast: document.getElementById('mainToast'),
        toastMessage: document.getElementById('toastMessage'),
        
        // Estadísticas
        statsContainer: document.getElementById('statsContainer'),
        connectionStatus: document.getElementById('connectionStatus')
    };
    
    console.log('📱 Elementos del DOM inicializados');
    
    // Verificar elementos críticos
    const criticalElements = ['searchInput', 'activeProjectsContainer', 'completedProjectsContainer'];
    const missingElements = criticalElements.filter(id => !domElements[id]);
    
    if (missingElements.length > 0) {
        console.warn('⚠️ Elementos DOM faltantes:', missingElements);
    }
}

/**
 * CARGAR PREFERENCIAS DEL USUARIO
 */
function loadUserPreferences() {
    try {
        const savedPrefs = localStorage.getItem('taskManager_preferences');
        if (savedPrefs) {
            const prefs = JSON.parse(savedPrefs);
            
            // Aplicar configuraciones guardadas
            if (prefs.viewMode) {
                appState.ui.viewMode = prefs.viewMode;
            }
            
            if (prefs.searchHistory) {
                appState.search.history = prefs.searchHistory.slice(0, APP_CONFIG.maxSearchHistory);
            }
            
            console.log('⚙️ Preferencias de usuario cargadas');
        }
    } catch (error) {
        console.warn('⚠️ Error al cargar preferencias:', error);
    }
}

/**
 * GUARDAR PREFERENCIAS DEL USUARIO
 */
function saveUserPreferences() {
    try {
        const prefs = {
            viewMode: appState.ui.viewMode,
            searchHistory: appState.search.history,
            lastSaved: new Date().toISOString()
        };
        
        localStorage.setItem('taskManager_preferences', JSON.stringify(prefs));
        console.log('💾 Preferencias guardadas');
    } catch (error) {
        console.warn('⚠️ Error al guardar preferencias:', error);
    }
}

/**
 * CONFIGURAR EVENT LISTENERS MEJORADOS
 */
function setupEventListeners() {
    // Búsqueda en tiempo real mejorada
    if (domElements.searchInput) {
        let searchTimeout;
        
        domElements.searchInput.addEventListener('input', function(e) {
            clearTimeout(searchTimeout);
            const term = e.target.value.trim();
            
            searchTimeout = setTimeout(() => {
                handleAdvancedSearch(term);
            }, APP_CONFIG.searchDelay);
        });
        
        // Autocompletar búsqueda
        domElements.searchInput.addEventListener('focus', function() {
            showSearchHistory();
        });
        
        domElements.searchInput.addEventListener('blur', function() {
            setTimeout(() => hideSearchHistory(), 200);
        });
    }
    
    // Botones principales
    if (domElements.createProjectBtn) {
        domElements.createProjectBtn.addEventListener('click', handleCreateProject);
    }
    
    if (domElements.createFirstProject) {
        domElements.createFirstProject.addEventListener('click', handleCreateProject);
    }
    
    if (domElements.refreshBtn) {
        domElements.refreshBtn.addEventListener('click', handleManualRefresh);
    }
    
    // Atajos de teclado mejorados
    document.addEventListener('keydown', function(e) {
        handleKeyboardShortcuts(e);
    });
    
    // Eventos de ventana
    window.addEventListener('beforeunload', function() {
        saveUserPreferences();
    });
    
    // Detectar cambios de visibilidad de la página
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
            checkForUpdates();
        }
    });
    
    console.log('🎯 Event listeners mejorados configurados');
}

/**
 * MANEJAR ATAJOS DE TECLADO
 */
function handleKeyboardShortcuts(e) {
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
        handleManualRefresh();
    }
    
    // Ctrl/Cmd + N para nuevo proyecto
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handleCreateProject();
    }
    
    // Escape para limpiar búsqueda y cerrar modales
    if (e.key === 'Escape') {
        if (domElements.searchInput && domElements.searchInput.value) {
            domElements.searchInput.value = '';
            handleAdvancedSearch('');
        }
        hideSearchHistory();
    }
    
    // Ctrl/Cmd + D para modo debug
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        toggleDebugMode();
    }
}

/**
 * CONFIGURAR FUNCIONES AVANZADAS
 */
function setupAdvancedFeatures() {
    // Configurar intersection observer para lazy loading
    setupLazyLoading();
    
    // Configurar resize handler
    setupWindowResize();
    
    // Configurar detección de red
    setupNetworkDetection();
    
    // Configurar gestión de errores global
    setupGlobalErrorHandling();
    
    console.log('🔧 Funciones avanzadas configuradas');
}

/**
 * CONFIGURAR AUTO-REFRESH
 */
function setupAutoRefresh() {
    // Refrescar datos automáticamente cada 30 segundos si la API está conectada
    setInterval(async () => {
        if (appState.ui.apiConnected && !appState.ui.isLoading) {
            console.log('🔄 Auto-refresh de datos...');
            await refreshProjectsData(false); // Silencioso
        }
    }, APP_CONFIG.cacheRefreshInterval);
    
    // Guardar preferencias automáticamente cada minuto
    setInterval(() => {
        saveUserPreferences();
    }, APP_CONFIG.autoSaveInterval);
    
    console.log('⏰ Auto-refresh configurado');
}

/**
 * CARGAR DATOS INICIALES MEJORADO
 */
async function loadInitialData() {
    console.log('📊 Cargando datos iniciales...');
    
    // Mostrar indicadores de carga
    showLoadingState(true);
    
    try {
        // Intentar conectar con la API real primero
        if (!APP_CONFIG.useMockData) {
            console.log('🌐 Intentando conexión con API real...');
            const healthCheck = await projectAPI.checkHealth();
            
            if (healthCheck.success) {
                appState.ui.apiConnected = true;
                console.log('✅ API conectada exitosamente');
                
                const response = await projectAPI.getAllProjects();
                if (response.success) {
                    await processProjectsData(response.data);
                    updateConnectionStatus('connected');
                    return;
                }
            }
        }
        
        // Fallback a datos mock
        console.log('🎭 Usando datos mock para desarrollo');
        await loadMockDataEnhanced();
        updateConnectionStatus('mock');
        
    } catch (error) {
        console.error('💥 Error al cargar datos iniciales:', error);
        await loadMockDataEnhanced();
        updateConnectionStatus('error');
        showToast('⚠️ Error de conexión, usando datos locales', 'warning');
    } finally {
        showLoadingState(false);
        appState.cache.lastRefresh = new Date();
        updateLastUpdateTime();
    }
}

/**
 * CARGAR DATOS MOCK MEJORADOS
 */
async function loadMockDataEnhanced() {
    try {
        // Simular delay de red realista
        const delay = Math.random() * 1000 + 500; // 500-1500ms
        const mockResponse = await mockApiResponse(MOCK_DATA.projects, delay);
        
        await processProjectsData(mockResponse.data);
        appState.ui.apiConnected = false;
        
        console.log('🎭 Datos mock cargados con éxito');
    } catch (error) {
        console.error('💥 Error al cargar datos mock:', error);
        showCriticalError('No se pudieron cargar los datos del sistema');
    }
}

/**
 * PROCESAR Y ORGANIZAR DATOS DE PROYECTOS MEJORADO
 */
async function processProjectsData(projects) {
    console.log(`📋 Procesando ${projects.length} proyectos...`);
    
    // Validar y filtrar proyectos
    const validProjects = projects.filter(project => {
        const validation = validateProjectData(project);
        if (!validation.isValid) {
            console.warn('⚠️ Proyecto con datos inválidos:', project.id, validation.errors);
            return false;
        }
        return true;
    });
    
    // Separar proyectos por estado
    appState.projects.active = validProjects.filter(p => p.status === 'en_proceso');
    appState.projects.completed = validProjects.filter(p => p.status === 'terminado');
    
    // Ordenar proyectos inteligentemente
    sortProjects();
    
    // Aplicar filtros actuales
    applyCurrentFilters();
    
    // Calcular estadísticas
    calculateStatistics();
    
    // Renderizar proyectos
    await renderAllProjects();
    
    // Actualizar UI
    updateStatsDisplay();
    
    console.log(`✅ Procesados: ${appState.projects.active.length} activos, ${appState.projects.completed.length} completados`);
}

/**
 * ORDENAR PROYECTOS INTELIGENTEMENTE
 */
function sortProjects() {
    // Ordenar proyectos activos por urgencia y fecha
    appState.projects.active.sort((a, b) => {
        const aProgress = calculateDaysRemaining(a.endDate, a.startDate);
        const bProgress = calculateDaysRemaining(b.endDate, b.startDate);
        
        // Primero proyectos atrasados
        if (aProgress.isOverdue !== bProgress.isOverdue) {
            return aProgress.isOverdue ? -1 : 1;
        }
        
        // Luego por urgencia (días restantes)
        if (aProgress.days !== bProgress.days) {
            return aProgress.days - bProgress.days;
        }
        
        // Finalmente por fecha de inicio (más recientes primero)
        return new Date(b.startDate) - new Date(a.startDate);
    });
    
    // Ordenar proyectos completados por fecha de finalización
    appState.projects.completed.sort((a, b) => {
        return new Date(b.endDate) - new Date(a.endDate);
    });
}

/**
 * APLICAR FILTROS ACTUALES
 */
function applyCurrentFilters() {
    const { priority, dateRange, userFilter } = appState.search.filters;
    const searchTerm = appState.search.currentTerm;
    
    // Filtrar proyectos activos
    appState.projects.filtered.active = appState.projects.active.filter(project => {
        return passesAllFilters(project, { priority, dateRange, userFilter, searchTerm });
    });
    
    // Filtrar proyectos completados
    appState.projects.filtered.completed = appState.projects.completed.filter(project => {
        return passesAllFilters(project, { priority, dateRange, userFilter, searchTerm });
    });
}

/**
 * VERIFICAR SI UN PROYECTO PASA TODOS LOS FILTROS
 */
function passesAllFilters(project, filters) {
    // Filtro de búsqueda por texto
    if (filters.searchTerm) {
        const normalizedTerm = normalizeForSearch(filters.searchTerm);
        const searchableText = normalizeForSearch(`${project.name} ${project.id} ${project.description}`);
        
        if (!searchableText.includes(normalizedTerm)) {
            return false;
        }
    }
    
    // Filtro por prioridad
    if (filters.priority && filters.priority !== 'all') {
        if (project.priority !== filters.priority) {
            return false;
        }
    }
    
    // Filtro por rango de fechas
    if (filters.dateRange && filters.dateRange !== 'all') {
        if (!passesDateFilter(project, filters.dateRange)) {
            return false;
        }
    }
    
    // Filtro por usuario
    if (filters.userFilter && filters.userFilter !== 'all') {
        if (!project.users || !project.users.some(user => user.id === filters.userFilter)) {
            return false;
        }
    }
    
    return true;
}

/**
 * VERIFICAR FILTRO DE FECHA
 */
function passesDateFilter(project, dateRange) {
    const now = new Date();
    const projectDate = new Date(project.startDate);
    
    switch (dateRange) {
        case 'this_week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return projectDate >= weekAgo;
            
        case 'this_month':
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return projectDate >= monthAgo;
            
        case 'this_year':
            return projectDate.getFullYear() === now.getFullYear();
            
        default:
            return true;
    }
}

/**
 * CALCULAR ESTADÍSTICAS
 */
function calculateStatistics() {
    const total = appState.projects.active.length + appState.projects.completed.length;
    const overdue = appState.projects.active.filter(p => {
        const remaining = calculateDaysRemaining(p.endDate);
        return remaining.isOverdue;
    }).length;
    
    appState.stats = {
        totalProjects: total,
        activeProjects: appState.projects.active.length,
        completedProjects: appState.projects.completed.length,
        overdueProjects: overdue,
        lastUpdate: new Date()
    };
}

/**
 * RENDERIZAR TODOS LOS PROYECTOS MEJORADO
 */
async function renderAllProjects() {
    await Promise.all([
        renderActiveProjects(),
        renderCompletedProjects()
    ]);
    
    // Actualizar contadores después del renderizado
    updateProjectCounters();
}

/**
 * RENDERIZAR PROYECTOS ACTIVOS MEJORADO
 */
async function renderActiveProjects() {
    const container = domElements.activeProjectsContainer;
    const noProjectsMessage = domElements.noActiveProjects;
    
    if (!container) return;
    
    // Limpiar contenedor con animación suave
    await clearContainerWithAnimation(container);
    
    // Obtener proyectos filtrados
    const filteredProjects = appState.projects.filtered.active;
    
    if (filteredProjects.length === 0) {
        handleEmptyActiveProjects();
        return;
    }
    
    // Ocultar mensajes de estado vacío
    hideElement(noProjectsMessage);
    showNoSearchResults(false);
    
    // Renderizar cada proyecto con animación escalonada
    for (let i = 0; i < filteredProjects.length; i++) {
        const project = filteredProjects[i];
        const projectCard = createActiveProjectCard(project, i);
        
        container.appendChild(projectCard);
        
        // Animación de entrada escalonada
        setTimeout(() => {
            projectCard.classList.add('fade-in');
        }, i * 50);
    }
    
    // Reinicializar tooltips después del renderizado
    setTimeout(() => {
        initializeTooltips();
    }, filteredProjects.length * 50 + 100);
    
    console.log(`📋 Renderizados ${filteredProjects.length} proyectos activos`);
}

/**
 * RENDERIZAR PROYECTOS COMPLETADOS MEJORADO
 */
async function renderCompletedProjects() {
    const container = domElements.completedProjectsContainer;
    const noProjectsMessage = domElements.noCompletedProjects;
    
    if (!container) return;
    
    // Limpiar contenedor
    await clearContainerWithAnimation(container);
    
    // Obtener proyectos filtrados
    const filteredProjects = appState.projects.filtered.completed;
    
    if (filteredProjects.length === 0) {
        showElement(noProjectsMessage);
        return;
    }
    
    hideElement(noProjectsMessage);
    
    // Renderizar cada proyecto
    filteredProjects.forEach((project, index) => {
        const projectCard = createCompletedProjectCard(project, index);
        container.appendChild(projectCard);
        
        // Animación de entrada
        setTimeout(() => {
            projectCard.classList.add('fade-in');
        }, index * 30);
    });
    
    console.log(`✅ Renderizados ${filteredProjects.length} proyectos completados`);
}

/**
 * LIMPIAR CONTENEDOR CON ANIMACIÓN
 */
async function clearContainerWithAnimation(container) {
    const children = Array.from(container.children);
    
    // Animar salida de elementos existentes
    children.forEach((child, index) => {
        setTimeout(() => {
            child.classList.add('fade-out');
        }, index * 20);
    });
    
    // Esperar a que termine la animación y limpiar
    await new Promise(resolve => {
        setTimeout(() => {
            container.innerHTML = '';
            resolve();
        }, children.length * 20 + 200);
    });
}

/**
 * MANEJAR ESTADO VACÍO DE PROYECTOS ACTIVOS
 */
function handleEmptyActiveProjects() {
    const noProjectsMessage = domElements.noActiveProjects;
    const noSearchResults = domElements.noSearchResults;
    
    if (appState.search.currentTerm || hasActiveFilters()) {
        // Mostrar mensaje de sin resultados de búsqueda
        showNoSearchResults(true);
        hideElement(noProjectsMessage);
    } else {
        // Mostrar mensaje de no hay proyectos
        showNoSearchResults(false);
        showElement(noProjectsMessage);
    }
}

/**
 * VERIFICAR SI HAY FILTROS ACTIVOS
 */
function hasActiveFilters() {
    const filters = appState.search.filters;
    return filters.priority !== 'all' || 
           filters.dateRange !== 'all' || 
           filters.userFilter !== 'all';
}

/**
 * CREAR TARJETA DE PROYECTO ACTIVO MEJORADA
 */
function createActiveProjectCard(project, index) {
    const card = document.createElement('div');
    card.className = 'active-project-card';
    card.dataset.projectId = project.id;
    card.dataset.index = index;
    
    // Calcular información de progreso
    const progressInfo = calculateDaysRemaining(project.endDate, project.startDate);
    const projectProgress = calculateProjectProgress(project);
    
    // Generar contenido de usuarios
    const usersHTML = generateUsersHTML(project.users, 'active');
    
    // Preparar texto destacado para búsqueda
    const highlightedName = highlightSearchTerm(project.name, appState.search.currentTerm);
    const highlightedDescription = highlightSearchTerm(project.description, appState.search.currentTerm);
    
    // Determinar clases de estado
    const statusClasses = getProjectStatusClasses(progressInfo);
    const priorityClass = getPriorityClass(project.priority);
    
    card.innerHTML = `
        <div class="project-card-header">
            <div class="project-title-section">
                <h4 class="project-name ${priorityClass}" 
                    data-bs-toggle="tooltip" 
                    data-bs-placement="top" 
                    title="${escapeHtml(project.description)}">
                    ${highlightedName}
                    ${getPriorityIcon(project.priority)}
                </h4>
                <div class="project-meta">
                    <span class="project-id badge bg-secondary">${project.id}</span>
                    ${getStatusBadge(progressInfo)}
                </div>
            </div>
            <div class="project-actions">
                <button class="btn btn-sm btn-outline-primary project-quick-view" 
                        data-project-id="${project.id}"
                        data-bs-toggle="tooltip" 
                        title="Vista rápida">
                    <i class="bi bi-eye"></i>
                </button>
                <div class="dropdown">
                    <button class="btn btn-sm btn-outline-secondary dropdown-toggle" 
                            type="button" data-bs-toggle="dropdown">
                        <i class="bi bi-three-dots-vertical"></i>
                    </button>
                    <ul class="dropdown-menu">
                        <li><a class="dropdown-item" href="#" onclick="handleProjectEdit('${project.id}')">
                            <i class="bi bi-pencil me-2"></i>Editar
                        </a></li>
                        <li><a class="dropdown-item" href="#" onclick="handleProjectShare('${project.id}')">
                            <i class="bi bi-share me-2"></i>Compartir
                        </a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item text-danger" href="#" onclick="handleProjectDelete('${project.id}')">
                            <i class="bi bi-trash me-2"></i>Eliminar
                        </a></li>
                    </ul>
                </div>
            </div>
        </div>
        
        <div class="project-progress-section">
            <div class="progress-info">
                <div class="progress-stats">
                    <span class="progress-label">Progreso del proyecto</span>
                    <span class="progress-percentage">${projectProgress.percentage}%</span>
                </div>
                <div class="progress mb-2">
                    <div class="progress-bar ${getProgressBarClass(projectProgress.status)}" 
                         style="width: ${projectProgress.percentage}%"></div>
                </div>
            </div>
        </div>
        
        <div class="project-dates-section">
            <div class="date-item">
                <div class="date-icon">
                    <i class="bi bi-calendar-plus text-success"></i>
                </div>
                <div class="date-content">
                    <span class="date-label">Inicio</span>
                    <span class="date-value">${formatDate(project.startDate)}</span>
                </div>
            </div>
            <div class="date-item">
                <div class="date-icon">
                    <i class="bi bi-calendar-check text-primary"></i>
                </div>
                <div class="date-content">
                    <span class="date-label">Finalización</span>
                    <span class="date-value">${formatDate(project.endDate)}</span>
                </div>
            </div>
            <div class="date-item ${statusClasses.textClass}">
                <div class="date-icon">
                    <i class="bi ${statusClasses.iconClass}"></i>
                </div>
                <div class="date-content">
                    <span class="date-label">Restantes</span>
                    <span class="date-value">${getDaysRemainingText(progressInfo)}</span>
                </div>
            </div>
        </div>
        
        <div class="project-team-section">
            <div class="team-header">
                <span class="team-label">
                    <i class="bi bi-people-fill me-1"></i>
                    Equipo (${project.users?.length || 0}/7)
                </span>
                ${getTeamStatusIndicator(project.users?.length || 0)}
            </div>
            <div class="team-members">
                ${usersHTML}
                ${getAddMemberButton(project.id)}
            </div>
        </div>
        
        <div class="project-description-section">
            <div class="description-content">
                <small class="text-muted">${truncateText(highlightedDescription, 120)}</small>
            </div>
            ${getExpandDescriptionButton(project.description)}
        </div>
        
        <div class="project-footer">
            <div class="project-stats">
                <span class="stat-item" title="Última actualización">
                    <i class="bi bi-clock me-1"></i>
                    ${formatDate(project.lastModified || project.startDate, {shortFormat: true})}
                </span>
            </div>
            <div class="project-quick-actions">
                <button class="btn btn-sm btn-primary" onclick="handleProjectOpen('${project.id}')">
                    <i class="bi bi-arrow-right me-1"></i>
                    Abrir
                </button>
            </div>
        </div>
    `;
    
    // Agregar event listeners
    setupProjectCardEvents(card, project);
    
    return card;
}

/**
 * CREAR TARJETA DE PROYECTO COMPLETADO MEJORADA
 */
function createCompletedProjectCard(project, index) {
    const card = document.createElement('div');
    card.className = 'completed-project-card';
    card.dataset.projectId = project.id;
    card.dataset.index = index;
    
    const highlightedName = highlightSearchTerm(project.name, appState.search.currentTerm);
    const completionDate = formatDate(project.endDate);
    const projectDuration = calculateProjectDuration(project.startDate, project.endDate);
    
    card.innerHTML = `
        <div class="completed-project-header">
            <div class="completion-indicator">
                <i class="bi bi-check-circle-fill text-success"></i>
            </div>
            <div class="project-info">
                <div class="completed-project-name">${highlightedName}</div>
                <div class="completed-project-meta">
                    <span class="completed-project-id">ID: ${project.id}</span>
                    ${getPriorityBadge(project.priority, 'small')}
                </div>
            </div>
            <div class="completion-date">
                <small class="text-success">
                    <i class="bi bi-calendar-check me-1"></i>
                    ${completionDate}
                </small>
            </div>
        </div>
        
        <div class="completed-project-stats">
            <div class="stat-item">
                <span class="stat-label">Duración</span>
                <span class="stat-value">${projectDuration}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Equipo</span>
                <span class="stat-value">${project.users?.length || 0} personas</span>
            </div>
        </div>
        
        <div class="completed-project-team">
            ${generateUsersHTML(project.users, 'completed')}
        </div>
        
        <div class="completed-project-actions">
            <button class="btn btn-sm btn-outline-primary" onclick="handleCompletedProjectView('${project.id}')">
                <i class="bi bi-eye me-1"></i>
                Ver detalles
            </button>
        </div>
    `;
    
    // Agregar event listeners
    setupCompletedProjectCardEvents(card, project);
    
    return card;
}

/**
 * GENERAR HTML DE USUARIOS MEJORADO
 */
function generateUsersHTML(users, context = 'active') {
    if (!users || users.length === 0) {
        return `<span class="text-muted small">
            <i class="bi bi-person-plus-fill me-1"></i>
            Sin usuarios asignados
        </span>`;
    }
    
    const maxVisible = context === 'active' ? 4 : 3;
    const visibleUsers = users.slice(0, maxVisible);
    const remainingCount = users.length - maxVisible;
    
    let html = visibleUsers.map(user => `
        <div class="user-avatar ${context === 'completed' ? 'user-avatar-small' : ''}" 
             data-user-id="${user.id}">
            <img src="${user.profileImage || generateAvatarPlaceholder(user.name)}" 
                 alt="${escapeHtml(user.name || 'Usuario')}"
                 class="user-image"
                 data-bs-toggle="tooltip"
                 data-bs-placement="top"
                 title="${escapeHtml(user.name || 'Usuario')}${user.role ? ' - ' + user.role : ''}"
                 onerror="this.src='${generateAvatarPlaceholder(user.name)}'">
            ${getUserStatusIndicator(user)}
        </div>
    `).join('');
    
    // Agregar indicador de usuarios adicionales
    if (remainingCount > 0) {
        html += `
            <div class="user-avatar-more ${context === 'completed' ? 'user-avatar-small' : ''}"
                 data-bs-toggle="tooltip"
                 title="Y ${remainingCount} más">
                <span class="more-count">+${remainingCount}</span>
            </div>
        `;
    }
    
    return html;
}

/**
 * GENERAR PLACEHOLDER DE AVATAR
 */
function generateAvatarPlaceholder(name) {
    const initial = (name || 'U').charAt(0).toUpperCase();
    const colors = ['#E07441', '#B67253', '#8B6857', '#61534D'];
    const colorIndex = (name || '').length % colors.length;
    const bgColor = colors[colorIndex].replace('#', '');
    
    return `https://via.placeholder.com/35x35/${bgColor}/FFFFFF?text=${initial}`;
}

/**
 * OBTENER CLASES DE ESTADO DEL PROYECTO
 */
function getProjectStatusClasses(progressInfo) {
    if (progressInfo.isOverdue) {
        return {
            textClass: 'text-danger',
            iconClass: 'bi-exclamation-triangle-fill',
            badgeClass: 'bg-danger'
        };
    } else if (progressInfo.isToday) {
        return {
            textClass: 'text-warning',
            iconClass: 'bi-clock-fill',
            badgeClass: 'bg-warning'
        };
    } else if (progressInfo.isUrgent) {
        return {
            textClass: 'text-warning',
            iconClass: 'bi-hourglass-split',
            badgeClass: 'bg-warning'
        };
    } else {
        return {
            textClass: 'text-success',
            iconClass: 'bi-calendar-check',
            badgeClass: 'bg-success'
        };
    }
}

/**
 * OBTENER CLASE DE PRIORIDAD
 */
function getPriorityClass(priority) {
    switch (priority) {
        case 'alta': return 'priority-high';
        case 'media': return 'priority-medium';
        case 'baja': return 'priority-low';
        default: return '';
    }
}

/**
 * OBTENER ICONO DE PRIORIDAD
 */
function getPriorityIcon(priority) {
    switch (priority) {
        case 'alta': 
            return '<i class="bi bi-arrow-up-circle-fill text-danger ms-1" title="Prioridad Alta"></i>';
        case 'media': 
            return '<i class="bi bi-dash-circle-fill text-warning ms-1" title="Prioridad Media"></i>';
        case 'baja': 
            return '<i class="bi bi-arrow-down-circle-fill text-info ms-1" title="Prioridad Baja"></i>';
        default: 
            return '';
    }
}

/**
 * OBTENER BADGE DE ESTADO
 */
function getStatusBadge(progressInfo) {
    const statusClasses = getProjectStatusClasses(progressInfo);
    
    if (progressInfo.isOverdue) {
        return `<span class="badge ${statusClasses.badgeClass}">Atrasado</span>`;
    } else if (progressInfo.isToday) {
        return `<span class="badge ${statusClasses.badgeClass}">Vence hoy</span>`;
    } else if (progressInfo.isUrgent) {
        return `<span class="badge ${statusClasses.badgeClass}">Urgente</span>`;
    }
    
    return '';
}

/**
 * OBTENER CLASE DE BARRA DE PROGRESO
 */
function getProgressBarClass(status) {
    switch (status) {
        case 'completed': return 'bg-success';
        case 'overdue': return 'bg-danger';
        case 'near_completion': return 'bg-warning';
        default: return 'bg-primary';
    }
}

/**
 * OBTENER TEXTO DE DÍAS RESTANTES MEJORADO
 */
function getDaysRemainingText(progressInfo) {
    if (progressInfo.days === null) return 'N/A';
    
    if (progressInfo.isOverdue) {
        return `${Math.abs(progressInfo.days)} días atrás`;
    } else if (progressInfo.isToday) {
        return 'Vence hoy';
    } else if (progressInfo.days === 1) {
        return 'Mañana';
    } else {
        return `${progressInfo.days} días`;
    }
}

/**
 * OBTENER INDICADOR DE ESTADO DEL EQUIPO
 */
function getTeamStatusIndicator(teamSize) {
    if (teamSize === 0) {
        return '<span class="badge bg-warning ms-2">Sin equipo</span>';
    } else if (teamSize >= 6) {
        return '<span class="badge bg-info ms-2">Equipo completo</span>';
    }
    return '';
}

/**
 * OBTENER BOTÓN PARA AGREGAR MIEMBRO
 */
function getAddMemberButton(projectId) {
    return `
        <button class="btn btn-sm btn-outline-secondary add-member-btn"
                onclick="handleAddMember('${projectId}')"
                data-bs-toggle="tooltip"
                title="Agregar miembro al equipo">
            <i class="bi bi-person-plus"></i>
        </button>
    `;
}

/**
 * OBTENER BOTÓN PARA EXPANDIR DESCRIPCIÓN
 */
function getExpandDescriptionButton(fullDescription) {
    if (!fullDescription || fullDescription.length <= 120) return '';
    
    return `
        <button class="btn btn-sm btn-link p-0 expand-description"
                onclick="toggleDescription(this)"
                data-full-text="${escapeHtml(fullDescription)}">
            <small>Ver más...</small>
        </button>
    `;
}

/**
 * OBTENER INDICADOR DE ESTADO DEL USUARIO
 */
function getUserStatusIndicator(user) {
    // Simulado - en implementación real vendría de la API
    const isOnline = Math.random() > 0.3; // 70% probabilidad de estar online
    
    if (isOnline) {
        return '<span class="user-status online" title="En línea"></span>';
    }
    return '';
}

/**
 * CALCULAR DURACIÓN DEL PROYECTO
 */
function calculateProjectDuration(startDate, endDate) {
    if (!startDate || !endDate) return 'N/A';
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) {
        return `${diffDays} días`;
    } else if (diffDays < 365) {
        const months = Math.round(diffDays / 30);
        return `${months} ${months === 1 ? 'mes' : 'meses'}`;
    } else {
        const years = Math.round(diffDays / 365);
        return `${years} ${years === 1 ? 'año' : 'años'}`;
    }
}

/**
 * OBTENER BADGE DE PRIORIDAD
 */
function getPriorityBadge(priority, size = 'normal') {
    if (!priority) return '';
    
    const sizeClass = size === 'small' ? 'badge-sm' : '';
    
    switch (priority) {
        case 'alta':
            return `<span class="badge bg-danger ${sizeClass}">Alta</span>`;
        case 'media':
            return `<span class="badge bg-warning ${sizeClass}">Media</span>`;
        case 'baja':
            return `<span class="badge bg-info ${sizeClass}">Baja</span>`;
        default:
            return '';
    }
}

/**
 * ===============================================
 * MANEJADORES DE EVENTOS MEJORADOS
 * ===============================================
 */

/**
 * CONFIGURAR EVENTOS DE TARJETA DE PROYECTO
 */
function setupProjectCardEvents(card, project) {
    // Click general en la tarjeta
    card.addEventListener('click', function(e) {
        // Solo si no se hizo click en un botón específico
        if (!e.target.closest('button') && !e.target.closest('.dropdown')) {
            handleProjectClick(project);
        }
    });
    
    // Hover effects
    card.addEventListener('mouseenter', function() {
        card.classList.add('project-card-hover');
        preloadProjectData(project.id); // Precargar datos para vista rápida
    });
    
    card.addEventListener('mouseleave', function() {
        card.classList.remove('project-card-hover');
    });
    
    // Double click para edición rápida
    card.addEventListener('dblclick', function(e) {
        e.preventDefault();
        handleProjectEdit(project.id);
    });
}

/**
 * CONFIGURAR EVENTOS DE TARJETA DE PROYECTO COMPLETADO
 */
function setupCompletedProjectCardEvents(card, project) {
    card.addEventListener('click', function(e) {
        if (!e.target.closest('button')) {
            handleCompletedProjectClick(project);
        }
    });
    
    card.addEventListener('mouseenter', function() {
        card.classList.add('completed-card-hover');
    });
    
    card.addEventListener('mouseleave', function() {
        card.classList.remove('completed-card-hover');
    });
}

/**
 * MANEJAR CLICK EN PROYECTO ACTIVO MEJORADO
 */
function handleProjectClick(project) {
    console.log('🔗 Abriendo proyecto:', project.name);
    
    // Marcar proyecto como seleccionado
    markProjectAsSelected(project.id);
    
    // Actualizar historial de navegación
    updateNavigationHistory(project);
    
    // Mostrar toast con información
    showToast(`📋 Abriendo proyecto: ${project.name}`, 'info');
    
    // Simular navegación (en implementación real, abriría vista detallada)
    setTimeout(() => {
        showProjectDetailModal(project);
    }, 300);
}

/**
 * MANEJAR CLICK EN PROYECTO COMPLETADO MEJORADO
 */
function handleCompletedProjectClick(project) {
    console.log('🏁 Viendo proyecto completado:', project.name);
    
    showToast(`✅ Abriendo proyecto completado: ${project.name}`, 'success');
    
    // Mostrar vista de solo lectura
    setTimeout(() => {
        showCompletedProjectModal(project);
    }, 300);
}

/**
 * MANEJAR CREACIÓN DE NUEVO PROYECTO MEJORADO
 */
function handleCreateProject() {
    console.log('➕ Iniciando creación de proyecto');
    
    // Validar límites (ejemplo: máximo 20 proyectos activos)
    if (appState.projects.active.length >= 20) {
        showToast('⚠️ Has alcanzado el límite de 20 proyectos activos', 'warning');
        return;
    }
    
    // Preparar datos iniciales
    const newProjectData = {
        id: generateTempId('PROJ'),
        name: '',
        startDate: formatDate(new Date()),
        endDate: '',
        description: '',
        status: 'en_proceso',
        priority: 'media',
        users: []
    };
    
    // Mostrar modal de creación
    showProjectCreationModal(newProjectData);
}

/**
 * MANEJAR EDICIÓN DE PROYECTO
 */
async function handleProjectEdit(projectId) {
    console.log('✏️ Editando proyecto:', projectId);
    
    showLoadingToast('Cargando datos del proyecto...');
    
    try {
        // Obtener datos completos del proyecto
        const response = await projectAPI.getProjectById(projectId);
        
        if (response.success) {
            hideLoadingToast();
            showProjectEditModal(response.data);
        } else {
            hideLoadingToast();
            showToast('❌ Error al cargar datos del proyecto', 'error');
        }
    } catch (error) {
        hideLoadingToast();
        console.error('Error al editar proyecto:', error);
        showToast('❌ Error de conexión al editar proyecto', 'error');
    }
}

/**
 * MANEJAR ELIMINACIÓN DE PROYECTO
 */
async function handleProjectDelete(projectId) {
    console.log('🗑️ Solicitando eliminación:', projectId);
    
    const project = findProjectById(projectId);
    if (!project) {
        showToast('❌ Proyecto no encontrado', 'error');
        return;
    }
    
    // Mostrar confirmación
    const confirmed = await showConfirmationModal({
        title: 'Eliminar Proyecto',
        message: `¿Estás seguro de que quieres eliminar el proyecto "${project.name}"?`,
        confirmText: 'Sí, eliminar',
        cancelText: 'Cancelar',
        type: 'danger'
    });
    
    if (!confirmed) return;
    
    showLoadingToast('Eliminando proyecto...');
    
    try {
        const response = await projectAPI.deleteProject(projectId);
        
        if (response.success) {
            hideLoadingToast();
            showToast('✅ Proyecto eliminado correctamente', 'success');
            
            // Remover del estado local
            removeProjectFromState(projectId);
            
            // Re-renderizar
            await renderAllProjects();
            updateStatsDisplay();
            
        } else {
            hideLoadingToast();
            showToast('❌ Error al eliminar proyecto', 'error');
        }
    } catch (error) {
        hideLoadingToast();
        console.error('Error al eliminar proyecto:', error);
        showToast('❌ Error de conexión al eliminar', 'error');
    }
}

/**
 * MANEJAR COMPARTIR PROYECTO
 */
function handleProjectShare(projectId) {
    console.log('🔗 Compartiendo proyecto:', projectId);
    
    const project = findProjectById(projectId);
    if (!project) return;
    
    // Generar enlace compartible
    const shareUrl = `${window.location.origin}/project/${projectId}`;
    
    // Mostrar modal de compartir
    showShareModal({
        project: project,
        url: shareUrl,
        methods: ['link', 'email', 'teams', 'whatsapp']
    });
}

/**
 * MANEJAR AGREGAR MIEMBRO AL EQUIPO
 */
function handleAddMember(projectId) {
    console.log('👤 Agregando miembro al proyecto:', projectId);
    
    const project = findProjectById(projectId);
    if (!project) return;
    
    // Validar límite de usuarios
    if (project.users && project.users.length >= 7) {
        showToast('⚠️ El proyecto ya tiene el máximo de 7 usuarios', 'warning');
        return;
    }
    
    // Mostrar modal para seleccionar usuario
    showAddMemberModal(projectId);
}

/**
 * MANEJAR VISTA RÁPIDA DE PROYECTO COMPLETADO
 */
function handleCompletedProjectView(projectId) {
    console.log('👁️ Vista rápida de proyecto completado:', projectId);
    
    const project = findProjectById(projectId);
    if (!project) return;
    
    showCompletedProjectModal(project);
}

/**
 * MANEJAR BÚSQUEDA AVANZADA MEJORADA
 */
async function handleAdvancedSearch(searchTerm) {
    console.log(`🔍 Búsqueda avanzada: "${searchTerm}"`);
    
    // Actualizar estado de búsqueda
    appState.search.currentTerm = searchTerm;
    
    // Agregar al historial si no está vacío
    if (searchTerm && !appState.search.history.includes(searchTerm)) {
        appState.search.history.unshift(searchTerm);
        appState.search.history = appState.search.history.slice(0, APP_CONFIG.maxSearchHistory);
    }
    
    // Mostrar indicador de búsqueda
    if (searchTerm) {
        showSearchIndicator(true);
    }
    
    try {
        // Si hay conexión API y término de búsqueda, buscar en servidor
        if (searchTerm && appState.ui.apiConnected && !APP_CONFIG.useMockData) {
            const response = await projectAPI.searchProjects(searchTerm);
            
            if (response.success) {
                await processProjectsData(response.data);
                showSearchIndicator(false);
                updateSearchResultsCount();
                return;
            }
        }
        
        // Filtrado local
        applyCurrentFilters();
        await renderAllProjects();
        showSearchIndicator(false);
        updateSearchResultsCount();
        
    } catch (error) {
        console.error('Error en búsqueda:', error);
        showSearchIndicator(false);
        showToast('⚠️ Error en la búsqueda', 'warning');
    }
}

/**
 * MANEJAR REFRESH MANUAL
 */
async function handleManualRefresh() {
    console.log('🔄 Refresh manual solicitado');
    
    // Prevenir múltiples refreshes
    if (appState.ui.isLoading) {
        showToast('⏳ Ya hay una actualización en progreso...', 'info');
        return;
    }
    
    // Mostrar indicador de refresh
    showRefreshIndicator(true);
    showToast('🔄 Actualizando datos...', 'info');
    
    try {
        // Limpiar caché para forzar actualización
        if (window.apiDebug) {
            window.apiDebug.clearCache();
        }
        
        // Recargar datos
        await loadInitialData();
        
        showRefreshIndicator(false);
        showToast('✅ Datos actualizados correctamente', 'success');
        
    } catch (error) {
        showRefreshIndicator(false);
        console.error('Error en refresh manual:', error);
        showToast('❌ Error al actualizar datos', 'error');
    }
}

/**
 * TOGGLE DESCRIPCIÓN EXPANDIDA
 */
function toggleDescription(button) {
    const fullText = button.getAttribute('data-full-text');
    const descriptionElement = button.parentElement.querySelector('.description-content small');
    const currentText = descriptionElement.innerHTML;
    
    if (button.textContent.includes('Ver más')) {
        // Expandir
        descriptionElement.innerHTML = highlightSearchTerm(fullText, appState.search.currentTerm);
        button.innerHTML = '<small>Ver menos...</small>';
    } else {
        // Contraer
        descriptionElement.innerHTML = truncateText(
            highlightSearchTerm(fullText, appState.search.currentTerm), 
            120
        );
        button.innerHTML = '<small>Ver más...</small>';
    }
}

/**
 * ===============================================
 * FUNCIONES DE MODAL Y UI AVANZADA
 * ===============================================
 */

/**
 * MOSTRAR MODAL DE DETALLE DE PROYECTO
 */
function showProjectDetailModal(project) {
    const modalHtml = createProjectDetailModalHtml(project);
    showModal('projectDetailModal', modalHtml);
}

/**
 * MOSTRAR MODAL DE PROYECTO COMPLETADO
 */
function showCompletedProjectModal(project) {
    const modalHtml = createCompletedProjectModalHtml(project);
    showModal('completedProjectModal', modalHtml);
}

/**
 * MOSTRAR MODAL DE CREACIÓN DE PROYECTO
 */
function showProjectCreationModal(projectData) {
    const modalHtml = createProjectCreationModalHtml(projectData);
    showModal('projectCreationModal', modalHtml);
}

/**
 * MOSTRAR MODAL DE EDICIÓN DE PROYECTO
 */
function showProjectEditModal(project) {
    const modalHtml = createProjectEditModalHtml(project);
    showModal('projectEditModal', modalHtml);
}

/**
 * MOSTRAR MODAL DE COMPARTIR
 */
function showShareModal(shareData) {
    const modalHtml = createShareModalHtml(shareData);
    showModal('shareModal', modalHtml);
}

/**
 * MOSTRAR MODAL DE AGREGAR MIEMBRO
 */
function showAddMemberModal(projectId) {
    const modalHtml = createAddMemberModalHtml(projectId);
    showModal('addMemberModal', modalHtml);
}

/**
 * MOSTRAR MODAL GENÉRICO
 */
function showModal(modalId, content) {
    // Remover modal existente si existe
    const existingModal = document.getElementById(modalId);
    if (existingModal) {
        existingModal.remove();
    }
    
    // Crear modal
    const modalElement = document.createElement('div');
    modalElement.id = modalId;
    modalElement.className = 'modal fade';
    modalElement.innerHTML = content;
    
    // Agregar al DOM
    document.body.appendChild(modalElement);
    
    // Mostrar modal
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
    
    // Limpiar al cerrar
    modalElement.addEventListener('hidden.bs.modal', function() {
        modalElement.remove();
    });
}

/**
 * MOSTRAR MODAL DE CONFIRMACIÓN
 */
function showConfirmationModal(options) {
    return new Promise((resolve) => {
        const modalHtml = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${options.title}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p>${options.message}</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${options.cancelText}</button>
                        <button type="button" class="btn btn-${options.type || 'primary'}" id="confirmButton">${options.confirmText}</button>
                    </div>
                </div>
            </div>
        `;
        
        const modalElement = document.createElement('div');
        modalElement.className = 'modal fade';
        modalElement.innerHTML = modalHtml;
        document.body.appendChild(modalElement);
        
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
        
        // Manejar confirmación
        modalElement.querySelector('#confirmButton').addEventListener('click', function() {
            modal.hide();
            resolve(true);
        });
        
        // Manejar cancelación
        modalElement.addEventListener('hidden.bs.modal', function() {
            modalElement.remove();
            resolve(false);
        });
    });
}

/**
 * ===============================================
 * FUNCIONES DE ESTADO Y NAVEGACIÓN
 * ===============================================
 */

/**
 * MARCAR PROYECTO COMO SELECCIONADO
 */
function markProjectAsSelected(projectId) {
    // Remover selección anterior
    document.querySelectorAll('.project-card-selected').forEach(card => {
        card.classList.remove('project-card-selected');
    });
    
    // Marcar nuevo seleccionado
    const selectedCard = document.querySelector(`[data-project-id="${projectId}"]`);
    if (selectedCard) {
        selectedCard.classList.add('project-card-selected');
    }
    
    appState.ui.selectedProject = projectId;
}

/**
 * ACTUALIZAR HISTORIAL DE NAVEGACIÓN
 */
function updateNavigationHistory(project) {
    // Actualizar URL sin recargar página
    if (history.pushState) {
        const newUrl = `${window.location.pathname}?project=${project.id}`;
        history.pushState({ projectId: project.id }, project.name, newUrl);
    }
}

/**
 * PRECARGAR DATOS DE PROYECTO
 */
async function preloadProjectData(projectId) {
    // Solo precargar si no está en caché y hay conexión API
    if (!appState.ui.apiConnected || APP_CONFIG.useMockData) return;
    
    try {
        // Verificar si ya está en caché
        const cacheKey = `GET_/projects/${projectId}_null`;
        if (window.apiDebug && window.apiDebug.cache.has(cacheKey)) return;
        
        // Precargar datos en background
        projectAPI.getProjectById(projectId);
        console.log(`📦 Precargando datos para proyecto ${projectId}`);
        
    } catch (error) {
        // Ignorar errores de precarga
        console.debug('Error en precarga (ignorado):', error);
    }
}

/**
 * ENCONTRAR PROYECTO POR ID
 */
function findProjectById(projectId) {
    return [...appState.projects.active, ...appState.projects.completed]
        .find(p => p.id === projectId);
}

/**
 * REMOVER PROYECTO DEL ESTADO
 */
function removeProjectFromState(projectId) {
    appState.projects.active = appState.projects.active.filter(p => p.id !== projectId);
    appState.projects.completed = appState.projects.completed.filter(p => p.id !== projectId);
    
    // Actualizar proyectos filtrados también
    applyCurrentFilters();
}

/**
 * ===============================================
 * FUNCIONES DE INDICADORES VISUALES
 * ===============================================
 */

/**
 * MOSTRAR INDICADOR DE BÚSQUEDA
 */
function showSearchIndicator(show) {
    const searchInput = domElements.searchInput;
    if (!searchInput) return;
    
    const existingSpinner = searchInput.parentElement.querySelector('.search-spinner');
    
    if (show && !existingSpinner) {
        const spinner = document.createElement('div');
        spinner.className = 'search-spinner position-absolute top-50 end-0 translate-middle-y me-2';
        spinner.innerHTML = '<div class="spinner-border spinner-border-sm text-primary" role="status"></div>';
        searchInput.parentElement.style.position = 'relative';
        searchInput.parentElement.appendChild(spinner);
    } else if (!show && existingSpinner) {
        existingSpinner.remove();
    }
}

/**
 * MOSTRAR INDICADOR DE REFRESH
 */
function showRefreshIndicator(show) {
    const refreshBtn = domElements.refreshBtn;
    if (!refreshBtn) return;
    
    if (show) {
        refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i>';
        refreshBtn.disabled = true;
    } else {
        refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
        refreshBtn.disabled = false;
    }
}

/**
 * MOSTRAR/OCULTAR HISTORIAL DE BÚSQUEDA
 */
function showSearchHistory() {
    if (appState.search.history.length === 0) return;
    
    const searchInput = domElements.searchInput;
    if (!searchInput) return;
    
    const historyHtml = appState.search.history.map(term => `
        <button class="dropdown-item" onclick="selectSearchTerm('${escapeHtml(term)}')">
            <i class="bi bi-clock-history me-2"></i>
            ${escapeHtml(term)}
        </button>
    `).join('');
    
    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown-menu show search-history-dropdown';
    dropdown.innerHTML = historyHtml;
    
    searchInput.parentElement.appendChild(dropdown);
}

function hideSearchHistory() {
    const dropdown = document.querySelector('.search-history-dropdown');
    if (dropdown) {
        dropdown.remove();
    }
}

/**
 * SELECCIONAR TÉRMINO DE BÚSQUEDA DEL HISTORIAL
 */
function selectSearchTerm(term) {
    if (domElements.searchInput) {
        domElements.searchInput.value = term;
        handleAdvancedSearch(term);
    }
    hideSearchHistory();
}

/**
 * ACTUALIZAR CONTADOR DE RESULTADOS
 */
function updateSearchResultsCount() {
    const activeCount = appState.projects.filtered.active.length;
    const completedCount = appState.projects.filtered.completed.length;
    const total = activeCount + completedCount;
    
    if (appState.search.currentTerm) {
        showToast(`🔍 ${total} resultados encontrados`, 'info');
    }
}


  // MOSTRAR TOAST MEJORADO CON TIPOS

function showToast(message, type = 'info', title = 'Notificación') {
    const toast = document.getElementById('mainToast');
    const toastIcon = document.getElementById('toastIcon');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    
    if (!toast || !toastIcon || !toastTitle || !toastMessage) return;
    
    // Configurar icono y colores según tipo
    const typeConfig = {
        success: {
            icon: 'bi-check-circle-fill text-success',
            title: title || 'Éxito'
        },
        error: {
            icon: 'bi-x-circle-fill text-danger',
            title: title || 'Error'
        },
        warning: {
            icon: 'bi-exclamation-triangle-fill text-warning',
            title: title || 'Advertencia'
        },
        info: {
            icon: 'bi-info-circle-fill text-primary',
            title: title || 'Información'
        }
    };
    
    const config = typeConfig[type] || typeConfig.info;
    
    toastIcon.className = `bi ${config.icon} me-2`;
    toastTitle.textContent = config.title;
    toastMessage.textContent = message;
    
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
}

/**
 * MOSTRAR TOAST DE CARGA
 */
function showLoadingToast(message) {
    const toast = document.getElementById('mainToast');
    const toastIcon = document.getElementById('toastIcon');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    
    if (!toast) return;
    
    toastIcon.className = 'spinner-border spinner-border-sm text-primary me-2';
    toastTitle.textContent = 'Cargando...';
    toastMessage.textContent = message;
    
    const bsToast = new bootstrap.Toast(toast, { autohide: false });
    bsToast.show();
    
    return bsToast;
}

/**
 * OCULTAR TOAST DE CARGA
 */
function hideLoadingToast() {
    const toast = document.getElementById('mainToast');
    if (toast) {
        const bsToast = bootstrap.Toast.getInstance(toast);
        if (bsToast) {
            bsToast.hide();
        }
    }
}

/**
 * ACTUALIZAR ESTADO DE CONEXIÓN
 */
function updateConnectionStatus(status) {
    const connectionStatus = document.getElementById('connectionStatus');
    const connectionText = document.getElementById('connectionText');
    
    if (!connectionStatus || !connectionText) return;
    
    connectionStatus.classList.remove('d-none');
    
    switch (status) {
        case 'connected':
            connectionStatus.className = 'connection-status connected';
            connectionText.textContent = 'Conectado';
            break;
        case 'mock':
            connectionStatus.className = 'connection-status connecting';
            connectionText.textContent = 'Modo Demo';
            break;
        case 'error':
            connectionStatus.className = 'connection-status disconnected';
            connectionText.textContent = 'Sin conexión';
            break;
    }
    
    // Ocultar después de 3 segundos si está conectado
    if (status === 'connected') {
        setTimeout(() => {
            connectionStatus.classList.add('d-none');
        }, 3000);
    }
}

/**
 * ACTUALIZAR TIEMPO DE ÚLTIMA ACTUALIZACIÓN
 */
function updateLastUpdateTime() {
    appState.cache.lastRefresh = new Date();
    console.log(`🕒 Última actualización: ${appState.cache.lastRefresh.toLocaleTimeString()}`);
}

/**
 * VERIFICAR ACTUALIZACIONES
 */
async function checkForUpdates() {
    if (!appState.ui.apiConnected) return;
    
    try {
        const response = await projectAPI.getAllProjects();
        if (response.success) {
            await processProjectsData(response.data);
            console.log('🔄 Datos actualizados automáticamente');
        }
    } catch (error) {
        console.warn('Error en actualización automática:', error);
    }
}

/**
 * CONFIGURAR LAZY LOADING
 */
function setupLazyLoading() {
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Cargar contenido adicional si es necesario
                    console.log('🔍 Elemento visible:', entry.target);
                }
            });
        });
        
        // Observar contenedores de proyectos
        const containers = document.querySelectorAll('.projects-container');
        containers.forEach(container => observer.observe(container));
    }
}

/**
 * CONFIGURAR DETECCIÓN DE CAMBIO DE VENTANA
 */
function setupWindowResize() {
    let resizeTimeout;
    
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            console.log('📱 Ventana redimensionada, ajustando layout...');
            // Reinicializar tooltips o ajustar layout si es necesario
            initializeTooltips();
        }, 250);
    });
}

/**
 * CONFIGURAR DETECCIÓN DE RED
 */
function setupNetworkDetection() {
    window.addEventListener('online', () => {
        appState.ui.apiConnected = true;
        updateConnectionStatus('connected');
        showToast('✅ Conexión restaurada', 'success');
        checkForUpdates();
    });
    
    window.addEventListener('offline', () => {
        appState.ui.apiConnected = false;
        updateConnectionStatus('error');
        showToast('📡 Sin conexión a internet', 'warning');
    });
}

/**
 * CONFIGURAR MANEJO DE ERRORES GLOBAL
 */
function setupGlobalErrorHandling() {
    window.addEventListener('error', (event) => {
        console.error('💥 Error global capturado:', event.error);
        
        if (APP_CONFIG.debugMode) {
            showToast(`Error: ${event.error.message}`, 'error');
        }
    });
    
    window.addEventListener('unhandledrejection', (event) => {
        console.error('💥 Promesa rechazada no manejada:', event.reason);
        
        if (APP_CONFIG.debugMode) {
            showToast('Error en operación asíncrona', 'error');
        }
    });
}

/**
 * TOGGLE MODO DEBUG
 */
function toggleDebugMode() {
    APP_CONFIG.debugMode = !APP_CONFIG.debugMode;
    console.log(`🐛 Modo debug: ${APP_CONFIG.debugMode ? 'ACTIVADO' : 'DESACTIVADO'}`);
    
    if (APP_CONFIG.debugMode) {
        showToast('Modo debug activado', 'info');
        console.log('Estado de la aplicación:', appState);
        console.log('Estadísticas de caché:', window.apiDebug?.getCacheStats());
    }
}

/**
 * MANEJO DEL MODAL DE PROYECTO
 */
function setupProjectModal() {
    const createProjectBtn = document.getElementById('createProjectBtn');
    const createFirstProject = document.getElementById('createFirstProject');
    const saveProjectBtn = document.getElementById('saveProjectBtn');
    const projectForm = document.getElementById('projectForm');
    
    if (createProjectBtn) {
        createProjectBtn.addEventListener('click', () => openProjectModal());
    }
    
    if (createFirstProject) {
        createFirstProject.addEventListener('click', () => openProjectModal());
    }
    
    if (saveProjectBtn && projectForm) {
        saveProjectBtn.addEventListener('click', () => handleSaveProject());
    }
}

/**
 * ABRIR MODAL DE PROYECTO
 */
function openProjectModal(project = null) {
    const modal = document.getElementById('projectModal');
    const modalTitle = document.getElementById('projectModalLabel');
    const form = document.getElementById('projectForm');
    
    if (!modal || !form) return;
    
    // Limpiar formulario
    form.reset();
    
    if (project) {
        // Modo edición
        modalTitle.textContent = 'Editar Proyecto';
        document.getElementById('projectId').value = project.id;
        document.getElementById('projectName').value = project.name;
        document.getElementById('projectDescription').value = project.description;
        document.getElementById('projectStartDate').value = project.startDate?.split('T')[0] || '';
        document.getElementById('projectEndDate').value = project.endDate?.split('T')[0] || '';
        document.getElementById('projectStatus').value = project.status;
    } else {
        // Modo creación
        modalTitle.textContent = 'Crear Nuevo Proyecto';
        document.getElementById('projectStartDate').value = new Date().toISOString().split('T')[0];
    }
    
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

/**
 * GUARDAR PROYECTO
 */
async function handleSaveProject() {
    const form = document.getElementById('projectForm');
    const saveBtn = document.getElementById('saveProjectBtn');
    
    if (!form || !form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const formData = new FormData(form);
    const projectData = {
        name: formData.get('name'),
        description: formData.get('description'),
        startDate: formData.get('startDate'),
        endDate: formData.get('endDate'),
        status: formData.get('status')
    };
    
    const projectId = formData.get('projectId');
    const isEdit = projectId && projectId !== '';
    
    // Mostrar estado de carga
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Guardando...';
    saveBtn.disabled = true;
    
    try {
        let response;
        
        if (isEdit) {
            response = await projectAPI.updateProject(projectId, projectData);
        } else {
            response = await projectAPI.createProject(projectData);
        }
        
        if (response.success) {
            showToast(`✅ Proyecto ${isEdit ? 'actualizado' : 'creado'} correctamente`, 'success');
            
            // Cerrar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('projectModal'));
            modal.hide();
            
            // Recargar datos
            await loadInitialData();
        } else {
            showToast(`❌ Error: ${response.error}`, 'error');
        }
        
    } catch (error) {
        console.error('Error al guardar proyecto:', error);
        showToast('❌ Error de conexión al guardar', 'error');
    } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    }
}

/**
 * INICIALIZAR MEJORAS AL CARGAR
 */
document.addEventListener('DOMContentLoaded', function() {
    // Configurar modal de proyecto
    setupProjectModal();
    
    // Verificar si hay mensajes del servidor
    const urlParams = new URLSearchParams(window.location.search);
    const message = urlParams.get('message');
    const messageType = urlParams.get('type');
    
    if (message) {
        showToast(decodeURIComponent(message), messageType || 'info');
        
        // Limpiar URL
        window.history.replaceState({}, '', window.location.pathname);
    }
});

console.log('🔧 Mejoras adicionales de App.js cargadas');