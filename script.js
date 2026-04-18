const WORKER_URL = "https://billowing-union-4b09.tirthpanchal131.workers.dev";
let tasks = JSON.parse(localStorage.getItem("tasks")) || [
    { name: "Project Report", score: 10, done: false, deadline: "", impact: 5, effort: 4, progress: 0, category: "💼 Work", recurring: "None", subtasks: [] },
    { name: "Exam Study", score: 12, done: false, deadline: "", impact: 5, effort: 4, progress: 0, category: "🏠 Personal", recurring: "None", subtasks: [] }
];

let stats = JSON.parse(localStorage.getItem("taskStats")) || { streak: 0, lastDate: "", crushedToday: 0, history: {} };
let currentFilter = "all";
let editingIndex = -1;
let productivityChart;

window.onload = function () {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
    checkNewDay();
    saveStats();
    displayTasks();
    updateChart();
};

// Check for notifications every minute
setInterval(() => {
    let now = new Date();
    tasks.forEach(task => {
        if (!task.done && task.deadline) {
            let dueTime = new Date(task.deadline).getTime();
            let minDiff = (dueTime - now.getTime()) / (1000 * 60);

            // Trigger 30 mins before deadline
            if (minDiff > 29 && minDiff <= 30 && !task.notified) {
                task.notified = true;
                if (Notification.permission === "granted") {
                    new Notification("Task Due Soon! ⏰", { body: `Your task "${task.name}" is due in 30 minutes!` });
                } else {
                    alert(`⏰ Task Due Soon: "${task.name}" in 30 mins!`); // In-app fallback
                }
            }
        }
    });
    saveTasks();
}, 60000);

// ==========================================
// 📊 STATS & STREAK MANAGEMENT
// ==========================================
function checkNewDay() {
    let todayDate = new Date().toISOString().split('T')[0];
    stats.history = stats.history || {};

    if (stats.lastDate !== todayDate) {
        let yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        let yesterdayStr = yesterday.toISOString().split('T')[0];

        if (stats.lastDate !== yesterdayStr && stats.lastDate !== "") {
            stats.streak = 0; // Missed a day
        }

        // Save history of the previous day before resetting
        if (stats.lastDate && stats.crushedToday !== undefined) {
            stats.history[stats.lastDate] = stats.crushedToday;
        }

        stats.crushedToday = 0;
        stats.lastDate = todayDate;
        stats.history[todayDate] = 0; // initialize today

        saveStats();
    }
}

function incrementCrushed() {
    checkNewDay();
    if (stats.crushedToday === 0) {
        stats.streak += 1;
    }
    stats.crushedToday += 1;

    let todayDate = new Date().toISOString().split('T')[0];
    stats.history = stats.history || {};
    stats.history[todayDate] = stats.crushedToday;

    saveStats();
    updateChart(); // dynamically redraw the chart when we crush a task!
}

function saveStats() {
    localStorage.setItem("taskStats", JSON.stringify(stats));
    let streakDisplay = document.getElementById("streakDisplay");
    let crushedDisplay = document.getElementById("crushedDisplay");
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
            let hours = (new Date(task.deadline) - new Date()) / (1000 * 60 * 60);
            if (hours <= 24) urgency = 5;
            else if (hours <= 48) urgency = 4;
            else if (hours <= 72) urgency = 3;
            else if (hours <= 96) urgency = 2;
        }

        let progressPercentage = (task.progress || 0) / 100;
        let completionBoost = progressPercentage * 5;
        let remainingEffort = task.effort * (1 - progressPercentage);

        let score = (task.impact * 2) + urgency - remainingEffort + completionBoost;
        task.score = Math.round(score * 100) / 100;
    }
}

function addTask() {
    let name = document.getElementById("task").value;
    let deadline = document.getElementById("deadline").value;
    let category = document.getElementById("category").value;
    let recurring = document.getElementById("recurring").value;
    let impact = parseInt(document.getElementById("impact").value);
    let effort = parseInt(document.getElementById("effort").value);
    let progress = parseInt(document.getElementById("progress").value) || 0;

    if (!name || !deadline || !impact || !effort) {
        alert("Please fill all fields!");
        return;
    }

    if (editingIndex >= 0) {
        let t = tasks[editingIndex];
        t.name = name;
        t.deadline = deadline;
        t.impact = impact;
        t.effort = effort;
        t.progress = progress;
        t.category = category;
        t.recurring = recurring;
        recalculateScore(t);

        editingIndex = -1;
        let btn = document.querySelector(".add-btn");
        if (btn) {
            btn.innerText = "+ Add Task";
            btn.style.background = "";
        }
    } else {
        let newTask = { name, done: false, deadline, impact, effort, progress, category, recurring, subtasks: [], notified: false };
        recalculateScore(newTask);
        tasks.push(newTask);
    }

    saveTasks();

    // Clear form
    document.getElementById("task").value = "";
    document.getElementById("deadline").value = "";
    document.getElementById("impact").value = "";
    document.getElementById("effort").value = "";
    document.getElementById("progress").value = "";

    displayTasks();
}

function editTask(index) {
    let t = tasks[index];
    document.getElementById("task").value = t.name;

    // Formatting datetime-local requires YYYY-MM-DDTHH:mm exactly
    let dateVal = t.deadline || "";
    if (dateVal.length > 16) dateVal = dateVal.slice(0, 16);
    document.getElementById("deadline").value = dateVal;

    document.getElementById("category").value = t.category || "🏠 Personal";
    document.getElementById("recurring").value = t.recurring || "None";
    document.getElementById("impact").value = t.impact || 1;
    document.getElementById("effort").value = t.effort || 1;
    document.getElementById("progress").value = t.progress || 0;

    editingIndex = index;

    let btn = document.querySelector(".add-btn");
    if (btn) {
        btn.innerText = "Save Changes";
        btn.style.background = "#f5a623";
    }
    window.scrollTo(0, 0); // Scroll up to the form
}

function markDone(index) {
    let t = tasks[index];

    // Handle Recurring Task clone before marking done
    if (t.recurring && t.recurring !== "None" && t.deadline) {
        let newDate = new Date(t.deadline);
        if (t.recurring === "Daily") newDate.setDate(newDate.getDate() + 1);
        if (t.recurring === "Weekly") newDate.setDate(newDate.getDate() + 7);

        // Convert to local YYYY-MM-DDTHH:mm
        let tzoffset = newDate.getTimezoneOffset() * 60000;
        let localISOTime = (new Date(newDate - tzoffset)).toISOString().slice(0, 16);

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
    incrementCrushed(); // Streak update
    saveTasks();
    displayTasks();
}

function deleteTask(index) {
    tasks.splice(index, 1);
    saveTasks();
    displayTasks();
}

// ==========================================
// 🔗 SUBTASKS LOGIC
// ==========================================
function toggleExpand(index) {
    let el = document.getElementById(`subtasks-${index}`);
    if (el) {
        el.style.display = el.style.display === "none" ? "block" : "none";
    }
}

function addSubtask(e, index) {
    e.stopPropagation();
    let input = document.getElementById(`subtask-input-${index}`);
    if (input && input.value.trim() !== "") {
        if (!tasks[index].subtasks) tasks[index].subtasks = [];
        tasks[index].subtasks.push({ name: input.value.trim(), done: false });
        recalculateProgressFromSubtasks(index);
    }
}

function toggleSubtask(e, taskIndex, subIndex) {
    e.stopPropagation();
    tasks[taskIndex].subtasks[subIndex].done = !tasks[taskIndex].subtasks[subIndex].done;
    recalculateProgressFromSubtasks(taskIndex);
}

function recalculateProgressFromSubtasks(index) {
    let total = tasks[index].subtasks.length;
    let doneSub = tasks[index].subtasks.filter(s => s.done).length;
    if (total > 0) {
        tasks[index].progress = Math.round((doneSub / total) * 100);
    }
    recalculateScore(tasks[index]);
    saveTasks();
    displayTasks();
    // Keep it expanded after re-render by doing a tiny timeout
    setTimeout(() => {
        let el = document.getElementById(`subtasks-${index}`);
        if (el) el.style.display = "block";
    }, 10);
}

// ==========================================
// 🎨 UI RENDERING
// ==========================================
function displayTasks() {
    // Dynamically update scores before sorting
    tasks.forEach(t => { if (!t.done) recalculateScore(t); });

    tasks.sort((a, b) => {
        if (a.done && !b.done) return 1;
        if (!a.done && b.done) return -1;
        return b.score - a.score;
    });

    let list = document.getElementById("taskList");
    if (!list) return;
    list.innerHTML = "";

    let total = tasks.length;
    let highCount = 0;
    let doneCount = 0;
    let overdueCount = 0;

    let filtered = tasks.filter(task => {
        let isOverdue = false;
        if (task.deadline) {
            isOverdue = (new Date(task.deadline) - new Date()) < 0;
        }
        if (currentFilter === "high") return task.score > 10 && !task.done;
        if (currentFilter === "done") return task.done;
        if (currentFilter === "overdue") return isOverdue && !task.done;
        if (["🏠 Personal", "💼 Work", "🛒 Errands"].includes(currentFilter)) {
            return task.category === currentFilter;
        }
        return true; // "all"
    });

    if (filtered.length === 0) {
        list.innerHTML = '<p class="empty-msg" style="text-align:center; padding:10px; color:#888;">No tasks found.</p>';
    }

    tasks.forEach((task, index) => {
        let priority = "";
        let badgeClass = "";
        let liClass = "";

        if (task.score > 10) {
            priority = "🔴 High";
            badgeClass = "badge-high";
            liClass = "high";
            if (!task.done) highCount++;
        } else if (task.score > 6) {
            priority = "🟡 Medium";
            badgeClass = "badge-medium";
            liClass = "medium";
        } else {
            priority = "🟢 Low";
            badgeClass = "badge-low";
            liClass = "low";
        }

        if (task.done) doneCount++;

        let isOverdue = false;
        let isDueSoon = false;
        if (task.deadline) {
            let hoursDiff = (new Date(task.deadline) - new Date()) / (1000 * 60 * 60);
            isOverdue = hoursDiff < 0;
            isDueSoon = hoursDiff >= 0 && hoursDiff <= 24;
        }

        if (isOverdue && !task.done) overdueCount++;

        // Filter rendering skip
        if (!filtered.includes(task)) return;

        let li = document.createElement("li");
        li.className = liClass + (task.done ? " done-task" : "");

        let overdueTag = (isOverdue && !task.done) ? ' <span style="color:#f06a6a;font-size:11px;font-weight:bold;">⚠ Overdue</span>' : "";
        let dueSoonTag = (isDueSoon && !task.done) ? ' <span style="color:#f5c542;font-size:11px;font-weight:bold;">⏰ Due Soon</span>' : "";

        let progressDisplay = (task.progress !== undefined) ? ` | Progress: ${task.progress}%` : "";
        let categoryDisplay = task.category ? ` | ${task.category}` : "";
        let recurringDisplay = (task.recurring && task.recurring !== "None") ? ` | 🔁 ${task.recurring}` : "";

        // Subtasks HTML Generation
        let subtasksHtml = "";
        if (!task.done) {
            let stList = (task.subtasks || []).map((st, i) => `
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
                    Score: ${task.score}${progressDisplay}${categoryDisplay}${recurringDisplay}
                </div>
                ${subtasksHtml}
            </div>
            <div class="task-actions">
                <span class="priority-badge ${badgeClass}" style="margin-bottom: 5px;">${priority}</span>
                <div class="task-buttons">
                    ${!task.done ? `
                        <button class="btn-edit" onclick="editTask(${index})">✏️ Edit</button>
                        <button class="btn-done" onclick="markDone(${index})">✔ Done</button>
                    ` : '<span style="font-size:11px;color:#3ecf8e;font-weight:bold;">✔ Completed</span>'}
                    <button class="btn-delete" onclick="deleteTask(${index})">❌</button>
                </div>
            </div>
        `;

        li.style.display = "flex";
        li.style.justifyContent = "space-between";
        li.style.alignItems = "flex-start";

        list.appendChild(li);
    });

    document.getElementById("totalCount").innerText = total;
    document.getElementById("highCount").innerText = highCount;
    document.getElementById("doneCount").innerText = doneCount;
    document.getElementById("overdueCount").innerText = overdueCount;

    let topTask = tasks.find(t => !t.done);
    let suggestionBox = document.getElementById("suggestion");
    if (suggestionBox) {
        suggestionBox.innerText = topTask ? "👉 Suggested Next Task: " + topTask.name : "✅ All tasks completed!";
    }
}

function filterTasks(value) {
    currentFilter = value;
    displayTasks();
}

function updateChart() {
    let ctx = document.getElementById('productivityChart');
    if (!ctx) return;

    let labels = [];
    let data = [];

    stats.history = stats.history || {};
    let todayDate = new Date().toISOString().split('T')[0];
    stats.history[todayDate] = stats.crushedToday || 0;

    for (let i = 6; i >= 0; i--) {
        let d = new Date();
        d.setDate(d.getDate() - i);
        let dateStr = d.toISOString().split('T')[0];

        // Format label like "Mon", "Tue"
        let displayStr = d.toLocaleDateString('en-US', { weekday: 'short' });
        labels.push(displayStr);
        data.push(stats.history[dateStr] || 0);
    }

    if (productivityChart) {
        productivityChart.data.labels = labels;
        productivityChart.data.datasets[0].data = data;
        productivityChart.update();
    } else {
        Chart.defaults.color = '#9ca3af'; // Make chart text dark mode friendly
        productivityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Tasks Crushed',
                    data: data,
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
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, precision: 0 }
                    }
                },
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: '7-Day Productivity Trend'
                    }
                }
            }
        });
    }
}

// ==========================================
// ⬇ UTILITIES
// ==========================================
function exportCSV() {
    let csv = "Name,Score,Status,Category\n";
    tasks.forEach(t => {
        csv += `${t.name},${t.score},${t.done ? "Done" : "Pending"},${t.category || ""}\n`;
    });
    let blob = new Blob([csv], { type: "text/csv" });
    let a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tasks.csv";
    a.click();
}

// ==========================================
// 🤖 GEMINI AI INTEGRATION
// ==========================================
function setPrompt(text) {
    document.getElementById("geminiPrompt").value = text;
}

async function askGemini() {
    const inputField = document.getElementById("geminiPrompt");
    if (!inputField) return;
    const userPrompt = inputField.value.trim();
    if (!userPrompt) return;

    await getGeminiAdvice(userPrompt);
    inputField.value = "";
}

async function getGeminiAdvice(customPrompt) {
    const insightElement = document.getElementById("insight");
    const pendingTasks = tasks.filter(t => !t.done);

    insightElement.innerHTML = "<p>🤖 Gemini is thinking...</p>";

    // Summarize tasks for AI context
    const taskDescriptions = pendingTasks.map(t =>
        `- ${t.name} (Impact: ${t.impact}/5, Effort: ${t.effort}/5, Category: ${t.category}, Deadline: ${t.deadline || 'None'})`
    ).join("\n");

    let prompt = "";
    if (customPrompt) {
        prompt = `I have the following tasks:\n${taskDescriptions}\n\nUser Question: "${customPrompt}"\nProvide a brief 1-2 sentence response.`;
    } else {
        prompt = `I have the following tasks:\n${taskDescriptions}\n\nTell me in one short, motivating sentence which specific task I should focus on right now and why.`;
    }

    try {
        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: prompt })
        });

        const data = await response.json();

        // The Worker now sends { advice: "..." }
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

// Add event listener to input to handle Enter key
document.addEventListener("DOMContentLoaded", () => {
    const inputField = document.getElementById("geminiPrompt");
    if (inputField) {
        inputField.addEventListener("keypress", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                askGemini();
            }
        });
    }
});
