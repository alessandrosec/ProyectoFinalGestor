document.addEventListener('DOMContentLoaded', function () {
  const select = document.getElementById('imagenSeleccionada');
  const contenedor = document.getElementById('vista-previa');

  if (select) {
    select.addEventListener('change', function () {
      const imagen = this.value;
      if (imagen) {
        contenedor.innerHTML = `<img src="${imagen}" width="80" style="border-radius: 50%;">`;
      } else {
        contenedor.innerHTML = '';
      }
    });
  }
});
