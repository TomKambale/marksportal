// students.js - Student Marks View and Management

const API_BASE_URL = 'http://localhost:3000/api';

// State management
let currentUser = null;
let unitContext = null;
let students = [];
let unitContributions = { catMax: 30, examMax: 70 }; // Default, will be fetched from API
let editedRows = new Set();

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const token = sessionStorage.getItem('ttu_token');
    if (!token) {
        window.location.href = '/index.html';
        return;
    }
    
    // Parse URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    unitContext = {
        unitCode: urlParams.get('unitCode'),
        semesterId: urlParams.get('semesterId'),
        stageId: urlParams.get('stageId'),
        programmeId: urlParams.get('programmeId')
    };
    
    // Validate required parameters
    if (!unitContext.unitCode || !unitContext.semesterId || !unitContext.stageId || !unitContext.programmeId) {
        showError('Invalid unit selection. Please return to dashboard.');
        return;
    }
    
    // Decode and display user info
    currentUser = parseJwt(token);
    displayUserInfo();
    
    // Load unit contributions and student data
    await loadUnitContributions();
    await loadStudents();
    
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

// Load unit contribution percentages
async function loadUnitContributions() {
    try {
        const token = sessionStorage.getItem('ttu_token');
        // This would be a real API call in production
        // For now, simulate based on unit code
        if (unitContext.unitCode.startsWith('SBE')) {
            unitContributions = { catMax: 40, examMax: 60 };
        } else {
            unitContributions = { catMax: 30, examMax: 70 };
        }
        
        // Update UI with max values
        document.getElementById('cat-max').textContent = unitContributions.catMax;
        document.getElementById('exam-max').textContent = unitContributions.examMax;
        
    } catch (error) {
        console.error('Error loading unit contributions:', error);
    }
}

// Load students for the unit
async function loadStudents() {
    try {
        showLoading(true);
        
        const token = sessionStorage.getItem('ttu_token');
        const response = await fetch(
            `${API_BASE_URL}/students?unitCode=${unitContext.unitCode}&semesterId=${unitContext.semesterId}&stageId=${unitContext.stageId}&programmeId=${unitContext.programmeId}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        
        if (response.status === 401) {
            sessionStorage.removeItem('ttu_token');
            window.location.href = '/index.html';
            return;
        }
        
        if (!response.ok) {
            throw new Error('Failed to load students');
        }
        
        students = await response.json();
        displayContextBanner();
        displayStudents();
        updateMarksSummary();
        
    } catch (error) {
        console.error('Error loading students:', error);
        showError('Failed to load student data.');
    } finally {
        showLoading(false);
    }
}

// Display unit context banner
function displayContextBanner() {
    const banner = document.getElementById('context-banner');
    banner.innerHTML = `
        <div class="context-info">
            <div class="context-item">
                <strong>Unit:</strong> ${unitContext.unitCode}
            </div>
            <div class="context-item">
                <strong>Semester:</strong> ${unitContext.semesterId}
            </div>
            <div class="context-item">
                <strong>Stage:</strong> ${unitContext.stageId}
            </div>
            <div class="context-item">
                <strong>Programme:</strong> ${unitContext.programmeId}
            </div>
        </div>
    `;
}

// Display students table
function displayStudents() {
    const tbody = document.getElementById('students-table-body');
    
    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No students found for this unit.</td></tr>';
        return;
    }
    
    let html = '';
    students.forEach(student => {
        const isSubmitted = student.submissionStatus === 'Submitted';
        const rowClass = isSubmitted ? 'submitted-row' : '';
        
        html += `
            <tr class="${rowClass}" data-regno="${student.regNo}">
                <td>${student.regNo}</td>
                <td>${student.name}</td>
                <td>
                    <input type="number" 
                           class="form-control cat-input" 
                           value="${student.catMarks || ''}" 
                           min="0" 
                           max="${unitContributions.catMax}"
                           step="0.5"
                           ${isSubmitted ? 'disabled' : ''}
                           data-regno="${student.regNo}">
                </td>
                <td>
                    <input type="number" 
                           class="form-control exam-input" 
                           value="${student.examMarks || ''}" 
                           min="0" 
                           max="${unitContributions.examMax}"
                           step="0.5"
                           ${isSubmitted ? 'disabled' : ''}
                           data-regno="${student.regNo}">
                </td>
                <td class="final-marks" data-regno="${student.regNo}">${student.finalMarks || ''}</td>
                <td>
                    <span class="badge ${isSubmitted ? 'badge-submitted' : 'badge-pending'}">
                        ${student.submissionStatus || 'Pending'}
                    </span>
                </td>
                <td>
                    ${!isSubmitted ? `
                        <button class="btn btn-secondary btn-sm save-row" data-regno="${student.regNo}">💾 Save</button>
                    ` : '—'}
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    
    // Add event listeners to inputs
    document.querySelectorAll('.cat-input, .exam-input').forEach(input => {
        input.addEventListener('input', handleMarksInput);
        input.addEventListener('change', handleMarksChange);
    });
    
    document.querySelectorAll('.save-row').forEach(button => {
        button.addEventListener('click', handleSaveRow);
    });
    
    // Update submit button state
    updateSubmitButton();
}

// Handle marks input (live final marks calculation)
function handleMarksInput(e) {
    const regNo = e.target.dataset.regno;
    const row = document.querySelector(`tr[data-regno="${regNo}"]`);
    const catInput = row.querySelector('.cat-input');
    const examInput = row.querySelector('.exam-input');
    const finalCell = row.querySelector('.final-marks');
    
    const cat = parseFloat(catInput.value) || 0;
    const exam = parseFloat(examInput.value) || 0;
    const final = cat + exam;
    
    finalCell.textContent = final.toFixed(1);
    
    // Mark as edited
    editedRows.add(regNo);
    updateSubmitButton();
}

// Handle marks change (validation)
function handleMarksChange(e) {
    const input = e.target;
    const value = parseFloat(input.value) || 0;
    const max = parseFloat(input.max);
    
    if (value > max) {
        input.value = max;
        alert(`Marks cannot exceed ${max}`);
    }
    
    if (value < 0) {
        input.value = 0;
    }
}

// Handle save row
async function handleSaveRow(e) {
    const regNo = e.target.dataset.regno;
    const row = document.querySelector(`tr[data-regno="${regNo}"]`);
    const cat = parseFloat(row.querySelector('.cat-input').value) || 0;
    const exam = parseFloat(row.querySelector('.exam-input').value) || 0;
    
    try {
        const token = sessionStorage.getItem('ttu_token');
        const response = await fetch(`${API_BASE_URL}/marks/update`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                regNo,
                unitCode: unitContext.unitCode,
                cat,
                exam
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to save marks');
        }
        
        const updatedStudent = await response.json();
        
        // Update local data
        const studentIndex = students.findIndex(s => s.regNo === regNo);
        if (studentIndex !== -1) {
            students[studentIndex] = updatedStudent;
        }
        
        // Remove from edited set
        editedRows.delete(regNo);
        
        // Show success message
        showSuccess('Marks saved successfully');
        updateSubmitButton();
        
    } catch (error) {
        console.error('Error saving marks:', error);
        showError('Failed to save marks. Please try again.');
    }
}

// Update marks summary
function updateMarksSummary() {
    const totalStudents = students.length;
    const submittedCount = students.filter(s => s.submissionStatus === 'Submitted').length;
    const pendingCount = totalStudents - submittedCount;
    
    document.getElementById('marks-summary').innerHTML = `
        <div class="summary-item">
            <span class="summary-label">Total Students:</span>
            <span class="summary-value">${totalStudents}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Submitted:</span>
            <span class="summary-value" style="color: var(--success-color);">${submittedCount}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Pending:</span>
            <span class="summary-value" style="color: var(--warning-color);">${pendingCount}</span>
        </div>
    `;
}

// Update submit button state
function updateSubmitButton() {
    const submitBtn = document.getElementById('submit-marks-btn');
    const hasEdits = editedRows.size > 0;
    const hasPending = students.some(s => s.submissionStatus !== 'Submitted');
    
    submitBtn.disabled = !(hasEdits && hasPending);
}

// Submit marks to ERP
async function submitMarks() {
    if (!confirm('Are you sure you want to submit these marks to ERP? This action cannot be undone.')) {
        return;
    }
    
    try {
        showLoading(true);
        
        const token = sessionStorage.getItem('ttu_token');
        const marksToSubmit = students
            .filter(s => editedRows.has(s.regNo))
            .map(s => ({
                regNo: s.regNo,
                cat: s.catMarks,
                exam: s.examMarks
            }));
        
        const response = await fetch(`${API_BASE_URL}/marks/submit`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                semester: unitContext.semesterId,
                stage: unitContext.stageId,
                programme: unitContext.programmeId,
                unitCode: unitContext.unitCode,
                lecturerPF: currentUser.pfNumber,
                marks: marksToSubmit
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to submit marks');
        }
        
        const result = await response.json();
        
        // Reload students to get updated status
        await loadStudents();
        
        showSuccess(`Marks submitted successfully! ${result.totalSubmitted} records processed.`);
        
    } catch (error) {
        console.error('Error submitting marks:', error);
        showError('Failed to submit marks. Please try again.');
    } finally {
        showLoading(false);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Submit marks button
    document.getElementById('submit-marks-btn').addEventListener('click', submitMarks);
    
    // Upload bulk button
    document.getElementById('upload-bulk-btn').addEventListener('click', () => {
        const params = new URLSearchParams(unitContext);
        window.location.href = `upload.html?${params.toString()}`;
    });
    
    // My Units link
    document.getElementById('my-units-link').addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = '/dashboard.html';
    });
    
    // Upload Marks link
    document.getElementById('upload-marks-link').addEventListener('click', (e) => {
        e.preventDefault();
        const params = new URLSearchParams(unitContext);
        window.location.href = `upload.html?${params.toString()}`;
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
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function showSuccess(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.color = 'var(--success-color)';
    errorDiv.style.backgroundColor = '#e8f2e8';
    errorDiv.style.borderColor = 'var(--success-color)';
    errorDiv.style.display = 'block';
    
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 3000);
}