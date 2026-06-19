const express = require("express");
const db = require("../config/db");
const { checkLogin, checkAdmin } = require("../middleware/auth");
const router = express.Router();

router.use(checkLogin);

router.get("/", async (req, res) => {
  try {
    const [customers] = await db.query("SELECT * FROM customers ORDER BY id DESC");
    res.json({ customers });
  } catch (error) {
    res.status(500).json({ message: "Could not get customers" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const [customers] = await db.query("SELECT * FROM customers WHERE id = ?", [req.params.id]);
    if (customers.length === 0) return res.status(404).json({ message: "Customer not found" });
    res.json({ customer: customers[0] });
  } catch (error) {
    res.status(500).json({ message: "Could not get customer" });
  }
});

router.get("/:id/notes", async (req, res) => {
  try {
    const [notes] = await db.query(
      "SELECT notes.*, users.name AS created_by_name FROM notes LEFT JOIN users ON notes.created_by = users.id WHERE notes.customer_id = ? ORDER BY notes.id DESC",
      [req.params.id]
    );
    res.json({ notes });
  } catch (error) {
    res.status(500).json({ message: "Could not get customer notes" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, email = null, phone = null, status = "active" } = req.body;
    if (!name) return res.status(400).json({ message: "Customer name is required" });

    const [result] = await db.query("INSERT INTO customers (name, email, phone, status) VALUES (?, ?, ?, ?)", [name, email, phone, status]);
    res.status(201).json({ message: "Customer created", customer: { id: result.insertId, name, email, phone, status } });
  } catch (error) {
    res.status(500).json({ message: "Could not create customer" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { name, email, phone, status } = req.body;
    const [result] = await db.query(
      "UPDATE customers SET name = COALESCE(?, name), email = COALESCE(?, email), phone = COALESCE(?, phone), status = COALESCE(?, status) WHERE id = ?",
      [name || null, email || null, phone || null, status || null, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: "Customer not found" });
    res.json({ message: "Customer updated" });
  } catch (error) {
    res.status(500).json({ message: "Could not update customer" });
  }
});

router.delete("/:id", checkAdmin, async (req, res) => {
  try {
    const [result] = await db.query("DELETE FROM customers WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Customer not found" });
    res.json({ message: "Customer deleted" });
  } catch (error) {
    res.status(409).json({ message: "Customer is linked to data entries and cannot be deleted" });
  }
});

module.exports = router;