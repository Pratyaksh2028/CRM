/**
 * Authentication Middleware
 * Handles JWT verification and role-based access validation.
 */

const jwt = require("jsonwebtoken");
require("dotenv").config();

const SECRET_KEY = process.env.JWT_SECRET || "crm_secret_key";

function makeToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: "1d" });
}

function checkLogin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Please login first" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Please login first" });

  jwt.verify(token, SECRET_KEY, (error, userData) => {
    if (error) return res.status(403).json({ message: "Invalid login token" });
    req.user = userData;
    next();
  });
}

function checkAdmin(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Only admin can do this" });
  next();
}

module.exports = { makeToken, checkLogin, checkAdmin };