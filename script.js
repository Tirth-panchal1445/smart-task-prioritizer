const WORKER_URL = "https://billowing-union-4b09.tirthpanchal131.workers.dev";
let tasks = JSON.parse(localStorage.getItem("tasks")) || [
    { name: "Project Report", score: 10, done: false, deadline: "", impact: 5, effort: 4, progress: 0, category: "💼 Work", recurring: "None", subtasks: [] },
    { name: "Exam Study", score: 12, done: false, deadline: "", impact: 5, effort: 4, progress: 0, category: "🏠 Personal", recurring: "None", subtasks: [] }
];

let stats = JSON.parse(localStorage.getItem("taskStats")) || { streak: 0, lastDate: "", crushedToday: 0, history: {} };
let currentFilter = "all";
let editingIndex = -1;
let productivityChart;

window.loadUserTasks = function () {
    if ("Notification" in window) Notification.requestPermission();
    const uid = window.currentUser?.uid;
    if (!uid) return;

    window.fsGetDocs(
        window.fsQuery(window.fsCollection(window.db, "tasks"), window.fsWhere("uid", "==", uid))
    ).then(snapshot => {
        tasks = [];
        snapshot.forEach(docSnap => tasks.push({ id: docSnap.id, ...docSnap.data() }));
        tasks.sort((a, b) => (b.score || 0) - (a.score || 0));
        displayTasks();
        if (typeof updateChart === "function") updateChart();
    }).catch(err => console.error("Firebase Load Error:", err));
};

setInterval(() => {
    const now = new Date().getTime();
    tasks.forEach(task => {
        if (!task.done && task.deadline) {
            const minDiff = (new Date(task.deadline).getTime() - now) / 60000;
            if (minDiff > 29 && minDiff <= 30 && !task.notified) {
                task.notified = true;
                if (Notification.permission === "granted") {
                    new Notification("Task Due Soon! ⏰", { body: `Your task "${task.name}" is due in 30 minutes!` });
                } else {
                    alert(`⏰ Task Due Soon: "${task.name}" in 30 mins!`);
                }
            }
        }
    });
    saveTasks();
}, 60000);

// ==========================================
// 📊 STATS & STREAK MANAGEMENT
// ==========================================
function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

function checkNewDay() {
    const todayDate = getTodayDate();
    stats.history = stats.history || {};

    if (stats.lastDate !== todayDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (stats.lastDate !== yesterdayStr && stats.lastDate !== "") stats.streak = 0;
        if (stats.lastDate && stats.crushedToday !== undefined) stats.history[stats.lastDate] = stats.crushedToday;

        stats.crushedToday = 0;
        stats.lastDate = todayDate;
        stats.history[todayDate] = 0;
        saveStats();
    }
}

function incrementCrushed() {
    checkNewDay();
    if (stats.crushedToday === 0) stats.streak += 1;
    stats.crushedToday += 1;
    stats.history[getTodayDate()] = stats.crushedToday;

    saveStats();
    if (typeof updateChart === "function") updateChart();
}

function saveStats() {
    localStorage.setItem("taskStats", JSON.stringify(stats));
    const streakDisplay = document.getElementById("streakDisplay");
    const crushedDisplay = document.getElementById("crushedDisplay");

    if (streakDisplay) streakDisplay.innerText = `🔥 ${stats.streak}-Day Streak!`;
    if (crushedDisplay) crushedDisplay.innerText = `🏆 You've crushed ${stats.crushedToday} tasks today!`;
}

function saveTasks() {
    localStorage.setItem("tasks", JSON.stringify(tasks));
}

// ==========================================
// 🧠 CORE LOGIC & TASK MANAGEMENT
// ==========================================
function recalculateScore(task) {
    if (task.impact !== undefined && task.effort !== undefined) {
        let urgency = 1;
        if (task.deadline) {
            const hours = (new Date(task.deadline) - new Date()) / 3600000;
            if (hours <= 24) urgency = 5;
            else if (hours <= 48) urgency = 4;
            else if (hours <= 72) urgency = 3;
            else if (hours <= 96) urgency = 2;
        }

        const progressPercent = (task.progress || 0) / 100;
        const completionBoost = progressPercent * 5;
        const remainingEffort = task.effort * (1 - progressPercent);

        task.score = Math.round(((task.impact * 2) + urgency - remainingEffort + completionBoost) * 100) / 100;
    }
}

function getVal(id) {
    return document.getElementById(id)?.value || "";
}

function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
}

function addTask() {
    const name = getVal("task");
    const deadline = getVal("deadline");
    const category = getVal("category");
    const recurring = getVal("recurring");
    const impact = parseInt(getVal("impact")) || 1;
    const effort = parseInt(getVal("effort")) || 1;
    const progress = parseInt(getVal("progress")) || 0;

    if (!name || !deadline) return alert("Please fill all fields!");

    if (editingIndex >= 0) {
        const t = tasks[editingIndex];
        Object.assign(t, { name, deadline, impact, effort, progress, category, recurring });
        recalculateScore(t);

        editingIndex = -1;
        const btn = document.querySelector(".add-btn");
        if (btn) {
            btn.innerText = "+ Add Task";
            btn.style.background = "";
        }
    } else {
        const newTask = { name, done: false, deadline, impact, effort, progress, category, recurring, subtasks: [], notified: false };
        recalculateScore(newTask);

        window.fsAddDoc(window.fsCollection(window.db, "tasks"), { ...newTask, uid: window.currentUser?.uid })
            .then(docRef => {
                newTask.id = docRef.id;
                tasks.push(newTask);
                displayTasks();
                if (typeof updateChart === "function") updateChart();
            })
            .catch(err => console.error("Error adding task:", err));
    }

    saveTasks();
    ["task", "deadline", "impact", "effort", "progress"].forEach(id => setVal(id, ""));
    displayTasks();
}

function editTask(index) {
    const t = tasks[index];
    setVal("task", t.name);

    let dateVal = t.deadline || "";
    if (dateVal.length > 16) dateVal = dateVal.slice(0, 16);

    setVal("deadline", dateVal);
    setVal("category", t.category || "🏠 Personal");
    setVal("recurring", t.recurring || "None");
    setVal("impact", t.impact || 1);
    setVal("effort", t.effort || 1);
    setVal("progress", t.progress || 0);

    editingIndex = index;

    const btn = document.querySelector(".add-btn");
    if (btn) {
        btn.innerText = "Save Changes";
        btn.style.background = "#f5a623";
    }
    window.scrollTo(0, 0);
}

function markDone(index) {
    const t = tasks[index];

    if (t.recurring && t.recurring !== "None" && t.deadline) {
        const newDate = new Date(t.deadline);
        newDate.setDate(newDate.getDate() + (t.recurring === "Daily" ? 1 : 7));

        const tzoffset = newDate.getTimezoneOffset() * 60000;
        const localISOTime = new Date(newDate - tzoffset).toISOString().slice(0, 16);

        tasks.push({
            name: t.name,
            done: false,
            deadline: localISOTime,
            impact: t.impact,
            effort: t.effort,
            progress: 0,
            category: t.category,
            recurring: t.recurring,
            subtasks: t.subtasks ? t.subtasks.map(st => ({ name: st.name, done: false })) : [],
            notified: false
        });
    }

    t.done = true;
    t.progress = 100;
    recalculateScore(t);
    incrementCrushed();

    const updateCloud = t.id
        ? window.fsUpdateDoc(window.fsDoc(window.db, "tasks", t.id), { done: true })
        : Promise.resolve();

    updateCloud.then(() => displayTasks()).catch(err => console.error("Error updating cloud:", err));
}

function deleteTask(index) {
    const task = tasks[index];
    const afterDelete = () => {
        tasks.splice(index, 1);
        displayTasks();
        if (typeof updateChart === "function") updateChart();
    };

    if (task.id) {
        window.fsDeleteDoc(window.fsDoc(window.db, "tasks", task.id))
            .then(afterDelete)
            .catch(err => console.error("Error deleting from cloud:", err));
    } else {
        afterDelete();
    }
}

// ==========================================
// 🔗 SUBTASKS LOGIC
// ==========================================
function toggleExpand(index) {
    const el = document.getElementById(`subtasks-${index}`);
    if (el) el.style.display = el.style.display === "none" ? "block" : "none";
}

function addSubtask(e, index) {
    e.stopPropagation();
    const input = document.getElementById(`subtask-input-${index}`);
    if (input && input.value.trim()) {
        tasks[index].subtasks = tasks[index].subtasks || [];
        tasks[index].subtasks.push({ name: input.value.trim(), done: false });
        recalculateProgressFromSubtasks(index);
    }
}

function toggleSubtask(e, taskIndex, subIndex) {
    e.stopPropagation();
    const subtask = tasks[taskIndex].subtasks[subIndex];
    subtask.done = !subtask.done;
    recalculateProgressFromSubtasks(taskIndex);
}

function recalculateProgressFromSubtasks(index) {
    const task = tasks[index];
    const total = task.subtasks.length;
    if (total > 0) {
        const doneSub = task.subtasks.filter(s => s.done).length;
        task.progress = Math.round((doneSub / total) * 100);
    }
    recalculateScore(task);
    saveTasks();
    displayTasks();
    setTimeout(() => {
        const el = document.getElementById(`subtasks-${index}`);
        if (el) el.style.display = "block";
    }, 10);
}

// ==========================================
// 🎨 UI RENDERING
// ==========================================
function displayTasks() {
    tasks.forEach(t => { if (!t.done) recalculateScore(t); });

    tasks.sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return b.score - a.score;
    });

    const list = document.getElementById("taskList");
    if (!list) return;
    list.innerHTML = "";

    let highCount = 0, doneCount = 0, overdueCount = 0;

    const filtered = tasks.filter(task => {
        const isOverdue = task.deadline && (new Date(task.deadline) < new Date());
        if (currentFilter === "high") return task.score > 10 && !task.done;
        if (currentFilter === "done") return task.done;
        if (currentFilter === "overdue") return isOverdue && !task.done;
        if (["🏠 Personal", "💼 Work", "🛒 Errands"].includes(currentFilter)) return task.category === currentFilter;
        return true;
    });

    if (!filtered.length) {
        list.innerHTML = '<p class="empty-msg" style="text-align:center; padding:10px; color:#888;">No tasks found.</p>';
        setTimeout(() => updateDisplayCounts(tasks.length, highCount, doneCount, overdueCount), 0);
        return;
    }

    filtered.forEach(task => {
        const index = tasks.indexOf(task);
        if (task.done) doneCount++;

        let isOverdue = false, isDueSoon = false;
        if (task.deadline) {
            const hoursDiff = (new Date(task.deadline) - new Date()) / 3600000;
            isOverdue = hoursDiff < 0;
            isDueSoon = hoursDiff >= 0 && hoursDiff <= 24;
        }

        if (isOverdue && !task.done) overdueCount++;

        const isHigh = task.score > 10;
        const isMed = task.score > 6;

        if (isHigh && !task.done) highCount++;

        const li = document.createElement("li");
        li.className = `${isHigh ? "high" : isMed ? "medium" : "low"} ${task.done ? "done-task" : ""}`;
        li.style.cssText = "display: flex; justify-content: space-between; align-items: flex-start;";

        const overdueTag = (isOverdue && !task.done) ? ' <span style="color:#f06a6a;font-size:11px;font-weight:bold;">⚠ Overdue</span>' : "";
        const dueSoonTag = (isDueSoon && !task.done) ? ' <span style="color:#f5c542;font-size:11px;font-weight:bold;">⏰ Due Soon</span>' : "";
        const progressDisplay = task.progress !== undefined ? ` | Progress: ${task.progress}%` : "";
        const catDisplay = task.category ? ` | ${task.category}` : "";
        const recDisplay = (task.recurring && task.recurring !== "None") ? ` | 🔁 ${task.recurring}` : "";

        let subtasksHtml = "";
        if (!task.done) {
            const stList = (task.subtasks || []).map((st, i) => `
                <div style="font-size: 13px; display:flex; align-items:center; gap:5px; margin-top:4px;">
                    <input type="checkbox" ${st.done ? 'checked' : ''} onclick="toggleSubtask(event, ${index}, ${i})">
                    <span style="${st.done ? 'text-decoration:line-through;color:#aaa;' : ''}">${st.name}</span>
                </div>
            `).join("");

            subtasksHtml = `
                <div class="subtasks-container" style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #ddd; display: none;" id="subtasks-${index}" onclick="event.stopPropagation()">
                    ${stList}
                    <div style="margin-top:8px; display:flex; gap:5px;">
                        <input type="text" id="subtask-input-${index}" placeholder="Add step..." style="flex:1; padding:4px; font-size:12px; border:1px solid var(--border-color); border-radius:3px; background: var(--bg-surface-2); color: white;">
                        <button onclick="addSubtask(event, ${index})" style="padding:4px 8px; font-size:12px; background:var(--border-light); border:none; border-radius:3px; cursor:pointer; color: white;">Add</button>
                    </div>
                </div>
            `;
        }

        li.innerHTML = `
            <div class="task-info" style="width: 100%;">
                <div class="task-name" style="cursor:pointer;" onclick="toggleExpand(${index})" title="Click to expand sub-tasks">
                    ${task.name} ${overdueTag} ${dueSoonTag} <span style="font-size: 10px; color: #888;">(Click to see checklist)</span>
                </div>
                <div class="task-meta">
                    Score: ${task.score}${progressDisplay}${catDisplay}${recDisplay}
                </div>
                ${subtasksHtml}
            </div>
            <div class="task-actions">
                <span class="priority-badge ${isHigh ? 'badge-high' : isMed ? 'badge-medium' : 'badge-low'}" style="margin-bottom: 5px;">
                    ${isHigh ? '🔴 High' : isMed ? '🟡 Medium' : '🟢 Low'}
                </span>
                <div class="task-buttons">
                    ${!task.done ? `
                        <button class="btn-edit" onclick="editTask(${index})">✏️ Edit</button>
                        <button class="btn-done" onclick="markDone(${index})">✔ Done</button>
                    ` : '<span style="font-size:11px;color:#3ecf8e;font-weight:bold;">✔ Completed</span>'}
                    <button class="btn-delete" onclick="deleteTask(${index})">❌</button>
                </div>
            </div>
        `;
        list.appendChild(li);
    });

    updateDisplayCounts(tasks.length, highCount, doneCount, overdueCount);
}

function updateDisplayCounts(total, high, done, overdue) {
    ['totalCount', 'highCount', 'doneCount', 'overdueCount'].forEach((id, i) => {
        const el = document.getElementById(id);
        if (el) el.innerText = [total, high, done, overdue][i];
    });

    const suggestionBox = document.getElementById("suggestion");
    if (suggestionBox) {
        const topTask = tasks.find(t => !t.done);
        suggestionBox.innerText = topTask ? `👉 Suggested Next Task: ${topTask.name}` : "✅ All tasks completed!";
    }
}

function filterTasks(value) {
    currentFilter = value;
    displayTasks();
}

function updateChart() {
    const ctx = document.getElementById('productivityChart');
    if (!ctx) return;

    const labels = [], data = [];
    stats.history = stats.history || {};
    stats.history[getTodayDate()] = stats.crushedToday || 0;

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
        data.push(stats.history[d.toISOString().split('T')[0]] || 0);
    }

    if (productivityChart) {
        productivityChart.data.labels = labels;
        productivityChart.data.datasets[0].data = data;
        productivityChart.update();
    } else {
        Chart.defaults.color = '#9ca3af';
        productivityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Tasks Crushed',
                    data,
                    borderColor: '#7c6cfc',
                    backgroundColor: 'rgba(124, 108, 252, 0.2)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } } },
                plugins: { legend: { display: false }, title: { display: true, text: '7-Day Productivity Trend' } }
            }
        });
    }
}

// ==========================================
// ⬇ UTILITIES
// ==========================================
function exportCSV() {
    const csv = ["Name,Score,Status,Category", ...tasks.map(t => `${t.name},${t.score},${t.done ? "Done" : "Pending"},${t.category || ""}`)].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "tasks.csv";
    a.click();
}

// ==========================================
// 🤖 GEMINI AI INTEGRATION
// ==========================================
function setPrompt(text) {
    const el = document.getElementById("geminiPrompt");
    if (el) el.value = text;
}

async function askGemini() {
    const inputField = document.getElementById("geminiPrompt");
    const prompt = inputField?.value.trim();
    if (!prompt) return;

    await getGeminiAdvice(prompt);
    inputField.value = "";
}

async function getGeminiAdvice(customPrompt) {
    const insightElement = document.getElementById("insight");
    if (!insightElement) return;

    insightElement.innerHTML = "<p>🤖 Gemini is thinking...</p>";

    const taskContext = tasks.filter(t => !t.done)
        .map(t => `- ${t.name} (Impact: ${t.impact}/5, Effort: ${t.effort}/5, Category: ${t.category}, Deadline: ${t.deadline || 'None'})`)
        .join("\n");

    const prompt = customPrompt
        ? `I have the following tasks:\n${taskContext}\n\nUser Question: "${customPrompt}"\nProvide a brief 1-2 sentence response.`
        : `I have the following tasks:\n${taskContext}\n\nTell me in one short, motivating sentence which specific task I should focus on right now and why.`;

    try {
        const res = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt })
        });
        const data = await res.json();

        if (data.advice) {
            insightElement.innerHTML = `<p><strong>✨ Gemini:</strong> ${data.advice}</p>`;
        } else {
            throw new Error(data.error || "Gemini could not generate a response.");
        }
    } catch (error) {
        console.error("Cloudflare Worker Error:", error);
        insightElement.innerHTML = "<p>⚠️ Oops! Gemini is currently unavailable. Please check your connection.</p>";
    }
}

// ---- AUTH FUNCTIONS ----
function showLogin() {
    document.getElementById("registerNameField").style.display = "none";
    document.getElementById("authSubmitBtn").innerText = "Sign In";
    document.getElementById("loginTabBtn").style.background = "#7c6cfc";
    document.getElementById("loginTabBtn").style.color = "#fff";
    document.getElementById("registerTabBtn").style.background = "transparent";
    document.getElementById("registerTabBtn").style.color = "#9ca3af";
    window._authMode = "login";
}

function showRegister() {
    document.getElementById("registerNameField").style.display = "block";
    document.getElementById("authSubmitBtn").innerText = "Create Account";
    document.getElementById("registerTabBtn").style.background = "#7c6cfc";
    document.getElementById("registerTabBtn").style.color = "#fff";
    document.getElementById("loginTabBtn").style.background = "transparent";
    document.getElementById("loginTabBtn").style.color = "#9ca3af";
    window._authMode = "register";
}

async function handleAuth() {
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value.trim();
    const errEl = document.getElementById("authError");
    errEl.style.display = "none";

    if (!email || !password) { errEl.innerText = "Please fill all fields."; errEl.style.display = "block"; return; }

    try {
        if (window._authMode === "register") {
            await window.fsCreateUser(window.auth, email, password);
        } else {
            await window.fsSignIn(window.auth, email, password);
        }
        // onAuthStateChanged in index.html handles the rest
    } catch (err) {
        errEl.innerText = err.message.replace("Firebase: ", "");
        errEl.style.display = "block";
    }
}

async function logoutUser() {
    await window.fsSignOut(window.auth);
    tasks = [];
    displayTasks();
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("geminiPrompt")?.addEventListener("keypress", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            askGemini();
        }
    });
});
