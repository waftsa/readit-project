const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  title: String,
  description: String,
  author: String,
  publicationYear: String,
  synopsis: String,
  genre: String,
  cover: String,
  bookUrl: String,
});

const Book = mongoose.model('Book', bookSchema);

module.exports = Book;
