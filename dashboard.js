// dashboard.js - Lecturer Dashboard Handler

const API_BASE_URL = 'http://localhost:3000/api';

// State management
let currentUser = null;
let semesters = [];
let stages = [];
let assignments = [];

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const token = sessionStorage.getItem('ttu_token');
    if (!token) {
        window.location.href = '/index.html';
        return;
    }
    
    // Decode and display user info
    currentUser = parseJwt(token);
    displayUserInfo();
    
    // Load initial data
    await loadSemesters();
    
    // Setup event listeners
    setupEventListeners();
});

// Helper function to parse JWT
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error('Error parsing JWT:', e);
        return null;
    }
}

// Display user information in sidebar
function displayUserInfo() {
    if (currentUser) {
        document.getElementById('lecturer-name').textContent = currentUser.name || 'Lecturer';
        document.getElementById('pf-number').textContent = currentUser.pfNumber || 'N/A';
        
        const lecturerInfo = document.getElementById('lecturer-info');
        lecturerInfo.innerHTML = `
            <p class="lecturer-name">${currentUser.name || 'Lecturer'}</p>
            <p>${currentUser.email || ''}</p>
        `;
    }
}

// Load active semesters
async function loadSemesters() {
    try {
        showLoading(true);
        
        const token = sessionStorage.getItem('ttu_token');
        const response = await fetch(`${API_BASE_URL}/academics/semesters`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status === 401) {
            // Unauthorized - redirect to login
            sessionStorage.removeItem('ttu_token');
            window.location.href = '/index.html';
            return;
        }
        
        if (!response.ok) {
            throw new Error('Failed to load semesters');
        }
        
        semesters = await response.json();
        populateSemesterDropdown();
        
    } catch (error) {
        console.error('Error loading semesters:', error);
        showError('Failed to load semesters. Please refresh the page.');
    } finally {
        showLoading(false);
    }
}

// Populate semester dropdown
function populateSemesterDropdown() {
    const select = document.getElementById('semester-select');
    select.innerHTML = '<option value="">Select Semester</option>';
    
    semesters.forEach(semester => {
        const option = document.createElement('option');
        option.value = semester.semesterId;
        option.textContent = semester.semesterName;
        select.appendChild(option);
    });
}

// Load stages for selected semester
async function loadStages(semesterId) {
    try {
        showLoading(true);
        
        const token = sessionStorage.getItem('ttu_token');
        const response = await fetch(`${API_BASE_URL}/academics/stages?semesterId=${semesterId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load stages');
        }
        
        stages = await response.json();
        populateStageDropdown();
        
    } catch (error) {
        console.error('Error loading stages:', error);
        showError('Failed to load stages.');
    } finally {
        showLoading(false);
    }
}

// Populate stage dropdown
function populateStageDropdown() {
    const select = document.getElementById('stage-select');
    select.innerHTML = '<option value="">Select Stage</option>';
    select.disabled = false;
    
    stages.forEach(stage => {
        const option = document.createElement('option');
        option.value = stage.stageId;
        option.textContent = stage.stageCode;
        
        if (stage.status !== 'Active') {
            option.textContent += ' (Inactive)';
            option.style.color = '#888';
            option.disabled = true;
        }
        
        select.appendChild(option);
    });
}

// Load lecturer assignments
async function loadAssignments(semesterId, stageId) {
    try {
        showLoading(true);
        
        const token = sessionStorage.getItem('ttu_token');
        const response = await fetch(
            `${API_BASE_URL}/lecturers/assignments?semesterId=${semesterId}&stageId=${stageId}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        
        if (!response.ok) {
            throw new Error('Failed to load assignments');
        }
        
        assignments = await response.json();
        displayAssignments();
        
    } catch (error) {
        console.error('Error loading assignments:', error);
        showError('Failed to load your unit assignments.');
    } finally {
        showLoading(false);
    }
}

// Display assignments as cards
function displayAssignments() {
    const container = document.getElementById('assignments-container');
    
    if (assignments.length === 0) {
        container.innerHTML = '<p class="text-center">No units assigned for the selected semester and stage.</p>';
        return;
    }
    
    // Group by programme
    const groupedByProgramme = assignments.reduce((groups, assignment) => {
        const key = assignment.programmeId;
        if (!groups[key]) {
            groups[key] = {
                programmeName: assignment.programmeName,
                units: []
            };
        }
        groups[key].units.push(assignment);
        return groups;
    }, {});
    
    let html = '';
    
    for (const [programmeId, programme] of Object.entries(groupedByProgramme)) {
        programme.units.forEach(unit => {
            html += `
                <div class="assignment-card" onclick="navigateToUnit('${unit.unitCode}', '${unit.semesterId}', '${unit.stage}', '${programmeId}')">
                    <div class="card-header">
                        <h3>${unit.unitCode}</h3>
                        <p class="programme-name">${unit.programmeName}</p>
                    </div>
                    <div class="card-body">
                        <p><span class="nav-icon">📖</span> ${unit.unitName}</p>
                        <p><span class="nav-icon">👥</span> Students: ${unit.studentCount}</p>
                        <p><span class="nav-icon">📊</span> Stage: ${unit.stage}</p>
                    </div>
                    <div class="card-footer">
                        <button class="btn btn-secondary">View Students</button>
                    </div>
                </div>
            `;
        });
    }
    
    container.innerHTML = html;
}

// Navigate to students page
window.navigateToUnit = function(unitCode, semesterId, stageId, programmeId) {
    window.location.href = `students.html?unitCode=${unitCode}&semesterId=${semesterId}&stageId=${stageId}&programmeId=${programmeId}`;
};

// Setup event listeners
function setupEventListeners() {
    // Semester selection
    document.getElementById('semester-select').addEventListener('change', async (e) => {
        const semesterId = e.target.value;
        if (semesterId) {
            await loadStages(semesterId);
        } else {
            document.getElementById('stage-select').disabled = true;
            document.getElementById('assignments-container').innerHTML = '';
        }
    });
    
    // Stage selection
    document.getElementById('stage-select').addEventListener('change', async (e) => {
        const stageId = e.target.value;
        const semesterId = document.getElementById('semester-select').value;
        
        if (stageId && semesterId) {
            await loadAssignments(semesterId, stageId);
        }
    });
    
    // Refresh button
    document.getElementById('refresh-btn').addEventListener('click', async () => {
        await loadSemesters();
    });
    
    // My Units link
    document.getElementById('my-units-link').addEventListener('click', (e) => {
        e.preventDefault();
        // Scroll to assignments or show all units
        document.querySelector('.filters-section').scrollIntoView({ behavior: 'smooth' });
    });
    
    // Upload Marks link
    document.getElementById('upload-marks-link').addEventListener('click', (e) => {
        e.preventDefault();
        alert('Please select a unit from the dashboard first.');
    });
    
    // Logout
    document.getElementById('logout-link').addEventListener('click', (e) => {
        e.preventDefault();
        sessionStorage.removeItem('ttu_token');
        window.location.href = '/index.html';
    });
}

// UI Helpers
function showLoading(show) {
    document.getElementById('loading-indicator').style.display = show ? 'block' : 'none';
    document.getElementById('assignments-container').style.display = show ? 'none' : 'grid';
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}