// Toggle job description
document.querySelectorAll('.toggle-description').forEach(button => {
    button.addEventListener('click', () => {
        const description = button.previousElementSibling;
        if (description.classList.contains('hidden')) {
            description.classList.remove('hidden');
            button.textContent = 'Show Less';
        } else {
            description.classList.add('hidden');
            button.textContent = 'Learn More';
        }
    });
});

// Apply button functionality
document.querySelectorAll('.apply-btn').forEach(button => {
    button.addEventListener('click', () => {
        alert("Apply functionality coming soon!");
    });
});
