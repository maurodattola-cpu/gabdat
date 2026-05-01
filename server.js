const express = require("express");
const path = require("path");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "gabdat";

let client;
let db;

const demoData = {
  classes: [
    { id: "class-3b-inf", name: "3B Informatica", schoolYear: "2025/2026" },
    { id: "class-2a-inf", name: "2A Informatica", schoolYear: "2025/2026" }
  ],
  student: {
    id: "stu-1",
    name: "Gabriele Dattola",
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
    { subject: "Matematica", value: 8, type: "Verifica", date: "2026-04-22", teacher: "Prof. Marino" },
    { subject: "Informatica", value: 9, type: "Laboratorio", date: "2026-04-18", teacher: "Prof.ssa Greco" },
    { subject: "Italiano", value: 7, type: "Interrogazione", date: "2026-04-15", teacher: "Prof. Rizzo" },
    { subject: "Inglese", value: 8.5, type: "Reading", date: "2026-04-10", teacher: "Prof.ssa Costa" }
  ],
  homework: [
    { subject: "Informatica", title: "Completare esercizio su API REST", dueDate: "2026-05-04", done: false },
    { subject: "Matematica", title: "Studio funzioni: pag. 112 esercizi 8-12", dueDate: "2026-05-03", done: false },
    { subject: "Italiano", title: "Scheda su Pirandello", dueDate: "2026-05-06", done: true }
  ],
  agenda: [
    { time: "08:00", title: "Matematica", room: "Aula 12" },
    { time: "09:00", title: "Informatica", room: "Lab 2" },
    { time: "11:00", title: "Italiano", room: "Aula 12" },
    { time: "12:00", title: "Scienze motorie", room: "Palestra" }
  ],
  notices: [
    { title: "Uscita didattica", body: "Consegnare autorizzazione firmata entro venerdi.", priority: "Alta" },
    { title: "Ricevimento docenti", body: "Prenotazioni aperte dall'area famiglia.", priority: "Media" }
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
  ]
};

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

async function connectDb() {
  if (!mongoUri || mongoUri.includes("<db_password>")) {
    return null;
  }

  if (!client) {
    client = new MongoClient(mongoUri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true
      }
    });
    await client.connect();
    db = client.db(dbName);
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

app.get("/api/status", async (_req, res) => {
  try {
    const database = await connectDb();
    res.json({
      ok: true,
      database: database ? "connected" : "demo",
      mode: database ? "MongoDB Atlas" : "Demo locale"
    });
  } catch (error) {
    res.status(500).json({ ok: false, database: "error", message: error.message });
  }
});

app.get("/api/dashboard", async (_req, res) => {
  try {
    const [classes, rawStudents, grades, homework, agenda, notices, attendance, notes, reportCards, dailyAttendance] = await Promise.all([
      getCollectionData("classes", demoData.classes),
      getCollectionData("students", demoData.students),
      getCollectionData("grades", demoData.grades),
      getCollectionData("homework", demoData.homework),
      getCollectionData("agenda", demoData.agenda),
      getCollectionData("notices", demoData.notices),
      getCollectionData("attendance", demoData.attendance),
      getCollectionData("notes", demoData.notes),
      getCollectionData("reportCards", demoData.reportCards),
      getCollectionData("dailyAttendance", demoData.dailyAttendance)
    ]);
    const students = normalizeStudents(rawStudents, classes);

    res.json({
      student: students[0] || demoData.student,
      classes,
      students,
      grades,
      homework,
      agenda,
      notices,
      attendance,
      notes,
      reportCards,
      dailyAttendance
    });
  } catch (error) {
    res.status(500).json({ message: "Errore nel caricamento della dashboard", details: error.message });
  }
});

app.post("/api/classes", async (req, res) => {
  try {
    const { name, schoolYear } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Il nome della classe e obbligatorio." });
    }

    const schoolClass = {
      id: slug(name) || makeId("class"),
      name,
      schoolYear: schoolYear || "2025/2026",
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

app.post("/api/students", async (req, res) => {
  try {
    const { name, classId, schoolYear } = req.body;
    if (!name || !classId) {
      return res.status(400).json({ message: "Nome e classe sono obbligatori." });
    }

    const database = await connectDb();
    let schoolClass = getDemoClass(classId);

    if (database) {
      const dbClass = await database.collection("classes").findOne({ id: classId });
      schoolClass = dbClass || schoolClass;
    }

    const student = {
      id: makeId("stu"),
      name,
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
    const { name, classId, className, average } = req.body;
    if (!name || !className) {
      return res.status(400).json({ message: "Nome e classe sono obbligatori." });
    }

    const database = await connectDb();
    const updates = {
      name,
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
      return res.status(201).json(item);
    }

    await database.collection("attendance").insertOne(item);
    if (Object.keys(counters).length) {
      await database.collection("students").updateOne({ id: studentId }, { $inc: counters });
    }
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ message: "Errore nel salvataggio del registro", details: error.message });
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
      return res.status(201).json(record);
    }

    await database.collection("dailyAttendance").deleteMany({ classId, date });
    await database.collection("dailyAttendance").insertOne(record);
    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ message: "Errore nel salvataggio del registro giornaliero", details: error.message });
  }
});

app.post("/api/notes", async (req, res) => {
  try {
    const { studentId, teacher, body, date } = req.body;
    if (!studentId || !teacher || !body || !date) {
      return res.status(400).json({ message: "Alunno, docente, testo e data sono obbligatori." });
    }

    const database = await connectDb();
    let student = getDemoStudent(studentId);

    if (database) {
      const dbStudent = await database.collection("students").findOne({ id: studentId });
      student = dbStudent || student;
    }

    const note = {
      studentId,
      studentName: student.name,
      teacher,
      body,
      date,
      createdAt: new Date()
    };

    if (!database) {
      demoData.notes.unshift(note);
      student.notes = (student.notes || 0) + 1;
      syncMainDemoStudent(student);
      return res.status(201).json(note);
    }

    await database.collection("notes").insertOne(note);
    await database.collection("students").updateOne({ id: studentId }, { $inc: { notes: 1 } });
    res.status(201).json(note);
  } catch (error) {
    res.status(500).json({ message: "Errore nel salvataggio della nota", details: error.message });
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
    const { subject, title, dueDate } = req.body;
    if (!subject || !title || !dueDate) {
      return res.status(400).json({ message: "Materia, titolo e scadenza sono obbligatori." });
    }

    const item = { subject, title, dueDate, done: false, createdAt: new Date() };
    const database = await connectDb();

    if (!database) {
      demoData.homework.unshift(item);
      return res.status(201).json(item);
    }

    const result = await database.collection("homework").insertOne(item);
    res.status(201).json({ ...item, _id: result.insertedId });
  } catch (error) {
    res.status(500).json({ message: "Errore nel salvataggio del compito", details: error.message });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`Gabdat MyClass avviato su http://localhost:${port}`);
});
