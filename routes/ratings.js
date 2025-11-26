const express = require('express');
const router = express.Router();
const pool = require('../dbcon');

// GET all ratings
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT 
        id, 
        name AS guestName, 
        location AS propertyName, 
        image, 
        rating, 
        text AS review, 
        created_at AS date 
      FROM testimonials 
      ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching ratings:', error);
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
});

// POST - Add a new rating (THIS WAS MISSING)
router.post('/', async (req, res) => {
  try {
    const { guestName, propertyName, image, rating, review, date } = req.body;

    // Basic validation
    if (!guestName || !propertyName || !rating || !review) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const query = `
      INSERT INTO testimonials 
      (name, location, image, rating, text, created_at) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.execute(query, [
      guestName, 
      propertyName, 
      image || '', // Handle empty image if needed
      rating, 
      review,
      date || new Date()
    ]);

    // Send back the newly created object so the frontend can display it immediately
    res.status(201).json({
      id: result.insertId,
      guestName,
      propertyName,
      image,
      rating,
      review,
      date
    });

  } catch (error) {
    console.error('Error adding rating:', error);
    res.status(500).json({ error: 'Failed to add rating' });
  }
});

// DELETE - delete a rating
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.execute('DELETE FROM testimonials WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Rating not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting rating:', error);
    res.status(500).json({ error: 'Failed to delete rating' });
  }
});

module.exports = router;c