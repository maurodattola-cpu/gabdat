const formatDate = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "short",
  year: "numeric"
});

const state = {
  data: null,
  selectedClassId: null
};

const shortDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : formatDate.format(date);
};

const today = () => new Date().toISOString().slice(0, 10);

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Errore HTTP ${response.status}`);
  }
  return response.json();
}

function currentClass() {
  return state.data.classes.find((schoolClass) => schoolClass.id === state.selectedClassId) || state.data.classes[0];
}

function currentClassStudents() {
  const schoolClass = currentClass();
  return state.data.students.filter((student) => student.classId === schoolClass?.id || student.className === schoolClass?.name);
}

function selectedStudent() {
  const select = document.querySelector("#studentSelect");
  return state.data.students.find((student) => student.id === select.value) || currentClassStudents()[0] || state.data.students[0];
}

function fillStudentForm(student) {
  if (!student) return;
  const form = document.querySelector("#studentForm");
  form.elements.studentId.value = student.id;
  form.elements.name.value = student.name;
  form.elements.classId.value = student.classId;
  form.elements.average.value = student.average;
}

function optionList(items, labelKey = "name") {
  return items.map((item) => `
    <option value="${escapeHtml(item.id)}">${escapeHtml(item[labelKey])}</option>
  `).join("");
}

function renderClassOptions() {
  const options = optionList(state.data.classes);
  ["#newStudentClassSelect", "#editStudentClassSelect"].forEach((selector) => {
    document.querySelector(selector).innerHTML = options;
  });
}

function renderStudentOptions() {
  const classStudents = currentClassStudents();
  const students = classStudents.length ? classStudents : state.data.students;
  const options = optionList(students);

  ["#studentSelect", "#attendanceStudentSelect", "#noteStudentSelect", "#reportStudentSelect"].forEach((selector) => {
    document.querySelector(selector).innerHTML = options;
  });
}

function renderClassTabs() {
  document.querySelector("#classTabs").innerHTML = state.data.classes.map((schoolClass) => `
    <button class="${schoolClass.id === state.selectedClassId ? "active" : ""}" type="button" data-class-id="${escapeHtml(schoolClass.id)}">
      <strong>${escapeHtml(schoolClass.name)}</strong>
      <span>${escapeHtml(schoolClass.schoolYear || "Anno scolastico")}</span>
    </button>
  `).join("");
}

function dailyRecord() {
  const date = document.querySelector("#dailyDate").value || today();
  return state.data.dailyAttendance.find((record) => record.classId === state.selectedClassId && record.date === date);
}

function renderClassStudentTable() {
  const record = dailyRecord();
  const savedRows = record?.rows || [];
  const rows = currentClassStudents().map((student) => {
    const saved = savedRows.find((row) => row.studentId === student.id);
    return `
      <tr data-student-id="${escapeHtml(student.id)}">
        <td>
          <strong>${escapeHtml(student.name)}</strong>
          <span>${escapeHtml(student.className)}</span>
        </td>
        <td>${escapeHtml(student.average || 0)}</td>
        <td>
          <select name="status">
            ${["Presente", "Assenza", "Ritardo", "Uscita anticipata"].map((status) => `
              <option ${status === (saved?.status || "Presente") ? "selected" : ""}>${status}</option>
            `).join("")}
          </select>
        </td>
        <td><input name="details" value="${escapeHtml(saved?.details || "")}" placeholder="Orario, motivo o nota"></td>
        <td>
          <div class="row-actions">
            <button class="dots-button" type="button" aria-label="Azioni per ${escapeHtml(student.name)}" data-menu-toggle="${escapeHtml(student.id)}">...</button>
            <div class="row-menu" data-menu="${escapeHtml(student.id)}">
              <button type="button" data-remove-student="${escapeHtml(student.id)}">Togli alunno</button>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  document.querySelector("#classStudentsTable").innerHTML = rows || `
    <tr>
      <td colspan="5">Nessun alunno in questa classe.</td>
    </tr>
  `;

  document.querySelector("#dailySaveMessage").textContent = record
    ? `Registro salvato per ${shortDate(record.date)}. Domani la tabella riparte vuota.`
    : "Registro non ancora salvato per questa data.";
}

function renderTeacherRegister() {
  document.querySelector("#teacherRegisterList").innerHTML = state.data.attendance.slice(0, 6).map((item) => `
    <article class="register-item">
      <span class="status-pill">${escapeHtml(item.type)}</span>
      <div>
        <strong>${escapeHtml(item.studentName)}</strong>
        <div class="meta">${escapeHtml(shortDate(item.date))} - ${escapeHtml(item.details || "")}</div>
      </div>
    </article>
  `).join("");
}

function renderReportCards() {
  document.querySelector("#reportCardsList").innerHTML = state.data.reportCards.slice(0, 6).map((card) => `
    <article class="report-card-row">
      <strong>${escapeHtml(card.studentName)}</strong>
      <span>${escapeHtml(card.term)} - ${escapeHtml(card.outcome)}</span>
      <div class="meta">${escapeHtml(card.subjects.map((subject) => `${subject.name}: ${subject.grade}`).join(" | "))}</div>
    </article>
  `).join("") || `<article class="report-card-row"><strong>Nessuna pagella</strong><span>Le pagelle salvate compariranno qui.</span></article>`;
}

function renderNotes(data) {
  document.querySelector("#notesList").innerHTML = data.notes.length ? data.notes.map((note) => `
    <article class="notice">
      <strong>${escapeHtml(note.studentName)} - ${escapeHtml(note.teacher)}</strong>
      <span>${escapeHtml(note.body)}</span>
      <span class="meta">${escapeHtml(shortDate(note.date))}</span>
    </article>
  `).join("") : `<article class="notice"><strong>Nessuna nota</strong><span>Non ci sono note registrate.</span></article>`;
}

function renderTeacherArea() {
  if (!state.selectedClassId) {
    state.selectedClassId = state.data.classes[0]?.id;
  }

  renderClassTabs();
  renderClassOptions();
  renderStudentOptions();
  fillStudentForm(selectedStudent());
  renderClassStudentTable();
  renderTeacherRegister();
  renderReportCards();
}

function renderDashboard(data) {
  const student = data.student;

  document.querySelector("#studentName").textContent = student.name.split(" ")[0];
  document.querySelector("#schoolYear").textContent = student.schoolYear;
  document.querySelector("#className").textContent = student.className;
  document.querySelector("#average").textContent = student.average;
  document.querySelector("#absences").textContent = student.absences;
  document.querySelector("#delays").textContent = student.delays;
  document.querySelector("#notesCount").textContent = student.notes || data.notes.length;

  document.querySelector("#gradesList").innerHTML = data.grades.map((grade) => `
    <article class="grade-row">
      <span class="grade-value">${escapeHtml(grade.value)}</span>
      <div>
        <strong>${escapeHtml(grade.subject)}</strong>
        <div class="meta">${escapeHtml(grade.type)} - ${escapeHtml(grade.teacher || "Docente")} - ${escapeHtml(shortDate(grade.date))}</div>
      </div>
      <span class="meta">${grade.value >= 6 ? "Positivo" : "Da recuperare"}</span>
    </article>
  `).join("");

  document.querySelector("#agendaList").innerHTML = data.agenda.map((item) => `
    <article class="timeline-item">
      <time>${escapeHtml(item.time)}</time>
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <div class="meta">${escapeHtml(item.room)}</div>
      </div>
    </article>
  `).join("");

  document.querySelector("#homeworkList").innerHTML = data.homework.map((item) => `
    <article class="task ${item.done ? "done" : ""}">
      <strong>${escapeHtml(item.subject)}</strong>
      <span>${escapeHtml(item.title)}</span>
      <span class="meta">Scadenza: ${escapeHtml(shortDate(item.dueDate))}</span>
    </article>
  `).join("");

  document.querySelector("#noticesList").innerHTML = data.notices.map((notice) => `
    <article class="notice">
      <strong>${escapeHtml(notice.title)}</strong>
      <span>${escapeHtml(notice.body)}</span>
      <span class="meta">Priorita: ${escapeHtml(notice.priority)}</span>
    </article>
  `).join("");

  renderTeacherArea();
  renderNotes(data);
}

async function loadDashboard() {
  const [status, dashboard] = await Promise.all([
    fetchJson("/api/status"),
    fetchJson("/api/dashboard")
  ]);

  state.data = dashboard;
  if (!state.selectedClassId || !dashboard.classes.some((item) => item.id === state.selectedClassId)) {
    state.selectedClassId = dashboard.classes[0]?.id;
  }

  document.querySelector("#dbStatus").textContent = status.database === "connected" ? "MongoDB connesso" : "Dati demo";
  document.querySelector("#dbMode").textContent = status.mode;
  renderDashboard(dashboard);
}

function setDefaultDates() {
  document.querySelector("#attendanceForm").elements.date.value = today();
  document.querySelector("#noteForm").elements.date.value = today();
  document.querySelector("#dailyDate").value = today();
}

document.querySelector("#classTabs").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-class-id]");
  if (!button) return;
  state.selectedClassId = button.dataset.classId;
  renderTeacherArea();
});

document.querySelectorAll("[data-open-panel]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector(`#${button.dataset.openPanel}`).classList.toggle("hidden");
  });
});

document.querySelector("#dailyDate").addEventListener("change", renderClassStudentTable);

document.querySelector("#classStudentsTable").addEventListener("click", async (event) => {
  const toggle = event.target.closest("[data-menu-toggle]");
  if (toggle) {
    const menu = document.querySelector(`[data-menu="${CSS.escape(toggle.dataset.menuToggle)}"]`);
    document.querySelectorAll(".row-menu.open").forEach((item) => {
      if (item !== menu) item.classList.remove("open");
    });
    menu?.classList.toggle("open");
    return;
  }

  const removeButton = event.target.closest("[data-remove-student]");
  if (!removeButton) return;

  const student = state.data.students.find((item) => item.id === removeButton.dataset.removeStudent);
  if (!student) return;

  const confirmed = window.confirm(`Togliere ${student.name} dalla classe?`);
  if (!confirmed) return;

  await fetchJson(`/api/students/${student.id}`, { method: "DELETE" });
  await loadDashboard();
});

document.addEventListener("click", (event) => {
  if (event.target.closest(".row-actions")) return;
  document.querySelectorAll(".row-menu.open").forEach((menu) => menu.classList.remove("open"));
});

document.querySelector("#studentSelect").addEventListener("change", () => {
  fillStudentForm(selectedStudent());
});

document.querySelector("#classCreator").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);

  const schoolClass = await fetchJson("/api/classes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: formData.get("name"),
      schoolYear: formData.get("schoolYear")
    })
  });

  state.selectedClassId = schoolClass.id;
  form.reset();
  await loadDashboard();
});

document.querySelector("#studentCreator").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);

  await fetchJson("/api/students", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: formData.get("name"),
      classId: formData.get("classId"),
      schoolYear: formData.get("schoolYear")
    })
  });

  form.reset();
  await loadDashboard();
});

document.querySelector("#studentForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const schoolClass = state.data.classes.find((item) => item.id === formData.get("classId"));

  await fetchJson(`/api/students/${formData.get("studentId")}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: formData.get("name"),
      classId: formData.get("classId"),
      className: schoolClass?.name || "",
      average: formData.get("average")
    })
  });

  await loadDashboard();
});

document.querySelector("#saveDailyAttendance").addEventListener("click", async () => {
  const rows = [...document.querySelectorAll("#classStudentsTable tr[data-student-id]")].map((row) => ({
    studentId: row.dataset.studentId,
    status: row.querySelector("[name='status']").value,
    details: row.querySelector("[name='details']").value
  }));

  await fetchJson("/api/daily-attendance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      classId: state.selectedClassId,
      date: document.querySelector("#dailyDate").value,
      rows
    })
  });

  await loadDashboard();
});

document.querySelector("#reportCardForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const subjects = ["Matematica", "Italiano", "Informatica", "Inglese"].map((name) => ({
    name,
    grade: formData.get(name)
  }));

  await fetchJson("/api/report-cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentId: formData.get("studentId"),
      term: formData.get("term"),
      conduct: formData.get("conduct"),
      outcome: formData.get("outcome"),
      subjects
    })
  });

  form.reset();
  await loadDashboard();
});

document.querySelector("#homeworkForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);

  await fetchJson("/api/homework", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: formData.get("subject"),
      title: formData.get("title"),
      dueDate: formData.get("dueDate")
    })
  });

  form.reset();
  await loadDashboard();
});

document.querySelector("#attendanceForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);

  await fetchJson("/api/attendance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentId: formData.get("studentId"),
      type: formData.get("type"),
      date: formData.get("date"),
      details: formData.get("details")
    })
  });

  form.reset();
  setDefaultDates();
  await loadDashboard();
});

document.querySelector("#noteForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);

  await fetchJson("/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentId: formData.get("studentId"),
      teacher: formData.get("teacher"),
      date: formData.get("date"),
      body: formData.get("body")
    })
  });

  form.reset();
  setDefaultDates();
  await loadDashboard();
});

document.querySelectorAll(".nav a").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".nav a").forEach((item) => item.classList.remove("active"));
    link.classList.add("active");
  });
});

setDefaultDates();
loadDashboard().catch((error) => {
  document.querySelector("#dbStatus").textContent = "Errore";
  document.querySelector("#dbMode").textContent = error.message;
});
