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

    // Input validation
    if (!firstName || !lastName || !position) {
        alert('Please fill out all required fields (First Name, Last Name, Position).');
        return;
    }

    if (!resume) {
        alert('Please upload a resume.');
        return;
    }

    const allowedFileTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedFileTypes.includes(resume.type)) {
        alert('Invalid file format. Please upload a PDF, DOC, or DOCX file.');
        return;

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
        // Placeholder for serverless backend call
    try {
        // Replace this with a serverless function to securely interact with the GitHub API
        console.log('Simulating resume upload...', {
            firstName,
            lastName,
            position,
            resumeName: resume.name
        });

        alert('Application submitted successfully!');
        modal.classList.add('hidden');
        applicationForm.reset();
    } catch (error) {
        console.error('Error submitting application:', error);
        alert('Failed to submit application. Please try again.');
    }
});
