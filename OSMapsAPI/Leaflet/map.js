//
// Setup the EPSG:27700 (British National Grid) projection
//
var crs = new L.Proj.CRS(
    'EPSG:27700',
    "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.999601 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.060,0.1502,0.2470,0.8421,-20.4894 +datum=OSGB36 +units=m +no_defs",
    {
        transformation: new L.Transformation(1, 238375, -1, 1376256),
        resolutions: [896.0, 448.0, 224.0, 112.0, 56.0, 28.0, 14.0, 7.0, 3.5, 1.75, 0.875, 0.4375, 0.21875, 0.109375],
    });

var map;

async function setupLayer() {
    if(map) {
        map.remove();
    }

    var key = document.getElementById('keyInput').value;
    var message = document.getElementById('message');
    var instructions = document.getElementById('instructions');
    var style = document.getElementById('style').value;

    if(!key) {
        message.classList.add("warning");
        message.textContent = 'To view the map, please enter a valid API key.';
        instructions.classList.remove("hidden");
        return;
    }
    message.classList.remove("warning");
    message.textContent = 'To view the map, please enter a valid API key.';
    instructions.classList.add("hidden");
    
    // Set up default view options for EPSG:3857
    var tileMatrix = 'EPSG:3857';
    var mapOptions = {
        maxZoom: 20,
        minZoom: 7,
        center: [51.507222, -0.1275],
        // maxBounds: [[49, -6.5],[61, 2.3]],
        zoom: 10
    };
    
    // Make some specific changes relevant to EPSG:27700 only
    if(style.indexOf('27700') !== -1) {
        tileMatrix = 'EPSG:27700';
        mapOptions.crs = crs;
        mapOptions.maxZoom = 13;
        mapOptions.minZoom = 0;
        mapOptions.zoom = 4;
    }
    
    // Set up the main url parameters
    var url = 'https://api.os.uk/maps/raster/v1/wmts';
    var parameters = {
        key: key,
        tileMatrixSet: encodeURI(tileMatrix),
        version: '1.0.0',
        style: 'default',
        layer: encodeURI(style),
        service: 'WMTS',
        request: 'GetTile',
        tileCol: '{x}',
        tileRow: '{y}',
        tileMatrix: '{z}',
    };
    let parameterString = Object.keys(parameters)
        .map(function(key) { return key + '=' + parameters[key]; })
        .join('&');
    var layer =  new L.TileLayer(
        url + '?' + parameterString,
        {
            // Add appropriate attribution
            attribution: '&copy; <a href="http://www.ordnancesurvey.co.uk/">Ordnance Survey</a>',
            maxZoom: 20
        }
    );
    
    // Add error handling in case the tile load fails
    layer.on('tileerror', function(event) {
        message.classList.add("warning");
        message.textContent = 'Could not connect to the API. Ensure you are entering a project API key for a project that contains the OS Maps API';
        instructions.classList.remove("hidden");
    });
    // Remove warning and hide instructions on tile load. This is so tileerror message does not persist when returning to a valid zoom level
    layer.on('tileloadstart', function(event) {
        message.classList.remove("warning");
        message.textContent = 'To view the map, please enter a valid API key.';
        instructions.classList.add("hidden");
    });
    mapOptions.layers = layer;
    // Create the map object and connect it to the 'map' element in the html
    map = L.map('map', mapOptions);

    const regionGeoJSON = 'https://opendata.arcgis.com/datasets/15f49f9c99ae4a16a6a5134258749b8a_0.geojson';
    const response = await fetch(regionGeoJSON);
    const geoJSON = await response.json();
    console.log(geoJSON);
    const geoJsonLayer = new L.geoJSON(geoJSON).addTo(map);

    const allDeathData = await getDeathsData();

    geoJsonLayer.eachLayer((layer) =>{
        const layerName = layer.feature.properties.rgn19nm;
        const deaths = allDeathData.filter(regionData => regionData.areaName === layerName);
        layer.feature.properties.deaths = deaths;
        
        layer.setStyle(getStyle(layer));

        console.log(layer)
    });

    console.log(await getDeathsData());
}

const getDeathsData = async () => {
    const covidDataUrl = 'https://api.coronavirus.data.gov.uk/v1/data?filters=areaType=region;date=2020-10-10&structure={"date":"date","areaName":"areaName","newDeaths28DaysByDeathDate":"newDeaths28DaysByDeathDate"}';
    const response = await fetch(covidDataUrl);
    const json = await response.json();

    return json.data;
}

const getColour = d => {
    return d > 35 ? '#800026' :
           d > 30  ? '#BD0026' :
           d > 25  ? '#E31A1C' :
           d > 20  ? '#FC4E2A' :
           d > 15   ? '#FD8D3C' :
           d > 10   ? '#FEB24C' :
           d > 5   ? '#FED976' :
                      '#FFEDA0';
}

const getStyle = layer => {
    return {
        fillColor: getColour(layer.feature.properties.deaths[0].newDeaths28DaysByDeathDate),
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.7
    };
}


