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





// ------------------------------ CAREERS MODAL -------------------------------------------
// Handle modal functionality
const modal = document.getElementById('applicationModal');
const closeModal = document.querySelector('.close-btn');
const applyButtons = document.querySelectorAll('.apply-btn');

applyButtons.forEach(button => {
    button.addEventListener('click', () => {
        modal.classList.remove('hidden');
    });
});

closeModal.addEventListener('click', () => {
    modal.classList.add('hidden');
});

// Form submission logic
const applicationForm = document.getElementById('applicationForm');
applicationForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const position = document.getElementById('position').value;
    const resume = document.getElementById('resume').files[0];

    if (!resume) {
        alert('Please upload a resume.');
        return;
    }

    // Create GitHub API request to upload files
    const githubToken = 'your_github_personal_access_token'; // Replace with your GitHub PAT
    const repoOwner = 'your_github_username'; // Replace with your GitHub username
    const repoName = 'your_github_repo'; // Replace with your repository name
    const folderPath = `applicants/${firstName}_${lastName}`;

    // Create a folder with the applicant's name and upload resume
    const uploadToGitHub = async (fileName, fileContent) => {
        const url = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${folderPath}/${fileName}`;
        const encodedContent = btoa(fileContent); // Base64 encode file content
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${githubToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: `Add application for ${firstName} ${lastName}`,
                content: encodedContent,
            }),
        });
        return response.json();
    };

    // Read the resume file content
    const reader = new FileReader();
    reader.onload = async () => {
        const resumeContent = reader.result.split(',')[1]; // Get Base64 content
        try {
            await uploadToGitHub(resume.name, resumeContent);
            alert('Application submitted successfully!');
            modal.classList.add('hidden');
            applicationForm.reset();
        } catch (error) {
            console.error('Error uploading application:', error);
            alert('Failed to submit application. Please try again.');
        }
    };
    reader.readAsDataURL(resume);
});
