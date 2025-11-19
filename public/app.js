// API Configuration - CHANGED TO 127.0.0.1 TO MATCH YOUR BROWSER URL
const API_URL = 'http://127.0.0.1:3000/api';
let currentUser = null;

// DOM References
const loginScreen = document.getElementById('loginScreen');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loginUser = document.getElementById('loginUser');
const loginPass = document.getElementById('loginPass');

const homeBtn = document.getElementById('homeBtn');
const studentsBtn = document.getElementById('studentsBtn');
const overviewBtn = document.getElementById('overviewBtn');

const dashboardView = document.getElementById('dashboardView');
const studentsView = document.getElementById('studentsView');
const overviewView = document.getElementById('overviewView');

const addBtn = document.getElementById('addBtn');
const modalBackdrop = document.getElementById('modalBackdrop');
const cancelModal = document.getElementById('cancelModal');
const saveStudent = document.getElementById('saveStudent');

const studentIdInput = document.getElementById('studentId');
const studentNameInput = document.getElementById('studentName');
const studentAttendanceSelect = document.getElementById('studentAttendance');

const tbody = document.querySelector('#studentsTable tbody');
const searchInput = document.getElementById('searchInput');
const exportBtn = document.getElementById('exportBtn');
const clearBtn = document.getElementById('clearBtn');

const studentsViewTableBody = document.querySelector('#studentsViewTable tbody');
const studentSearchInput = document.getElementById('studentSearchInput');

const totalStudentsEl = document.getElementById('totalStudents');
const presentCountEl = document.getElementById('presentCount');
const absentCountEl = document.getElementById('absentCount');

let students = [];
let editingStudentId = null;

// ============================================
// API Helper Function
// ============================================
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(API_URL + endpoint, {
            ...options,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ============================================
// Login UI Management
// ============================================
function showLogin() {
    loginScreen.style.display = 'grid';
    document.getElementById('mainArea').style.filter = 'blur(2px)';
}

function hideLogin() {
    loginScreen.style.display = 'none';
    document.getElementById('mainArea').style.filter = 'none';
}

// Check if already authenticated
async function checkAuth() {
    try {
        const result = await apiCall('/auth/check');
        if (result.authenticated) {
            currentUser = result.username;
            hideLogin();
            await reloadAll();
        } else {
            showLogin();
        }
    } catch (error) {
        showLogin();
    }
}

// Initialize - Check authentication on load
checkAuth();

// ============================================
// Authentication Handlers
// ============================================

// Login
loginBtn.addEventListener('click', async () => {
    const username = (loginUser.value || '').trim();
    const password = (loginPass.value || '');
    
    if (!username || !password) {
        alert('Enter username and password');
        return;
    }
    
    try {
        const result = await apiCall('/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        if (result.success) {
            currentUser = result.user.username;
            hideLogin();
            await reloadAll();
            notify('Login successful!');
        }
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
});

// Logout
logoutBtn.addEventListener('click', async () => {
    if (confirm('Logout?')) {
        try {
            await apiCall('/logout', { method: 'POST' });
            currentUser = null;
            loginUser.value = '';
            loginPass.value = '';
            students = [];
            showLogin();
        } catch (error) {
            alert('Logout failed');
        }
    }
});

// ============================================
// Navigation
// ============================================
function setActiveNav(btn) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
}

homeBtn.addEventListener('click', () => { 
    setActiveNav(homeBtn); 
    showView('dashboard'); 
});

studentsBtn.addEventListener('click', () => { 
    setActiveNav(studentsBtn); 
    showView('students'); 
});

overviewBtn.addEventListener('click', () => { 
    setActiveNav(overviewBtn); 
    showView('overview'); 
});

function showView(name) {
    dashboardView.style.display = (name === 'dashboard') ? 'block' : 'none';
    studentsView.style.display = (name === 'students') ? 'block' : 'none';
    overviewView.style.display = (name === 'overview') ? 'block' : 'none';
}

// ============================================
// Modal Management
// ============================================
addBtn.addEventListener('click', () => openModal());

function openModal(student = null) {
    modalBackdrop.classList.add('active');
    if (student) {
        editingStudentId = student.student_id;
        document.getElementById('modalTitle').textContent = 'Edit Student';
        studentIdInput.value = student.student_id;
        studentNameInput.value = student.name;
        studentAttendanceSelect.value = student.attendance;
    } else {
        editingStudentId = null;
        document.getElementById('modalTitle').textContent = 'Add Student';
        studentIdInput.value = '';
        studentNameInput.value = '';
        studentAttendanceSelect.value = 'present';
    }
}

function closeModal() {
    modalBackdrop.classList.remove('active');
    editingStudentId = null;
}

cancelModal.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', e => {
    if (e.target === modalBackdrop) closeModal();
});

// ============================================
// Student Operations
// ============================================

// Save Student (Add or Update)
saveStudent.addEventListener('click', async () => {
    const id = (studentIdInput.value || '').trim();
    const name = (studentNameInput.value || '').trim();
    const attendance = studentAttendanceSelect.value || 'present';
    
    if (!id || !name) {
        alert('ID and Name are required');
        return;
    }
    
    try {
        if (editingStudentId) {
            // Update existing student
            await apiCall(`/students/${editingStudentId}`, {
                method: 'PUT',
                body: JSON.stringify({ id, name, attendance })
            });
            notify('Student updated successfully');
        } else {
            // Add new student
            await apiCall('/students', {
                method: 'POST',
                body: JSON.stringify({ id, name, attendance })
            });
            notify('Student added successfully');
        }
        
        closeModal();
        await reloadAll();
    } catch (error) {
        alert('Save failed: ' + error.message);
    }
});

// ============================================
// Render Functions
// ============================================

// Render Main Dashboard Table
function renderTable(filter = '') {
    tbody.innerHTML = '';
    const q = (filter || '').trim().toLowerCase();
    
    students.forEach((s) => {
        if (q && !(s.name.toLowerCase().includes(q) || s.student_id.toLowerCase().includes(q))) {
            return;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHtml(s.student_id)}</td>
            <td>${escapeHtml(s.name)}</td>
            <td>
                <input type="checkbox" 
                       data-id="${escapeAttr(s.student_id)}" 
                       ${s.attendance === 'present' ? 'checked' : ''}>
            </td>
            <td>
                <button class="btn btn-ghost" data-edit="${escapeAttr(s.student_id)}">Edit</button>
                <button class="btn btn-ghost" data-delete="${escapeAttr(s.student_id)}">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Render Students View Table
function renderStudentsViewTable(filter = '') {
    studentsViewTableBody.innerHTML = '';
    const q = (filter || '').trim().toLowerCase();
    
    students.forEach(s => {
        if (q && !(s.name.toLowerCase().includes(q) || s.student_id.toLowerCase().includes(q))) {
            return;
        }
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHtml(s.student_id)}</td>
            <td>${escapeHtml(s.name)}</td>
            <td>${escapeHtml(s.attendance)}</td>
            <td>
                <button class="btn btn-ghost" data-edit="${escapeAttr(s.student_id)}">Edit</button>
            </td>
        `;
        studentsViewTableBody.appendChild(tr);
    });
}

// ============================================
// Event Handlers
// ============================================

// Attendance Toggle
tbody.addEventListener('change', async (e) => {
    if (!e.target.matches('input[type=checkbox]')) return;
    
    const id = e.target.dataset.id;
    const attendance = e.target.checked ? 'present' : 'absent';
    
    try {
        await apiCall(`/students/${id}/attendance`, {
            method: 'PATCH',
            body: JSON.stringify({ attendance })
        });
        
        // Update local cache
        const student = students.find(s => s.student_id === id);
        if (student) {
            student.attendance = attendance;
        }
        
        updateStats();
        notify('Attendance updated');
    } catch (error) {
        alert('Failed to update attendance: ' + error.message);
        e.target.checked = !e.target.checked; // Revert checkbox
    }
});

// Edit/Delete Buttons (Dashboard)
tbody.addEventListener('click', async (e) => {
    if (e.target.matches('[data-edit]')) {
        const id = e.target.dataset.edit;
        const student = students.find(s => s.student_id === id);
        if (student) openModal(student);
    }

    if (e.target.matches('[data-delete]')) {
        const id = e.target.dataset.delete;
        if (!confirm('Delete this student?')) return;
        
        try {
            await apiCall(`/students/${id}`, { method: 'DELETE' });
            notify('Student deleted');
            await reloadAll();
        } catch (error) {
            alert('Delete failed: ' + error.message);
        }
    }
});

// Edit Button (Students View)
studentsViewTableBody.addEventListener('click', (e) => {
    if (e.target.matches('[data-edit]')) {
        const id = e.target.dataset.edit;
        const student = students.find(s => s.student_id === id);
        if (student) openModal(student);
    }
});

// Search Filters
searchInput.addEventListener('input', e => renderTable(e.target.value));
studentSearchInput.addEventListener('input', e => renderStudentsViewTable(e.target.value));

// Export CSV
exportBtn.addEventListener('click', () => {
    if (!students.length) {
        alert('No students to export');
        return;
    }
    
    const csv = toCSV(students);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
});

// Clear All
clearBtn.addEventListener('click', async () => {
    if (!confirm('Delete all students? This cannot be undone!')) return;
    
    try {
        // Delete each student
        for (const student of students) {
            await apiCall(`/students/${student.student_id}`, { method: 'DELETE' });
        }
        notify('All students deleted');
        await reloadAll();
    } catch (error) {
        alert('Failed to clear students: ' + error.message);
    }
});

// ============================================
// Data Loading & Statistics
// ============================================

// Load Students from API
async function loadStudents() {
    try {
        students = await apiCall('/students');
    } catch (error) {
        console.error('Failed to load students:', error);
        students = [];
    }
}

// Update Statistics
async function updateStats() {
    try {
        const stats = await apiCall('/statistics');
        totalStudentsEl.textContent = stats.total || 0;
        presentCountEl.textContent = stats.present || 0;
        absentCountEl.textContent = stats.absent || 0;
    } catch (error) {
        console.error('Failed to load statistics:', error);
    }
}

// Reload All Data
async function reloadAll() {
    await loadStudents();
    renderTable(searchInput.value || '');
    renderStudentsViewTable(studentSearchInput.value || '');
    await updateStats();
}

// ============================================
// Utility Functions
// ============================================

function notify(msg) {
    console.log('✅', msg);
    // You can add a toast notification here if desired
}

function toCSV(list) {
    const rows = [['ID', 'Name', 'Attendance']];
    list.forEach(s => rows.push([s.student_id, s.name, s.attendance]));
    return rows.map(r => 
        r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
}

function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[ch]);
}

function escapeAttr(s) {
    return (s == null) ? '' : String(s).replace(/"/g, '&quot;');
}