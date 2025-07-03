/**
 * ===============================================
 * API.JS - FUNCIONES DE CONEXIÓN CON BACKEND (MEJORADO)
 * Este archivo contiene todas las funciones para comunicarse
 * con el backend del sistema de gestión de tareas.
 * 
 * NOTA PARA BACKEND
 :
 * - Todos los endpoints están preparados para el formato REST
 * - Se incluye manejo de errores y estados de carga
 * - Los datos se envían/reciben en formato JSON
 * - Se incluye autenticación básica preparada
>>>>>>> cede44a408f8d2db236b6ffe601d294c498f9d2b
 * ===============================================
 */

/**
 * CONFIGURACIÓN GLOBAL DE LA API
 */
const API_CONFIG = {
    baseURL: 'http://localhost:3000/api',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    retryAttempts: 3,
    retryDelay: 1000 // 1 segundo entre reintentos
};

/**
 * CACHÉ LOCAL PARA OPTIMIZAR PETICIONES
 */
const apiCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

/**
 * CREAR ABORTCONTROLLER CON TIMEOUT COMPATIBLE
 * @param {number} timeout - Timeout en milisegundos
 * @returns {AbortController} Controller con timeout
 */
function createTimeoutController(timeout) {
    const controller = new AbortController();
    
    // Crear timeout manual para compatibilidad
    setTimeout(() => {
        controller.abort();
    }, timeout);
    
    return controller;
}

/**
 * FUNCIÓN PARA DORMIR (DELAY)
 * @param {number} ms - Milisegundos a esperar
 * @returns {Promise} Promesa que se resuelve después del delay
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * GENERAR CLAVE DE CACHÉ
 * @param {string} endpoint - Endpoint de la API
 * @param {string} method - Método HTTP
 * @param {Object} data - Datos de la petición
 * @returns {string} Clave única para caché
 */
function generateCacheKey(endpoint, method, data) {
    return `${method}_${endpoint}_${JSON.stringify(data || {})}`;
}

/**
 * VERIFICAR SI HAY DATOS EN CACHÉ VÁLIDOS
 * @param {string} cacheKey - Clave del caché
 * @returns {Object|null} Datos del caché o null si no existe/expiró
 */
function getCachedData(cacheKey) {
    const cached = apiCache.get(cacheKey);
    
    if (!cached) return null;
    
    // Verificar si el caché ha expirado
    if (Date.now() - cached.timestamp > CACHE_DURATION) {
        apiCache.delete(cacheKey);
        return null;
    }
    
    console.log(`Datos obtenidos desde caché: ${cacheKey}`);
    return cached.data;
}

/**
 * GUARDAR DATOS EN CACHÉ
 * @param {string} cacheKey - Clave del caché
 * @param {Object} data - Datos a cachear
 */
function setCachedData(cacheKey, data) {
    apiCache.set(cacheKey, {
        data: data,
        timestamp: Date.now()
    });
    console.log(`Datos guardados en caché: ${cacheKey}`);
}

/**
 * CLASE PRINCIPAL PARA MANEJO DE LA API (MEJORADA)
 */
class ProjectAPI {
    constructor() {
        this.baseURL = API_CONFIG.baseURL;
        this.headers = API_CONFIG.headers;
        this.isOnline = navigator.onLine;
        
        // Escuchar eventos de conexión
        this.setupNetworkListeners();
    }

    /**
     * CONFIGURAR LISTENERS DE RED
     */
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('🌐 Conexión a internet restaurada');
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('📡 Sin conexión a internet');
        });
    }

    /**
     * MÉTODO GENÉRICO MEJORADO PARA REALIZAR PETICIONES HTTP
     * @param {string} endpoint - Endpoint de la API
     * @param {string} method - Método HTTP (GET, POST, PUT, DELETE)
     * @param {Object} data - Datos a enviar (opcional)
     * @param {Object} options - Opciones adicionales
     * @returns {Promise} - Promesa con la respuesta de la API
     */
    async makeRequest(endpoint, method = 'GET', data = null, options = {}) {
        const {
            useCache = method === 'GET',
            skipRetry = false,
            timeout = API_CONFIG.timeout
        } = options;

        // Verificar conexión a internet
        if (!this.isOnline) {
            return {
                success: false,
                error: 'Sin conexión a internet',
                code: 'OFFLINE'
            };
        }

        // Generar clave de caché
        const cacheKey = generateCacheKey(endpoint, method, data);

        // Intentar obtener desde caché (solo para GET)
        if (useCache) {
            const cachedData = getCachedData(cacheKey);
            if (cachedData) {
                return cachedData;
            }
        }

        // Realizar petición con reintentos
        return await this.makeRequestWithRetry(endpoint, method, data, timeout, cacheKey, useCache, skipRetry);
    }

    /**
     * REALIZAR PETICIÓN CON LÓGICA DE REINTENTOS
     * @param {string} endpoint - Endpoint de la API
     * @param {string} method - Método HTTP
     * @param {Object} data - Datos a enviar
     * @param {number} timeout - Timeout de la petición
     * @param {string} cacheKey - Clave del caché
     * @param {boolean} useCache - Si usar caché
     * @param {boolean} skipRetry - Si omitir reintentos
     * @returns {Promise} Promesa con la respuesta
     */
    async makeRequestWithRetry(endpoint, method, data, timeout, cacheKey, useCache, skipRetry) {
        let lastError = null;
        const maxAttempts = skipRetry ? 1 : API_CONFIG.retryAttempts;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                console.log(`🔄 Intento ${attempt}/${maxAttempts}: ${method} ${endpoint}`);

                const controller = createTimeoutController(timeout);
                
                const config = {
                    method: method,
                    headers: { ...this.headers },
                    signal: controller.signal
                };

                // Agregar datos al cuerpo si es necesario
                if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
                    config.body = JSON.stringify(data);
                }

                // Realizar la petición
                const response = await fetch(`${this.baseURL}${endpoint}`, config);

                // Verificar si la respuesta es exitosa
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                // Obtener datos de respuesta
                const responseData = await response.json();
                
                const result = {
                    success: true,
                    data: responseData,
                    status: response.status
                };

                // Guardar en caché si es exitoso (solo GET)
                if (useCache && method === 'GET') {
                    setCachedData(cacheKey, result);
                }

                console.log(`✅ Petición exitosa: ${method} ${endpoint}`);
                return result;

            } catch (error) {
                lastError = error;
                console.warn(`❌ Error en intento ${attempt}: ${error.message}`);

                // Si no es el último intento, esperar antes de reintentar
                if (attempt < maxAttempts) {
                    await sleep(API_CONFIG.retryDelay * attempt); // Delay progresivo
                }
            }
        }

        // Si llegamos aquí, todos los intentos fallaron
        return this.handleRequestError(lastError);
    }

    /**
     * MANEJAR ERRORES DE PETICIÓN
     * @param {Error} error - Error capturado
     * @returns {Object} Objeto de respuesta de error
     */
    handleRequestError(error) {
        console.error(`💥 Petición fallida después de ${API_CONFIG.retryAttempts} intentos:`, error);

        // Manejar diferentes tipos de errores
        if (error.name === 'AbortError') {
            return {
                success: false,
                error: 'Timeout: La petición tardó demasiado tiempo',
                code: 'TIMEOUT'
            };
        }

        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            return {
                success: false,
                error: 'Error de conexión: No se puede conectar al servidor',
                code: 'CONNECTION_ERROR'
            };
        }

        if (error.message.includes('HTTP 404')) {
            return {
                success: false,
                error: 'Recurso no encontrado',
                code: 'NOT_FOUND'
            };
        }

        if (error.message.includes('HTTP 401')) {
            return {
                success: false,
                error: 'No autorizado: Verifique sus credenciales',
                code: 'UNAUTHORIZED'
            };
        }

        if (error.message.includes('HTTP 403')) {
            return {
                success: false,
                error: 'Acceso denegado: No tiene permisos suficientes',
                code: 'FORBIDDEN'
            };
        }

        if (error.message.includes('HTTP 500')) {
            return {
                success: false,
                error: 'Error interno del servidor',
                code: 'SERVER_ERROR'
            };
        }

        return {
            success: false,
            error: error.message || 'Error desconocido',
            code: 'UNKNOWN_ERROR'
        };
    }

    /**
     * VERIFICAR ESTADO DEL SERVIDOR
     * @returns {Promise} Estado del servidor
     */
    async checkHealth() {
    console.log('🏥 Verificando estado del servidor...');
    return await this.makeRequest('/health', 'GET', null, { 
        useCache: false, 
        skipRetry: true,
        timeout: 5000 
    });
}

    /**
     * OBTENER TODOS LOS PROYECTOS (CON CACHÉ)
     * @returns {Promise} Lista de todos los proyectos
     */
    async getAllProjects() {
        console.log('🔄 Obteniendo todos los proyectos...');
        return await this.makeRequest('/projects', 'GET');
    }

    /**
     * OBTENER PROYECTOS POR ESTADO (CON CACHÉ)
     * @param {string} status - Estado del proyecto ('en_proceso' o 'terminado')
     * @returns {Promise} Lista de proyectos filtrados por estado
     */
    async getProjectsByStatus(status) {
    console.log(`🔄 Obteniendo proyectos con estado: ${status}...`);
    
    // Primero obtenemos todos los proyectos
    const allProjects = await this.getAllProjects();
    
    if (!allProjects.success) {
        return allProjects;
    }
    
    // Filtramos por estado en el frontend
    const filteredProjects = allProjects.data.filter(project => project.status === status);
    
    return {
        success: true,
        data: filteredProjects,
        status: 200
    };
}

    /**
     * BUSCAR PROYECTOS POR NOMBRE O ID (CON CACHÉ)
     * @param {string} searchTerm - Término de búsqueda
     * @returns {Promise} Lista de proyectos que coinciden con la búsqueda
     */
    async searchProjects(searchTerm) {
        if (!searchTerm || searchTerm.trim().length === 0) {
            return {
                success: true,
                data: [],
                status: 200
            };
        }

        console.log(`🔍 Buscando proyectos: "${searchTerm}"...`);
        const encodedTerm = encodeURIComponent(searchTerm.trim());
        return await this.makeRequest(`/projects/search?q=${encodedTerm}`, 'GET');
    }

    /**
     * OBTENER UN PROYECTO ESPECÍFICO (CON CACHÉ)
     * @param {string} projectId - ID del proyecto
     * @returns {Promise} Datos del proyecto específico
     */
    async getProjectById(projectId) {
        if (!projectId) {
            return {
                success: false,
                error: 'ID de proyecto requerido',
                code: 'VALIDATION_ERROR'
            };
        }

        console.log(`Obteniendo proyecto ID: ${projectId}...`);
        return await this.makeRequest(`/projects/${encodeURIComponent(projectId)}`, 'GET');
    }

    /**
     * CREAR UN NUEVO PROYECTO (SIN CACHÉ)
     * @param {Object} projectData - Datos del nuevo proyecto
     * @returns {Promise} Proyecto creado
     */
    async createProject(projectData) {
        // Validar datos antes de enviar
        const validation = this.validateProjectData(projectData, true);
        if (!validation.isValid) {
            return {
                success: false,
                error: `Datos inválidos: ${validation.errors.join(', ')}`,
                code: 'VALIDATION_ERROR'
            };
        }

        console.log('Creando nuevo proyecto...', projectData);
        const result = await this.makeRequest('/projects', 'POST', projectData, { useCache: false });
        
        // Limpiar caché relacionado si la creación fue exitosa
        if (result.success) {
            this.clearProjectsCache();
        }
        
        return result;
    }

    /**
     * ACTUALIZAR UN PROYECTO EXISTENTE (SIN CACHÉ)
     * @param {string} projectId - ID del proyecto a actualizar
     * @param {Object} projectData - Datos actualizados del proyecto
     * @returns {Promise} Proyecto actualizado
     */
    async updateProject(projectId, projectData) {
        if (!projectId) {
            return {
                success: false,
                error: 'ID de proyecto requerido',
                code: 'VALIDATION_ERROR'
            };
        }

        // Validar datos antes de enviar
        const validation = this.validateProjectData(projectData, false);
        if (!validation.isValid) {
            return {
                success: false,
                error: `Datos inválidos: ${validation.errors.join(', ')}`,
                code: 'VALIDATION_ERROR'
            };
        }

        console.log(`📝 Actualizando proyecto ID: ${projectId}...`, projectData);
        const result = await this.makeRequest(`/projects/${encodeURIComponent(projectId)}`, 'PUT', projectData, { useCache: false });
        
        // Limpiar caché relacionado si la actualización fue exitosa
        if (result.success) {
            this.clearProjectCache(projectId);
        }
        
        return result;
    }

    /**
     * ELIMINAR UN PROYECTO (SIN CACHÉ)
     * @param {string} projectId - ID del proyecto a eliminar
     * @returns {Promise} Confirmación de eliminación
     */
    async deleteProject(projectId) {
        if (!projectId) {
            return {
                success: false,
                error: 'ID de proyecto requerido',
                code: 'VALIDATION_ERROR'
            };
        }

        console.log(`🗑️ Eliminando proyecto ID: ${projectId}...`);
        const result = await this.makeRequest(`/projects/${encodeURIComponent(projectId)}`, 'DELETE', null, { useCache: false });
        
        // Limpiar caché relacionado si la eliminación fue exitosa
        if (result.success) {
            this.clearProjectCache(projectId);
        }
        
        return result;
    }

    /**
     * VALIDAR DATOS DE PROYECTO
     * @param {Object} projectData - Datos del proyecto a validar
     * @param {boolean} isCreation - Si es una creación (requiere todos los campos)
     * @returns {Object} Resultado de la validación
     */
    validateProjectData(projectData, isCreation = false) {
        const errors = [];

        if (!projectData || typeof projectData !== 'object') {
            return {
                isValid: false,
                errors: ['Los datos del proyecto deben ser un objeto válido']
            };
        }

        // Campos requeridos para creación
        if (isCreation) {
            if (!projectData.name || typeof projectData.name !== 'string' || projectData.name.trim().length === 0) {
                errors.push('El nombre del proyecto es requerido');
            }

            if (!projectData.startDate) {
                errors.push('La fecha de inicio es requerida');
            }

            if (!projectData.endDate) {
                errors.push('La fecha de finalización es requerida');
            }
        }

        // Validar nombre si está presente
        if (projectData.name !== undefined) {
            if (typeof projectData.name !== 'string' || projectData.name.trim().length === 0) {
                errors.push('El nombre del proyecto debe ser un texto válido');
            } else if (projectData.name.trim().length > 100) {
                errors.push('El nombre del proyecto no puede exceder 100 caracteres');
            }
        }

        // Validar fechas si están presentes
        if (projectData.startDate !== undefined) {
            if (!this.isValidDate(projectData.startDate)) {
                errors.push('La fecha de inicio debe ser válida (formato: YYYY-MM-DD)');
            }
        }

        if (projectData.endDate !== undefined) {
            if (!this.isValidDate(projectData.endDate)) {
                errors.push('La fecha de finalización debe ser válida (formato: YYYY-MM-DD)');
            }
        }

        // Validar que fecha de fin sea posterior a fecha de inicio
        if (projectData.startDate && projectData.endDate) {
            const startDate = new Date(projectData.startDate);
            const endDate = new Date(projectData.endDate);
            
            if (endDate <= startDate) {
                errors.push('La fecha de finalización debe ser posterior a la fecha de inicio');
            }
        }

        // Validar estado si está presente
        if (projectData.status !== undefined) {
            const validStatuses = ['en_proceso', 'terminado'];
            if (!validStatuses.includes(projectData.status)) {
                errors.push('El estado debe ser "en_proceso" o "terminado"');
            }
        }

        // Validar descripción si está presente
        if (projectData.description !== undefined) {
            if (typeof projectData.description !== 'string') {
                errors.push('La descripción debe ser texto');
            } else if (projectData.description.length > 500) {
                errors.push('La descripción no puede exceder 500 caracteres');
            }
        }

        // Validar usuarios si están presentes
        if (projectData.users !== undefined) {
            if (!Array.isArray(projectData.users)) {
                errors.push('Los usuarios deben ser un arreglo');
            } else if (projectData.users.length > 7) {
                errors.push('No se pueden asignar más de 7 usuarios por proyecto');
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * VALIDAR SI UNA FECHA ES VÁLIDA
     * @param {string} dateString - Fecha en formato string
     * @returns {boolean} Si la fecha es válida
     */
    isValidDate(dateString) {
        if (!dateString) return false;
        
        // Verificar formato YYYY-MM-DD
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateString)) return false;
        
        // Verificar que la fecha sea válida
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date) && date.toISOString().slice(0, 10) === dateString;
    }

    /**
     * LIMPIAR CACHÉ DE TODOS LOS PROYECTOS
     */
    clearProjectsCache() {
        const keysToDelete = [];
        
        for (let key of apiCache.keys()) {
            if (key.includes('/projects')) {
                keysToDelete.push(key);
            }
        }
        
        keysToDelete.forEach(key => apiCache.delete(key));
        console.log(`🧹 Caché de proyectos limpiado: ${keysToDelete.length} entradas eliminadas`);
    }

    /**
     * LIMPIAR CACHÉ DE UN PROYECTO ESPECÍFICO
     * @param {string} projectId - ID del proyecto
     */
    clearProjectCache(projectId) {
        const keysToDelete = [];
        
        for (let key of apiCache.keys()) {
            if (key.includes(`/projects/${projectId}`) || key.includes('/projects')) {
                keysToDelete.push(key);
            }
        }
        
        keysToDelete.forEach(key => apiCache.delete(key));
        console.log(`🧹 Caché del proyecto ${projectId} limpiado`);
    }

    /**
     * OBTENER ESTADÍSTICAS DEL CACHÉ
     * @returns {Object} Estadísticas del caché
     */
    getCacheStats() {
        return {
            totalEntries: apiCache.size,
            entries: Array.from(apiCache.keys()),
            sizeInMemory: JSON.stringify(Array.from(apiCache)).length
        };
    }
}

/**
 * ===============================================
 * FUNCIONES AUXILIARES MEJORADAS
 * ===============================================
 */

/**
 * FORMATEAR FECHA PARA MOSTRAR EN LA UI (MEJORADO)
 * @param {string} dateString - Fecha en formato ISO
 * @param {Object} options - Opciones de formato
 * @returns {string} Fecha formateada para mostrar
 */
function formatDate(dateString, options = {}) {
    if (!dateString) return 'No definida';
    
    const {
        locale = 'es-ES',
        includeTime = false,
        shortFormat = false
    } = options;
    
    try {
        const date = new Date(dateString);
        
        if (isNaN(date.getTime())) {
            throw new Error('Fecha inválida');
        }
        
        if (shortFormat) {
            return date.toLocaleDateString(locale, {
                day: '2-digit',
                month: '2-digit'
            });
        }
        
        const formatOptions = {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        };
        
        if (includeTime) {
            formatOptions.hour = '2-digit';
            formatOptions.minute = '2-digit';
        }
        
        return date.toLocaleDateString(locale, formatOptions);
        
    } catch (error) {
        console.error('Error al formatear fecha:', error);
        return 'Fecha inválida';
    }
}

/**
 * CALCULAR DÍAS RESTANTES HASTA LA FECHA DE FINALIZACIÓN (MEJORADO)
 * @param {string} endDateString - Fecha de finalización en formato ISO
 * @param {string} startDateString - Fecha de inicio (opcional)
 * @returns {Object} Información detallada de días restantes
 */
function calculateDaysRemaining(endDateString, startDateString = null) {
    if (!endDateString) return { days: null, status: 'unknown', percentage: 0 };
    
    try {
        const endDate = new Date(endDateString);
        const today = new Date();
        const startDate = startDateString ? new Date(startDateString) : null;
        
        // Normalizar fechas a medianoche para cálculo preciso
        endDate.setHours(23, 59, 59, 999);
        today.setHours(0, 0, 0, 0);
        
        const diffTime = endDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let status = 'active';
        let percentage = 0;
        
        // Calcular porcentaje de progreso si hay fecha de inicio
        if (startDate) {
            const totalTime = endDate.getTime() - startDate.getTime();
            const elapsedTime = today.getTime() - startDate.getTime();
            percentage = Math.max(0, Math.min(100, (elapsedTime / totalTime) * 100));
        }
        
        // Determinar estado
        if (diffDays < 0) {
            status = 'overdue';
        } else if (diffDays === 0) {
            status = 'today';
        } else if (diffDays <= 7) {
            status = 'warning';
        } else {
            status = 'active';
        }
        
        return {
            days: diffDays,
            status: status,
            percentage: Math.round(percentage),
            isOverdue: diffDays < 0,
            isToday: diffDays === 0,
            isUrgent: diffDays > 0 && diffDays <= 3
        };
        
    } catch (error) {
        console.error('Error al calcular días restantes:', error);
        return { days: null, status: 'error', percentage: 0 };
    }
}

/**
 * VALIDAR ESTRUCTURA DE DATOS DE PROYECTO (MEJORADO)
 * @param {Object} project - Objeto de proyecto a validar
 * @param {boolean} strict - Validación estricta (todos los campos requeridos)
 * @returns {Object} Resultado de la validación con detalles
 */
function validateProjectData(project, strict = false) {
    const errors = [];
    const warnings = [];
    
    if (!project || typeof project !== 'object') {
        return {
            isValid: false,
            errors: ['El proyecto debe ser un objeto válido'],
            warnings: []
        };
    }
    
    // Campos requeridos básicos
    const requiredFields = ['id', 'name', 'status'];
    const requiredForComplete = ['startDate', 'endDate', 'description'];
    
    // Validar campos requeridos básicos
    requiredFields.forEach(field => {
        if (!project.hasOwnProperty(field) || project[field] === null || project[field] === undefined || project[field] === '') {
            errors.push(`Campo requerido faltante: ${field}`);
        }
    });
    
    // Validar campos requeridos para proyecto completo
    if (strict) {
        requiredForComplete.forEach(field => {
            if (!project.hasOwnProperty(field) || project[field] === null || project[field] === undefined || project[field] === '') {
                errors.push(`Campo requerido para proyecto completo: ${field}`);
            }
        });
    }
    
    // Validar tipos de datos
    if (project.name && typeof project.name !== 'string') {
        errors.push('El nombre debe ser texto');
    }
    
    if (project.description && typeof project.description !== 'string') {
        errors.push('La descripción debe ser texto');
    }
    
    if (project.status && !['en_proceso', 'terminado'].includes(project.status)) {
        errors.push('El estado debe ser "en_proceso" o "terminado"');
    }
    
    // Validar fechas
    if (project.startDate && !isValidISODate(project.startDate)) {
        errors.push('La fecha de inicio debe estar en formato válido (YYYY-MM-DD)');
    }
    
    if (project.endDate && !isValidISODate(project.endDate)) {
        errors.push('La fecha de finalización debe estar en formato válido (YYYY-MM-DD)');
    }
    
    // Validar lógica de fechas
    if (project.startDate && project.endDate) {
        const start = new Date(project.startDate);
        const end = new Date(project.endDate);
        
        if (end <= start) {
            errors.push('La fecha de finalización debe ser posterior a la fecha de inicio');
        }
        
        // Advertencia si el proyecto es muy largo (más de 2 años)
        const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        if (diffMonths > 24) {
            warnings.push('El proyecto tiene una duración muy larga (más de 2 años)');
        }
    }
    
    // Validar usuarios
    if (project.users) {
        if (!Array.isArray(project.users)) {
            errors.push('Los usuarios deben ser un arreglo');
        } else {
            if (project.users.length > 7) {
                errors.push('No se pueden asignar más de 7 usuarios por proyecto');
            }
            
            // Validar estructura de cada usuario
            project.users.forEach((user, index) => {
                if (!user.id) {
                    errors.push(`Usuario en posición ${index} debe tener ID`);
                }
                if (!user.name) {
                    warnings.push(`Usuario en posición ${index} no tiene nombre`);
                }
            });
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors,
        warnings: warnings
    };
}

/**
 * VALIDAR FECHA EN FORMATO ISO
 * @param {string} dateString - Fecha a validar
 * @returns {boolean} Si la fecha es válida
 */
function isValidISODate(dateString) {
    if (!dateString || typeof dateString !== 'string') return false;
    
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
}

/**
 * GENERAR ID ÚNICO TEMPORAL PARA NUEVOS PROYECTOS (MEJORADO)
 * @param {string} prefix - Prefijo opcional
 * @returns {string} ID único temporal
 */
function generateTempId(prefix = 'TEMP') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}`.toUpperCase();
}

/**
 * ESCAPAR HTML PARA PREVENIR XSS (MEJORADO)
 * @param {string} text - Texto a escapar
 * @returns {string} Texto escapado seguro para HTML
 */
function escapeHtml(text) {
    if (!text || typeof text !== 'string') return '';
    
    const htmlEscapes = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;'
    };
    
    return text.replace(/[&<>"'\/]/g, function(match) {
        return htmlEscapes[match];
    });
}

/**
 * FORMATEAR TEXTO PARA BÚSQUEDA (NORMALIZAR)
 * @param {string} text - Texto a normalizar
 * @returns {string} Texto normalizado para búsqueda
 */
function normalizeForSearch(text) {
    if (!text) return '';
    
    return text
        .toLowerCase()
        .normalize('NFD') // Descomponer caracteres acentuados
        .replace(/[\u0300-\u036f]/g, '') // Remover acentos
        .replace(/[^\w\s]/g, '') // Remover caracteres especiales
        .trim();
}

/**
 * TRUNCAR TEXTO CON PUNTOS SUSPENSIVOS
 * @param {string} text - Texto a truncar
 * @param {number} maxLength - Longitud máxima
 * @returns {string} Texto truncado
 */
function truncateText(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3).trim() + '...';
}

/**
 * CALCULAR PROGRESO DE PROYECTO
 * @param {Object} project - Datos del proyecto
 * @returns {Object} Información de progreso
 */
function calculateProjectProgress(project) {
    if (!project.startDate || !project.endDate) {
        return { percentage: 0, status: 'unknown' };
    }
    
    const start = new Date(project.startDate);
    const end = new Date(project.endDate);
    const now = new Date();
    
    const totalDuration = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    
    let percentage = Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));
    
    let status = 'active';
    if (project.status === 'terminado') {
        percentage = 100;
        status = 'completed';
    } else if (now > end) {
        status = 'overdue';
    } else if (percentage > 75) {
        status = 'near_completion';
    }
    
    return {
        percentage: Math.round(percentage),
        status: status
    };
}

/**
 * ===============================================
 * INSTANCIA GLOBAL Y CONFIGURACIÓN
 * ===============================================
 */

// Crear instancia global de la API
const projectAPI = new ProjectAPI();

/**
 * DATOS MOCK MEJORADOS PARA DESARROLLO Y TESTING
 */
const MOCK_DATA = {
    projects: [
        {
            id: "1",
            name: "Sistema de Inventario",
            startDate: "2025-01-15",
            endDate: "2025-03-15",
            description: "Desarrollo de sistema integral para gestión de inventario con funcionalidades de seguimiento en tiempo real, reportes automatizados y alertas de stock bajo.",
            status: "en_proceso",
            priority: "alta",
            users: [
                {
                    id: "1",
                    name: "María González",
                    role: "admin",
                    profileImage: "https://images.unsplash.com/photo-1494790108755-2616b9ec3b1a?w=150&h=150&fit=crop&crop=face"
                },
                {
                    id: "2", 
                    name: "Carlos Mendoza",
                    role: "miembro",
                    profileImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face"
                }
            ]
        },
        {
            id: "2",
            name: "App Móvil E-commerce",
            startDate: "2025-02-01",
            endDate: "2025-05-30",
            description: "Aplicación móvil completa para comercio electrónico con carrito de compras, pagos seguros, seguimiento de pedidos y notificaciones push.",
            status: "en_proceso",
            priority: "alta",
            users: [
                {
                    id: "3",
                    name: "Roberto Silva",
                    role: "admin",
                    profileImage: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face"
                }
            ]
        },
        {
            id: "3",
            name: "Portal Web Corporativo",
            startDate: "2024-11-01",
            endDate: "2025-01-15",
            description: "Sitio web corporativo moderno con sistema de gestión de contenidos, blog integrado y panel administrativo completo.",
            status: "terminado",
            priority: "media",
            users: [
                {
                    id: "4",
                    name: "Diego Herrera",
                    role: "admin",
                    profileImage: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face"
                }
            ]
        }
    ]
};

/**
 * FUNCIÓN PARA SIMULAR RESPUESTA DE API (MODO DESARROLLO MEJORADO)
 * @param {Array} data - Datos a retornar
 * @param {number} delay - Delay en milisegundos para simular latencia
 * @param {number} errorRate - Probabilidad de error (0-1)
 * @returns {Promise} Promesa con datos mock
 */
async function mockApiResponse(data, delay = 500, errorRate = 0) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // Simular errores ocasionales para testing
            if (Math.random() < errorRate) {
                reject(new Error('Error simulado de red'));
                return;
            }
            
            resolve({
                success: true,
                data: data,
                status: 200,
                timestamp: new Date().toISOString()
            });
        }, delay);
    });
}

/**
 * FUNCIONES DE UTILIDAD PARA MOCK DATA
 */
const MockDataUtils = {
    /**
     * Filtrar proyectos mock por estado
     */
    filterByStatus: (status) => {
        return MOCK_DATA.projects.filter(p => p.status === status);
    },
    
    /**
     * Buscar en proyectos mock
     */
    search: (term) => {
        if (!term) return MOCK_DATA.projects;
        
        const normalizedTerm = normalizeForSearch(term);
        
        return MOCK_DATA.projects.filter(project => {
            const searchableText = `${project.name} ${project.id} ${project.description}`;
            return normalizeForSearch(searchableText).includes(normalizedTerm);
        });
    },
    
    /**
     * Obtener proyecto mock por ID
     */
    getById: (id) => {
        return MOCK_DATA.projects.find(p => p.id === id);
    }
};

/**
 * ===============================================
 * EXPORTAR FUNCIONES PARA USO GLOBAL
 * ===============================================
 */
window.ProjectAPI = ProjectAPI;
window.projectAPI = projectAPI;
window.formatDate = formatDate;
window.calculateDaysRemaining = calculateDaysRemaining;
window.validateProjectData = validateProjectData;
window.generateTempId = generateTempId;
window.escapeHtml = escapeHtml;
window.normalizeForSearch = normalizeForSearch;
window.truncateText = truncateText;
window.calculateProjectProgress = calculateProjectProgress;
window.MOCK_DATA = MOCK_DATA;
window.MockDataUtils = MockDataUtils;
window.mockApiResponse = mockApiResponse;

// Configuración adicional para debugging
window.apiDebug = {
    cache: apiCache,
    clearCache: () => {
        apiCache.clear();
        console.log('🧹 Todo el caché limpiado');
    },
    getCacheStats: () => projectAPI.getCacheStats(),
    testConnection: () => projectAPI.checkHealth()
};

console.log('API.js mejorado cargado completamente');
console.log('Funciones de debug disponibles en window.apiDebug');
window.mockApiResponse = mockApiResponse;

const APP_CONFIG = {
    searchDelay: 300,
    animationDuration: 300,
    tooltipDelay: 500,
    retryAttempts: 3,
    useMockData: false, // 🔥 CAMBIAR A FALSE para usar API real
    cacheRefreshInterval: 30000,
    maxSearchHistory: 10,
    autoSaveInterval: 60000,
    debugMode: false
};

/**
 * FUNCIONES ADICIONALES PARA MANEJO DE ERRORES
 */

// Agregar esta función al objeto ProjectAPI:
async handleApiError(error, endpoint) {
    console.error(`Error en ${endpoint}:`, error);
    
    // Si no hay conexión, usar datos mock como fallback
    if (error.code === 'CONNECTION_ERROR' || error.code === 'TIMEOUT') {
        console.log('🎭 Fallback a datos mock debido a error de conexión');
        
        // Simular respuesta según el endpoint
        if (endpoint.includes('/projects')) {
            return await mockApiResponse(MOCK_DATA.projects, 100);
        }
    }
    
    return error;
}

/**
 * VALIDACIÓN DE RESPUESTA DE API
 */
function validateApiResponse(response, endpoint) {
    if (!response) {
        throw new Error('Respuesta vacía del servidor');
    }
    
    if (!response.hasOwnProperty('success')) {
        throw new Error('Formato de respuesta inválido');
    }
    
    if (!response.success && !response.error) {
        throw new Error('Respuesta de error sin mensaje');
    }
    
    return true;
}

/**
 * INTERCEPTOR PARA AGREGAR CSRF TOKEN A PETICIONES POST/PUT/DELETE
 */
function addCsrfTokenToRequest(config, method) {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        // Obtener CSRF token del meta tag o variable global
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') 
                        || window.csrfToken;
        
        if (csrfToken && config.body) {
            const body = JSON.parse(config.body);
            body._csrf = csrfToken;
            config.body = JSON.stringify(body);
        }
    }
    return config;

    
    function showElement(element) {
    if (element) {
        element.classList.remove('d-none');
    }
}

function hideElement(element) {
    if (element) {
        element.classList.add('d-none');
    }
}

/**
 * MOSTRAR ESTADO DE LOADING
 */
function showLoadingState(show) {
    const activeLoading = domElements.activeLoading;
    const completedLoading = domElements.completedLoading;
    
    if (show) {
        showElement(activeLoading);
        showElement(completedLoading);
    } else {
        hideElement(activeLoading);
        hideElement(completedLoading);
    }
    
    appState.ui.isLoading = show;
}

function showElement(element) {
    if (element) {
        element.classList.remove('d-none');
    }
}

function hideElement(element) {
    if (element) {
        element.classList.add('d-none');
    }
}

/**
 * MOSTRAR ESTADO DE LOADING
 */
function showLoadingState(show) {
    const activeLoading = domElements.activeLoading;
    const completedLoading = domElements.completedLoading;
    
    if (show) {
        showElement(activeLoading);
        showElement(completedLoading);
    } else {
        hideElement(activeLoading);
        hideElement(completedLoading);
    }
    
    appState.ui.isLoading = show;
}

/**
 * MOSTRAR/OCULTAR RESULTADOS DE BÚSQUEDA VACÍOS
 */
function showNoSearchResults(show) {
    const noSearchResults = domElements.noSearchResults;
    
    if (show) {
        showElement(noSearchResults);
    } else {
        hideElement(noSearchResults);
    }
}

/**
 * ACTUALIZAR CONTADORES DE PROYECTOS
 */
function updateProjectCounters() {
    const activeCount = document.getElementById('activeCount');
    const completedCount = document.getElementById('completedCount');
    
    if (activeCount) {
        activeCount.textContent = appState.projects.filtered.active.length;
    }
    
    if (completedCount) {
        completedCount.textContent = appState.projects.filtered.completed.length;
    }
}

/**
 * ACTUALIZAR DISPLAY DE ESTADÍSTICAS
 */
function updateStatsDisplay() {
    updateProjectCounters();
    
    // Actualizar estadísticas adicionales si hay contenedor
    const statsContainer = domElements.statsContainer;
    if (statsContainer && appState.stats) {
        statsContainer.innerHTML = `
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-number">${appState.stats.totalProjects}</span>
                    <span class="stat-label">Total</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${appState.stats.activeProjects}</span>
                    <span class="stat-label">Activos</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${appState.stats.completedProjects}</span>
                    <span class="stat-label">Completados</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number text-danger">${appState.stats.overdueProjects}</span>
                    <span class="stat-label">Atrasados</span>
                </div>
            </div>
        `;
    }
}

/**
 * INICIALIZAR TOOLTIPS DE BOOTSTRAP
 */
function initializeTooltips() {
    try {
        // Limpiar tooltips existentes
        const existingTooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        existingTooltips.forEach(el => {
            const tooltip = bootstrap.Tooltip.getInstance(el);
            if (tooltip) {
                tooltip.dispose();
            }
        });
        
        // Inicializar nuevos tooltips
        const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => 
            new bootstrap.Tooltip(tooltipTriggerEl, {
                delay: { show: APP_CONFIG.tooltipDelay, hide: 100 }
            })
        );
        
        console.log(`🔧 ${tooltipList.length} tooltips inicializados`);
    } catch (error) {
        console.warn('Error al inicializar tooltips:', error);
    }
}

/**
 * DESTACAR TÉRMINO DE BÚSQUEDA EN TEXTO
 */
function highlightSearchTerm(text, searchTerm) {
    if (!text || !searchTerm || searchTerm.trim().length === 0) {
        return text || '';
    }
    
    const normalizedTerm = searchTerm.trim();
    const regex = new RegExp(`(${normalizedTerm})`, 'gi');
    
    return text.replace(regex, '<mark class="search-highlight">$1</mark>');
}

/**
 * MOSTRAR ERROR CRÍTICO
 */
function showCriticalError(error) {
    const errorMessage = typeof error === 'string' ? error : error.message || 'Error desconocido';
    
    showToast(`💥 Error crítico: ${errorMessage}`, 'error', 'Error del Sistema');
    
    // Mostrar pantalla de error si es muy grave
    const mainContent = document.querySelector('.main-content');
    if (mainContent && errorMessage.includes('crítico')) {
        mainContent.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-exclamation-triangle display-1 text-danger"></i>
                <h3 class="mt-3">Error del Sistema</h3>
                <p class="text-muted">${escapeHtml(errorMessage)}</p>
                <button class="btn btn-primary" onclick="window.location.reload()">
                    <i class="bi bi-arrow-clockwise me-2"></i>
                    Recargar Página
                </button>
            </div>
        `;
    }
}

/**
 * CREAR HTML PARA MODALES
 */
function createProjectDetailModalHtml(project) {
    return `
        <div class="modal-dialog modal-xl">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        <i class="bi bi-folder-open me-2"></i>
                        ${escapeHtml(project.name)}
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="row">
                        <div class="col-md-8">
                            <h6>Descripción</h6>
                            <p>${escapeHtml(project.description)}</p>
                            
                            <h6>Fechas</h6>
                            <p><strong>Inicio:</strong> ${formatDate(project.startDate)}</p>
                            <p><strong>Entrega:</strong> ${formatDate(project.endDate)}</p>
                            
                            <h6>Estado</h6>
                            <span class="badge ${project.status === 'terminado' ? 'bg-success' : 'bg-primary'}">
                                ${project.status === 'terminado' ? 'Terminado' : 'En Proceso'}
                            </span>
                        </div>
                        <div class="col-md-4">
                            <h6>Equipo del Proyecto</h6>
                            ${generateUsersHTML(project.users, 'modal')}
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <a href="/proyectos/${project.id}" class="btn btn-primary">
                        <i class="bi bi-arrow-right me-1"></i>
                        Ver Detalles Completos
                    </a>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                </div>
            </div>
        </div>
    `;
}

function createCompletedProjectModalHtml(project) {
    return `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header bg-success text-white">
                    <h5 class="modal-title">
                        <i class="bi bi-check-circle me-2"></i>
                        ${escapeHtml(project.name)} - Completado
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <p><strong>Descripción:</strong> ${escapeHtml(project.description)}</p>
                    <p><strong>Completado el:</strong> ${formatDate(project.endDate)}</p>
                    <p><strong>Duración:</strong> ${calculateProjectDuration(project.startDate, project.endDate)}</p>
                    <p><strong>Equipo:</strong> ${project.users?.length || 0} personas</p>
                    
                    <h6>Miembros del Equipo</h6>
                    ${generateUsersHTML(project.users, 'modal')}
                </div>
                <div class="modal-footer">
                    <a href="/proyectos/${project.id}" class="btn btn-outline-primary">
                        Ver Detalles Completos
                    </a>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                </div>
            </div>
        </div>
    `;
}

/**
 * MANEJADORES DE EVENTOS PARA PROYECTOS
 */
function handleProjectOpen(projectId) {
    console.log('🔗 Abriendo proyecto:', projectId);
    window.location.href = `/proyectos/${projectId}`;
}

function handleProjectEdit(projectId) {
    console.log('✏️ Editando proyecto:', projectId);
    
    // Buscar el proyecto en el estado actual
    const project = [...appState.projects.active, ...appState.projects.completed]
        .find(p => p.id == projectId);
    
    if (project) {
        openProjectModal(project);
    } else {
        showToast('❌ Proyecto no encontrado', 'error');
    }
}

async function handleProjectDelete(projectId) {
    const project = [...appState.projects.active, ...appState.projects.completed]
        .find(p => p.id == projectId);
    
    if (!project) {
        showToast('❌ Proyecto no encontrado', 'error');
        return;
    }
    
    const confirmed = confirm(`¿Estás seguro de que quieres eliminar el proyecto "${project.name}"?\n\nEsta acción no se puede deshacer.`);
    
    if (!confirmed) return;
    
    const loadingToast = showLoadingToast('Eliminando proyecto...');
    
    try {
        const response = await projectAPI.deleteProject(projectId);
        
        if (response.success) {
            hideLoadingToast();
            showToast('✅ Proyecto eliminado correctamente', 'success');
            
            // Recargar datos
            await loadInitialData();
        } else {
            hideLoadingToast();
            showToast(`❌ Error: ${response.error}`, 'error');
        }
    } catch (error) {
        hideLoadingToast();
        console.error('Error al eliminar proyecto:', error);
        showToast('❌ Error de conexión al eliminar', 'error');
    }
}

function handleProjectShare(projectId) {
    const project = [...appState.projects.active, ...appState.projects.completed]
        .find(p => p.id == projectId);
    
    if (!project) return;
    
    const shareUrl = `${window.location.origin}/proyectos/${projectId}`;
    
    if (navigator.share) {
        navigator.share({
            title: `Proyecto: ${project.name}`,
            text: project.description,
            url: shareUrl
        });
    } else {
        // Fallback: copiar al portapapeles
        navigator.clipboard.writeText(shareUrl).then(() => {
            showToast('🔗 Enlace copiado al portapapeles', 'success');
        }).catch(() => {
            showToast('❌ No se pudo copiar el enlace', 'error');
        });
    }
}

/**
 * FUNCIÓN PARA REFRESCAR DATOS DE PROYECTOS
 */
async function refreshProjectsData(silent = false) {
    if (!silent) {
        showLoadingState(true);
    }
    
    try {
        const response = await projectAPI.getAllProjects();
        
        if (response.success) {
            await processProjectsData(response.data);
            if (!silent) {
                updateConnectionStatus('connected');
            }
        } else {
            throw new Error(response.error || 'Error al obtener proyectos');
        }
    } catch (error) {
        console.error('Error al refrescar datos:', error);
        if (!silent) {
            updateConnectionStatus('error');
            showToast('⚠️ Error al actualizar datos', 'warning');
        }
    } finally {
        if (!silent) {
            showLoadingState(false);
        }
    }
}

console.log('✅ Funciones auxiliares de App.js cargadas');
    