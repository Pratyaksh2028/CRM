const express = require("express");
const db = require("../config/db");
const { checkLogin, checkAdmin } = require("../middleware/auth");
const router = express.Router();

router.use(checkLogin);

router.post("/", async (req, res) => {
  try {
    const { customer_id = null, lead_id = null, note } = req.body;
    if (!note) return res.status(400).json({ message: "Note text content is required" });
    if (!customer_id && !lead_id) return res.status(400).json({ message: "Customer id or lead id is required" });

    const [result] = await db.query("INSERT INTO notes (customer_id, lead_id, note, created_by) VALUES (?, ?, ?, ?)", [customer_id, lead_id, note, req.user.id]);
    res.status(201).json({ message: "Note created", note: { id: result.insertId, customer_id, lead_id, note, created_by: req.user.id } });
  } catch (error) {
    res.status(500).json({ message: "Could not create note" });
  }
});

router.delete("/:id", checkAdmin, async (req, res) => {
  try {
    const [result] = await db.query("DELETE FROM notes WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Note not found" });
    res.json({ message: "Note deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Could not delete note" });
  }
});

module.exports = router;