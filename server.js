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

function getDemoStudent(studentId) {
  return demoData.students.find((student) => student.id === studentId) || demoData.students[0];
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
    const [students, grades, homework, agenda, notices, attendance, notes] = await Promise.all([
      getCollectionData("students", demoData.students),
      getCollectionData("grades", demoData.grades),
      getCollectionData("homework", demoData.homework),
      getCollectionData("agenda", demoData.agenda),
      getCollectionData("notices", demoData.notices),
      getCollectionData("attendance", demoData.attendance),
      getCollectionData("notes", demoData.notes)
    ]);

    res.json({
      student: students[0] || demoData.student,
      students,
      grades,
      homework,
      agenda,
      notices,
      attendance,
      notes
    });
  } catch (error) {
    res.status(500).json({ message: "Errore nel caricamento della dashboard", details: error.message });
  }
});

app.post("/api/students/:id", async (req, res) => {
  try {
    const { name, className, average } = req.body;
    if (!name || !className) {
      return res.status(400).json({ message: "Nome e classe sono obbligatori." });
    }

    const database = await connectDb();
    const updates = {
      name,
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
