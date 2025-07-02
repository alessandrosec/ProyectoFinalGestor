const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { isAuthenticated } = require('../middlewares/auth'); // Necesitarás un middleware para verificar si el usuario está autenticado

const { body } = require('express-validator'); 

// Middleware para verificar autenticación
// Este middleware `isAuthenticated` lo crearíamos para asegurarnos de que `req.session.usuario` exista.
// Por ejemplo, en `backend/middlewares/auth.js`:
/*
    exports.isAuthenticated = (req, res, next) => {
        if (req.session.usuario) {
            return next();
        }
        req.session.mensaje = 'Debes iniciar sesión para acceder a esta página.';
        res.redirect('/');
    };
*/

router.get('/proyectos/crear', isAuthenticated, projectController.getCreateProject);
router.post('/proyectos/crear', isAuthenticated, projectController.validateProject, projectController.postCreateProject);
router.get('/proyectos', isAuthenticated, projectController.getProjects);

// ... Más rutas para proyectos

router.get('/proyectos/:idProyecto', isAuthenticated, projectController.getProjectDetails);



// NUEVAS RUTAS para Edición y Eliminación de Proyectos
router.get('/proyectos/editar/:idProyecto', isAuthenticated, projectController.getEditProject);
router.post('/proyectos/editar/:idProyecto', isAuthenticated, projectController.validateProject, projectController.postEditProject);
router.post('/proyectos/eliminar/:idProyecto', isAuthenticated, projectController.deleteProject);




// Rutas para Tareas
router.post('/proyectos/:idProyecto/tareas', isAuthenticated, projectController.validateTask, projectController.postCreateTask);

// Rutas para Subtareas (inicialmente, post directo desde la página de proyecto)



// --- Rutas para Editar/Eliminar Tareas ---
router.get('/proyectos/:idProyecto/tareas/editar/:idTarea', isAuthenticated, projectController.getEditTask);

router.post('/proyectos/:idProyecto/tareas/editar/:idTarea', isAuthenticated, [
        body('nombreTarea').trim().notEmpty().withMessage('El nombre de la tarea es requerido.'),
        body('descripcionTarea').trim().optional(),
        body('fechaEntrega').isISO8601().toDate().withMessage('La fecha de entrega de la tarea no es válida.'),
        body('estadoTarea').isIn(['Pendiente', 'En Proceso', 'Completada', 'Bloqueada']).withMessage('Estado de tarea inválido.'),
        body('prioridadTarea').isIn(['Baja', 'Media', 'Alta', 'Urgente']).withMessage('Prioridad de tarea inválida.'),
        body('idUsuarioAsignado').optional({ nullable: true }).isInt().withMessage('El usuario asignado debe ser un número entero válido.')
    ],
    projectController.postEditTask
);
router.post('/proyectos/:idProyecto/tareas/eliminar/:idTarea', isAuthenticated, projectController.postDeleteTask);

router.post('/proyectos/:idProyecto/tareas/:idTarea/subtareas',
    isAuthenticated,
    [
        body('nombreSubtarea').trim().notEmpty().withMessage('El nombre de la subtarea es requerido.'),
        body('descripcionSubtarea').trim().optional(),
        body('fechaEntregaSubtarea').isISO8601().toDate().withMessage('La fecha de entrega de la subtarea no es válida.'),
        body('estadoSubtarea').isIn(['Pendiente', 'En Proceso', 'Completada', 'Bloqueada']).withMessage('Estado de subtarea inválido.'),
        body('prioridadSubtarea').isIn(['Baja', 'Media', 'Alta', 'Urgente']).withMessage('Prioridad de subtarea inválida.'),
        body('idUsuarioAsignadoSubtarea').optional({ nullable: true }).isInt().withMessage('El usuario asignado debe ser un número entero válido.')
    ],
    projectController.postCreateSubtask
);

router.get('/proyectos/:idProyecto/tareas/:idTarea/subtareas/editar/:idSubtarea', isAuthenticated, projectController.getEditSubtask);
router.post('/proyectos/:idProyecto/tareas/:idTarea/subtareas/editar/:idSubtarea',
    isAuthenticated,
    [
        body('nombreSubtarea').trim().notEmpty().withMessage('El nombre de la subtarea es requerido.'),
        body('descripcionSubtarea').trim().optional(),
        body('fechaEntregaSubtarea').isISO8601().toDate().withMessage('La fecha de entrega de la subtarea no es válida.'),
        body('estadoSubtarea').isIn(['Pendiente', 'En Proceso', 'Completada', 'Bloqueada']).withMessage('Estado de subtarea inválido.'),
        body('prioridadSubtarea').isIn(['Baja', 'Media', 'Alta', 'Urgente']).withMessage('Prioridad de subtarea inválida.'),
        body('idUsuarioAsignadoSubtarea').optional({ nullable: true }).isInt().withMessage('El usuario asignado debe ser un número entero válido.')
    ],
    projectController.postEditSubtask
);
router.post('/proyectos/:idProyecto/tareas/:idTarea/subtareas/eliminar/:idSubtarea', isAuthenticated, projectController.postDeleteSubtask);

module.exports = router;