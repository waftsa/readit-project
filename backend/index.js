//Connection ke mongodb
const { connectToMongoDB, getClient } = require('./server');
// memanggil library
const express = require('express');
const multer = require('multer');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
// insert models
const User = require('./Models/user');
const Book = require('./Models/book');


const maxTimeout = 30000;

const app = express();
app.use(express.json());
app.use(cors());
// Menyajikan file statis dari folder "uploads"
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const port = 3308;

// mongoose.connect = ('mongodb://localhost:27017/readit')
// connect ke mongodb atlas
connectToMongoDB()
  .then(() => {
    // Server akan dijalankan setelah terhubung ke MongoDB
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to connect to MongoDB:', error);
  });

// Membuat schema dan model untuk koleksi bookmark
const bookmarkSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true,
  },
});

const Bookmark = mongoose.model('Bookmark', bookmarkSchema);

// Endpoint untuk registrasi pengguna
app.post('/register', async (req, res) => {
  console.log(req.body)
	try {
		const newPassword = await bcrypt.hash(req.body.password, 10)
		await User.create({
			name: req.body.name,
			email: req.body.email,
			password: newPassword,
		})
		res.json({ status: 'ok' })
	} catch (err) {
		res.json({ status: 'error', error: 'Duplicate email' })
	}
});

// Endpoint untuk login pengguna
app.post('/login', async (req, res) => {
  const user = await User.findOne({
		email: req.body.email,
	})

	if (!user) {
		return { status: 'error', error: 'Invalid login' }
	}

	const isPasswordValid = await bcrypt.compare(
		req.body.password,
		user.password
	)

	if (isPasswordValid) {
		const token = jwt.sign(
			{
				name: user.name,
				email: user.email,
			},
			'secret123'
		)

		return res.json({ status: 'ok', user: token })
	} else {
		return res.json({ status: 'error', user: false })
	}
});


// Middleware untuk memverifikasi token JWT
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, 'your_secret_key', (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = decoded;
    next();
  });
};

// Endpoint untuk mendapatkan informasi pengguna
app.get('/api/user', verifyToken, (req, res) => {
  // Dapatkan informasi pengguna dari objek req.user
  const { userId } = req.user;

  // Cari pengguna berdasarkan ID
  User.findById(userId, (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { name, email } = user;

    // Kirim informasi pengguna sebagai respons
    res.json({ name, email });
  }).maxTimeMS(maxTimeout);;
});

// Konfigurasi Multer untuk menyimpan file yang diunggah
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

// Endpoint untuk mengunggah buku
app.post('/api/book', upload.fields([{ name: 'cover', maxCount: 1 }, { name: 'book', maxCount: 1 }]), async (req, res) => {
  const { title, description, author, publicationYear, synopsis, genre } = req.body;
  const coverFile = req.files['cover'][0];
  const bookFile = req.files['book'][0];

  try {
    // Simpan data buku ke MongoDB
    const book = new Book({
      title,
      description,
      author,
      publicationYear,
      synopsis,
      genre,
      cover: coverFile.filename,
      bookUrl: bookFile.filename,
    });
    await book.save();

    res.status(200).send('Book uploaded');
  } catch (error) {
    console.error('Error uploading book:', error);
    res.status(500).json({ error: 'Book upload failed' });
  }
});

// Endpoint untuk mengambil data buku
app.get('/api/book', async (req, res) => {
  try {
    const book = await Book.find().maxTimeMS(maxTimeout);

    // Menambahkan URL gambar dan file .epub ke data buku sebelum dikirimkan sebagai respons
    const bookWithUrls = book.map((book) => ({
      ...book.toObject(),
      coverUrl: `/uploads/${book.cover}`,
      epubUrl: `/uploads/${book.bookUrl}`,
    }));

    res.json(bookWithUrls);
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint untuk mendapatkan detail buku berdasarkan ID
app.get('/api/book/:id', async (req, res) => {
  const bookId = req.params.id;

  try {
    // Cari buku berdasarkan ID
    const book = await Book.findById(bookId);

    if (book) {
      const bookWithUrl = {
        ...book.toObject(),
        coverUrl: `/uploads/${book.cover}`,
        bookUrl: `/api/book/${book._id}/epub`, // Menyertakan URL endpoint untuk mengunduh file .epub
      };

      res.status(200).json(bookWithUrl);
    } else {
      res.status(404).json({ error: 'Book not found' });
    }
  } catch (error) {
    console.error('Error retrieving book:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rute untuk mengambil file .epub
app.get('/uploads/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'uploads', req.params.filename);
  res.sendFile(filePath);
});

// Endpoint untuk mengirimkan file .epub
app.get('/api/book/:id/epub', (req, res) => {
  const { id } = req.params;

  // Mengambil data buku dari database berdasarkan ID
  Book.findById(id, (err, book) => {
    if (err || !book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const filePath = path.join(__dirname, 'uploads', book.bookUrl);

    // Mengirimkan file .epub kepada pengguna
    res.download(filePath, (err) => {
      if (err) {
        console.error('Error sending ePub file:', err);
        res.status(500).json({ error: 'Failed to download ePub file' });
      }
    });
  });
});

// Endpoint untuk membuat bookmark
app.post('/api/bookmarks', async (req, res) => {
  const { userId, bookId } = req.body;

  try {
    // Cek apakah bookmark sudah ada
    const existingBookmark = await Bookmark.findOne({ userId, bookId });
    if (existingBookmark) {
      return res.status(400).json({ error: 'Bookmark already exists' });
    }

    // Buat bookmark baru
    const bookmark = new Bookmark({ userId, bookId });
    await bookmark.save();

    res.status(200).json({ message: 'Bookmark added successfully' });
  } catch (error) {
    console.error('Error adding bookmark:', error);
    res.status(500).json({ error: 'Failed to add bookmark' });
  }
});

// Jalankan server
// app.listen(port, () => {
//   console.log(`Server running on port ${port}`);
// });
