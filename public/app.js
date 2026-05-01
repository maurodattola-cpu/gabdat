const formatDate = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "short",
  year: "numeric"
});

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
    throw new Error(`Errore HTTP ${response.status}`);
  }
  return response.json();
}

function selectedStudent(data) {
  const select = document.querySelector("#studentSelect");
  return data.students.find((student) => student.id === select.value) || data.students[0];
}

function fillStudentForm(student) {
  const form = document.querySelector("#studentForm");
  form.elements.studentId.value = student.id;
  form.elements.name.value = student.name;
  form.elements.className.value = student.className;
  form.elements.average.value = student.average;
}

function renderStudentOptions(students) {
  const options = students.map((student) => `
    <option value="${escapeHtml(student.id)}">${escapeHtml(student.name)}</option>
  `).join("");

  ["#studentSelect", "#attendanceStudentSelect", "#noteStudentSelect"].forEach((selector) => {
    document.querySelector(selector).innerHTML = options;
  });
}

function renderTeacherArea(data) {
  renderStudentOptions(data.students);
  fillStudentForm(selectedStudent(data));

  document.querySelector("#teacherRegisterList").innerHTML = data.attendance.map((item) => `
    <article class="register-item">
      <span class="status-pill">${escapeHtml(item.type)}</span>
      <div>
        <strong>${escapeHtml(item.studentName)}</strong>
        <div class="meta">${escapeHtml(shortDate(item.date))} - ${escapeHtml(item.details || "")}</div>
      </div>
    </article>
  `).join("");

  document.querySelector("#notesList").innerHTML = data.notes.length ? data.notes.map((note) => `
    <article class="notice">
      <strong>${escapeHtml(note.studentName)} - ${escapeHtml(note.teacher)}</strong>
      <span>${escapeHtml(note.body)}</span>
      <span class="meta">${escapeHtml(shortDate(note.date))}</span>
    </article>
  `).join("") : `<article class="notice"><strong>Nessuna nota</strong><span>Non ci sono note registrate.</span></article>`;
}

function renderDashboard(data) {
  const openHomework = data.homework.filter((item) => !item.done).length;

  document.querySelector("#studentName").textContent = data.student.name.split(" ")[0];
  document.querySelector("#schoolYear").textContent = data.student.schoolYear;
  document.querySelector("#className").textContent = data.student.className;
  document.querySelector("#average").textContent = data.student.average;
  document.querySelector("#absences").textContent = data.student.absences;
  document.querySelector("#delays").textContent = data.student.delays;
  document.querySelector("#notesCount").textContent = data.student.notes || data.notes.length;

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

  renderTeacherArea(data);
}

async function loadDashboard() {
  const [status, dashboard] = await Promise.all([
    fetchJson("/api/status"),
    fetchJson("/api/dashboard")
  ]);

  document.querySelector("#dbStatus").textContent = status.database === "connected" ? "MongoDB connesso" : "Dati demo";
  document.querySelector("#dbMode").textContent = status.mode;
  renderDashboard(dashboard);
}

function setDefaultDates() {
  document.querySelector("#attendanceForm").elements.date.value = today();
  document.querySelector("#noteForm").elements.date.value = today();
}

document.querySelector("#studentSelect").addEventListener("change", async (event) => {
  const dashboard = await fetchJson("/api/dashboard");
  const student = dashboard.students.find((item) => item.id === event.currentTarget.value);
  if (student) fillStudentForm(student);
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

document.querySelector("#studentForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);

  await fetchJson(`/api/students/${formData.get("studentId")}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: formData.get("name"),
      className: formData.get("className"),
      average: formData.get("average")
    })
  });

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
