const express = require("express");
const jwt = require("jsonwebtoken");
const env = require("dotenv");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const { UserModel, TodoModel } = require('./db');
const { auth } = require('./auth');
const { z } = require("zod");

env.config();
mongoose.connect(process.env.MONGODB_URI);

const app = express();
app.use(express.json());

const userSchema = z.object({
  username: z.string().min(5, "Username must be at least 3 characters long").email("Invalid email format"),
  password: z.string().min(10, "password must be at least 3 characters long"),
  name: z.string().min(5, "Name must be at least 3 characters long"),
});

function validateUser(req, res, next) {
    const validateUser = userSchema.safeParse(req.body);

  if (!validateUser.success) {
    return res.status(400).json({ errors: validateUser.error.errors });
  }

  next();
}

app.post('/signup', validateUser, async (req, res) => {

  const { username, password, name } = req.body;

  try {
    const user = await UserModel.findOne({ username });

    if (user) {
      return res.status(409).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await UserModel.create({
      username,
      password: hashedPassword,
      name
    });

    res.status(201).json({ message: `User successfully created: ${username}` });
  } catch (error) {
    console.error("Error in signup:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.post('/signin', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const user = await UserModel.findOne({ username });

    if (!user) {
      return res.status(403).json({ message: "Invalid credentials" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (passwordMatch) {
      const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET);
      res.status(200).json({ token });
    } else {
      res.status(403).json({ message: "Invalid credentials" });
    }
  } catch (error) {
    console.error("Error in signin:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.use(auth);

app.get('/todos', async (req, res) => {
  try {
    const userId = req.userId;
    const todos = await TodoModel.find({ userId });

    if(!todos) {
      return res.status(404).json({ message: "No todos have created"});
    }
    res.status(200).json(todos);
  } catch (error) {
    console.error("Error in fetching todos:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.post('/todo', async (req, res) => {
  const userId = req.userId;
  const { description, done } = req.body;

  console.log(userId)
  try {
    await TodoModel.create({ userId, description, done });
    res.status(201).json({ message: "Todo successfully created" });
  } catch (error) {
    console.error("Error in creating todo:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.put('/todo/:id', async (req, res) => {
  // const userId = req.userId;
  const { description, done } = req.body;
  const { id } = req.params;

  try {
    const updatedTodo = await TodoModel.findByIdAndUpdate(id, {description, done});

    if(!updatedTodo) {
      return res.status(404).json({ message: `Todo with id ${id} not found`});
    }
    res.status(200).json({ message: "Todo successfully updated" });
  } catch (error) {
    console.error("Error in creating todo:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Server listening on port:", port);
});
