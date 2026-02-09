// to get current year
function getYear() {
  var currentDate = new Date();
  var currentYear = currentDate.getFullYear();
  document.querySelector("#displayYear").innerHTML = currentYear;
}

getYear();


// client section owl carousel initialization moved to js/reviews.js



/** google_map js **/
function myMap() {
  var mapDiv = document.getElementById("googleMap");
  if (mapDiv) {
    var mapProp = {
      center: new google.maps.LatLng(40.712775, -74.005973),
      zoom: 18,
    };
    var map = new google.maps.Map(mapDiv, mapProp);
  }
}

// PWA Service Worker Registration logic moved to navbar-auth.js to be controlled by settings