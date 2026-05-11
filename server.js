const express = require("express");
const path = require("path");
const nodemailer = require("nodemailer");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "gabdat";
const smtpPort = Number(process.env.SMTP_PORT || 587);
const defaultMailRecipients = splitEnvList(process.env.NOTIFICATION_EMAIL_TO);

let client;
let db;
let mongoConnectionError;
let mongoConnectionDisabled = false;
let mailTransporter;

const demoData = {
  teachers: [
    { id: "teacher-1", name: "Prof. Rossi", subject: "Matematica" },
    { id: "teacher-2", name: "Prof.ssa Greco", subject: "Informatica" }
  ],
  classes: [
    { id: "class-3b-inf", name: "3B Informatica", schoolYear: "2025/2026", teacherId: "teacher-1" },
    { id: "class-2a-inf", name: "2A Informatica", schoolYear: "2025/2026", teacherId: "teacher-2" }
  ],
  student: {
    id: "stu-1",
    name: "Gabriele Dattola",
    email: "",
    className: "3B Informatica",
    schoolYear: "2025/2026",
    average: 8.1,
    absences: 4,
    delays: 1,
    presences: 112,
    notes: 1
  },
  students: [
    {
      id: "stu-1",
      name: "Gabriele Dattola",
      email: "",
      classId: "class-3b-inf",
      className: "3B Informatica",
      schoolYear: "2025/2026",
      average: 8.1,
      absences: 4,
      delays: 1,
      presences: 112,
      notes: 1
    },
    {
      id: "stu-2",
      name: "Luca Ferri",
      email: "",
      classId: "class-3b-inf",
      className: "3B Informatica",
      schoolYear: "2025/2026",
      average: 7.4,
      absences: 6,
      delays: 2,
      presences: 108,
      notes: 0
    },
    {
      id: "stu-3",
      name: "Sara Romano",
      email: "",
      classId: "class-3b-inf",
      className: "3B Informatica",
      schoolYear: "2025/2026",
      average: 8.7,
      absences: 2,
      delays: 0,
      presences: 116,
      notes: 0
    }
  ],
  grades: [
    { subject: "Matematica", value: 8, type: "Verifica", term: "", date: "2026-04-22", teacher: "Prof. Marino", studentId: "stu-1", studentName: "Gabriele Dattola", classId: "class-3b-inf", className: "3B Informatica" },
    { subject: "Informatica", value: 9, type: "Laboratorio", term: "", date: "2026-04-18", teacher: "Prof.ssa Greco", studentId: "stu-1", studentName: "Gabriele Dattola", classId: "class-3b-inf", className: "3B Informatica" },
    { subject: "Italiano", value: 7, type: "Interrogazione", term: "", date: "2026-04-15", teacher: "Prof. Rizzo", studentId: "stu-1", studentName: "Gabriele Dattola", classId: "class-3b-inf", className: "3B Informatica" },
    { subject: "Inglese", value: 8.5, type: "Reading", term: "", date: "2026-04-10", teacher: "Prof.ssa Costa", studentId: "stu-1", studentName: "Gabriele Dattola", classId: "class-3b-inf", className: "3B Informatica" }
  ],
  homework: [
    { id: "homework-1", classId: "class-3b-inf", className: "3B Informatica", subject: "Informatica", title: "Completare esercizio su API REST", dueDate: "2026-05-04", done: false },
    { id: "homework-2", classId: "class-3b-inf", className: "3B Informatica", subject: "Matematica", title: "Studio funzioni: pag. 112 esercizi 8-12", dueDate: "2026-05-03", done: false },
    { id: "homework-3", classId: "class-3b-inf", className: "3B Informatica", subject: "Italiano", title: "Scheda su Pirandello", dueDate: "2026-05-06", done: true }
  ],
  classwork: [
    { id: "classwork-1", classId: "class-3b-inf", className: "3B Informatica", subject: "Informatica", date: "2026-05-01", body: "Ripasso API REST e gestione delle risposte JSON.", teacher: "Prof.ssa Greco", createdAt: "2026-05-01T11:00:00.000Z" }
  ],
  agenda: [
    { time: "08:00", title: "Matematica", room: "Aula 12" },
    { time: "09:00", title: "Informatica", room: "Lab 2" },
    { time: "11:00", title: "Italiano", room: "Aula 12" },
    { time: "12:00", title: "Scienze motorie", room: "Palestra" }
  ],
  schedules: [
    { id: "schedule-1", classId: "class-3b-inf", className: "3B Informatica", day: "Lunedi", time: "08:00", endTime: "09:00", subject: "Matematica", room: "Aula 12", teacher: "Prof. Marino" },
    { id: "schedule-2", classId: "class-3b-inf", className: "3B Informatica", day: "Lunedi", time: "09:00", endTime: "10:00", subject: "Informatica", room: "Lab 2", teacher: "Prof.ssa Greco" },
    { id: "schedule-3", classId: "class-2a-inf", className: "2A Informatica", day: "Martedi", time: "10:00", endTime: "11:00", subject: "Inglese", room: "Aula 8", teacher: "Prof.ssa Costa" }
  ],
  notices: [
    { id: "notice-1", classId: "class-3b-inf", className: "3B Informatica", title: "Uscita didattica", body: "Consegnare autorizzazione firmata entro venerdi.", priority: "Alta" },
    { id: "notice-2", classId: "class-3b-inf", className: "3B Informatica", title: "Ricevimento docenti", body: "Prenotazioni aperte dall'area famiglia.", priority: "Media" }
  ],
  attendance: [
    { studentId: "stu-1", studentName: "Gabriele Dattola", type: "Assenza", date: "2026-04-29", details: "Assenza da giustificare" },
    { studentId: "stu-1", studentName: "Gabriele Dattola", type: "Ritardo", date: "2026-04-21", details: "Ingresso alle 08:18" },
    { studentId: "stu-2", studentName: "Luca Ferri", type: "Presenza", date: "2026-05-01", details: "Presente" }
  ],
  notes: [
    { studentId: "stu-1", studentName: "Gabriele Dattola", date: "2026-04-12", teacher: "Prof. Marino", body: "Materiale dimenticato durante la lezione." }
  ],
  reportCards: [
    {
      studentId: "stu-1",
      studentName: "Gabriele Dattola",
      classId: "class-3b-inf",
      className: "3B Informatica",
      term: "Secondo quadrimestre",
      conduct: 8,
      outcome: "Ammesso",
      subjects: [
        { name: "Matematica", grade: 8 },
        { name: "Informatica", grade: 9 },
        { name: "Italiano", grade: 7 }
      ],
      createdAt: "2026-04-30T10:00:00.000Z"
    }
  ],
  dailyAttendance: [
    {
      classId: "class-3b-inf",
      className: "3B Informatica",
      date: "2026-05-01",
      savedAt: "2026-05-01T12:45:00.000Z",
      rows: [
        { studentId: "stu-1", studentName: "Gabriele Dattola", status: "Presente", details: "" },
        { studentId: "stu-2", studentName: "Luca Ferri", status: "Ritardo", details: "Ingresso 08:18" },
        { studentId: "stu-3", studentName: "Sara Romano", status: "Presente", details: "" }
      ]
    }
  ],
  lessonAttendance: [
  ],
  earlyExits: [
    {
      id: "exit-1",
      studentId: "stu-1",
      studentName: "Gabriele Dattola",
      classId: "class-3b-inf",
      className: "3B Informatica",
      date: "2026-05-04",
      time: "12:10",
      reason: "Visita medica",
      status: "Programmato",
      createdAt: "2026-05-01T09:00:00.000Z"
    }
  ],
  justifications: [
    {
      id: "justification-1",
      studentId: "stu-2",
      studentName: "Luca Ferri",
      classId: "class-3b-inf",
      className: "3B Informatica",
      type: "Ritardo",
      date: "2026-04-28",
      time: "08:25",
      reason: "Visita medica",
      status: "Inviata",
      createdAt: "2026-04-28T08:40:00.000Z"
    }
  ]
};

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public"), {
  setHeaders: (res, filePath) => {
    if (/\.(html|js|css|webmanifest)$/.test(filePath)) {
      res.setHeader("Cache-Control", "no-store");
    }
  }
}));

async function connectDb() {
  if (!mongoUri || mongoUri.includes("<db_password>")) {
    return null;
  }

  if (mongoConnectionDisabled) {
    return null;
  }

  if (db) {
    return db;
  }

  try {
    client = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true
      }
    });
    await client.connect();
    db = client.db(dbName);
    mongoConnectionError = null;
  } catch (error) {
    mongoConnectionError = error.message;
    mongoConnectionDisabled = true;
    db = null;

    if (client) {
      await client.close().catch(() => {});
      client = null;
    }

    console.warn(`MongoDB non raggiungibile, uso dati demo: ${mongoConnectionError}`);
    return null;
  }

  return db;
}

async function getCollectionData(collectionName, fallback) {
  const database = await connectDb();
  if (!database) return fallback;

  const docs = await database.collection(collectionName).find({}).limit(50).toArray();
  return docs.length ? docs : fallback;
}

const slug = (value) => String(value || "")
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

function splitEnvList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapeEmailHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isEmailServerConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function isEmailConfigured() {
  return isEmailServerConfigured();
}

function mailRecipientsFor(...values) {
  return [...new Set([...defaultMailRecipients, ...values.flatMap(splitEnvList)])];
}

function getMailTransporter() {
  if (mailTransporter) return mailTransporter;

  mailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: smtpPort,
    secure: process.env.SMTP_SECURE === "true" || smtpPort === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000
  });

  return mailTransporter;
}

async function sendNoticeEmail(notice, students = []) {
  const recipients = mailRecipientsFor(...students.map((student) => student?.email));
  if (!isEmailServerConfigured() || !recipients.length) {
    return { sent: false, reason: "Email non configurata" };
  }

  const from = process.env.NOTIFICATION_EMAIL_FROM || process.env.SMTP_USER;
  const subject = `[GabDat] ${notice.title}`;
  const createdAt = notice.createdAt instanceof Date ? notice.createdAt : new Date(notice.createdAt || Date.now());
  const text = [
    notice.title,
    "",
    notice.body,
    "",
    `Priorita: ${notice.priority || "Media"}`,
    `Data: ${createdAt.toLocaleString("it-IT")}`
  ].join("\n");
  const html = `
    <h2>${escapeEmailHtml(notice.title)}</h2>
    <p>${escapeEmailHtml(notice.body).replace(/\n/g, "<br>")}</p>
    <p><strong>Priorita:</strong> ${escapeEmailHtml(notice.priority || "Media")}</p>
    <p><strong>Data:</strong> ${escapeEmailHtml(createdAt.toLocaleString("it-IT"))}</p>
  `;

  await getMailTransporter().sendMail({
    from,
    to: recipients,
    subject,
    text,
    html
  });

  return { sent: true };
}

async function sendGradeEmail(grade, student) {
  const recipients = mailRecipientsFor(student?.email);
  if (!isEmailServerConfigured() || !recipients.length) {
    return { sent: false, reason: "Email non configurata" };
  }

  const from = process.env.NOTIFICATION_EMAIL_FROM || process.env.SMTP_USER;
  const subject = `[GabDat] Nuovo voto di ${grade.subject}`;
  const text = [
    `Ciao ${grade.studentName},`,
    "",
    `E stato inserito un nuovo voto in ${grade.subject}: ${grade.value}`,
    `Tipo: ${grade.type}`,
    `Quadrimestre: ${grade.term || "Nessuno"}`,
    `Docente: ${grade.teacher}`,
    `Data: ${grade.date}`,
    grade.explanation ? `Spiegazione: ${grade.explanation}` : "",
    "",
    "Accedi a GabDat per vedere il registro completo."
  ].filter(Boolean).join("\n");
  const html = `
    <h2>Nuovo voto in ${escapeEmailHtml(grade.subject)}</h2>
    <p>Ciao ${escapeEmailHtml(grade.studentName)}, e stato inserito un nuovo voto.</p>
    <p><strong>Voto:</strong> ${escapeEmailHtml(grade.value)}</p>
    <p><strong>Tipo:</strong> ${escapeEmailHtml(grade.type)}</p>
    <p><strong>Quadrimestre:</strong> ${escapeEmailHtml(grade.term || "Nessuno")}</p>
    <p><strong>Docente:</strong> ${escapeEmailHtml(grade.teacher)}</p>
    <p><strong>Data:</strong> ${escapeEmailHtml(grade.date)}</p>
    ${grade.explanation ? `<p><strong>Spiegazione:</strong> ${escapeEmailHtml(grade.explanation)}</p>` : ""}
    <p>Accedi a GabDat per vedere il registro completo.</p>
  `;

  await getMailTransporter().sendMail({
    from,
    to: recipients,
    subject,
    text,
    html
  });

  return { sent: true };
}

async function sendNotificationEmail({ subject, title, body, students = [] }) {
  const recipients = mailRecipientsFor(...students.map((student) => student?.email));
  if (!isEmailServerConfigured() || !recipients.length) {
    return { sent: false, reason: "Email non configurata" };
  }

  const from = process.env.NOTIFICATION_EMAIL_FROM || process.env.SMTP_USER;
  const text = [title, "", body, "", "Accedi a GabDat per vedere i dettagli."].join("\n");
  const html = `
    <h2>${escapeEmailHtml(title)}</h2>
    <p>${escapeEmailHtml(body).replace(/\n/g, "<br>")}</p>
    <p>Accedi a GabDat per vedere i dettagli.</p>
  `;

  await getMailTransporter().sendMail({
    from,
    to: recipients,
    subject,
    text,
    html
  });

  return { sent: true };
}

async function safeSendNotificationEmail(payload, label) {
  return sendNotificationEmail(payload).catch((error) => {
    console.warn(`Email ${label} non inviata: ${error.message}`);
    return { sent: false, reason: error.message };
  });
}

async function notificationStudents(database, classId) {
  if (database) {
    const query = classId ? { classId } : {};
    const students = await database.collection("students").find(query).toArray();
    return students.length ? students : demoData.students.filter((student) => !classId || student.classId === classId);
  }

  return demoData.students.filter((student) => !classId || student.classId === classId);
}

function normalizeStudents(students, classes) {
  return students.map((student) => {
    const matchingClass = classes.find((item) => item.id === student.classId || item.name === student.className);
    return {
      schoolYear: "2025/2026",
      absences: 0,
      delays: 0,
      presences: 0,
      notes: 0,
      average: 0,
      ...student,
      id: student.id || makeId("stu"),
      email: student.email || "",
      classId: student.classId || matchingClass?.id || slug(student.className || "classe"),
      className: student.className || matchingClass?.name || "Classe"
    };
  });
}

function getDemoStudent(studentId) {
  return demoData.students.find((student) => student.id === studentId) || demoData.students[0];
}

function getDemoClass(classId) {
  return demoData.classes.find((schoolClass) => schoolClass.id === classId) || demoData.classes[0];
}

function syncMainDemoStudent(student) {
  if (student.id === demoData.student.id) {
    demoData.student = { ...student };
  }
}

function recalculateDemoAverage(studentId) {
  const student = getDemoStudent(studentId);
  if (!student) return;

  const studentGrades = demoData.grades
    .filter((item) => !item.studentId || item.studentId === studentId)
    .map((item) => Number.parseFloat(item.value))
    .filter((value) => Number.isFinite(value));
  const total = studentGrades.reduce((sum, value) => sum + value, 0);
  student.average = studentGrades.length ? Number((total / studentGrades.length).toFixed(1)) : 0;
  syncMainDemoStudent(student);
}

async function recalculateDbAverage(database, studentId) {
  const studentGrades = await database.collection("grades").find({ studentId }).toArray();
  const numericGrades = studentGrades
    .map((item) => Number.parseFloat(item.value))
    .filter((value) => Number.isFinite(value));
  const total = numericGrades.reduce((sum, value) => sum + value, 0);
  const average = numericGrades.length ? Number((total / numericGrades.length).toFixed(1)) : 0;
  await database.collection("students").updateOne({ id: studentId }, { $set: { average } });
}

function normalizeGradeValue(value) {
  const trimmedValue = String(value).trim();
  const upperValue = trimmedValue.toUpperCase();
  if (upperValue === "SV") return "SV";
  if (["+", "-"].includes(trimmedValue)) return trimmedValue;
  return Number.parseFloat(trimmedValue);
}

app.get("/api/status", async (_req, res) => {
  try {
    const database = await connectDb();
    res.json({
      ok: true,
      database: database ? "connected" : "demo",
      mode: database ? "MongoDB Atlas" : "Demo locale",
      email: isEmailConfigured() ? "configured" : "not-configured",
      message: database ? null : mongoConnectionError
    });
  } catch (error) {
    res.status(500).json({ ok: false, database: "error", message: error.message });
  }
});

app.get("/api/dashboard", async (_req, res) => {
  try {
    const [rawTeachers, rawClasses, rawStudents, grades, homework, classwork, agenda, schedules, notices, attendance, notes, reportCards, dailyAttendance, lessonAttendance, earlyExits, justifications] = await Promise.all([
      getCollectionData("teachers", demoData.teachers),
      getCollectionData("classes", demoData.classes),
      getCollectionData("students", demoData.students),
      getCollectionData("grades", demoData.grades),
      getCollectionData("homework", demoData.homework),
      getCollectionData("classwork", demoData.classwork),
      getCollectionData("agenda", demoData.agenda),
      getCollectionData("schedules", demoData.schedules),
      getCollectionData("notices", demoData.notices),
      getCollectionData("attendance", demoData.attendance),
      getCollectionData("notes", demoData.notes),
      getCollectionData("reportCards", demoData.reportCards),
      getCollectionData("dailyAttendance", demoData.dailyAttendance),
      getCollectionData("lessonAttendance", demoData.lessonAttendance),
      getCollectionData("earlyExits", demoData.earlyExits),
      getCollectionData("justifications", demoData.justifications)
    ]);
    const teachers = rawTeachers.map((teacher, index) => ({
      ...teacher,
      id: teacher.id || teacher._id?.toString?.() || `teacher-${index + 1}`
    }));
    const fallbackTeacherId = teachers[0]?.id || "teacher-1";
    const classes = rawClasses.map((schoolClass) => ({
      ...schoolClass,
      teacherId: schoolClass.teacherId || fallbackTeacherId
    }));
    const students = normalizeStudents(rawStudents, classes);
    const normalizedGrades = grades.map((grade, index) => ({
      ...grade,
      id: grade.id || grade._id?.toString?.() || `demo-grade-${index}`,
      term: grade.term || ""
    }));
    const fallbackClass = classes[0];
    const normalizedHomework = homework.map((item, index) => ({
      ...item,
      id: item.id || item._id?.toString?.() || `demo-homework-${index}`,
      classId: item.classId || fallbackClass?.id || "",
      className: item.className || fallbackClass?.name || ""
    }));
    const normalizedAttendance = attendance.map((item, index) => ({
      ...item,
      id: item.id || item._id?.toString?.() || `demo-attendance-${index}`
    }));
    const normalizedNotes = notes.map((note, index) => ({
      ...note,
      id: note.id || note._id?.toString?.() || `demo-note-${index}`
    }));
    const normalizedNotices = notices.map((notice, index) => ({
      ...notice,
      id: notice.id || notice._id?.toString?.() || `demo-notice-${index}`,
      classId: notice.classId || fallbackClass?.id || "",
      className: notice.className || fallbackClass?.name || ""
    }));

    res.json({
      student: students[0] || demoData.student,
      teachers,
      classes,
      students,
      grades: normalizedGrades,
      homework: normalizedHomework,
      classwork,
      agenda,
      schedules,
      notices: normalizedNotices,
      attendance: normalizedAttendance,
      notes: normalizedNotes,
      reportCards,
      dailyAttendance,
      lessonAttendance,
      earlyExits,
      justifications
    });
  } catch (error) {
    res.status(500).json({ message: "Errore nel caricamento della dashboard", details: error.message });
  }
});

app.post("/api/classes", async (req, res) => {
  try {
    const { name, schoolYear, teacherId } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Il nome della classe e obbligatorio." });
    }

    const schoolClass = {
      id: slug(name) || makeId("class"),
      name,
      schoolYear: schoolYear || "2025/2026",
      teacherId: teacherId || demoData.teachers[0]?.id || "teacher-1",
      createdAt: new Date()
    };
    const database = await connectDb();

    if (!database) {
      demoData.classes.unshift(schoolClass);
      return res.status(201).json(schoolClass);
    }

    await database.collection("classes").updateOne({ id: schoolClass.id }, { $set: schoolClass }, { upsert: true });
    res.status(201).json(schoolClass);
  } catch (error) {
    res.status(500).json({ message: "Errore nel salvataggio della classe", details: error.message });
  }
});

app.put("/api/classes/:id", async (req, res) => {
  try {
    const classId = req.params.id;
    const { name, schoolYear, teacherId } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Il nome della classe e obbligatorio." });
    }

    const database = await connectDb();
    const updates = {
      name,
      schoolYear: schoolYear || "2025/2026",
      ...(teacherId ? { teacherId } : {}),
      updatedAt: new Date()
    };

    if (!database) {
      const schoolClass = demoData.classes.find((item) => item.id === classId);
      if (!schoolClass) {
        return res.status(404).json({ message: "Classe non trovata." });
      }

      Object.assign(schoolClass, updates);
      demoData.students.forEach((student) => {
        if (student.classId === classId) student.className = updates.name;
      });
      demoData.grades.forEach((grade) => {
        if (grade.classId === classId) grade.className = updates.name;
      });
      demoData.reportCards.forEach((card) => {
        if (card.classId === classId) card.className = updates.name;
      });
      demoData.dailyAttendance.forEach((record) => {
        if (record.classId === classId) record.className = updates.name;
      });
      demoData.earlyExits.forEach((item) => {
        if (item.classId === classId) item.className = updates.name;
      });
      demoData.justifications.forEach((item) => {
        if (item.classId === classId) item.className = updates.name;
      });
      return res.json({ id: classId, ...updates });
    }

    await Promise.all([
      database.collection("classes").updateOne({ id: classId }, { $set: updates }),
      database.collection("students").updateMany({ classId }, { $set: { className: updates.name } }),
      database.collection("grades").updateMany({ classId }, { $set: { className: updates.name } }),
      database.collection("reportCards").updateMany({ classId }, { $set: { className: updates.name } }),
      database.collection("dailyAttendance").updateMany({ classId }, { $set: { className: updates.name } }),
      database.collection("earlyExits").updateMany({ classId }, { $set: { className: updates.name } }),
      database.collection("justifications").updateMany({ classId }, { $set: { className: updates.name } })
    ]);

    res.json({ id: classId, ...updates });
  } catch (error) {
    res.status(500).json({ message: "Errore nell'aggiornamento della classe", details: error.message });
  }
});

app.post("/api/teachers", async (req, res) => {
  try {
    const { name, subject } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Il nome dell'insegnante e obbligatorio." });
    }

    const teacher = {
      id: makeId("teacher"),
      name,
      subject: subject || "",
      createdAt: new Date()
    };
    const database = await connectDb();

    if (!database) {
      demoData.teachers.unshift(teacher);
      return res.status(201).json(teacher);
    }

    await database.collection("teachers").insertOne(teacher);
    res.status(201).json(teacher);
  } catch (error) {
    res.status(500).json({ message: "Errore nel salvataggio dell'insegnante", details: error.message });
  }
});

app.put("/api/teachers/:id", async (req, res) => {
  try {
    const teacherId = req.params.id;
    const { name, subject } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Il nome dell'insegnante e obbligatorio." });
    }

    const updates = {
      name,
      subject: subject || "",
      updatedAt: new Date()
    };
    const database = await connectDb();

    if (!database) {
      const teacher = demoData.teachers.find((item) => item.id === teacherId);
      if (!teacher) return res.status(404).json({ message: "Insegnante non trovato." });
      Object.assign(teacher, updates);
      return res.json({ id: teacherId, ...updates });
    }

    const result = await database.collection("teachers").updateOne({ id: teacherId }, { $set: updates });
    if (!result.matchedCount) return res.status(404).json({ message: "Insegnante non trovato." });
    res.json({ id: teacherId, ...updates });
  } catch (error) {
    res.status(500).json({ message: "Errore nell'aggiornamento dell'insegnante", details: error.message });
  }
});

app.delete("/api/teachers/:id", async (req, res) => {
  try {
    const teacherId = req.params.id;
    const fallbackTeacher = demoData.teachers.find((item) => item.id !== teacherId) || demoData.teachers[0];
    const fallbackTeacherId = fallbackTeacher?.id || "";
    const database = await connectDb();

    if (!database) {
      if (demoData.teachers.length <= 1) {
        return res.status(400).json({ message: "Deve restare almeno un insegnante." });
      }
      demoData.teachers = demoData.teachers.filter((item) => item.id !== teacherId);
      demoData.classes.forEach((schoolClass) => {
        if (schoolClass.teacherId === teacherId) schoolClass.teacherId = fallbackTeacherId;
      });
      return res.json({ ok: true, removed: teacherId, reassignedTo: fallbackTeacherId });
    }

    const teacherCount = await database.collection("teachers").countDocuments();
    if (teacherCount <= 1) {
      return res.status(400).json({ message: "Deve restare almeno un insegnante." });
    }

    const fallback = await database.collection("teachers").findOne({ id: { $ne: teacherId } });
    if (!fallback) return res.status(400).json({ message: "Nessun insegnante alternativo disponibile." });

    const result = await database.collection("teachers").deleteOne({ id: teacherId });
    if (!result.deletedCount) return res.status(404).json({ message: "Insegnante non trovato." });
    await database.collection("classes").updateMany({ teacherId }, { $set: { teacherId: fallback.id } });
    res.json({ ok: true, removed: teacherId, reassignedTo: fallback.id });
  } catch (error) {
    res.status(500).json({ message: "Errore nell'eliminazione dell'insegnante", details: error.message });
  }
});

app.delete("/api/classes/:id", async (req, res) => {
  try {
    const classId = req.params.id;
    const database = await connectDb();

    if (!database) {
      const studentIds = demoData.students
        .filter((student) => student.classId === classId)
        .map((student) => student.id);

      demoData.classes = demoData.classes.filter((schoolClass) => schoolClass.id !== classId);
      demoData.students = demoData.students.filter((student) => student.classId !== classId);
      demoData.grades = demoData.grades.filter((grade) => grade.classId !== classId && !studentIds.includes(grade.studentId));
      demoData.attendance = demoData.attendance.filter((item) => !studentIds.includes(item.studentId));
      demoData.notes = demoData.notes.filter((note) => !studentIds.includes(note.studentId));
      demoData.reportCards = demoData.reportCards.filter((card) => card.classId !== classId && !studentIds.includes(card.studentId));
      demoData.dailyAttendance = demoData.dailyAttendance.filter((record) => record.classId !== classId);
      demoData.student = demoData.students[0] || demoData.student;
      return res.json({ ok: true, removed: classId });
    }

    const students = await database.collection("students").find({ classId }).toArray();
    const studentIds = students.map((student) => student.id);

    await Promise.all([
      database.collection("classes").deleteOne({ id: classId }),
      database.collection("students").deleteMany({ classId }),
      database.collection("grades").deleteMany({ $or: [{ classId }, { studentId: { $in: studentIds } }] }),
      database.collection("attendance").deleteMany({ studentId: { $in: studentIds } }),
      database.collection("notes").deleteMany({ studentId: { $in: studentIds } }),
      database.collection("reportCards").deleteMany({ $or: [{ classId }, { studentId: { $in: studentIds } }] }),
      database.collection("dailyAttendance").deleteMany({ classId })
    ]);

    res.json({ ok: true, removed: classId });
  } catch (error) {
    res.status(500).json({ message: "Errore nell'eliminazione della classe", details: error.message });
  }
});

app.post("/api/students", async (req, res) => {
  try {
    const { name, email, classId, schoolYear } = req.body;
    if (!name || !classId) {
      return res.status(400).json({ message: "Nome e classe sono obbligatori." });
    }

    const database = await connectDb();
    let schoolClass = getDemoClass(classId);
    let classStudents = demoData.students.filter((student) => student.classId === classId);

    if (database) {
      const [dbClass, dbStudents] = await Promise.all([
        database.collection("classes").findOne({ id: classId }),
        database.collection("students").find({ classId }).toArray()
      ]);
      schoolClass = dbClass || schoolClass;
      classStudents = dbStudents.length ? dbStudents : classStudents;
    }

    const student = {
      id: makeId("stu"),
      name,
      email: email || "",
      classId,
      className: schoolClass.name,
      schoolYear: schoolYear || schoolClass.schoolYear || "2025/2026",
      average: 0,
      absences: 0,
      delays: 0,
      presences: 0,
      notes: 0,
      createdAt: new Date()
    };

    if (!database) {
      demoData.students.push(student);
      return res.status(201).json(student);
    }

    await database.collection("students").insertOne(student);
    res.status(201).json(student);
  } catch (error) {
    res.status(500).json({ message: "Errore nel salvataggio dell'alunno", details: error.message });
  }
});

app.post("/api/students/:id", async (req, res) => {
  try {
    const { name, email, classId, className, average } = req.body;
    if (!name || !className) {
      return res.status(400).json({ message: "Nome e classe sono obbligatori." });
    }

    const database = await connectDb();
    const updates = {
      name,
      email: email || "",
      classId,
      className,
      average: Number.parseFloat(average) || 0,
      updatedAt: new Date()
    };

    if (!database) {
      const student = getDemoStudent(req.params.id);
      Object.assign(student, updates);
      syncMainDemoStudent(student);
      return res.json(student);
    }

    await database.collection("students").updateOne({ id: req.params.id }, { $set: updates }, { upsert: true });
    res.json({ id: req.params.id, ...updates });
  } catch (error) {
    res.status(500).json({ message: "Errore nell'aggiornamento dell'alunno", details: error.message });
  }
});

app.delete("/api/students/:id", async (req, res) => {
  try {
    const studentId = req.params.id;
    const database = await connectDb();

    if (!database) {
      demoData.students = demoData.students.filter((student) => student.id !== studentId);
      demoData.attendance = demoData.attendance.filter((item) => item.studentId !== studentId);
      demoData.notes = demoData.notes.filter((note) => note.studentId !== studentId);
      demoData.reportCards = demoData.reportCards.filter((card) => card.studentId !== studentId);
      demoData.dailyAttendance = demoData.dailyAttendance.map((record) => ({
        ...record,
        rows: record.rows.filter((row) => row.studentId !== studentId)
      }));
      demoData.student = demoData.students[0] || demoData.student;
      return res.json({ ok: true, removed: studentId });
    }

    await Promise.all([
      database.collection("students").deleteOne({ id: studentId }),
      database.collection("attendance").deleteMany({ studentId }),
      database.collection("notes").deleteMany({ studentId }),
      database.collection("reportCards").deleteMany({ studentId }),
      database.collection("dailyAttendance").updateMany({}, { $pull: { rows: { studentId } } })
    ]);

    res.json({ ok: true, removed: studentId });
  } catch (error) {
    res.status(500).json({ message: "Errore nella rimozione dell'alunno", details: error.message });
  }
});

app.post("/api/attendance", async (req, res) => {
  try {
    const { studentId, type, date, details } = req.body;
    if (!studentId || !type || !date) {
      return res.status(400).json({ message: "Alunno, tipo e data sono obbligatori." });
    }

    const database = await connectDb();
    let student = getDemoStudent(studentId);

    if (database) {
      const dbStudent = await database.collection("students").findOne({ id: studentId });
      student = dbStudent || student;
    }

    const item = {
      id: makeId("attendance"),
      studentId,
      studentName: student.name,
      type,
      date,
      details: details || type,
      createdAt: new Date()
    };

    const counters = {};
    if (type === "Presenza") counters.presences = 1;
    if (type === "Assenza") counters.absences = 1;
    if (type === "Ritardo") counters.delays = 1;

    if (!database) {
      demoData.attendance.unshift(item);
      Object.entries(counters).forEach(([key, value]) => {
        student[key] = (student[key] || 0) + value;
      });
      syncMainDemoStudent(student);
      const email = type === "Presenza" ? { sent: false, reason: "Presenza senza notifica" } : await safeSendNotificationEmail({
        subject: `[GabDat] ${type} registrato`,
        title: `${type} registrato`,
        body: `${student.name}: ${type} del ${date}.${details ? `\n${details}` : ""}`,
        students: [student]
      }, "registro");
      return res.status(201).json({ ...item, email });
    }

    await database.collection("attendance").insertOne(item);
    if (Object.keys(counters).length) {
      await database.collection("students").updateOne({ id: studentId }, { $inc: counters });
    }
    const email = type === "Presenza" ? { sent: false, reason: "Presenza senza notifica" } : await safeSendNotificationEmail({
      subject: `[GabDat] ${type} registrato`,
      title: `${type} registrato`,
      body: `${student.name}: ${type} del ${date}.${details ? `\n${details}` : ""}`,
      students: [student]
    }, "registro");
    res.status(201).json({ ...item, email });
  } catch (error) {
    res.status(500).json({ message: "Errore nel salvataggio del registro", details: error.message });
  }
});

app.delete("/api/attendance/:id", async (req, res) => {
  try {
    const attendanceId = req.params.id;
    const database = await connectDb();

    const decrementCounters = (type) => {
      const counters = {};
      if (type === "Presenza") counters.presences = -1;
      if (type === "Assenza") counters.absences = -1;
      if (type === "Ritardo") counters.delays = -1;
      return counters;
    };

    if (!database) {
      const demoIndex = attendanceId.startsWith("demo-attendance-") ? Number.parseInt(attendanceId.replace("demo-attendance-", ""), 10) : -1;
      const index = demoIndex >= 0
        ? demoIndex
        : demoData.attendance.findIndex((item) => item.id === attendanceId);
      const [removed] = index >= 0 ? demoData.attendance.splice(index, 1) : [];
      if (!removed) {
        return res.status(404).json({ message: "Voce del registro non trovata." });
      }
      const student = getDemoStudent(removed.studentId);
      if (student) {
        Object.entries(decrementCounters(removed.type)).forEach(([key, value]) => {
          student[key] = Math.max((student[key] || 0) + value, 0);
        });
        syncMainDemoStudent(student);
      }
      return res.json({ ok: true, removed: attendanceId });
    }

    const query = ObjectId.isValid(attendanceId)
      ? { $or: [{ id: attendanceId }, { _id: new ObjectId(attendanceId) }] }
      : { id: attendanceId };
    const removed = await database.collection("attendance").findOne(query);
    if (!removed) {
      return res.status(404).json({ message: "Voce del registro non trovata." });
    }

    await database.collection("attendance").deleteOne(query);
    const counters = decrementCounters(removed.type);
    if (removed.studentId && Object.keys(counters).length) {
      await database.collection("students").updateOne({ id: removed.studentId }, { $inc: counters });
    }
    res.json({ ok: true, removed: attendanceId });
  } catch (error) {
    res.status(500).json({ message: "Errore nell'eliminazione dal registro", details: error.message });
  }
});

app.post("/api/early-exits", async (req, res) => {
  try {
    const { studentId, date, time, reason } = req.body;
    if (!studentId || !date || !time || !reason) {
      return res.status(400).json({ message: "Studente, data, ora e motivo sono obbligatori." });
    }

    const database = await connectDb();
    let student = getDemoStudent(studentId);

    if (database) {
      const dbStudent = await database.collection("students").findOne({ id: studentId });
      student = dbStudent || student;
    }

    const earlyExit = {
      id: makeId("exit"),
      studentId,
      studentName: student.name,
      classId: student.classId,
      className: student.className,
      date,
      time,
      reason,
      status: "Programmato",
      createdAt: new Date()
    };

    if (!database) {
      demoData.earlyExits.unshift(earlyExit);
      return res.status(201).json(earlyExit);
    }

    await database.collection("earlyExits").insertOne(earlyExit);
    res.status(201).json(earlyExit);
  } catch (error) {
    res.status(500).json({ message: "Errore nel salvataggio dell'uscita anticipata", details: error.message });
  }
});

app.post("/api/notices", async (req, res) => {
  try {
    const { title, body, priority, classId } = req.body;
    if (!classId || !title || !body) {
      return res.status(400).json({ message: "Classe, titolo e testo della comunicazione sono obbligatori." });
    }

    const database = await connectDb();
    let schoolClass = getDemoClass(classId);

    if (database) {
      const dbClass = await database.collection("classes").findOne({ id: classId });
      schoolClass = dbClass || schoolClass;
    }

    const notice = {
      id: makeId("notice"),
      classId,
      className: schoolClass?.name || "",
      title,
      body,
      priority: priority || "Media",
      createdAt: new Date()
    };
    const students = await notificationStudents(database, classId);

    if (!database) {
      demoData.notices.unshift(notice);
      const email = await sendNoticeEmail(notice, students).catch((error) => {
        console.warn(`Email comunicazione non inviata: ${error.message}`);
        return { sent: false, reason: error.message };
      });
      return res.status(201).json({ ...notice, email });
    }

    await database.collection("notices").insertOne(notice);
    const email = await sendNoticeEmail(notice, students).catch((error) => {
      console.warn(`Email comunicazione non inviata: ${error.message}`);
      return { sent: false, reason: error.message };
    });
    res.status(201).json({ ...notice, email });
  } catch (error) {
    res.status(500).json({ message: "Errore nel salvataggio della comunicazione", details: error.message });
  }
});

app.put("/api/notices/:id", async (req, res) => {
  try {
    const noticeId = req.params.id;
    const { title, body, priority, classId } = req.body;
    if (!classId || !title || !body) {
      return res.status(400).json({ message: "Classe, titolo e testo della comunicazione sono obbligatori." });
    }

    const database = await connectDb();
    let schoolClass = getDemoClass(classId);

    if (database) {
      const dbClass = await database.collection("classes").findOne({ id: classId });
      schoolClass = dbClass || schoolClass;
    }

    const updates = {
      classId,
      className: schoolClass?.name || "",
      title,
      body,
      priority: priority || "Media",
      updatedAt: new Date()
    };

    if (!database) {
      const notice = demoData.notices.find((item) => (item.id || item._id?.toString?.()) === noticeId);
      if (!notice) {
        return res.status(404).json({ message: "Comunicazione non trovata." });
      }
      Object.assign(notice, updates);
      return res.json(notice);
    }

    const query = ObjectId.isValid(noticeId) ? { $or: [{ id: noticeId }, { _id: new ObjectId(noticeId) }] } : { id: noticeId };
    const result = await database.collection("notices").updateOne(query, { $set: updates });
    if (!result.matchedCount) {
      return res.status(404).json({ message: "Comunicazione non trovata." });
    }
    res.json({ id: noticeId, ...updates });
  } catch (error) {
    res.status(500).json({ message: "Errore nell'aggiornamento della comunicazione", details: error.message });
  }
});

app.delete("/api/notices/:id", async (req, res) => {
  try {
    const noticeId = req.params.id;
    const database = await connectDb();

    if (!database) {
      const before = demoData.notices.length;
      demoData.notices = demoData.notices.filter((item) => (item.id || item._id?.toString?.()) !== noticeId);
      if (demoData.notices.length === before) {
        return res.status(404).json({ message: "Comunicazione non trovata." });
      }
      return res.json({ ok: true, removed: noticeId });
    }

    const query = ObjectId.isValid(noticeId) ? { $or: [{ id: noticeId }, { _id: new ObjectId(noticeId) }] } : { id: noticeId };
    const result = await database.collection("notices").deleteOne(query);
    if (!result.deletedCount) {
      return res.status(404).json({ message: "Comunicazione non trovata." });
    }
    res.json({ ok: true, removed: noticeId });
  } catch (error) {
    res.status(500).json({ message: "Errore nell'eliminazione della comunicazione", details: error.message });
  }
});

app.post("/api/justifications", async (req, res) => {
  try {
    const { studentId, type, date, time, reason } = req.body;
    if (!studentId || !type || !date || !reason) {
      return res.status(400).json({ message: "Studente, tipo, data e motivo sono obbligatori." });
    }

    const database = await connectDb();
    let student = getDemoStudent(studentId);

    if (database) {
      const dbStudent = await database.collection("students").findOne({ id: studentId });
      student = dbStudent || student;
    }

    const justification = {
      id: makeId("justification"),
      studentId,
      studentName: student.name,
      classId: student.classId,
      className: student.className,
      type,
      date,
      time: time || "",
      reason,
      status: "Inviata",
      createdAt: new Date()
    };

    if (!database) {
      demoData.justifications.unshift(justification);
      return res.status(201).json(justification);
    }

    await database.collection("justifications").insertOne(justification);
    res.status(201).json(justification);
  } catch (error) {
    res.status(500).json({ message: "Errore nel salvataggio della giustificazione", details: error.message });
  }
});

app.post("/api/schedules", async (req, res) => {
  try {
    const { classId, day, time, endTime, subject, room, teacher } = req.body;
    if (!classId || !day || !time || !subject) {
      return res.status(400).json({ message: "Classe, giorno, ora e materia sono obbligatori." });
    }

    const database = await connectDb();
    let schoolClass = getDemoClass(classId);

    if (database) {
      const dbClass = await database.collection("classes").findOne({ id: classId });
      schoolClass = dbClass || schoolClass;
    }

    const schedule = {
      id: makeId("schedule"),
      classId,
      className: schoolClass.name,
      day,
      time,
      endTime: endTime || "",
      subject,
      room: room || "",
      teacher: teacher || "",
      createdAt: new Date()
    };

    if (!database) {
      demoData.schedules.push(schedule);
      return res.status(201).json(schedule);
    }

    await database.collection("schedules").insertOne(schedule);
    res.status(201).json(schedule);
  } catch (error) {
    res.status(500).json({ message: "Errore nel salvataggio dell'orario", details: error.message });
  }
});

app.put("/api/schedules/:id", async (req, res) => {
  try {
    const scheduleId = req.params.id;
    const { classId, day, time, endTime, subject, room, teacher } = req.body;
    if (!classId || !day || !time || !subject) {
      return res.status(400).json({ message: "Classe, giorno, ora e materia sono obbligatori." });
    }

    const database = await connectDb();
    let schoolClass = getDemoClass(classId);

    if (database) {
      const dbClass = await database.collection("classes").findOne({ id: classId });
      schoolClass = dbClass || schoolClass;
    }

    const updates = {
      classId,
      className: schoolClass.name,
      day,
      time,
      endTime: endTime || "",
      subject,
      room: room || "",
      teacher: teacher || "",
      updatedAt: new Date()
    };

    if (!database) {
      const schedule = demoData.schedules.find((item) => item.id === scheduleId);
      if (!schedule) {
        return res.status(404).json({ message: "Lezione non trovata." });
      }
      Object.assign(schedule, updates);
      return res.json(schedule);
    }

    const result = await database.collection("schedules").findOneAndUpdate(
      { id: scheduleId },
      { $set: updates },
      { returnDocument: "after" }
    );

    const updatedSchedule = result.value || await database.collection("schedules").findOne({ id: scheduleId });
    if (!updatedSchedule) {
      return res.status(404).json({ message: "Lezione non trovata." });
    }

    res.json(updatedSchedule);
  } catch (error) {
    res.status(500).json({ message: "Errore nell'aggiornamento della lezione", details: error.message });
  }
});

app.delete("/api/schedules/:id", async (req, res) => {
  try {
    const scheduleId = req.params.id;
    const database = await connectDb();

    if (!database) {
      const before = demoData.schedules.length;
      demoData.schedules = demoData.schedules.filter((item) => item.id !== scheduleId);
      if (demoData.schedules.length === before) {
        return res.status(404).json({ message: "Lezione non trovata." });
      }
      return res.json({ ok: true, removed: scheduleId });
    }

    const result = await database.collection("schedules").deleteOne({ id: scheduleId });
    if (!result.deletedCount) {
      return res.status(404).json({ message: "Lezione non trovata." });
    }

    res.json({ ok: true, removed: scheduleId });
  } catch (error) {
    res.status(500).json({ message: "Errore nell'eliminazione della lezione", details: error.message });
  }
});

app.post("/api/daily-attendance", async (req, res) => {
  try {
    const { classId, date, rows } = req.body;
    if (!classId || !date || !Array.isArray(rows)) {
      return res.status(400).json({ message: "Classe, data e righe del registro sono obbligatorie." });
    }

    const database = await connectDb();
    let schoolClass = getDemoClass(classId);
    let students = demoData.students;

    if (database) {
      const [dbClass, dbStudents] = await Promise.all([
        database.collection("classes").findOne({ id: classId }),
        database.collection("students").find({ classId }).toArray()
      ]);
      schoolClass = dbClass || schoolClass;
      students = dbStudents.length ? dbStudents : students;
    }

    const normalizedRows = rows.map((row) => {
      const student = students.find((item) => item.id === row.studentId) || getDemoStudent(row.studentId);
      return {
        studentId: row.studentId,
        studentName: student.name,
        status: row.status || "Presente",
        details: row.details || ""
      };
    });

    const record = {
      classId,
      className: schoolClass.name,
      date,
      rows: normalizedRows,
      savedAt: new Date()
    };

    if (!database) {
      demoData.dailyAttendance = demoData.dailyAttendance.filter((item) => !(item.classId === classId && item.date === date));
      demoData.dailyAttendance.unshift(record);
      const email = await Promise.all(normalizedRows
        .filter((row) => row.status !== "Presente")
        .map((row) => {
          const student = students.find((item) => item.id === row.studentId) || getDemoStudent(row.studentId);
          return safeSendNotificationEmail({
            subject: `[GabDat] ${row.status} registrato`,
            title: `${row.status} registrato`,
            body: `${row.studentName}: ${row.status} del ${date}.${row.details ? `\n${row.details}` : ""}`,
            students: [student]
          }, "registro giornaliero");
        }));
      return res.status(201).json({ ...record, email });
    }

    await database.collection("dailyAttendance").deleteMany({ classId, date });
    await database.collection("dailyAttendance").insertOne(record);
    const email = await Promise.all(normalizedRows
      .filter((row) => row.status !== "Presente")
      .map((row) => {
        const student = students.find((item) => item.id === row.studentId) || getDemoStudent(row.studentId);
        return safeSendNotificationEmail({
          subject: `[GabDat] ${row.status} registrato`,
          title: `${row.status} registrato`,
          body: `${row.studentName}: ${row.status} del ${date}.${row.details ? `\n${row.details}` : ""}`,
          students: [student]
        }, "registro giornaliero");
      }));
    res.status(201).json({ ...record, email });
  } catch (error) {
    res.status(500).json({ message: "Errore nel salvataggio del registro giornaliero", details: error.message });
  }
});

app.delete("/api/daily-attendance/:classId/:date", async (req, res) => {
  try {
    const { classId, date } = req.params;
    const database = await connectDb();

    if (!database) {
      const beforeDaily = demoData.dailyAttendance.length;
      const beforeLesson = demoData.lessonAttendance.length;
      demoData.dailyAttendance = demoData.dailyAttendance.filter((item) => !(item.classId === classId && item.date === date));
      demoData.lessonAttendance = demoData.lessonAttendance.filter((item) => !(item.classId === classId && item.date === date));
      return res.json({
        ok: true,
        removed: (beforeDaily - demoData.dailyAttendance.length) + (beforeLesson - demoData.lessonAttendance.length)
      });
    }

    const [dailyResult, lessonResult] = await Promise.all([
      database.collection("dailyAttendance").deleteMany({ classId, date }),
      database.collection("lessonAttendance").deleteMany({ classId, date })
    ]);

    res.json({ ok: true, removed: dailyResult.deletedCount + lessonResult.deletedCount });
  } catch (error) {
    res.status(500).json({ message: "Errore nell'eliminazione della giornata salvata", details: error.message });
  }
});

app.post("/api/lesson-attendance", async (req, res) => {
  try {
    const { classId, scheduleId, date, rows } = req.body;
    if (!classId || !scheduleId || !date || !Array.isArray(rows)) {
      return res.status(400).json({ message: "Classe, lezione, data e righe del registro sono obbligatorie." });
    }

    const database = await connectDb();
    let schoolClass = getDemoClass(classId);
    let students = demoData.students;
    let schedule = demoData.schedules.find((item) => item.id === scheduleId);

    if (database) {
      const [dbClass, dbStudents, dbSchedule] = await Promise.all([
        database.collection("classes").findOne({ id: classId }),
        database.collection("students").find({ classId }).toArray(),
        database.collection("schedules").findOne({ id: scheduleId })
      ]);
      schoolClass = dbClass || schoolClass;
      students = dbStudents.length ? dbStudents : students;
      schedule = dbSchedule || schedule;
    }

    if (!schedule) {
      return res.status(404).json({ message: "Lezione non trovata." });
    }

    const normalizedRows = rows.map((row) => {
      const student = students.find((item) => item.id === row.studentId) || getDemoStudent(row.studentId);
      return {
        studentId: row.studentId,
        studentName: student.name,
        status: row.status || "Presente",
        details: row.details || ""
      };
    });

    const record = {
      classId,
      className: schoolClass.name,
      scheduleId,
      lessonLabel: `${schedule.time} ${schedule.subject}`,
      subject: schedule.subject,
      day: schedule.day,
      time: schedule.time,
      endTime: schedule.endTime || "",
      date,
      rows: normalizedRows,
      savedAt: new Date()
    };

    if (!database) {
      demoData.lessonAttendance = demoData.lessonAttendance.filter((item) => !(item.classId === classId && item.scheduleId === scheduleId && item.date === date));
      demoData.lessonAttendance.unshift(record);
      const email = await Promise.all(normalizedRows
        .filter((row) => row.status !== "Presente")
        .map((row) => {
          const student = students.find((item) => item.id === row.studentId) || getDemoStudent(row.studentId);
          return safeSendNotificationEmail({
            subject: `[GabDat] ${row.status} in ${schedule.subject}`,
            title: `${row.status} registrato`,
            body: `${row.studentName}: ${row.status} del ${date} durante ${schedule.subject}.${row.details ? `\n${row.details}` : ""}`,
            students: [student]
          }, "registro lezione");
        }));
      return res.status(201).json({ ...record, email });
    }

    await database.collection("lessonAttendance").deleteMany({ classId, scheduleId, date });
    await database.collection("lessonAttendance").insertOne(record);
    const email = await Promise.all(normalizedRows
      .filter((row) => row.status !== "Presente")
      .map((row) => {
        const student = students.find((item) => item.id === row.studentId) || getDemoStudent(row.studentId);
        return safeSendNotificationEmail({
          subject: `[GabDat] ${row.status} in ${schedule.subject}`,
          title: `${row.status} registrato`,
          body: `${row.studentName}: ${row.status} del ${date} durante ${schedule.subject}.${row.details ? `\n${row.details}` : ""}`,
          students: [student]
        }, "registro lezione");
      }));
    res.status(201).json({ ...record, email });
  } catch (error) {
    res.status(500).json({ message: "Errore nel salvataggio del registro della lezione", details: error.message });
  }
});

app.post("/api/notes", async (req, res) => {
  try {
    const { studentId, classId, teacher, type, body, date } = req.body;
    if ((!studentId && !classId) || !teacher || !body || !date) {
      return res.status(400).json({ message: "Alunno o classe, docente, testo e data sono obbligatori." });
    }

    const database = await connectDb();
    let student = studentId ? getDemoStudent(studentId) : null;
    let schoolClass = classId ? getDemoClass(classId) : null;
    let classStudents = classId ? demoData.students.filter((item) => item.classId === classId) : [];

    if (database) {
      const [dbStudent, dbClass, dbClassStudents] = await Promise.all([
        studentId ? database.collection("students").findOne({ id: studentId }) : null,
        classId ? database.collection("classes").findOne({ id: classId }) : null,
        classId ? database.collection("students").find({ classId }).toArray() : []
      ]);
      student = dbStudent || student;
      schoolClass = dbClass || schoolClass;
      classStudents = dbClassStudents.length ? dbClassStudents : classStudents;
    }

    if (studentId && !student) {
      return res.status(404).json({ message: "Alunno non trovato." });
    }
    if (classId && !schoolClass) {
      return res.status(404).json({ message: "Classe non trovata." });
    }

    const note = {
      id: makeId("note"),
      studentId: student?.id || "",
      studentName: student?.name || "Tutta la classe",
      classId: student?.classId || schoolClass?.id || "",
      className: student?.className || schoolClass?.name || "",
      teacher,
      type: type || "Note disciplinari",
      body,
      date,
      createdAt: new Date()
    };

    if (!database) {
      demoData.notes.unshift(note);
      const affectedStudents = student ? [student] : classStudents;
      affectedStudents.forEach((item) => {
        item.notes = (item.notes || 0) + 1;
        syncMainDemoStudent(item);
      });
      const email = await safeSendNotificationEmail({
        subject: `[GabDat] Nuova nota`,
        title: `${note.type}`,
        body: `${note.teacher}: ${note.body}\nData: ${note.date}`,
        students: affectedStudents
      }, "nota");
      return res.status(201).json({ ...note, email });
    }

    await database.collection("notes").insertOne(note);
    if (student) {
      await database.collection("students").updateOne({ id: student.id }, { $inc: { notes: 1 } });
    } else {
      await database.collection("students").updateMany({ classId: schoolClass.id }, { $inc: { notes: 1 } });
    }
    const affectedStudents = student ? [student] : classStudents;
    const email = await safeSendNotificationEmail({
      subject: `[GabDat] Nuova nota`,
      title: `${note.type}`,
      body: `${note.teacher}: ${note.body}\nData: ${note.date}`,
      students: affectedStudents
    }, "nota");
    res.status(201).json({ ...note, email });
  } catch (error) {
    res.status(500).json({ message: "Errore nel salvataggio della nota", details: error.message });
  }
});

app.put("/api/notes/:id", async (req, res) => {
  try {
    const noteId = req.params.id;
    const { studentId, classId, teacher, type, body, date } = req.body;
    if ((!studentId && !classId) || !teacher || !body || !date) {
      return res.status(400).json({ message: "Alunno o classe, docente, testo e data sono obbligatori." });
    }

    const database = await connectDb();
    let student = studentId ? getDemoStudent(studentId) : null;
    let schoolClass = classId ? getDemoClass(classId) : null;
    let classStudents = classId ? demoData.students.filter((item) => item.classId === classId) : [];

    if (database) {
      const [dbStudent, dbClass, dbClassStudents] = await Promise.all([
        studentId ? database.collection("students").findOne({ id: studentId }) : null,
        classId ? database.collection("classes").findOne({ id: classId }) : null,
        classId ? database.collection("students").find({ classId }).toArray() : []
      ]);
      student = dbStudent || student;
      schoolClass = dbClass || schoolClass;
      classStudents = dbClassStudents.length ? dbClassStudents : classStudents;
    }

    if (studentId && !student) {
      return res.status(404).json({ message: "Alunno non trovato." });
    }
    if (classId && !schoolClass) {
      return res.status(404).json({ message: "Classe non trovata." });
    }

    const updates = {
      studentId: student?.id || "",
      studentName: student?.name || "Tutta la classe",
      classId: student?.classId || schoolClass?.id || "",
      className: student?.className || schoolClass?.name || "",
      teacher,
      type: type || "Note disciplinari",
      body,
      date,
      updatedAt: new Date()
    };

    if (!database) {
      const demoIndex = noteId.startsWith("demo-note-") ? Number.parseInt(noteId.replace("demo-note-", ""), 10) : -1;
      const note = demoIndex >= 0 ? demoData.notes[demoIndex] : demoData.notes.find((item) => item.id === noteId);
      if (!note) {
        return res.status(404).json({ message: "Nota non trovata." });
      }
      const previousAudience = note.studentId ? `student:${note.studentId}` : `class:${note.classId}`;
      const nextAudience = updates.studentId ? `student:${updates.studentId}` : `class:${updates.classId}`;
      Object.assign(note, updates);
      if (previousAudience !== nextAudience) {
        const previousStudents = previousAudience.startsWith("student:")
          ? [getDemoStudent(previousAudience.replace("student:", ""))].filter(Boolean)
          : demoData.students.filter((item) => item.classId === previousAudience.replace("class:", ""));
        const nextStudents = student ? [student] : classStudents;
        previousStudents.forEach((item) => {
          item.notes = Math.max((item.notes || 1) - 1, 0);
          syncMainDemoStudent(item);
        });
        nextStudents.forEach((item) => {
          item.notes = (item.notes || 0) + 1;
          syncMainDemoStudent(item);
        });
      }
      return res.json(note);
    }

    const query = ObjectId.isValid(noteId)
      ? { $or: [{ id: noteId }, { _id: new ObjectId(noteId) }] }
      : { id: noteId };
    const previousNote = await database.collection("notes").findOne(query);
    if (!previousNote) {
      return res.status(404).json({ message: "Nota non trovata." });
    }

    await database.collection("notes").updateOne(query, { $set: updates });
    const previousAudience = previousNote.studentId ? `student:${previousNote.studentId}` : `class:${previousNote.classId}`;
    const nextAudience = updates.studentId ? `student:${updates.studentId}` : `class:${updates.classId}`;
    if (previousAudience !== nextAudience) {
      const decrement = previousNote.studentId
        ? database.collection("students").updateOne({ id: previousNote.studentId }, { $inc: { notes: -1 } })
        : database.collection("students").updateMany({ classId: previousNote.classId }, { $inc: { notes: -1 } });
      const increment = updates.studentId
        ? database.collection("students").updateOne({ id: updates.studentId }, { $inc: { notes: 1 } })
        : database.collection("students").updateMany({ classId: updates.classId }, { $inc: { notes: 1 } });
      await Promise.all([decrement, increment]);
    }
    res.json({ id: noteId, ...updates });
  } catch (error) {
    res.status(500).json({ message: "Errore nell'aggiornamento della nota", details: error.message });
  }
});

app.delete("/api/notes/:id", async (req, res) => {
  try {
    const noteId = req.params.id;
    const database = await connectDb();

    if (!database) {
      const demoIndex = noteId.startsWith("demo-note-") ? Number.parseInt(noteId.replace("demo-note-", ""), 10) : -1;
      const index = demoIndex >= 0
        ? demoIndex
        : demoData.notes.findIndex((note) => note.id === noteId);
      const [removed] = index >= 0 ? demoData.notes.splice(index, 1) : [];
      if (!removed) {
        return res.status(404).json({ message: "Nota non trovata." });
      }
      if (removed.studentId) {
        const student = getDemoStudent(removed.studentId);
        if (student) {
          student.notes = Math.max((student.notes || 1) - 1, 0);
          syncMainDemoStudent(student);
        }
      } else if (removed.classId) {
        demoData.students
          .filter((student) => student.classId === removed.classId)
          .forEach((student) => {
            student.notes = Math.max((student.notes || 1) - 1, 0);
            syncMainDemoStudent(student);
          });
      }
      return res.json({ ok: true, removed: noteId });
    }

    const query = ObjectId.isValid(noteId)
      ? { $or: [{ id: noteId }, { _id: new ObjectId(noteId) }] }
      : { id: noteId };
    const removed = await database.collection("notes").findOne(query);
    if (!removed) {
      return res.status(404).json({ message: "Nota non trovata." });
    }

    await database.collection("notes").deleteOne(query);
    if (removed.studentId) {
      await database.collection("students").updateOne({ id: removed.studentId }, { $inc: { notes: -1 } });
    } else if (removed.classId) {
      await database.collection("students").updateMany({ classId: removed.classId }, { $inc: { notes: -1 } });
    }
    res.json({ ok: true, removed: noteId });
  } catch (error) {
    res.status(500).json({ message: "Errore nell'eliminazione della nota", details: error.message });
  }
});

app.post("/api/grades", async (req, res) => {
  try {
    const { studentId, subject, value, type, term, date, teacher, explanation } = req.body;
    if (!studentId || !subject || !value || !type || !date || !teacher) {
      return res.status(400).json({ message: "Alunno, materia, voto, tipo, data e docente sono obbligatori." });
    }
    const normalizedValue = normalizeGradeValue(value);
    if (!["SV", "+", "-"].includes(normalizedValue) && (!Number.isFinite(normalizedValue) || normalizedValue < 1 || normalizedValue > 10)) {
      return res.status(400).json({ message: "Il voto deve essere un numero da 1 a 10, SV, + oppure -." });
    }

    const database = await connectDb();
    let student = getDemoStudent(studentId);

    if (database) {
      const dbStudent = await database.collection("students").findOne({ id: studentId });
      student = dbStudent || student;
    }

    const grade = {
      id: makeId("grade"),
      studentId,
      studentName: student.name,
      classId: student.classId,
      className: student.className,
      subject,
      value: normalizedValue,
      type,
      term: term || "",
      explanation: explanation || "",
      date,
      teacher,
      createdAt: new Date()
    };

    if (!database) {
      demoData.grades.unshift(grade);
      recalculateDemoAverage(studentId);
      const email = await sendGradeEmail(grade, student).catch((error) => {
        console.warn(`Email voto non inviata: ${error.message}`);
        return { sent: false, reason: error.message };
      });
      return res.status(201).json({ ...grade, email });
    }

    await database.collection("grades").insertOne(grade);
    await recalculateDbAverage(database, studentId);
    const email = await sendGradeEmail(grade, student).catch((error) => {
      console.warn(`Email voto non inviata: ${error.message}`);
      return { sent: false, reason: error.message };
    });
    res.status(201).json({ ...grade, email });
  } catch (error) {
    res.status(500).json({ message: "Errore nel salvataggio del voto", details: error.message });
  }
});

app.put("/api/grades/:id", async (req, res) => {
  try {
    const gradeId = req.params.id;
    const { studentId, subject, value, type, term, date, teacher, explanation } = req.body;
    if (!studentId || !subject || !value || !type || !date || !teacher) {
      return res.status(400).json({ message: "Alunno, materia, voto, tipo, data e docente sono obbligatori." });
    }
    const normalizedValue = normalizeGradeValue(value);
    if (!["SV", "+", "-"].includes(normalizedValue) && (!Number.isFinite(normalizedValue) || normalizedValue < 1 || normalizedValue > 10)) {
      return res.status(400).json({ message: "Il voto deve essere un numero da 1 a 10, SV, + oppure -." });
    }

    const database = await connectDb();
    let student = getDemoStudent(studentId);

    if (database) {
      const dbStudent = await database.collection("students").findOne({ id: studentId });
      student = dbStudent || student;
    }

    const updates = {
      studentId,
      studentName: student.name,
      classId: student.classId,
      className: student.className,
      subject,
      value: normalizedValue,
      type,
      term: term || "",
      explanation: explanation || "",
      date,
      teacher,
      updatedAt: new Date()
    };

    if (!database) {
      const demoIndex = gradeId.startsWith("demo-grade-") ? Number.parseInt(gradeId.replace("demo-grade-", ""), 10) : -1;
      const grade = demoIndex >= 0 ? demoData.grades[demoIndex] : demoData.grades.find((item) => item.id === gradeId);
      if (!grade) {
        return res.status(404).json({ message: "Voto non trovato." });
      }
      const previousStudentId = grade.studentId;
      Object.assign(grade, updates);
      if (previousStudentId && previousStudentId !== studentId) {
        recalculateDemoAverage(previousStudentId);
      }
      recalculateDemoAverage(studentId);
      return res.json(grade);
    }

    const query = ObjectId.isValid(gradeId)
      ? { $or: [{ id: gradeId }, { _id: new ObjectId(gradeId) }] }
      : { id: gradeId };
    const previousGrade = await database.collection("grades").findOne(query);
    if (!previousGrade) {
      return res.status(404).json({ message: "Voto non trovato." });
    }

    await database.collection("grades").updateOne(query, { $set: updates });
    if (previousGrade.studentId && previousGrade.studentId !== studentId) {
      await recalculateDbAverage(database, previousGrade.studentId);
    }
    await recalculateDbAverage(database, studentId);
    res.json({ id: gradeId, ...updates });
  } catch (error) {
    res.status(500).json({ message: "Errore nell'aggiornamento del voto", details: error.message });
  }
});

app.delete("/api/grades/:id", async (req, res) => {
  try {
    const gradeId = req.params.id;
    const database = await connectDb();

    if (!database) {
      const demoIndex = gradeId.startsWith("demo-grade-") ? Number.parseInt(gradeId.replace("demo-grade-", ""), 10) : -1;
      const index = demoIndex >= 0
        ? demoIndex
        : demoData.grades.findIndex((grade) => grade.id === gradeId);
      const [removed] = index >= 0 ? demoData.grades.splice(index, 1) : [];

      if (!removed) {
        return res.status(404).json({ message: "Voto non trovato." });
      }

      if (removed.studentId) {
        recalculateDemoAverage(removed.studentId);
      }
      return res.json({ ok: true, removed: gradeId });
    }

    const query = ObjectId.isValid(gradeId)
      ? { $or: [{ id: gradeId }, { _id: new ObjectId(gradeId) }] }
      : { id: gradeId };
    const removed = await database.collection("grades").findOne(query);

    if (!removed) {
      return res.status(404).json({ message: "Voto non trovato." });
    }

    await database.collection("grades").deleteOne(query);
    if (removed.studentId) {
      await recalculateDbAverage(database, removed.studentId);
    }
    res.json({ ok: true, removed: gradeId });
  } catch (error) {
    res.status(500).json({ message: "Errore nell'eliminazione del voto", details: error.message });
  }
});

app.post("/api/report-cards", async (req, res) => {
  try {
    const { studentId, term, conduct, outcome, subjects } = req.body;
    if (!studentId || !term || !outcome || !Array.isArray(subjects) || !subjects.length) {
      return res.status(400).json({ message: "Alunno, periodo, esito e materie sono obbligatori." });
    }

    const database = await connectDb();
    let student = getDemoStudent(studentId);

    if (database) {
      const dbStudent = await database.collection("students").findOne({ id: studentId });
      student = dbStudent || student;
    }

    const reportCard = {
      studentId,
      studentName: student.name,
      classId: student.classId,
      className: student.className,
      term,
      conduct: Number.parseFloat(conduct) || 0,
      outcome,
      subjects: subjects
        .filter((subject) => subject.name)
        .map((subject) => ({ name: subject.name, grade: Number.parseFloat(subject.grade) || 0 })),
      createdAt: new Date()
    };

    if (!database) {
      demoData.reportCards.unshift(reportCard);
      return res.status(201).json(reportCard);
    }

    await database.collection("reportCards").insertOne(reportCard);
    res.status(201).json(reportCard);
  } catch (error) {
    res.status(500).json({ message: "Errore nel salvataggio della pagella", details: error.message });
  }
});

app.post("/api/homework", async (req, res) => {
  try {
    const { classId, subject, title, dueDate, attachmentName, attachmentType, attachmentData } = req.body;
    if (!classId || !subject || !title || !dueDate) {
      return res.status(400).json({ message: "Classe, materia, titolo e scadenza sono obbligatori." });
    }

    const database = await connectDb();
    let schoolClass = getDemoClass(classId);

    if (database) {
      const dbClass = await database.collection("classes").findOne({ id: classId });
      schoolClass = dbClass || schoolClass;
    }

    const item = {
      id: makeId("homework"),
      classId,
      className: schoolClass?.name || "",
      subject,
      title,
      dueDate,
      done: false,
      attachmentName: attachmentName || "",
      attachmentType: attachmentType || "",
      attachmentData: attachmentData || "",
      createdAt: new Date()
    };
    const students = await notificationStudents(database, classId);

    if (!database) {
      demoData.homework.unshift(item);
      const email = await safeSendNotificationEmail({
        subject: `[GabDat] Nuovo compito: ${subject}`,
        title: "Nuovo compito assegnato",
        body: `${subject}: ${title}\nScadenza: ${dueDate}`,
        students
      }, "compito");
      return res.status(201).json({ ...item, email });
    }

    const result = await database.collection("homework").insertOne(item);
    const email = await safeSendNotificationEmail({
      subject: `[GabDat] Nuovo compito: ${subject}`,
      title: "Nuovo compito assegnato",
      body: `${subject}: ${title}\nScadenza: ${dueDate}`,
      students
    }, "compito");
    res.status(201).json({ ...item, _id: result.insertedId, email });
  } catch (error) {
    res.status(500).json({ message: "Errore nel salvataggio del compito", details: error.message });
  }
});

app.put("/api/homework/:id", async (req, res) => {
  try {
    const homeworkId = req.params.id;
    const { classId, subject, title, dueDate, attachmentName, attachmentType, attachmentData, keepAttachment } = req.body;
    if (!classId || !subject || !title || !dueDate) {
      return res.status(400).json({ message: "Classe, materia, titolo e scadenza sono obbligatori." });
    }

    const database = await connectDb();
    let schoolClass = getDemoClass(classId);

    if (database) {
      const dbClass = await database.collection("classes").findOne({ id: classId });
      schoolClass = dbClass || schoolClass;
    }

    const updates = {
      classId,
      className: schoolClass?.name || "",
      subject,
      title,
      dueDate,
      updatedAt: new Date()
    };

    if (!keepAttachment) {
      updates.attachmentName = attachmentName || "";
      updates.attachmentType = attachmentType || "";
      updates.attachmentData = attachmentData || "";
    }

    if (!database) {
      const homework = demoData.homework.find((item) => (item.id || item._id?.toString?.()) === homeworkId);
      if (!homework) {
        return res.status(404).json({ message: "Compito non trovato." });
      }
      Object.assign(homework, updates);
      return res.json(homework);
    }

    const query = ObjectId.isValid(homeworkId) ? { $or: [{ id: homeworkId }, { _id: new ObjectId(homeworkId) }] } : { id: homeworkId };
    const result = await database.collection("homework").updateOne(query, { $set: updates });
    if (!result.matchedCount) {
      return res.status(404).json({ message: "Compito non trovato." });
    }
    res.json({ id: homeworkId, ...updates });
  } catch (error) {
    res.status(500).json({ message: "Errore nell'aggiornamento del compito", details: error.message });
  }
});

app.delete("/api/homework/:id", async (req, res) => {
  try {
    const homeworkId = req.params.id;
    const database = await connectDb();

    if (!database) {
      const before = demoData.homework.length;
      demoData.homework = demoData.homework.filter((item) => (item.id || item._id?.toString?.()) !== homeworkId);
      if (demoData.homework.length === before) {
        return res.status(404).json({ message: "Compito non trovato." });
      }
      return res.json({ ok: true, removed: homeworkId });
    }

    const query = ObjectId.isValid(homeworkId) ? { $or: [{ id: homeworkId }, { _id: new ObjectId(homeworkId) }] } : { id: homeworkId };
    const result = await database.collection("homework").deleteOne(query);
    if (!result.deletedCount) {
      return res.status(404).json({ message: "Compito non trovato." });
    }
    res.json({ ok: true, removed: homeworkId });
  } catch (error) {
    res.status(500).json({ message: "Errore nell'eliminazione del compito", details: error.message });
  }
});

app.post("/api/classwork", async (req, res) => {
  try {
    const { classId, subject, date, body, teacher, attachmentName, attachmentType, attachmentData } = req.body;
    if (!classId || !subject || !date || !body) {
      return res.status(400).json({ message: "Classe, materia, data e contenuto svolto sono obbligatori." });
    }

    const database = await connectDb();
    let schoolClass = getDemoClass(classId);

    if (database) {
      const dbClass = await database.collection("classes").findOne({ id: classId });
      schoolClass = dbClass || schoolClass;
    }

    const item = {
      id: makeId("classwork"),
      classId,
      className: schoolClass.name,
      subject,
      date,
      body,
      teacher: teacher || "",
      attachmentName: attachmentName || "",
      attachmentType: attachmentType || "",
      attachmentData: attachmentData || "",
      createdAt: new Date()
    };

    if (!database) {
      demoData.classwork.unshift(item);
      const email = await safeSendNotificationEmail({
        subject: `[GabDat] Svolto in classe: ${subject}`,
        title: "Nuovo svolto in classe",
        body: `${subject}: ${body}\nData: ${date}${teacher ? `\nDocente: ${teacher}` : ""}`,
        students: classStudents
      }, "svolto in classe");
      return res.status(201).json({ ...item, email });
    }

    await database.collection("classwork").insertOne(item);
    const email = await safeSendNotificationEmail({
      subject: `[GabDat] Svolto in classe: ${subject}`,
      title: "Nuovo svolto in classe",
      body: `${subject}: ${body}\nData: ${date}${teacher ? `\nDocente: ${teacher}` : ""}`,
      students: classStudents
    }, "svolto in classe");
    res.status(201).json({ ...item, email });
  } catch (error) {
    res.status(500).json({ message: "Errore nel salvataggio dello svolto in classe", details: error.message });
  }
});

app.put("/api/classwork/:id", async (req, res) => {
  try {
    const classworkId = req.params.id;
    const { classId, subject, date, body, teacher, attachmentName, attachmentType, attachmentData, keepAttachment } = req.body;
    if (!classId || !subject || !date || !body) {
      return res.status(400).json({ message: "Classe, materia, data e contenuto svolto sono obbligatori." });
    }

    const database = await connectDb();
    let schoolClass = getDemoClass(classId);

    if (database) {
      const dbClass = await database.collection("classes").findOne({ id: classId });
      schoolClass = dbClass || schoolClass;
    }

    const updates = {
      classId,
      className: schoolClass.name,
      subject,
      date,
      body,
      teacher: teacher || "",
      updatedAt: new Date()
    };

    if (!keepAttachment) {
      updates.attachmentName = attachmentName || "";
      updates.attachmentType = attachmentType || "";
      updates.attachmentData = attachmentData || "";
    }

    if (!database) {
      const item = demoData.classwork.find((entry) => (entry.id || entry._id?.toString?.()) === classworkId);
      if (!item) {
        return res.status(404).json({ message: "Svolto in classe non trovato." });
      }
      Object.assign(item, updates);
      return res.json(item);
    }

    const query = ObjectId.isValid(classworkId) ? { $or: [{ id: classworkId }, { _id: new ObjectId(classworkId) }] } : { id: classworkId };
    const result = await database.collection("classwork").updateOne(query, { $set: updates });
    if (!result.matchedCount) {
      return res.status(404).json({ message: "Svolto in classe non trovato." });
    }
    res.json({ id: classworkId, ...updates });
  } catch (error) {
    res.status(500).json({ message: "Errore nell'aggiornamento dello svolto in classe", details: error.message });
  }
});

app.delete("/api/classwork/:id", async (req, res) => {
  try {
    const classworkId = req.params.id;
    const database = await connectDb();

    if (!database) {
      const before = demoData.classwork.length;
      demoData.classwork = demoData.classwork.filter((item) => (item.id || item._id?.toString?.()) !== classworkId);
      if (demoData.classwork.length === before) {
        return res.status(404).json({ message: "Svolto in classe non trovato." });
      }
      return res.json({ ok: true, removed: classworkId });
    }

    const query = ObjectId.isValid(classworkId) ? { $or: [{ id: classworkId }, { _id: new ObjectId(classworkId) }] } : { id: classworkId };
    const result = await database.collection("classwork").deleteOne(query);
    if (!result.deletedCount) {
      return res.status(404).json({ message: "Svolto in classe non trovato." });
    }
    res.json({ ok: true, removed: classworkId });
  } catch (error) {
    res.status(500).json({ message: "Errore nell'eliminazione dello svolto in classe", details: error.message });
  }
});

app.get("*", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`Web Preview avviato su http://localhost:${port}`);
});
