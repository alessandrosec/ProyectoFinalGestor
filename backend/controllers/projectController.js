const sql = require('mssql');
const config = require('../db.js');
const { body, validationResult } = require('express-validator');




// --- Función Auxiliar para Cargar Datos del Proyecto (¡ALTAMENTE RECOMENDADA!) ---
// Para evitar repetir este código en varios lugares (getProjectDetails, postCreateTask, postCreateSubtask),
// es una buena práctica crear una función auxiliar que cargue todos los datos necesarios
// para renderizar la vista 'project-details'.
async function loadProjectDetailsData(projectId, currentUserId) {
    const pool = await sql.connect(config);

    const projectResult = await pool.request()
        .input('idProyecto', sql.Int, projectId)
        .input('currentUserId', sql.Int, currentUserId)
        .query(`
            SELECT
                P.idProyecto, P.nombreProyecto, CAST(P.descripcionProyecto AS NVARCHAR(MAX)) AS descripcionProyecto,
                P.fechaCreacion, P.fechaEntrega, P.estadoProyecto, P.idUsuarioAdmin,
                U_Admin.nombreUsuario AS nombreAdmin, PP.rolProyecto
            FROM Proyectos P
            JOIN Usuarios U_Admin ON P.idUsuarioAdmin = U_Admin.idUsuario
            JOIN ParticipantesProyecto PP ON P.idProyecto = PP.idProyecto AND PP.idUsuario = @currentUserId
            WHERE P.idProyecto = @idProyecto AND PP.estadoInvitacion = 'aceptada';
        `);
    const proyecto = projectResult.recordset[0];

    if (!proyecto) {
        throw new Error('Proyecto no encontrado o acceso denegado.');
    }

    const participantsResult = await pool.request()
        .input('idProyecto', sql.Int, projectId)
        .query(`SELECT U.idUsuario, U.nombreUsuario, U.correoUsuario, PP.rolProyecto, PP.estadoInvitacion FROM ParticipantesProyecto PP JOIN Usuarios U ON PP.idUsuario = U.idUsuario WHERE PP.idProyecto = @idProyecto;`);
    const participantes = participantsResult.recordset;

    const tasksResult = await pool.request()
        .input('idProyecto', sql.Int, projectId)
        .query(`
            SELECT T.idTarea, T.nombreTarea, CAST(T.descripcionTarea AS NVARCHAR(MAX)) AS descripcionTarea,
            T.fechaCreacion, T.fechaEntrega, T.estadoTarea, T.prioridadTarea,
            T.idUsuarioCreador, T.idUsuarioAsignado, U_Creador.nombreUsuario AS nombreCreador, U_Asignado.nombreUsuario AS nombreAsignado
            FROM Tareas T LEFT JOIN Usuarios U_Creador ON T.idUsuarioCreador = U_Creador.idUsuario
            LEFT JOIN Usuarios U_Asignado ON T.idUsuarioAsignado = U_Asignado.idUsuario
            WHERE T.idProyecto = @idProyecto ORDER BY T.fechaEntrega ASC;
        `);
    let tareas = tasksResult.recordset;

    const taskIds = tareas.map(t => t.idTarea);
    let subtareas = [];
    if (taskIds.length > 0) {
        const subtareasRequest = pool.request();
        const taskIdsPlaceholders = taskIds.map((id, index) => {
            subtareasRequest.input(`p${index}`, sql.Int, id);
            return `@p${index}`;
        }).join(',');
        const subtareasResult = await subtareasRequest.query(`
            SELECT ST.idSubtarea, ST.idTarea, ST.nombreSubtarea, CAST(ST.descripcionSubtarea AS NVARCHAR(MAX)) AS descripcionSubtarea,
            ST.fechaCreacion, ST.fechaEntrega, ST.estadoSubtarea, ST.prioridadSubtarea, ST.idUsuarioCreador, ST.idUsuarioAsignado,
            U_Creador_ST.nombreUsuario AS nombreCreadorSubtarea, U_Asignado_ST.nombreUsuario AS nombreAsignadoSubtarea
            FROM Subtareas ST LEFT JOIN Usuarios U_Creador_ST ON ST.idUsuarioCreador = U_Creador_ST.idUsuario
            LEFT JOIN Usuarios U_Asignado_ST ON ST.idUsuarioAsignado = U_Asignado_ST.idUsuario
            WHERE ST.idTarea IN (${taskIdsPlaceholders}) ORDER BY ST.fechaEntrega ASC;
        `);
        subtareas = subtareasResult.recordset;
    }

    tareas = tareas.map(tarea => {
        tarea.subtareas = subtareas.filter(subtarea => subtarea.idTarea === tarea.idTarea);
        return tarea;
    });

    return { proyecto, participantes, tareas };
}





// Validaciones para crear/editar un proyecto
exports.validateProject = [
    body('nombreProyecto')
        .notEmpty().withMessage('El nombre del proyecto es obligatorio')
        .trim(),
    body('descripcionProyecto')
        .notEmpty().withMessage('La descripción del proyecto es obligatoria')
        .trim(),
    body('fechaEntrega')
        .isISO8601().toDate().withMessage('La fecha de entrega debe ser una fecha válida')
        .custom((value, { req }) => {
            if (new Date(value) < new Date()) {
                throw new Error('La fecha de entrega no puede ser en el pasado');
            }
            return true;
        })
];

// Obtener la vista para crear un nuevo proyecto
exports.getCreateProject = (req, res) => {
    // Asegúrate de que el usuario esté logueado
    if (!req.session.usuario) {
        req.session.mensaje = 'Necesitas iniciar sesión para crear un proyecto.';
        return res.redirect('/');
    }
    res.render('create-project', {
        csrfToken: req.session.csrfToken,
        errors: null,
        oldInput: {}
    });
};

// Lógica para crear un nuevo proyecto
exports.postCreateProject = async (req, res, next) => {
    // 1. Verificar errores de validación
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('create-project', {
            csrfToken: req.session.csrfToken,
            errors: errors.array(),
            oldInput: req.body
        });
    }

    if (!req.session.usuario) {
        req.session.mensaje = 'Necesitas iniciar sesión para crear un proyecto.';
        return res.redirect('/');
    }

    const { nombreProyecto, descripcionProyecto, fechaEntrega } = req.body;
    const idUsuarioAdmin = req.session.usuario.id; // El usuario logueado es el admin

    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('nombreProyecto', sql.VarChar, nombreProyecto)
            .input('descripcionProyecto', sql.Text, descripcionProyecto)
            .input('fechaEntrega', sql.DateTime, fechaEntrega)
            .input('idUsuarioAdmin', sql.Int, idUsuarioAdmin)
            .query(`
                INSERT INTO Proyectos (nombreProyecto, descripcionProyecto, fechaEntrega, fechaCreacion, idUsuarioAdmin)
                VALUES (@nombreProyecto, @descripcionProyecto, @fechaEntrega, GETDATE(), @idUsuarioAdmin);
                SELECT SCOPE_IDENTITY() AS idProyecto; -- Retorna el ID del proyecto recién creado
            `);

        const newProjectId = result.recordset[0].idProyecto;

        // Opcional: Registrar al admin como participante del proyecto también (aunque ya está en idUsuarioAdmin)
        await pool.request()
            .input('idProyecto', sql.Int, newProjectId)
            .input('idUsuario', sql.Int, idUsuarioAdmin)
            .input('rolProyecto', sql.VarChar, 'admin')
            .input('estadoInvitacion', sql.VarChar, 'aceptada')
            .query(`
                INSERT INTO ParticipantesProyecto (idProyecto, idUsuario, rolProyecto, estadoInvitacion)
                VALUES (@idProyecto, @idUsuario, @rolProyecto, @estadoInvitacion);
            `);

        req.session.mensaje = '¡Proyecto creado exitosamente!';
        res.redirect('/proyectos'); // Redirige a una vista donde se listan los proyectos
    } catch (error) {
        console.error("Error al crear proyecto:", error);
        req.session.mensaje = 'Error al crear el proyecto. Inténtalo de nuevo.';
        next(error);
    }
};

// Obtener todos los proyectos del usuario (donde es admin o participante)
exports.getProjects = async (req, res, next) => {
    if (!req.session.usuario || !req.session.usuario.id) {
        req.session.mensaje = 'Necesitas iniciar sesión para ver tus proyectos.';
        return res.redirect('/');
    }

    try {
        const pool = await sql.connect(config);
        const proyectosResult = await pool.request()
            .input('idUsuario', sql.Int, req.session.usuario.id)
            .query(`
                SELECT
                    P.idProyecto,
                    P.nombreProyecto,
                    CAST(P.descripcionProyecto AS NVARCHAR(MAX)) AS descripcionProyecto, -- Convertir a NVARCHAR(MAX)
                    P.fechaCreacion,
                    P.fechaEntrega,
                    P.estadoProyecto,
                    P.idUsuarioAdmin,
                    U_Admin.nombreUsuario AS nombreAdmin,
                    PP.rolProyecto
                FROM Proyectos P
                JOIN ParticipantesProyecto PP ON P.idProyecto = PP.idProyecto
                JOIN Usuarios U_Admin ON P.idUsuarioAdmin = U_Admin.idUsuario
                WHERE PP.idUsuario = @idUsuario AND PP.estadoInvitacion = 'aceptada'
                ORDER BY P.fechaEntrega ASC;
            `);
        
        res.render('projects', {
            csrfToken: req.session.csrfToken,
            proyectos: proyectosResult.recordset,
            mensaje: req.session.mensaje,
            usuario: req.session.usuario
        });
        req.session.mensaje = null;
    } catch (error) {
        console.error("Error al obtener proyectos:", error);
        req.session.mensaje = 'Error al cargar los proyectos.';
        next(error);
    }
};




// NUEVA FUNCIÓN: Obtener detalles de un proyecto específico
exports.getProjectDetails = async (req, res, next) => {
    if (!req.session.usuario || !req.session.usuario.id) {
        req.session.mensaje = 'Necesitas iniciar sesión para ver los detalles del proyecto.';
        return res.redirect('/');
    }

    const projectId = req.params.idProyecto;
    const currentUserId = req.session.usuario.id;

    try {
        const pool = await sql.connect(config);

        // 1. Obtener detalles del proyecto
        const projectResult = await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .input('currentUserId', sql.Int, currentUserId)
            .query(`
                SELECT
                    P.idProyecto,
                    P.nombreProyecto,
                    CAST(P.descripcionProyecto AS NVARCHAR(MAX)) AS descripcionProyecto,
                    P.fechaCreacion,
                    P.fechaEntrega,
                    P.estadoProyecto,
                    P.idUsuarioAdmin,
                    U_Admin.nombreUsuario AS nombreAdmin,
                    PP.rolProyecto
                FROM Proyectos P
                JOIN Usuarios U_Admin ON P.idUsuarioAdmin = U_Admin.idUsuario
                JOIN ParticipantesProyecto PP ON P.idProyecto = PP.idProyecto AND PP.idUsuario = @currentUserId
                WHERE P.idProyecto = @idProyecto AND PP.estadoInvitacion = 'aceptada';
            `);

        const proyecto = projectResult.recordset[0];

        if (!proyecto) {
            req.session.mensaje = 'Proyecto no encontrado o no tienes acceso a él.';
            return res.redirect('/proyectos');
        }

        // 2. Obtener los participantes del proyecto
        const participantsResult = await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .query(`
                SELECT
                    U.idUsuario,
                    U.nombreUsuario,
                    U.correoUsuario,
                    PP.rolProyecto,
                    PP.estadoInvitacion
                FROM ParticipantesProyecto PP
                JOIN Usuarios U ON PP.idUsuario = U.idUsuario
                WHERE PP.idProyecto = @idProyecto;
            `);
        const participantes = participantsResult.recordset;

        // 3. Obtener las tareas del proyecto
        const tasksResult = await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .query(`
                SELECT
                    T.idTarea,
                    T.nombreTarea,
                    CAST(T.descripcionTarea AS NVARCHAR(MAX)) AS descripcionTarea,
                    T.fechaCreacion,
                    T.fechaEntrega,
                    T.estadoTarea,
                    T.prioridadTarea,
                    T.idUsuarioCreador,
                    T.idUsuarioAsignado,
                    U_Creador.nombreUsuario AS nombreCreador,
                    U_Asignado.nombreUsuario AS nombreAsignado
                FROM Tareas T
                LEFT JOIN Usuarios U_Creador ON T.idUsuarioCreador = U_Creador.idUsuario
                LEFT JOIN Usuarios U_Asignado ON T.idUsuarioAsignado = U_Asignado.idUsuario
                WHERE T.idProyecto = @idProyecto
                ORDER BY T.fechaEntrega ASC;
            `);
        let tareas = tasksResult.recordset;

        // 4. Obtener todas las subtareas para las tareas de este proyecto
        const taskIds = tareas.map(t => t.idTarea);
        let subtareas = [];
        if (taskIds.length > 0) {
            // **CORRECCIÓN AQUÍ:** Construir la lista de placeholders y añadir inputs dinámicamente
            const subtareasRequest = pool.request();
            const taskIdsPlaceholders = taskIds.map((id, index) => {
                subtareasRequest.input(`p${index}`, sql.Int, id); // Añade cada ID como un parámetro separado
                return `@p${index}`; // Retorna el placeholder para el SQL
            }).join(','); // Une todos los placeholders con comas

            const subtareasResult = await subtareasRequest.query(`
                SELECT
                    ST.idSubtarea,
                    ST.idTarea,
                    ST.nombreSubtarea,
                    CAST(ST.descripcionSubtarea AS NVARCHAR(MAX)) AS descripcionSubtarea,
                    ST.fechaCreacion,
                    ST.fechaEntrega,
                    ST.estadoSubtarea,
                    ST.prioridadSubtarea,
                    ST.idUsuarioCreador,
                    ST.idUsuarioAsignado,
                    U_Creador_ST.nombreUsuario AS nombreCreadorSubtarea,
                    U_Asignado_ST.nombreUsuario AS nombreAsignadoSubtarea
                FROM Subtareas ST
                LEFT JOIN Usuarios U_Creador_ST ON ST.idUsuarioCreador = U_Creador_ST.idUsuario
                LEFT JOIN Usuarios U_Asignado_ST ON ST.idUsuarioAsignado = U_Asignado_ST.idUsuario
                WHERE ST.idTarea IN (${taskIdsPlaceholders})
                ORDER BY ST.fechaEntrega ASC;
            `);
            subtareas = subtareasResult.recordset;
        }

        // 5. Anidar subtareas dentro de sus tareas correspondientes
        tareas = tareas.map(tarea => {
            tarea.subtareas = subtareas.filter(subtarea => subtarea.idTarea === tarea.idTarea);
            return tarea;
        });
        
        // **CORRECCIÓN AQUÍ:** Pasar las variables 'mensaje' y 'errors' a la vista
        res.render('project-details', {
            csrfToken: req.session.csrfToken,
            proyecto: proyecto,
            participantes: participantes,
            tareas: tareas,
            usuarioActual: req.session.usuario,
            mensaje: req.session.mensaje, // <-- Pasa el mensaje de la sesión
            errors: null // <-- Inicializa 'errors' a null para las cargas de página normales
        });
        // Limpia el mensaje de la sesión después de pasarlo para que no se muestre de nuevo al recargar
        req.session.mensaje = null; 

    } catch (error) {
        console.error("Error al obtener detalles del proyecto:", error);
        req.session.mensaje = 'Error al cargar los detalles del proyecto. Inténtalo de nuevo.';
        next(error);
    }
};




// NUEVA FUNCIÓN: Obtener formulario de edición de proyecto
exports.getEditProject = async (req, res, next) => {
    if (!req.session.usuario || !req.session.usuario.id) {
        req.session.mensaje = 'Necesitas iniciar sesión para editar proyectos.';
        return res.redirect('/');
    }

    const projectId = req.params.idProyecto;
    const currentUserId = req.session.usuario.id;

    try {
        const pool = await sql.connect(config);
        const projectResult = await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .input('idUsuarioAdmin', sql.Int, currentUserId) // Verificar que el usuario logueado es el admin
            .query(`
                SELECT
                    P.idProyecto,
                    P.nombreProyecto,
                    CAST(P.descripcionProyecto AS NVARCHAR(MAX)) AS descripcionProyecto,
                    P.fechaEntrega,
                    P.estadoProyecto,
                    P.idUsuarioAdmin
                FROM Proyectos P
                WHERE P.idProyecto = @idProyecto AND P.idUsuarioAdmin = @idUsuarioAdmin;
            `);

        const proyecto = projectResult.recordset[0];

        if (!proyecto) {
            req.session.mensaje = 'Proyecto no encontrado o no tienes permiso para editarlo.';
            return res.redirect('/proyectos');
        }

        res.render('edit-project', {
            csrfToken: req.session.csrfToken,
            proyecto: proyecto,
            errors: null,
            oldInput: proyecto // precarga los datos actuales del proyecto
        });

    } catch (error) {
        console.error("Error al obtener proyecto para edición:", error);
        req.session.mensaje = 'Error al cargar el formulario de edición del proyecto.';
        next(error);
    }
};

// NUEVA FUNCIÓN: Manejar el envío del formulario de edición de proyecto
exports.postEditProject = async (req, res, next) => {
    // 1. Verificar errores de validación
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const projectId = req.params.idProyecto;
        // Si hay errores, re-renderiza el formulario con los datos y errores
        const proyecto = { // Necesitamos pasar un objeto proyecto para que la vista no falle
            idProyecto: projectId,
            nombreProyecto: req.body.nombreProyecto,
            descripcionProyecto: req.body.descripcionProyecto,
            fechaEntrega: req.body.fechaEntrega,
            estadoProyecto: req.body.estadoProyecto || 'Activo' // Por si no se envió el estado
        };
        return res.render('edit-project', {
            csrfToken: req.session.csrfToken,
            proyecto: proyecto,
            errors: errors.array(),
            oldInput: req.body
        });
    }

    if (!req.session.usuario || !req.session.usuario.id) {
        req.session.mensaje = 'Necesitas iniciar sesión para editar proyectos.';
        return res.redirect('/');
    }

    const projectId = req.params.idProyecto;
    const currentUserId = req.session.usuario.id;
    const { nombreProyecto, descripcionProyecto, fechaEntrega, estadoProyecto } = req.body;

    try {
        const pool = await sql.connect(config);

        // Primero, verifica si el usuario actual es el administrador de este proyecto
        const checkAdmin = await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .input('idUsuarioAdmin', sql.Int, currentUserId)
            .query('SELECT 1 FROM Proyectos WHERE idProyecto = @idProyecto AND idUsuarioAdmin = @idUsuarioAdmin;');
        
        if (checkAdmin.recordset.length === 0) {
            req.session.mensaje = 'No tienes permiso para editar este proyecto.';
            return res.redirect('/proyectos');
        }

        // Si es el admin, procede con la actualización
        await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .input('nombreProyecto', sql.NVarChar, nombreProyecto)
            .input('descripcionProyecto', sql.Text, descripcionProyecto)
            .input('fechaEntrega', sql.DateTime, fechaEntrega)
            .input('estadoProyecto', sql.NVarChar, estadoProyecto)
            .query(`
                UPDATE Proyectos
                SET nombreProyecto = @nombreProyecto,
                    descripcionProyecto = @descripcionProyecto,
                    fechaEntrega = @fechaEntrega,
                    estadoProyecto = @estadoProyecto
                WHERE idProyecto = @idProyecto;
            `);

        req.session.mensaje = '¡Proyecto actualizado exitosamente!';
        res.redirect(`/proyectos/${projectId}`); // Redirige a los detalles del proyecto actualizado
    } catch (error) {
        console.error("Error al actualizar proyecto:", error);
        req.session.mensaje = 'Error al actualizar el proyecto. Inténtalo de nuevo.';
        next(error);
    }
};

// NUEVA FUNCIÓN: Eliminar un proyecto
exports.deleteProject = async (req, res, next) => {
    if (!req.session.usuario || !req.session.usuario.id) {
        req.session.mensaje = 'Necesitas iniciar sesión para eliminar proyectos.';
        return res.redirect('/');
    }

    const projectId = req.params.idProyecto;
    const currentUserId = req.session.usuario.id;

    try {
        const pool = await sql.connect(config);

        // Primero, verifica si el usuario actual es el administrador de este proyecto
        const checkAdmin = await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .input('idUsuarioAdmin', sql.Int, currentUserId)
            .query('SELECT 1 FROM Proyectos WHERE idProyecto = @idProyecto AND idUsuarioAdmin = @idUsuarioAdmin;');
        
        if (checkAdmin.recordset.length === 0) {
            req.session.mensaje = 'No tienes permiso para eliminar este proyecto.';
            return res.redirect('/proyectos');
        }

        // Si es el admin, procede con la eliminación.
        // Las restricciones ON DELETE CASCADE en ParticipantesProyecto, Tareas y Subtareas
        // deberían manejar la eliminación de elementos relacionados automáticamente.
        await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .query('DELETE FROM Proyectos WHERE idProyecto = @idProyecto;');

        req.session.mensaje = '¡Proyecto eliminado exitosamente!';
        res.redirect('/proyectos'); // Redirige a la lista de proyectos
    } catch (error) {
        console.error("Error al eliminar proyecto:", error);
        req.session.mensaje = 'Error al eliminar el proyecto. Inténtalo de nuevo.';
        next(error);
    }
};




exports.validateTask = [
    body('nombreTarea')
        .notEmpty().withMessage('El nombre de la tarea es obligatorio')
        .trim(),
    body('descripcionTarea')
        .trim(),
    body('fechaEntrega')
        .isISO8601().toDate().withMessage('La fecha de entrega debe ser una fecha válida')
        .custom((value, { req }) => {
            const fechaEntrega = new Date(value);
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0); // Establece la hora a 00:00:00 para comparar solo la fecha

            if (fechaEntrega < hoy) {
                throw new Error('La fecha de entrega de la tarea no puede ser en el pasado.');
            }
            return true;
        }),
    body('idUsuarioAsignado')
        .optional({ nullable: true, checkFalsy: true }) // Permite que sea opcional
        .isInt().withMessage('El usuario asignado debe ser un ID válido si se especifica.')
];

exports.validateSubtask = [
    body('nombreSubtarea')
        .notEmpty().withMessage('El nombre de la subtarea es obligatorio')
        .trim(),
    body('descripcionSubtarea')
        .trim(),
    body('fechaEntregaSubtarea') // Este nombre lo usaremos en el formulario
        .isISO8601().toDate().withMessage('La fecha de entrega de la subtarea debe ser una fecha válida')
        .custom((value, { req }) => {
            const fechaEntrega = new Date(value);
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);

            if (fechaEntrega < hoy) {
                throw new Error('La fecha de entrega de la subtarea no puede ser en el pasado.');
            }
            return true;
        }),
    body('idUsuarioAsignadoSubtarea') // Este nombre lo usaremos en el formulario
        .optional({ nullable: true, checkFalsy: true })
        .isInt().withMessage('El usuario asignado a la subtarea debe ser un ID válido si se especifica.')
];


// NUEVA FUNCIÓN: Post para crear Tarea (en la página de detalles del proyecto)
exports.postCreateTask = async (req, res, next) => {
    console.log("--- Inicia postCreateTask ---");
    console.log("Datos recibidos:", req.body);
    console.log("ID del Proyecto:", req.params.idProyecto);

    const projectId = req.params.idProyecto; 

    // 1. Validaciones
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log("Errores de validación:", errors.array());
        req.session.mensaje = 'Error al crear la tarea: ' + errors.array().map(e => e.msg).join(', ');
        // Ya tienes la lógica para re-renderizar con errores aquí, debería redirigir.
        // Asegúrate de que este bloque esté llamando a `res.render` o `res.redirect`.
        // Por ahora, solo queremos que redireccione para ver el mensaje.
        return res.redirect(`/proyectos/${projectId}`);
    }

    // 2. Verificar autenticación y permisos de admin
    if (!req.session.usuario || !req.session.usuario.id) {
        console.log("Usuario no autenticado o ID de usuario no encontrado.");
        req.session.mensaje = 'Necesitas iniciar sesión para crear tareas.';
        return res.redirect('/');
    }
    const currentUserId = req.session.usuario.id;
    console.log("ID de usuario actual:", currentUserId);


    try {
        const pool = await sql.connect(config);
        console.log("Conexión a la base de datos establecida.");

        // Verificar si el usuario actual es admin del proyecto
        const checkAdmin = await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .input('idUsuario', sql.Int, currentUserId)
            .query(`
                SELECT 1
                FROM ParticipantesProyecto
                WHERE idProyecto = @idProyecto
                AND idUsuario = @idUsuario
                AND rolProyecto = 'admin'
                AND estadoInvitacion = 'aceptada';
            `);
        
        if (checkAdmin.recordset.length === 0) {
            console.log("El usuario no es administrador del proyecto.");
            req.session.mensaje = 'No tienes permiso para crear tareas en este proyecto.';
            return res.redirect(`/proyectos/${projectId}`);
        }
        console.log("Usuario verificado como administrador del proyecto.");

        const { nombreTarea, descripcionTarea, fechaEntrega, estadoTarea, prioridadTarea, idUsuarioAsignado } = req.body;
        console.log("Datos de la tarea a insertar:", { nombreTarea, descripcionTarea, fechaEntrega, estadoTarea, prioridadTarea, idUsuarioAsignado });

        const result = await pool.request() // Captura el resultado de la inserción
            .input('idProyecto', sql.Int, projectId)
            .input('nombreTarea', sql.NVarChar, nombreTarea)
            .input('descripcionTarea', sql.Text, descripcionTarea)
            .input('idUsuarioCreador', sql.Int, currentUserId)
            .input('idUsuarioAsignado', sql.Int, idUsuarioAsignado || null) // Puede ser NULL
            .input('fechaEntrega', sql.DateTime, fechaEntrega)
            .input('estadoTarea', sql.NVarChar, estadoTarea || 'Pendiente')
            .input('prioridadTarea', sql.NVarChar, prioridadTarea || 'Media')
            .query(`
                INSERT INTO Tareas (idProyecto, nombreTarea, descripcionTarea, idUsuarioCreador, idUsuarioAsignado, fechaCreacion, fechaEntrega, estadoTarea, prioridadTarea)
                VALUES (@idProyecto, @nombreTarea, @descripcionTarea, @idUsuarioCreador, @idUsuarioAsignado, GETDATE(), @fechaEntrega, @estadoTarea, @prioridadTarea);
            `);
        console.log("Resultado de la inserción de tarea:", result); // Esto te dirá si se insertó algo

        req.session.mensaje = '¡Tarea creada exitosamente!';
        console.log("Tarea creada exitosamente. Redirigiendo a:", `/proyectos/${projectId}`);
        return res.redirect(`/proyectos/${projectId}`); // Asegúrate de que haya un return aquí

    } catch (error) {
        console.error("--- Error en postCreateTask ---", error); // Esto te dará el error completo
        req.session.mensaje = 'Error al crear la tarea. Inténtalo de nuevo.';
        return res.redirect(`/proyectos/${projectId}`); // Redirige incluso en caso de error
    }
};


// NUEVA FUNCIÓN: Post para crear Subtarea (en la página de detalles de la tarea o proyecto)
// Por ahora, la haremos en una página aparte y luego podemos integrar si es necesario.
// Esto implica una nueva ruta como /proyectos/:idProyecto/tareas/:idTarea/subtareas/crear
exports.postCreateSubtask = async (req, res, next) => {
    // 1. Validaciones
    const errors = validationResult(req);
    const projectId = req.params.idProyecto;
    const taskId = req.params.idTarea; // Obtén el ID de la tarea de los parámetros de la URL

    if (!errors.isEmpty()) {
        req.session.mensaje = 'Error al crear la subtarea: ' + errors.array().map(e => e.msg).join(', ');
        return res.redirect(`/proyectos/${projectId}`); // Redirige a los detalles del proyecto o de la tarea
    }

    // 2. Verificar autenticación y permisos de admin
    if (!req.session.usuario || !req.session.usuario.id) {
        req.session.mensaje = 'Necesitas iniciar sesión para crear subtareas.';
        return res.redirect('/');
    }
    const currentUserId = req.session.usuario.id;

    try {
        const pool = await sql.connect(config);

        // Verificar si el usuario actual es admin del proyecto al que pertenece la tarea
        const checkAdmin = await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .input('idUsuario', sql.Int, currentUserId)
            .input('idTarea', sql.Int, taskId)
            .query(`
                SELECT 1
                FROM ParticipantesProyecto PP
                JOIN Proyectos P ON PP.idProyecto = P.idProyecto
                JOIN Tareas T ON T.idProyecto = P.idProyecto
                WHERE PP.idProyecto = @idProyecto
                AND PP.idUsuario = @idUsuario
                AND PP.rolProyecto = 'admin'
                AND PP.estadoInvitacion = 'aceptada'
                AND T.idTarea = @idTarea; -- Asegurarse de que la tarea pertenezca a este proyecto
            `);
        
        if (checkAdmin.recordset.length === 0) {
            req.session.mensaje = 'No tienes permiso para crear subtareas en este proyecto/tarea.';
            return res.redirect(`/proyectos/${projectId}`);
        }

        const { nombreSubtarea, descripcionSubtarea, fechaEntregaSubtarea, estadoSubtarea, prioridadSubtarea, idUsuarioAsignadoSubtarea } = req.body;

        await pool.request()
            .input('idTarea', sql.Int, taskId)
            .input('nombreSubtarea', sql.NVarChar, nombreSubtarea)
            .input('descripcionSubtarea', sql.Text, descripcionSubtarea)
            .input('idUsuarioCreador', sql.Int, currentUserId)
            .input('idUsuarioAsignado', sql.Int, idUsuarioAsignadoSubtarea || null) // Puede ser NULL
            .input('fechaEntrega', sql.DateTime, fechaEntregaSubtarea)
            .input('estadoSubtarea', sql.NVarChar, estadoSubtarea || 'Pendiente')
            .input('prioridadSubtarea', sql.NVarChar, prioridadSubtarea || 'Media')
            .query(`
                INSERT INTO Subtareas (idTarea, nombreSubtarea, descripcionSubtarea, idUsuarioCreador, idUsuarioAsignado, fechaCreacion, fechaEntrega, estadoSubtarea, prioridadSubtarea)
                VALUES (@idTarea, @nombreSubtarea, @descripcionSubtarea, @idUsuarioCreador, @idUsuarioAsignado, GETDATE(), @fechaEntrega, @estadoSubtarea, @prioridadSubtarea);
            `);

        req.session.mensaje = '¡Subtarea creada exitosamente!';
        res.redirect(`/proyectos/${projectId}`); // Redirige de vuelta a los detalles del proyecto

    } catch (error) {
        console.error("Error al crear subtarea:", error);
        req.session.mensaje = 'Error al crear la subtarea. Inténtalo de nuevo.';
        next(error);
    }
};




// --- POST para Crear Subtarea ---
exports.postCreateSubtask = async (req, res, next) => {
    const projectId = req.params.idProyecto;
    const taskId = req.params.idTarea;
    const currentUserId = req.session.usuario ? req.session.usuario.id : null;

    // 1. Validaciones
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        try {
            // Recargar todos los datos para renderizar la página con los errores
            const { proyecto, participantes, tareas } = await loadProjectDetailsData(projectId, currentUserId);
            return res.render('project-details', {
                csrfToken: req.session.csrfToken,
                proyecto: proyecto,
                participantes: participantes,
                tareas: tareas,
                usuarioActual: req.session.usuario,
                mensaje: null, // No hay mensaje de éxito si hay errores
                errors: errors.array(), // Aquí pasamos los errores de validación
                oldInput: req.body // Para repoblar el formulario (opcional, pero buena práctica)
            });
        } catch (error) {
            console.error("Error al re-renderizar la página con errores de subtarea:", error);
            req.session.mensaje = 'Error al procesar la subtarea.';
            return res.redirect(`/proyectos/${projectId}`);
        }
    }

    if (!currentUserId) {
        req.session.mensaje = 'Necesitas iniciar sesión para crear subtareas.';
        return res.redirect('/');
    }

    try {
        const pool = await sql.connect(config);

        // Verificar si el usuario actual es admin del proyecto o el asignado a la tarea principal
        const checkPermission = await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .input('idTarea', sql.Int, taskId)
            .input('idUsuario', sql.Int, currentUserId)
            .query(`
                SELECT 1
                FROM Proyectos P
                JOIN Tareas T ON P.idProyecto = T.idProyecto
                JOIN ParticipantesProyecto PP ON P.idProyecto = PP.idProyecto
                WHERE P.idProyecto = @idProyecto
                AND T.idTarea = @idTarea
                AND PP.idUsuario = @idUsuario
                AND (PP.rolProyecto = 'admin' OR T.idUsuarioAsignado = @idUsuario);
            `);
        
        if (checkPermission.recordset.length === 0) {
            req.session.mensaje = 'No tienes permiso para crear subtareas para esta tarea.';
            return res.redirect(`/proyectos/${projectId}`);
        }

        const { nombreSubtarea, descripcionSubtarea, fechaEntregaSubtarea, estadoSubtarea, prioridadSubtarea, idUsuarioAsignadoSubtarea } = req.body;

        await pool.request()
            .input('idTarea', sql.Int, taskId)
            .input('nombreSubtarea', sql.NVarChar, nombreSubtarea)
            .input('descripcionSubtarea', sql.Text, descripcionSubtarea)
            .input('idUsuarioCreador', sql.Int, currentUserId)
            .input('idUsuarioAsignado', sql.Int, idUsuarioAsignadoSubtarea || null)
            .input('fechaEntrega', sql.DateTime, fechaEntregaSubtarea)
            .input('estadoSubtarea', sql.NVarChar, estadoSubtarea || 'Pendiente')
            .input('prioridadSubtarea', sql.NVarChar, prioridadSubtarea || 'Media')
            .query(`
                INSERT INTO Subtareas (idTarea, nombreSubtarea, descripcionSubtarea, idUsuarioCreador, idUsuarioAsignado, fechaCreacion, fechaEntrega, estadoSubtarea, prioridadSubtarea)
                VALUES (@idTarea, @nombreSubtarea, @descripcionSubtarea, @idUsuarioCreador, @idUsuarioAsignado, GETDATE(), @fechaEntrega, @estadoSubtarea, @prioridadSubtarea);
            `);

        req.session.mensaje = '¡Subtarea creada exitosamente!';
        res.redirect(`/proyectos/${projectId}`);

    } catch (error) {
        console.error("Error al crear subtarea:", error);
        req.session.mensaje = 'Error al crear la subtarea. Inténtalo de nuevo.';
        next(error); // Pasa el error al siguiente middleware de manejo de errores
    }
};

// --- POST para Crear Tarea (ajustado para usar loadProjectDetailsData si falla validación) ---
exports.postCreateTask = async (req, res, next) => {
    const projectId = req.params.idProyecto; 
    const currentUserId = req.session.usuario ? req.session.usuario.id : null;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        try {
            const { proyecto, participantes, tareas } = await loadProjectDetailsData(projectId, currentUserId);
            return res.render('project-details', {
                csrfToken: req.session.csrfToken,
                proyecto: proyecto,
                participantes: participantes,
                tareas: tareas,
                usuarioActual: req.session.usuario,
                mensaje: null,
                errors: errors.array(),
                oldInput: req.body 
            });
        } catch (error) {
            console.error("Error al re-renderizar la página con errores de tarea:", error);
            req.session.mensaje = 'Error interno al procesar la tarea.';
            return res.redirect(`/proyectos/${projectId}`);
        }
    }

    if (!currentUserId) {
        req.session.mensaje = 'Necesitas iniciar sesión para crear tareas.';
        return res.redirect('/');
    }

    try {
        const pool = await sql.connect(config);
        const checkAdmin = await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .input('idUsuario', sql.Int, currentUserId)
            .query(`
                SELECT 1
                FROM ParticipantesProyecto
                WHERE idProyecto = @idProyecto
                AND idUsuario = @idUsuario
                AND rolProyecto = 'admin'
                AND estadoInvitacion = 'aceptada';
            `);
        
        if (checkAdmin.recordset.length === 0) {
            req.session.mensaje = 'No tienes permiso para crear tareas en este proyecto.';
            return res.redirect(`/proyectos/${projectId}`);
        }

        const { nombreTarea, descripcionTarea, fechaEntrega, estadoTarea, prioridadTarea, idUsuarioAsignado } = req.body;

        await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .input('nombreTarea', sql.NVarChar, nombreTarea)
            .input('descripcionTarea', sql.Text, descripcionTarea)
            .input('idUsuarioCreador', sql.Int, currentUserId)
            .input('idUsuarioAsignado', sql.Int, idUsuarioAsignado || null)
            .input('fechaEntrega', sql.DateTime, fechaEntrega)
            .input('estadoTarea', sql.NVarChar, estadoTarea || 'Pendiente')
            .input('prioridadTarea', sql.NVarChar, prioridadTarea || 'Media')
            .query(`
                INSERT INTO Tareas (idProyecto, nombreTarea, descripcionTarea, idUsuarioCreador, idUsuarioAsignado, fechaCreacion, fechaEntrega, estadoTarea, prioridadTarea)
                VALUES (@idProyecto, @nombreTarea, @descripcionTarea, @idUsuarioCreador, @idUsuarioAsignado, GETDATE(), @fechaEntrega, @estadoTarea, @prioridadTarea);
            `);

        req.session.mensaje = '¡Tarea creada exitosamente!';
        res.redirect(`/proyectos/${projectId}`);

    } catch (error) {
        console.error("Error al crear tarea:", error);
        req.session.mensaje = 'Error al crear la tarea. Inténtalo de nuevo.';
        next(error);
    }
};




// --- GET para Mostrar Formulario de Edición de Tarea ---
exports.getEditTask = async (req, res, next) => {
    const projectId = req.params.idProyecto;
    const taskId = req.params.idTarea;
    const currentUserId = req.session.usuario ? req.session.usuario.id : null;

    if (!currentUserId) {
        req.session.mensaje = 'Necesitas iniciar sesión para editar tareas.';
        return res.redirect('/');
    }

    try {
        const pool = await sql.connect(config);

        // Verificar si el usuario es admin del proyecto o el creador/asignado de la tarea
        const taskResult = await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .input('idTarea', sql.Int, taskId)
            .query(`
                SELECT T.*, P.idUsuarioAdmin
                FROM Tareas T
                JOIN Proyectos P ON T.idProyecto = P.idProyecto
                WHERE T.idTarea = @idTarea AND T.idProyecto = @idProyecto;
            `);
        const tarea = taskResult.recordset[0];

        if (!tarea) {
            req.session.mensaje = 'Tarea no encontrada o no pertenece a este proyecto.';
            return res.redirect(`/proyectos/${projectId}`);
        }

        // Obtener rol del usuario en el proyecto
        const participantRole = await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .input('idUsuario', sql.Int, currentUserId)
            .query(`SELECT rolProyecto FROM ParticipantesProyecto WHERE idProyecto = @idProyecto AND idUsuario = @idUsuario;`);
        const rolProyecto = participantRole.recordset[0] ? participantRole.recordset[0].rolProyecto : null;

        // Si no es admin y no es el creador/asignado, denegar acceso
        if (rolProyecto !== 'admin' && tarea.idUsuarioCreador !== currentUserId && tarea.idUsuarioAsignado !== currentUserId) {
            req.session.mensaje = 'No tienes permiso para editar esta tarea.';
            return res.redirect(`/proyectos/${projectId}`);
        }

        // Obtener participantes para el dropdown de "Asignar a"
        const participantsResult = await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .query(`
                SELECT U.idUsuario, U.nombreUsuario
                FROM ParticipantesProyecto PP
                JOIN Usuarios U ON PP.idUsuario = U.idUsuario
                WHERE PP.idProyecto = @idProyecto AND PP.estadoInvitacion = 'aceptada';
            `);
        const participantes = participantsResult.recordset;

        res.render('edit-task', {
            csrfToken: req.session.csrfToken,
            proyectoId: projectId,
            tarea: tarea,
            participantes: participantes,
            usuarioActual: req.session.usuario,
            mensaje: req.session.mensaje,
            errors: null,
            oldInput: null // <--- ¡AGREGA ESTA LÍNEA!
        });
        req.session.mensaje = null;

    } catch (error) {
        console.error("Error al obtener tarea para edición:", error);
        req.session.mensaje = 'Error al cargar los detalles de la tarea para edición.';
        next(error);
    }
};


// --- POST para Actualizar Tarea ---
exports.postEditTask = async (req, res, next) => {
    const projectId = req.params.idProyecto;
    const taskId = req.params.idTarea;
    const currentUserId = req.session.usuario ? req.session.usuario.id : null;

    if (!currentUserId) {
        req.session.mensaje = 'Necesitas iniciar sesión para editar tareas.';
        return res.redirect('/');
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        try {
            const pool = await sql.connect(config);
            const taskResult = await pool.request()
                .input('idTarea', sql.Int, taskId)
                .query(`SELECT T.* FROM Tareas T WHERE T.idTarea = @idTarea;`);
            const tarea = taskResult.recordset[0];

            const participantsResult = await pool.request()
                .input('idProyecto', sql.Int, projectId)
                .query(`SELECT U.idUsuario, U.nombreUsuario FROM ParticipantesProyecto PP JOIN Usuarios U ON PP.idUsuario = U.idUsuario WHERE PP.idProyecto = @idProyecto AND PP.estadoInvitacion = 'aceptada';`);
            const participantes = participantsResult.recordset;

            return res.render('edit-task', {
                csrfToken: req.session.csrfToken,
                proyectoId: projectId,
                tarea: tarea,
                participantes: participantes,
                usuarioActual: req.session.usuario,
                mensaje: null,
                errors: errors.array(),
                oldInput: req.body
            });
        } catch (error) {
            console.error("Error al re-renderizar la edición de tarea con errores:", error);
            req.session.mensaje = 'Error al validar la edición de la tarea.';
            return res.redirect(`/proyectos/${projectId}`);
        }
    }

    try {
        const pool = await sql.connect(config);

        // Verificar si el usuario es admin del proyecto o el creador/asignado de la tarea antes de actualizar
        const taskPermissionCheck = await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .input('idTarea', sql.Int, taskId)
            .input('idUsuario', sql.Int, currentUserId) // <--- ¡AGREGA ESTA LÍNEA AQUÍ!
            .query(`
                SELECT T.idUsuarioCreador, T.idUsuarioAsignado, PP.rolProyecto
                FROM Tareas T
                JOIN ParticipantesProyecto PP ON T.idProyecto = PP.idProyecto AND PP.idUsuario = @idUsuario
                WHERE T.idTarea = @idTarea AND T.idProyecto = @idProyecto;
            `);
        const permissionInfo = taskPermissionCheck.recordset[0];

        if (!permissionInfo || (permissionInfo.rolProyecto !== 'admin' && permissionInfo.idUsuarioCreador !== currentUserId && permissionInfo.idUsuarioAsignado !== currentUserId)) {
            req.session.mensaje = 'No tienes permiso para editar esta tarea.';
            return res.redirect(`/proyectos/${projectId}`);
        }

        const { nombreTarea, descripcionTarea, fechaEntrega, estadoTarea, prioridadTarea, idUsuarioAsignado } = req.body;

        await pool.request()
            .input('idTarea', sql.Int, taskId)
            .input('nombreTarea', sql.NVarChar, nombreTarea)
            .input('descripcionTarea', sql.Text, descripcionTarea)
            .input('idUsuarioAsignado', sql.Int, idUsuarioAsignado || null)
            .input('fechaEntrega', sql.DateTime, fechaEntrega)
            .input('estadoTarea', sql.NVarChar, estadoTarea)
            .input('prioridadTarea', sql.NVarChar, prioridadTarea)
            .query(`
                UPDATE Tareas
                SET nombreTarea = @nombreTarea,
                    descripcionTarea = @descripcionTarea,
                    idUsuarioAsignado = @idUsuarioAsignado,
                    fechaEntrega = @fechaEntrega,
                    estadoTarea = @estadoTarea,
                    prioridadTarea = @prioridadTarea
                WHERE idTarea = @idTarea;
            `);

        req.session.mensaje = '¡Tarea actualizada exitosamente!';
        res.redirect(`/proyectos/${projectId}`);

    } catch (error) {
        console.error("Error al actualizar tarea:", error);
        req.session.mensaje = 'Error al actualizar la tarea. Inténtalo de nuevo.';
        next(error);
    }
};


// --- POST para Eliminar Tarea ---
exports.postDeleteTask = async (req, res, next) => {
    const projectId = req.params.idProyecto;
    const taskId = req.params.idTarea;
    const currentUserId = req.session.usuario ? req.session.usuario.id : null;

    if (!currentUserId) {
        req.session.mensaje = 'Necesitas iniciar sesión para eliminar tareas.';
        return res.redirect('/');
    }

    try {
        const pool = await sql.connect(config);

        // Verificar si el usuario es admin del proyecto o el creador de la tarea
        const taskPermissionCheck = await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .input('idTarea', sql.Int, taskId)
            .input('idUsuario', sql.Int, currentUserId) // <--- ¡AGREGA ESTA LÍNEA!
            .query(`
                SELECT T.idUsuarioCreador, PP.rolProyecto
                FROM Tareas T
                JOIN ParticipantesProyecto PP ON T.idProyecto = PP.idProyecto AND PP.idUsuario = @idUsuario
                WHERE T.idTarea = @idTarea AND T.idProyecto = @idProyecto;
            `);
        const permissionInfo = taskPermissionCheck.recordset[0];

        if (!permissionInfo || (permissionInfo.rolProyecto !== 'admin' && permissionInfo.idUsuarioCreador !== currentUserId)) {
            req.session.mensaje = 'No tienes permiso para eliminar esta tarea.';
            return res.redirect(`/proyectos/${projectId}`);
        }

        // Eliminar subtareas asociadas primero (debido a la clave foránea)
        await pool.request()
            .input('idTarea', sql.Int, taskId)
            .query(`DELETE FROM Subtareas WHERE idTarea = @idTarea;`);

        // Luego eliminar la tarea
        await pool.request()
            .input('idTarea', sql.Int, taskId)
            .query(`DELETE FROM Tareas WHERE idTarea = @idTarea;`);

        req.session.mensaje = '¡Tarea eliminada exitosamente!';
        res.redirect(`/proyectos/${projectId}`);

    } catch (error) {
        console.error("Error al eliminar tarea:", error);
        req.session.mensaje = 'Error al eliminar la tarea. Inténtalo de nuevo.';
        next(error);
    }
};




exports.getEditSubtask = async (req, res, next) => {
    const projectId = req.params.idProyecto;
    const taskId = req.params.idTarea;
    const subtaskId = req.params.idSubtarea;
    const currentUserId = req.session.usuario ? req.session.usuario.id : null;

    if (!currentUserId) {
        req.session.mensaje = 'Necesitas iniciar sesión para editar subtareas.';
        return res.redirect('/');
    }

    try {
        const pool = await sql.connect(config);

        // Verificar si la subtarea existe y pertenece a la tarea/proyecto correctos
        const subtaskResult = await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .input('idTarea', sql.Int, taskId)
            .input('idSubtarea', sql.Int, subtaskId)
            .query(`
                SELECT ST.*, T.idUsuarioCreador AS idCreadorTarea, T.idUsuarioAsignado AS idAsignadoTarea, P.idUsuarioAdmin
                FROM Subtareas ST
                JOIN Tareas T ON ST.idTarea = T.idTarea
                JOIN Proyectos P ON T.idProyecto = P.idProyecto
                WHERE ST.idSubtarea = @idSubtarea
                AND ST.idTarea = @idTarea
                AND T.idProyecto = @idProyecto;
            `);
        const subtarea = subtaskResult.recordset[0];

        if (!subtarea) {
            req.session.mensaje = 'Subtarea no encontrada o no pertenece a este proyecto/tarea.';
            return res.redirect(`/proyectos/${projectId}`);
        }

        // Obtener rol del usuario en el proyecto
        const participantRole = await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .input('idUsuario', sql.Int, currentUserId)
            .query(`SELECT rolProyecto FROM ParticipantesProyecto WHERE idProyecto = @idProyecto AND idUsuario = @idUsuario;`);
        const rolProyecto = participantRole.recordset[0] ? participantRole.recordset[0].rolProyecto : null;

        // Permisos para editar subtarea:
        // - Admin del proyecto
        // - Creador de la subtarea
        // - Asignado a la subtarea
        // - Creador de la tarea principal
        // - Asignado a la tarea principal
        if (rolProyecto !== 'admin' &&
            subtarea.idUsuarioCreador !== currentUserId &&
            subtarea.idUsuarioAsignado !== currentUserId &&
            subtarea.idCreadorTarea !== currentUserId &&
            subtarea.idAsignadoTarea !== currentUserId
        ) {
            req.session.mensaje = 'No tienes permiso para editar esta subtarea.';
            return res.redirect(`/proyectos/${projectId}`);
        }

        // Obtener participantes del proyecto para el dropdown de "Asignar a"
        const participantsResult = await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .query(`SELECT U.idUsuario, U.nombreUsuario FROM ParticipantesProyecto PP JOIN Usuarios U ON PP.idUsuario = U.idUsuario WHERE PP.idProyecto = @idProyecto AND PP.estadoInvitacion = 'aceptada';`);
        const participantes = participantsResult.recordset;

        res.render('edit-subtask', { // Necesitarás una nueva vista EJS para esto
            csrfToken: req.session.csrfToken,
            proyectoId: projectId,
            tareaId: taskId,
            subtarea: subtarea,
            participantes: participantes,
            usuarioActual: req.session.usuario,
            mensaje: req.session.mensaje,
            errors: null,
            oldInput: null // Para la primera carga
        });
        req.session.mensaje = null;

    } catch (error) {
        console.error("Error al obtener subtarea para edición:", error);
        req.session.mensaje = 'Error al cargar los detalles de la subtarea para edición.';
        next(error);
    }
};

// --- POST para Actualizar Subtarea ---
exports.postEditSubtask = async (req, res, next) => {
    const projectId = req.params.idProyecto;
    const taskId = req.params.idTarea;
    const subtaskId = req.params.idSubtarea;
    const currentUserId = req.session.usuario ? req.session.usuario.id : null;

    if (!currentUserId) {
        req.session.mensaje = 'Necesitas iniciar sesión para editar subtareas.';
        return res.redirect('/');
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        try {
            const pool = await sql.connect(config);
            const subtaskResult = await pool.request()
                .input('idSubtarea', sql.Int, subtaskId)
                .query(`SELECT ST.* FROM Subtareas ST WHERE ST.idSubtarea = @idSubtarea;`);
            const subtarea = subtaskResult.recordset[0];

            const participantsResult = await pool.request()
                .input('idProyecto', sql.Int, projectId)
                .query(`SELECT U.idUsuario, U.nombreUsuario FROM ParticipantesProyecto PP JOIN Usuarios U ON PP.idUsuario = U.idUsuario WHERE PP.idProyecto = @idProyecto AND PP.estadoInvitacion = 'aceptada';`);
            const participantes = participantsResult.recordset;

            return res.render('edit-subtask', {
                csrfToken: req.session.csrfToken,
                proyectoId: projectId,
                tareaId: taskId,
                subtarea: subtarea,
                participantes: participantes,
                usuarioActual: req.session.usuario,
                mensaje: null,
                errors: errors.array(),
                oldInput: req.body
            });
        } catch (error) {
            console.error("Error al re-renderizar la edición de subtarea con errores:", error);
            req.session.mensaje = 'Error al validar la edición de la subtarea.';
            return res.redirect(`/proyectos/${projectId}`);
        }
    }

    try {
        const pool = await sql.connect(config);

        // Verificar permisos antes de actualizar
        const subtaskPermissionCheck = await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .input('idTarea', sql.Int, taskId)
            .input('idSubtarea', sql.Int, subtaskId)
            .input('idUsuario', sql.Int, currentUserId)
            .query(`
                SELECT ST.idUsuarioCreador, ST.idUsuarioAsignado, T.idUsuarioCreador AS idCreadorTarea, T.idUsuarioAsignado AS idAsignadoTarea, PP.rolProyecto
                FROM Subtareas ST
                JOIN Tareas T ON ST.idTarea = T.idTarea
                JOIN ParticipantesProyecto PP ON T.idProyecto = PP.idProyecto AND PP.idUsuario = @idUsuario
                WHERE ST.idSubtarea = @idSubtarea
                AND ST.idTarea = @idTarea
                AND T.idProyecto = @idProyecto;
            `);
        const permissionInfo = subtaskPermissionCheck.recordset[0];

        if (!permissionInfo || (
            permissionInfo.rolProyecto !== 'admin' &&
            permissionInfo.idUsuarioCreador !== currentUserId &&
            permissionInfo.idUsuarioAsignado !== currentUserId &&
            permissionInfo.idCreadorTarea !== currentUserId &&
            permissionInfo.idAsignadoTarea !== currentUserId
        )) {
            req.session.mensaje = 'No tienes permiso para editar esta subtarea.';
            return res.redirect(`/proyectos/${projectId}`);
        }

        const { nombreSubtarea, descripcionSubtarea, fechaEntregaSubtarea, estadoSubtarea, prioridadSubtarea, idUsuarioAsignadoSubtarea } = req.body;

        await pool.request()
            .input('idSubtarea', sql.Int, subtaskId)
            .input('nombreSubtarea', sql.NVarChar, nombreSubtarea)
            .input('descripcionSubtarea', sql.Text, descripcionSubtarea)
            .input('idUsuarioAsignado', sql.Int, idUsuarioAsignadoSubtarea || null)
            .input('fechaEntrega', sql.DateTime, fechaEntregaSubtarea)
            .input('estadoSubtarea', sql.NVarChar, estadoSubtarea)
            .input('prioridadSubtarea', sql.NVarChar, prioridadSubtarea)
            .query(`
                UPDATE Subtareas
                SET nombreSubtarea = @nombreSubtarea,
                    descripcionSubtarea = @descripcionSubtarea,
                    idUsuarioAsignado = @idUsuarioAsignado,
                    fechaEntrega = @fechaEntrega,
                    estadoSubtarea = @estadoSubtarea,
                    prioridadSubtarea = @prioridadSubtarea
                WHERE idSubtarea = @idSubtarea;
            `);

        req.session.mensaje = '¡Subtarea actualizada exitosamente!';
        res.redirect(`/proyectos/${projectId}`);

    } catch (error) {
        console.error("Error al actualizar subtarea:", error);
        req.session.mensaje = 'Error al actualizar la subtarea. Inténtalo de nuevo.';
        next(error);
    }
};

// --- POST para Eliminar Subtarea ---
exports.postDeleteSubtask = async (req, res, next) => {
    const projectId = req.params.idProyecto;
    const taskId = req.params.idTarea;
    const subtaskId = req.params.idSubtarea;
    const currentUserId = req.session.usuario ? req.session.usuario.id : null;

    if (!currentUserId) {
        req.session.mensaje = 'Necesitas iniciar sesión para eliminar subtareas.';
        return res.redirect('/');
    }

    try {
        const pool = await sql.connect(config);

        // Verificar permisos antes de eliminar
        const subtaskPermissionCheck = await pool.request()
            .input('idProyecto', sql.Int, projectId)
            .input('idTarea', sql.Int, taskId)
            .input('idSubtarea', sql.Int, subtaskId)
            .input('idUsuario', sql.Int, currentUserId)
            .query(`
                SELECT ST.idUsuarioCreador, ST.idUsuarioAsignado, T.idUsuarioCreador AS idCreadorTarea, T.idUsuarioAsignado AS idAsignadoTarea, PP.rolProyecto
                FROM Subtareas ST
                JOIN Tareas T ON ST.idTarea = T.idTarea
                JOIN ParticipantesProyecto PP ON T.idProyecto = PP.idProyecto AND PP.idUsuario = @idUsuario
                WHERE ST.idSubtarea = @idSubtarea
                AND ST.idTarea = @idTarea
                AND T.idProyecto = @idProyecto;
            `);
        const permissionInfo = subtaskPermissionCheck.recordset[0];

        if (!permissionInfo || (
            permissionInfo.rolProyecto !== 'admin' &&
            permissionInfo.idUsuarioCreador !== currentUserId &&
            permissionInfo.idUsuarioAsignado !== currentUserId &&
            permissionInfo.idCreadorTarea !== currentUserId &&
            permissionInfo.idAsignadoTarea !== currentUserId
        )) {
            req.session.mensaje = 'No tienes permiso para eliminar esta subtarea.';
            return res.redirect(`/proyectos/${projectId}`);
        }

        // Eliminar la subtarea
        await pool.request()
            .input('idSubtarea', sql.Int, subtaskId)
            .query(`DELETE FROM Subtareas WHERE idSubtarea = @idSubtarea;`);

        req.session.mensaje = '¡Subtarea eliminada exitosamente!';
        res.redirect(`/proyectos/${projectId}`);

    } catch (error) {
        console.error("Error al eliminar subtarea:", error);
        req.session.mensaje = 'Error al eliminar la subtarea. Inténtalo de nuevo.';
        next(error);
    }
};

// ... (exportaciones al final del archivo si no estás usando export default)





// ... Aquí irían más funciones para editar y eliminar proyectos