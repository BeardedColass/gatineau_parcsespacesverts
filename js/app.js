App = (function () {
    "use strict";
    
    var GMap = google.maps,
        GMarker = GMap.Marker,
        GEvent = GMap.event,
        GLatLng = GMap.LatLng,
        customIcons = {
            parc: {
                icon: 'images/mm_20_green.png' ,
                shadow: 'images/mm_20_shadow.png'
            },
          
            other: {
                icon: 'images/mm_20_green.png',
                shadow: 'images/mm_20_shadow.png'
            }
        },
        activeMarkers = [],
        activeFilters = {
            sectors: {},
            installations: {}
        },
        searchInput, map, infoWindow;
        
    function ajax(url, callback) {
        var request = window.XMLHttpRequest?
            new XMLHttpRequest() :
            new ActiveXObject('Microsoft.XMLHTTP');
    
        request.onreadystatechange = function() {
            if (request.readyState == 4) {
                callback(request, request.status);
            }
        };
        request.open('GET', url, true);
        request.send(null);
    }
    
    function on(el, eventName, handler) {
        var hasAddEventListener = !!window.addEventListener;
        el[hasAddEventListener? 'addEventListener' : 'attachEvent']((hasAddEventListener? '' : 'on') + eventName, handler);
    }
    
    function getMarkers(criterias, callback) {
        criterias = criterias || '';
        
        ajax('php/phpsqlajax_genxml3.php?' + criterias, function (request, status) {  
            callback(JSON.parse(request.responseText), status);
        });
    }
    
    function onMarkerClick() {
        var data = this._data;
        
        infoWindow.setContent([
            '<b>', data.name, '</b><br>',
            data.address, '<br>',
            data.installations
        ].join(''));
        
        infoWindow.open(map, this);
    }
    
    function addMarkers(markers) {
        var counts = {},
            mapMarker, marker, icon, sectorName, sectorSpan;
        sectorName = document.getElementsByName('sector');
        
        
        for (var i = 0, len = sectorName.length; i < len; i++) {
            counts[sectorName[i].value] = 0;
        }
         
        for (var i = 0, len = markers.length; i < len; i++) {
            
            mapMarker = new GMarker({
                map: map,
                position: new GLatLng(
                    parseFloat((marker = markers[i]).lat),
                    parseFloat(marker.lng)
                ),
                icon: (icon = customIcons[marker.type] || {}).icon,
                shadow: icon.shadow
            });
            
            activeMarkers.push(mapMarker);
            
            
            counts[marker.sector] = counts[marker.sector]+ 1;
            //console.log(counts);
            mapMarker._data = marker;
            
            GEvent.addListener(mapMarker, 'click', onMarkerClick);
        }
        var countTxt = 'Count'
        for (var i = 0, len = sectorName.length; i < len; i++) {
            document.getElementById(sectorName[i].value + countTxt).innerText = counts[sectorName[i].value];
        }
        
    }
    
    function removeAllMarkers() {
        var i = activeMarkers.length - 1,
            marker;
        
        while (i >= 0) {
            (marker = activeMarkers[i]).setMap(null);
            GEvent.clearInstanceListeners(marker);
            activeMarkers.splice(i, 1);
            i--;
        }
    }
    
    function onMarkersLoad(markers, status) {
        if (status !== 200) {
            //TODO: Handle error
            return;
        }
        
        addMarkers(markers);
    }
    
    function filterMarkers(criterias) {
        removeAllMarkers();
        getMarkers(criterias, onMarkersLoad);
    }
    
    function updateFilter(type, id, clear) {
        type = type + 's';
        
        if (clear) {
            delete activeFilters[type][id];
        } else {
            activeFilters[type][id] = true;
        }
    }
    
    function installDOMListeners() {
        
        on(document, 'click', function (e) {
            var target = e.target;
            
            if (!target || target.type !== 'checkbox') {  
                return;
            }
            searchInput.value = '';
            updateFilter(target.name, target.value, !target.checked);
            
            filterMarkers(buildCriterias());
        });
        

        on(searchInput, 'keypress', function (e) {
            if (e.keyCode && e.keyCode === 13) {
                filterMarkers('&query=' + searchInput.value);
                clearAllFilters();
            }
        });

    }
    
    function buildCriterias() {
        
        var sectors = activeFilters.sectors,
            installations = activeFilters.installations,
            installationsParams = '',
            sectorsParams = '',
            key;
            
        for (key in sectors) {
            sectorsParams += key + ',';
        }
        
        for (key in installations) {
            installationsParams += key + ',';
        }
        
        return encodeURI(
            (installationsParams === ''? '' : 'installations=' + installationsParams.slice(0, -1))
            + (sectorsParams === ''? '' : (installationsParams? '&' : '') + 'sectors=' + sectorsParams.slice(0, -1))
        );
    }
    
    function clearAllFilters() {
        var filters =  document.querySelectorAll('[type=checkbox]');
        for (var i = 0 ; i < filters.length; i++) {
            filters[i].checked = false;
        }
        
        activeFilters = {
            sectors: {},
            installations: {}
        };
    }
    
    return {
        init: function () {
            
            map = new GMap.Map(document.getElementById("map"), {
                center: new GLatLng(45.486740, -75.633217),
                zoom: 11,
                mapTypeId: 'roadmap'
            });
            
            infoWindow = new GMap.InfoWindow();
            
            filterMarkers('');
            
            searchInput = document.getElementById('search-input');
            
            installDOMListeners();
        }
    };
})();
