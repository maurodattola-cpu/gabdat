const formatDate = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "short",
  year: "numeric"
});

const state = {
  data: null,
  selectedClassId: null,
  selectedStudentId: null,
  selectedTeacherId: localStorage.getItem("gabdat-teacher-id") || "",
  username: localStorage.getItem("gabdat-username") || ""
};

let deferredInstallPrompt = null;

const shortDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : formatDate.format(date);
};

const today = () => new Date().toISOString().slice(0, 10);

const dayLabels = {
  Lunedi: "Lunedì",
  Martedi: "Martedì",
  Mercoledi: "Mercoledì",
  Giovedi: "Giovedì",
  Venerdi: "Venerdì",
  Sabato: "Sabato",
  Domenica: "Domenica"
};

const displayDay = (value) => dayLabels[value] || value;

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const gradeOutcome = (value) => {
  const numericValue = Number.parseFloat(value);
  if (!Number.isFinite(numericValue)) return "Senza voto";
  return numericValue >= 6 ? "Positivo" : "Da recuperare";
};

const gradeValueClass = (value) => {
  const numericValue = Number.parseFloat(value);
  return Number.isFinite(numericValue) && numericValue < 6 ? "grade-value insufficient" : "grade-value";
};

const attendanceStatusClass = (type) => {
  const normalized = String(type || "").toLowerCase();
  if (normalized.includes("presenza")) return "status-pill status-present";
  if (normalized.includes("assenza")) return "status-pill status-absence";
  if (normalized.includes("ritardo")) return "status-pill status-delay";
  return "status-pill status-exit";
};

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Errore HTTP ${response.status}`);
  }
  return response.json();
}

function currentClass() {
  const classes = currentTeacherClasses();
  return classes.find((schoolClass) => schoolClass.id === state.selectedClassId) || classes[0] || null;
}

function currentTeacherClasses() {
  const classes = state.data?.classes || [];
  if (!state.selectedTeacherId) return classes;
  const firstTeacherId = teacherList()[0]?.id;
  return classes.filter((schoolClass) => (
    schoolClass.teacherId === state.selectedTeacherId ||
    (!schoolClass.teacherId && state.selectedTeacherId === firstTeacherId)
  ));
}

function currentClassStudents() {
  const schoolClass = currentClass();
  return state.data.students.filter((student) => student.classId === schoolClass?.id || student.className === schoolClass?.name);
}

function selectedStudent() {
  const select = document.querySelector("#studentSelect");
  return state.data.students.find((student) => student.id === select.value) || currentClassStudents()[0] || null;
}

function selectedStudentView() {
  return state.data.students.find((student) => student.id === state.selectedStudentId) || state.data.students[0];
}

function fillStudentForm(student) {
  const form = document.querySelector("#studentForm");
  if (!student) {
    form.reset();
    return;
  }
  form.elements.studentId.value = student.id;
  form.elements.name.value = student.name;
  form.elements.classId.value = student.classId;
  form.elements.average.value = student.average;
}

function fillScheduleForm(schedule) {
  if (!schedule) return;
  const form = document.querySelector("#scheduleForm");
  form.classList.remove("hidden");
  form.elements.scheduleId.value = schedule.id;
  form.elements.day.value = schedule.day;
  form.elements.time.value = schedule.time;
  form.elements.endTime.value = schedule.endTime || "";
  form.elements.subject.value = schedule.subject;
  form.elements.room.value = schedule.room || "";
  form.elements.teacher.value = schedule.teacher || "";
  form.querySelector("button[type='submit']").textContent = "Salva lezione";
}

function resetScheduleForm() {
  const form = document.querySelector("#scheduleForm");
  form.reset();
  form.elements.scheduleId.value = "";
  form.elements.time.value = "08:00";
  form.elements.endTime.value = "09:00";
  form.querySelector("button[type='submit']").textContent = "Aggiungi all'orario";
}

function reportSubjectRow(subject = "", grade = "") {
  return `
    <div class="subject-row">
      <label>
        Materia
        <input name="subjectName" placeholder="Materia" value="${escapeHtml(subject)}" required>
      </label>
      <label>
        Voto
        <input name="subjectGrade" type="number" min="1" max="10" step="0.5" placeholder="8" value="${escapeHtml(grade)}" required>
      </label>
      <button type="button" data-remove-report-subject>Elimina</button>
    </div>
  `;
}

function addReportSubject(subject = "", grade = "") {
  document.querySelector("#reportSubjects").insertAdjacentHTML("beforeend", reportSubjectRow(subject, grade));
}

function resetReportSubjects() {
  const container = document.querySelector("#reportSubjects");
  container.innerHTML = "";
  addReportSubject();
}

function optionList(items, labelKey = "name") {
  return items.map((item) => `
    <option value="${escapeHtml(item.id)}">${escapeHtml(item[labelKey])}</option>
  `).join("");
}

function teacherList() {
  const teachers = state.data?.teachers || [];
  if (teachers.length) return teachers;
  return [
    { id: "teacher-1", name: "Insegnante principale", subject: "" }
  ];
}

function renderClassOptions() {
  const classes = currentTeacherClasses();
  const options = optionList(classes);
  ["#newStudentClassSelect", "#editStudentClassSelect"].forEach((selector) => {
    document.querySelector(selector).innerHTML = options;
  });
}

function renderTeacherOptions() {
  const teachers = teacherList();
  document.querySelector("#teacherSelect").innerHTML = optionList(teachers);
  document.querySelector("#teacherSelect").value = state.selectedTeacherId || teachers[0]?.id || "";
}

function renderClassTeacherOptions() {
  const options = optionList(teacherList());
  ["#newClassTeacherSelect", "#editClassTeacherSelect"].forEach((selector) => {
    document.querySelector(selector).innerHTML = options;
    document.querySelector(selector).value = state.selectedTeacherId || teacherList()[0]?.id || "";
  });
}

function renderStudentOptions() {
  const classStudents = currentClassStudents();
  const students = classStudents.length ? classStudents : state.data.students;
  const options = optionList(students);

  ["#studentSelect", "#attendanceStudentSelect", "#reportStudentSelect", "#gradeStudentSelect"].forEach((selector) => {
    document.querySelector(selector).innerHTML = options;
  });

  const schoolClass = currentClass();
  document.querySelector("#noteRecipientSelect").innerHTML = [
    ...students.map((student) => `
      <option value="student:${escapeHtml(student.id)}">${escapeHtml(student.name)}</option>
    `),
    schoolClass ? `<option value="class:${escapeHtml(schoolClass.id)}">CLASSE</option>` : ""
  ].join("");
}

function renderStudentViewOptions() {
  document.querySelector("#studentViewSelect").innerHTML = optionList(state.data.students);
  document.querySelector("#studentViewSelect").value = selectedStudentView()?.id || "";
}

function renderClassTabs() {
  const classes = currentTeacherClasses();
  document.querySelector("#classTabs").innerHTML = classes.map((schoolClass) => `
    <article class="class-tab ${schoolClass.id === state.selectedClassId ? "active" : ""}">
      <button class="class-tab-main" type="button" data-class-id="${escapeHtml(schoolClass.id)}">
        <strong>${escapeHtml(schoolClass.name)}</strong>
        <span>${escapeHtml(schoolClass.schoolYear || "Anno scolastico")}</span>
      </button>
      <div class="row-actions">
        <button class="dots-button" type="button" aria-label="Azioni per ${escapeHtml(schoolClass.name)}" data-class-menu-toggle="${escapeHtml(schoolClass.id)}">...</button>
        <div class="row-menu" data-class-menu="${escapeHtml(schoolClass.id)}">
          <button class="neutral-menu-action" type="button" data-edit-class="${escapeHtml(schoolClass.id)}">Modifica classe</button>
          <button type="button" data-remove-class="${escapeHtml(schoolClass.id)}">Elimina classe</button>
        </div>
      </div>
    </article>
  `).join("") || `<article class="notice"><strong>Nessuna classe</strong><span>Aggiungi una classe per questo insegnante.</span></article>`;
}

function dailyRecord() {
  const date = document.querySelector("#dailyDate").value || today();
  return state.data.dailyAttendance.find((record) => record.classId === state.selectedClassId && record.date === date);
}

function dayNameFromDate(value) {
  const date = new Date(`${value || today()}T00:00:00`);
  const days = ["Domenica", "Lunedi", "Martedi", "Mercoledi", "Giovedi", "Venerdi", "Sabato"];
  return days[date.getDay()];
}

function currentDateClassSchedules() {
  const date = document.querySelector("#dailyDate").value || today();
  const dayName = dayNameFromDate(date);
  return (state.data.schedules || [])
    .filter((item) => item.classId === state.selectedClassId && item.day === dayName)
    .sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));
}

function minutesFromTime(value) {
  const [hours, minutes] = String(value || "00:00").split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function currentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function hasLessonStarted(lesson) {
  const date = document.querySelector("#dailyDate").value || today();
  if (!lesson || date > today()) return false;
  if (date < today()) return true;
  return currentMinutes() >= minutesFromTime(lesson.time);
}

function activeLesson(lessons) {
  const now = currentMinutes();
  return lessons.find((lesson) => {
    const start = minutesFromTime(lesson.time);
    const end = lesson.endTime ? minutesFromTime(lesson.endTime) : start + 60;
    return now >= start && now < end;
  });
}

function selectedLesson() {
  const select = document.querySelector("#dailyLesson");
  return (state.data.schedules || []).find((item) => item.id === select.value);
}

function isSelectedLastLesson() {
  const lessons = currentDateClassSchedules();
  const lesson = selectedLesson();
  return Boolean(lesson && lessons.length && lessons[lessons.length - 1].id === lesson.id);
}

function lessonRecord() {
  const date = document.querySelector("#dailyDate").value || today();
  const lesson = selectedLesson();
  if (!lesson) return null;
  return (state.data.lessonAttendance || []).find((record) => (
    record.classId === state.selectedClassId &&
    record.date === date &&
    record.scheduleId === lesson.id
  ));
}

function renderDailyLessonOptions() {
  const select = document.querySelector("#dailyLesson");
  const saveLessonButton = document.querySelector("#saveLessonAttendance");
  const currentValue = select.value;
  const lessons = currentDateClassSchedules();
  const liveLesson = (document.querySelector("#dailyDate").value || today()) === today() ? activeLesson(lessons) : null;
  select.innerHTML = lessons.map((lesson) => `
    <option value="${escapeHtml(lesson.id)}">${escapeHtml(lesson.time)} ${escapeHtml(lesson.subject)}</option>
  `).join("") || `<option value="">Nessuna lezione</option>`;
  select.value = liveLesson?.id || (lessons.some((lesson) => lesson.id === currentValue) ? currentValue : lessons[0]?.id || "");
  select.disabled = lessons.length === 0;
  saveLessonButton.disabled = !hasLessonStarted(selectedLesson());
}

function currentClassDailyRecords() {
  const dailyRecords = (state.data.dailyAttendance || [])
    .filter((record) => record.classId === state.selectedClassId)
    .map((record) => ({ date: record.date }));
  const lessonRecords = (state.data.lessonAttendance || [])
    .filter((record) => record.classId === state.selectedClassId)
    .map((record) => ({ date: record.date }));
  const dates = [...dailyRecords, ...lessonRecords]
    .filter((record) => record.date)
    .filter((record, index, records) => records.findIndex((item) => item.date === record.date) === index);
  return dates.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

function renderSavedDailyDates() {
  const date = document.querySelector("#dailyDate").value || today();
  const records = currentClassDailyRecords();
  const options = records.map((record) => `
    <option value="${escapeHtml(record.date)}">${escapeHtml(shortDate(record.date))}</option>
  `).join("");
  const select = document.querySelector("#savedDailyDate");
  const deleteButton = document.querySelector("#deleteSavedDay");
  select.innerHTML = `<option value="">Giornate salvate</option>${options}`;
  select.value = records.some((record) => record.date === date) ? date : "";
  deleteButton.disabled = !select.value;
}

function renderClassStudentTable() {
  renderDailyLessonOptions();
  const record = lessonRecord() || dailyRecord();
  const savedRows = record?.rows || [];
  renderSavedDailyDates();
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
    ? `Registro ${record.scheduleId ? "della lezione" : "della giornata"} salvato per ${shortDate(record.date)}. Puoi riaprirlo, modificarlo e salvarlo di nuovo.`
    : selectedLesson()
      ? hasLessonStarted(selectedLesson())
        ? "Registro non ancora salvato per questa lezione."
        : `La lezione si attivera alle ${selectedLesson().time}.`
      : "Nessuna lezione per questa data: puoi salvare comunque con Salva giornata oppure aggiungere una lezione dall'orario.";
}

function renderTeacherRegister() {
  document.querySelector("#teacherRegisterList").innerHTML = state.data.attendance.slice(0, 6).map((item) => `
    <article class="register-item">
      <span class="${attendanceStatusClass(item.type)}">${escapeHtml(item.type)}</span>
      <div>
        <strong>${escapeHtml(item.studentName)}</strong>
        <div class="meta">${escapeHtml(shortDate(item.date))} - ${escapeHtml(item.details || "")}</div>
      </div>
      <div class="inline-actions">
        <button type="button" data-remove-attendance="${escapeHtml(item.id)}">Elimina</button>
      </div>
    </article>
  `).join("") || `<article class="notice"><strong>Nessun registro</strong><span>Le voci recenti compariranno qui.</span></article>`;
}

function renderTeacherGrades() {
  document.querySelector("#teacherGradesList").innerHTML = state.data.grades.slice(0, 8).map((grade) => `
    <article class="grade-row">
      <span class="${gradeValueClass(grade.value)}">${escapeHtml(grade.value)}</span>
      <div>
        <strong>${escapeHtml(grade.studentName || "Studente")} - ${escapeHtml(grade.subject)}</strong>
        <div class="meta">${escapeHtml(grade.type)} - ${escapeHtml(grade.teacher || "Docente")} - ${escapeHtml(shortDate(grade.date))}</div>
        ${grade.explanation ? `<div class="meta">${escapeHtml(grade.explanation)}</div>` : ""}
      </div>
      <div class="row-actions">
        <button class="dots-button" type="button" aria-label="Azioni voto" data-grade-menu-toggle="${escapeHtml(grade.id)}">...</button>
        <div class="row-menu" data-grade-menu="${escapeHtml(grade.id)}">
          <button class="neutral-menu-action" type="button" data-edit-grade="${escapeHtml(grade.id)}">Modifica voto</button>
          <button type="button" data-remove-grade="${escapeHtml(grade.id)}">Elimina voto</button>
        </div>
      </div>
    </article>
  `).join("");
}

function renderTeacherEarlyExits() {
  const exits = state.data.earlyExits || [];
  document.querySelector("#teacherEarlyExitsList").innerHTML = exits.map((item) => `
    <article class="notice">
      <strong>${escapeHtml(item.studentName)} - ${escapeHtml(item.className)}</strong>
      <span>${escapeHtml(shortDate(item.date))} alle ${escapeHtml(item.time)} - ${escapeHtml(item.reason)}</span>
      <span class="meta">${escapeHtml(item.status || "Programmato")}</span>
    </article>
  `).join("") || `<article class="notice"><strong>Nessuna uscita</strong><span>Le uscite programmate dagli studenti compariranno qui.</span></article>`;
}

function renderTeacherJustifications() {
  const schoolClass = currentClass();
  const justifications = (state.data.justifications || [])
    .filter((item) => item.classId === schoolClass?.id || item.className === schoolClass?.name)
    .sort((a, b) => String(b.createdAt || b.date || "").localeCompare(String(a.createdAt || a.date || "")));

  document.querySelector("#teacherJustificationsList").innerHTML = justifications.map((item) => `
    <article class="notice">
      <strong>${escapeHtml(item.studentName)} - ${escapeHtml(item.type)}</strong>
      <span>${escapeHtml(shortDate(item.date))}${item.time ? ` alle ${escapeHtml(item.time)}` : ""} - ${escapeHtml(item.reason)}</span>
      <span class="meta">${escapeHtml(item.className)} - ${escapeHtml(item.status || "Inviata")}</span>
    </article>
  `).join("") || `<article class="notice"><strong>Nessuna giustificazione</strong><span>Le giustificazioni inviate dagli studenti compariranno qui.</span></article>`;
}

function renderTeacherNotices() {
  const notices = [...(state.data.notices || [])]
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  document.querySelector("#teacherNoticesList").innerHTML = notices.map((notice) => `
    <article class="notice">
      <strong>${escapeHtml(notice.title)}</strong>
      <span>${escapeHtml(notice.body)}</span>
      <span class="meta">Priorità: ${escapeHtml(notice.priority || "Media")}</span>
      <div class="inline-actions">
        <button type="button" data-edit-notice="${escapeHtml(noticeId(notice))}">Modifica</button>
        <button type="button" data-remove-notice="${escapeHtml(noticeId(notice))}">Elimina</button>
      </div>
    </article>
  `).join("") || `<article class="notice"><strong>Nessuna comunicazione</strong><span>Le comunicazioni pubblicate compariranno qui.</span></article>`;
}

function renderTeacherHomework() {
  const homework = [...(state.data.homework || [])]
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  document.querySelector("#teacherHomeworkList").innerHTML = homework.map((item) => `
    <article class="task">
      <strong>${escapeHtml(item.subject)}</strong>
      <span>${escapeHtml(item.title)}</span>
      <span class="meta">Scadenza: ${escapeHtml(shortDate(item.dueDate))}</span>
      ${item.attachmentData ? `<a class="attachment-link" href="${escapeHtml(item.attachmentData)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.attachmentName || "Apri allegato")}</a>` : ""}
      <div class="inline-actions">
        <button type="button" data-edit-homework="${escapeHtml(homeworkId(item))}">Modifica</button>
        <button type="button" data-remove-homework="${escapeHtml(homeworkId(item))}">Elimina</button>
      </div>
    </article>
  `).join("") || `<article class="notice"><strong>Nessun compito</strong><span>I compiti pubblicati compariranno qui.</span></article>`;
}

function renderTeacherClasswork() {
  const schoolClass = currentClass();
  const classwork = [...(state.data.classwork || [])]
    .filter((item) => item.classId === schoolClass?.id || item.className === schoolClass?.name)
    .sort((a, b) => String(b.date || b.createdAt || "").localeCompare(String(a.date || a.createdAt || "")));
  document.querySelector("#teacherClassworkList").innerHTML = classwork.map((item) => `
    <article class="notice">
      <strong>${escapeHtml(item.subject)}</strong>
      <span>${escapeHtml(item.body)}</span>
      <span class="meta">${escapeHtml(shortDate(item.date))}${item.teacher ? ` - ${escapeHtml(item.teacher)}` : ""}</span>
      ${item.attachmentData ? `<a class="attachment-link" href="${escapeHtml(item.attachmentData)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.attachmentName || "Apri allegato")}</a>` : ""}
      <div class="inline-actions">
        <button type="button" data-edit-classwork="${escapeHtml(classworkId(item))}">Modifica</button>
        <button type="button" data-remove-classwork="${escapeHtml(classworkId(item))}">Elimina</button>
      </div>
    </article>
  `).join("") || `<article class="notice"><strong>Nessuno svolto</strong><span>Lo svolto pubblicato per questa classe comparirà qui.</span></article>`;
}

function renderTeacherNotes() {
  const schoolClass = currentClass();
  const classStudentIds = new Set(currentClassStudents().map((student) => student.id));
  const notes = [...(state.data.notes || [])]
    .filter((note) => note.classId === schoolClass?.id || classStudentIds.has(note.studentId))
    .sort((a, b) => String(b.date || b.createdAt || "").localeCompare(String(a.date || a.createdAt || "")));

  document.querySelector("#teacherNotesList").innerHTML = notes.map((note) => `
    <article class="notice">
      <strong>${escapeHtml(note.studentName || note.className || "Classe")} - ${escapeHtml(note.teacher || "Docente")}</strong>
      <span>${escapeHtml(note.body)}</span>
      <span class="meta">${escapeHtml(note.type || "Note disciplinari")} - ${escapeHtml(shortDate(note.date))}</span>
      <div class="inline-actions">
        <button type="button" data-edit-note="${escapeHtml(noteId(note))}">Modifica</button>
        <button type="button" data-remove-note="${escapeHtml(noteId(note))}">Elimina</button>
      </div>
    </article>
  `).join("") || `<article class="notice"><strong>Nessuna nota</strong><span>Le note della classe selezionata compariranno qui.</span></article>`;
}

function normalizedJustificationType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "assenza") return "Assenza";
  if (normalized === "ritardo") return "Ritardo";
  if (normalized === "uscita anticipata") return "Uscita anticipata";
  return String(value || "").trim();
}

function justificationKey(item) {
  return `${item.studentId}|${normalizedJustificationType(item.type || item.status)}|${item.date}`;
}

function noticeKey(notice) {
  return notice.id || notice._id || `${notice.title}|${notice.createdAt || ""}`;
}

function noticeId(notice) {
  return notice.id || notice._id || "";
}

function homeworkKey(homework) {
  return homework.id || homework._id || `${homework.subject}|${homework.title}|${homework.dueDate}|${homework.createdAt || ""}`;
}

function homeworkId(homework) {
  return homework.id || homework._id || "";
}

function gradeKey(grade) {
  return grade.id || grade._id || `${grade.studentId}|${grade.subject}|${grade.value}|${grade.type}|${grade.date}|${grade.createdAt || ""}`;
}

function noteKey(note) {
  return note.id || note._id || `${note.studentId || note.classId}|${note.teacher}|${note.body}|${note.date}|${note.createdAt || ""}`;
}

function noteId(note) {
  return note.id || note._id || "";
}

function isAnnotation(note) {
  return String(note?.type || "").toLowerCase() === "annotazione";
}

function unreadNotesTitle(unread) {
  if (unread.length === 1) {
    return isAnnotation(unread[0]) ? "Nuova annotazione" : "Nuova nota";
  }
  return unread.every(isAnnotation) ? "Nuove annotazioni" : "Nuove note/annotazioni";
}

function noteAppliesToStudent(note, student) {
  if (!note || !student) return false;
  return note.studentId === student.id || (!note.studentId && note.classId === student.classId);
}

function classworkKey(classwork) {
  return classwork.id || classwork._id || `${classwork.subject}|${classwork.date}|${classwork.body}|${classwork.createdAt || ""}`;
}

function classworkId(classwork) {
  return classwork.id || classwork._id || "";
}

function readNoticeStorageKey(studentId) {
  return `gabdat-read-notices-${studentId}`;
}

function readHomeworkStorageKey(studentId) {
  return `gabdat-read-homework-${studentId}`;
}

function readClassworkStorageKey(studentId) {
  return `gabdat-read-classwork-${studentId}`;
}

function readGradeStorageKey(studentId) {
  return `gabdat-read-grades-${studentId}`;
}

function readNoteStorageKey(studentId) {
  return `gabdat-read-notes-${studentId}`;
}

function readNoticeKeys(studentId) {
  return new Set(JSON.parse(localStorage.getItem(readNoticeStorageKey(studentId)) || "[]"));
}

function readHomeworkKeys(studentId) {
  return new Set(JSON.parse(localStorage.getItem(readHomeworkStorageKey(studentId)) || "[]"));
}

function readClassworkKeys(studentId) {
  return new Set(JSON.parse(localStorage.getItem(readClassworkStorageKey(studentId)) || "[]"));
}

function readGradeKeys(studentId) {
  return new Set(JSON.parse(localStorage.getItem(readGradeStorageKey(studentId)) || "[]"));
}

function readNoteKeys(studentId) {
  return new Set(JSON.parse(localStorage.getItem(readNoteStorageKey(studentId)) || "[]"));
}

function saveReadNoticeKeys(studentId, keys) {
  localStorage.setItem(readNoticeStorageKey(studentId), JSON.stringify([...keys]));
}

function saveReadHomeworkKeys(studentId, keys) {
  localStorage.setItem(readHomeworkStorageKey(studentId), JSON.stringify([...keys]));
}

function saveReadClassworkKeys(studentId, keys) {
  localStorage.setItem(readClassworkStorageKey(studentId), JSON.stringify([...keys]));
}

function saveReadGradeKeys(studentId, keys) {
  localStorage.setItem(readGradeStorageKey(studentId), JSON.stringify([...keys]));
}

function saveReadNoteKeys(studentId, keys) {
  localStorage.setItem(readNoteStorageKey(studentId), JSON.stringify([...keys]));
}

function markAllNoticesRead(studentId) {
  const keys = readNoticeKeys(studentId);
  (state.data.notices || []).forEach((notice) => keys.add(noticeKey(notice)));
  saveReadNoticeKeys(studentId, keys);
}

function markAllHomeworkRead(studentId) {
  const keys = readHomeworkKeys(studentId);
  (state.data.homework || []).forEach((homework) => keys.add(homeworkKey(homework)));
  saveReadHomeworkKeys(studentId, keys);
}

function markAllClassworkRead(studentId) {
  const student = selectedStudentView();
  const keys = readClassworkKeys(studentId);
  (state.data.classwork || [])
    .filter((item) => item.classId === student?.classId || item.className === student?.className)
    .forEach((item) => keys.add(classworkKey(item)));
  saveReadClassworkKeys(studentId, keys);
}

function markAllGradesRead(studentId) {
  const keys = readGradeKeys(studentId);
  (state.data.grades || [])
    .filter((grade) => !grade.studentId || grade.studentId === studentId)
    .forEach((grade) => keys.add(gradeKey(grade)));
  saveReadGradeKeys(studentId, keys);
}

function markAllNotesRead(studentId) {
  const student = state.data.students.find((item) => item.id === studentId);
  const keys = readNoteKeys(studentId);
  (state.data.notes || [])
    .filter((note) => noteAppliesToStudent(note, student))
    .forEach((note) => keys.add(noteKey(note)));
  saveReadNoteKeys(studentId, keys);
}

function hasUnreadNotices(studentId) {
  const readKeys = readNoticeKeys(studentId);
  return (state.data?.notices || []).some((notice) => !readKeys.has(noticeKey(notice)));
}

function hasUnreadHomework(studentId) {
  const readKeys = readHomeworkKeys(studentId);
  return (state.data?.homework || []).some((homework) => !readKeys.has(homeworkKey(homework)));
}

function hasUnreadClasswork(studentId) {
  const student = selectedStudentView();
  const readKeys = readClassworkKeys(studentId);
  return (state.data?.classwork || [])
    .filter((item) => item.classId === student?.classId || item.className === student?.className)
    .some((item) => !readKeys.has(classworkKey(item)));
}

function hasUnreadGrades(studentId) {
  const readKeys = readGradeKeys(studentId);
  return (state.data?.grades || [])
    .filter((grade) => !grade.studentId || grade.studentId === studentId)
    .some((grade) => !readKeys.has(gradeKey(grade)));
}

function hasUnreadNotes(studentId) {
  const student = state.data?.students?.find((item) => item.id === studentId);
  const readKeys = readNoteKeys(studentId);
  return (state.data?.notes || [])
    .filter((note) => noteAppliesToStudent(note, student))
    .some((note) => !readKeys.has(noteKey(note)));
}

function markCurrentStudentNoticesRead() {
  const student = selectedStudentView();
  if (!student || !hasUnreadNotices(student.id)) return;
  markAllNoticesRead(student.id);
  document.querySelector("#noticeBadge").classList.add("hidden");
  document.querySelector("#noticeAlerts").classList.add("hidden");
  renderDashboard(state.data);
}

function markCurrentStudentHomeworkRead() {
  const student = selectedStudentView();
  if (!student || !hasUnreadHomework(student.id)) return;
  markAllHomeworkRead(student.id);
  document.querySelector("#homeworkBadge").classList.add("hidden");
  document.querySelector("#homeworkAlerts").classList.add("hidden");
  renderDashboard(state.data);
}

function markCurrentStudentClassworkRead() {
  const student = selectedStudentView();
  if (!student || !hasUnreadClasswork(student.id)) return;
  markAllClassworkRead(student.id);
  document.querySelector("#classworkBadge").classList.add("hidden");
  document.querySelector("#classworkAlerts").classList.add("hidden");
  renderDashboard(state.data);
}

function markCurrentStudentGradesRead() {
  const student = selectedStudentView();
  if (!student || !hasUnreadGrades(student.id)) return;
  markAllGradesRead(student.id);
  document.querySelector("#gradeBadge").classList.add("hidden");
  document.querySelector("#gradeAlerts").classList.add("hidden");
  renderDashboard(state.data);
}

function markCurrentStudentNotesRead() {
  const student = selectedStudentView();
  if (!student || !hasUnreadNotes(student.id)) return;
  markAllNotesRead(student.id);
  document.querySelector("#noteBadge").classList.add("hidden");
  document.querySelector("#noteAlerts").classList.add("hidden");
  renderDashboard(state.data);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function loginRoleForUsername(username) {
  const normalized = username.trim().toUpperCase();
  if (normalized === "STUDENTE01") return "studenti";
  if (normalized === "INSEGNANTE01") return "insegnanti";
  return "";
}

function renderSessionStatus() {
  const status = document.querySelector("#sessionStatus");
  const logoutButton = document.querySelector("#logoutButton");
  const role = loginRoleForUsername(state.username);
  if (!state.username || !role) {
    status.textContent = "Accesso non effettuato";
    logoutButton.classList.add("hidden");
    return;
  }

  status.textContent = `${state.username} - area ${role}`;
  logoutButton.classList.remove("hidden");
}

function needsJustificationStatus(status) {
  return ["Assenza", "Ritardo", "Uscita anticipata"].includes(normalizedJustificationType(status));
}

function studentJustificationEvents(data, student) {
  const events = [];

  (data.attendance || []).forEach((item) => {
    if (item.studentId === student.id && needsJustificationStatus(item.type)) {
      events.push({
        studentId: item.studentId,
        type: normalizedJustificationType(item.type),
        date: item.date,
        time: item.time || "",
        details: item.details || item.type
      });
    }
  });

  [...(data.dailyAttendance || []), ...(data.lessonAttendance || [])].forEach((record) => {
    (record.rows || []).forEach((row) => {
      if (row.studentId === student.id && needsJustificationStatus(row.status)) {
        events.push({
          studentId: row.studentId,
          type: normalizedJustificationType(row.status),
          date: record.date,
          time: "",
          details: row.details || record.lessonLabel || record.className || row.status
        });
      }
    });
  });

  return events.filter((event, index, list) => (
    list.findIndex((item) => justificationKey(item) === justificationKey(event)) === index
  ));
}

function renderJustificationAlerts(data, student) {
  const justified = new Set((data.justifications || [])
    .filter((item) => item.studentId === student.id)
    .map(justificationKey));
  const pending = studentJustificationEvents(data, student)
    .filter((item) => !justified.has(justificationKey(item)))
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const container = document.querySelector("#justificationAlerts");

  container.innerHTML = pending.length ? `
    <article class="student-alert justification-alert">
      <div>
        <strong>${pending.length === 1 ? "Hai 1 evento da giustificare" : `Hai ${pending.length} eventi da giustificare`}</strong>
        <span>Completa la giustificazione: dopo l'invio questo avviso non comparirà più.</span>
      </div>
    </article>
    ${pending.map((item) => `
      <article class="student-alert">
        <div>
          <strong>${escapeHtml(item.type)} da giustificare</strong>
          <span>${escapeHtml(shortDate(item.date))}${item.time ? ` alle ${escapeHtml(item.time)}` : ""} - ${escapeHtml(item.details)}</span>
        </div>
        <button
          type="button"
          data-fill-justification="${escapeHtml(item.type)}"
          data-justification-date="${escapeHtml(item.date)}"
          data-justification-time="${escapeHtml(item.time)}"
        >Giustifica</button>
      </article>
    `).join("")}
  ` : "";
  container.classList.toggle("hidden", pending.length === 0);
}

function renderNoticeAlerts(notices, student) {
  const readKeys = readNoticeKeys(student.id);
  const unread = notices.filter((notice) => !readKeys.has(noticeKey(notice)));
  const container = document.querySelector("#noticeAlerts");
  const badge = document.querySelector("#noticeBadge");

  badge.textContent = `${unread.length} ${unread.length === 1 ? "nuova" : "nuove"}`;
  badge.classList.toggle("hidden", unread.length === 0);
  container.innerHTML = unread.length ? `
    <article class="student-alert">
      <div>
        <strong>${unread.length === 1 ? "Nuova comunicazione" : "Nuove comunicazioni"}</strong>
        <span>${unread[0] ? escapeHtml(unread[0].title) : "Controlla la bacheca."}</span>
      </div>
      <div class="student-alert-actions">
        <button type="button" id="goToNotices">Vai alla bacheca</button>
        <button type="button" id="markNoticesRead">Segna come lette</button>
      </div>
    </article>
  ` : "";
  container.classList.toggle("hidden", unread.length === 0);
}

function renderHomeworkAlerts(homework, student) {
  const readKeys = readHomeworkKeys(student.id);
  const unread = homework.filter((item) => !readKeys.has(homeworkKey(item)));
  const container = document.querySelector("#homeworkAlerts");
  const badge = document.querySelector("#homeworkBadge");

  badge.textContent = `${unread.length} ${unread.length === 1 ? "nuovo" : "nuovi"}`;
  badge.classList.toggle("hidden", unread.length === 0);
  container.innerHTML = unread.length ? `
    <article class="student-alert">
      <div>
        <strong>${unread.length === 1 ? "Nuovo compito" : "Nuovi compiti"}</strong>
        <span>${unread[0] ? `${escapeHtml(unread[0].subject)} - ${escapeHtml(unread[0].title)}` : "Controlla i compiti."}</span>
      </div>
      <div class="student-alert-actions">
        <button type="button" id="goToHomework">Vai ai compiti</button>
        <button type="button" id="markHomeworkRead">Segna come letti</button>
      </div>
    </article>
  ` : "";
  container.classList.toggle("hidden", unread.length === 0);
}

function renderClassworkAlerts(classwork, student) {
  const readKeys = readClassworkKeys(student.id);
  const unread = classwork.filter((item) => !readKeys.has(classworkKey(item)));
  const container = document.querySelector("#classworkAlerts");
  const badge = document.querySelector("#classworkBadge");

  badge.textContent = `${unread.length} ${unread.length === 1 ? "nuovo" : "nuovi"}`;
  badge.classList.toggle("hidden", unread.length === 0);
  container.innerHTML = unread.length ? `
    <article class="student-alert">
      <div>
        <strong>${unread.length === 1 ? "Nuovo svolto in classe" : "Nuovi svolti in classe"}</strong>
        <span>${unread[0] ? `${escapeHtml(unread[0].subject)} - ${escapeHtml(shortDate(unread[0].date))}` : "Controlla lo svolto in classe."}</span>
      </div>
      <div class="student-alert-actions">
        <button type="button" id="goToClasswork">Vai allo svolto</button>
        <button type="button" id="markClassworkRead">Segna come letti</button>
      </div>
    </article>
  ` : "";
  container.classList.toggle("hidden", unread.length === 0);
}

function renderGradeAlerts(grades, student) {
  const readKeys = readGradeKeys(student.id);
  const unread = grades.filter((grade) => !readKeys.has(gradeKey(grade)));
  const container = document.querySelector("#gradeAlerts");
  const badge = document.querySelector("#gradeBadge");

  badge.textContent = `${unread.length} ${unread.length === 1 ? "nuovo" : "nuovi"}`;
  badge.classList.toggle("hidden", unread.length === 0);
  container.innerHTML = unread.length ? `
    <article class="student-alert">
      <div>
        <strong>${unread.length === 1 ? "Nuovo voto" : "Nuovi voti"}</strong>
        <span>${unread[0] ? `${escapeHtml(unread[0].subject)} - ${escapeHtml(unread[0].value)}` : "Controlla i voti."}</span>
      </div>
      <div class="student-alert-actions">
        <button type="button" id="goToGrades">Vai ai voti</button>
        <button type="button" id="markGradesRead">Segna come letti</button>
      </div>
    </article>
  ` : "";
  container.classList.toggle("hidden", unread.length === 0);
}

function renderNoteAlerts(notes, student) {
  const readKeys = readNoteKeys(student.id);
  const unread = notes.filter((note) => !readKeys.has(noteKey(note)));
  const container = document.querySelector("#noteAlerts");
  const badge = document.querySelector("#noteBadge");

  badge.textContent = `${unread.length} ${unread.length === 1 ? "nuova" : "nuove"}`;
  badge.classList.toggle("hidden", unread.length === 0);
  container.innerHTML = unread.length ? `
    <article class="student-alert">
      <div>
        <strong>${unreadNotesTitle(unread)}</strong>
        <span>${unread[0] ? `${escapeHtml(unread[0].teacher || "Docente")} - ${escapeHtml(unread[0].body)}` : "Controlla le note."}</span>
      </div>
      <div class="student-alert-actions">
        <button type="button" id="goToNotes">Vai alle note</button>
        <button type="button" id="markNotesRead">Segna come lette</button>
      </div>
    </article>
  ` : "";
  container.classList.toggle("hidden", unread.length === 0);
}

function renderTeacherSchedule() {
  const order = ["Lunedi", "Martedi", "Mercoledi", "Giovedi", "Venerdi", "Sabato", "Domenica"];
  const schedules = (state.data.schedules || [])
    .filter((item) => item.classId === state.selectedClassId)
    .sort((a, b) => {
      const dayDiff = order.indexOf(a.day) - order.indexOf(b.day);
      return dayDiff || a.time.localeCompare(b.time);
    });

  document.querySelector("#teacherScheduleList").innerHTML = schedules.map((item) => `
    <article class="timeline-item">
      <time>${escapeHtml(displayDay(item.day))}<br>${escapeHtml(item.endTime ? `${item.time}-${item.endTime}` : item.time)}</time>
      <div>
        <strong>${escapeHtml(item.subject)}</strong>
        <div class="meta">${escapeHtml(item.room || "Aula non indicata")} - ${escapeHtml(item.teacher || "Docente non indicato")}</div>
      </div>
      <div class="row-actions">
        <button class="dots-button" type="button" aria-label="Azioni lezione" data-schedule-menu-toggle="${escapeHtml(item.id)}">...</button>
        <div class="row-menu" data-schedule-menu="${escapeHtml(item.id)}">
          <button class="neutral-menu-action" type="button" data-edit-schedule="${escapeHtml(item.id)}">Modifica lezione</button>
          <button type="button" data-remove-schedule="${escapeHtml(item.id)}">Elimina lezione</button>
        </div>
      </div>
    </article>
  `).join("") || `<article class="notice"><strong>Nessun orario</strong><span>Aggiungi lezioni per la classe selezionata.</span></article>`;
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
      <strong>${escapeHtml(note.studentName || note.className || "Classe")} - ${escapeHtml(note.teacher)}</strong>
      <span>${escapeHtml(note.body)}</span>
      <span class="meta">${escapeHtml(note.type || "Note disciplinari")} - ${escapeHtml(shortDate(note.date))}</span>
    </article>
  `).join("") : `<article class="notice"><strong>Nessuna nota</strong><span>Non ci sono note registrate.</span></article>`;
}

function renderTeacherArea() {
  const teachers = teacherList();
  if (!state.selectedTeacherId || !teachers.some((item) => item.id === state.selectedTeacherId)) {
    state.selectedTeacherId = teachers[0]?.id || "";
  }

  const teacherClasses = currentTeacherClasses();
  if (!state.selectedClassId || !teacherClasses.some((item) => item.id === state.selectedClassId)) {
    state.selectedClassId = teacherClasses[0]?.id || "";
  }

  renderTeacherOptions();
  renderClassTeacherOptions();
  renderClassTabs();
  renderClassOptions();
  renderStudentOptions();
  fillStudentForm(selectedStudent());
  renderClassStudentTable();
  renderTeacherRegister();
  renderTeacherGrades();
  renderTeacherEarlyExits();
  renderTeacherJustifications();
  renderTeacherHomework();
  renderTeacherClasswork();
  renderTeacherNotes();
  renderTeacherNotices();
  renderTeacherSchedule();
  renderReportCards();
}

function renderDashboard(data) {
  const student = selectedStudentView() || data.student;
  const studentGrades = data.grades.filter((grade) => !grade.studentId || grade.studentId === student.id);
  const studentNotes = data.notes.filter((note) => noteAppliesToStudent(note, student));
  const scheduleOrder = ["Lunedi", "Martedi", "Mercoledi", "Giovedi", "Venerdi", "Sabato", "Domenica"];
  const studentSchedules = (data.schedules || [])
    .filter((item) => item.classId === student.classId || item.className === student.className)
    .sort((a, b) => {
      const dayDiff = scheduleOrder.indexOf(a.day) - scheduleOrder.indexOf(b.day);
      return dayDiff || String(a.time || "").localeCompare(String(b.time || ""));
    });
  const studentClasswork = [...(data.classwork || [])]
    .filter((item) => item.classId === student.classId || item.className === student.className)
    .sort((a, b) => String(b.date || b.createdAt || "").localeCompare(String(a.date || a.createdAt || "")));

  renderStudentViewOptions();
  document.querySelector("#studentName").textContent = student.name.split(" ")[0];
  document.querySelector("#schoolYear").textContent = student.schoolYear;
  document.querySelector("#className").textContent = student.className;
  document.querySelector("#average").textContent = student.average;
  document.querySelector("#absences").textContent = student.absences;
  document.querySelector("#delays").textContent = student.delays;
  document.querySelector("#notesCount").textContent = studentNotes.length;
  renderJustificationAlerts(data, student);
  renderNoteAlerts(studentNotes, student);

  document.querySelector("#gradesList").innerHTML = studentGrades.map((grade) => `
    <article class="grade-row">
      <span class="${gradeValueClass(grade.value)}">${escapeHtml(grade.value)}</span>
      <div>
        <strong>${escapeHtml(grade.subject)}</strong>
        <div class="meta">${escapeHtml(grade.type)} - ${escapeHtml(grade.teacher || "Docente")} - ${escapeHtml(shortDate(grade.date))}</div>
        ${grade.explanation ? `<div class="meta">${escapeHtml(grade.explanation)}</div>` : ""}
      </div>
      <span class="meta">${gradeOutcome(grade.value)}</span>
    </article>
  `).join("") || `<article class="notice"><strong>Nessun voto</strong><span>Non ci sono voti per questo studente.</span></article>`;
  renderGradeAlerts(studentGrades, student);

  document.querySelector("#agendaList").innerHTML = studentSchedules.map((item) => `
    <article class="timeline-item">
      <time>${escapeHtml(displayDay(item.day))}<br>${escapeHtml(item.endTime ? `${item.time}-${item.endTime}` : item.time)}</time>
      <div>
        <strong>${escapeHtml(item.subject)}</strong>
        <div class="meta">${escapeHtml(item.room || "Aula non indicata")} - ${escapeHtml(item.teacher || "Docente non indicato")}</div>
      </div>
    </article>
  `).join("") || `<article class="notice"><strong>Nessuna lezione</strong><span>Le lezioni della tua classe compariranno qui.</span></article>`;

  const homework = [...(data.homework || [])]
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  renderHomeworkAlerts(homework, student);
  document.querySelector("#homeworkList").innerHTML = homework.map((item) => `
    <article class="task ${item.done ? "done" : ""}">
      <strong>${escapeHtml(item.subject)}</strong>
      <span>${escapeHtml(item.title)}</span>
      <span class="meta">Scadenza: ${escapeHtml(shortDate(item.dueDate))}</span>
      ${item.attachmentData ? `
        <span class="attachment-actions">
          <a class="attachment-link" href="${escapeHtml(item.attachmentData)}" target="_blank" rel="noopener noreferrer">Apri allegato</a>
          <a class="attachment-link" href="${escapeHtml(item.attachmentData)}" download="${escapeHtml(item.attachmentName || "allegato")}">${escapeHtml(item.attachmentName || "Scarica allegato")}</a>
        </span>
      ` : ""}
    </article>
  `).join("") || `<article class="notice"><strong>Nessun compito</strong><span>I compiti assegnati compariranno qui.</span></article>`;

  const notices = [...(data.notices || [])]
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  renderNoticeAlerts(notices, student);
  document.querySelector("#noticesList").innerHTML = notices.map((notice) => `
    <article class="notice">
      <strong>${escapeHtml(notice.title)}</strong>
      <span>${escapeHtml(notice.body)}</span>
      <span class="meta">Priorità: ${escapeHtml(notice.priority)}</span>
    </article>
  `).join("") || `<article class="notice"><strong>Nessuna comunicazione</strong><span>Le comunicazioni dei docenti compariranno qui.</span></article>`;

  document.querySelector("#classworkList").innerHTML = studentClasswork.map((item) => `
    <article class="notice">
      <strong>${escapeHtml(item.subject)}</strong>
      <span>${escapeHtml(item.body)}</span>
      <span class="meta">${escapeHtml(shortDate(item.date))}${item.teacher ? ` - ${escapeHtml(item.teacher)}` : ""}</span>
      ${item.attachmentData ? `<a class="attachment-link" href="${escapeHtml(item.attachmentData)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.attachmentName || "Apri allegato")}</a>` : ""}
    </article>
  `).join("") || `<article class="notice"><strong>Nessuno svolto</strong><span>Gli argomenti svolti in classe compariranno qui.</span></article>`;
  renderClassworkAlerts(studentClasswork, student);

  renderTeacherArea();
  renderNotes({ ...data, notes: studentNotes });
}

async function loadDashboard() {
  const [status, dashboard] = await Promise.all([
    fetchJson("/api/status"),
    fetchJson("/api/dashboard")
  ]);

  state.data = dashboard;
  if (!state.data.teachers?.length) {
    state.data.teachers = teacherList();
  }
  if (!state.selectedTeacherId || !teacherList().some((item) => item.id === state.selectedTeacherId)) {
    state.selectedTeacherId = teacherList()[0]?.id || "";
  }
  if (!state.selectedClassId || !dashboard.classes.some((item) => item.id === state.selectedClassId)) {
    state.selectedClassId = dashboard.classes.find((item) => item.teacherId === state.selectedTeacherId)?.id || dashboard.classes[0]?.id;
  }
  if (!state.selectedStudentId || !dashboard.students.some((item) => item.id === state.selectedStudentId)) {
    state.selectedStudentId = dashboard.students[0]?.id;
  }

  document.querySelector("#dbStatus").textContent = status.database === "connected" ? "MongoDB connesso" : "Dati demo";
  document.querySelector("#dbMode").textContent = status.mode;
  renderDashboard(dashboard);
}

function setDefaultDates() {
  document.querySelector("#attendanceForm").elements.date.value = today();
  document.querySelector("#noteForm").elements.date.value = today();
  document.querySelector("#gradeForm").elements.date.value = today();
  document.querySelector("#classworkForm").elements.date.value = today();
  document.querySelector("#earlyExitForm").elements.date.value = today();
  document.querySelector("#justificationForm").elements.date.value = today();
  document.querySelector("#scheduleForm").elements.time.value = "08:00";
  document.querySelector("#scheduleForm").elements.endTime.value = "09:00";
  document.querySelector("#dailyDate").value = today();
}

function showActiveArea() {
  const path = window.location.pathname;
  const usernameRole = loginRoleForUsername(state.username);
  const needsLogin = path === "/studenti" || path === "/insegnanti";
  const wrongRole = (path === "/studenti" && usernameRole !== "studenti") || (path === "/insegnanti" && usernameRole !== "insegnanti");
  if (needsLogin && (!state.username || wrongRole)) {
    window.history.replaceState({}, "", "/");
  }

  const activePath = window.location.pathname;
  const isHome = activePath === "/";
  const isTeacher = activePath === "/insegnanti";
  const isStudent = activePath === "/studenti";

  document.querySelector("#homeView").classList.toggle("hidden-view", !isHome);
  document.querySelector("#studentView").classList.toggle("hidden-view", !isStudent);
  document.querySelector("#studentDetailsView").classList.toggle("hidden-view", !isStudent);
  document.querySelector("#insegnanti").classList.toggle("hidden-view", !isTeacher);

  document.querySelectorAll(".nav a").forEach((link) => {
    const target = link.getAttribute("href");
    link.classList.toggle("active", target === activePath);
  });
  renderSessionStatus();
}

document.querySelector("#logoutButton").addEventListener("click", () => {
  state.username = "";
  localStorage.removeItem("gabdat-username");
  document.querySelector("#loginUsername").value = "";
  window.history.pushState({}, "", "/");
  showActiveArea();
});

document.querySelector("#homeMenuButton").addEventListener("click", () => {
  const panel = document.querySelector("#homeMenuPanel");
  const isHidden = panel.classList.toggle("hidden");
  document.querySelector("#homeMenuButton").setAttribute("aria-expanded", String(!isHidden));
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  document.querySelector("#installAppButton").disabled = false;
  document.querySelector("#installHelp").textContent = "Premi Installa app per aggiungere My Class alla schermata Home.";
});

document.querySelector("#installAppButton").addEventListener("click", async () => {
  if (!deferredInstallPrompt) {
    document.querySelector("#installHelp").textContent = "Se il pulsante non parte: apri i tre puntini del browser e scegli Installa app o Aggiungi a schermata Home.";
    return;
  }

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
});

document.querySelector("#refreshAppButton").addEventListener("click", async () => {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }

  window.location.reload();
});

document.querySelector("#classTabs").addEventListener("click", async (event) => {
  const menuToggle = event.target.closest("[data-class-menu-toggle]");
  if (menuToggle) {
    const menu = document.querySelector(`[data-class-menu="${CSS.escape(menuToggle.dataset.classMenuToggle)}"]`);
    document.querySelectorAll(".row-menu.open").forEach((item) => {
      if (item !== menu) item.classList.remove("open");
    });
    menu?.classList.toggle("open");
    return;
  }

  const editButton = event.target.closest("[data-edit-class]");
  if (editButton) {
    const schoolClass = state.data.classes.find((item) => item.id === editButton.dataset.editClass);
    if (!schoolClass) return;

    const form = document.querySelector("#classEditor");
    form.classList.remove("hidden");
    form.elements.classId.value = schoolClass.id;
    form.elements.name.value = schoolClass.name;
    form.elements.schoolYear.value = schoolClass.schoolYear || "";
    form.elements.teacherId.value = schoolClass.teacherId || state.selectedTeacherId;
    state.selectedClassId = schoolClass.id;
    renderClassTabs();
    return;
  }

  const removeButton = event.target.closest("[data-remove-class]");
  if (removeButton) {
    const schoolClass = state.data.classes.find((item) => item.id === removeButton.dataset.removeClass);
    if (!schoolClass) return;

    const confirmed = window.confirm(`Eliminare la classe ${schoolClass.name} e tutti i suoi alunni?`);
    if (!confirmed) return;

    await fetchJson(`/api/classes/${schoolClass.id}`, { method: "DELETE" });
    state.selectedClassId = null;
    await loadDashboard();
    return;
  }

  const button = event.target.closest("button[data-class-id]");
  if (!button) return;
  state.selectedClassId = button.dataset.classId;
  renderTeacherArea();
});

document.querySelectorAll("[data-open-panel]").forEach((button) => {
  button.addEventListener("click", () => {
    const panel = document.querySelector(`#${button.dataset.openPanel}`);
    if (button.dataset.openPanel === "scheduleForm" && panel.classList.contains("hidden")) {
      resetScheduleForm();
    }
    panel.classList.toggle("hidden");
  });
});

document.querySelector("#loginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const username = form.elements.username.value.trim();
  const requestedRole = event.submitter?.value || "studenti";
  const allowedRole = loginRoleForUsername(username);
  const error = document.querySelector("#loginError");
  if (!username) return;
  if (!allowedRole) {
    error.textContent = "Username non valido.";
    return;
  }
  if (allowedRole !== requestedRole) {
    error.textContent = allowedRole === "studenti"
      ? "Questo username può entrare solo nell'area studenti."
      : "Questo username può entrare solo nell'area insegnanti.";
    return;
  }

  error.textContent = "";
  state.username = username.toUpperCase();
  localStorage.setItem("gabdat-username", state.username);
  window.history.pushState({}, "", `/${allowedRole}`);
  showActiveArea();
});

document.querySelector("#dailyDate").addEventListener("change", renderClassStudentTable);

document.querySelector("#dailyLesson").addEventListener("change", renderClassStudentTable);

document.querySelector("#savedDailyDate").addEventListener("change", (event) => {
  if (!event.currentTarget.value) return;
  document.querySelector("#dailyDate").value = event.currentTarget.value;
  renderClassStudentTable();
});

document.querySelector("#deleteSavedDay").addEventListener("click", async () => {
  const date = document.querySelector("#savedDailyDate").value;
  if (!date) return;

  const confirmed = window.confirm(`Eliminare la giornata salvata del ${shortDate(date)}?`);
  if (!confirmed) return;

  await fetchJson(`/api/daily-attendance/${state.selectedClassId}/${date}`, { method: "DELETE" });
  document.querySelector("#dailyDate").value = today();
  await loadDashboard();
});

document.querySelector("#addReportSubject").addEventListener("click", () => {
  addReportSubject();
});

document.querySelector("#reportSubjects").addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove-report-subject]");
  if (!removeButton) return;

  const row = removeButton.closest(".subject-row");
  if (document.querySelectorAll("#reportSubjects .subject-row").length > 1) {
    row.remove();
    return;
  }

  row.querySelectorAll("input").forEach((input) => {
    input.value = "";
  });
});

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

document.querySelector("#teacherGradesList").addEventListener("click", async (event) => {
  const toggle = event.target.closest("[data-grade-menu-toggle]");
  if (toggle) {
    const menu = document.querySelector(`[data-grade-menu="${CSS.escape(toggle.dataset.gradeMenuToggle)}"]`);
    document.querySelectorAll(".row-menu.open").forEach((item) => {
      if (item !== menu) item.classList.remove("open");
    });
    menu?.classList.toggle("open");
    return;
  }

  const editButton = event.target.closest("[data-edit-grade]");
  if (editButton) {
    const grade = state.data.grades.find((item) => item.id === editButton.dataset.editGrade);
    if (!grade) return;

    const form = document.querySelector("#gradeForm");
    form.elements.gradeId.value = grade.id;
    form.elements.studentId.value = grade.studentId || selectedStudent()?.id || "";
    form.elements.subject.value = grade.subject || "";
    form.elements.value.value = grade.value || "";
    form.elements.type.value = grade.type || "Verifica";
    form.elements.explanation.value = grade.explanation || "";
    form.elements.teacher.value = grade.teacher || "";
    form.elements.date.value = grade.date || today();
    form.querySelector("button[type='submit']").textContent = "Salva modifica";
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const removeButton = event.target.closest("[data-remove-grade]");
  if (!removeButton) return;

  const grade = state.data.grades.find((item) => item.id === removeButton.dataset.removeGrade);
  if (!grade) return;

  const confirmed = window.confirm(`Eliminare il voto ${grade.value} di ${grade.subject}?`);
  if (!confirmed) return;

  await fetchJson(`/api/grades/${grade.id}`, { method: "DELETE" });
  await loadDashboard();
});

document.querySelector("#teacherScheduleList").addEventListener("click", async (event) => {
  const toggle = event.target.closest("[data-schedule-menu-toggle]");
  if (toggle) {
    const menu = document.querySelector(`[data-schedule-menu="${CSS.escape(toggle.dataset.scheduleMenuToggle)}"]`);
    document.querySelectorAll(".row-menu.open").forEach((item) => {
      if (item !== menu) item.classList.remove("open");
    });
    menu?.classList.toggle("open");
    return;
  }

  const editButton = event.target.closest("[data-edit-schedule]");
  if (editButton) {
    const schedule = state.data.schedules.find((item) => item.id === editButton.dataset.editSchedule);
    fillScheduleForm(schedule);
    document.querySelectorAll(".row-menu.open").forEach((menu) => menu.classList.remove("open"));
    return;
  }

  const removeButton = event.target.closest("[data-remove-schedule]");
  if (!removeButton) return;

  const schedule = state.data.schedules.find((item) => item.id === removeButton.dataset.removeSchedule);
  if (!schedule) return;

  const confirmed = window.confirm(`Eliminare la lezione di ${schedule.subject} del ${schedule.day}?`);
  if (!confirmed) return;

  await fetchJson(`/api/schedules/${schedule.id}`, { method: "DELETE" });
  await loadDashboard();
});

document.addEventListener("click", (event) => {
  if (event.target.closest(".row-actions")) return;
  if (!event.target.closest(".home-menu")) {
    document.querySelector("#homeMenuPanel").classList.add("hidden");
    document.querySelector("#homeMenuButton").setAttribute("aria-expanded", "false");
  }
  document.querySelectorAll(".row-menu.open").forEach((menu) => menu.classList.remove("open"));
});

document.querySelector("#studentSelect").addEventListener("change", () => {
  fillStudentForm(selectedStudent());
});

document.querySelector("#studentViewSelect").addEventListener("change", (event) => {
  state.selectedStudentId = event.currentTarget.value;
  renderDashboard(state.data);
});

document.querySelector("#teacherSelect").addEventListener("change", (event) => {
  state.selectedTeacherId = event.currentTarget.value;
  localStorage.setItem("gabdat-teacher-id", state.selectedTeacherId);
  state.selectedClassId = currentTeacherClasses()[0]?.id || "";
  renderTeacherArea();
});

document.querySelector("#editTeacherButton").addEventListener("click", () => {
  const teacher = teacherList().find((item) => item.id === state.selectedTeacherId);
  if (!teacher) return;

  const form = document.querySelector("#teacherEditor");
  form.classList.remove("hidden");
  form.elements.teacherId.value = teacher.id;
  form.elements.name.value = teacher.name || "";
  form.elements.subject.value = teacher.subject || "";
});

document.querySelector("#deleteTeacherButton").addEventListener("click", async () => {
  const teacher = teacherList().find((item) => item.id === state.selectedTeacherId);
  if (!teacher) return;

  const confirmed = window.confirm(`Eliminare ${teacher.name}? Le sue classi verranno assegnate a un altro insegnante.`);
  if (!confirmed) return;

  const result = await fetchJson(`/api/teachers/${teacher.id}`, { method: "DELETE" });
  state.selectedTeacherId = result.reassignedTo || "";
  localStorage.setItem("gabdat-teacher-id", state.selectedTeacherId);
  state.selectedClassId = "";
  await loadDashboard();
});

document.querySelector("#justificationAlerts").addEventListener("click", (event) => {
  const button = event.target.closest("[data-fill-justification]");
  if (!button) return;

  const form = document.querySelector("#justificationForm");
  form.elements.type.value = button.dataset.fillJustification;
  form.elements.date.value = button.dataset.justificationDate;
  form.elements.time.value = button.dataset.justificationTime || "";
  form.scrollIntoView({ behavior: "smooth", block: "center" });
  form.elements.reason.focus();
});

document.querySelector("#noticeAlerts").addEventListener("click", (event) => {
  if (event.target.closest("#goToNotices")) {
    markCurrentStudentNoticesRead();
    document.querySelector("#bacheca").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (!event.target.closest("#markNoticesRead")) return;

  markCurrentStudentNoticesRead();
});

document.querySelector("#bacheca").addEventListener("click", markCurrentStudentNoticesRead);

document.querySelector("#homeworkAlerts").addEventListener("click", (event) => {
  if (event.target.closest("#goToHomework")) {
    markCurrentStudentHomeworkRead();
    document.querySelector("#compiti").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (!event.target.closest("#markHomeworkRead")) return;

  markCurrentStudentHomeworkRead();
});

document.querySelector("#compiti").addEventListener("click", markCurrentStudentHomeworkRead);

document.querySelector("#classworkAlerts").addEventListener("click", (event) => {
  if (event.target.closest("#goToClasswork")) {
    markCurrentStudentClassworkRead();
    document.querySelector("#svolto").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (!event.target.closest("#markClassworkRead")) return;

  markCurrentStudentClassworkRead();
});

document.querySelector("#svolto").addEventListener("click", markCurrentStudentClassworkRead);

document.querySelector("#gradeAlerts").addEventListener("click", (event) => {
  if (event.target.closest("#goToGrades")) {
    markCurrentStudentGradesRead();
    document.querySelector("#voti").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (!event.target.closest("#markGradesRead")) return;

  markCurrentStudentGradesRead();
});

document.querySelector("#voti").addEventListener("click", markCurrentStudentGradesRead);

document.querySelector("#noteAlerts").addEventListener("click", (event) => {
  if (event.target.closest("#goToNotes")) {
    markCurrentStudentNotesRead();
    document.querySelector("#note").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (!event.target.closest("#markNotesRead")) return;

  markCurrentStudentNotesRead();
});

document.querySelector("#note").addEventListener("click", markCurrentStudentNotesRead);

document.querySelector("#earlyExitForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);

  await fetchJson("/api/early-exits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentId: selectedStudentView().id,
      date: formData.get("date"),
      time: formData.get("time"),
      reason: formData.get("reason")
    })
  });

  form.reset();
  setDefaultDates();
  await loadDashboard();
});

document.querySelector("#justificationForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);

  const justification = await fetchJson("/api/justifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentId: selectedStudentView().id,
      type: formData.get("type"),
      date: formData.get("date"),
      time: formData.get("time"),
      reason: formData.get("reason")
    })
  });

  state.data.justifications = [justification, ...(state.data.justifications || [])];
  renderDashboard(state.data);
  form.reset();
  setDefaultDates();
  await loadDashboard();
});

document.querySelector("#scheduleForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const scheduleId = formData.get("scheduleId");

  await fetchJson(scheduleId ? `/api/schedules/${scheduleId}` : "/api/schedules", {
    method: scheduleId ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      classId: state.selectedClassId,
      day: formData.get("day"),
      time: formData.get("time"),
      endTime: formData.get("endTime"),
      subject: formData.get("subject"),
      room: formData.get("room"),
      teacher: formData.get("teacher")
    })
  });

  resetScheduleForm();
  await loadDashboard();
});

document.querySelector("#classCreator").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const teacherId = formData.get("teacherId") || state.selectedTeacherId;

  const schoolClass = await fetchJson("/api/classes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: formData.get("name"),
      schoolYear: formData.get("schoolYear"),
      teacherId
    })
  });

  state.selectedTeacherId = teacherId;
  localStorage.setItem("gabdat-teacher-id", state.selectedTeacherId);
  state.selectedClassId = schoolClass.id;
  form.reset();
  await loadDashboard();
});

document.querySelector("#teacherCreator").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);

  const teacher = await fetchJson("/api/teachers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: formData.get("name"),
      subject: formData.get("subject")
    })
  });

  state.selectedTeacherId = teacher.id;
  localStorage.setItem("gabdat-teacher-id", state.selectedTeacherId);
  form.reset();
  await loadDashboard();
});

document.querySelector("#teacherEditor").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);

  await fetchJson(`/api/teachers/${formData.get("teacherId")}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: formData.get("name"),
      subject: formData.get("subject")
    })
  });

  form.reset();
  form.classList.add("hidden");
  await loadDashboard();
});

document.querySelector("#classEditor").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);

  await fetchJson(`/api/classes/${formData.get("classId")}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: formData.get("name"),
      schoolYear: formData.get("schoolYear"),
      teacherId: formData.get("teacherId") || state.selectedTeacherId
    })
  });

  form.reset();
  form.classList.add("hidden");
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

document.querySelector("#gradeForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const gradeIdValue = formData.get("gradeId");

  await fetchJson(gradeIdValue ? `/api/grades/${gradeIdValue}` : "/api/grades", {
    method: gradeIdValue ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentId: formData.get("studentId"),
      subject: formData.get("subject"),
      value: formData.get("value"),
      type: formData.get("type"),
      explanation: formData.get("explanation"),
      teacher: formData.get("teacher"),
      date: formData.get("date")
    })
  });

  form.reset();
  form.elements.gradeId.value = "";
  form.querySelector("button[type='submit']").textContent = "Salva voto";
  setDefaultDates();
  await loadDashboard();
});

function dailyRowsFromTable() {
  return [...document.querySelectorAll("#classStudentsTable tr[data-student-id]")].map((row) => ({
    studentId: row.dataset.studentId,
    status: row.querySelector("[name='status']").value,
    details: row.querySelector("[name='details']").value
  }));
}

document.querySelector("#saveLessonAttendance").addEventListener("click", async () => {
  const lesson = selectedLesson();
  const rows = dailyRowsFromTable();
  if (!lesson) {
    document.querySelector("#dailySaveMessage").textContent = "Seleziona una lezione prima di salvare.";
    return;
  }
  if (!hasLessonStarted(lesson)) {
    document.querySelector("#dailySaveMessage").textContent = `La lezione si attivera alle ${lesson.time}.`;
    return;
  }

  await fetchJson("/api/lesson-attendance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      classId: state.selectedClassId,
      scheduleId: lesson.id,
      date: document.querySelector("#dailyDate").value,
      rows
    })
  });

  if (isSelectedLastLesson()) {
    await fetchJson("/api/daily-attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classId: state.selectedClassId,
        date: document.querySelector("#dailyDate").value,
        rows
      })
    });
  }

  await loadDashboard();
  if (isSelectedLastLesson()) {
    document.querySelector("#dailySaveMessage").textContent = "Ultima lezione salvata: giornata chiusa e salvata.";
  }
});

document.querySelector("#saveDailyAttendance").addEventListener("click", async () => {
  await fetchJson("/api/daily-attendance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      classId: state.selectedClassId,
      date: document.querySelector("#dailyDate").value,
      rows: dailyRowsFromTable()
    })
  });

  await loadDashboard();
});

document.querySelector("#reportCardForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const subjects = [...document.querySelectorAll("#reportSubjects .subject-row")]
    .map((row) => ({
      name: row.querySelector("[name='subjectName']").value.trim(),
      grade: row.querySelector("[name='subjectGrade']").value
    }))
    .filter((subject) => subject.name && subject.grade);

  if (!subjects.length) {
    window.alert("Aggiungi almeno una materia alla pagella.");
    return;
  }

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
  resetReportSubjects();
  await loadDashboard();
});

document.querySelector("#homeworkForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const file = form.elements.attachment.files[0];
  const attachmentData = await fileToDataUrl(file);
  const homeworkIdValue = formData.get("homeworkId");

  await fetchJson(homeworkIdValue ? `/api/homework/${homeworkIdValue}` : "/api/homework", {
    method: homeworkIdValue ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: formData.get("subject"),
      title: formData.get("title"),
      dueDate: formData.get("dueDate"),
      attachmentName: file?.name || "",
      attachmentType: file?.type || "",
      attachmentData,
      keepAttachment: Boolean(homeworkIdValue && !file)
    })
  });

  form.reset();
  form.elements.homeworkId.value = "";
  form.querySelector("button[type='submit']").textContent = "Pubblica compito";
  await loadDashboard();
});

document.querySelector("#classworkForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const file = form.elements.attachment.files[0];
  const attachmentData = await fileToDataUrl(file);
  const classworkIdValue = formData.get("classworkId");

  await fetchJson(classworkIdValue ? `/api/classwork/${classworkIdValue}` : "/api/classwork", {
    method: classworkIdValue ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      classId: state.selectedClassId,
      subject: formData.get("subject"),
      date: formData.get("date"),
      teacher: formData.get("teacher"),
      body: formData.get("body"),
      attachmentName: file?.name || "",
      attachmentType: file?.type || "",
      attachmentData,
      keepAttachment: Boolean(classworkIdValue && !file)
    })
  });

  form.reset();
  form.elements.classworkId.value = "";
  form.querySelector("button[type='submit']").textContent = "Pubblica svolto";
  setDefaultDates();
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

document.querySelector("#teacherRegisterList").addEventListener("click", async (event) => {
  const removeButton = event.target.closest("[data-remove-attendance]");
  if (!removeButton) return;

  const confirmed = window.confirm("Eliminare questa voce dal registro recente?");
  if (!confirmed) return;

  await fetchJson(`/api/attendance/${removeButton.dataset.removeAttendance}`, { method: "DELETE" });
  await loadDashboard();
});

document.querySelector("#noteForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const noteIdValue = formData.get("noteId");
  const [target, recipientId] = String(formData.get("recipient") || "").split(":");

  await fetchJson(noteIdValue ? `/api/notes/${noteIdValue}` : "/api/notes", {
    method: noteIdValue ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentId: target === "student" ? recipientId : "",
      classId: target === "class" ? recipientId : "",
      teacher: formData.get("teacher"),
      type: formData.get("type"),
      date: formData.get("date"),
      body: formData.get("body")
    })
  });

  form.reset();
  form.elements.noteId.value = "";
  form.querySelector("button[type='submit']").textContent = "Inserisci nota / annotazione";
  setDefaultDates();
  await loadDashboard();
});

document.querySelector("#teacherNotesList").addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-note]");
  if (editButton) {
    const note = (state.data.notes || []).find((item) => noteId(item) === editButton.dataset.editNote);
    if (!note) return;

    const form = document.querySelector("#noteForm");
    form.elements.noteId.value = noteId(note);
    form.elements.recipient.value = note.studentId ? `student:${note.studentId}` : `class:${note.classId}`;
    form.elements.teacher.value = note.teacher || "";
    form.elements.type.value = note.type || "Note disciplinari";
    form.elements.date.value = note.date || today();
    form.elements.body.value = note.body || "";
    form.querySelector("button[type='submit']").textContent = "Salva nota";
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const removeButton = event.target.closest("[data-remove-note]");
  if (!removeButton) return;

  const confirmed = window.confirm("Eliminare questa nota?");
  if (!confirmed) return;

  await fetchJson(`/api/notes/${removeButton.dataset.removeNote}`, { method: "DELETE" });
  await loadDashboard();
});

document.querySelector("#teacherNoticesList").addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-notice]");
  if (editButton) {
    const notice = (state.data.notices || []).find((item) => noticeId(item) === editButton.dataset.editNotice);
    if (!notice) return;

    const form = document.querySelector("#noticeForm");
    form.elements.noticeId.value = noticeId(notice);
    form.elements.title.value = notice.title || "";
    form.elements.body.value = notice.body || "";
    form.elements.priority.value = notice.priority || "Media";
    form.querySelector("button[type='submit']").textContent = "Salva comunicazione";
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const removeButton = event.target.closest("[data-remove-notice]");
  if (!removeButton) return;

  const confirmed = window.confirm("Eliminare questa comunicazione?");
  if (!confirmed) return;

  await fetchJson(`/api/notices/${removeButton.dataset.removeNotice}`, { method: "DELETE" });
  await loadDashboard();
});

document.querySelector("#teacherHomeworkList").addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-homework]");
  if (editButton) {
    const homework = (state.data.homework || []).find((item) => homeworkId(item) === editButton.dataset.editHomework);
    if (!homework) return;

    const form = document.querySelector("#homeworkForm");
    form.elements.homeworkId.value = homeworkId(homework);
    form.elements.subject.value = homework.subject || "";
    form.elements.title.value = homework.title || "";
    form.elements.dueDate.value = homework.dueDate || "";
    form.elements.attachment.value = "";
    form.querySelector("button[type='submit']").textContent = "Salva compito";
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const removeButton = event.target.closest("[data-remove-homework]");
  if (!removeButton) return;

  const confirmed = window.confirm("Eliminare questo compito?");
  if (!confirmed) return;

  await fetchJson(`/api/homework/${removeButton.dataset.removeHomework}`, { method: "DELETE" });
  await loadDashboard();
});

document.querySelector("#teacherClassworkList").addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-classwork]");
  if (editButton) {
    const item = (state.data.classwork || []).find((entry) => classworkId(entry) === editButton.dataset.editClasswork);
    if (!item) return;

    const form = document.querySelector("#classworkForm");
    form.elements.classworkId.value = classworkId(item);
    form.elements.subject.value = item.subject || "";
    form.elements.date.value = item.date || "";
    form.elements.teacher.value = item.teacher || "";
    form.elements.body.value = item.body || "";
    form.elements.attachment.value = "";
    form.querySelector("button[type='submit']").textContent = "Salva svolto";
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const removeButton = event.target.closest("[data-remove-classwork]");
  if (!removeButton) return;

  const confirmed = window.confirm("Eliminare questo svolto in classe?");
  if (!confirmed) return;

  await fetchJson(`/api/classwork/${removeButton.dataset.removeClasswork}`, { method: "DELETE" });
  await loadDashboard();
});

document.querySelector("#noticeForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const noticeIdValue = formData.get("noticeId");

  await fetchJson(noticeIdValue ? `/api/notices/${noticeIdValue}` : "/api/notices", {
    method: noticeIdValue ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: formData.get("title"),
      body: formData.get("body"),
      priority: formData.get("priority")
    })
  });

  form.reset();
  form.elements.noticeId.value = "";
  form.querySelector("button[type='submit']").textContent = "Pubblica comunicazione";
  await loadDashboard();
});

document.querySelectorAll(".nav a").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    window.history.pushState({}, "", link.getAttribute("href"));
    showActiveArea();
  });
});

const bachecaObserver = new IntersectionObserver((entries) => {
  const entry = entries[0];
  if (entry?.isIntersecting && window.location.pathname === "/studenti") {
    markCurrentStudentNoticesRead();
  }
}, { threshold: 0.6 });
bachecaObserver.observe(document.querySelector("#bacheca"));

const homeworkObserver = new IntersectionObserver((entries) => {
  const entry = entries[0];
  if (entry?.isIntersecting && window.location.pathname === "/studenti") {
    markCurrentStudentHomeworkRead();
  }
}, { threshold: 0.6 });
homeworkObserver.observe(document.querySelector("#compiti"));

const classworkObserver = new IntersectionObserver((entries) => {
  const entry = entries[0];
  if (entry?.isIntersecting && window.location.pathname === "/studenti") {
    markCurrentStudentClassworkRead();
  }
}, { threshold: 0.6 });
classworkObserver.observe(document.querySelector("#svolto"));

const noteObserver = new IntersectionObserver((entries) => {
  const entry = entries[0];
  if (entry?.isIntersecting && window.location.pathname === "/studenti") {
    markCurrentStudentNotesRead();
  }
}, { threshold: 0.6 });
noteObserver.observe(document.querySelector("#note"));

setDefaultDates();
resetReportSubjects();
document.querySelector("#loginUsername").value = state.username;
window.addEventListener("popstate", showActiveArea);
showActiveArea();
loadDashboard().catch((error) => {
  document.querySelector("#dbStatus").textContent = "Errore";
  document.querySelector("#dbMode").textContent = error.message;
});

setInterval(() => {
  if (state.data) renderClassStudentTable();
}, 60000);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // The app still works in browsers that block service workers locally.
    });
  });
}
