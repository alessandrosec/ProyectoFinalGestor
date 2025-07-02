-- Usar tu base de datos
USE ProyectoToDo;
GO

-- 1. Eliminar tablas que serán recreadas o modificadas, si existen y tienen dependencias
-- (Ejecuta esto con precaución en un entorno de desarrollo.
-- Si tienes datos, necesitarás un plan de migración más robusto.)

IF OBJECT_ID('dbo.SubTareas', 'U') IS NOT NULL
DROP TABLE dbo.SubTareas;

IF OBJECT_ID('dbo.Tareas', 'U') IS NOT NULL
DROP TABLE dbo.Tareas;

-- Primero, eliminar la restricción de FK en Proyectos si existe
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_usuariosProyectos' AND parent_object_id = OBJECT_ID('dbo.Proyectos'))
ALTER TABLE dbo.Proyectos DROP CONSTRAINT FK_usuariosProyectos;

IF OBJECT_ID('dbo.Proyectos', 'U') IS NOT NULL
DROP TABLE dbo.Proyectos;

IF OBJECT_ID('dbo.ParticipantesProyecto', 'U') IS NOT NULL
DROP TABLE dbo.ParticipantesProyecto;

IF OBJECT_ID('dbo.UsuariosProyectos', 'U') IS NOT NULL
DROP TABLE dbo.UsuariosProyectos;

IF OBJECT_ID('dbo.Notificaciones', 'U') IS NOT NULL
DROP TABLE dbo.Notificaciones;


-- 2. Modificación de la tabla Usuarios (tuya, sin cambios mayores aquí)
-- Solo asegúrate de que exista con las columnas que ya tienes.
-- Si ya la tienes creada, no necesitas ejecutar este CREATE TABLE.
CREATE TABLE Usuarios (
    idUsuario INT PRIMARY KEY IDENTITY(1,1),
    nombreUsuario NVARCHAR(50) NOT NULL,
    correoUsuario NVARCHAR(100) UNIQUE NOT NULL,
    contrasenia NVARCHAR(255) NOT NULL,
    rol NVARCHAR(20) DEFAULT 'usuario', -- Rol general del sistema (ej. 'admin_general', 'usuario')
    fotoPerfil NVARCHAR(255),
    tokenRecuperacion NVARCHAR(255),
    tokenExpiracion DATETIME
);


-- 3. Creación de la tabla Proyectos (Modificada)
CREATE TABLE Proyectos (
    idProyecto INT IDENTITY(1,1) PRIMARY KEY,
    idUsuarioAdmin INT NOT NULL, -- El ID del usuario que creó y administra el proyecto
    nombreProyecto NVARCHAR(255) NOT NULL,
    descripcionProyecto TEXT,
    fechaCreacion DATETIME DEFAULT GETDATE(),
    fechaEntrega DATETIME, -- Renombrado de fechaFinalizacion
    estadoProyecto NVARCHAR(50) DEFAULT 'Activo', -- Nuevo: estado del proyecto (ej. 'Activo', 'Archivado', 'Completado')
    CONSTRAINT FK_Proyecto_UsuarioAdmin FOREIGN KEY (idUsuarioAdmin) REFERENCES Usuarios(idUsuario)
);


-- 4. Creación de la tabla ParticipantesProyecto (Nueva)
-- Esta tabla maneja las relaciones entre usuarios y proyectos, incluyendo roles y estado de invitación.
CREATE TABLE ParticipantesProyecto (
    idParticipante INT IDENTITY(1,1) PRIMARY KEY,
    idProyecto INT NOT NULL,
    idUsuario INT NOT NULL,
    rolProyecto NVARCHAR(50) NOT NULL, -- 'admin' (para el creador), 'miembro' (para invitados)
    estadoInvitacion NVARCHAR(50) DEFAULT 'pendiente', -- 'pendiente', 'aceptada', 'rechazada'
    fechaAsignacion DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_Participante_Proyecto FOREIGN KEY (idProyecto) REFERENCES Proyectos(idProyecto) ON DELETE CASCADE,
    CONSTRAINT FK_Participante_Usuario FOREIGN KEY (idUsuario) REFERENCES Usuarios(idUsuario),
    CONSTRAINT UQ_Proyecto_Usuario UNIQUE (idProyecto, idUsuario) -- Un usuario solo puede tener un rol por proyecto
);


-- 5. Creación de la tabla Tareas (Modificada)
CREATE TABLE Tareas (
    idTarea INT IDENTITY(1,1) PRIMARY KEY,
    idProyecto INT NOT NULL,
    nombreTarea NVARCHAR(255) NOT NULL,
    descripcionTarea TEXT,
    idUsuarioCreador INT NOT NULL, -- Quién creó la tarea
    idUsuarioAsignado INT,        -- A quién está asignada la tarea (puede ser NULL)
    fechaCreacion DATETIME DEFAULT GETDATE(),
    fechaEntrega DATETIME,        -- Renombrado de fechaFinalizacionTarea
    estadoTarea NVARCHAR(50) DEFAULT 'Pendiente', -- Renombrado de estadoTarea, estados más claros
    prioridadTarea NVARCHAR(50) DEFAULT 'Media',  -- Renombrado de prioridadTarea
    CONSTRAINT FK_Tarea_Proyecto FOREIGN KEY (idProyecto) REFERENCES Proyectos(idProyecto) ON DELETE CASCADE,
    CONSTRAINT FK_Tarea_Creador FOREIGN KEY (idUsuarioCreador) REFERENCES Usuarios(idUsuario),
    CONSTRAINT FK_Tarea_Asignado FOREIGN KEY (idUsuarioAsignado) REFERENCES Usuarios(idUsuario)
);


-- 6. Creación de la tabla Subtareas (Modificada)
CREATE TABLE Subtareas (
    idSubtarea INT IDENTITY(1,1) PRIMARY KEY,
    idTarea INT NOT NULL,
    nombreSubtarea NVARCHAR(255) NOT NULL,
    descripcionSubtarea TEXT, -- Agregada para consistencia con Tareas
    idUsuarioCreador INT NOT NULL, -- Nuevo: Quién creó la subtarea
    idUsuarioAsignado INT,         -- Nuevo: A quién está asignada la subtarea (puede ser NULL)
    fechaCreacion DATETIME DEFAULT GETDATE(),
    fechaEntrega DATETIME,         -- Renombrado de fechaFinalizacionSubTarea
    estadoSubtarea NVARCHAR(50) DEFAULT 'Pendiente', -- Renombrado de estadoSubTarea
    prioridadSubtarea NVARCHAR(50) DEFAULT 'Media',  -- Renombrado de prioridadSubTarea
    CONSTRAINT FK_Subtarea_Tarea FOREIGN KEY (idTarea) REFERENCES Tareas(idTarea) ON DELETE CASCADE,
    CONSTRAINT FK_Subtarea_Creador FOREIGN KEY (idUsuarioCreador) REFERENCES Usuarios(idUsuario),
    CONSTRAINT FK_Subtarea_Asignado FOREIGN KEY (idUsuarioAsignado) REFERENCES Usuarios(idUsuario)
);


-- 7. Creación de la tabla Notificaciones (Nueva)
CREATE TABLE Notificaciones (
    idNotificacion INT IDENTITY(1,1) PRIMARY KEY,
    idUsuarioReceptor INT NOT NULL,
    tipoNotificacion NVARCHAR(100) NOT NULL,
    mensaje NVARCHAR(MAX) NOT NULL,
    idProyectoRelacionado INT,
    idTareaRelacionada INT,
    idSubtareaRelacionada INT,
    idUsuarioEmisor INT,
    fechaCreacion DATETIME DEFAULT GETDATE(),
    leida BIT DEFAULT 0
);

-- Agregar claves foráneas una por una
ALTER TABLE Notificaciones
ADD CONSTRAINT FK_Notificacion_UsuarioReceptor 
FOREIGN KEY (idUsuarioReceptor) REFERENCES Usuarios(idUsuario);

ALTER TABLE Notificaciones
ADD CONSTRAINT FK_Notificacion_ProyectoRelacionado 
FOREIGN KEY (idProyectoRelacionado) REFERENCES Proyectos(idProyecto) ON DELETE SET NULL;

ALTER TABLE Notificaciones
ADD CONSTRAINT FK_Notificacion_TareaRelacionada 
FOREIGN KEY (idTareaRelacionada) REFERENCES Tareas(idTarea) ON DELETE SET NULL;

ALTER TABLE Notificaciones
ADD CONSTRAINT FK_Notificacion_SubtareaRelacionada 
FOREIGN KEY (idSubtareaRelacionada) REFERENCES Subtareas(idSubtarea) ON DELETE SET NULL;

ALTER TABLE Notificaciones
ADD CONSTRAINT FK_Notificacion_UsuarioEmisor 
FOREIGN KEY (idUsuarioEmisor) REFERENCES Usuarios(idUsuario);