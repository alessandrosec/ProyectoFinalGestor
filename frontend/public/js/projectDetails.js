// public/js/projectDetails.js
document.addEventListener('DOMContentLoaded', function() {
    const subtaskCreateButtons = document.querySelectorAll('.subtask-create-btn');

    subtaskCreateButtons.forEach(button => {
        button.addEventListener('click', function() {
            const taskId = this.dataset.taskId;
            const form = document.getElementById('subtaskForm-' + taskId);

            if (form) {
                if (form.style.display === 'none' || form.style.display === '') {
                    form.style.display = 'block';
                } else {
                    form.style.display = 'none';
                }
            } else {
                console.error('No se encontró el formulario con ID: subtaskForm-' + taskId);
            }
        });
    });
});