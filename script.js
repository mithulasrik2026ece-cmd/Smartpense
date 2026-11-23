
document.addEventListener("DOMContentLoaded", () => {
    const $ = id => document.getElementById(id);
    const KEY = "spendwise_data_v2";

    let data = {
        transactions: [],
        budgets: [],
        goals: []
    };

    try {
        const saved = JSON.parse(localStorage.getItem(KEY));
        if (saved) {
            data.transactions = Array.isArray(saved.transactions) ? saved.transactions : [];
            data.budgets = Array.isArray(saved.budgets) ? saved.budgets : [];
            data.goals = Array.isArray(saved.goals) ? saved.goals : [];
        }
    } catch (error) {
        console.error("Storage error:", error);
    }

    let cashChart = null;
    let categoryChart = null;

    const money = n => new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    }).format(Number(n) || 0);

    const today = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };

    const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;",
        '"': "&quot;", "'": "&#39;"
    })[c]);

    function save() {
        localStorage.setItem(KEY, JSON.stringify(data));
    }

    function monthTransactions() {
        return data.transactions.filter(t => t.date.startsWith(today().slice(0, 7)));
    }

    function sum(items) {
        return items.reduce((total, item) => total + Number(item.amount), 0);
    }

    // DATE
    $("todayDate").textContent = new Date().toLocaleDateString("en-IN", {
        day: "numeric", month: "long", year: "numeric"
    });
    $("transactionDate").value = today();

    // MODALS
    function openModal(id) {
        $(id).classList.add("active");
    }

    function closeModal(id) {
        $(id).classList.remove("active");
    }

    $("addTransactionBtn").onclick = () => openModal("transactionModal");
    $("addBudgetBtn").onclick = () => openModal("budgetModal");
    $("addGoalBtn").onclick = () => openModal("goalModal");

    document.querySelectorAll("[data-close]").forEach(button => {
        button.addEventListener("click", () => closeModal(button.dataset.close));
    });

    document.querySelectorAll(".modal").forEach(modal => {
        modal.addEventListener("click", event => {
            if (event.target === modal) closeModal(modal.id);
        });
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            document.querySelectorAll(".modal.active").forEach(modal => closeModal(modal.id));
        }
    });

    // NAVIGATION
    document.querySelectorAll(".nav-link").forEach(link => {
        link.addEventListener("click", () => {
            document.querySelectorAll(".nav-link").forEach(item => item.classList.remove("active"));
            link.classList.add("active");
        });
    });

    // TRANSACTIONS
    $("transactionForm").addEventListener("submit", event => {
        event.preventDefault();

        const title = $("transactionTitle").value.trim();
        const amount = Number($("transactionAmount").value);
        const date = $("transactionDate").value;

        if (!title || !Number.isFinite(amount) || amount <= 0 || !date) {
            alert("Enter valid transaction details.");
            return;
        }

        data.transactions.push({
            id: crypto.randomUUID(),
            title,
            amount,
            date,
            type: $("transactionType").value,
            category: $("transactionCategory").value
        });

        save();
        refresh();
        $("transactionForm").reset();
        $("transactionDate").value = today();
        closeModal("transactionModal");
    });

    function renderTransactions() {
        const search = $("searchTransaction").value.toLowerCase();
        const filter = $("filterTransaction").value;

        const items = [...data.transactions]
            .filter(t => {
                const matchesText =
                    t.title.toLowerCase().includes(search) ||
                    t.category.toLowerCase().includes(search);

                return matchesText && (filter === "all" || t.type === filter);
            })
            .sort((a, b) => b.date.localeCompare(a.date));

        $("transactionList").innerHTML = items.length
            ? items.map(t => `
                <div class="transaction-item">
                    <div class="transaction-info">
                        <div class="transaction-avatar">${t.type === "income" ? "↗" : "↘"}</div>
                        <div>
                            <strong>${escapeHTML(t.title)}</strong>
                            <small>${escapeHTML(t.category)} · ${escapeHTML(t.date)}</small>
                        </div>
                    </div>
                    <div class="transaction-right">
                        <strong class="${t.type === "income" ? "income-text" : "expense-text"}">
                            ${t.type === "income" ? "+" : "-"}${money(t.amount)}
                        </strong>
                        <button class="delete-btn" data-delete-transaction="${t.id}">×</button>
                    </div>
                </div>
            `).join("")
            : `<div class="empty-state"><p>No transactions found.</p><small>Add a transaction to get started.</small></div>`;
    }

    $("searchTransaction").addEventListener("input", renderTransactions);
    $("filterTransaction").addEventListener("change", renderTransactions);

    $("transactionList").addEventListener("click", event => {
        const button = event.target.closest("[data-delete-transaction]");
        if (!button) return;

        if (confirm("Delete this transaction?")) {
            data.transactions = data.transactions.filter(t => t.id !== button.dataset.deleteTransaction);
            save();
            refresh();
        }
    });

    // BUDGETS
    $("budgetForm").addEventListener("submit", event => {
        event.preventDefault();

        const category = $("budgetCategory").value.trim();
        const amount = Number($("budgetAmount").value);

        if (!category || !Number.isFinite(amount) || amount <= 0) {
            alert("Enter a valid budget.");
            return;
        }

        data.budgets.push({
            id: crypto.randomUUID(),
            category,
            amount
        });

        save();
        refresh();
        $("budgetForm").reset();
        closeModal("budgetModal");
    });

    function renderBudgets() {
        const list = $("budgetList");

        list.innerHTML = data.budgets.length
            ? data.budgets.map(b => {
                const spent = sum(monthTransactions().filter(t =>
                    t.type === "expense" &&
                    t.category.toLowerCase() === b.category.toLowerCase()
                ));

                const percent = Math.min(100, spent / b.amount * 100);

                return `
                    <div class="budget-item">
                        <div class="budget-top">
                            <strong>${escapeHTML(b.category)}</strong>
                            <button class="delete-btn" data-delete-budget="${b.id}">×</button>
                        </div>
                        <div class="budget-values">
                            <span>${money(spent)} spent</span>
                            <span>${money(b.amount)} limit</span>
                        </div>
                        <div class="progress-track">
                            <div class="progress-fill" style="width:${percent}%"></div>
                        </div>
                        <small>${Math.round(percent)}% used</small>
                    </div>`;
            }).join("")
            : `<div class="empty-state"><p>No budgets yet.</p><small>Click Add to create one.</small></div>`;
    }

    $("budgetList").addEventListener("click", event => {
        const button = event.target.closest("[data-delete-budget]");
        if (!button) return;

        if (confirm("Delete this budget?")) {
            data.budgets = data.budgets.filter(b => b.id !== button.dataset.deleteBudget);
            save();
            refresh();
        }
    });

    // SAVINGS GOALS
    $("goalForm").addEventListener("submit", event => {
        event.preventDefault();

        const name = $("goalName").value.trim();
        const target = Number($("goalTarget").value);
        const saved = Number($("goalSaved").value);

        if (!name || !Number.isFinite(target) || target <= 0 ||
            !Number.isFinite(saved) || saved < 0 || saved > target) {
            alert("Enter valid goal details. Saved amount cannot exceed the target.");
            return;
        }

        data.goals.push({
            id: crypto.randomUUID(),
            name,
            target,
            saved
        });

        save();
        refresh();
        $("goalForm").reset();
        closeModal("goalModal");
    });

    function renderGoals() {
        $("goalsList").innerHTML = data.goals.length
            ? data.goals.map(g => {
                const percent = Math.min(100, g.saved / g.target * 100);

                return `
                    <div class="goal-item">
                        <div class="goal-top">
                            <strong>🎯 ${escapeHTML(g.name)}</strong>
                            <button class="delete-btn" data-delete-goal="${g.id}">×</button>
                        </div>
                        <div class="goal-values">
                            <span>${money(g.saved)} saved</span>
                            <span>${money(g.target)} goal</span>
                        </div>
                        <div class="progress-track">
                            <div class="goal-progress" style="width:${percent}%"></div>
                        </div>
                        <small>${Math.round(percent)}% completed</small>
                    </div>`;
            }).join("")
            : `<div class="empty-state"><p>No savings goals yet.</p><small>Create your first goal.</small></div>`;
    }

    $("goalsList").addEventListener("click", event => {
        const button = event.target.closest("[data-delete-goal]");
        if (!button) return;

        if (confirm("Delete this savings goal?")) {
            data.goals = data.goals.filter(g => g.id !== button.dataset.deleteGoal);
            save();
            refresh();
        }
    });

    // SMART INSIGHTS
    function renderInsights() {
        const expenses = monthTransactions().filter(t => t.type === "expense");
        const total = sum(expenses);
        const categories = {};

        expenses.forEach(t => {
            categories[t.category] = (categories[t.category] || 0) + Number(t.amount);
        });

        const highest = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
        const budget = sum(data.budgets);

        const insights = [];

        if (!expenses.length) {
            insights.push(["💡", "Start tracking", "Add expenses to receive spending insights."]);
        } else {
            insights.push(["📊", "Monthly spending", `You spent ${money(total)} this month.`]);

            if (highest) {
                insights.push(["🔎", "Top category", `${highest[0]} is your highest spending category: ${money(highest[1])}.`]);
            }

            if (budget > 0) {
                insights.push([
                    total > budget ? "⚠️" : "✅",
                    "Budget status",
                    total > budget
                        ? `You are ${money(total - budget)} over your combined budget.`
                        : `You have ${money(budget - total)} remaining in your combined budget.`
                ]);
            }
        }

        $("insightsList").innerHTML = insights.map(i => `
            <div class="insight-item">
                <span class="insight-icon">${i[0]}</span>
                <div><strong>${escapeHTML(i[1])}</strong><p>${escapeHTML(i[2])}</p></div>
            </div>
        `).join("");
    }

    // CHARTS
    function renderCharts() {
        if (typeof Chart === "undefined") {
            console.warn("Chart.js unavailable. Check your internet connection.");
            return;
        }

        const monthly = monthTransactions();
        const income = sum(monthly.filter(t => t.type === "income"));
        const expenses = sum(monthly.filter(t => t.type === "expense"));

        if (cashChart) cashChart.destroy();

        cashChart = new Chart($("cashFlowChart"), {
            type: "bar",
            data: {
                labels: ["Income", "Expenses"],
                datasets: [{
                    data: [income, expenses],
                    backgroundColor: ["#22c55e", "#8b5cf6"],
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: value => "₹" + value }
                    }
                }
            }
        });

        const categories = {};

        monthly.filter(t => t.type === "expense").forEach(t => {
            categories[t.category] = (categories[t.category] || 0) + Number(t.amount);
        });

        const labels = Object.keys(categories);
        const values = Object.values(categories);

        if (categoryChart) categoryChart.destroy();

        categoryChart = new Chart($("categoryChart"), {
            type: "doughnut",
            data: {
                labels: labels.length ? labels : ["No expenses"],
                datasets: [{
                    data: values.length ? values : [1],
                    backgroundColor: [
                        "#8b5cf6", "#22c55e", "#f59e0b",
                        "#3b82f6", "#ec4899", "#06b6d4",
                        "#f97316", "#64748b"
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "70%",
                plugins: { legend: { display: false } }
            }
        });

        $("categoryLegend").innerHTML = labels.length
            ? labels.map((label, index) => `
                <div class="legend-item">
                    <span>${escapeHTML(label)}</span>
                    <strong>${money(values[index])}</strong>
                </div>
            `).join("")
            : "<p>No expense data yet.</p>";
    }

    // MONEY BUDDY
    function buddyReply(message) {
        const q = message.toLowerCase();
        const monthly = monthTransactions();

        const income = sum(monthly.filter(t => t.type === "income"));
        const expenses = sum(monthly.filter(t => t.type === "expense"));

        if (q.includes("balance")) {
            const allIncome = sum(data.transactions.filter(t => t.type === "income"));
            const allExpenses = sum(data.transactions.filter(t => t.type === "expense"));
            return `Your recorded balance is ${money(allIncome - allExpenses)}.`;
        }

        if (q.includes("expense") || q.includes("spent")) {
            return `You spent ${money(expenses)} this month.`;
        }

        if (q.includes("income") || q.includes("earn")) {
            return `Your income this month is ${money(income)}.`;
        }

        if (q.includes("budget")) {
            return `Your total budget is ${money(sum(data.budgets))}. Your monthly expenses are ${money(expenses)}.`;
        }

        if (q.includes("saving") || q.includes("goal")) {
            if (!data.goals.length) return "You have not created any savings goals yet.";

            return data.goals.map(g =>
                `${g.name}: ${money(g.saved)} saved out of ${money(g.target)}.`
            ).join(" ");
        }

        if (q.includes("hello") || q.includes("hi")) {
            return "Hello! Ask me about your balance, expenses, income, budgets or savings goals.";
        }

        return "Try asking: How much did I spend? What is my balance? How much is my budget?";
    }

    function chatMessage(message, sender) {
        const bubble = document.createElement("div");
        bubble.className = sender === "user" ? "user-message" : "bot-message";
        bubble.textContent = message;
        $("chatMessages").appendChild(bubble);
        $("chatMessages").scrollTop = $("chatMessages").scrollHeight;
    }

    $("chatForm").addEventListener("submit", event => {
        event.preventDefault();

        const input = $("chatInput");
        const message = input.value.trim();

        if (!message) return;

        chatMessage(message, "user");
        input.value = "";
        chatMessage(buddyReply(message), "bot");
    });

    // UPDATE DASHBOARD
    function refresh() {
        const monthly = monthTransactions();

        const income = sum(monthly.filter(t => t.type === "income"));
        const expenses = sum(monthly.filter(t => t.type === "expense"));

        const allIncome = sum(data.transactions.filter(t => t.type === "income"));
        const allExpenses = sum(data.transactions.filter(t => t.type === "expense"));

        $("totalBalance").textContent = money(allIncome - allExpenses);
        $("totalIncome").textContent = money(income);
        $("totalExpense").textContent = money(expenses);
        $("budgetRemaining").textContent = money(sum(data.budgets) - expenses);

        renderTransactions();
        renderBudgets();
        renderGoals();
        renderInsights();
        renderCharts();
    }

    // START
    refresh();

    console.log("SpendWise is running successfully!");
});
