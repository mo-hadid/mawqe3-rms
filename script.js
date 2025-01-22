// Show More / Show Less functionality
document.querySelectorAll('.toggle-description').forEach(button => {
    button.addEventListener('click', () => {
        const description = button.previousElementSibling;

        if (description.classList.contains('hidden')) {
            // Show the description
            description.classList.remove('hidden');
            button.textContent = 'Show Less';
        } else {
            // Hide the description
            description.classList.add('hidden');
            button.textContent = 'Show More';
        }
    });
});

// Apply button functionality (placeholder for serverless function)
document.querySelectorAll('.apply-btn').forEach(button => {
    button.addEventListener('click', () => {
        alert('Apply button clicked! Form submission functionality will be implemented here.');
        // Implement serverless function for GitHub API interaction here
    });
});
