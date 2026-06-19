const express = require("express");
const db = require("../config/db");
const { checkLogin, checkAdmin } = require("../middleware/auth");
const router = express.Router();

router.use(checkLogin);

router.get("/", async (req, res) => {
  try {
    if (req.user.role === "admin") {
      const [leads] = await db.query(`
        SELECT leads.*, customers.name AS customer_name, users.name AS agent_name
        FROM leads LEFT JOIN customers ON leads.customer_id = customers.id
        LEFT JOIN users ON leads.assigned_to = users.id ORDER BY leads.id DESC
      `);
      return res.json({ leads });
    }
    const [leads] = await db.query(
      "SELECT leads.*, customers.name AS customer_name FROM leads LEFT JOIN customers ON leads.customer_id = customers.id WHERE leads.assigned_to = ? ORDER BY leads.id DESC",
      [req.user.id]
    );
    res.json({ leads });
  } catch (error) {
    res.status(500).json({ message: "Could not get leads" });
  }
});

router.get("/my", async (req, res) => {
  try {
    const [leads] = await db.query(
      "SELECT leads.*, customers.name AS customer_name FROM leads LEFT JOIN customers ON leads.customer_id = customers.id WHERE leads.assigned_to = ? ORDER BY leads.id DESC",
      [req.user.id]
    );
    res.json({ leads });
  } catch (error) {
    res.status(500).json({ message: "Could not get your leads" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const [leads] = await db.query(
      "SELECT leads.*, customers.name AS customer_name, users.name AS agent_name FROM leads LEFT JOIN customers ON leads.customer_id = customers.id LEFT JOIN users ON leads.assigned_to = users.id WHERE leads.id = ?",
      [req.params.id]
    );
    if (leads.length === 0) return res.status(404).json({ message: "Lead not found" });

    const lead = leads[0];
    if (req.user.role === "agent" && lead.assigned_to !== req.user.id) return res.status(403).json({ message: "Access denied to this lead" });
    res.json({ lead });
  } catch (error) {
    res.status(500).json({ message: "Could not get lead" });
  }
});

router.get("/:id/notes", async (req, res) => {
  try {
    const [notes] = await db.query(
      "SELECT notes.*, users.name AS created_by_name FROM notes LEFT JOIN users ON notes.created_by = users.id WHERE notes.lead_id = ? ORDER BY notes.id DESC",
      [req.params.id]
    );
    res.json({ notes });
  } catch (error) {
    res.status(500).json({ message: "Could not get lead notes" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { customer_id, source = null, stage = "new" } = req.body;
    if (!customer_id) return res.status(400).json({ message: "Customer id is required" });

    let assignedTo = req.user.role === "admin" ? (req.body.assigned_to || null) : req.user.id;
    const [result] = await db.query("INSERT INTO leads (customer_id, source, stage, assigned_to) VALUES (?, ?, ?, ?)", [customer_id, source, stage, assignedTo]);
    res.status(201).json({ message: "Lead created", lead: { id: result.insertId, customer_id, source, stage, assigned_to: assignedTo } });
  } catch (error) {
    res.status(500).json({ message: "Could not create lead" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const [leads] = await db.query("SELECT * FROM leads WHERE id = ?", [req.params.id]);
    if (leads.length === 0) return res.status(404).json({ message: "Lead not found" });

    const oldLead = leads[0];
    if (req.user.role === "agent" && oldLead.assigned_to !== req.user.id) return res.status(403).json({ message: "Access denied to update lead" });

    const customerId = req.body.customer_id || oldLead.customer_id;
    const source = req.body.source || oldLead.source;
    const stage = req.body.stage || oldLead.stage;
    let assignedTo = req.user.role === "admin" && req.body.assigned_to ? req.body.assigned_to : oldLead.assigned_to;

    await db.query("UPDATE leads SET customer_id = ?, source = ?, stage = ?, assigned_to = ? WHERE id = ?", [customerId, source, stage, assignedTo, req.params.id]);
    res.json({ message: "Lead updated" });
  } catch (error) {
    res.status(500).json({ message: "Could not update lead" });
  }
});

router.patch("/:id/stage", async (req, res) => {
  try {
    const { stage } = req.body;
    if (!stage) return res.status(400).json({ message: "Stage is required" });

    const [leads] = await db.query("SELECT * FROM leads WHERE id = ?", [req.params.id]);
    if (leads.length === 0) return res.status(404).json({ message: "Lead not found" });

    if (req.user.role === "agent" && leads[0].assigned_to !== req.user.id) return res.status(403).json({ message: "Access denied" });
    await db.query("UPDATE leads SET stage = ? WHERE id = ?", [stage, req.params.id]);
    res.json({ message: "Lead stage updated" });
  } catch (error) {
    res.status(500).json({ message: "Could not update lead stage" });
  }
});

router.patch("/:id/assign", checkAdmin, async (req, res) => {
  try {
    const { assigned_to } = req.body;
    if (!assigned_to) return res.status(400).json({ message: "Agent id is required" });

    const [result] = await db.query("UPDATE leads SET assigned_to = ? WHERE id = ?", [assigned_to, req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Lead not found" });
    res.json({ message: "Lead assigned successfully" });
  } catch (error) {
    res.status(500).json({ message: "Could not assign lead" });
  }
});

router.delete("/:id", checkAdmin, async (req, res) => {
  try {
    const [result] = await db.query("DELETE FROM leads WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Lead not found" });
    res.json({ message: "Lead deleted" });
  } catch (error) {
    res.status(409).json({ message: "Lead has active sub-notes and cannot be deleted" });
  }
});

module.exports = router;