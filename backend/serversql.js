// Import libraries and modules
const express = require('express');
const multer = require('multer');
const bcrypt = require('bcrypt');
const mysql2 = require('mysql2');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(express.static('public'));
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const port = 3308;

// Create MySQL connection
const connection = mysql2.createConnection({
  host: 'localhost',
  user: 'waf',
  password: 'wfts2883',
  database: 'readit',
});

// Connect to MySQL
connection.connect((err) => {
  if (err) {
    console.error('Failed to connect to MySQL:', err);
  } else {
    // Start the server after connecting to MySQL
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  }
});

// Endpoint for user registration
app.post('/register', async (req, res) => {
  console.log(req.body);
  try {
    const newPassword = await bcrypt.hash(req.body.password, 10);
    const user = {
      name: req.body.name,
      email: req.body.email,
      password: newPassword,
    };
    connection.query('INSERT INTO users SET ?', user, (error, results) => {
      if (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ error: 'Failed to register user' });
      } else {
        res.json({ status: 'ok' });
      }
    });
  } catch (err) {
    console.error('Error registering user:', err);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// endpoint untuk login
app.post('/login', (req, res) => {
    const { email, password } = req.body;
  
    // Query untuk mencari pengguna berdasarkan email dan password
    const query = 'SELECT * FROM users WHERE email = ? AND password = ?';
    connection.query(query, [email, password], (error, results) => {
      if (error) {
        res.status(500).json({ message: 'Internal server error' });
      } else {
        if (results.length > 0) {
          // Login berhasil
          const user = results[0];
          res.status(200).json({ message: 'Login successful', user });
        } else {
          // Login gagal
          res.status(401).json({ message: 'Invalid credentials' });
        }
      }
    });
  });
  
  
  // Configure Multer to store uploaded files
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const extension = path.extname(file.originalname);
      cb(null, file.fieldname + '-' + uniqueSuffix + extension);
    },
  });
  
  const upload = multer({ storage: storage });
  
  // Endpoint to upload a book
  app.post(
    '/api/book',
    upload.fields([{ name: 'cover', maxCount: 1 }, { name: 'book', maxCount: 1 }]),
    async (req, res) => {
      const { title, description, author, publicationYear, synopsis, genre } =
        req.body;
      const coverFile = req.files['cover'][0];
      const bookFile = req.files['book'][0];
  
      try {
        const book = {
          title,
          description,
          author,
          publicationYear,
          synopsis,
          genre,
          cover: coverFile.filename,
          bookUrl: bookFile.filename,
        };
  
        connection.query('INSERT INTO books SET ?', book, (error, results) => {
          if (error) {
            console.error('Error uploading book:', error);
            res.status(500).json({ error: 'Book upload failed' });
          } else {
            res.status(200).send('Book uploaded');
          }
        });
      } catch (error) {
        console.error('Error uploading book:', error);
        res.status(500).json({ error: 'Book upload failed' });
      }
    }
  );
  
  // Endpoint to get book data
  app.get('/api/book', async (req, res) => {
    connection.query('SELECT * FROM books', (error, results) => {
      if (error) {
        console.error('Error fetching books:', error);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        const booksWithUrls = results.map((book) => ({
          ...book,
          coverUrl: `/uploads/${book.cover}`,
          epubUrl: `/uploads/${book.bookUrl}`,
        }));
        res.json(booksWithUrls);
      }
    });
  });
  
  // Endpoint to get book details by ID
  app.get('/api/book/:id', async (req, res) => {
    const bookId = req.params.id;
  
    connection.query(
      'SELECT * FROM books WHERE id = ?',
      [bookId],
      (error, results) => {
        if (error) {
          console.error('Error retrieving book:', error);
          res.status(500).json({ error: 'Internal server error' });
        } else if (results.length === 0) {
          res.status(404).json({ error: 'Book not found' });
        } else {
          const book = results[0];
          const bookWithUrl = {
            ...book,
            coverUrl: `/uploads/${book.cover}`,
            bookUrl: `/api/book/${book.id}/epub`,
          };
          res.status(200).json(bookWithUrl);
        }
      }
    );
  });
  
  // Route to serve .epub file
  app.get('/uploads/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    res.sendFile(filePath);
  });

// // Endpoint untuk mengambil file .epub berdasarkan ID
// app.get('/api/book/read/:id', (req, res) => {
//   const { id } = req.params;

//   // Lakukan pengambilan data buku dari database berdasarkan ID
//   const query = 'SELECT bookUrl FROM books WHERE id = ?';
//   connection.query(query, [id], (err, results) => {
//     if (err) {
//       console.error(err);
//       res.status(500).json({ error: 'Failed to fetch book' });
//       return;
//     }

//     if (results.length === 0) {
//       res.status(404).json({ error: 'Book not found' });
//       return;
//     }

//     const bookPath = path.join(__dirname, 'uploads', results[0].bookUrl);
//     res.sendFile(bookPath, (err) => {
//       if (err) {
//         console.error(err);
//         res.status(500).json({ error: 'Failed to fetch book' });
//       }
//     });
//   });
// }); 
 
// Endpoint untuk mengambil file .epub berdasarkan ID
app.get('/api/book/read/:id', (req, res) => {
  const { id } = req.params;
  
  // Mengambil path file .epub dari direktori uploads
  const bookPath = path.join(__dirname, 'uploads', `${id}.epub`);
  
  res.sendFile(bookPath, (err) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch book' });
    }
  });
});

  // Endpoint untuk memberikan path file .epub kepada frontend
app.get('/api/book', (req, res) => {
    const bookPath = '/uploads/book.epub'; // Ubah dengan path file .epub yang sesuai
  
    res.json({ bookPath });
  });
  
  // ...
  
  // Start the server
//   app.listen(port, () => {
//     console.log(`Server running on port ${port}`);
//   });
  
