const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../config/db");
const { checkLogin, checkAdmin } = require("../middleware/auth");
const router = express.Router();

// ==========================================
// PUBLIC ROUTES (No Token Needed to Bootstrap Admin)
// ==========================================

/**
 * Create a new user
 * POST /users
 */
router.post("/", async (req, res) => {
  try {
    const { name, email, password, role = "agent" } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "Name, email and password are required" });

    const safePassword = await bcrypt.hash(password, 10);
    const [result] = await db.query("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", [name, email, safePassword, role]);

    res.status(201).json({ message: "User created", user: { id: result.insertId, name, email, role } });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Email already exists" });
    res.status(500).json({ message: "Could not create user" });
  }
});

// ==========================================
// PROTECTED ROUTES (Middleware Applied Globally Below)
// ==========================================
router.use(checkLogin, checkAdmin);

/**
 * Get all users
 * GET /users
 */
router.get("/", async (req, res) => {
  try {
    const [users] = await db.query("SELECT id, name, email, role, created_at FROM users ORDER BY id DESC");
    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: "Could not get users" });
  }
});

/**
 * Get a single user by ID
 * GET /users/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const [users] = await db.query("SELECT id, name, email, role, created_at FROM users WHERE id = ?", [req.params.id]);
    if (users.length === 0) return res.status(404).json({ message: "User not found" });
    res.json({ user: users[0] });
  } catch (error) {
    res.status(500).json({ message: "Could not get user" });
  }
});

/**
 * Update a user
 * PUT /users/:id
 */
router.put("/:id", async (req, res) => {
  try {
    const { name, role } = req.body;
    const [result] = await db.query("UPDATE users SET name = COALESCE(?, name), role = COALESCE(?, role) WHERE id = ?", [name || null, role || null, req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User updated" });
  } catch (error) {
    res.status(500).json({ message: "Could not update user" });
  }
});

/**
 * Delete a user
 * DELETE /users/:id
 */
router.delete("/:id", async (req, res) => {
  try {
    const [result] = await db.query("DELETE FROM users WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted" });
  } catch (error) {
    res.status(409).json({ message: "User is linked to active leads or notes and cannot be deleted" });
  }
});

module.exports = router;