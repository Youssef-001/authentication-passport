/////// app.js

const path = require("node:path");
const { Pool } = require("pg");
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");

const pool = require("./db/pool");

const PgSession = require("connect-pg-simple")(session);

const app = express();
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// app.use(session({ secret: "cats", resave: false, saveUninitialized: false }));
// app.use(passport.session());
app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    store: new PgSession({
      pool: pool, // Connection pool
      tableName: "session", // Optional: defaults to 'session'
    }),
    secret: "your-secret-key", // Change this to a secure key
    resave: false, // Recommended setting
    saveUninitialized: false, // Recommended setting
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day in milliseconds
    },
  })
);

app.use(passport.initialize());
app.use(passport.session()); // This must come after the session middleware

app.get("/", (req, res) => {
  res.render("index", { user: req.user });
  console.log("is uath: ", req.isAuthenticated());
  console.log("hello");
  console.log("session: ", req.session);
  console.log(req.user);
});
app.get("/sign-up", (req, res) => res.render("sign-up-form"));

app.post("/sign-up", async (req, res, next) => {
  try {
    bcrypt.hash(req.body.password, 10, async (err, hashedPassword) => {
      // if err, do something
      // otherwise, store hashedPassword in DB
      if (err) return next(err);
      else {
        await pool.query(
          "INSERT INTO users (username, password) VALUES ($1, $2)",
          [req.body.username, hashedPassword]
        );
        res.redirect("/");
      }
    });
  } catch (err) {
    return next(err);
  }
});

passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM users WHERE username = $1",
        [username]
      );
      const user = rows[0];
      console.log("user is: ", user);

      if (!user) {
        return done(null, false, { message: "Incorrect username" });
      }

      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return done(null, false, { message: "Incorrect password" });
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [
      id,
    ]);
    const user = rows[0];

    done(null, user);
  } catch (err) {
    done(err);
  }
});

app.post(
  "/log-in",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/",
  })
);

app.get("/log-out", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.listen(3000, () => console.log("app listening on port 3000!"));
