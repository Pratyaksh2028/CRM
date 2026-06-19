const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../config/db");
const { makeToken, checkLogin } = require("../middleware/auth");
const router = express.Router();

router.post("/sessions", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

    const [users] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (users.length === 0) return res.status(401).json({ message: "Wrong email or password" });

    const user = users[0];
    const passwordIsCorrect = await bcrypt.compare(password, user.password);
    if (!passwordIsCorrect) return res.status(401).json({ message: "Wrong email or password" });

    const token = makeToken(user);
    res.status(201).json({
      message: "Login successful",
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ message: "Could not login" });
  }
});

router.get("/session", checkLogin, async (req, res) => {
  try {
    const [users] = await db.query("SELECT id, name, email, role, created_at FROM users WHERE id = ?", [req.user.id]);
    if (users.length === 0) return res.status(404).json({ message: "User not found" });
    res.json({ user: users[0] });
  } catch (error) {
    res.status(500).json({ message: "Could not get logged-in user" });
  }
});

module.exports = router;