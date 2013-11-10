var mongodb = require('mongodb'),
   express = require('express'),
   flash = require('connect-flash'),
   crypto = require('crypto'),
   fs = require('fs'),
   https = require('https'),
   ObjectID = require('mongodb').ObjectID,
   app = express(),
   passport = require('passport'),
   db,
   itemTypes = ['mailitem', 'fileitem'],
   LocalStrategy = require('passport-local').Strategy,
   passwordHash = require('password-hash');

app.configure(function() {
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.session({ secret: '0k123p,123;!"%;d)_(i123913' }));
  app.use(flash());
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(app.router);
});

if('development' == app.get('env')) {
  console.log("Enabling development mode");
  app.use(express.errorHandler());
}

passport.serializeUser(function(user, done) {
  done(null, user._id);
});

passport.deserializeUser(function(id, done) {
  var collection = db.collection('user');

  var user = collection.findOne({_id:  new ObjectID(id)}, {username: 1}, function(err, user) {
    if(err) {
      return done(err);
    } else {
      done(err, user);
    }
  });
});

passport.use(new LocalStrategy(
  function(username, password, done) {
    var collection = db.collection('user');

    var user = collection.findOne({username: username}, function(err, user) {
      if(err) {
        return done(err);
      } else {
        if(!user) {
          return done(null, false);
        } else {
          if(!passwordHash.verify(password, user.hash)) {
            return done(null, false);
          } else {
            console.log("Authenticated correctly");
            return done(null, user);
          }
        }
      }
    });
  }
));

app.get('/api/service', ensureAuthenticated, function(req, res) {

  res.write('[');

  var collection = db.collection('service');
  var cursor = collection.find({}, {});
  var first = true;

  cursor.each(function(err,doc) {
    if(doc == null) {
      res.write(']');
      res.end();
    } else {

      if(! first) {
        res.write(',');
      }
      
      first = false;

      res.write(JSON.stringify(doc));
    }
  });

});

app.get('/api/servicelist/:input', ensureAuthenticated, function(req, res) {

  res.write('[');

  var collection = db.collection('service');
  var cursor = collection.find({name: new RegExp(req.params.input) }, {name: 1, description: 1, version: 1});
  var first = true;

  cursor.each(function(err,doc) {
    if(doc == null) {
      res.write(']');
      res.end();
    } else {

      if(! first) {
        res.write(',');
      }
      
      first = false;

      res.write('{"name": "' + doc['name'] + '/' + doc['version'] + '", "description": "' + doc['description'] + '"}');
    }
  });

});

app.get('/api/service/:servicename/:serviceversion', ensureAuthenticated, function(req, res) {

  console.log('Obtaining details for service: \"' + req.params.servicename + "/" + req.params.serviceversion + '\"');

  var collection = db.collection('service');
  var doc = collection.findOne({name: req.params.servicename, version: req.params.serviceversion}, function(err, doc) {
    if(doc) {
      res.write(JSON.stringify(doc));
    }
    res.end();
    
  });

});


app.post('/api/service/:servicename/:serviceversion', ensureAuthenticated, function(req, res) {

  var collection = db.collection('service');

  collection.update({name: req.params.servicename, version: req.params.serviceversion}, {$set: {description: req.body.description, interfaces: req.body.interfaces, dependencies: req.body.dependencies}}, {upsert: true}, function(err, records) {
    res.send(200, { ok: 'Service saved'} );
    console.log('Saving details for service: \"' + req.params.servicename + "/" + req.params.serviceversion + '\"');
  });
});

app.delete('/api/service/:servicename/:serviceversion', ensureAuthenticated, function(req, res) {

  var collection = db.collection('service');
  
  collection.remove({name: req.params.servicename, version: req.params.serviceversion}, function(err, records) {
    res.send(200, { ok: 'Service deleted'} );
    console.log('Deleting service: \"' + req.params.servicename + "/" + req.params.serviceversion + '\"');
  });
});

app.get('/api/package', ensureAuthenticated, function(req, res) {

  res.write('[');

  var collection = db.collection('package');
  var cursor = collection.find({}, {});
  var first = true;

  cursor.each(function(err,doc) {
    if(doc == null) {
      res.write(']');
      res.end();
    } else {

      if(! first) {
        res.write(',');
      }
      
      first = false;

      res.write(JSON.stringify(doc));
    }
  });

});

app.get('/api/package/:packagename', ensureAuthenticated, function(req, res) {

  console.log('Obtaining details for package: \"' + req.params.packagename + '\"');

  var collection = db.collection('package');
  var doc = collection.findOne({name: req.params.packagename}, function(err, doc) {
    if(doc) {
      res.write(JSON.stringify(doc));
    }
    res.end();
    
  });

});


app.post('/api/package/:packagename', ensureAuthenticated, function(req, res) {

  var collection = db.collection('package');

  collection.update({name: req.params.packagename}, {$set: {services: req.body.services}}, {upsert: true}, function(err, records) {
    res.send(200, { ok: 'Package saved'} );
    console.log('Saving details for package: \"' + req.params.packagename + '\"');
  });
});

app.delete('/api/package/:packagename', ensureAuthenticated, function(req, res) {

  var collection = db.collection('package');
  
  collection.remove({name: req.params.packagename}, function(err, records) {
    res.send(200, { ok: 'Package deleted'} );
    console.log('Deleting package: \"' + req.params.packagename + '\"');
  });
});

app.post('/api/login', passport.authenticate('local'), function(req, res) {
  res.send(req.user);
});

// Authentication

var auth = function(req, res, next) {
  if (!req.isAuthenticated()) {
    res.send(401)
  } else {
    next();
  }
};

app.get('/api/loggedin', function(req, res) {
  res.send(req.isAuthenticated() ? req.user : '0');
});

app.post('/api/logout', function(req, res){
  req.logOut(); res.send(200);
});

// Initialization and execution

mongodb.connect('mongodb://127.0.0.1:27017/fw', function(err, dbhandle) {

  if(err) {
    throw err;
  }
  
  db = dbhandle;

  var LISTENER_PORT = 9443;
  var CERT_FILE = 'ssl-cert-snakeoil.pem';
  var KEY_FILE = 'ssl-cert-snakeoil.key';
  var DOCUMENT_ROOT = '.'

  var options = {
    key: fs.readFileSync(KEY_FILE),
    cert: fs.readFileSync(CERT_FILE)
  }

  app.use('/static', express.static(DOCUMENT_ROOT));

  https.createServer(options, app).listen(LISTENER_PORT);
  console.log("FW server started on port " + LISTENER_PORT);
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }

  res.redirect('/login')
}
