/********************************************************************************
* WEB322 – Assignment 06
*
* I declare that this assignment is my own work in accordance with Seneca's
* Academic Integrity Policy:
*
* https://www.senecacollege.ca/about/policies/academic-integrity-policy.html
*
* Name: Smriti Chaudhary Student ID: 159469220 Date: 2025/04/12
*
* Published URL: https://ass5-smrit.vercel.app/
*
********************************************************************************/

const express = require('express');
const siteData = require('./modules/data-service');
const authData = require('./modules/auth-service');
const path = require('path');
const clientSessions = require('client-sessions');
const app = express();
const PORT = process.env.PORT || 3000;

// Setup view engine and public folder
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// Client-sessions config
app.use(clientSessions({
  cookieName: 'session',
  secret: 'smritiAssignment6Secret',
  duration: 2 * 60 * 1000,
  activeDuration: 1000 * 60
}));

// Middleware to expose session to all views
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

// Middleware to protect routes
function ensureLogin(req, res, next) {
  if (!req.session.user) {
    res.redirect('/login');
  } else {
    next();
  }
}

// Home & About
app.get("/", (req, res) => res.render("home"));
app.get("/about", (req, res) => res.render("about"));

// Auth Routes
app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", (req, res) => {
  authData.registerUser(req.body).then(() => {
    res.render("register", { successMessage: "User created" });
  }).catch(err => {
    res.render("register", { errorMessage: err, userName: req.body.userName });
  });
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", (req, res) => {
  req.body.userAgent = req.get('User-Agent');

  authData.checkUser(req.body).then(user => {
    req.session.user = {
      userName: user.userName,
      email: user.email,
      loginHistory: user.loginHistory
    };
    res.redirect("/sites");
  }).catch(err => {
    res.render("login", { errorMessage: err, userName: req.body.userName });
  });
});

app.get("/logout", (req, res) => {
  req.session.reset();
  res.redirect("/");
});

app.get("/userHistory", ensureLogin, (req, res) => {
  res.render("userHistory");
});

// Site routes (protected)
app.get('/sites', async (req, res) => {
  try {
    const { region, provinceOrTerritory } = req.query;
    const sites = region
      ? await siteData.getSitesByRegion(region)
      : provinceOrTerritory
      ? await siteData.getSitesByProvinceOrTerritoryName(provinceOrTerritory)
      : await siteData.getAllSites();
    res.render('sites', { sites });
  } catch (err) {
    res.status(404).render('404', { message: err.message });
  }
});

app.get('/sites/:siteId', async (req, res) => {
  try {
    const site = await siteData.getSiteById(req.params.siteId);
    res.render('site', { site });
  } catch (err) {
    res.status(404).render('404', { message: err.message });
  }
});

app.get('/addSite', ensureLogin, async (req, res) => {
  try {
    const provincesAndTerritories = await siteData.getAllProvincesAndTerritories();
    res.render('addSite', { provincesAndTerritories });
  } catch (err) {
    res.status(500).render('500', { message: err.message });
  }
});

app.post('/addSite', ensureLogin, async (req, res) => {
  try {
    await siteData.addSite(req.body);
    res.redirect('/sites');
  } catch (err) {
    res.status(500).render('500', { message: err.message });
  }
});

app.get('/editSite/:id', ensureLogin, async (req, res) => {
  try {
    const site = await siteData.getSiteById(req.params.id);
    const provincesAndTerritories = await siteData.getAllProvincesAndTerritories();
    res.render('editSite', { site, provincesAndTerritories });
  } catch (err) {
    res.status(404).render('404', { message: err.message });
  }
});

app.post('/editSite', ensureLogin, async (req, res) => {
  try {
    await siteData.editSite(req.body.siteId, req.body);
    res.redirect('/sites');
  } catch (err) {
    res.status(500).render('500', { message: err.message });
  }
});

app.get('/deleteSite/:id', ensureLogin, async (req, res) => {
  try {
    await siteData.deleteSite(req.params.id);
    res.redirect('/sites');
  } catch (err) {
    res.status(500).render('500', { message: err.message });
  }
});

// 404 fallback
app.use((req, res) => res.status(404).render('404', { message: 'Route not found' }));

// Startup
siteData.initialize()
  .then(authData.initialize)
  .then(() => {
    if (!process.env.VERCEL) {
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    }
  })
  .catch(err => {
    console.log(`Unable to start server: ${err}`);
  });

module.exports = app;