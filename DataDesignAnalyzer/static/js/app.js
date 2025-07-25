// app.js - Main application logic

// Register service worker for offline functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('Service Worker registered: ', registration);
            })
            .catch(error => {
                console.log('Service Worker registration failed: ', error);
            });
    });
}

// Store user information in localStorage
const saveUserData = (userData) => {
    localStorage.setItem('disasterReliefUser', JSON.stringify(userData));
};

// Get user information from localStorage
const getUserData = () => {
    const userData = localStorage.getItem('disasterReliefUser');
    return userData ? JSON.parse(userData) : null;
};

// Clear user data
const clearUserData = () => {
    localStorage.removeItem('disasterReliefUser');
};

// Get user's current location
const getUserLocation = () => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by your browser'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
            },
            (error) => {
                console.error('Error getting location:', error);
                reject(error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
};

// Register a new user (victim or volunteer)
const registerUser = async (formData) => {
    try {
        // Add location data if available
        try {
            const location = await getUserLocation();
            formData.append('location_lat', location.lat);
            formData.append('location_lng', location.lng);
        } catch (locError) {
            console.warn('Location not available:', locError);
        }

        const response = await fetch('/api/register', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        
        if (data.status === 'success') {
            // Save user data to localStorage
            saveUserData({
                id: data.user_id,
                name: formData.get('name'),
                contact: formData.get('contact'),
                role: formData.get('role')
            });
            
            return data;
        } else {
            throw new Error(data.message || 'Registration failed');
        }
    } catch (error) {
        console.error('Error registering user:', error);
        throw error;
    }
};

// Submit a help request (for victims)
const submitHelpRequest = async (formData) => {
    try {
        // Add user ID
        const userData = getUserData();
        if (!userData || userData.role !== 'victim') {
            throw new Error('User not logged in or not registered as a victim');
        }
        
        formData.append('user_id', userData.id);
        
        // Add location if available
        try {
            const location = await getUserLocation();
            formData.append('location_lat', location.lat);
            formData.append('location_lng', location.lng);
        } catch (locError) {
            console.warn('Location not available:', locError);
        }
        
        const response = await fetch('/api/help-request', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            return data;
        } else {
            throw new Error(data.message || 'Failed to submit help request');
        }
    } catch (error) {
        console.error('Error submitting help request:', error);
        throw error;
    }
};

// Submit volunteer skills (for volunteers)
const submitVolunteerSkills = async (formData) => {
    try {
        // Add user ID
        const userData = getUserData();
        if (!userData || userData.role !== 'volunteer') {
            throw new Error('User not logged in or not registered as a volunteer');
        }
        
        formData.append('user_id', userData.id);
        
        // Add current location
        try {
            const location = await getUserLocation();
            formData.append('location_lat', location.lat);
            formData.append('location_lng', location.lng);
        } catch (locError) {
            console.warn('Location not available:', locError);
        }
        
        const response = await fetch('/api/volunteer-skills', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            return data;
        } else {
            throw new Error(data.message || 'Failed to submit volunteer skills');
        }
    } catch (error) {
        console.error('Error submitting volunteer skills:', error);
        throw error;
    }
};

// Get matches for a user (victim or volunteer)
const getMatches = async () => {
    try {
        const userData = getUserData();
        if (!userData) {
            throw new Error('User not logged in');
        }
        
        const response = await fetch(`/api/matches?user_id=${userData.id}&role=${userData.role}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            return data.matches;
        } else {
            throw new Error(data.message || 'Failed to get matches');
        }
    } catch (error) {
        console.error('Error getting matches:', error);
        throw error;
    }
};

// Update match status
const updateMatchStatus = async (matchId, status) => {
    try {
        const formData = new FormData();
        formData.append('match_id', matchId);
        formData.append('status', status);
        
        const response = await fetch('/api/match/update', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            return data;
        } else {
            throw new Error(data.message || 'Failed to update match status');
        }
    } catch (error) {
        console.error('Error updating match status:', error);
        throw error;
    }
};

// Get system status
const getSystemStatus = async () => {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        
        if (data.status === 'success') {
            return data;
        } else {
            throw new Error(data.message || 'Failed to get system status');
        }
    } catch (error) {
        console.error('Error getting system status:', error);
        throw error;
    }
};

// Event handlers for various pages
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already logged in
    const userData = getUserData();
    
    if (userData) {
        // Update UI based on user role
        document.querySelectorAll('.user-name').forEach(el => {
            el.textContent = userData.name;
        });
        
        document.querySelectorAll('.user-role').forEach(el => {
            el.textContent = userData.role;
        });
        
        // Show/hide elements based on user role
        document.querySelectorAll('.victim-only').forEach(el => {
            el.style.display = userData.role === 'victim' ? 'block' : 'none';
        });
        
        document.querySelectorAll('.volunteer-only').forEach(el => {
            el.style.display = userData.role === 'volunteer' ? 'block' : 'none';
        });
        
        document.querySelectorAll('.logged-in').forEach(el => {
            el.style.display = 'block';
        });
        
        document.querySelectorAll('.logged-out').forEach(el => {
            el.style.display = 'none';
        });
    } else {
        // Show login/registration sections
        document.querySelectorAll('.logged-in').forEach(el => {
            el.style.display = 'none';
        });
        
        document.querySelectorAll('.logged-out').forEach(el => {
            el.style.display = 'block';
        });
    }
    
    // Registration form handler
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            try {
                // Disable submit button
                const submitButton = registerForm.querySelector('button[type="submit"]');
                submitButton.disabled = true;
                submitButton.textContent = 'Registering...';
                
                const formData = new FormData(registerForm);
                const result = await registerUser(formData);
                
                // Enable submit button
                submitButton.disabled = false;
                submitButton.textContent = 'Register';
                
                if (result.status === 'success') {
                    // Redirect based on role
                    const role = formData.get('role');
                    window.location.href = role === 'victim' ? '/victim' : '/volunteer';
                } else {
                    alert('Registration failed: ' + result.message);
                }
            } catch (error) {
                alert('Error: ' + error.message);
                const submitButton = registerForm.querySelector('button[type="submit"]');
                submitButton.disabled = false;
                submitButton.textContent = 'Register';
            }
        });
    }
    
    // Help request form handler
    const helpRequestForm = document.getElementById('help-request-form');
    if (helpRequestForm) {
        helpRequestForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            try {
                // Disable submit button
                const submitButton = helpRequestForm.querySelector('button[type="submit"]');
                submitButton.disabled = true;
                submitButton.textContent = 'Submitting...';
                
                const formData = new FormData(helpRequestForm);
                const result = await submitHelpRequest(formData);
                
                // Enable submit button
                submitButton.disabled = false;
                submitButton.textContent = 'Submit Request';
                
                if (result.status === 'success') {
                    // Show success message
                    alert('Help request submitted successfully!');
                    helpRequestForm.reset();
                    
                    // Update UI to show request status
                    const statusDiv = document.getElementById('request-status');
                    if (statusDiv) {
                        statusDiv.innerHTML = `
                            <div class="alert alert-success">
                                <h4>Request Submitted Successfully</h4>
                                <p>Urgency Level: <strong>${result.urgency_level}</strong></p>
                                <p>Damage Assessment: <strong>${result.damage_level || 'Not available'}</strong></p>
                                <p>Matches Found: <strong>${result.matches}</strong></p>
                                <p>Your request is being processed. Check the matches section for updates.</p>
                            </div>
                        `;
                    }
                } else {
                    alert('Failed to submit request: ' + result.message);
                }
            } catch (error) {
                alert('Error: ' + error.message);
                const submitButton = helpRequestForm.querySelector('button[type="submit"]');
                submitButton.disabled = false;
                submitButton.textContent = 'Submit Request';
            }
        });
    }
    
    // Volunteer skills form handler
    const volunteerSkillsForm = document.getElementById('volunteer-skills-form');
    if (volunteerSkillsForm) {
        volunteerSkillsForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            try {
                // Disable submit button
                const submitButton = volunteerSkillsForm.querySelector('button[type="submit"]');
                submitButton.disabled = true;
                submitButton.textContent = 'Submitting...';
                
                const formData = new FormData(volunteerSkillsForm);
                const result = await submitVolunteerSkills(formData);
                
                // Enable submit button
                submitButton.disabled = false;
                submitButton.textContent = 'Submit Skills';
                
                if (result.status === 'success') {
                    // Show success message
                    alert('Volunteer skills submitted successfully!');
                    
                    // Update UI to show matching requests
                    const statusDiv = document.getElementById('skills-status');
                    if (statusDiv) {
                        statusDiv.innerHTML = `
                            <div class="alert alert-success">
                                <h4>Skills Submitted Successfully</h4>
                                <p>Skills registered: <strong>${result.skills_count}</strong></p>
                                <p>Matching help requests: <strong>${result.matching_requests}</strong></p>
                                <p>Check the matches section for details.</p>
                            </div>
                        `;
                    }
                } else {
                    alert('Failed to submit skills: ' + result.message);
                }
            } catch (error) {
                alert('Error: ' + error.message);
                const submitButton = volunteerSkillsForm.querySelector('button[type="submit"]');
                submitButton.disabled = false;
                submitButton.textContent = 'Submit Skills';
            }
        });
    }
    
    // Add skill field button
    const addSkillButton = document.getElementById('add-skill-button');
    if (addSkillButton) {
        addSkillButton.addEventListener('click', () => {
            const skillFields = document.getElementById('skill-fields');
            const skillCount = skillFields.querySelectorAll('.skill-row').length;
            
            const newRow = document.createElement('div');
            newRow.className = 'skill-row mb-3';
            newRow.innerHTML = `
                <div class="row">
                    <div class="col-md-4">
                        <select class="form-select" name="skills[]" required>
                            <option value="">Select Skill</option>
                            <option value="medical">Medical</option>
                            <option value="driving">Driving</option>
                            <option value="cooking">Cooking</option>
                            <option value="rescue">Rescue</option>
                            <option value="logistics">Logistics</option>
                            <option value="construction">Construction</option>
                            <option value="communication">Communication</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div class="col-md-4">
                        <select class="form-select" name="resources[]">
                            <option value="">Select Resource (Optional)</option>
                            <option value="vehicle">Vehicle</option>
                            <option value="food">Food</option>
                            <option value="shelter">Shelter Space</option>
                            <option value="medical_supplies">Medical Supplies</option>
                            <option value="tools">Tools</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div class="col-md-3">
                        <input type="number" class="form-control" name="quantities[]" placeholder="Quantity" min="0">
                    </div>
                    <div class="col-md-1">
                        <button type="button" class="btn btn-danger remove-skill-button">×</button>
                    </div>
                </div>
            `;
            
            // Add event listener to remove button
            const removeButton = newRow.querySelector('.remove-skill-button');
            removeButton.addEventListener('click', () => {
                skillFields.removeChild(newRow);
            });
            
            skillFields.appendChild(newRow);
        });
    }
    
    // Logout button
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            clearUserData();
            window.location.href = '/';
        });
    }
    
    // Load matches for the user
    const loadMatches = async () => {
        const matchesContainer = document.getElementById('matches-container');
        if (!matchesContainer) return;
        
        try {
            const matches = await getMatches();
            
            if (matches.length === 0) {
                matchesContainer.innerHTML = '<div class="alert alert-info">No matches found yet.</div>';
                return;
            }
            
            // Display matches based on user role
            const userData = getUserData();
            if (!userData) return;
            
            let matchesHTML = '';
            
            if (userData.role === 'victim') {
                // Victim sees volunteers matched to their requests
                matchesHTML = '<div class="list-group">';
                matches.forEach(match => {
                    let statusBadge = '';
                    if (match.status === 'pending') {
                        statusBadge = '<span class="badge bg-warning text-dark">Pending</span>';
                    } else if (match.status === 'accepted') {
                        statusBadge = '<span class="badge bg-primary">Accepted</span>';
                    } else if (match.status === 'completed') {
                        statusBadge = '<span class="badge bg-success">Completed</span>';
                    } else if (match.status === 'cancelled') {
                        statusBadge = '<span class="badge bg-danger">Cancelled</span>';
                    }
                    
                    matchesHTML += `
                        <div class="list-group-item">
                            <div class="d-flex w-100 justify-content-between">
                                <h5 class="mb-1">${match.volunteer_name} (${match.help_type})</h5>
                                ${statusBadge}
                            </div>
                            <p class="mb-1">Contact: ${match.volunteer_contact}</p>
                            <small>Matched on: ${match.created_at}</small>
                        </div>
                    `;
                });
                matchesHTML += '</div>';
            } else {
                // Volunteer sees victims they've been matched with
                matchesHTML = '<div class="list-group">';
                matches.forEach(match => {
                    let statusBadge = '';
                    let actionButtons = '';
                    
                    if (match.status === 'pending') {
                        statusBadge = '<span class="badge bg-warning text-dark">Pending</span>';
                        actionButtons = `
                            <div class="mt-2">
                                <button class="btn btn-sm btn-primary accept-match-btn" data-match-id="${match.match_id}">Accept</button>
                                <button class="btn btn-sm btn-danger reject-match-btn" data-match-id="${match.match_id}">Decline</button>
                            </div>
                        `;
                    } else if (match.status === 'accepted') {
                        statusBadge = '<span class="badge bg-primary">Accepted</span>';
                        actionButtons = `
                            <div class="mt-2">
                                <button class="btn btn-sm btn-success complete-match-btn" data-match-id="${match.match_id}">Mark Complete</button>
                            </div>
                        `;
                    } else if (match.status === 'completed') {
                        statusBadge = '<span class="badge bg-success">Completed</span>';
                    } else if (match.status === 'cancelled') {
                        statusBadge = '<span class="badge bg-danger">Cancelled</span>';
                    }
                    
                    // Determine urgency class
                    let urgencyClass = 'bg-info';
                    if (match.urgency === 'high') {
                        urgencyClass = 'bg-danger';
                    } else if (match.urgency === 'medium') {
                        urgencyClass = 'bg-warning text-dark';
                    }
                    
                    matchesHTML += `
                        <div class="list-group-item">
                            <div class="d-flex w-100 justify-content-between">
                                <h5 class="mb-1">${match.victim_name} (${match.help_type})</h5>
                                ${statusBadge}
                            </div>
                            <p class="mb-1">
                                Contact: ${match.victim_contact} | 
                                People affected: ${match.people_affected} | 
                                Urgency: <span class="badge ${urgencyClass}">${match.urgency}</span>
                            </p>
                            <small>Matched on: ${match.created_at}</small>
                            ${actionButtons}
                        </div>
                    `;
                });
                matchesHTML += '</div>';
            }
            
            matchesContainer.innerHTML = matchesHTML;
            
            // Add event listeners to action buttons
            document.querySelectorAll('.accept-match-btn').forEach(button => {
                button.addEventListener('click', async () => {
                    const matchId = button.getAttribute('data-match-id');
                    try {
                        await updateMatchStatus(matchId, 'accepted');
                        alert('Match accepted successfully!');
                        loadMatches(); // Reload matches
                    } catch (error) {
                        alert('Error: ' + error.message);
                    }
                });
            });
            
            document.querySelectorAll('.reject-match-btn').forEach(button => {
                button.addEventListener('click', async () => {
                    const matchId = button.getAttribute('data-match-id');
                    try {
                        await updateMatchStatus(matchId, 'cancelled');
                        alert('Match declined.');
                        loadMatches(); // Reload matches
                    } catch (error) {
                        alert('Error: ' + error.message);
                    }
                });
            });
            
            document.querySelectorAll('.complete-match-btn').forEach(button => {
                button.addEventListener('click', async () => {
                    const matchId = button.getAttribute('data-match-id');
                    try {
                        await updateMatchStatus(matchId, 'completed');
                        alert('Match marked as complete!');
                        loadMatches(); // Reload matches
                    } catch (error) {
                        alert('Error: ' + error.message);
                    }
                });
            });
        } catch (error) {
            matchesContainer.innerHTML = `
                <div class="alert alert-danger">
                    Error loading matches: ${error.message}
                </div>
            `;
        }
    };
    
    // Load matches if container exists
    if (document.getElementById('matches-container')) {
        loadMatches();
    }
    
    // Load system status for dashboard
    const loadSystemStatus = async () => {
        const statusContainer = document.getElementById('system-status');
        if (!statusContainer) return;
        
        try {
            const status = await getSystemStatus();
            
            statusContainer.innerHTML = `
                <div class="card mb-4">
                    <div class="card-header">
                        <h5 class="mb-0">System Status</h5>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-6">
                                <h6>Users</h6>
                                <p>Victims: ${status.users.victims}</p>
                                <p>Volunteers: ${status.users.volunteers}</p>
                                
                                <h6>Requests</h6>
                                <p>Pending: ${status.requests.pending}</p>
                                <p>Matched: ${status.requests.matched}</p>
                                <p>Resolved: ${status.requests.resolved}</p>
                            </div>
                            <div class="col-md-6">
                                <h6>Help Types</h6>
                                <ul>
                                    ${Object.entries(status.requests.by_type).map(([type, count]) => 
                                        `<li>${type}: ${count}</li>`
                                    ).join('')}
                                </ul>
                                
                                <h6>AI Status</h6>
                                <p>Urgency Classifier: ${status.ai_status.urgency_classifier ? 'Online' : 'Offline'}</p>
                                <p>Damage Analyzer: ${status.ai_status.damage_analyzer ? 'Online' : 'Offline'}</p>
                                <p>Volunteer Matcher: ${status.ai_status.volunteer_matcher ? 'Online' : 'Offline'}</p>
                            </div>
                        </div>
                        <p class="text-muted mt-3">Last updated: ${status.timestamp}</p>
                    </div>
                </div>
            `;
        } catch (error) {
            statusContainer.innerHTML = `
                <div class="alert alert-danger">
                    Error loading system status: ${error.message}
                </div>
            `;
        }
    };
    
    // Load system status if container exists
    if (document.getElementById('system-status')) {
        loadSystemStatus();
        
        // Refresh every 30 seconds
        setInterval(loadSystemStatus, 30000);
    }
});
