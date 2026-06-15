const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();

app.use(express.json());
app.use(cors());

const SECRET_KEY = "crm_secret_key";

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "crm_db",
});

// Make login token
function makeToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    SECRET_KEY,
    { expiresIn: "1d" }
  );
}

// Check if user is logged in
function checkLogin(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Please login first" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Please login first" });
  }

  jwt.verify(token, SECRET_KEY, (error, userData) => {
    if (error) {
      return res.status(403).json({ message: "Invalid login token" });
    }

    req.user = userData;
    next();
  });
}

// Check if logged-in user is admin
function checkAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Only admin can do this" });
  }

  next();
}

// Create a new user
app.post("/users", async (req, res) => {
  try {
    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;
    const role = req.body.role || "agent";

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    const safePassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      [name, email, safePassword, role]
    );

    res.status(201).json({
      message: "User created",
      user: {
        id: result.insertId,
        name: name,
        email: email,
        role: role,
      },
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Email already exists" });
    }

    res.status(500).json({ message: "Could not create user" });
  }
});

// Login user
app.post("/sessions", async (req, res) => {
  try {
    const email = req.body.email;
    const password = req.body.password;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const [users] = await db.query("SELECT * FROM users WHERE email = ?", [email]);

    if (users.length === 0) {
      return res.status(401).json({ message: "Wrong email or password" });
    }

    const user = users[0];

    const passwordIsCorrect = await bcrypt.compare(password, user.password);

    if (!passwordIsCorrect) {
      return res.status(401).json({ message: "Wrong email or password" });
    }

    const token = makeToken(user);

    res.status(201).json({
      message: "Login successful",
      token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Could not login" });
  }
});

// Get logged-in user
app.get("/session", checkLogin, async (req, res) => {
  try {
    const [users] = await db.query(
      "SELECT id, name, email, role, created_at FROM users WHERE id = ?",
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user: users[0] });
  } catch (error) {
    res.status(500).json({ message: "Could not get logged-in user" });
  }
});

// Get all users
app.get("/users", checkLogin, checkAdmin, async (req, res) => {
  try {
    const [users] = await db.query(
      "SELECT id, name, email, role, created_at FROM users ORDER BY id DESC"
    );

    res.json({ users: users });
  } catch (error) {
    res.status(500).json({ message: "Could not get users" });
  }
});

// Get one user
app.get("/users/:id", checkLogin, checkAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    const [users] = await db.query(
      "SELECT id, name, email, role, created_at FROM users WHERE id = ?",
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user: users[0] });
  } catch (error) {
    res.status(500).json({ message: "Could not get user" });
  }
});

// Update one user
app.put("/users/:id", checkLogin, checkAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const name = req.body.name;
    const role = req.body.role;

    const [result] = await db.query(
      "UPDATE users SET name = COALESCE(?, name), role = COALESCE(?, role) WHERE id = ?",
      [name || null, role || null, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User updated" });
  } catch (error) {
    res.status(500).json({ message: "Could not update user" });
  }
});

// Delete one user
app.delete("/users/:id", checkLogin, checkAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    const [result] = await db.query("DELETE FROM users WHERE id = ?", [userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User deleted" });
  } catch (error) {
    res.status(409).json({ message: "User is used in leads or notes, so cannot delete" });
  }
});

// Get all customers
app.get("/customers", checkLogin, async (req, res) => {
  try {
    const [customers] = await db.query("SELECT * FROM customers ORDER BY id DESC");

    res.json({ customers: customers });
  } catch (error) {
    res.status(500).json({ message: "Could not get customers" });
  }
});

// Get one customer
app.get("/customers/:id", checkLogin, async (req, res) => {
  try {
    const customerId = req.params.id;

    const [customers] = await db.query("SELECT * FROM customers WHERE id = ?", [customerId]);

    if (customers.length === 0) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.json({ customer: customers[0] });
  } catch (error) {
    res.status(500).json({ message: "Could not get customer" });
  }
});

// Create customer
app.post("/customers", checkLogin, async (req, res) => {
  try {
    const name = req.body.name;
    const email = req.body.email || null;
    const phone = req.body.phone || null;
    const status = req.body.status || "active";

    if (!name) {
      return res.status(400).json({ message: "Customer name is required" });
    }

    const [result] = await db.query(
      "INSERT INTO customers (name, email, phone, status) VALUES (?, ?, ?, ?)",
      [name, email, phone, status]
    );

    res.status(201).json({
      message: "Customer created",
      customer: {
        id: result.insertId,
        name: name,
        email: email,
        phone: phone,
        status: status,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Could not create customer" });
  }
});

// Update customer
app.put("/customers/:id", checkLogin, async (req, res) => {
  try {
    const customerId = req.params.id;
    const name = req.body.name;
    const email = req.body.email;
    const phone = req.body.phone;
    const status = req.body.status;

    const [result] = await db.query(
      "UPDATE customers SET name = COALESCE(?, name), email = COALESCE(?, email), phone = COALESCE(?, phone), status = COALESCE(?, status) WHERE id = ?",
      [name || null, email || null, phone || null, status || null, customerId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.json({ message: "Customer updated" });
  } catch (error) {
    res.status(500).json({ message: "Could not update customer" });
  }
});

// Delete customer
app.delete("/customers/:id", checkLogin, checkAdmin, async (req, res) => {
  try {
    const customerId = req.params.id;

    const [result] = await db.query("DELETE FROM customers WHERE id = ?", [customerId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.json({ message: "Customer deleted" });
  } catch (error) {
    res.status(409).json({ message: "Customer is used in leads or notes, so cannot delete" });
  }
});

// Get all leads
app.get("/leads", checkLogin, async (req, res) => {
  try {
    if (req.user.role === "admin") {
      const [leads] = await db.query(`
        SELECT leads.*, customers.name AS customer_name, users.name AS agent_name
        FROM leads
        LEFT JOIN customers ON leads.customer_id = customers.id
        LEFT JOIN users ON leads.assigned_to = users.id
        ORDER BY leads.id DESC
      `);

      return res.json({ leads: leads });
    }

    const [leads] = await db.query(
      `
      SELECT leads.*, customers.name AS customer_name
      FROM leads
      LEFT JOIN customers ON leads.customer_id = customers.id
      WHERE leads.assigned_to = ?
      ORDER BY leads.id DESC
      `,
      [req.user.id]
    );

    res.json({ leads: leads });
  } catch (error) {
    res.status(500).json({ message: "Could not get leads" });
  }
});

// Get my leads
app.get("/leads/my", checkLogin, async (req, res) => {
  try {
    const [leads] = await db.query(
      `
      SELECT leads.*, customers.name AS customer_name
      FROM leads
      LEFT JOIN customers ON leads.customer_id = customers.id
      WHERE leads.assigned_to = ?
      ORDER BY leads.id DESC
      `,
      [req.user.id]
    );

    res.json({ leads: leads });
  } catch (error) {
    res.status(500).json({ message: "Could not get my leads" });
  }
});

// Get one lead
app.get("/leads/:id", checkLogin, async (req, res) => {
  try {
    const leadId = req.params.id;

    const [leads] = await db.query(
      `
      SELECT leads.*, customers.name AS customer_name, users.name AS agent_name
      FROM leads
      LEFT JOIN customers ON leads.customer_id = customers.id
      LEFT JOIN users ON leads.assigned_to = users.id
      WHERE leads.id = ?
      `,
      [leadId]
    );

    if (leads.length === 0) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const lead = leads[0];

    if (req.user.role === "agent" && lead.assigned_to !== req.user.id) {
      return res.status(403).json({ message: "You cannot view this lead" });
    }

    res.json({ lead: lead });
  } catch (error) {
    res.status(500).json({ message: "Could not get lead" });
  }
});

// Create lead
app.post("/leads", checkLogin, async (req, res) => {
  try {
    const customerId = req.body.customer_id;
    const source = req.body.source || null;
    const stage = req.body.stage || "new";

    if (!customerId) {
      return res.status(400).json({ message: "Customer id is required" });
    }

    let assignedTo = req.user.id;

    if (req.user.role === "admin") {
      assignedTo = req.body.assigned_to || null;
    }

    const [result] = await db.query(
      "INSERT INTO leads (customer_id, source, stage, assigned_to) VALUES (?, ?, ?, ?)",
      [customerId, source, stage, assignedTo]
    );

    res.status(201).json({
      message: "Lead created",
      lead: {
        id: result.insertId,
        customer_id: customerId,
        source: source,
        stage: stage,
        assigned_to: assignedTo,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Could not create lead" });
  }
});

// Update lead
app.put("/leads/:id", checkLogin, async (req, res) => {
  try {
    const leadId = req.params.id;

    const [leads] = await db.query("SELECT * FROM leads WHERE id = ?", [leadId]);

    if (leads.length === 0) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const oldLead = leads[0];

    if (req.user.role === "agent" && oldLead.assigned_to !== req.user.id) {
      return res.status(403).json({ message: "You cannot update this lead" });
    }

    const customerId = req.body.customer_id || oldLead.customer_id;
    const source = req.body.source || oldLead.source;
    const stage = req.body.stage || oldLead.stage;
    let assignedTo = oldLead.assigned_to;

    if (req.user.role === "admin" && req.body.assigned_to) {
      assignedTo = req.body.assigned_to;
    }

    await db.query(
      "UPDATE leads SET customer_id = ?, source = ?, stage = ?, assigned_to = ? WHERE id = ?",
      [customerId, source, stage, assignedTo, leadId]
    );

    res.json({ message: "Lead updated" });
  } catch (error) {
    res.status(500).json({ message: "Could not update lead" });
  }
});

// Update lead stage
app.patch("/leads/:id/stage", checkLogin, async (req, res) => {
  try {
    const leadId = req.params.id;
    const stage = req.body.stage;

    if (!stage) {
      return res.status(400).json({ message: "Stage is required" });
    }

    const [leads] = await db.query("SELECT * FROM leads WHERE id = ?", [leadId]);

    if (leads.length === 0) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const lead = leads[0];

    if (req.user.role === "agent" && lead.assigned_to !== req.user.id) {
      return res.status(403).json({ message: "You cannot update this lead" });
    }

    await db.query("UPDATE leads SET stage = ? WHERE id = ?", [stage, leadId]);

    res.json({ message: "Lead stage updated" });
  } catch (error) {
    res.status(500).json({ message: "Could not update lead stage" });
  }
});

// Assign lead to agent
app.patch("/leads/:id/assign", checkLogin, checkAdmin, async (req, res) => {
  try {
    const leadId = req.params.id;
    const assignedTo = req.body.assigned_to;

    if (!assignedTo) {
      return res.status(400).json({ message: "Agent id is required" });
    }

    const [result] = await db.query("UPDATE leads SET assigned_to = ? WHERE id = ?", [
      assignedTo,
      leadId,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Lead not found" });
    }

    res.json({ message: "Lead assigned" });
  } catch (error) {
    res.status(500).json({ message: "Could not assign lead" });
  }
});

// Delete lead
app.delete("/leads/:id", checkLogin, checkAdmin, async (req, res) => {
  try {
    const leadId = req.params.id;

    const [result] = await db.query("DELETE FROM leads WHERE id = ?", [leadId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Lead not found" });
    }

    res.json({ message: "Lead deleted" });
  } catch (error) {
    res.status(409).json({ message: "Lead is used in notes, so cannot delete" });
  }
});

// Create note
app.post("/notes", checkLogin, async (req, res) => {
  try {
    const customerId = req.body.customer_id || null;
    const leadId = req.body.lead_id || null;
    const note = req.body.note;

    if (!note) {
      return res.status(400).json({ message: "Note is required" });
    }

    if (!customerId && !leadId) {
      return res.status(400).json({ message: "Customer id or lead id is required" });
    }

    const [result] = await db.query(
      "INSERT INTO notes (customer_id, lead_id, note, created_by) VALUES (?, ?, ?, ?)",
      [customerId, leadId, note, req.user.id]
    );

    res.status(201).json({
      message: "Note created",
      note: {
        id: result.insertId,
        customer_id: customerId,
        lead_id: leadId,
        note: note,
        created_by: req.user.id,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Could not create note" });
  }
});

// Get customer notes
app.get("/customers/:id/notes", checkLogin, async (req, res) => {
  try {
    const customerId = req.params.id;

    const [notes] = await db.query(
      `
      SELECT notes.*, users.name AS created_by_name
      FROM notes
      LEFT JOIN users ON notes.created_by = users.id
      WHERE notes.customer_id = ?
      ORDER BY notes.id DESC
      `,
      [customerId]
    );

    res.json({ notes: notes });
  } catch (error) {
    res.status(500).json({ message: "Could not get customer notes" });
  }
});

// Get lead notes
app.get("/leads/:id/notes", checkLogin, async (req, res) => {
  try {
    const leadId = req.params.id;

    const [notes] = await db.query(
      `
      SELECT notes.*, users.name AS created_by_name
      FROM notes
      LEFT JOIN users ON notes.created_by = users.id
      WHERE notes.lead_id = ?
      ORDER BY notes.id DESC
      `,
      [leadId]
    );

    res.json({ notes: notes });
  } catch (error) {
    res.status(500).json({ message: "Could not get lead notes" });
  }
});

// Delete note
app.delete("/notes/:id", checkLogin, checkAdmin, async (req, res) => {
  try {
    const noteId = req.params.id;

    const [result] = await db.query("DELETE FROM notes WHERE id = ?", [noteId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Note not found" });
    }

    res.json({ message: "Note deleted" });
  } catch (error) {
    res.status(500).json({ message: "Could not delete note" });
  }
});

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.listen(5000, async () => {
  try {
    await db.query("SELECT 1");
    console.log("Connected to MySQL database");
    console.log("Server running on http://localhost:5000");
  } catch (error) {
    console.log("Database connection failed:", error.message);
  }
});