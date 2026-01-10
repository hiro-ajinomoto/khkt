import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { getDB } from '../db.js';
import { config } from '../config.js';

/**
 * Middleware to verify JWT token and attach user to request
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ detail: 'Authentication required' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      
      // Get user from database
      const db = getDB();
      let user;
      try {
        // Try to create ObjectId from hex string
        const userId = ObjectId.createFromHexString(decoded.userId);
        user = await db.collection('users').findOne({
          _id: userId,
        });
      } catch (error) {
        // If ObjectId creation fails, user might be stored as string
        // This shouldn't happen in normal cases, but handle gracefully
        console.warn('Failed to parse userId as ObjectId:', error);
        return res.status(401).json({ detail: 'Invalid user ID format' });
      }

      if (!user) {
        return res.status(401).json({ detail: 'User not found' });
      }

      // Attach user to request
      req.user = {
        id: user._id.toString(),
        username: user.username,
        role: user.role,
      };

      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ detail: 'Token expired' });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ detail: 'Invalid token' });
      }
      throw error;
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ detail: 'Authentication error' });
  }
}

/**
 * Middleware to check if user has teacher role
 */
export function requireTeacher(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ detail: 'Authentication required' });
  }

  if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
    return res.status(403).json({ detail: 'Teacher access required' });
  }

  next();
}

/**
 * Middleware to check if user has admin role
 */
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ detail: 'Authentication required' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ detail: 'Admin access required' });
  }

  next();
}

/**
 * Optional authentication - doesn't fail if no token, but attaches user if token is valid
 */
export async function optionalAuthenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without authentication
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      
      const db = getDB();
      let user;
      try {
        const userId = ObjectId.createFromHexString(decoded.userId);
        user = await db.collection('users').findOne({
          _id: userId,
        });
      } catch (error) {
        // If ObjectId creation fails, ignore
        return next();
      }

      if (user) {
        req.user = {
          id: user._id.toString(),
          username: user.username,
          role: user.role,
        };
      }
    } catch (error) {
      // Ignore token errors for optional auth
    }

    next();
  } catch (error) {
    next(); // Continue even on error
  }
}
