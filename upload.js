// upload.js - Bulk Marks Upload Handler

const API_BASE_URL = 'http://localhost:3000/api';

// State management
let currentUser = null;
let unitContext = null;
let parsedData = null;
let validatedRows = [];
let uploadSession = null;

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Upload page initialized');
    
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
    
    console.log('Unit context:', unitContext);
    
    // Validate required parameters
    if (!unitContext.unitCode) {
        showError('No unit selected. Please return to dashboard.');
        return;
    }
    
    // Decode and display user info
    currentUser = parseJwt(token);
    displayUserInfo();
    
    // Display context banner
    displayContextBanner();
    
    // Check upload status
    await checkUploadStatus();
    
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

// Display unit context banner
function displayContextBanner() {
    const banner = document.getElementById('context-banner');
    banner.innerHTML = `
        <div class="context-info">
            <div class="context-item">
                <strong>Unit:</strong> <span>${unitContext.unitCode || 'N/A'}</span>
            </div>
            <div class="context-item">
                <strong>Semester:</strong> <span>${unitContext.semesterId || 'N/A'}</span>
            </div>
            <div class="context-item">
                <strong>Stage:</strong> <span>${unitContext.stageId || 'N/A'}</span>
            </div>
            <div class="context-item">
                <strong>Programme:</strong> <span>${unitContext.programmeId || 'N/A'}</span>
            </div>
        </div>
    `;
}

// Check upload status
async function checkUploadStatus() {
    try {
        const token = sessionStorage.getItem('ttu_token');
        const response = await fetch(
            `${API_BASE_URL}/students?unitCode=${unitContext.unitCode}&semesterId=${unitContext.semesterId}&stageId=${unitContext.stageId}&programmeId=${unitContext.programmeId}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        
        if (!response.ok) {
            throw new Error('Failed to check upload status');
        }
        
        const students = await response.json();
        
        // Check if any marks are already submitted
        const hasSubmitted = students.some(s => s.submissionStatus === 'Submitted');
        const hasPending = students.some(s => s.submissionStatus === 'Pending' && (s.catMarks || s.examMarks));
        
        const statusDiv = document.getElementById('upload-status-message');
        
        if (hasSubmitted) {
            statusDiv.innerHTML = `
                <div class="alert-message warning">
                    <span class="alert-icon">⚠️</span>
                    <div class="alert-content">
                        <strong>Marks Locked</strong>
                        <p>Marks have already been submitted for this unit and are locked. You cannot upload additional marks.</p>
                    </div>
                </div>
            `;
            statusDiv.style.display = 'block';
            document.getElementById('upload-form-container').style.display = 'none';
        } else if (hasPending) {
            statusDiv.innerHTML = `
                <div class="alert-message info">
                    <span class="alert-icon">ℹ️</span>
                    <div class="alert-content">
                        <strong>Marks Already Uploaded</strong>
                        <p>Marks already uploaded. You may edit individual entries on the students page before final submission.</p>
                    </div>
                </div>
            `;
            statusDiv.style.display = 'block';
        }
        
    } catch (error) {
        console.error('Error checking upload status:', error);
    }
}

// Download template
async function downloadTemplate() {
    try {
        showLoading(true);
        
        const token = sessionStorage.getItem('ttu_token');
        const response = await fetch(`${API_BASE_URL}/marks/template?unitCode=${unitContext.unitCode}`, {
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
        a.download = `marks_template_${unitContext.unitCode}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showSuccess('Template downloaded successfully');
        
    } catch (error) {
        console.error('Error downloading template:', error);
        showError('Failed to download template. Please try again.');
    } finally {
        showLoading(false);
    }
}

// Handle file selection
function handleFileSelect(event) {
    const files = event.target.files;
    if (files && files.length > 0) {
        handleFileUpload(files[0]);
    }
}

// Handle file drop
function handleFileDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const uploadArea = document.getElementById('upload-area');
    uploadArea.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
        handleFileUpload(files[0]);
    }
}

// Handle drag over
function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const uploadArea = document.getElementById('upload-area');
    uploadArea.classList.add('dragover');
}

// Handle drag leave
function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const uploadArea = document.getElementById('upload-area');
    uploadArea.classList.remove('dragover');
}

// Handle file upload
function handleFileUpload(file) {
    console.log('Processing file:', file.name);
    
    // Validate file type
    const fileExt = file.name.split('.').pop().toLowerCase();
    const validExtensions = ['csv', 'xlsx', 'xls'];
    
    if (!validExtensions.includes(fileExt)) {
        showError('Unsupported file format. Please upload CSV or Excel files.');
        return;
    }
    
    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
        showError('File size exceeds 10MB limit.');
        return;
    }
    
    showLoading(true);
    
    if (fileExt === 'csv') {
        parseCSV(file);
    } else if (['xlsx', 'xls'].includes(fileExt)) {
        parseExcel(file);
    }
}

// Parse CSV file
function parseCSV(file) {
    PapaParse.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
            console.log('CSV parsed:', results);
            processParsedData(results.data, results.meta.fields);
        },
        error: (error) => {
            console.error('CSV parsing error:', error);
            showError('Failed to parse CSV file. Please check the file format.');
            showLoading(false);
        }
    });
}

// Parse Excel file
function parseExcel(file) {
    const reader = new FileReader();
    
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
            
            console.log('Excel parsed:', jsonData);
            
            // Extract headers and data
            const headers = jsonData[0] || [];
            const rows = jsonData.slice(1)
                .map(row => {
                    const obj = {};
                    headers.forEach((header, index) => {
                        if (header) {
                            obj[header.toString().trim()] = row[index];
                        }
                    });
                    return obj;
                })
                .filter(row => Object.values(row).some(val => val && val.toString().trim() !== ''));
            
            processParsedData(rows, headers);
            
        } catch (error) {
            console.error('Excel parsing error:', error);
            showError('Failed to parse Excel file. Please check the file format.');
            showLoading(false);
        }
    };
    
    reader.onerror = () => {
        showError('Failed to read file.');
        showLoading(false);
    };
    
    reader.readAsArrayBuffer(file);
}

// Process parsed data
function processParsedData(data, headers) {
    console.log('Processing parsed data:', data);
    
    // Normalize headers
    const normalizedHeaders = headers.map(h => h.toString().trim());
    
    // Validate headers
    const requiredHeaders = ['RegNo', 'UnitCode', 'CAT', 'Exam'];
    const missingHeaders = requiredHeaders.filter(h => !normalizedHeaders.includes(h));
    
    if (missingHeaders.length > 0) {
        showError(`Missing required column(s): ${missingHeaders.join(', ')}. Please use the provided template.`);
        showLoading(false);
        return;
    }
    
    // Filter rows for this unit and remove empty rows
    parsedData = data.filter(row => {
        const unitCode = row.UnitCode ? row.UnitCode.toString().trim() : '';
        return unitCode === unitContext.unitCode && 
               row.RegNo && row.RegNo.toString().trim() !== '';
    });
    
    console.log('Filtered data for unit:', parsedData);
    
    if (parsedData.length === 0) {
        showError(`No valid rows found for unit ${unitContext.unitCode}`);
        showLoading(false);
        return;
    }
    
    // Perform client-side validation
    performClientValidation();
    
    // Show preview
    displayPreview();
    showLoading(false);
}

// Perform client-side validation
function performClientValidation() {
    validatedRows = parsedData.map((row, index) => {
        const errors = [];
        const cat = parseFloat(row.CAT) || 0;
        const exam = parseFloat(row.Exam) || 0;
        const regNo = row.RegNo ? row.RegNo.toString().trim() : '';
        
        // Check RegNo
        if (!regNo) {
            errors.push('Registration number is required');
        } else if (!regNo.match(/^TTU\/\d{4}\/\d{5}$/)) {
            errors.push('Invalid registration number format');
        }
        
        // Check CAT marks
        if (cat < 0) {
            errors.push('CAT marks cannot be negative');
        } else if (cat > 30) {
            errors.push('CAT exceeds maximum (30)');
        }
        
        // Check Exam marks
        if (exam < 0) {
            errors.push('Exam marks cannot be negative');
        } else if (exam > 70) {
            errors.push('Exam exceeds maximum (70)');
        }
        
        return {
            ...row,
            RegNo: regNo,
            CAT: cat,
            Exam: exam,
            rowIndex: index + 2, // For error reporting (accounting for header)
            clientErrors: errors,
            validationStatus: errors.length > 0 ? 'invalid' : 'pending'
        };
    });
}

// Display preview table
function displayPreview() {
    // Update UI
    document.getElementById('upload-area').style.display = 'none';
    document.getElementById('preview-section').style.display = 'block';
    
    // Calculate statistics
    const validCount = validatedRows.filter(r => r.validationStatus !== 'invalid').length;
    const invalidCount = validatedRows.length - validCount;
    
    document.getElementById('preview-summary').innerHTML = `
        <div class="preview-stats">
            <div class="stat-item">
                <span class="stat-label">Total Rows:</span>
                <span class="stat-value">${validatedRows.length}</span>
            </div>
            <div class="stat-item success">
                <span class="stat-label">Valid:</span>
                <span class="stat-value">${validCount}</span>
            </div>
            <div class="stat-item error">
                <span class="stat-label">Invalid:</span>
                <span class="stat-value">${invalidCount}</span>
            </div>
        </div>
    `;
    
    // Create table headers
    const headers = ['RegNo', 'UnitCode', 'CAT', 'Exam', 'Validation Status'];
    document.getElementById('preview-header').innerHTML = headers.map(h => `<th>${h}</th>`).join('');
    
    // Create table body
    let tbodyHtml = '';
    validatedRows.forEach(row => {
        const statusClass = row.validationStatus === 'invalid' ? 'validation-invalid' : 
                           row.validationStatus === 'valid' ? 'validation-valid' : 'validation-pending';
        
        const statusText = row.validationStatus === 'invalid' ? row.clientErrors.join(', ') :
                          row.validationStatus === 'valid' ? '✓ Valid - Ready for upload' : '⏳ Pending ERP Check';
        
        const rowClass = row.validationStatus === 'invalid' ? 'row-error' : 
                        row.validationStatus === 'pending' ? 'row-pending' : 'row-valid';
        
        tbodyHtml += `
            <tr class="${rowClass}">
                <td><strong>${row.RegNo}</strong></td>
                <td>${row.UnitCode}</td>
                <td>${row.CAT}</td>
                <td>${row.Exam}</td>
                <td><span class="validation-status ${statusClass}">${statusText}</span></td>
            </tr>
        `;
    });
    
    document.getElementById('preview-body').innerHTML = tbodyHtml;
    
    // Show validate button if there are valid rows
    if (validCount > 0) {
        document.getElementById('validate-upload-btn').style.display = 'inline-flex';
    } else {
        document.getElementById('validate-upload-btn').style.display = 'none';
    }
}

// Validate rows with ERP
async function validateWithERP() {
    try {
        showLoading(true);
        
        const validRows = validatedRows.filter(r => r.validationStatus === 'pending');
        
        if (validRows.length === 0) {
            showError('No rows to validate');
            showLoading(false);
            return;
        }
        
        console.log('Validating rows with ERP:', validRows);
        
        const token = sessionStorage.getItem('ttu_token');
        const response = await fetch(`${API_BASE_URL}/marks/validate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                unitCode: unitContext.unitCode,
                semesterId: unitContext.semesterId,
                stageId: unitContext.stageId,
                programmeId: unitContext.programmeId,
                rows: validRows.map(r => ({
                    regNo: r.RegNo,
                    cat: r.CAT,
                    exam: r.Exam
                }))
            })
        });
        
        if (!response.ok) {
            throw new Error('Validation failed');
        }
        
        const validationResults = await response.json();
        console.log('Validation results:', validationResults);
        
        // Update validated rows with ERP results
        validatedRows = validatedRows.map(row => {
            const result = validationResults.find(r => r.regNo === row.RegNo);
            if (result) {
                return {
                    ...row,
                    validationStatus: result.matched ? 'valid' : 'invalid',
                    studentName: result.studentName,
                    errorReason: result.errorReason || (result.matched ? null : 'Student not registered for this unit')
                };
            }
            return row;
        });
        
        // Refresh preview
        displayPreview();
        
        // Show confirm upload button if there are valid rows
        const validCount = validatedRows.filter(r => r.validationStatus === 'valid').length;
        if (validCount > 0) {
            document.getElementById('validate-upload-btn').style.display = 'none';
            document.getElementById('confirm-upload-btn').style.display = 'inline-flex';
            showSuccess(`${validCount} rows validated successfully. Click Confirm Upload to submit.`);
        } else {
            showError('No valid rows found after ERP validation.');
        }
        
    } catch (error) {
        console.error('Validation error:', error);
        showError('Failed to validate with ERP. Please try again.');
    } finally {
        showLoading(false);
    }
}

// Confirm upload
async function confirmUpload() {
    if (!confirm('Are you sure you want to submit these marks? This action cannot be undone.')) {
        return;
    }
    
    try {
        showLoading(true);
        
        const validRows = validatedRows.filter(r => r.validationStatus === 'valid');
        
        if (validRows.length === 0) {
            showError('No valid rows to upload');
            showLoading(false);
            return;
        }
        
        console.log('Submitting marks:', validRows);
        
        const token = sessionStorage.getItem('ttu_token');
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
                marks: validRows.map(r => ({
                    regNo: r.RegNo,
                    cat: r.CAT,
                    exam: r.Exam
                }))
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Upload failed');
        }
        
        uploadSession = await response.json();
        console.log('Upload session:', uploadSession);
        
        // Show results
        displayResults();
        showSuccess('Marks submitted successfully!');
        
    } catch (error) {
        console.error('Upload error:', error);
        showError('Failed to submit marks: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Display upload results
function displayResults() {
    document.getElementById('preview-section').style.display = 'none';
    document.getElementById('results-section').style.display = 'block';
    
    document.getElementById('results-summary').innerHTML = `
        <div class="results-icon">✅</div>
        <h4>Upload Complete!</h4>
        <div class="results-stats">
            <div class="stat-circle success">
                <span class="stat-number">${uploadSession.totalSubmitted}</span>
                <span class="stat-label">Submitted</span>
            </div>
            <div class="stat-circle ${uploadSession.totalFailed > 0 ? 'error' : 'success'}">
                <span class="stat-number">${uploadSession.totalFailed}</span>
                <span class="stat-label">Failed</span>
            </div>
        </div>
    `;
    
    // Setup download links
    const successLink = document.getElementById('download-success-link');
    const failedLink = document.getElementById('download-failed-link');
    
    successLink.href = `${API_BASE_URL}/marks/download/${uploadSession.successFileId}`;
    successLink.style.display = 'inline-flex';
    
    if (uploadSession.totalFailed > 0) {
        failedLink.href = `${API_BASE_URL}/marks/download/${uploadSession.failedFileId}`;
        failedLink.style.display = 'inline-flex';
    } else {
        failedLink.style.display = 'none';
    }
}

// Reset upload form
function resetUploadForm() {
    document.getElementById('upload-area').style.display = 'block';
    document.getElementById('preview-section').style.display = 'none';
    document.getElementById('results-section').style.display = 'none';
    document.getElementById('file-input').value = '';
    parsedData = null;
    validatedRows = [];
    uploadSession = null;
}

// Setup event listeners
function setupEventListeners() {
    console.log('Setting up event listeners');
    
    // Download template
    const downloadBtn = document.getElementById('download-template-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadTemplate);
    }
    
    // File input handling
    const fileInput = document.getElementById('file-input');
    const uploadArea = document.getElementById('upload-area');
    const browseBtn = document.querySelector('.upload-area .btn-secondary');
    
    if (fileInput) {
        // Method 1: Click on the browse button
        if (browseBtn) {
            browseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Browse button clicked');
                fileInput.click();
            });
        }
        
        // Method 2: Click anywhere on upload area
        if (uploadArea) {
            uploadArea.addEventListener('click', (e) => {
                // Don't trigger if clicking on the browse button (already handled)
                if (!e.target.classList.contains('btn-secondary')) {
                    console.log('Upload area clicked');
                    fileInput.click();
                }
            });
        }
        
        // Handle file selection
        fileInput.addEventListener('change', (e) => {
            console.log('File input change event', e.target.files);
            handleFileSelect(e);
        });
        
        // Drag and drop events
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('dragleave', handleDragLeave);
        uploadArea.addEventListener('drop', handleFileDrop);
    }
    
    // Validate button
    const validateBtn = document.getElementById('validate-upload-btn');
    if (validateBtn) {
        validateBtn.addEventListener('click', validateWithERP);
    }
    
    // Confirm upload button
    const confirmBtn = document.getElementById('confirm-upload-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', confirmUpload);
    }
    
    // Cancel upload
    const cancelBtn = document.getElementById('cancel-upload-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', resetUploadForm);
    }
    
    // Upload another
    const uploadAnotherBtn = document.getElementById('upload-another-btn');
    if (uploadAnotherBtn) {
        uploadAnotherBtn.addEventListener('click', resetUploadForm);
    }
    
    // Back to students
    const backToStudentsBtn = document.getElementById('back-to-students-btn');
    if (backToStudentsBtn) {
        backToStudentsBtn.addEventListener('click', () => {
            const params = new URLSearchParams(unitContext);
            window.location.href = `students.html?${params.toString()}`;
        });
    }
    
    // Back to dashboard
    const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
    if (backToDashboardBtn) {
        backToDashboardBtn.addEventListener('click', () => {
            window.location.href = '/dashboard.html';
        });
    }
    
    // My Units link
    const myUnitsLink = document.getElementById('my-units-link');
    if (myUnitsLink) {
        myUnitsLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/dashboard.html';
        });
    }
    
    // Logout
    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            sessionStorage.removeItem('ttu_token');
            window.location.href = '/index.html';
        });
    }
}

// UI Helpers
function showLoading(show) {
    const loader = document.getElementById('loading-indicator');
    if (loader) {
        loader.style.display = show ? 'flex' : 'none';
    }
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
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
}

function showSuccess(message) {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
        errorDiv.innerHTML = `
            <div class="alert-message success">
                <span class="alert-icon">✅</span>
                <div class="alert-content">${message}</div>
            </div>
        `;
        errorDiv.style.display = 'block';
        
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }
}