document.addEventListener("DOMContentLoaded", () => {
  const uname = document.getElementById("uname");
  const pass = document.getElementById("pass");
  const btn = document.getElementById("login-btn");
  const msg = document.getElementById("msg");
  const form = document.querySelector("form");

  const positions = ['shift-left', 'shift-top', 'shift-right', 'shift-bottom'];
  let currentIndex = 0;

  function showMsg(text) {
    msg.textContent = text;
    msg.style.visibility = 'visible';
  }

  function hideMsg() {
    msg.style.visibility = 'hidden';
  }

  function shiftButton() {
    const user = uname.value.trim();
    const pwd = pass.value.trim();

    if (user === "" || pwd === "") {
      showMsg("Por favor completa los campos");
      // Mover el botón
      btn.classList.remove(...positions);
      btn.classList.add(positions[currentIndex]);
      currentIndex = (currentIndex + 1) % positions.length;
    } else {
      btn.classList.remove(...positions);
      hideMsg();
    }
  }

  btn.addEventListener("mouseover", shiftButton);

  btn.addEventListener("click", (e) => {
    e.preventDefault(); // Evita que el botón envíe el formulario si faltan datos

    const user = uname.value.trim();
    const pwd = pass.value.trim();

    if (user === "" || pwd === "") {
      shiftButton();
    } else {
      hideMsg();
      form.submit(); // Enviar al backend (a tu ruta / con método POST)
    }
  });
});
