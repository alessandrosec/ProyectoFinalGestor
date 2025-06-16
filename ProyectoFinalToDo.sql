Create database ProyectoToDo
use ProyectoToDo

CREATE TABLE Usuarios (
  idUsuario INT PRIMARY KEY IDENTITY(1,1),
  nombreUsuario NVARCHAR(50) NOT NULL,
  correoUsuario NVARCHAR(100) UNIQUE NOT NULL,
  contrasenia NVARCHAR(255) NOT NULL,
  rol NVARCHAR(20) DEFAULT 'usuario',
  fotoPerfil NVARCHAR(255), 
  tokenRecuperacion NVARCHAR(255), 
  tokenExpiracion DATETIME          
);

create table Proyectos(
idProyectos int identity(1,1) primary key,
idUsuariosProyectos int,
nombreProyecto nvarchar(50),
estado nvarchar(7) default('Privado'),
fechaFinalizacion date,
descripcionProyecto text
);

alter table Proyectos
add constraint FK_usuariosProyectos
foreign key(idUsuariosProyectos) references UsuariosProyectos(idUsuariosProyectos);


create table UsuariosProyectos(
idUsuariosProyectos int identity(1,1) primary key,
usuarioAdmin int,
usuario1 int,
usuario2 int,
usuario3 int,
usuario4 int,
usuario5 int,
usuario6 int,
foreign key (usuarioAdmin) references Usuarios(idUsuario),
foreign key (usuario1) references Usuarios(idUsuario),
foreign key (usuario2) references Usuarios(idUsuario),
foreign key (usuario3) references Usuarios(idUsuario),
foreign key (usuario4) references Usuarios(idUsuario),
foreign key (usuario5) references Usuarios(idUsuario),
foreign key (usuario6) references Usuarios(idUsuario)
);

create table Tareas(
idTareas int identity(1,1) primary key,
idProyectos int,
nombreTareas nvarchar(50),
creadorTarea int,
usuarioAsignado int,
fechaInicioTarea date default getdate(),
fechaFinalizacionTarea date,
estadoTarea nvarchar(10) default('En proceso'),
prioridadTarea nvarchar(5) default('Media'),
descripcionTarea text,
foreign key(idProyectos) references Proyectos(idProyectos),
foreign key(creadorTarea) references Usuarios(idUsuario),
foreign key(usuarioAsignado) references Usuarios(idUsuario)
);

create table SubTareas(
idSubTarea int identity(1,1) primary key,
idTareas int,
nombreSubTarea nvarchar(50),
fechaInicioSubTarea date default getdate(),
fechaFinalizacionSubTarea date,
estadoSubTarea nvarchar(10) default('En proceso'),
prioridadSubTarea nvarchar(5) default('Media'),
descripcionSubTarea text,
foreign key(idTareas) references Tareas(idTareas)
);