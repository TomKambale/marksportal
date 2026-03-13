// myunits.js - My Units Page Handler

const API_BASE_URL = 'http://localhost:3000/api';

// State management
let currentUser = null;
let allUnits = [];
let filteredUnits = [];
let semesters = [];
let programmes = [];
let stages = [];
let currentView = 'grid';
let currentPage = 1;
let itemsPerPage = 12;
let filters = {
    semester: '',
    stage: '',
    programme: '',
    status: '',
    search: ''
};

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    console.log('My Units page initialized');
    
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
    await loadInitialData();
    
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

// Display user info in sidebar
function displayUserInfo() {
    if (currentUser) {
        const lecturerInfo = document.getElementById('lecturer-info');
        lecturerInfo.innerHTML = `
            <p class="lecturer-name">${currentUser.name || 'Lecturer'}</p>
            <p>${currentUser.email || ''}</p>
        `;
        document.getElementById('pf-number').textContent = currentUser.pfNumber || 'N/A';
    }
}

// Load initial data
async function loadInitialData() {
    try {
        showLoading(true);
        
        // Load semesters
        await loadSemesters();
        
        // Load programmes
        await loadProgrammes();
        
        // Load stages
        await loadStages();
        
        // Load all units
        await loadAllUnits();
        
    } catch (error) {
        console.error('Error loading initial data:', error);
        showError('Failed to load data. Please refresh the page.');
    } finally {
        showLoading(false);
    }
}

// Load semesters
async function loadSemesters() {
    try {
        const token = sessionStorage.getItem('ttu_token');
        const response = await fetch(`${API_BASE_URL}/academics/semesters`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load semesters');
        }
        
        semesters = await response.json();
        populateSemesterFilter();
        
    } catch (error) {
        console.error('Error loading semesters:', error);
    }
}

// Load programmes
async function loadProgrammes() {
    try {
        const token = sessionStorage.getItem('ttu_token');
        const response = await fetch(`${API_BASE_URL}/academics/programmes`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load programmes');
        }
        
        programmes = await response.json();
        populateProgrammeFilter();
        
    } catch (error) {
        console.error('Error loading programmes:', error);
    }
}

// Load stages
async function loadStages() {
    try {
        const token = sessionStorage.getItem('ttu_token');
        const response = await fetch(`${API_BASE_URL}/academics/stages?semesterId=${filters.semester || 'all'}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load stages');
        }
        
        stages = await response.json();
        populateStageFilter();
        
    } catch (error) {
        console.error('Error loading stages:', error);
    }
}

// Load all units
async function loadAllUnits() {
    try {
        const token = sessionStorage.getItem('ttu_token');
        const pfNumber = currentUser.pfNumber;
        
        // If we have a semester filter, use it
        const semesterParam = filters.semester ? `&semesterId=${filters.semester}` : '';
        
        const response = await fetch(
            `${API_BASE_URL}/lecturers/assignments?${semesterParam}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        
        if (!response.ok) {
            throw new Error('Failed to load units');
        }
        
        allUnits = await response.json();
        
        // Add submission status to each unit (would come from API in production)
        allUnits = allUnits.map(unit => ({
            ...unit,
            submissionStatus: Math.random() > 0.5 ? 'Submitted' : 'Pending',
            lastUpdated: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
        }));
        
        applyFilters();
        updateStats();
        
    } catch (error) {
        console.error('Error loading units:', error);
        showError('Failed to load your units. Please try again.');
    }
}

// Populate semester filter
function populateSemesterFilter() {
    const select = document.getElementById('semester-filter');
    select.innerHTML = '<option value="">All Semesters</option>';
    
    semesters.forEach(semester => {
        const option = document.createElement('option');
        option.value = semester.semesterId;
        option.textContent = semester.semesterName;
        select.appendChild(option);
    });
}

// Populate stage filter
function populateStageFilter() {
    const select = document.getElementById('stage-filter');
    select.innerHTML = '<option value="">All Stages</option>';
    select.disabled = stages.length === 0;
    
    stages.forEach(stage => {
        const option = document.createElement('option');
        option.value = stage.stageId;
        option.textContent = stage.stageCode;
        if (stage.status !== 'Active') {
            option.textContent += ' (Inactive)';
        }
        select.appendChild(option);
    });
}

// Populate programme filter
function populateProgrammeFilter() {
    const select = document.getElementById('programme-filter');
    select.innerHTML = '<option value="">All Programmes</option>';
    
    programmes.forEach(programme => {
        const option = document.createElement('option');
        option.value = programme.programmeId;
        option.textContent = programme.programmeName;
        select.appendChild(option);
    });
}

// Apply filters
function applyFilters() {
    filteredUnits = allUnits.filter(unit => {
        // Semester filter
        if (filters.semester && unit.semesterId !== filters.semester) {
            return false;
        }
        
        // Stage filter
        if (filters.stage && unit.stage !== filters.stage) {
            return false;
        }
        
        // Programme filter
        if (filters.programme && unit.programmeId !== filters.programme) {
            return false;
        }
        
        // Status filter
        if (filters.status && unit.submissionStatus !== filters.status) {
            return false;
        }
        
        // Search filter
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            return unit.unitCode.toLowerCase().includes(searchLower) ||
                   unit.unitName.toLowerCase().includes(searchLower) ||
                   unit.programmeName.toLowerCase().includes(searchLower);
        }
        
        return true;
    });
    
    // Update active filters count
    updateActiveFiltersCount();
    
    // Update view based on results
    if (filteredUnits.length === 0) {
        document.getElementById('empty-state').style.display = 'block';
        document.getElementById('units-grid').style.display = 'none';
        document.getElementById('units-list').style.display = 'none';
        document.getElementById('pagination').style.display = 'none';
    } else {
        document.getElementById('empty-state').style.display = 'none';
        if (currentView === 'grid') {
            displayGridView();
        } else {
            displayListView();
        }
    }
}

// Update active filters count
function updateActiveFiltersCount() {
    const activeCount = Object.values(filters).filter(v => v !== '').length;
    document.getElementById('active-filters-count').textContent = 
        activeCount > 0 ? `${activeCount} filters active` : 'No filters active';
}

// Display grid view
function displayGridView() {
    const grid = document.getElementById('units-grid');
    grid.style.display = 'grid';
    document.getElementById('units-list').style.display = 'none';
    
    // Calculate pagination
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedUnits = filteredUnits.slice(start, end);
    
    let html = '';
    paginatedUnits.forEach(unit => {
        const statusClass = unit.submissionStatus === 'Submitted' ? 'success' : 'warning';
        const lastUpdated = new Date(unit.lastUpdated).toLocaleDateString();
        
        html += `
            <div class="unit-card" data-unit-code="${unit.unitCode}" data-semester="${unit.semesterId}" data-stage="${unit.stage}" data-programme="${unit.programmeId}">
                <div class="unit-card-header">
                    <div class="unit-code-badge">${unit.unitCode}</div>
                    <span class="badge badge-${statusClass}">${unit.submissionStatus}</span>
                </div>
                <div class="unit-card-body">
                    <h3 class="unit-name">${unit.unitName}</h3>
                    <p class="programme-name">${unit.programmeName}</p>
                    <div class="unit-meta">
                        <div class="meta-item">
                            <span class="meta-icon">👥</span>
                            <span class="meta-text">${unit.studentCount} Students</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-icon">📊</span>
                            <span class="meta-text">Stage ${unit.stage}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-icon">🕒</span>
                            <span class="meta-text">Updated: ${lastUpdated}</span>
                        </div>
                    </div>
                </div>
                <div class="unit-card-footer">
                    <button class="btn btn-secondary btn-sm view-students-btn">
                        <span class="btn-icon">👥</span> View Students
                    </button>
                    <button class="btn btn-primary btn-sm upload-marks-btn">
                        <span class="btn-icon">📤</span> Upload Marks
                    </button>
                    <button class="btn-icon-only more-options-btn" title="More options">⋮</button>
                </div>
            </div>
        `;
    });
    
    grid.innerHTML = html;
    
    // Add event listeners to cards
    document.querySelectorAll('.view-students-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.unit-card');
            navigateToStudents(card);
        });
    });
    
    document.querySelectorAll('.upload-marks-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.unit-card');
            navigateToUpload(card);
        });
    });
    
    document.querySelectorAll('.more-options-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.unit-card');
            showQuickActions(card);
        });
    });
    
    updatePagination();
}

// Display list view
function displayListView() {
    const list = document.getElementById('units-list');
    list.style.display = 'block';
    document.getElementById('units-grid').style.display = 'none';
    
    // Calculate pagination
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedUnits = filteredUnits.slice(start, end);
    
    let html = '<table class="data-table"><thead><tr><th>Unit Code</th><th>Unit Name</th><th>Programme</th><th>Stage</th><th>Students</th><th>Status</th><th>Last Updated</th><th>Actions</th></tr></thead><tbody>';
    
    paginatedUnits.forEach(unit => {
        const statusClass = unit.submissionStatus === 'Submitted' ? 'badge-submitted' : 'badge-pending';
        const lastUpdated = new Date(unit.lastUpdated).toLocaleDateString();
        
        html += `
            <tr data-unit-code="${unit.unitCode}" data-semester="${unit.semesterId}" data-stage="${unit.stage}" data-programme="${unit.programmeId}">
                <td><strong>${unit.unitCode}</strong></td>
                <td>${unit.unitName}</td>
                <td>${unit.programmeName}</td>
                <td>${unit.stage}</td>
                <td>${unit.studentCount}</td>
                <td><span class="badge ${statusClass}">${unit.submissionStatus}</span></td>
                <td>${lastUpdated}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-secondary btn-sm view-students-btn" title="View Students">👥</button>
                        <button class="btn btn-primary btn-sm upload-marks-btn" title="Upload Marks">📤</button>
                        <button class="btn-icon-only more-options-btn" title="More options">⋮</button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    list.innerHTML = html;
    
    // Add event listeners
    document.querySelectorAll('#units-list .view-students-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            navigateToStudents(row);
        });
    });
    
    document.querySelectorAll('#units-list .upload-marks-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            navigateToUpload(row);
        });
    });
    
    document.querySelectorAll('#units-list .more-options-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            showQuickActions(row);
        });
    });
    
    updatePagination();
}

// Navigate to students page
function navigateToStudents(element) {
    const unitCode = element.dataset.unitCode;
    const semesterId = element.dataset.semester;
    const stageId = element.dataset.stage;
    const programmeId = element.dataset.programme;
    
    window.location.href = `students.html?unitCode=${unitCode}&semesterId=${semesterId}&stageId=${stageId}&programmeId=${programmeId}`;
}

// Navigate to upload page
function navigateToUpload(element) {
    const unitCode = element.dataset.unitCode;
    const semesterId = element.dataset.semester;
    const stageId = element.dataset.stage;
    const programmeId = element.dataset.programme;
    
    window.location.href = `upload.html?unitCode=${unitCode}&semesterId=${semesterId}&stageId=${stageId}&programmeId=${programmeId}`;
}

// Show quick actions modal
function showQuickActions(element) {
    const modal = document.getElementById('quick-actions-modal');
    const body = document.getElementById('quick-actions-body');
    
    const unitCode = element.dataset.unitCode;
    const unit = allUnits.find(u => u.unitCode === unitCode);
    
    if (unit) {
        body.innerHTML = `
            <div class="quick-actions">
                <h4>${unit.unitCode} - ${unit.unitName}</h4>
                <p class="text-muted">${unit.programmeName}</p>
                
                <div class="action-list">
                    <button class="action-item" onclick="window.location.href='students.html?unitCode=${unit.unitCode}&semesterId=${unit.semesterId}&stageId=${unit.stage}&programmeId=${unit.programmeId}'">
                        <span class="action-icon">👥</span>
                        <div class="action-content">
                            <strong>View Students</strong>
                            <small>See all students enrolled in this unit</small>
                        </div>
                    </button>
                    
                    <button class="action-item" onclick="window.location.href='upload.html?unitCode=${unit.unitCode}&semesterId=${unit.semesterId}&stageId=${unit.stage}&programmeId=${unit.programmeId}'">
                        <span class="action-icon">📤</span>
                        <div class="action-content">
                            <strong>Upload Marks</strong>
                            <small>Bulk upload marks for this unit</small>
                        </div>
                    </button>
                    
                    <button class="action-item" onclick="downloadTemplate('${unit.unitCode}')">
                        <span class="action-icon">📥</span>
                        <div class="action-content">
                            <strong>Download Template</strong>
                            <small>Get CSV template for marks upload</small>
                        </div>
                    </button>
                    
                    <button class="action-item" onclick="viewUnitStats('${unit.unitCode}')">
                        <span class="action-icon">📊</span>
                        <div class="action-content">
                            <strong>View Statistics</strong>
                            <small>See marks distribution and analytics</small>
                        </div>
                    </button>
                </div>
            </div>
        `;
    }
    
    modal.style.display = 'flex';
    
    // Close modal when clicking close button or outside
    const closeBtn = modal.querySelector('.close-btn');
    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
}

// Download template
async function downloadTemplate(unitCode) {
    try {
        const token = sessionStorage.getItem('ttu_token');
        const response = await fetch(`${API_BASE_URL}/marks/template?unitCode=${unitCode}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to download template');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `marks_template_${unitCode}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        document.getElementById('quick-actions-modal').style.display = 'none';
        
    } catch (error) {
        console.error('Error downloading template:', error);
        showError('Failed to download template');
    }
}

// View unit statistics
function viewUnitStats(unitCode) {
    // This would open a statistics modal or page
    alert(`Statistics for ${unitCode} - Coming soon!`);
    document.getElementById('quick-actions-modal').style.display = 'none';
}

// Update statistics
function updateStats() {
    const totalUnits = allUnits.length;
    const totalStudents = allUnits.reduce((sum, unit) => sum + (unit.studentCount || 0), 0);
    const submittedUnits = allUnits.filter(u => u.submissionStatus === 'Submitted').length;
    const pendingUnits = allUnits.filter(u => u.submissionStatus === 'Pending').length;
    
    document.getElementById('total-units').textContent = totalUnits;
    document.getElementById('total-students').textContent = totalStudents;
    document.getElementById('submitted-units').textContent = submittedUnits;
    document.getElementById('pending-units').textContent = pendingUnits;
}

// Update pagination
function updatePagination() {
    const totalPages = Math.ceil(filteredUnits.length / itemsPerPage);
    const pagination = document.getElementById('pagination');
    
    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }
    
    pagination.style.display = 'flex';
    
    let html = '<div class="pagination">';
    
    // Previous button
    html += `<button class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">← Previous</button>`;
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += `<span class="pagination-ellipsis">...</span>`;
        }
    }
    
    // Next button
    html += `<button class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">Next →</button>`;
    
    html += '</div>';
    pagination.innerHTML = html;
}

// Change page
window.changePage = function(page) {
    currentPage = page;
    if (currentView === 'grid') {
        displayGridView();
    } else {
        displayListView();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Setup event listeners
function setupEventListeners() {
    // Refresh button
    document.getElementById('refresh-btn').addEventListener('click', async () => {
        await loadAllUnits();
    });
    
    // Semester filter
    document.getElementById('semester-filter').addEventListener('change', (e) => {
        filters.semester = e.target.value;
        document.getElementById('stage-filter').disabled = !filters.semester;
        if (filters.semester) {
            loadStages();
        }
    });
    
    // Stage filter
    document.getElementById('stage-filter').addEventListener('change', (e) => {
        filters.stage = e.target.value;
    });
    
    // Programme filter
    document.getElementById('programme-filter').addEventListener('change', (e) => {
        filters.programme = e.target.value;
    });
    
    // Status filter
    document.getElementById('status-filter').addEventListener('change', (e) => {
        filters.status = e.target.value;
    });
    
    // Search filter
    let searchTimeout;
    document.getElementById('search-filter').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            filters.search = e.target.value;
            applyFilters();
        }, 500);
    });
    
    // Apply filters button
    document.getElementById('apply-filters-btn').addEventListener('click', () => {
        currentPage = 1;
        applyFilters();
    });
    
    // Clear filters button
    document.getElementById('clear-filters-btn').addEventListener('click', () => {
        filters = {
            semester: '',
            stage: '',
            programme: '',
            status: '',
            search: ''
        };
        
        // Reset form inputs
        document.getElementById('semester-filter').value = '';
        document.getElementById('stage-filter').value = '';
        document.getElementById('stage-filter').disabled = true;
        document.getElementById('programme-filter').value = '';
        document.getElementById('status-filter').value = '';
        document.getElementById('search-filter').value = '';
        
        currentPage = 1;
        applyFilters();
    });
    
    document.getElementById('clear-filters-empty-btn').addEventListener('click', () => {
        document.getElementById('clear-filters-btn').click();
    });
    
    // View toggle
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentView = btn.dataset.view;
            if (currentView === 'grid') {
                displayGridView();
            } else {
                displayListView();
            }
        });
    });
    
    // Upload Marks link in sidebar
    document.getElementById('upload-marks-link').addEventListener('click', (e) => {
        e.preventDefault();
        // If there are units, take the first one
        if (allUnits.length > 0) {
            const firstUnit = allUnits[0];
            window.location.href = `upload.html?unitCode=${firstUnit.unitCode}&semesterId=${firstUnit.semesterId}&stageId=${firstUnit.stage}&programmeId=${firstUnit.programmeId}`;
        } else {
            alert('No units available. Please select a unit from My Units first.');
        }
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
    document.getElementById('loading-indicator').style.display = show ? 'flex' : 'none';
    if (show) {
        document.getElementById('units-grid').style.display = 'none';
        document.getElementById('units-list').style.display = 'none';
        document.getElementById('empty-state').style.display = 'none';
    }
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.innerHTML = `
        <div class="alert-message error">
            <span class="alert-icon">❌</span>
            <div class="alert-content">${message}</div>
        </div>
    `;
    errorDiv.style.display = 'block';
    
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function showSuccess(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.innerHTML = `
        <div class="alert-message success">
            <span class="alert-icon">✅</span>
            <div class="alert-content">${message}</div>
        </div>
    `;
    errorDiv.style.display = 'block';
    
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 3000);
}