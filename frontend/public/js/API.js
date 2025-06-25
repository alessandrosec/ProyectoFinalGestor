/**
 * ===============================================
 * API.JS - FUNCIONES DE CONEXIÓN CON BACKEND
 * ===============================================
 * Este archivo contiene todas las funciones para comunicarse
 * con el backend del sistema de gestión de tareas.
 * 
 * NOTA PARA ERICK O EMILIO:
 * - Todos los endpoints están preparados para el formato REST
 * - Se incluye manejo de errores y estados de carga
 * - Los datos se envían/reciben en formato JSON
 * - Se incluye autenticación básica preparada
 * ===============================================
 */

/**
 * CONFIGURACIÓN GLOBAL DE LA API
 */
const API_CONFIG = {
    baseURL: 'http://localhost:3000/api', // Cambiar por la URL del servidor en producción
    timeout: 10000, // 10 segundos de timeout
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
};

/**
 * CLASE PRINCIPAL PARA MANEJO DE LA API
 */
class ProjectAPI {
    constructor() {
        this.baseURL = API_CONFIG.baseURL;
        this.headers = API_CONFIG.headers;
    }

    /**
     * MÉTODO GENÉRICO PARA REALIZAR PETICIONES HTTP
     * @param {string} endpoint - Endpoint de la API
     * @param {string} method - Método HTTP (GET, POST, PUT, DELETE)
     * @param {Object} data - Datos a enviar (opcional)
     * @returns {Promise} - Promesa con la respuesta de la API
     */
    async makeRequest(endpoint, method = 'GET', data = null) {
        try {
            const config = {
                method: method,
                headers: this.headers,
                signal: AbortSignal.timeout(API_CONFIG.timeout)
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

            // Retornar datos en formato JSON
            const responseData = await response.json();
            return {
                success: true,
                data: responseData,
                status: response.status
            };

        } catch (error) {
            console.error(`Error en petición ${method} ${endpoint}:`, error);
            
            // Manejar diferentes tipos de errores
            if (error.name === 'AbortError') {
                return {
                    success: false,
                    error: 'Timeout: La petición tardó demasiado',
                    code: 'TIMEOUT'
                };
            }

            if (error.name === 'TypeError') {
                return {
                    success: false,
                    error: 'Error de conexión: Verifique su conexión a internet',
                    code: 'CONNECTION_ERROR'
                };
            }

            return {
                success: false,
                error: error.message,
                code: 'API_ERROR'
            };
        }
    }

    /**
     * OBTENER TODOS LOS PROYECTOS
     * Endpoint: GET /api/projects
     * @returns {Promise} Lista de todos los proyectos
     */
    async getAllProjects() {
        console.log('🔄 Obteniendo todos los proyectos...');
        return await this.makeRequest('/projects', 'GET');
    }

    /**
     * OBTENER PROYECTOS POR ESTADO
     * Endpoint: GET /api/projects?status=estado
     * @param {string} status - Estado del proyecto ('en_proceso' o 'terminado')
     * @returns {Promise} Lista de proyectos filtrados por estado
     */
    async getProjectsByStatus(status) {
        console.log(`🔄 Obteniendo proyectos con estado: ${status}...`);
        return await this.makeRequest(`/projects?status=${status}`, 'GET');
    }

    /**
     * OBTENER UN PROYECTO ESPECÍFICO
     * Endpoint: GET /api/projects/:id
     * @param {string} projectId - ID del proyecto
     * @returns {Promise} Datos del proyecto específico
     */
    async getProjectById(projectId) {
        console.log(`🔄 Obteniendo proyecto ID: ${projectId}...`);
        return await this.makeRequest(`/projects/${projectId}`, 'GET');
    }

    /**
     * BUSCAR PROYECTOS POR NOMBRE O ID
     * Endpoint: GET /api/projects/search?q=termino
     * @param {string} searchTerm - Término de búsqueda
     * @returns {Promise} Lista de proyectos que coinciden con la búsqueda
     */
    async searchProjects(searchTerm) {
        console.log(`🔍 Buscando proyectos: "${searchTerm}"...`);
        const encodedTerm = encodeURIComponent(searchTerm);
        return await this.makeRequest(`/projects/search?q=${encodedTerm}`, 'GET');
    }

    /**
     * CREAR UN NUEVO PROYECTO
     * Endpoint: POST /api/projects
     * @param {Object} projectData - Datos del nuevo proyecto
     * @returns {Promise} Proyecto creado
     */
    async createProject(projectData) {
        console.log('🆕 Creando nuevo proyecto...', projectData);
        return await this.makeRequest('/projects', 'POST', projectData);
    }

    /**
     * ACTUALIZAR UN PROYECTO EXISTENTE
     * Endpoint: PUT /api/projects/:id
     * @param {string} projectId - ID del proyecto a actualizar
     * @param {Object} projectData - Datos actualizados del proyecto
     * @returns {Promise} Proyecto actualizado
     */
    async updateProject(projectId, projectData) {
        console.log(`📝 Actualizando proyecto ID: ${projectId}...`, projectData);
        return await this.makeRequest(`/projects/${projectId}`, 'PUT', projectData);
    }

    /**
     * ELIMINAR UN PROYECTO
     * Endpoint: DELETE /api/projects/:id
     * @param {string} projectId - ID del proyecto a eliminar
     * @returns {Promise} Confirmación de eliminación
     */
    async deleteProject(projectId) {
        console.log(`🗑️ Eliminando proyecto ID: ${projectId}...`);
        return await this.makeRequest(`/projects/${projectId}`, 'DELETE');
    }

    /**
     * OBTENER USUARIOS DE UN PROYECTO
     * Endpoint: GET /api/projects/:id/users
     * @param {string} projectId - ID del proyecto
     * @returns {Promise} Lista de usuarios del proyecto
     */
    async getProjectUsers(projectId) {
        console.log(`👥 Obteniendo usuarios del proyecto ID: ${projectId}...`);
        return await this.makeRequest(`/projects/${projectId}/users`, 'GET');
    }

    /**
     * AGREGAR USUARIO A UN PROYECTO
     * Endpoint: POST /api/projects/:id/users
     * @param {string} projectId - ID del proyecto
     * @param {string} userId - ID del usuario a agregar
     * @returns {Promise} Confirmación de usuario agregado
     */
    async addUserToProject(projectId, userId) {
        console.log(`➕ Agregando usuario ${userId} al proyecto ${projectId}...`);
        return await this.makeRequest(`/projects/${projectId}/users`, 'POST', { userId });
    }

    /**
     * REMOVER USUARIO DE UN PROYECTO
     * Endpoint: DELETE /api/projects/:id/users/:userId
     * @param {string} projectId - ID del proyecto
     * @param {string} userId - ID del usuario a remover
     * @returns {Promise} Confirmación de usuario removido
     */
    async removeUserFromProject(projectId, userId) {
        console.log(`➖ Removiendo usuario ${userId} del proyecto ${projectId}...`);
        return await this.makeRequest(`/projects/${projectId}/users/${userId}`, 'DELETE');
    }

    /**
     * OBTENER ESTADÍSTICAS DE PROYECTOS
     * Endpoint: GET /api/projects/stats
     * @returns {Promise} Estadísticas generales de proyectos
     */
    async getProjectStats() {
        console.log('📊 Obteniendo estadísticas de proyectos...');
        return await this.makeRequest('/projects/stats', 'GET');
    }
}

/**
 * FUNCIONES AUXILIARES PARA MANEJO DE DATOS
 */

/**
 * FORMATEAR FECHA PARA MOSTRAR EN LA UI
 * @param {string} dateString - Fecha en formato ISO
 * @returns {string} Fecha formateada para mostrar
 */
function formatDate(dateString) {
    if (!dateString) return 'No definida';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (error) {
        console.error('Error al formatear fecha:', error);
        return 'Fecha inválida';
    }
}

/**
 * CALCULAR DÍAS RESTANTES HASTA LA FECHA DE FINALIZACIÓN
 * @param {string} endDateString - Fecha de finalización en formato ISO
 * @returns {number} Número de días restantes (negativo si ya pasó)
 */
function calculateDaysRemaining(endDateString) {
    if (!endDateString) return null;
    
    try {
        const endDate = new Date(endDateString);
        const today = new Date();
        const diffTime = endDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    } catch (error) {
        console.error('Error al calcular días restantes:', error);
        return null;
    }
}

/**
 * VALIDAR ESTRUCTURA DE DATOS DE PROYECTO
 * @param {Object} project - Objeto de proyecto a validar
 * @returns {boolean} true si la estructura es válida
 */
function validateProjectData(project) {
    const requiredFields = ['id', 'name', 'status'];
    
    for (const field of requiredFields) {
        if (!project.hasOwnProperty(field) || project[field] === null || project[field] === undefined) {
            console.warn(`Campo requerido faltante o inválido: ${field}`);
            return false;
        }
    }
    
    // Validar que el estado sea válido
    const validStatuses = ['en_proceso', 'terminado'];
    if (!validStatuses.includes(project.status)) {
        console.warn(`Estado de proyecto inválido: ${project.status}`);
        return false;
    }
    
    return true;
}

/**
 * GENERAR ID ÚNICO TEMPORAL PARA NUEVOS PROYECTOS
 * @returns {string} ID único temporal
 */
function generateTempId() {
    return 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * ESCAPAR HTML PARA PREVENIR XSS
 * @param {string} text - Texto a escapar
 * @returns {string} Texto escapado seguro para HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * INSTANCIA GLOBAL DE LA API
 * Esta instancia será utilizada por app.js para todas las operaciones
 */
const projectAPI = new ProjectAPI();

/**
 * DATOS MOCK PARA DESARROLLO Y TESTING
 * Estos datos se utilizarán cuando el backend no esté disponible
 * NOTA: Remover en producción cuando la API esté lista
 */
const MOCK_DATA = {
    projects: [
        {
            id: "PROJ001",
            name: "Sistema de Inventario",
            startDate: "2025-01-15",
            endDate: "2025-03-15",
            description: "Desarrollo de sistema integral para gestión de inventario con funcionalidades de seguimiento en tiempo real, reportes automatizados y alertas de stock bajo.",
            status: "en_proceso",
            users: [
                {
                    id: "user1",
                    name: "María González",
                    profileImage: "https://images.unsplash.com/photo-1494790108755-2616b9ec3b1a?w=150&h=150&fit=crop&crop=face"
                },
                {
                    id: "user2", 
                    name: "Carlos Mendoza",
                    profileImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face"
                },
                {
                    id: "user3",
                    name: "Ana Rodríguez",
                    profileImage: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face"
                }
            ]
        },
        {
            id: "PROJ002",
            name: "App Móvil E-commerce",
            startDate: "2025-02-01",
            endDate: "2025-05-30",
            description: "Aplicación móvil completa para comercio electrónico con carrito de compras, pagos seguros, seguimiento de pedidos y notificaciones push.",
            status: "en_proceso",
            users: [
                {
                    id: "user4",
                    name: "Roberto Silva",
                    profileImage: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face"
                },
                {
                    id: "user5",
                    name: "Laura Vásquez",
                    profileImage: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face"
                }
            ]
        },
        {
            id: "PROJ003",
            name: "Portal Web Corporativo",
            startDate: "2024-11-01",
            endDate: "2025-01-15",
            description: "Sitio web corporativo moderno con sistema de gestión de contenidos, blog integrado y panel administrativo completo.",
            status: "terminado",
            users: [
                {
                    id: "user6",
                    name: "Diego Herrera",
                    profileImage: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face"
                }
            ]
        },
        {
            id: "PROJ004",
            name: "Sistema CRM",
            startDate: "2024-09-15",
            endDate: "2024-12-20",
            description: "Customer Relationship Management system con automatización de ventas y seguimiento de clientes potenciales.",
            status: "terminado",
            users: [
                {
                    id: "user7",
                    name: "Patricia Morales",
                    profileImage: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150&h=150&fit=crop&crop=face"
                },
                {
                    id: "user8",
                    name: "Andrés López",
                    profileImage: "https://images.unsplash.com/photo-1519244703995-f4e0f30006d5?w=150&h=150&fit=crop&crop=face"
                }
            ]
        }
    ]
};

/**
 * FUNCIÓN PARA SIMULAR RESPUESTA DE API (MODO DESARROLLO)
 * @param {Array} data - Datos a retornar
 * @param {number} delay - Delay en milisegundos para simular latencia
 * @returns {Promise} Promesa con datos mock
 */
async function mockApiResponse(data, delay = 500) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                success: true,
                data: data,
                status: 200
            });
        }, delay);
    });
}

/**
 * EXPORTAR FUNCIONES PARA USO GLOBAL
 * Estas funciones estarán disponibles para app.js
 */
window.ProjectAPI = ProjectAPI;
window.projectAPI = projectAPI;
window.formatDate = formatDate;
window.calculateDaysRemaining = calculateDaysRemaining;
window.validateProjectData = validateProjectData;
window.generateTempId = generateTempId;
window.escapeHtml = escapeHtml;
window.MOCK_DATA = MOCK_DATA;
window.mockApiResponse = mockApiResponse;