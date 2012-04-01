$(function () { //jQuery .ready handler
    

    
    App.init();
      
}); 

App = (function () {
    "use strict";
    
    var GMap = google.maps,
        GMarker = GMap.Marker,
        GEvent = GMap.event,
        GLatLng = GMap.LatLng,
        customIcons = {
            parc: {
                icon: 'images/mm_20_green.png',
                shadow: 'images/mm_20_shadow.png'
            },
          
            other: {
                icon: 'images/mm_20_green.png',
                shadow: 'images/mm_20_shadow.png'
            }
        },
        focusedMarker = null,
        displayedMarkers = [],
        activeFilters = {
            sectors: {},
            installations: {},
            search: ""
        },
        cachedMarkers = null,
        
        sectorsCounts = {},
        allSectors = {},
        parcNom = [],
        searchInput, map, infoWindow, markerClusterer;
    
    /**
     * Filters marker so that,
     * any (OR) sector selection match
     * all (AND) installation selections match
     */
    function filterMarkers(filters, markers) {
        filters = filters || activeFilters;
        
        var filteredMarkers = [],
            sectorsFilter = filters.sectors,
            installationsFilter = filters.installations,
            searchFilter = filters.search,
            searchRX = new RegExp(searchFilter, 'i');
            
            
        $.each(markers, function (i, marker) {
            var hasAtLeastOneSector = false;
            var accept = false;
            var reject = true;
            
            
                
            if (searchFilter){
                    if (searchRX.test(marker.name)){
                        reject= false;
                    }
            } else{
                $.each(sectorsFilter, function (sector) {
                    hasAtLeastOneSector = true;
                    if (marker.sector === sector) {
                        accept = true;
                        return false; // break the foreach loop
                    }
                });
            
                // reject by sector: at least on sector is checked, and NO selected sectors match
                reject = hasAtLeastOneSector && !accept;
            
                // reject by installation: reject if any selected installation is not present
                $.each(installationsFilter, function (installation) {
                    if (!marker.hasInstallation[installation]) {
                        reject = true;
                        return false; // break the foreach loop
                    }
                });
            }
            if (!reject) {
                filteredMarkers.push(marker);
            }
        });
        return filteredMarkers;
    }
    
    function markersPostProcessing(markers) {
        
        var allInstallations = {};
        
        $.each(markers, function (i, marker) {
            allSectors[marker.sector] = true;
            marker.hasInstallation = {};
       
            $.each(marker.installations, function (i, installation) {
                allInstallations[installation] = true;
                marker.hasInstallation[installation] = true;
            });
        });
        
        // sort and insert sector checkboxes
        var sortedSectors = c7nSortedHashKeys(allSectors);
        var $sectors = $('#sectors');
        
        $.each(sortedSectors, function (i, sector) {
            $sectors.append($('<input type="checkbox" name="sectors" value="' + sector + '"/> <span>' + sector + '</span> <span id="' + sector +  '_count"></span>'));
        });
        
        // initialize sectors counts
        for (var k in allSectors) {
            sectorsCounts[k] = 0;
        }
        
        // sort and insert installation checkboxes
        var sortedInstallations = c7nSortedHashKeys(allInstallations);
        var $trows = $(), $tr;
        
        $.each(sortedInstallations, function (i, installation) {
        
            if ((i%6) === 0) {
                $tr = $('<tr />');
                $trows = $trows.add($tr);
            }
            
            $tr.append($('<td><input type="checkbox" name="installations" value="' + installation + '"/> ' + installation + '</td>'));
        });
        
        $('#installations table').append($trows);
        
        
    }
    
    /**
     * Fetches a filtered markers list according to provided filters.
     */
    function getMarkers(filters, success, error) {
        if (cachedMarkers) {
            success && success(filterMarkers(filters, cachedMarkers));
        } else {
            $.getJSON('data/markers.json', function (data) {
                
                markersPostProcessing(cachedMarkers = data);
                
                success && success(filterMarkers(filters, cachedMarkers));
                
            }).error(error);
        }
    }
    
    function onMarkerClick() {
        var data = this._data;
        
        if (focusedMarker) {
            focusedMarker.setAnimation(null);
        }
        
        focusedMarker = this;
        
        infoWindow.setContent([
            '<b>', data.name, '</b><br>',
            data.address, '<br>',
            data.installations
        ].join(''));
        
        infoWindow.open(map, this);
        
        setTimeout(function () {
            focusedMarker.setAnimation(GMap.Animation.BOUNCE);
        }, 0);
    }
    
    function addMarkersToMap(markers) {
        var mapMarker, marker, icon;
        
        
        
        for (var i = 0, len = markers.length; i < len; i++) {
            
            mapMarker = new GMarker({
                position: new GLatLng(
                    (marker = markers[i]).lat,
                    marker.lng
                ),
                icon: (icon = customIcons[marker.type] || {}).icon,
                shadow: icon.shadow
            });
            
            displayedMarkers.push(mapMarker);
            
            mapMarker._data = marker;
            
            GEvent.addListener(mapMarker, 'click', onMarkerClick);
            
            $(document).trigger('markerAdded', [marker]);
        }
        
        markerClusterer.addMarkers(displayedMarkers);
        
        $(document).trigger('allMarkersAdded', [displayedMarkers]);
    }
    
    function removeAllMarkersFromMap() {
        var i = displayedMarkers.length - 1,
            marker;
        
        markerClusterer.clearMarkers();
        
        while (i >= 0) {
            marker = displayedMarkers[i];
            GEvent.clearInstanceListeners(marker); //TODO: Is this needed since we used clearMarkers?
            displayedMarkers.splice(i, 1);
            i--;
        }
    }
    
    function refreshMarkers() {
        
        $(document).trigger('beforeRefreshMarkers');
        removeAllMarkersFromMap();
        getMarkers(activeFilters, addMarkersToMap);
    }
    
    function updateFilter(type, id, clear) {
        if (clear) {
            delete activeFilters[type][id];
        } else {
            activeFilters[type][id] = true;
        }
    }
    
    function installListeners() {
        
        $(document).on('click', '[type=checkbox]', function (e) {
            var chk = e.target;
            
            
            updateFilter(chk.name, chk.value, !chk.checked);            
            refreshMarkers();
        });
        
        $(searchbar).bind("keypress", function(e) {
            if (e.keyCode == 13) {
                var search = document.getElementById('searchInput');
                clearAllFilters();
                activeFilters.search = search.value;
                
                refreshMarkers();         
            }
        });
        
        GEvent.addListener(infoWindow, 'closeclick', function () {
            focusedMarker.setAnimation(null);
            focusedMarker = null;
        });
        
        $(document).on('markerAdded', function (e, marker) {
            sectorsCounts[marker.sector] += 1;
        });
        
        $(document).on('allMarkersAdded', function (){
            updateCounts();
        });
        
        $(document).on('beforeRefreshMarkers', function (){
            resetCounts();
        });
        
        $(document).one('allMarkersAdded', function(){
            for (var i in  cachedMarkers){
                parcNom[i] = cachedMarkers[i].name;
            }
            $("input#searchInput").autocomplete({
            source: parcNom
            }); 
        });
        
        
    }
    
    function updateCounts(){
        for (var k in allSectors) {
            document.getElementById(k + '_count').innerText = '(' + sectorsCounts[k] + ')';
        }
    }
    
    function clearAllFilters() {
        var filters =  document.querySelectorAll('[type=checkbox]');
        for (var i = 0 ; i < filters.length; i++) {
            filters[i].checked = false;
        }
        
        activeFilters = {
            sectors: {},
            installations: {},
            search: ""
        };
    }

    
    function resetCounts(){
        for (var k in sectorsCounts){
            sectorsCounts[k] = 0; 
        }
        
        
    }
        
    return {
        init: function () {
            
            map = new GMap.Map(document.getElementById("map"), {
                center: new GLatLng(45.486740, -75.633217),
                zoom: 11,
                mapTypeId: 'roadmap'
            });
            
            markerClusterer = new MarkerClusterer(map, null, {
                minimumClusterSize: 10
            });
            
            infoWindow = new GMap.InfoWindow();
            
            installListeners();
            
            refreshMarkers();
            
            
        }
    };
})();
