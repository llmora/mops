
angular.module('fw', [], function($provide) {
    $provide.factory('UserService', function($http) {
      var us = {initialized: false, isLoggedIn: false, username: ''};

      return {
        getUser: function () {
          return $http.get('/api/loggedin').then(function(user) {
          
            if(user.data!== '0') {
              us.isLoggedIn = true;
              us.username = user.data.username;
              us.initialized = true;
            }

            return us;
          });
        },
        us: us,
        setUser: function ($li, $us) {
          us.initialized = true;
          us.isLoggedIn = $li;
          us.username = $us;
        }
      }
    })

    // http://jjperezaguinaga.com/2013/09/18/angularjs-html5-autocomplete/

  }).
  service('ServiceList', function($q, $http) {

    this.searchService = function(input) {
      var deferred = $q.defer();
      $http.get('/api/servicelist/' + input).then(function(services) {
        var _services = {};
        var services = services.data;

        for(var i = 0, len = services.length; i < len; i++) {

          _services[services[i].name] = services[i].description;
        }

        deferred.resolve(_services);
      }, function() {
        deferred.reject(arguments);
      });

      return deferred.promise;

    }
  }).
  directive('keyboardPoster', function($parse, $timeout) {
    var DELAY_TIME_BEFORE_POSTING = 0;
    return function(scope, elem, attrs) {
      
      var element = angular.element(elem)[0];
      var currentTimeout = null;
     
      element.oninput = function() {
        var model = $parse(attrs.postFunction);
        var poster = model(scope);
        
        if(currentTimeout) {
          $timeout.cancel(currentTimeout)
        }
        currentTimeout = $timeout(function(){
          poster(angular.element(element).val());
        }, DELAY_TIME_BEFORE_POSTING)
      }
    }
  }).
  config(function($routeProvider) {

    var checkLoggedin = function($q, $timeout, $http, $location, $rootScope, UserService){
      // Initialize a new promise
      $rootScope.message = '';
      var deferred = $q.defer();

      if(UserService.us.initialized) {
        if(UserService.us.isLoggedIn) {
          $timeout(deferred.resolve, 0);
        } else {
          $rootScope.message = 'ALERT: You need to log in to access this functionality.';
          $timeout(function(){deferred.reject();}, 0);
        }
      } else {

        UserService.getUser().then(function(user) {
          if(user.isLoggedIn) {
            $timeout(deferred.resolve, 0);
          } else {
            $rootScope.message = 'ALERT: You need to log in to access this functionality.';
            $timeout(function(){deferred.reject();}, 0);
    //        $location.url('/login');
          }
        });
      }      

      return deferred.promise;
    };

    $routeProvider.
      when('/', {templateUrl: 'content_home.html'}).
      when('/doc', {templateUrl: 'content_doc.html'}).
      when('/app/service', {controller: ServiceListCtrl, templateUrl: 'app_servicelist.html', resolve: {loggedin: checkLoggedin}}).
      when('/app/service/:servicename/:serviceversion', {controller: ServiceEditCtrl, templateUrl: 'app_serviceedit.html', resolve: {loggedin: checkLoggedin}}).
      when('/app/service/:servicename', {controller: ServiceEditCtrl, templateUrl: 'app_serviceedit.html', resolve: {loggedin: checkLoggedin}}).
      when('/app/package', {controller: PackageListCtrl, templateUrl: 'app_packagelist.html', resolve: {loggedin: checkLoggedin}}).
      when('/app/package/:packagename', {controller: PackageEditCtrl, templateUrl: 'app_packageedit.html', resolve: {loggedin: checkLoggedin}}).
      otherwise({redirectTo: '/'});
  });

function ServiceListCtrl($scope, $http, $location) {

  $http.get('/api/service').success(function(data) {
    $scope.services = data;

  }).
  error(function(data, status, headers, config) {
    // Show an alert
  });

  $scope.go = function(path) {
    $location.path(path);
    return(false);
  };

}

function ServiceEditCtrl($scope, $http, $location, ServiceList, $routeParams) {
  $scope.servicename = $routeParams.servicename;
  $scope.serviceversion = $routeParams.serviceversion;

  if($scope.servicename == 'new') {
    $scope.service = {'interfaces': [], 'dependencies': []};
    $scope.serviceversion = '1.0';
  } else {
    
    $http.get('/api/service/' + $scope.servicename + '/' + $scope.serviceversion).success(function(data) {
      $scope.service = data;
    }).
    error(function(data, status, headers, config) {
      // Show an alert
    });
  }

  $scope.addInterface = function() {
    $scope.service.interfaces.push($scope.interfaceName);
    $scope.interfaceName = '';
  };

  $scope.deleteInterface = function($item) {
    var index = $scope.service.interfaces.indexOf($item);
    
    if(index != -1) {
      $scope.service.interfaces.splice(index, 1);
    }
  };

  $scope.addDependency = function() {
    var index = $scope.service.dependencies.indexOf($scope.dependency);
    
    if(index == -1) {
      console.log($scope);
      $scope.service.dependencies.push($scope.dependency);
    }

    $scope.dependency = '';

  };

  $scope.deleteDependency = function($item) {
    var index = $scope.service.dependencies.indexOf($item);
    
    if(index != -1) {
      $scope.service.dependencies.splice(index, 1);
    }
  };

  $scope.save = function() {
    $http({method: "POST", url: '/api/service/' + $scope.service.name + '/' + $scope.service.version, data: $scope.service}).success(function(data) {
      $location.path('/app/service');
    }).
    error(function(data, status, headers, config) {
      alert('XXX Error ' + status);
      // Show an alert
    });
  };

  $scope.destroy = function() {
    $http.delete('/api/service/' + $scope.servicename + '/' + $scope.serviceversion).success(function(data) {
      $location.path('/app/service');
    }).
    error(function(data, status, headers, config) {
    alert("Error" + status);
      // Show an alert
    });
  };

  $scope.services = {};
  $scope.searchService = function(input) {
    ServiceList.searchService(input).then(function(services) {
      $scope.services = services;
    });
  };
}

function PackageListCtrl($scope, $http, $location) {

  $http.get('/api/package').success(function(data) {
    $scope.packages = data;

  }).
  error(function(data, status, headers, config) {
    // Show an alert
  });

  $scope.go = function(path) {
    $location.path(path);
    return(false);
  };

}

function PackageEditCtrl($scope, $http, $location, $routeParams) {
  $scope.packagename = $routeParams.packagename;

  if($scope.packagename == 'new') {
    $scope.pkg = {'services': []};
  } else {
    
    $http.get('/api/package/' + $scope.packagename).success(function(data) {
      $scope.pkg = data;
    }).
    error(function(data, status, headers, config) {
      // Show an alert
    });
  }

  $scope.addService = function() {
    $scope.pkg.services.push($scope.service);
    $scope.service = '';
  };

  $scope.deleteService = function($item) {
    var index = $scope.pkg.services.indexOf($item);
    
    if(index != -1) {
      $scope.pkg.services.splice(index, 1);
    }
  };

  $scope.save = function() {
    $http({method: "POST", url: '/api/package/' + $scope.pkg.name, data: $scope.pkg}).success(function(data) {
      $location.path('/app/package');
    }).
    error(function(data, status, headers, config) {
      alert('XXX Error ' + status);
      // Show an alert
    });
  };

  $scope.destroy = function() {
    $http.delete('/api/package/' + $scope.packagename).success(function(data) {
      $location.path('/app/package');
    }).
    error(function(data, status, headers, config) {
    alert("Error" + status);
      // Show an alert
    });

  };
}

function LoginCtrl($scope, $http, $location, $rootScope) {
// Register the login() function
}

function MenuCtrl($scope, $http, UserService, $rootScope, $location) {

  UserService.getUser().then(function(user) {
    $scope.isLoggedIn=user.isLoggedIn;
    $scope.username=user.username;
  });

  $scope.login = function() {
    $http.post('/api/login', {
      username: $scope.user.username,
      password: $scope.user.password,
    })
    .success(function(user){
      // No error: authentication OK
      $rootScope.message = 'Authentication successful!';
      $scope.user.username = '';
      $scope.user.password = '';

      UserService.setUser(true, user.username);

      $scope.isLoggedIn = true,
      $scope.username = user.username;
      
      $location.url('/');
    })
    .error(function(){
      // Error: authentication failed
      $rootScope.message = 'Authentication failed.';
      $scope.user.username = '';
      $scope.user.password = '';

      UserService.setUser(false, '');

      $scope.isLoggedIn = false;
      $scope.username = '';

    });
  };

  $scope.logout = function() {
    $http.post('/api/logout')
    .success(function(user){
      UserService.setUser(false, '');

      $scope.isLoggedIn = false;
      $scope.username = '';
      
      $location.url('/');
    });
  };

}
