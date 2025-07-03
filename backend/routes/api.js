// backend/routes/api.js
const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middlewares/auth');
const sql = require('mssql');
const config = require('../db.js');

/**
 * ===============================================
 * API REST ENDPOINTS PARA DASHBOARD
 * ===============================================
 * Estos endpoints proporcionan datos JSON para el
 * dashboard principal (index.ejs)
 */

/**
 * GET /api/health - Health check del servidor
 */
router.get('/health', async (req, res) => {
    try {
        // Verificar conexión a base de datos
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT 1 as status');
        
        res.json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: result.recordset.length > 0 ? 'connected' : 'disconnected'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            status: 'unhealthy',
            error: 'Database connection failed',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/projects - Obtener todos los proyectos del usuario
 */
router.get('/projects', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.usuario.id;
        const pool = await sql.connect(config);
        
        const result = await pool.request()
            .input('idUsuario', sql.Int, userId)
            .query(`
                SELECT
                    P.idProyecto as id,
                    P.nombreProyecto as name,
                    CAST(P.descripcionProyecto AS NVARCHAR(MAX)) as description,
                    P.fechaCreacion as startDate,
                    P.fechaEntrega as endDate,
                    P.estadoProyecto as status,
                    P.idUsuarioAdmin,
                    U_Admin.nombreUsuario as adminName,
                    PP.rolProyecto as userRole,
                    -- Calcular prioridad basada en fecha de entrega
                    CASE 
                        WHEN P.fechaEntrega < GETDATE() THEN 'alta'
                        WHEN P.fechaEntrega < DATEADD(week, 1, GETDATE()) THEN 'media'
                        ELSE 'baja'
                    END as priority
                FROM Proyectos P
                JOIN ParticipantesProyecto PP ON P.idProyecto = PP.idProyecto
                JOIN Usuarios U_Admin ON P.idUsuarioAdmin = U_Admin.idUsuario
                WHERE PP.idUsuario = @idUsuario 
                AND PP.estadoInvitacion = 'aceptada'
                ORDER BY P.fechaEntrega ASC
            `);

        // Obtener usuarios para cada proyecto
        const projects = await Promise.all(result.recordset.map(async (project) => {
            const usersResult = await pool.request()
                .input('idProyecto', sql.Int, project.id)
                .query(`
                    SELECT
                        U.idUsuario as id,
                        U.nombreUsuario as name,
                        PP.rolProyecto as role,
                        U.fotoPerfil as profileImage
                    FROM ParticipantesProyecto PP
                    JOIN Usuarios U ON PP.idUsuario = U.idUsuario
                    WHERE PP.idProyecto = @idProyecto 
                    AND PP.estadoInvitacion = 'aceptada'
                    ORDER BY PP.rolProyecto DESC
                `);

            return {
                ...project,
                // Convertir estado del proyecto a formato esperado por frontend
                status: project.status === 'Completado' ? 'terminado' : 'en_proceso',
                users: usersResult.recordset
            };
        }));

        res.json({
            success: true,
            data: projects,
            status: 200
        });

    } catch (error) {
        console.error('Error al obtener proyectos:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            code: 'SERVER_ERROR'
        });
    }
});

/**
 * GET /api/projects/:id - Obtener proyecto específico
 */
router.get('/projects/:id', isAuthenticated, async (req, res) => {
    try {
        const projectId = req.params.id;
        const userId = req.session.usuario.id;
        const pool = await sql.connect(config);
        
        // Verificar acceso al proyecto
        const accessCheck = await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .input('idUsuario', sql.Int, userId)
            .query(`
                SELECT 1 FROM ParticipantesProyecto 
                WHERE idProyecto = @idProyecto 
                AND idUsuario = @idUsuario 
                AND estadoInvitacion = 'aceptada'
            `);

        if (accessCheck.recordset.length === 0) {
            return res.status(403).json({
                success: false,
                error: 'No tienes acceso a este proyecto',
                code: 'FORBIDDEN'
            });
        }

        // Obtener datos del proyecto
        const projectResult = await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .query(`
                SELECT
                    P.idProyecto as id,
                    P.nombreProyecto as name,
                    CAST(P.descripcionProyecto AS NVARCHAR(MAX)) as description,
                    P.fechaCreacion as startDate,
                    P.fechaEntrega as endDate,
                    P.estadoProyecto as status,
                    P.idUsuarioAdmin,
                    U_Admin.nombreUsuario as adminName,
                    CASE 
                        WHEN P.fechaEntrega < GETDATE() THEN 'alta'
                        WHEN P.fechaEntrega < DATEADD(week, 1, GETDATE()) THEN 'media'
                        ELSE 'baja'
                    END as priority
                FROM Proyectos P
                JOIN Usuarios U_Admin ON P.idUsuarioAdmin = U_Admin.idUsuario
                WHERE P.idProyecto = @idProyecto
            `);

        if (projectResult.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Proyecto no encontrado',
                code: 'NOT_FOUND'
            });
        }

        const project = projectResult.recordset[0];

        // Obtener usuarios del proyecto
        const usersResult = await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .query(`
                SELECT
                    U.idUsuario as id,
                    U.nombreUsuario as name,
                    PP.rolProyecto as role,
                    U.fotoPerfil as profileImage
                FROM ParticipantesProyecto PP
                JOIN Usuarios U ON PP.idUsuario = U.idUsuario
                WHERE PP.idProyecto = @idProyecto 
                AND PP.estadoInvitacion = 'aceptada'
                ORDER BY PP.rolProyecto DESC
            `);

        res.json({
            success: true,
            data: {
                ...project,
                status: project.status === 'Completado' ? 'terminado' : 'en_proceso',
                users: usersResult.recordset
            },
            status: 200
        });

    } catch (error) {
        console.error('Error al obtener proyecto:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            code: 'SERVER_ERROR'
        });
    }
});

/**
 * GET /api/projects?status=en_proceso|terminado - Filtrar proyectos por estado
 */
router.get('/projects', isAuthenticated, async (req, res) => {
    // Esta lógica ya está manejada en el endpoint principal
    // El filtrado se puede hacer en el frontend o aquí según el query param
});

/**
 * GET /api/projects/search?q=termino - Buscar proyectos
 */
router.get('/projects/search', isAuthenticated, async (req, res) => {
    try {
        const searchTerm = req.query.q;
        const userId = req.session.usuario.id;
        
        if (!searchTerm || searchTerm.trim().length === 0) {
            return res.json({
                success: true,
                data: [],
                status: 200
            });
        }

        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('idUsuario', sql.Int, userId)
            .input('searchTerm', sql.NVarChar, `%${searchTerm.trim()}%`)
            .query(`
                SELECT
                    P.idProyecto as id,
                    P.nombreProyecto as name,
                    CAST(P.descripcionProyecto AS NVARCHAR(MAX)) as description,
                    P.fechaCreacion as startDate,
                    P.fechaEntrega as endDate,
                    P.estadoProyecto as status,
                    P.idUsuarioAdmin,
                    U_Admin.nombreUsuario as adminName,
                    PP.rolProyecto as userRole,
                    CASE 
                        WHEN P.fechaEntrega < GETDATE() THEN 'alta'
                        WHEN P.fechaEntrega < DATEADD(week, 1, GETDATE()) THEN 'media'
                        ELSE 'baja'
                    END as priority
                FROM Proyectos P
                JOIN ParticipantesProyecto PP ON P.idProyecto = PP.idProyecto
                JOIN Usuarios U_Admin ON P.idUsuarioAdmin = U_Admin.idUsuario
                WHERE PP.idUsuario = @idUsuario 
                AND PP.estadoInvitacion = 'aceptada'
                AND (
                    P.nombreProyecto LIKE @searchTerm 
                    OR CAST(P.descripcionProyecto AS NVARCHAR(MAX)) LIKE @searchTerm
                    OR CAST(P.idProyecto AS NVARCHAR) LIKE @searchTerm
                )
                ORDER BY P.fechaEntrega ASC
            `);

        // Obtener usuarios para cada proyecto encontrado
        const projects = await Promise.all(result.recordset.map(async (project) => {
            const usersResult = await pool.request()
                .input('idProyecto', sql.Int, project.id)
                .query(`
                    SELECT
                        U.idUsuario as id,
                        U.nombreUsuario as name,
                        PP.rolProyecto as role,
                        U.fotoPerfil as profileImage
                    FROM ParticipantesProyecto PP
                    JOIN Usuarios U ON PP.idUsuario = U.idUsuario
                    WHERE PP.idProyecto = @idProyecto 
                    AND PP.estadoInvitacion = 'aceptada'
                    ORDER BY PP.rolProyecto DESC
                `);

            return {
                ...project,
                status: project.status === 'Completado' ? 'terminado' : 'en_proceso',
                users: usersResult.recordset
            };
        }));

        res.json({
            success: true,
            data: projects,
            status: 200
        });

    } catch (error) {
        console.error('Error en búsqueda de proyectos:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            code: 'SERVER_ERROR'
        });
    }
});

/**
 * POST /api/projects - Crear nuevo proyecto
 */
router.post('/projects', isAuthenticated, async (req, res) => {
    try {
        const { name, description, startDate, endDate, status = 'en_proceso' } = req.body;
        const userId = req.session.usuario.id;

        // Validaciones básicas
        if (!name || !description || !endDate) {
            return res.status(400).json({
                success: false,
                error: 'Campos requeridos: name, description, endDate',
                code: 'VALIDATION_ERROR'
            });
        }

        const pool = await sql.connect(config);
        
        // Crear proyecto
        const projectResult = await pool.request()
            .input('nombreProyecto', sql.NVarChar, name)
            .input('descripcionProyecto', sql.Text, description)
            .input('fechaEntrega', sql.DateTime, endDate)
            .input('estadoProyecto', sql.NVarChar, status === 'terminado' ? 'Completado' : 'Activo')
            .input('idUsuarioAdmin', sql.Int, userId)
            .query(`
                INSERT INTO Proyectos (nombreProyecto, descripcionProyecto, fechaEntrega, fechaCreacion, estadoProyecto, idUsuarioAdmin)
                VALUES (@nombreProyecto, @descripcionProyecto, @fechaEntrega, GETDATE(), @estadoProyecto, @idUsuarioAdmin);
                SELECT SCOPE_IDENTITY() AS idProyecto;
            `);

        const newProjectId = projectResult.recordset[0].idProyecto;

        // Agregar al creador como admin del proyecto
        await pool.request()
            .input('idProyecto', sql.Int, newProjectId)
            .input('idUsuario', sql.Int, userId)
            .input('rolProyecto', sql.NVarChar, 'admin')
            .input('estadoInvitacion', sql.NVarChar, 'aceptada')
            .query(`
                INSERT INTO ParticipantesProyecto (idProyecto, idUsuario, rolProyecto, estadoInvitacion)
                VALUES (@idProyecto, @idUsuario, @rolProyecto, @estadoInvitacion);
            `);

        // Obtener el proyecto creado con usuarios
        const createdProject = await pool.request()
            .input('idProyecto', sql.Int, newProjectId)
            .query(`
                SELECT
                    P.idProyecto as id,
                    P.nombreProyecto as name,
                    CAST(P.descripcionProyecto AS NVARCHAR(MAX)) as description,
                    P.fechaCreacion as startDate,
                    P.fechaEntrega as endDate,
                    P.estadoProyecto as status,
                    P.idUsuarioAdmin,
                    U_Admin.nombreUsuario as adminName,
                    'alta' as priority
                FROM Proyectos P
                JOIN Usuarios U_Admin ON P.idUsuarioAdmin = U_Admin.idUsuario
                WHERE P.idProyecto = @idProyecto
            `);

        const usersResult = await pool.request()
            .input('idProyecto', sql.Int, newProjectId)
            .query(`
                SELECT
                    U.idUsuario as id,
                    U.nombreUsuario as name,
                    PP.rolProyecto as role,
                    U.fotoPerfil as profileImage
                FROM ParticipantesProyecto PP
                JOIN Usuarios U ON PP.idUsuario = U.idUsuario
                WHERE PP.idProyecto = @idProyecto 
                AND PP.estadoInvitacion = 'aceptada'
            `);

        const project = createdProject.recordset[0];
        
        res.status(201).json({
            success: true,
            data: {
                ...project,
                status: project.status === 'Completado' ? 'terminado' : 'en_proceso',
                users: usersResult.recordset
            },
            status: 201
        });

    } catch (error) {
        console.error('Error al crear proyecto:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            code: 'SERVER_ERROR'
        });
    }
});

/**
 * PUT /api/projects/:id - Actualizar proyecto
 */
router.put('/projects/:id', isAuthenticated, async (req, res) => {
    try {
        const projectId = req.params.id;
        const { name, description, endDate, status } = req.body;
        const userId = req.session.usuario.id;

        const pool = await sql.connect(config);
        
        // Verificar que el usuario es admin del proyecto
        const adminCheck = await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .input('idUsuario', sql.Int, userId)
            .query(`
                SELECT 1 FROM Proyectos 
                WHERE idProyecto = @idProyecto AND idUsuarioAdmin = @idUsuario
            `);

        if (adminCheck.recordset.length === 0) {
            return res.status(403).json({
                success: false,
                error: 'No tienes permisos para editar este proyecto',
                code: 'FORBIDDEN'
            });
        }

        // Actualizar proyecto
        await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .input('nombreProyecto', sql.NVarChar, name)
            .input('descripcionProyecto', sql.Text, description)
            .input('fechaEntrega', sql.DateTime, endDate)
            .input('estadoProyecto', sql.NVarChar, status === 'terminado' ? 'Completado' : 'Activo')
            .query(`
                UPDATE Proyectos 
                SET nombreProyecto = @nombreProyecto,
                    descripcionProyecto = @descripcionProyecto,
                    fechaEntrega = @fechaEntrega,
                    estadoProyecto = @estadoProyecto
                WHERE idProyecto = @idProyecto
            `);

        // Obtener proyecto actualizado
        const updatedResult = await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .query(`
                SELECT
                    P.idProyecto as id,
                    P.nombreProyecto as name,
                    CAST(P.descripcionProyecto AS NVARCHAR(MAX)) as description,
                    P.fechaCreacion as startDate,
                    P.fechaEntrega as endDate,
                    P.estadoProyecto as status,
                    P.idUsuarioAdmin,
                    U_Admin.nombreUsuario as adminName,
                    CASE 
                        WHEN P.fechaEntrega < GETDATE() THEN 'alta'
                        WHEN P.fechaEntrega < DATEADD(week, 1, GETDATE()) THEN 'media'
                        ELSE 'baja'
                    END as priority
                FROM Proyectos P
                JOIN Usuarios U_Admin ON P.idUsuarioAdmin = U_Admin.idUsuario
                WHERE P.idProyecto = @idProyecto
            `);

        const usersResult = await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .query(`
                SELECT
                    U.idUsuario as id,
                    U.nombreUsuario as name,
                    PP.rolProyecto as role,
                    U.fotoPerfil as profileImage
                FROM ParticipantesProyecto PP
                JOIN Usuarios U ON PP.idUsuario = U.idUsuario
                WHERE PP.idProyecto = @idProyecto 
                AND PP.estadoInvitacion = 'aceptada'
            `);

        const project = updatedResult.recordset[0];

        res.json({
            success: true,
            data: {
                ...project,
                status: project.status === 'Completado' ? 'terminado' : 'en_proceso',
                users: usersResult.recordset
            },
            status: 200
        });

    } catch (error) {
        console.error('Error al actualizar proyecto:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            code: 'SERVER_ERROR'
        });
    }
});

/**
 * DELETE /api/projects/:id - Eliminar proyecto
 */
router.delete('/projects/:id', isAuthenticated, async (req, res) => {
    try {
        const projectId = req.params.id;
        const userId = req.session.usuario.id;

        const pool = await sql.connect(config);
        
        // Verificar que el usuario es admin del proyecto
        const adminCheck = await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .input('idUsuario', sql.Int, userId)
            .query(`
                SELECT 1 FROM Proyectos 
                WHERE idProyecto = @idProyecto AND idUsuarioAdmin = @idUsuario
            `);

        if (adminCheck.recordset.length === 0) {
            return res.status(403).json({
                success: false,
                error: 'No tienes permisos para eliminar este proyecto',
                code: 'FORBIDDEN'
            });
        }

        // Eliminar proyecto (CASCADE eliminará automáticamente tareas, subtareas y participantes)
        await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .query('DELETE FROM Proyectos WHERE idProyecto = @idProyecto');

        res.json({
            success: true,
            message: 'Proyecto eliminado correctamente',
            status: 200
        });

    } catch (error) {
        console.error('Error al eliminar proyecto:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            code: 'SERVER_ERROR'
        });
    }
});

module.exports = router;